import type {
  FunctionStackUsageEntry,
  VcgNode,
} from '../types/build-report';

export interface StackUsageMatch {
  stackBytes: number;
  allocationType: string;
}

export interface StackUsageIndex {
  byLocation: Map<string, FunctionStackUsageEntry>;
  byFunctionName: Map<string, FunctionStackUsageEntry[]>;
}

function normalizePath(file: string): string {
  return file.replace(/\\/g, '/');
}

function locationKey(file: string, line: number, column: number): string {
  return `${normalizePath(file)}:${line}:${column}`;
}

function isIdentifierStart(ch: string): boolean {
  return /[A-Za-z_]/.test(ch);
}

function isWindowsDriveColon(s: string, colonIndex: number): boolean {
  if (colonIndex !== 1 || !isIdentifierStart(s[0])) {
    return false;
  }
  if (colonIndex + 1 >= s.length) {
    return true;
  }
  const next = s[colonIndex + 1];
  return next === '\\' || next === '/';
}

function findLastColonExcludingDrive(s: string, beforeIndex: number): number {
  for (let i = beforeIndex - 1; i >= 0; i--) {
    if (s[i] !== ':') {
      continue;
    }
    if (isWindowsDriveColon(s, i)) {
      continue;
    }
    return i;
  }
  return -1;
}

function findObjectFileColon(title: string): number {
  for (let i = title.length - 3; i >= 0; i--) {
    if (title[i] === '.' && title[i + 1] === 'o' && title[i + 2] === ':') {
      return i + 2;
    }
  }
  return -1;
}

/** 从 GCC callgraph 节点 title 解析符号名（与 GccCallgraphParser.parseNodeTitle 一致） */
export function symbolFromNodeTitle(title: string): string {
  const objColon = findObjectFileColon(title);
  if (objColon >= 0) {
    return title.slice(objColon + 1);
  }
  const colon = findLastColonExcludingDrive(title, title.length);
  if (colon > 0) {
    return title.slice(colon + 1);
  }
  return title;
}

export function buildStackUsageIndex(
  entries: FunctionStackUsageEntry[],
): StackUsageIndex {
  const byLocation = new Map<string, FunctionStackUsageEntry>();
  const byFunctionName = new Map<string, FunctionStackUsageEntry[]>();

  for (const e of entries) {
    byLocation.set(
      locationKey(e.location.file, e.location.line, e.location.column),
      e,
    );
    const list = byFunctionName.get(e.functionName) ?? [];
    list.push(e);
    byFunctionName.set(e.functionName, list);
  }

  return { byLocation, byFunctionName };
}

function toMatch(entry: FunctionStackUsageEntry): StackUsageMatch {
  return {
    stackBytes: entry.stackBytes,
    allocationType: entry.allocationType,
  };
}

function pickEntryByNodeLocation(
  entries: FunctionStackUsageEntry[],
  node: VcgNode,
): FunctionStackUsageEntry | null {
  if (node.location?.line === undefined) {
    return entries[0] ?? null;
  }
  const file = normalizePath(node.location.file);
  const line = node.location.line;
  const column = node.location.column ?? 0;

  const exact = entries.find(
    (e) =>
      normalizePath(e.location.file) === file &&
      e.location.line === line &&
      e.location.column === column,
  );
  if (exact) {
    return exact;
  }

  const sameLine = entries.find(
    (e) => normalizePath(e.location.file) === file && e.location.line === line,
  );
  return sameLine ?? entries[0] ?? null;
}

export function lookupStackUsageForNode(
  node: VcgNode,
  index: StackUsageIndex,
): StackUsageMatch | null {
  if (node.location?.line !== undefined) {
    const column = node.location.column ?? 0;
    const byLoc = index.byLocation.get(
      locationKey(node.location.file, node.location.line, column),
    );
    if (byLoc) {
      return toMatch(byLoc);
    }
  }

  const names = new Set<string>();
  if (node.label) {
    names.add(node.label);
  }
  names.add(symbolFromNodeTitle(node.title));

  for (const name of names) {
    const entries = index.byFunctionName.get(name);
    if (!entries?.length) {
      continue;
    }
    const picked = pickEntryByNodeLocation(entries, node);
    if (picked) {
      return toMatch(picked);
    }
  }

  return null;
}
