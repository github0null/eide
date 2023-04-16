
import * as vscode from 'vscode';
import * as events from 'events';
import * as fs from 'fs';
import * as NodePath from 'path';
import * as child_process from 'child_process';
import * as os from 'os';
import * as yaml from 'yaml';
import { ProjectBaseApi } from './EIDETypeDefine';
import { File } from '../lib/node-utility/File';
import { GlobalEvent } from './GlobalEvents';
import { ExceptionToMessage } from './Message';
import { ToolchainName } from './ToolchainManager';

function parseLogLines(file: File): string[] {

    const ccLogLines: string[] = [];

    try {

        const fileLines = file.Read().split(/\r\n|\n/);

        //
        // cc logs
        //
        let logStarted = false;
        let logEnd = false;

        fileLines.forEach((line, idx) => {

            if (logEnd)
                return;

            if (!logStarted) {
                if (line.startsWith('>>> cc')) {
                    logStarted = true;
                }
            } else {
                if (line.startsWith('>>>')) {
                    logEnd = true;
                } else {
                    ccLogLines.push(line);
                }
            }
        });

        //
        // ld logs
        //
        logStarted = false;
        logEnd = false;

        fileLines.forEach((line, idx) => {

            if (logEnd)
                return;

            if (!logStarted) {
                if (line.startsWith('>>> ld')) {
                    logStarted = true;
                }
            } else {
                if (line.startsWith('>>>')) {
                    logEnd = true;
                } else {
                    ccLogLines.push(line);
                }
            }
        });

    } catch (error) {
        // nothing todo
    }

    return ccLogLines;
}

function toVscServerity(str_: string): vscode.DiagnosticSeverity {
    const str = str_.toLowerCase();
    if (str.startsWith('err') || str.startsWith('fatal') || str.includes('error')) {
        return vscode.DiagnosticSeverity.Error;
    } else if (str.startsWith('warn') || str.includes('warning')) {
        return vscode.DiagnosticSeverity.Warning;
    } else {
        return vscode.DiagnosticSeverity.Information;
    }
}

function newVscFilePosition(toolchain: ToolchainName, line: number, col?: number): vscode.Position {
    switch (toolchain) {
        default:
            return new vscode.Position(line > 0 ? (line - 1) : 0, col || 0);
    }
}

//////////////////////////////////////////////////////////////////////

export type CompilerDiagnostics = { [path: string]: vscode.Diagnostic[]; }

export function parseArmccCompilerLog(projApi: ProjectBaseApi, logFile: File): CompilerDiagnostics {

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
    const ccLogLines = parseLogLines(logFile);

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

            const pos = newVscFilePosition(projApi.toolchainName(), line, 0);
            const vscDiag = new vscode.Diagnostic(new vscode.Range(pos, pos), message, toVscServerity(severity));
            vscDiag.code = errCode;
            vscDiag.source = 'armcc';
            diags.push(vscDiag);
        }
    }

    return result;
}

//
// example:
//  .\src\main.c:46: syntax error: token -> '}' ; column 1
//  .\src\main.c:53: syntax error: token -> 'TIM4_TypeDef' ; column 22
//  .\libraries\STM8S_StdPeriph_Driver\source\stm8s_itc.c:61: warning 59: function 'ITC_GetCPUCC' must return value
export function parseSdccCompilerLog(projApi: ProjectBaseApi, logfile: File): CompilerDiagnostics {

    const pattern = {
        "regexp": "^(.+):(\\d+):([^:]+):\\s+(.*)$",
        "file": 1,
        "line": 2,
        "severity": 3,
        "message": 4
    };

    const matcher = new RegExp(pattern.regexp, 'i');
    const result: { [path: string]: vscode.Diagnostic[] } = {};
    const ccLogLines = parseLogLines(logfile);

    for (let idx = 0; idx < ccLogLines.length; idx++) {
        const line = ccLogLines[idx];
        const m = matcher.exec(line);
        if (m && m.length > 4) {

            const fspath = projApi.toAbsolutePath(m[pattern.file]);
            const line = parseInt(m[pattern.line]);
            const severity = m[pattern.severity].trim();
            const message = m[pattern.message].trim();

            // example: warning 59:
            let errCode: string | undefined;
            const ec_m = /\s+(\d+)$/.exec(severity);
            if (ec_m && ec_m.length > 1) {
                errCode = ec_m[1];
            }

            // xxxx ; column 22
            let col: number | undefined;
            const col_m = /column\s+(\d+)$/.exec(message);
            if (col_m && col_m.length > 1) {
                col = parseInt(col_m[1]);
            }

            const diags = result[fspath] || [];
            if (result[fspath] == undefined) result[fspath] = diags;

            const pos = newVscFilePosition(projApi.toolchainName(), line, col);
            const vscDiag = new vscode.Diagnostic(
                new vscode.Range(pos, pos), `${severity}: ${message}`, toVscServerity(severity));
            vscDiag.source = 'sdcc';
            vscDiag.code = errCode;
            diags.push(vscDiag);
        }
    }

    return result;
}

// 
// example:
//  src/bt/blehost/porting/w800/include/nimble/nimble_npl_os.h:82:20: warning: implicit declaration of function 'tls_os_task_id' [-Wimplicit-function-declaration]
//  include/wifi/wm_wifi.h:446:6: note: expected 'tls_wifi_psm_chipsleep_callback {aka void (*)(unsigned int)}' but argum
export function parseGccCompilerLog(projApi: ProjectBaseApi, logfile: File): CompilerDiagnostics {

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
    const ccLogLines = parseLogLines(logfile);

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

            let errCode: string | undefined;
            if (message.includes('[')) {
                // example: 'tls_os_task_id' [-Wimplicit-function-declaration] 
                const m = /\[([\w-]+)\]\s*$/.exec(message);
                if (m && m.length > 1) {
                    errCode = m[1].trim();
                }
            }

            const diags = result[fspath] || [];
            if (result[fspath] == undefined) result[fspath] = diags;

            const pos = newVscFilePosition(projApi.toolchainName(), line, col);
            const vscDiag = new vscode.Diagnostic(new vscode.Range(pos, pos), message, toVscServerity(severity));
            vscDiag.source = problemSource;
            vscDiag.code = errCode;
            diags.push(vscDiag);
        }
    }

    return result;
}

export function parseKeilc51CompilerLog(projApi: ProjectBaseApi, logfile: File): CompilerDiagnostics {

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
    const ccLogLines = parseLogLines(logfile);

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

            const pos = newVscFilePosition(projApi.toolchainName(), line, 0);
            const vscDiag = new vscode.Diagnostic(new vscode.Range(pos, pos), message, toVscServerity(severity));
            vscDiag.source = 'Keil_C51';
            vscDiag.code = code;
            diags.push(vscDiag);
        }
    }

    return result;
}

//
// example:
//   "c:\Users\xxx\plates\iar\startup_stm32f4xx.s",190 Warning[25]: Label 'BusFault_Handler' is defined pubweak in a section implicitly declared root
//   "c:\Users\xxxxaster\src\User\main.c",65  Error[Pe065]: 
//          expected a ";"
//   "c:\UsersxxxxAR-master\src\User\main.c",107  Warning[Pe223]: 
//          function "LCD_2004_Init" declared implicitly
export function parseIarCompilerLog(projApi: ProjectBaseApi, logfile: File): CompilerDiagnostics {

    const pattern = {
        "regexp": "^\\s*\"([^\"]+)\",(\\d+)\\s+([a-z\\s]+)\\[(\\w+)\\]:(.+)?",
        "file": 1,
        "line": 2,
        "severity": 3,
        "code": 4,
        "message": 5
    };

    const matcher = new RegExp(pattern.regexp, 'i');
    const result: { [path: string]: vscode.Diagnostic[] } = {};
    const ccLogLines = parseLogLines(logfile);

    for (let idx = 0; idx < ccLogLines.length; idx++) {
        const line = ccLogLines[idx];
        const m = matcher.exec(line);
        if (m && m.length > 4) {

            const fspath   = projApi.toAbsolutePath(m[pattern.file]);
            let   message  = m[pattern.message]?.trim();
            const line     = parseInt(m[pattern.line]);
            const severity = m[pattern.severity].trim();
            const errCode  = m[pattern.code].trim();

            if (!message) {
                message = ccLogLines[++idx].trim();
            }

            const diags = result[fspath] || [];
            if (result[fspath] == undefined) result[fspath] = diags;

            const pos = newVscFilePosition(projApi.toolchainName(), line, 0);
            const vscDiag = new vscode.Diagnostic(new vscode.Range(pos, pos), message, toVscServerity(severity));
            vscDiag.code = errCode;
            vscDiag.source = projApi.toolchainName() == 'IAR_STM8' ? 'iccstm8' : 'iccarm';
            diags.push(vscDiag);
        }
    }

    return result;
}

// #error cpstm8 acia.c:33(25) incompatible compare types
// #error cpstm8 .\src\main.c:54(14+3) bad struct/union operand
// #error clnk acia.lkf:1 symbol f_recept not defined (vector.o )
// #error clnk acia.lkf:1 symbol f__stext not defined (vector.o )
export function parseCosmicStm8CompilerLog(projApi: ProjectBaseApi, logfile: File): CompilerDiagnostics {

    const pattern = {
        "regexp": "^\\s*#(\\w+) (\\w+) (.+?):(\\d+)(\\(\\d+(?:\\+\\d+)?\\))? (.+)",
        "severity": 1,
        "toolname": 2,
        "file": 3,
        "line": 4,
        "col": 5,
        "message": 6
    };

    const matcher = new RegExp(pattern.regexp, 'i');
    const result: { [path: string]: vscode.Diagnostic[] } = {};
    const ccLogLines = parseLogLines(logfile);

    for (let idx = 0; idx < ccLogLines.length; idx++) {
        const line = ccLogLines[idx];
        const m = matcher.exec(line);
        if (m && m.length > 5) {

            const fspath   = projApi.toAbsolutePath(m[pattern.file]);
            const message  = m[pattern.message].trim();
            const line     = parseInt(m[pattern.line]);
            const severity = m[pattern.severity].trim();
            const colStr   = m[pattern.col]?.trim();
            const toolname = m[pattern.toolname].trim();

            let column = 0;
            let column_rng = 1;
            if (colStr && colStr.length > 2) {
                // .\src\main.c:54(14+3)
                if (colStr.includes('+')) {
                    const m_col = /(\d+)\+(\d+)/.exec(colStr);
                    if (m_col && m_col.length > 2) {
                        column = parseInt(m_col[1]);
                        column_rng = parseInt(m_col[2]);
                    }
                } else {
                    column = parseInt(colStr.substring(1, colStr.length - 1));
                }
            }

            const diags = result[fspath] || [];
            if (result[fspath] == undefined) result[fspath] = diags;

            const pos_s = newVscFilePosition(projApi.toolchainName(), line, column);
            const pos_e = newVscFilePosition(projApi.toolchainName(), line, column + column_rng);
            const vscDiag = new vscode.Diagnostic(new vscode.Range(pos_s, pos_e), message, toVscServerity(severity));
            vscDiag.source = toolname;

            diags.push(vscDiag);
        }
    }

    return result;
}
