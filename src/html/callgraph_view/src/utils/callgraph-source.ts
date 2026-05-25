import type { NormalizedCallgraphGraph } from '../types/build-report';

export function sourceBasename(title: string): string {
  const normalized = title.replace(/\\/g, '/');
  const slash = normalized.lastIndexOf('/');
  return slash >= 0 ? normalized.slice(slash + 1) : normalized;
}

/** 按源文件 basename 查找单文件调用图索引，未找到返回 null */
export function findCallgraphIndexByBasename(
  graphs: NormalizedCallgraphGraph[],
  basename: string,
): number | null {
  const index = graphs.findIndex(
    (g) => sourceBasename(g.title).localeCompare(basename, undefined, { sensitivity: 'base' }) === 0,
  );
  return index >= 0 ? index : null;
}

export const DEFAULT_CALLGRAPH_SOURCE_BASENAME = 'main.c';
