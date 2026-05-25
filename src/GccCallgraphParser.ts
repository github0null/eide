/*
    MIT License

    Copyright (c) 2019 github0null

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
*/

import * as fs from 'fs';

/** Parsed GCC -fcallgraph-info VCG document. */
export interface CallgraphVcg {
    graph: { title: string };
    nodes: VcgNode[];
    edges: VcgEdge[];
    /** Non-fatal issues encountered during parsing (lenient mode). */
    warnings?: string[];
}

export interface VcgLocation {
    file: string;
    line?: number;
    column?: number;
}

export interface VcgNode {
    /** Unique node id (often "object.o:symbol" or bare "symbol"). */
    title: string;
    /** Function / symbol display name (first line of GCC label, without location). */
    label: string;
    location?: VcgLocation;
    shape?: string;
}

export interface VcgEdge {
    sourcename: string;
    targetname: string;
    label?: string;
}

export interface ParsedTitle {
    symbol: string;
    objectFile?: string;
}

export interface ParseCallgraphVcgOptions {
    /** When true, throw on unrecognized non-empty input. */
    strict?: boolean;
}

type VcgStatementKind = 'graph' | 'node' | 'edge';

interface VcgStatement {
    kind: VcgStatementKind;
    attrs: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Character utilities (no RegExp)
// ---------------------------------------------------------------------------

function isWhitespace(ch: string): boolean {
    return ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n';
}

function isIdentifierStart(ch: string): boolean {
    const c = ch.charCodeAt(0);
    return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || ch === '_';
}

function isIdentifierChar(ch: string): boolean {
    if (isIdentifierStart(ch)) {
        return true;
    }
    const c = ch.charCodeAt(0);
    return (c >= 48 && c <= 57) || ch === '-';
}

function isDigit(ch: string): boolean {
    const c = ch.charCodeAt(0);
    return c >= 48 && c <= 57;
}

function isAllDigits(s: string): boolean {
    if (s.length === 0) {
        return false;
    }
    for (let i = 0; i < s.length; i++) {
        if (!isDigit(s[i])) {
            return false;
        }
    }
    return true;
}

function skipWhitespace(text: string, i: number): number {
    while (i < text.length && isWhitespace(text[i])) {
        i++;
    }
    return i;
}

function findLastChar(s: string, ch: string): number {
    for (let i = s.length - 1; i >= 0; i--) {
        if (s[i] === ch) {
            return i;
        }
    }
    return -1;
}

function stringsEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

function readIdentifier(text: string, i: number): { value: string; next: number } | null {
    i = skipWhitespace(text, i);
    if (i >= text.length || !isIdentifierStart(text[i])) {
        return null;
    }
    const start = i;
    i++;
    while (i < text.length && isIdentifierChar(text[i])) {
        i++;
    }
    return { value: text.slice(start, i), next: i };
}

function readQuotedString(text: string, i: number): { value: string; next: number } {
    // caller must ensure text[i] === '"'
    i++;
    let value = '';
    while (i < text.length) {
        const ch = text[i];
        if (ch === '"') {
            return { value, next: i + 1 };
        }
        if (ch === '\\' && i + 1 < text.length) {
            const esc = text[i + 1];
            if (esc === 'n') {
                value += '\n';
            } else if (esc === 't') {
                value += '\t';
            } else if (esc === 'r') {
                value += '\r';
            } else if (esc === '"') {
                value += '"';
            } else if (esc === '\\') {
                value += '\\';
            } else {
                // GCC VCG may contain Windows paths like C:\Users\... inside quotes.
                value += '\\';
                value += esc;
            }
            i += 2;
            continue;
        }
        value += ch;
        i++;
    }
    return { value, next: i };
}

function readUnquotedToken(text: string, i: number): { value: string; next: number } {
    i = skipWhitespace(text, i);
    const start = i;
    while (i < text.length && !isWhitespace(text[i]) && text[i] !== '}') {
        i++;
    }
    return { value: text.slice(start, i), next: i };
}

function readAttributeValue(text: string, i: number): { value: string; next: number } {
    i = skipWhitespace(text, i);
    if (i < text.length && text[i] === '"') {
        return readQuotedString(text, i);
    }
    return readUnquotedToken(text, i);
}

function readKey(text: string, i: number): { key: string; next: number } | null {
    i = skipWhitespace(text, i);
    if (i >= text.length || !isIdentifierStart(text[i])) {
        return null;
    }
    const start = i;
    while (i < text.length && isIdentifierChar(text[i])) {
        i++;
    }
    return { key: text.slice(start, i), next: i };
}

/**
 * Find the closing `}` for `{` at openIndex, respecting quoted strings.
 */
function findClosingBrace(text: string, openIndex: number): number {
    if (openIndex >= text.length || text[openIndex] !== '{') {
        return -1;
    }
    let depth = 0;
    let i = openIndex;
    while (i < text.length) {
        const ch = text[i];
        if (ch === '"') {
            const quoted = readQuotedString(text, i);
            i = quoted.next;
            continue;
        }
        if (ch === '{') {
            depth++;
            i++;
            continue;
        }
        if (ch === '}') {
            depth--;
            if (depth === 0) {
                return i;
            }
            i++;
            continue;
        }
        i++;
    }
    return -1;
}

// ---------------------------------------------------------------------------
// Attribute & statement parsing
// ---------------------------------------------------------------------------

/**
 * Parse the interior of a VCG `{ ... }` block into key/value attributes.
 */
export function parseAttributes(body: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    let i = 0;

    while (i < body.length) {
        i = skipWhitespace(body, i);
        if (i >= body.length || body[i] === '}') {
            break;
        }

        const keyResult = readKey(body, i);
        if (!keyResult) {
            break;
        }
        const { key } = keyResult;
        i = skipWhitespace(body, keyResult.next);

        if (i >= body.length || body[i] !== ':') {
            break;
        }
        i++;
        i = skipWhitespace(body, i);

        let value: string;
        if (i < body.length && body[i] === '"') {
            const quoted = readQuotedString(body, i);
            value = quoted.value;
            i = quoted.next;
        } else {
            const token = readUnquotedToken(body, i);
            value = token.value;
            i = token.next;
        }

        attrs[key] = value;
    }

    return attrs;
}

function parseStatementKind(kindStr: string): VcgStatementKind | null {
    if (kindStr === 'graph' || kindStr === 'node' || kindStr === 'edge') {
        return kindStr;
    }
    return null;
}

/**
 * Parse one VCG statement starting at `start`. Returns null if not a valid statement.
 * When `limit` is set, the closing `}` must appear before `limit` (for nested graph bodies).
 */
function parseStatementAt(
    text: string,
    start: number,
    limit?: number
): { stmt: VcgStatement; next: number } | null {
    let i = skipWhitespace(text, start);
    const end = limit ?? text.length;
    if (i >= end) {
        return null;
    }

    const id = readIdentifier(text, i);
    if (!id) {
        return null;
    }

    const kind = parseStatementKind(id.value);
    if (!kind) {
        return null;
    }

    i = skipWhitespace(text, id.next);
    if (i >= end || text[i] !== ':') {
        return null;
    }
    i++;

    i = skipWhitespace(text, i);
    if (i >= end || text[i] !== '{') {
        return null;
    }

    const closeBrace = findClosingBrace(text, i);
    if (closeBrace < 0 || closeBrace >= end) {
        return null;
    }

    const body = text.slice(i + 1, closeBrace);
    const attrs = parseAttributes(body);
    let next = skipWhitespace(text, closeBrace + 1);

    return { stmt: { kind, attrs }, next };
}

/** Whether a graph body contains nested `node:` / `edge:` statements (GCC .ci / .ltrans.ci). */
function bodyHasNestedStatements(text: string, bodyStart: number, bodyEnd: number): boolean {
    // bodyStart is immediately after the graph's opening `{`.
    let depth = 1;
    let i = bodyStart;
    while (i < bodyEnd) {
        const ch = text[i];
        if (ch === '"') {
            const quoted = readQuotedString(text, i);
            i = quoted.next;
            continue;
        }
        if (ch === '{') {
            depth++;
            i++;
            continue;
        }
        if (ch === '}') {
            depth--;
            i++;
            continue;
        }
        if (depth === 1) {
            const id = readIdentifier(text, i);
            if (id && (id.value === 'node' || id.value === 'edge')) {
                let j = skipWhitespace(text, id.next);
                if (j < bodyEnd && text[j] === ':') {
                    return true;
                }
            }
        }
        i++;
    }
    return false;
}

function readGraphTitleAt(text: string, bodyStart: number, bodyEnd: number): { title: string; next: number } {
    let i = skipWhitespace(text, bodyStart);
    const keyResult = readKey(text, i);
    if (!keyResult || keyResult.key !== 'title') {
        return { title: '', next: i };
    }

    i = skipWhitespace(text, keyResult.next);
    if (i >= bodyEnd || text[i] !== ':') {
        return { title: '', next: bodyStart };
    }
    i++;
    const value = readAttributeValue(text, skipWhitespace(text, i));
    return { title: value.value, next: value.next };
}

function skipGarbageUntilStatement(text: string, i: number, limit?: number): number {
    const end = limit ?? text.length;
    while (i < end) {
        i = skipWhitespace(text, i);
        if (i >= end) {
            return i;
        }

        const stmt = parseStatementAt(text, i, limit);
        if (stmt) {
            return i;
        }

        i++;
    }
    return i;
}

function parseNestedGraphDocument(
    text: string,
    start: number,
    options?: ParseCallgraphVcgOptions
): CallgraphVcg {
    const strict = options?.strict === true;
    const result: CallgraphVcg = {
        graph: { title: '' },
        nodes: [],
        edges: [],
    };
    const warnings: string[] = [];

    let i = skipWhitespace(text, start);
    const id = readIdentifier(text, i);
    if (!id || id.value !== 'graph') {
        if (strict) {
            throw new Error('Expected nested graph document to start with graph:');
        }
        return result;
    }

    i = skipWhitespace(text, id.next);
    if (i >= text.length || text[i] !== ':') {
        return result;
    }
    i = skipWhitespace(text, i + 1);
    if (i >= text.length || text[i] !== '{') {
        return result;
    }

    const closeBrace = findClosingBrace(text, i);
    if (closeBrace < 0) {
        if (strict) {
            throw new Error('Unclosed graph block');
        }
        return result;
    }

    const bodyStart = i + 1;
    const bodyEnd = closeBrace;

    const titleInfo = readGraphTitleAt(text, bodyStart, bodyEnd);
    result.graph.title = titleInfo.title;

    let j = skipWhitespace(text, titleInfo.next);
    while (j < bodyEnd) {
        const stmt = parseStatementAt(text, j, bodyEnd);
        if (stmt) {
            if (stmt.stmt.kind !== 'graph') {
                applyStatement(result, stmt.stmt);
            }
            j = skipWhitespace(text, stmt.next);
            continue;
        }

        if (strict) {
            throw new Error('Unrecognized VCG statement inside graph block');
        }
        warnings.push(`offset ${j}: unrecognized input inside graph block, skipping`);
        const resume = skipGarbageUntilStatement(text, j + 1, bodyEnd);
        if (resume === j + 1) {
            j = skipWhitespace(text, j + 1);
        } else {
            j = resume;
        }
    }

    if (warnings.length > 0) {
        result.warnings = warnings;
    }
    return result;
}

function parseFlatDocument(text: string, options?: ParseCallgraphVcgOptions): CallgraphVcg {
    const strict = options?.strict === true;
    const result: CallgraphVcg = {
        graph: { title: '' },
        nodes: [],
        edges: [],
    };
    const warnings: string[] = [];

    let i = 0;

    while (i < text.length) {
        const stmt = parseStatementAt(text, i);
        if (stmt) {
            applyStatement(result, stmt.stmt);
            i = stmt.next;
            continue;
        }

        if (skipWhitespace(text, i) >= text.length) {
            break;
        }

        if (strict) {
            throw new Error('Unrecognized VCG statement');
        }

        warnings.push(`offset ${i}: unrecognized input, skipping`);
        const resume = skipGarbageUntilStatement(text, i + 1);
        if (resume === i + 1) {
            i = skipWhitespace(text, i + 1);
        } else {
            i = resume;
        }
    }

    if (warnings.length > 0) {
        result.warnings = warnings;
    }
    return result;
}

function isNestedGraphDocument(text: string): boolean {
    let i = skipWhitespace(text, 0);
    const id = readIdentifier(text, i);
    if (!id || id.value !== 'graph') {
        return false;
    }

    i = skipWhitespace(text, id.next);
    if (i >= text.length || text[i] !== ':') {
        return false;
    }

    i = skipWhitespace(text, i + 1);
    if (i >= text.length || text[i] !== '{') {
        return false;
    }

    const closeBrace = findClosingBrace(text, i);
    if (closeBrace < 0) {
        return false;
    }

    return bodyHasNestedStatements(text, i + 1, closeBrace);
}

function applyStatement(result: CallgraphVcg, stmt: VcgStatement): void {
    switch (stmt.kind) {
        case 'graph':
            result.graph.title = stmt.attrs['title'] ?? '';
            break;
        case 'node': {
            const parsed = parseNodeLabel(stmt.attrs['label'] ?? '');
            result.nodes.push({
                title: stmt.attrs['title'] ?? '',
                label: parsed.label,
                location: parsed.location,
                shape: stmt.attrs['shape'],
            });
            break;
        }
        case 'edge': {
            const edge: VcgEdge = {
                sourcename: stmt.attrs['sourcename'] ?? '',
                targetname: stmt.attrs['targetname'] ?? '',
            };
            if (stmt.attrs['label'] !== undefined) {
                edge.label = stmt.attrs['label'];
            }
            result.edges.push(edge);
            break;
        }
    }
}

/**
 * Parse GCC -fcallgraph-info VCG text into a structured callgraph.
 *
 * GCC emits a nested document: one outer `graph: { title: "..."` block containing all
 * `node` / `edge` statements (both per-translation-unit `.ci` and LTO `.ltrans.ci`).
 * A flat top-level statement sequence is only used as a fallback when no nested
 * `node`/`edge` appear inside the graph block.
 */
export function parseCallgraphVcg(text: string, options?: ParseCallgraphVcgOptions): CallgraphVcg {
    if (isNestedGraphDocument(text)) {
        return parseNestedGraphDocument(text, 0, options);
    }
    return parseFlatDocument(text, options);
}

/**
 * Read a `.ci` file and parse its VCG contents.
 */
export function parseCallgraphVcgFile(path: string, options?: ParseCallgraphVcgOptions): CallgraphVcg {
    const text = fs.readFileSync(path, { encoding: 'utf8' });
    return parseCallgraphVcg(text, options);
}

// ---------------------------------------------------------------------------
// Title / label helpers (hand-written, no RegExp)
// ---------------------------------------------------------------------------

/** `C:` / `D:` drive prefix — not an object/symbol separator. */
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

/**
 * Find the rightmost `:` that is not a Windows drive letter colon.
 * Used when splitting `path:symbol` for both Unix and Windows paths.
 */
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

/**
 * Find the rightmost `.o:` (GCC object-file suffix) in a title.
 */
function findObjectFileColon(title: string): number {
    for (let i = title.length - 3; i >= 0; i--) {
        if (title[i] === '.' && title[i + 1] === 'o' && title[i + 2] === ':') {
            return i + 2;
        }
    }
    return -1;
}

/**
 * Split a node title into object file and symbol name.
 * Supports Unix (`/tmp/out.o:main`) and Windows (`C:\Temp\a.o:main`) paths.
 */
export function parseNodeTitle(title: string): ParsedTitle {
    const objColon = findObjectFileColon(title);
    if (objColon >= 0) {
        return {
            objectFile: title.slice(0, objColon),
            symbol: title.slice(objColon + 1),
        };
    }

    const colon = findLastColonExcludingDrive(title, title.length);
    if (colon > 0) {
        return {
            objectFile: title.slice(0, colon),
            symbol: title.slice(colon + 1),
        };
    }

    return { symbol: title };
}

/**
 * Parse the second line of a GCC node label (location line).
 * Supports `<built-in>`, `./path/file.c:line:column`, `libraries/.../IQmathLib.h:581:14`, etc.
 */
export function parseLocationLine(segment: string): VcgLocation | undefined {
    const trimmed = segment.trim();
    if (trimmed.length === 0) {
        return undefined;
    }

    if (stringsEqual(trimmed, '<built-in>')) {
        return { file: '<built-in>' };
    }

    const colSep = findLastColonExcludingDrive(trimmed, trimmed.length);
    if (colSep <= 0) {
        return { file: trimmed };
    }

    const colStr = trimmed.slice(colSep + 1);
    if (!isAllDigits(colStr)) {
        return { file: trimmed };
    }

    const lineSep = findLastColonExcludingDrive(trimmed, colSep);
    if (lineSep < 0) {
        return { file: trimmed };
    }

    const lineStr = trimmed.slice(lineSep + 1, colSep);
    if (!isAllDigits(lineStr)) {
        return { file: trimmed };
    }

    return {
        file: trimmed.slice(0, lineSep),
        line: parseInt(lineStr, 10),
        column: parseInt(colStr, 10),
    };
}

/**
 * Split GCC node label into display name and optional location (second line).
 */
export function parseNodeLabel(rawLabel: string): { label: string; location?: VcgLocation } {
    const nl = rawLabel.indexOf('\n');
    if (nl < 0) {
        return { label: rawLabel };
    }

    const label = rawLabel.slice(0, nl);
    let locationLine = rawLabel.slice(nl + 1);
    const secondNl = locationLine.indexOf('\n');
    if (secondNl >= 0) {
        locationLine = locationLine.slice(0, secondNl);
    }
    locationLine = locationLine.trim();

    const location = parseLocationLine(locationLine);
    return location ? { label, location } : { label };
}

/** Build a title -> node map for edge lookup. */
export function buildNodeIndex(graph: CallgraphVcg): Map<string, VcgNode> {
    const index = new Map<string, VcgNode>();
    for (const node of graph.nodes) {
        index.set(node.title, node);
    }
    return index;
}

/** Resolve symbol name from a node title or edge endpoint. */
export function resolveSymbolName(title: string): string {
    return parseNodeTitle(title).symbol;
}

/** Find edges whose source resolves to the given symbol. */
export function findEdgesFromSymbol(graph: CallgraphVcg, symbol: string): VcgEdge[] {
    return graph.edges.filter((e) => resolveSymbolName(e.sourcename) === symbol);
}

/** Find edges whose target resolves to the given symbol. */
export function findEdgesToSymbol(graph: CallgraphVcg, symbol: string): VcgEdge[] {
    return graph.edges.filter((e) => resolveSymbolName(e.targetname) === symbol);
}
