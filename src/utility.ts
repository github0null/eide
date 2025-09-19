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

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as NodePath from "path";

import { WorkspaceManager } from "./WorkspaceManager";
import { CmdLineHandler } from "./CmdLineHandler";
import { ExceptionToMessage, newMessage } from "./Message";
import { NetRequest, NetResponse } from '../lib/node-utility/NetRequest';
import { File } from '../lib/node-utility/File';
import { GitFileInfo } from './WebInterface/GithubInterface';
import * as platform from './Platform';
import { SevenZipper } from './Compress';
import { ResManager } from './ResManager';
import { isArray } from 'util';
import { ExeCmd } from '../lib/node-utility/Executable';
import { GlobalEvent } from './GlobalEvents';
import { SettingManager } from './SettingManager';
import { ToolchainName } from './ToolchainManager';
import { Time } from '../lib/node-utility/Time';

export const TIME_ONE_MINUTE = 60 * 1000;
export const TIME_ONE_HOUR = 3600 * 1000;
export const TIME_ONE_DAY = 24 * 3600 * 1000;

export function parseCliArgs(cliStr: string): string[] {

    let argsLi: string[] = [];
    let inQuote = false;
    let curArg = '';

    for(let char_ of cliStr) {
        // is a "..." start or end
        if (char_ === '"' && (curArg.length === 0 || curArg[curArg.length - 1] !== '\\')) {
            if (inQuote) {
                inQuote = false;
                if (curArg && curArg.trim() !== '')
                    argsLi.push(curArg);
                curArg = '';
            } else {
                inQuote = true;
            }
            continue; // skip '"'
        }
        // in "..." region
        if (inQuote)  {
            curArg += char_;
        } else { // out "..." region
            if (char_ === ' ' || char_ === '\t') {
                if (curArg && curArg.trim() !== '')
                    argsLi.push(curArg);
                curArg = '';
            } else {
                curArg += char_;
            }
        }
    }

    if (curArg && curArg.trim() !== '')
        argsLi.push(curArg);

    return argsLi;
}

export async function probers_install(cwd?: string) {

    let commandLine: string;
    if (platform.osType() === 'win32') {
        commandLine = `irm https://github.com/probe-rs/probe-rs/releases/latest/download/probe-rs-tools-installer.ps1 | iex`;
    } else if (platform.osType() === 'linux' || platform.osType() === 'darwin') {
        commandLine = `curl --proto '=https' --tlsv1.2 -LsSf https://github.com/probe-rs/probe-rs/releases/latest/download/probe-rs-tools-installer.sh | sh`;
    } else {
        GlobalEvent.emit('msg', newMessage('Warning', 
            `Not support installer for '${platform.osType()}' platform ! Please goto https://probe.rs/docs/getting-started/installation/`));
        return;
    }

    // clean old terminal
    const title = 'install probe-rs';
    const index = vscode.window.terminals.findIndex((t) => t.name === title);
    if (index !== -1)
        vscode.window.terminals[index].dispose();
    // new terminal
    const tOpts: vscode.TerminalOptions = {
        name: title,
        cwd: cwd
    };
    if (os.platform() == 'win32')
        tOpts.shellPath = 'powershell.exe';
    const terminal = vscode.window.createTerminal(tOpts);
    // show terminal before sendtext
    terminal.show(true);
    terminal.sendText(commandLine);
}

export function probers_listchips(): { name: string, series?: string }[] {

    const result: { name: string, series?: string }[] = [];

    try {
        const cmdEnv = deepCloneObject(process.env);
        platform.prependToSysEnv(cmdEnv, [
            NodePath.join(`${platform.userhome()}`, '.cargo', 'bin') // $HOME/.cargo/bin/
        ]);
        const lines = child_process.execSync(`probe-rs chip list`, {
            env: cmdEnv,
            maxBuffer: 10 * 1024 * 1024
        }).toString().split(/\r\n|\n/);
        let curSeries: string | undefined;
        let variantsStarted: boolean = false;
        for (const line of lines) {
            if (line.startsWith(' ') || line.startsWith('\t')) {
                if (line.trim() === 'Variants:') {
                    variantsStarted = true;
                } else if (variantsStarted) {
                    result.push({
                        name: line.trim(),
                        series: curSeries
                    });
                }
            } else {
                curSeries = line.trimEnd();
                variantsStarted = false;
            }
        }
    } catch (error) {
        try {
            // PS C:\Users\Administrator> cargo-flash --version
            // cargo flash 0.29.1 (git commit: 1cf182e)
            const env = deepCloneObject(process.env);
            platform.prependToSysEnv(env, [
                NodePath.join(`${platform.userhome()}`, '.cargo', 'bin') // $HOME/.cargo/bin/
            ]);
            child_process.execSync(`cargo-flash --version`, { env });
            GlobalEvent.log_warn(error);
            GlobalEvent.log_show();
        } catch (error) {
            vscode.window.showWarningMessage(
                `Not found 'cargo-flash' command. Install it now ?`, 'Yes', 'No').then(opt => {
                    if (opt === 'Yes')
                        probers_install();
                });
        }
    }

    return result;
}

/**
 * @param len len必须是2的整数倍
 */
export function generateRandomStr(len?: number): string {
    if (len == undefined || len < 16) len = 16;
    const randomName = crypto.randomBytes(len / 2).toString('hex'); // 生成一个32字符长的十六进制字符串
    return randomName;
}

export function generateDotnetProgramCmd(programFile: File, args?: string[]): string {
    // 在非 win32 平台上，使用 dotnet 命令去直接执行程序的本体.
    // 命令 "<my_program>.exe" 的等价替换是 "dotnet <my_program_dir>/<my_program>.dll"
    if (platform.osType() != 'win32') {
        let dllpath = [programFile.dir, `${programFile.noSuffixName}.dll`].join('/');
        let commandLine = `dotnet ${CmdLineHandler.quoteString(File.ToLocalPath(dllpath), '"')}`;
        args?.forEach(p => {
            commandLine += ' ' + CmdLineHandler.quoteString(p, '"');
        });
        return commandLine;
    } else {
        return CmdLineHandler.getCommandLine(programFile.noSuffixName, args || []);
    }
}

export function timeStamp(): string {
    const time = Time.GetInstance().GetTimeInfo();
    return `${time.year}/${time.month.toString().padStart(2, '0')}/${time.date.toString().padStart(2, '0')}`
        + ` ${time.hour.toString().padStart(2, '0')}:${time.minute.toString().padStart(2, '0')}:${time.second.toString().padStart(2, '0')}`
        + ` ${time.region}`;
}

/**
 * @return: example
    [
      {
        "name": "rp2040_core1",
        "vendor": "Raspberry Pi",
        "part_families": [],
        "part_number": "RP2040Core1",
        "source": "builtin"
       }
    ]
*/
export function pyocd_getTargetList(projectRootDir: File | undefined, pyocdConfigPath: string | undefined): any[] {

    const cmdList: string[] = ['pyocd', 'json'];

    if (projectRootDir) {
        const cwd = projectRootDir.path;
        cmdList.push('-j', `"${cwd}"`);
    }

    if (pyocdConfigPath) {
        if (File.IsFile(pyocdConfigPath)) {
            if (projectRootDir)
                cmdList.push('--config', `"${projectRootDir.ToRelativePath(pyocdConfigPath) || pyocdConfigPath}"`);
            else
                cmdList.push('--config', `"${pyocdConfigPath}"`);
        }
    }

    cmdList.push('-t');

    const command = cmdList.join(' ');
    const result = JSON.parse(child_process.execSync(command).toString());
    if (!Array.isArray(result['targets'])) {
        throw new Error(`Wrong pyocd targets format, 'targets' must be an array !`);
    }

    return result['targets'].map(t => t);
}

export function openocd_getConfigList(category: 'interface' | 'target', projectRootDir: File | undefined): { name: string, isInWorkspace?: boolean; }[] {

    const openocdExe = new File(SettingManager.GetInstance().getOpenOCDExePath());
    const resultList: { name: string, isInWorkspace?: boolean; }[] = [];

    // find in workspace
    const wsFolder = projectRootDir;
    if (wsFolder) {
        for (const path of ['.', '.eide', 'tools']) {
            const cfgFolder = File.fromArray([wsFolder.path, path]);
            if (cfgFolder.IsDir()) {
                cfgFolder.GetList([/\.cfg$/i], File.EXCLUDE_ALL_FILTER).forEach((file) => {
                    const rePath = (wsFolder.ToRelativePath(file.path) || file.name);
                    resultList.push({
                        name: '${workspaceFolder}/' + File.ToUnixPath(rePath).replace('.cfg', ''),
                        isInWorkspace: true
                    });
                });
            }
        }
    }

    // find in build-in path
    for (const path of ['scripts', 'share/openocd/scripts', 'openocd/scripts']) {
        const cfgFolder = File.from(openocdExe.dir, '..', path, category);
        if (cfgFolder.IsDir()) {
            cfgFolder.GetAll([/\.cfg$/i], File.EXCLUDE_ALL_FILTER).forEach((file) => {
                const rePath = (cfgFolder.ToRelativePath(file.path) || file.name);
                resultList.push({
                    name: File.ToUnixPath(rePath).replace('.cfg', '')
                });
            });
            break; // break it if we found
        }
    }

    return resultList;
}

export interface CppMacroDefine {
    type: 'var' | 'func';
    name: string;
    value: string;
}

export class CppMacroParser {

    private static regMatchers = {
        'var' : /^#define (\w+) (.*)$/,
        'func': /^#define (\w+\([^\)]*\)) (.*)$/
    };

    static toExpression(line: string): string | undefined {

        let mList = this.regMatchers['var'].exec(line);
        if (mList && mList.length > 2) {
            return `${mList[1]}=${mList[2]}`;
        }

        mList = this.regMatchers['func'].exec(line);
        if (mList && mList.length > 2) {
            return `${mList[1]}=`;
        }
    }

    static parse(line: string): CppMacroDefine | undefined {

        let mList = this.regMatchers['var'].exec(line);
        if (mList && mList.length > 2) {
            return {
                type: 'var',
                name: mList[1],
                value: mList[2],
            };
        }

        mList = this.regMatchers['func'].exec(line);
        if (mList && mList.length > 2) {
            return {
                type: 'func',
                name: mList[1],
                value: mList[2],
            };
        }
    }
}

export function getGccInternalDefines(gccpath: string, cmds: string[] | undefined): CppMacroDefine[] | undefined {
    try {
        // gcc ... -E -dM - <null
        const cmdArgs = (cmds || []).concat(['-E', '-dM', '-', `<${platform.osGetNullDev()}`]);
        const cmdLine = `${gccpath} ` + cmdArgs.join(' ');
        const outputs = child_process.execSync(cmdLine, { cwd: NodePath.dirname(gccpath) }).toString().split(/\r\n|\n/);
        const results: CppMacroDefine[] = [];

        outputs.filter((line) => { return line.trim() !== ''; })
            .forEach((line) => {
                const value = CppMacroParser.parse(line);
                if (value) {
                    results.push(value);
                }
            });

        return results;
    } catch (error) {
        GlobalEvent.log_warn(error);
    }
}

/**
 * @note 判断是否为 gcc 工具链
*/
export function isGccFamilyToolchain(name: ToolchainName): boolean {
    return name.includes('GCC');
}

/**
 * 检查 toolchain 是否属于 gcc 编译参数兼容的工具链
 * @note 注意是编译参数兼容，比如 clang 也是兼容的，但它不是 gcc 编译器
*/
export function isGccOptionsCompatibleToolchain(name: ToolchainName): boolean {
    return name.includes('GCC') || name.includes('LLVM');
}

export function getGccSystemSearchList(gccFullPath: string, args?: string[]): string[] | undefined {
    try {
        const gccName = NodePath.basename(gccFullPath);
        const gccDir = NodePath.dirname(gccFullPath);
        let cmdArgs: string[] = ['-E', '-v', '-', `<${platform.osGetNullDev()}`, '2>&1'];
        if (args) cmdArgs = args.concat(cmdArgs);
        const cmdLine = `${gccName} ` + cmdArgs.join(' ');
        const lines = child_process.execSync(cmdLine, { cwd: gccDir }).toString().split(/\r\n|\n/);
        const iStart = lines.findIndex((line) => { return line.startsWith('#include <...>'); });
        const iEnd = lines.indexOf('End of search list.', iStart);
        return lines.slice(iStart + 1, iEnd)
            .map((line) => { return new File(File.ToLocalPath(line.trim())); })
            .filter((file) => { return file.IsDir(); })
            .map((f) => {
                return f.path;
            });
    } catch (error) {
        GlobalEvent.log_warn(error);
    }
}

export function makeTextTable(rows: string[][], headerLines?: string[]): string[] | undefined {

    if (rows.length == 0)
        return undefined;

    // init column len
    const colMaxLenList: number[] = [];
    rows[0].forEach(colHeader => colMaxLenList.push(colHeader.length));
    const colSize = colMaxLenList.length;

    // calcu all cols max len
    for (let index = 1; index < rows.length; index++) {
        const row = rows[index];
        for (let colIdx = 0; colIdx < colSize; colIdx++) {
            let maxLen = colMaxLenList[colIdx];
            colMaxLenList[colIdx] = row[colIdx].length > maxLen ? row[colIdx].length : maxLen;
        }
    }

    let outputLines: string[] = headerLines || [];

    // make header
    {
        const tableHeader = rows[0];
    
        let header_str: string = '';
        tableHeader.forEach((headerName, idx) => header_str += `| ${headerName.padEnd(colMaxLenList[idx])} `);

        outputLines.push(''.padEnd(header_str.length, '-'));
        outputLines.push(header_str);
        outputLines.push(''.padEnd(header_str.length, '-'));
    }

    // make rows
    for (let index = 1; index < rows.length; index++) {
        const row = rows[index];
        let line_str: string = '';
        row.forEach((cellStr, colIdx) => line_str += `| ${cellStr.padEnd(colMaxLenList[colIdx])} `);
        outputLines.push(line_str);
    }

    return outputLines;
}

export function getGccBinutilsVersion(gccBinDirPath: string, toolprefix?: string, toolname?: string): string | undefined {

    // example output:
    //   GNU objdump (GNU Arm Embedded Toolchain 10-2020-q4-major) 2.35.1.20201028
    //   GNU readelf (GNU Tools for Arm Embedded Processors 8-2019-q3-update) 2.32.0.20190703

    const exeName = toolname || 'objdump';

    try {
        const lines = child_process.execFileSync(`${toolprefix || ''}${exeName}`, ['-v'], { cwd: gccBinDirPath, encoding: 'ascii' }).split(/\r\n|\n/);
        for (const line of lines) {
            if (line.trim().startsWith(`GNU ${exeName}`)) {
                const m = /(\d+\.\d+\.\d+)(?:\.\d+)*$/.exec(line);
                if (m && m.length > 1) {
                    return m[1].trim();
                }
            }
        }
    } catch (error) {
        GlobalEvent.emit('msg', ExceptionToMessage(error, 'Hidden'));
    }

    return undefined;
}

export function sortPaths(pathList: string[], sep?: string): string[] {

    let plist: string[][] = pathList.map(p => p.split(/\\|\//));

    plist = plist.sort((p1, p2) => {

        const minLen = Math.min(p1.length, p2.length);

        for (let i = 0; i < minLen; i++) {

            const e1 = p1[i];
            const e2 = p2[i];

            if (e1.length != e2.length)
                return e1.length - e2.length;

            if (e1 == e2)
                continue;

            return e1.localeCompare(e2);
        }

        return p1.length - p2.length;
    });

    return plist.map(pl => pl.join(sep || File.sep));
}

export function mergeEnv(old_kv: any, new_kv: any, prependPath?: boolean): any {

    const pnam = platform.osType() == 'win32' ? 'Path' : 'PATH';
    const psep = platform.osType() == 'win32' ? ';' : ':';

    for (const key in new_kv) {
        if (key == pnam && old_kv[key]) {
            old_kv[key] = prependPath ? `${new_kv[key]}${psep}${old_kv[key]}` : `${old_kv[key]}${psep}${new_kv[key]}`;
        } else {
            old_kv[key] = new_kv[key];
        }
    }

    return old_kv;
}

export function copyAndMakeObjectKeysToLowerCase(kv_obj: any): any {
    const nObj: any = {};
    for (const key in kv_obj) nObj[key.toLowerCase()] = kv_obj[key];
    return nObj;
}

export function execInternalCommand(command: string, cwd?: string, cancel?: vscode.CancellationToken): Promise<boolean> {

    return new Promise<boolean>((resolve) => {

        const proc = new ExeCmd();

        proc.on('launch', () => {
            GlobalEvent.emit('globalLog.show');
            GlobalEvent.emit('globalLog.append', `\n>>> exec cmd: '${command}'\n\n`);
        });

        proc.on('data', str => {
            GlobalEvent.emit('globalLog.append', str);
        });

        proc.on('close', exitInfo => {
            resolve(exitInfo.code == 0);
        });

        cancel?.onCancellationRequested(_ => {
            if (!platform.kill(<number>proc.pid())) {
                GlobalEvent.emit('msg', newMessage('Warning', `Can not kill process: ${proc.pid()} !`));
            }
        });

        proc.Run(<string>command, undefined, { cwd: cwd });
    });
}

export async function notifyReloadWindow(msg: string) {
    const resp = await vscode.window.showInformationMessage(msg, 'Ok', 'Later');
    if (resp == 'Ok') {
        await vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
}

export function newMarkdownString(lines: string | string[]): vscode.MarkdownString {
    if (typeof lines == 'string') {
        return new vscode.MarkdownString(lines);
    } else {
        return new vscode.MarkdownString(lines.join(os.EOL));
    }
}

export interface FileTooltipInfo {
    name: string;
    path: string;
    desc?: string;
    attr: { [key: string]: string | undefined };
}

export function newFileTooltipString(f: File | FileTooltipInfo, root?: File): vscode.MarkdownString {

    let title = `**Name:** \`${f.name}\``;

    if (!(f instanceof File) && f.desc) {
        title = title + ` (\`${f.desc}\`)`;
    }

    const s = [
        title,
        `- **Path:** \`${f.path}\``,
    ];

    if (File.IsFile(f.path)) {
        try {
            const meta = fs.statSync(f.path);
            s.push(`- **Size:** \`${meta.size.toString()} Bytes (${(meta.size / 1024).toFixed(1)} KB)\``);
            s.push(`- **LastModifyTime:** \`${meta.mtime.toString()}\``);
        } catch (error) {
            // nothing
        }
    }

    if (root) {
        const re = root.ToRelativePath(f.path);
        if (re) {
            s.push(`- **RelativePath:** \`${re}\``);
        }
    }

    if (!(f instanceof File) && f.attr) { // not a File obj
        for (const key in f.attr) {
            if (f.attr[key]) {
                s.push(`- **${key}:** \`${f.attr[key]}\``);
            }
        }
    }

    return newMarkdownString(s);
}

export function toArray(obj: any): any[] {
    if (obj == undefined || obj == null) return [];
    if (isArray(obj)) return obj;
    return [obj];
}

export interface XmlFormatOptions {
    indentation?: string;
    filter?: (node: any) => boolean;
    stripComments?: boolean;
    collapseContent?: boolean;
    lineSeparator?: string;
    whiteSpaceAtEndOfSelfclosingTag?: boolean;
}

export function xmlfmt(xml: string, opts?: XmlFormatOptions): string {

    const defOpt = {
        indentation: '    ',
        lineSeparator: os.EOL,
        collapseContent: true,
        whiteSpaceAtEndOfSelfclosingTag: false
    };

    if (opts) {
        for (const key in <any>defOpt) {
            if ((<any>opts)[key] == undefined) {
                (<any>opts)[key] = (<any>defOpt)[key];
            }
        }
    }

    try {
        const format = require('xml-formatter');
        return format(xml, opts || defOpt);
    } catch (error) {
        return xml;
    }
}

export function escapeXml(str: string): string {
    return str.replace(/[<>&'"]/g, (c: string): string => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

export interface ShellCommandOptions {
    env?: { [key: string]: any };
    useTerminal?: boolean;
    cwd?: string;
    silent?: boolean;
    source?: string;
}

export async function runShellCommand(title: string, commandLine: string, opts?: ShellCommandOptions) {
    try {

        // use terminal
        if (opts?.useTerminal || !WorkspaceManager.getInstance().hasWorkspaces()) {
            // clean old terminal
            const index = vscode.window.terminals.findIndex((t) => t.name === title);
            if (index !== -1)
                vscode.window.terminals[index].dispose();
            // new terminal
            const tOpts: vscode.TerminalOptions = {
                name: title,
                env: opts?.env || process.env,
                cwd: opts?.cwd
            };
            if (os.platform() == 'win32')
                tOpts.shellPath = 'cmd.exe';
            const terminal = vscode.window.createTerminal(tOpts);
            // show terminal before sendtext
            if (!opts?.silent)
                terminal.show(true);
            terminal.sendText(commandLine);
        }
        // use vscode task
        else {
            // init shell
            const shellOption: vscode.ShellExecutionOptions = {
                env: opts?.env || process.env,
                cwd: opts?.cwd
            };
            if (platform.osType() == 'win32') {
                shellOption.executable = 'cmd.exe';
                shellOption.shellArgs = ['/D', '/C'];
                // FIXME: https://github.com/microsoft/vscode/issues/260534
                if (!/^1\.103\./.test(vscode.version))
                    commandLine = `"${commandLine}"`;
            } else {
                shellOption.executable = '/bin/bash';
                shellOption.shellArgs = ['-c'];
            }
            // init task
            const task = new vscode.Task({ type: 'shell', command: commandLine }, vscode.TaskScope.Global,
                title, opts?.source || 'eide', new vscode.ShellExecution(commandLine, shellOption), []);
            task.isBackground = false;
            task.presentationOptions = {
                echo: true,
                focus: false,
                clear: true
            };
            if (opts?.silent) {
                task.presentationOptions.reveal = vscode.TaskRevealKind.Silent;
                task.presentationOptions.showReuseMessage = false;
            }
            return await vscode.tasks.executeTask(task);
        }

    } catch (error) {
        GlobalEvent.log_error(error);
        GlobalEvent.log_show();
    }
}

export function copyObject(src: any): any {
    if (Array.isArray(src)) {
        return Array.from(src);
    } else if (typeof src === 'object') {
        return JSON.parse(JSON.stringify(src));
    } else {
        return src;
    }
}
export function deepCloneObject(obj: any): any {
    return copyObject(obj);
}

export function wrapCommand(cmds: string[]): string {
    return cmds.map((cmd) => {
        if (cmd.includes(' ') && !cmd.startsWith('"')) { return `"${cmd}"`; }
        return cmd;
    }).join(' ');
}

export function md5(str_or_buff: string | Buffer): string {
    const md5 = crypto.createHash('md5');
    md5.update(str_or_buff);
    return md5.digest('hex');
}

export function sha256(str_or_buff: string | Buffer): string {
    const md5 = crypto.createHash('sha256');
    md5.update(str_or_buff);
    return md5.digest('hex');
}

export function sha1(str_or_buff: string | Buffer): string {
    const md5 = crypto.createHash('sha1');
    md5.update(str_or_buff);
    return md5.digest('hex');
}

export function newSevenZipperInstance(): SevenZipper {
    return new SevenZipper(ResManager.GetInstance().Get7zDir());
}

export async function openUrl(url: string): Promise<Error | undefined> {
    try {
        await vscode.commands.executeCommand(`vscode.open`, vscode.Uri.parse(url));
    } catch (error) {
        return error;
    }
}

export function compareVersion(v1: string, v2: string): number {

    const v1_li = v1.split('.').filter((s) => s.trim() != '');
    const v2_li = v2.split('.').filter((s) => s.trim() != '');

    // compare per number
    const minLen = Math.min(v1_li.length, v2_li.length);
    for (let index = 0; index < minLen; index++) {
        const v_1 = parseInt(v1_li[index]);
        if (isNaN(v_1)) throw new Error(`version string '${v1}' must only contain 'number' and '.'`);
        const v_2 = parseInt(v2_li[index]);
        if (isNaN(v_2)) throw new Error(`version string '${v2}' must only contain 'number' and '.'`);
        if (v_1 > v_2) return 1;
        if (v_1 < v_2) return -1;
    }

    // if prefix is equal, compare len
    if (v1_li.length > v2_li.length) return 1;
    if (v1_li.length < v2_li.length) return -1;

    return 0;
}

const PROXY_HOST_MAP: { [host: string]: string[] } = {
    'api.github.com': [
        'api-github.em-ide.com'
    ],
    'raw.githubusercontent.com': [
        'raw-github.em-ide.com'
    ]
};

export function redirectHost(url: string) {

    if (!SettingManager.GetInstance().isUseGithubProxy()) {
        return url;
    }

    // replace host
    for (const host in PROXY_HOST_MAP) {
        const hostList = PROXY_HOST_MAP[host];
        if (hostList.length > 1) {
            const idx = Math.floor(Math.random() * hostList.length); // random index
            url = url.replace(host, hostList[idx]);
        } else {
            url = url.replace(host, hostList[0]);
        }
    }

    return url;
}

export function setProxyHeader(headers: { [key: string]: string | undefined }): { [key: string]: string | undefined } {

    try {
        const proxyUtils = require('./Private/GithubProxy');
        proxyUtils.setProxyHeader(headers);
    } catch (error) {
        // ignore error
    }

    return headers;
}

export function formatPath(path: string): string {
    return File.ToLocalPath(path.trim().replace(/(?:\\|\/)+$/, ''));
}

export async function downloadFile(url: string): Promise<Buffer | Error | undefined> {

    return new Promise(async (resolve) => {

        let locked = false;
        const resolveIf = (data: Error | Buffer | undefined) => {
            if (!locked) {
                locked = true;
                resolve(data);
            }
        };

        const netReq = new NetRequest();

        netReq.on('error', (err) => {
            resolveIf(err);
        });

        // parse path
        const urlParts = url.replace('https://', '').split('/');
        const hostName = urlParts[0];
        const path = '/' + urlParts.slice(1).join('/');

        const res = await netReq.RequestBinary<any>({
            host: hostName,
            path: path,
            headers: setProxyHeader({ 'User-Agent': 'Mozilla/5.0' })
        }, 'https');

        let result: Buffer | Error | undefined;

        if (res.success && res.content) { // received ok
            result = res.content;
        } else {
            result = new Error(`Download file failed !, https code: ${res.statusCode}, msg: ${res.msg}`);
        }

        resolveIf(result);
    });
}

export function isVersionString(str: string): boolean {
    return /^\d+(?:\.\d+)+$/.test(str.trim());
}

export async function requestTxt(url: string): Promise<string | Error | undefined> {

    return new Promise(async (resolve) => {

        let locked = false;
        const resolveIf = (data: string | Error | undefined) => {
            if (!locked) {
                locked = true;
                resolve(data);
            }
        };

        const netReq = new NetRequest();

        netReq.on('error', (err) => {
            resolveIf(err);
        });

        // parse path
        const urlParts = url.replace('https://', '').split('/');
        const hostName = urlParts[0];
        const path = '/' + urlParts.slice(1).join('/');

        const res = await netReq.RequestTxt<any>({
            host: hostName,
            path: path,
            headers: setProxyHeader({ 'User-Agent': 'Mozilla/5.0' })
        }, 'https');

        let result: string | Error | undefined;

        if (res.success && res.content) { // received ok
            result = res.content;
        } else {
            result = new Error(`Request failed !, https errCode: ${res.statusCode}, msg: ${res.msg}`);
        }

        resolveIf(result);
    });
}

export async function downloadFileWithProgress(url: string, fileLable: string,
    progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken): Promise<Buffer | Error | undefined> {

    return new Promise(async (resolve) => {

        let locked = false;
        const resolveIf = (data: Error | Buffer | undefined) => {
            if (!locked) {
                locked = true;
                resolve(data);
            }
        };

        const netReq = new NetRequest();

        netReq.on('error', (err) => {
            resolveIf(err);
        });

        token.onCancellationRequested(() => {
            netReq.emit('abort');
            resolveIf(undefined);
        });

        // parse path
        const urlParts = url.replace('https://', '').split('/');
        const hostName = urlParts[0];
        const path = '/' + urlParts.slice(1).join('/');

        let curIncrement: number = 0;

        const res = await netReq.RequestBinary<any>({
            host: hostName,
            path: path,
            headers: setProxyHeader({ 'User-Agent': 'Mozilla/5.0' }),
            rejectUnauthorized: true
        }, 'https', (increment) => {
            curIncrement += increment;
            if (curIncrement > 1) { curIncrement = 1; } // limit to 100 %
            progress.report({
                increment: increment * 100,
                message: `${(curIncrement * 100).toFixed(1)}% of '${fileLable}'`
            });
        });

        let result: Buffer | Error | undefined;

        if (res.success && res.content) { // received ok
            result = res.content;
        } else if (token.isCancellationRequested === false) {
            result = new Error(`Download file failed !, https code: ${res.statusCode}, msg: ${res.msg}`);
        }

        resolveIf(result);
    });
}

export async function readGithubRepoFolder(repo_url: string, token?: vscode.CancellationToken): Promise<GitFileInfo[] | Error> {

    // URL: https://api.github.com/repos/github0null/eide-doc/contents/eide-template-list
    const remoteUrl = redirectHost(repo_url).replace(/^http[s]?:\/\//, '');
    const netReq = new NetRequest();

    let reqError: Error | undefined;
    netReq.on('error', (err) => {
        (<Error>err).message = `Failed to connect '${remoteUrl}'`;
        reqError = err;
    });

    const pathArr = (remoteUrl).split('/');
    const hostName = pathArr[0];
    const path = '/' + pathArr.slice(1).join('/');

    token?.onCancellationRequested(() => {
        netReq.emit('abort');
    });

    const res = await netReq.Request<any, any>({
        host: hostName,
        path: path,
        timeout: 3000,
        headers: setProxyHeader({ 'User-Agent': 'Mozilla/5.0' })
    }, 'https');

    if (!res.success) {
        const errMsg = res.msg ? `, msg: ${res.msg}` : '';
        return new Error(`Can't connect to github repository !${errMsg}`);
    } else if (res.content === undefined) {
        const errMsg = res.msg ? `, msg: ${res.msg}` : '';
        return new Error(`Can't get content from github repository !${errMsg}`);
    }

    if (reqError) {
        return reqError;
    }

    return <GitFileInfo[]>res.content;
}

/**
 * @param repo_path like: github0null/eide_default_external_tools_index
 * @param file_path like: dir/index.json
*/
export async function readGithubRepoTxtFile(repo_path: string, file_path: string): Promise<string | Error | undefined> {
    // https://raw.githubusercontent.com/github0null/eide_default_external_tools_index/master/xxx
    const url = redirectHost(`https://raw.githubusercontent.com/${repo_path}/master/${file_path}`);
    return await requestTxt(url);
}

export function genGithubHash(f: File | Buffer): string {
    if (f instanceof File) {
        const header = Buffer.from('blob ' + f.getSize() + '\0');
        const buf = Buffer.concat([header, fs.readFileSync(f.path)], header.length + f.getSize());
        const hash = crypto.createHash('sha1');
        hash.update(buf);
        return hash.digest('hex');
    } else {
        const header = Buffer.from('blob ' + f.length + '\0');
        const buf = Buffer.concat([header, f], header.length + f.length);
        const hash = crypto.createHash('sha1');
        hash.update(buf);
        return hash.digest('hex');
    }
}

interface FileCacheInfo {

    version: string;

    files: { name: string; sha: string; }[];
}

export class FileCache {

    private folder: File;
    private cacheFile: File;
    private cache: FileCacheInfo;

    public constructor(rootFolder: File) {
        this.folder = rootFolder;
        this.cacheFile = File.fromArray([rootFolder.path, 'cache.json']);
        this.cache = this.cacheFile.IsFile() ? JSON.parse(this.cacheFile.Read()) : { version: '1.0', files: [] };
    }

    public add(name: string, sha: string) {

        const idx = this.cache.files.findIndex((inf) => inf.name == name);

        if (idx != -1) {
            this.cache.files[idx].sha = sha;
        } else {
            this.cache.files.push({
                name: name,
                sha: sha
            });
        }
    }

    public get(name: string, sha: string): File | undefined {

        const idx = this.cache.files.findIndex((inf) => {
            return inf.name == name && inf.sha == sha;
        });

        if (idx == -1) {
            return undefined;
        }

        const f = File.fromArray([this.folder.path, this.cache.files[idx].name]);
        if (!f.IsFile()) {
            return undefined;
        }

        return f;
    }

    public clear(name?: string) {
        if (name) {
            const idx = this.cache.files.findIndex((inf) => inf.name == name);
            if (idx != -1) {
                this.cache.files.splice(idx, 1);
            }
        } else {
            this.cache.files = [];
        }
    }

    public save() {
        this.cacheFile.Write(JSON.stringify(this.cache));
    }
}

export function ToJsonStringExclude(obj: any, excludeList?: string[], indent?: string | number): string {

    const my_replacer = (key: string, val: any): any => {

        if (!val) return val;

        if (key == '' && excludeList && excludeList.length > 0) {

            let newVal = JSON.parse(JSON.stringify(val));

            for (const rKey of excludeList) {
                newVal[rKey] = undefined;
            }

            return newVal;
        }

        return val;
    };

    return JSON.stringify(obj, my_replacer, indent);
}

export function getFirstKey(obj: any): string | undefined {
    if (typeof obj === 'object') {
        for (const key in obj) {
            return key;
        }
    }
}
