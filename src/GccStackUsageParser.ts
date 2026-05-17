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

/** Source file location from a GCC -fstack-usage line prefix. */
export interface StackUsageSourceLocation {
    file: string;
    line: number;
    column: number;
}

/** One function stack usage record from GCC -fstack-usage output. */
export interface FunctionStackUsageEntry {
    location: StackUsageSourceLocation;
    functionName: string;
    stackBytes: number;
    /** GCC allocation type verbatim, e.g. "static", "dynamic,bounded", "null". */
    allocationType: string;
}

/** Parsed GCC -fstack-usage document. */
export interface StackUsageDocument {
    entries: FunctionStackUsageEntry[];
    warnings?: string[];
}

export interface ParseStackUsageOptions {
    /** When true, throw on unrecognized non-empty lines. */
    strict?: boolean;
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

function trimLine(line: string): string {
    let start = 0;
    let end = line.length;
    while (start < end && isWhitespace(line[start])) {
        start++;
    }
    while (end > start && isWhitespace(line[end - 1])) {
        end--;
    }
    return line.slice(start, end);
}

/** `C:` / `D:` drive prefix — not a field separator. */
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

/**
 * Read digits immediately before index `end` (exclusive).
 * Returns [start, end) slice bounds, or null if no digits.
 */
function readDigitsBefore(s: string, end: number): { start: number; end: number } | null {
    let j = end - 1;
    if (j < 0 || !isDigit(s[j])) {
        return null;
    }
    const digitEnd = end;
    while (j >= 0 && isDigit(s[j])) {
        j--;
    }
    return { start: j + 1, end: digitEnd };
}

/**
 * Split `file:line:column:function` from the right, skipping Windows drive colons.
 */
function parseFileLineColumnFunction(locAndFunc: string): StackUsageSourceLocation & { functionName: string } | null {
    const funcColon = findLastColonExcludingDrive(locAndFunc, locAndFunc.length);
    if (funcColon < 0) {
        return null;
    }

    const functionName = locAndFunc.slice(funcColon + 1);
    if (functionName.length === 0) {
        return null;
    }

    const colDigits = readDigitsBefore(locAndFunc, funcColon);
    if (!colDigits) {
        return null;
    }
    const columnStr = locAndFunc.slice(colDigits.start, colDigits.end);
    if (!isAllDigits(columnStr)) {
        return null;
    }

    const lineColon = colDigits.start - 1;
    if (lineColon < 0 || locAndFunc[lineColon] !== ':') {
        return null;
    }

    const lineDigits = readDigitsBefore(locAndFunc, lineColon);
    if (!lineDigits) {
        return null;
    }
    const lineStr = locAndFunc.slice(lineDigits.start, lineDigits.end);
    if (!isAllDigits(lineStr)) {
        return null;
    }

    const fileColon = lineDigits.start - 1;
    if (fileColon < 0 || locAndFunc[fileColon] !== ':') {
        return null;
    }

    const file = locAndFunc.slice(0, fileColon);
    if (file.length === 0) {
        return null;
    }

    return {
        file,
        line: parseInt(lineStr, 10),
        column: parseInt(columnStr, 10),
        functionName,
    };
}

/**
 * Split a line into [locAndFunc, stackBytesStr, allocationType].
 * Trailing fields are separated by whitespace (space or tab, possibly mixed).
 */
function splitStackUsageLineFields(line: string): [string, string, string] | null {
    let i = line.length - 1;

    while (i >= 0 && isWhitespace(line[i])) {
        i--;
    }
    if (i < 0) {
        return null;
    }

    const typeEnd = i + 1;
    while (i >= 0 && !isWhitespace(line[i])) {
        i--;
    }
    const typeStart = i + 1;
    const allocationType = line.slice(typeStart, typeEnd);
    if (allocationType.length === 0) {
        return null;
    }

    while (i >= 0 && isWhitespace(line[i])) {
        i--;
    }
    if (i < 0) {
        return null;
    }

    const bytesEnd = i + 1;
    while (i >= 0 && isDigit(line[i])) {
        i--;
    }
    const bytesStart = i + 1;
    if (bytesStart >= bytesEnd) {
        return null;
    }
    const stackBytesStr = line.slice(bytesStart, bytesEnd);
    if (!isAllDigits(stackBytesStr)) {
        return null;
    }

    while (i >= 0 && isWhitespace(line[i])) {
        i--;
    }
    if (i < 0) {
        return null;
    }

    const locAndFunc = line.slice(0, i + 1);
    if (locAndFunc.length === 0) {
        return null;
    }

    return [locAndFunc, stackBytesStr, allocationType];
}

/**
 * Parse one GCC -fstack-usage output line.
 * Format: file:line:column:function<ws>stack_bytes<ws>allocation_type
 * (<ws> = space or tab)
 */
export function parseStackUsageLine(line: string): FunctionStackUsageEntry | null {
    const trimmed = trimLine(line);
    if (trimmed.length === 0) {
        return null;
    }

    const fields = splitStackUsageLineFields(trimmed);
    if (!fields) {
        return null;
    }

    const [locAndFunc, stackBytesStr, allocationType] = fields;
    if (!isAllDigits(stackBytesStr)) {
        return null;
    }

    const loc = parseFileLineColumnFunction(locAndFunc);
    if (!loc) {
        return null;
    }

    return {
        location: {
            file: loc.file,
            line: loc.line,
            column: loc.column,
        },
        functionName: loc.functionName,
        stackBytes: parseInt(stackBytesStr, 10),
        allocationType,
    };
}

/**
 * Parse GCC -fstack-usage text (one record per line).
 */
export function parseStackUsageText(text: string, options?: ParseStackUsageOptions): StackUsageDocument {
    const strict = options?.strict === true;
    const result: StackUsageDocument = { entries: [] };
    const warnings: string[] = [];

    let lineNo = 1;
    let i = 0;

    while (i < text.length) {
        let lineStart = i;
        while (i < text.length && text[i] !== '\n' && text[i] !== '\r') {
            i++;
        }
        const rawLine = text.slice(lineStart, i);

        if (i < text.length && text[i] === '\r') {
            i++;
        }
        if (i < text.length && text[i] === '\n') {
            i++;
        }

        const trimmed = trimLine(rawLine);
        if (trimmed.length === 0) {
            lineNo++;
            continue;
        }

        const entry = parseStackUsageLine(rawLine);
        if (entry) {
            result.entries.push(entry);
        } else if (strict) {
            throw new Error(`Unrecognized -fstack-usage line at line ${lineNo}`);
        } else {
            warnings.push(`line ${lineNo}: unrecognized -fstack-usage record`);
        }

        lineNo++;
    }

    if (warnings.length > 0) {
        result.warnings = warnings;
    }
    return result;
}

/**
 * Read a `.su` (or other) file and parse its -fstack-usage contents.
 */
export function parseStackUsageFile(path: string, options?: ParseStackUsageOptions): StackUsageDocument {
    const text = fs.readFileSync(path, { encoding: 'utf8' });
    return parseStackUsageText(text, options);
}
