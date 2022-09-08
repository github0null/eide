
import * as vscode from 'vscode';
import * as events from 'events';
import * as fs from 'fs';
import * as NodePath from 'path';
import * as child_process from 'child_process';
import * as os from 'os';
import * as yaml from 'yaml';
import { ProjectBaseApi } from './EIDETypeDefine';
import { File } from '../lib/node-utility/File';

function parseLogLines(file: File): string[] {

    const ccLogLines: string[] = [];

    let logStarted = false;
    let logEnd = false;

    file.Read().split(/\r\n|\n/).forEach(line => {

        if (logEnd)
            return;

        if (logStarted) {
            if (line.startsWith('>>>')) {
                logEnd = true;
            } else {
                ccLogLines.push(line);
            }
        } else {
            if (line.startsWith('>>> cc')) {
                logStarted = true;
            }
        }
    });

    return ccLogLines;
}

function toVscServerity(str_: string): vscode.DiagnosticSeverity {
    const str = str_.toLowerCase();
    if (str.startsWith('err') || str.startsWith('fatal')) {
        return vscode.DiagnosticSeverity.Error;
    } else if (str.startsWith('warn')) {
        return vscode.DiagnosticSeverity.Warning;
    } else if (str.startsWith('note')) {
        return vscode.DiagnosticSeverity.Hint;
    } else {
        return vscode.DiagnosticSeverity.Information;
    }
}

//////////////////////////////////////////////////////////////////////

export type CompilerDiagnostics = { [path: string]: vscode.Diagnostic[]; }

export function parseArmccCompilerLog(projApi: ProjectBaseApi, file: File): CompilerDiagnostics {

    const pattern = {
        "regexp": "^\"([^\"]+)\", line (\\d+): (Error|Warning):\\s+#([^\\s]+):\\s+(.+)$",
        "file": 1,
        "line": 2,
        "severity": 3,
        "code": 4,
        "message": 5
    };

    const matcher = new RegExp(pattern.regexp, 'i');
    const result: { [path: string]: vscode.Diagnostic[] } = {};
    const ccLogLines = parseLogLines(file);

    for (let idx = 0; idx < ccLogLines.length; idx++) {
        const line = ccLogLines[idx];
        const m = matcher.exec(line);
        if (m && m.length > 5) {

            const fspath = projApi.toAbsolutePath(m[pattern.file]);
            const line = parseInt(m[pattern.line]);
            const severity = m[pattern.severity];
            const errCode = m[pattern.code].trim();
            const message = m[pattern.message].trim();

            const diags = result[fspath] || [];
            if (result[fspath] == undefined) result[fspath] = diags;

            const pos = new vscode.Position(line - 1, 0);
            const vscDiag = new vscode.Diagnostic(new vscode.Range(pos, pos), message, toVscServerity(severity));
            vscDiag.code = errCode;
            vscDiag.source = 'armcc';
            diags.push(vscDiag);
        }
    }

    return result;
}

export function parseGccCompilerLog(projApi: ProjectBaseApi, file: File): CompilerDiagnostics {

    const pattern = {
        "regexp": "^(.+):(\\d+):(\\d+):([^:]+):\\s+(.*)$",
        "file": 1,
        "line": 2,
        "column": 3,
        "severity": 4,
        "message": 5
    };

    const matcher = new RegExp(pattern.regexp, 'i');
    const result: { [path: string]: vscode.Diagnostic[] } = {};
    const ccLogLines = parseLogLines(file);

    let problemSource: string = 'gcc';

    switch (projApi.toolchainName()) {
        case 'AC6':
            problemSource = 'armclang';
            break;
        case 'GCC':
            problemSource = 'arm-none-eabi-gcc';
            break;
        case 'RISCV_GCC':
            problemSource = 'riscv-gcc';
            break
        case 'SDCC':
            problemSource = 'sdcc';
            break
        default:
            break;
    }

    for (let idx = 0; idx < ccLogLines.length; idx++) {
        const line = ccLogLines[idx];
        const m = matcher.exec(line);
        if (m && m.length > 5) {

            const fspath = projApi.toAbsolutePath(m[pattern.file]);
            const line = parseInt(m[pattern.line]);
            const col = parseInt(m[pattern.column]);
            const severity = m[pattern.severity].trim();
            const message = m[pattern.message].trim();

            const diags = result[fspath] || [];
            if (result[fspath] == undefined) result[fspath] = diags;

            const pos = new vscode.Position(line - 1, col - 1);
            const vscDiag = new vscode.Diagnostic(new vscode.Range(pos, pos), message, toVscServerity(severity));
            vscDiag.source = problemSource;
            diags.push(vscDiag);
        }
    }

    return result;
}

export function parseKeilc51CompilerLog(projApi: ProjectBaseApi, file: File): CompilerDiagnostics {

    const pattern = {
        "regexp": "(ERROR|WARNING) (\\w+) IN LINE (\\d+) OF ([^:]+): (.+)",
        "severity": 1,
        "code": 2,
        "line": 3,
        "file": 4,
        "message": 5
    };


    const matcher = new RegExp(pattern.regexp, 'i');
    const result: { [path: string]: vscode.Diagnostic[] } = {};
    const ccLogLines = parseLogLines(file);

    for (let idx = 0; idx < ccLogLines.length; idx++) {
        const line = ccLogLines[idx];
        const m = matcher.exec(line);
        if (m && m.length > 5) {

            const severity = m[pattern.severity].trim();
            const code = m[pattern.code].trim();
            const line = parseInt(m[pattern.line]);
            const fspath = projApi.toAbsolutePath(m[pattern.file]);
            const message = m[pattern.message].trim();

            const diags = result[fspath] || [];
            if (result[fspath] == undefined) result[fspath] = diags;

            const pos = new vscode.Position(line - 1, 0);
            const vscDiag = new vscode.Diagnostic(new vscode.Range(pos, pos), message, toVscServerity(severity));
            vscDiag.source = 'Keil_C51';
            vscDiag.code = code;
            diags.push(vscDiag);
        }
    }

    return result;
}

export function parseIarCompilerLog(projApi: ProjectBaseApi, file: File): CompilerDiagnostics {

    const pattern = {
        "regexp": "^\\s*\"([^\"]+)\",(\\d+)\\s+([a-z\\s]+)\\[(\\w+)\\]:",
        "file": 1,
        "line": 2,
        "severity": 3,
        "code": 4
    };

    const matcher = new RegExp(pattern.regexp, 'i');
    const result: { [path: string]: vscode.Diagnostic[] } = {};
    const ccLogLines = parseLogLines(file);

    for (let idx = 0; idx < ccLogLines.length; idx++) {
        const line = ccLogLines[idx];
        const m = matcher.exec(line);
        if (m && m.length > 4) {

            const fspath = projApi.toAbsolutePath(m[pattern.file]);
            const message = ccLogLines[++idx].trim();
            const line = parseInt(m[pattern.line]);
            const severity = m[pattern.severity].trim();
            const errCode = m[pattern.code].trim();

            const diags = result[fspath] || [];
            if (result[fspath] == undefined) result[fspath] = diags;

            const pos = new vscode.Position(line - 1, 0);
            const vscDiag = new vscode.Diagnostic(new vscode.Range(pos, pos), message, toVscServerity(severity));
            vscDiag.code = errCode;
            vscDiag.source = projApi.toolchainName() == 'IAR_STM8' ? 'iccstm8' : 'iccarm';
            diags.push(vscDiag);
        }
    }

    return result;
}
