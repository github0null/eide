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
import * as vscode from 'vscode';
import * as NodePath from 'path';
import * as events from 'events';
import * as globmatch from 'micromatch'
import * as os from 'os';
import * as child_process from 'child_process';
import * as mathjs from 'mathjs';

import { AbstractProject, VirtualSource } from "./EIDEProject";
import { ResManager } from "./ResManager";
import { File } from "../lib/node-utility/File";
import { BuilderOptions, ProjectConfigData, ProjectConfiguration } from "./EIDETypeDefine";
import {
    ArmBaseCompileData,
    Memory, ARMStorageLayout,
    FloatingHardwareOption, C51BaseCompileData, RiscvCompileData, AnyGccCompileData, MipsCompileData
} from './EIDEProjectModules';
import { SettingManager } from "./SettingManager";
import { GlobalEvent } from "./GlobalEvents";
import { ExceptionToMessage, newMessage } from "./Message";
import { CmdLineHandler } from "./CmdLineHandler";

import { ArrayDelRepetition } from "../lib/node-utility/Utility";
import { DependenceManager } from "./DependenceManager";
import { WorkspaceManager } from "./WorkspaceManager";
import { ToolchainName } from "./ToolchainManager";
import { md5, sha256, copyObject, generateDotnetProgramCmd, generateRandomStr, isGccFamilyToolchain } from "./utility";
import { exeSuffix, osType } from "./Platform";
import { FileWatcher } from "../lib/node-utility/FileWatcher";
import { STVPFlasherOptions } from './HexUploader';
import * as ArmCpuUtils from './ArmCpuUtils';

export interface BuildOptions {

    not_rebuild?: boolean; // true: 增量编译，false: 重新编译所有

    flashAfterBuild?: boolean;

    onlyDumpCompilerInfo?: boolean; // true: 仅输出编译命令及版本信息

    onlyDumpBuilderParams?: boolean;

    otherArgs?: string[];
}

export interface BuilderParams {
    name: string;
    target: string;
    toolchain: ToolchainName;
    toolchainCfgFile: string;
    toolchainLocation: string;
    buildMode: string;
    showRepathOnLog?: boolean,
    threadNum?: number;
    dumpPath: string;
    outDir: string;
    builderDir?: string;
    rootDir: string;
    ram?: number;
    rom?: number;
    sourceList: string[];
    sourceParams?: { [name: string]: string; };
    incDirs: string[];
    libDirs: string[];
    defines: string[];
    options: BuilderOptions;
    sha?: { [options_name: string]: string };
    env?: { [name: string]: any };
    sysPaths?: string[];
    alwaysInBuildSources?: string[];
}

export interface CompilerCommandsDatabaseItem {
    directory: string;
    file: string;
    command: string;
}

export abstract class CodeBuilder {

    protected readonly paramsFileName = 'builder.params';

    protected project: AbstractProject;
    protected useFastCompile?: boolean;
    protected onlyDumpCompilerInfo?: boolean;
    protected otherArgs?: string[];
    protected _event: events.EventEmitter;
    protected logWatcher: FileWatcher | undefined;

    constructor(_project: AbstractProject) {
        this.project = _project;
        this._event = new events.EventEmitter();
    }

    on(event: 'launched', listener: () => void): void;
    on(event: 'finished', listener: (done?: boolean) => void): void;
    on(event: any, listener: (arg: any) => void): void {
        this._event.on(event, listener);
    }

    private emit(event: 'launched'): void;
    private emit(event: 'finished', done?: boolean): void;
    private emit(event: any, arg?: any): void {
        this._event.emit(event, arg);
    }

    protected genSourceInfo(): {
        sources: string[],
        params?: { [name: string]: string; },
        alwaysBuildSourceFiles?: string[]
    } {

        const srcParams: { [name: string]: string; } = {};
        const srcList: { path: string, virtualPath?: string; }[] = this.project.getAllSources();
        const alwaysBuildSourceFiles: string[] = [];

        // append user options for files
        try {
            const options = this.project.getSourceExtraArgsCfg();

            // parser
            const matcher = (parttenInfo: any, fieldName: string) => {
                srcList.forEach((srcInf: any) => {
                    if (!srcInf[fieldName]) return; // skip if not exist
                    for (const expr in parttenInfo) {
                        const searchPath = File.ToUnixPath(<string>srcInf[fieldName])
                            .replace(/\.\.\//g, '')
                            .replace(/\.\//g, ''); // globmatch bug ? it can't parse path which have '.' or '..'
                        if (globmatch.isMatch(searchPath, expr)) {
                            const val = parttenInfo[expr]?.replace(/\r\n|\n/g, ' ').replace(/\\r|\\n|\\t/g, ' ').trim();
                            if (val) {
                                if (srcParams[srcInf.path]) {
                                    srcParams[srcInf.path] += ` ${val}`
                                } else {
                                    srcParams[srcInf.path] = val;
                                }
                            }
                        }
                    }
                });
            };

            if (options) {

                // virtual folder files
                if (typeof options?.virtualPathFiles == 'object') {
                    const parttenInfo = options?.virtualPathFiles;
                    matcher(parttenInfo, 'virtualPath');
                }

                // filesystem files
                if (typeof options?.files == 'object') {
                    const parttenInfo = options?.files;
                    matcher(parttenInfo, 'path');
                }

                if (Array.isArray(options.alwaysBuildSourceFiles)) {
                    options.alwaysBuildSourceFiles.forEach((srcPath) => {
                        if (srcList.findIndex((inf) => this.project.comparePath(inf.path, srcPath)) != -1) {
                            alwaysBuildSourceFiles.push(srcPath);
                        }
                    });
                }
            }

        } catch (err) {
            GlobalEvent.emit('msg', ExceptionToMessage(err, 'Hidden'));
            GlobalEvent.emit('msg', newMessage('Warning', `Append files options failed !, msg: ${err.message || ''}`));
        }

        return {
            sources: srcList.map((inf) => inf.path),
            params: srcParams,
            alwaysBuildSourceFiles
        }
    }

    getIncludeDirs(): string[] {

        const incList = this.project.GetConfiguration()
            .GetAllMergeDep([`${ProjectConfiguration.BUILD_IN_GROUP_NAME}.${DependenceManager.toolchainDepName}`])
            .incList;

        return ArrayDelRepetition(incList.concat(
            this.project.getToolchain().getDefaultIncludeList(),
            this.project.getSourceIncludeList()
        )).map(p => this.project.ToAbsolutePath(p));
    }

    getProjectCMacroList(): string[] {
        return this.project.GetConfiguration().GetAllMergeDep().defineList.map(s => this.project.resolveEnvVar(s));
    }

    getLibDirs(): string[] {
        return this.project.GetConfiguration()
            .GetAllMergeDep([`${ProjectConfiguration.BUILD_IN_GROUP_NAME}.${DependenceManager.toolchainDepName}`])
            .libList.map(p => this.project.ToAbsolutePath(p));
    }

    protected enableRebuild(_enable: boolean = true) {
        this.useFastCompile = !_enable;
    }

    protected isRebuild(): boolean {
        return !this.useFastCompile;
    }

    protected isExportMakefileMode(): boolean {
        return this.otherArgs?.includes('--out-makefile') || false;
    }

    protected isDryRun(): boolean {
        return this.otherArgs?.includes('--dry-run') || false;
    }

    protected convLinkerScriptPathForCompiler(path: string, noQuote?: boolean): string {
        let outPath: string;
        if (this.isExportMakefileMode()) {
            outPath = this.project.toRelativePath(path);
        } else {
            outPath = File.ToUnixPath(this.project.ToAbsolutePath(path));
        }
        if (outPath.includes(' ') && !noQuote)
            outPath = `"${outPath}"`; // add quotes if path has space
        return outPath;
    }

    build(options?: BuildOptions): void {

        let commandLine = this.genBuildCommand(options);

        // do some check
        if (!this.project.checkAndNotifyInstallToolchain()) return;
        if (options?.onlyDumpBuilderParams) return; // if only generate params, exit
        if (!commandLine) return;

        const title = (options?.onlyDumpCompilerInfo ? 'compiler params' : 'build') + `:${this.project.getCurrentTarget()}`;

        // watch log, to emit done event
        try {

            const checkBuildDone = (logFile: File): boolean => {
                try {
                    // [2022-xx-xx 15:07:53]	[done]
                    const revLines = logFile.Read().split(/\r\n|\n/).reverse();
                    const idx = revLines.findIndex(line => /^\[\d+\-\d+\-\d+ [^\]]+\]/.test(line));
                    if (idx == -1) { return false; }
                    return /\[done\]\s*$/i.test(revLines[idx]);
                } catch (error) {
                    return false;
                }
            };

            const outDir = this.project.ToAbsolutePath(this.project.getOutputDir());
            const builderLog = File.fromArray([outDir, 'unify_builder.log']);
            if (!builderLog.IsFile()) builderLog.Write('');
            if (this.logWatcher) { this.logWatcher.Close(); delete this.logWatcher; };

            this.logWatcher = new FileWatcher(builderLog, false);
            this.logWatcher.OnChanged = () => {
                this.logWatcher?.Close();
                setTimeout(() => this.emit('finished', checkBuildDone(builderLog)), 500);
            };

            // start watch
            this.logWatcher.Watch();

        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Hidden'));
        }

        // run build
        if (SettingManager.GetInstance().isUseTaskToBuild() &&
            WorkspaceManager.getInstance().hasWorkspaces()) { // use vscode task
            // setup shell
            const shellOption: vscode.ShellExecutionOptions = {};
            if (os.platform() == 'win32') { shellOption.executable = 'cmd.exe'; shellOption.shellArgs = ['/C']; }
            else { shellOption.executable = '/bin/bash'; shellOption.shellArgs = ['-c']; }
            shellOption.env = <any>process.env;
            // setup task
            if (os.platform() == 'win32') commandLine = `"${commandLine}"`;
            const task = new vscode.Task({ type: 'shell', command: commandLine }, vscode.TaskScope.Workspace,
                title, 'eide.builder', new vscode.ShellExecution(commandLine, shellOption), []);
            task.group = vscode.TaskGroup.Build;
            task.isBackground = false;
            task.presentationOptions = { echo: true, focus: false, clear: true };
            if (SettingManager.GetInstance().isSilentBuildOrFlash()) {
                task.presentationOptions.reveal = vscode.TaskRevealKind.Silent;
                task.presentationOptions.showReuseMessage = false;
            }
            vscode.tasks.executeTask(task);
        } else { // use terminal
            const index = vscode.window.terminals.findIndex((t) => { return t.name === title; });
            if (index !== -1) { vscode.window.terminals[index].dispose(); }
            const opts: vscode.TerminalOptions = { name: title, iconPath: new vscode.ThemeIcon('target') };
            if (os.platform() == 'win32') { opts.shellPath = 'cmd.exe'; };
            opts.env = <any>process.env;
            const terminal = vscode.window.createTerminal(opts);
            if (!SettingManager.GetInstance().isSilentBuildOrFlash())
                terminal.show(true);
            terminal.sendText(commandLine);
        }

        // post event
        this.emit('launched');
    }

    genBuildCommand(options?: BuildOptions, disPowershell?: boolean): string | undefined {

        // setup build mode
        this.useFastCompile = options?.not_rebuild;
        this.onlyDumpCompilerInfo = options?.onlyDumpCompilerInfo;
        this.otherArgs = options?.otherArgs;

        const prjConfig = this.project.GetConfiguration();
        const outDir = new File(this.project.ToAbsolutePath(prjConfig.getOutDir()));
        outDir.CreateDir(true);

        // generate command line
        const commandLine = generateDotnetProgramCmd(
            ResManager.instance().getUnifyBuilderExe(), this.getCommands());

        return commandLine;
    }

    private getCommands(): string[] {

        const config = this.project.GetConfiguration().config;
        const settingManager = SettingManager.GetInstance();
        const toolchain = this.project.getToolchain();

        const outDir = File.ToUnixPath(this.project.getOutputDir());
        const compileOptions: BuilderOptions = this.project.GetConfiguration().compileConfigModel.getOptions();
        const memMaxSize = this.getMcuMemorySize();
        const sourceInfo = this.genSourceInfo();
        const builderModeList: string[] = []; // build mode

        const builderOptions: BuilderParams = {
            name: config.name,
            target: this.project.getCurrentTarget(),
            toolchain: toolchain.name,
            toolchainLocation: this.project.getToolchainLocation().path,
            toolchainCfgFile: `${ResManager.GetInstance().getBuilderModelsDir().path}/${toolchain.modelName}`,
            buildMode: 'fast|multhread',
            showRepathOnLog: settingManager.isPrintRelativePathWhenBuild(),
            threadNum: settingManager.getThreadNumber(),
            rootDir: this.project.GetRootDir().path,
            dumpPath: File.ToLocalPath(outDir),
            outDir: File.ToLocalPath(outDir),
            ram: memMaxSize?.ram,
            rom: memMaxSize?.rom,
            incDirs: this.getIncludeDirs().map(p => this.project.toRelativePath(p)),
            libDirs: this.getLibDirs().map(p => this.project.toRelativePath(p)),
            defines: this.getProjectCMacroList(),
            sourceList: sourceInfo.sources.sort(),
            alwaysInBuildSources: sourceInfo.alwaysBuildSourceFiles,
            sourceParams: sourceInfo.params,
            options: JSON.parse(JSON.stringify(compileOptions)),
            env: this.project.getProjectVariables(),
            sysPaths: []
        };

        // set ram size from env
        if (builderOptions.ram == undefined &&
            builderOptions.env &&
            builderOptions.env['MCU_RAM_SIZE']) {

            const expr = (<string>builderOptions.env['MCU_RAM_SIZE']);
            const expr_args = {
                B: 1,
                K: 1024,
                M: 1024 * 1024,
                G: 1024 * 1024 * 1024
            };

            try {
                builderOptions.ram = mathjs.evaluate(expr, expr_args) as number || undefined;
            } catch (error) {
                // nothing todo
            }

            if (builderOptions.ram && builderOptions.ram <= 0)
                builderOptions.ram = undefined;
        }

        // set rom size from env
        if (builderOptions.rom == undefined &&
            builderOptions.env &&
            builderOptions.env['MCU_ROM_SIZE']) {

            const expr = (<string>builderOptions.env['MCU_ROM_SIZE']);
            const expr_args = {
                B: 1,
                K: 1024,
                M: 1024 * 1024,
                G: 1024 * 1024 * 1024
            };

            try {
                builderOptions.rom = mathjs.evaluate(expr, expr_args) as number || undefined;
            } catch (error) {
                // nothing todo
            }

            if (builderOptions.rom && builderOptions.rom <= 0)
                builderOptions.rom = undefined;
        }

        // select linker driver for gcc family toolchain
        if (toolchain.categoryName.toLowerCase() == 'gcc' && 
            toolchain.name != 'ANY_GCC') {
            let tool = builderOptions.options?.linker['$toolName'];
            // we need to detect source files type ?
            if (tool == 'auto' || tool == undefined || tool == null) {
                let hascpp = builderOptions.sourceList
                    .some((path) => /\.(?:cpp|c\+\+|cc|cxx)$/i.test(path));
                tool = hascpp ? 'g++' : 'gcc';
            }
            // setup tool name
            builderOptions.options.linker['$toolName'] = tool;
        }

        // handle options by toolchain
        toolchain.preHandleOptions({
            targetName: config.name,
            toAbsolutePath: (path) => this.project.ToAbsolutePath(path),
            getOutDir: () => { return this.project.ToAbsolutePath(outDir); }
        }, builderOptions.options);

        // handle options
        this.preHandleOptions(builderOptions.options);

        // gen libs.makefile
        const mkfile_dir  = new File(this.project.ToAbsolutePath(outDir + '/.lib'));
        const mkfile_path = `${mkfile_dir.name}/Makefile`;
        const mkfile_cont = this.project.genLibsMakefileContent(mkfile_path);
        if (mkfile_cont) {
            try {
                if (!mkfile_dir.IsDir()) mkfile_dir.CreateDir(true);
                fs.writeFileSync(`${this.project.ToAbsolutePath(outDir)}/${mkfile_path}`, mkfile_cont);
                let command: any = {
                    name: 'make libraries',
                    command: `make --directory=./${outDir} --makefile=./${mkfile_path} all`
                };
                if (builderOptions.options.afterBuildTasks == undefined)
                    builderOptions.options.afterBuildTasks = [];
                builderOptions.options.afterBuildTasks = [command].concat(builderOptions.options.afterBuildTasks);
            } catch (error) {
                GlobalEvent.emit('msg', newMessage('Warning', `Generating '${mkfile_path}' failed !`));
                GlobalEvent.log_error(error);
            }
        }

        // set build mode
        {
            if (config.toolchain === 'Keil_C51') {
                builderModeList.push('normal'); // disable increment build for Keil C51
            } else {
                builderModeList.push('fast');
            }

            if (settingManager.isUseMultithreadMode()) {
                builderModeList.push('multhread');
            }

            // set build mode
            builderOptions.buildMode = builderModeList.map(str => str.toLowerCase()).join('|');
        }

        const paramsPath = (this.isExportMakefileMode() && this.isDryRun())
            ? File.from(os.tmpdir(), `${generateRandomStr()}-${this.paramsFileName}`).path
            : this.project.ToAbsolutePath(outDir + File.sep + this.paramsFileName);
        let cmds = ['-p', paramsPath];

        if (this.isRebuild()) {
            cmds.push('--rebuild');
        } else {
            if (settingManager.isEnableCcache(builderOptions.sourceList.length)) {
                cmds.push('--use-ccache');
                const dir = File.from(ResManager.instance().getBuiltInToolsDir().path, 'ccache');
                if (dir.IsDir()) {
                    builderOptions.sysPaths?.push(dir.path);
                }
            }
        }

        if (this.onlyDumpCompilerInfo) {
            cmds.push('--only-dump-args');
        }

        if (this.otherArgs && this.otherArgs.length > 0) {
            this.otherArgs.forEach(arg => cmds.push(arg));
        }

        const extraCmd = settingManager.getBuilderAdditionalCommandLine()?.trim();
        if (extraCmd) {
            cmds = cmds.concat(extraCmd.split(/\s+/));
        }

        // write project build params
        fs.writeFileSync(paramsPath, JSON.stringify(builderOptions, undefined, 4));

        return cmds;
    }

    protected abstract getMcuMemorySize(): MemorySize | undefined;

    protected abstract preHandleOptions(options: BuilderOptions): void;

    static NewBuilder(_project: AbstractProject): CodeBuilder {
        switch (_project.GetConfiguration().config.type) {
            case 'ARM':
                return new ARMCodeBuilder(_project);
            case 'RISC-V':
                return new RiscvCodeBuilder(_project);
            case 'ANY-GCC':
                return new AnyGccCodeBuilder(_project);
            case 'C51':
                return new C51CodeBuilder(_project);
            case 'MIPS':
                return new MipsCodeBuilder(_project);
            default:
                throw new Error(`not support this project type: '${_project.GetConfiguration().config.type}'`);
        }
    }
}

interface MemorySize {
    ram?: number;
    rom?: number;
}

interface RomItem {
    memInfo: Memory;
    selected: boolean;
}

interface RamItem {
    memInfo: Memory;
    selected: boolean;
    noInit: boolean;
}

interface MemoryScatter {
    startUpIndex: number;
    romList: RomItem[];
    ramList: RamItem[];
}

interface MemoryText {
    name: string;
    addr: string;
    content: string;
    child: MemoryText[];
}

export class ARMCodeBuilder extends CodeBuilder {

    constructor(_project: AbstractProject) {
        super(_project);
    }

    private EmptyMemoryScatter(): MemoryScatter {
        let memScatter: MemoryScatter = {
            startUpIndex: -1,
            romList: [],
            ramList: []
        };

        for (let i = 0; i < 5; i++) {
            memScatter.romList.push({
                memInfo: {
                    startAddr: '0x00000000',
                    size: '0x00000000'
                },
                selected: false
            });
            memScatter.ramList.push({
                memInfo: {
                    startAddr: '0x00000000',
                    size: '0x00000000'
                },
                selected: false,
                noInit: false
            });
        }

        return memScatter;
    }

    private FillHexNumber(num: string): string {
        if (num.length >= 10) {
            return num;
        }
        let str = '0x';
        for (let i = 0; i < (10 - num.length); i++) {
            str += '0';
        }
        return str + num.substring(2);
    }

    private GetMemoryScatter(_storageLayout: ARMStorageLayout): MemoryScatter {

        let memScatter = this.EmptyMemoryScatter();
        memScatter.startUpIndex = -1;

        const storageLayout: ARMStorageLayout = JSON.parse(JSON.stringify(_storageLayout));

        let index = 0;
        for (let i = 0; i < storageLayout.RAM.length; i++) {

            switch (storageLayout.RAM[i].tag) {
                case 'IRAM':
                    index = storageLayout.RAM[i].id + 2;
                    break;
                case 'RAM':
                    index = storageLayout.RAM[i].id - 1;
                    break;
                default:
                    throw Error('Unknown RAM Tag !');
            }

            memScatter.ramList[index].memInfo = storageLayout.RAM[i].mem;
            memScatter.ramList[index].memInfo.startAddr = this.FillHexNumber(storageLayout.RAM[i].mem.startAddr);
            memScatter.ramList[index].memInfo.size = this.FillHexNumber(storageLayout.RAM[i].mem.size);
            memScatter.ramList[index].selected = storageLayout.RAM[i].isChecked;
            memScatter.ramList[index].noInit = storageLayout.RAM[i].noInit;
        }

        for (let i = 0; i < storageLayout.ROM.length; i++) {

            switch (storageLayout.ROM[i].tag) {
                case 'IROM':
                    index = storageLayout.ROM[i].id + 2;
                    break;
                case 'ROM':
                    index = storageLayout.ROM[i].id - 1;
                    break;
                default:
                    throw Error('Unknown ROM Tag !');
            }

            memScatter.romList[index].memInfo = storageLayout.ROM[i].mem;
            memScatter.romList[index].memInfo.startAddr = this.FillHexNumber(storageLayout.ROM[i].mem.startAddr);
            memScatter.romList[index].memInfo.size = this.FillHexNumber(storageLayout.ROM[i].mem.size);
            memScatter.romList[index].selected = storageLayout.ROM[i].isChecked;
            memScatter.startUpIndex = storageLayout.ROM[i].isStartup ? index : memScatter.startUpIndex;
        }

        if (memScatter.startUpIndex === -1) {
            throw Error('MemScatter.startupIndex can\'t be -1');
        }
        else if (!memScatter.romList[memScatter.startUpIndex].selected) {
            throw Error('the IROM' + (memScatter.startUpIndex - 2).toString() + ' is a startup ROM but it is not selected !');
        }

        return memScatter;
    }

    private GenMemTxtBySct(memScatter: MemoryScatter): MemoryText[] {

        const getRomName = (index: number, isChild: boolean): string => {
            let name = isChild ? 'ER_' : 'LR_';
            let num = index + 1;
            if (num > 3) {
                name += 'I';
                num = num - 3;
            }
            return name + 'ROM' + num.toString();
        };
        const getRamName = (index: number) => {
            let name = 'RW_';
            let num = index + 1;
            if (num > 3) {
                name += 'I';
                num = num - 3;
            }
            return name + 'RAM' + num.toString();
        };

        const memTxt: MemoryText[] = [];

        const staUpInfo = memScatter.romList[memScatter.startUpIndex].memInfo;

        const staUpTxt: MemoryText = {
            name: getRomName(memScatter.startUpIndex, false),
            addr: ' ' + staUpInfo.startAddr + ' ' + staUpInfo.size + ' ',
            content: '',
            child: []
        };
        staUpTxt.child.push({
            name: getRomName(memScatter.startUpIndex, true),
            addr: ' ' + staUpInfo.startAddr + ' ' + staUpInfo.size + ' ',
            content: '*.o (RESET, +First) \r\n*(InRoot$$Sections) \r\n.ANY (+RO) \r\n.ANY (+XO) \r\n',
            child: []
        });

        //RAM
        memScatter.ramList.forEach((item, index) => {
            if (item.selected) {
                staUpTxt.child.push({
                    name: getRamName(index),
                    addr: ' ' + item.memInfo.startAddr + (item.noInit ? ' UNINIT ' : ' ') + item.memInfo.size + ' ',
                    content: '.ANY (+RW +ZI) \r\n',
                    child: []
                });
            }
        });

        memTxt.push(staUpTxt);

        memScatter.romList.forEach((item, index) => {
            if (item.selected && index !== memScatter.startUpIndex) {
                memTxt.push({
                    name: getRomName(index, false),
                    addr: ' ' + item.memInfo.startAddr + ' ' + item.memInfo.size + ' ',
                    content: '',
                    child: [{
                        name: getRomName(index, true),
                        addr: ' ' + item.memInfo.startAddr + ' ' + item.memInfo.size + ' ',
                        content: '.ANY (+RO) \r\n',
                        child: []
                    }]
                });
            }
        });

        return memTxt;
    }

    private GenMemScatterFile(config: ProjectConfigData<ArmBaseCompileData>): File {

        const sctFile = new File(this.project.ToAbsolutePath(this.project.getOutputDir()
            + File.sep + config.name + '.sct'));

        let data = '';
        const memTxt = this.GenMemTxtBySct(this.GetMemoryScatter(config.compileConfig.storageLayout));

        memTxt.forEach(tItem => {
            let str = tItem.name + tItem.addr + '{\r\n';

            if (tItem.child.length > 0) {
                tItem.child.forEach(v => {
                    str += v.name + v.addr + '{\r\n';
                    str += v.content;
                    str += '}\r\n';
                });
            } else {
                str += tItem.content;
            }

            str += '}\r\n\r\n';
            data += str;
        });

        // indent sct text
        const lines = data.split(/\r\n|\n/);
        let braceCount = 0;
        for (let index = 0; index < lines.length; index++) {

            const line = lines[index];

            if (line.endsWith('}')) {
                braceCount--;
            }

            if (braceCount > 0 && line.trim() !== '') {
                lines[index] = '\t'.repeat(braceCount) + line;
            }

            if (line.endsWith('{')) {
                braceCount++;
            }
        }

        const title =
            '; ******************************************************************' + '\r\n' +
            '; *** Scatter-Loading Description File generated by Embedded IDE ***' + '\r\n' +
            '; ******************************************************************' + '\r\n\r\n';
        data = lines.join('\r\n');
        sctFile.Write(title + data);

        return sctFile;
    }

    static getFpuSuffix(cpu: string, hardOption: FloatingHardwareOption): string {
        switch (hardOption) {
            case 'single':
                return ArmCpuUtils.hasFpu(cpu) ? '-sp' : '';
            case 'double':
                return ArmCpuUtils.hasFpu(cpu, true) ? '-dp' : '';
            default: // none
                return '';
        }
    }

    protected getMcuMemorySize(): MemorySize | undefined {

        const prjConfig = this.project.GetConfiguration<ArmBaseCompileData>();

        if (!prjConfig.config.compileConfig.useCustomScatterFile) {

            const memLayout: ARMStorageLayout = JSON.parse(JSON.stringify(prjConfig.config.compileConfig.storageLayout));
            const res: MemorySize = {};

            try {
                let romSize = 0;
                for (const rom of memLayout.ROM) {
                    if (rom.isChecked) {
                        romSize += parseInt(rom.mem.size);
                    }
                }
                res.rom = !isNaN(romSize) ? romSize : undefined;
            } catch (error) {
                GlobalEvent.emit('msg', ExceptionToMessage(error, 'Hidden'));
            }

            try {
                let ramSize = 0;
                for (const ram of memLayout.RAM) {
                    if (ram.isChecked) {
                        ramSize += parseInt(ram.mem.size);
                    }
                }
                res.ram = !isNaN(ramSize) ? ramSize : undefined;
            } catch (error) {
                GlobalEvent.emit('msg', ExceptionToMessage(error, 'Hidden'));
            }

            return res;
        }

        return undefined;
    }

    protected preHandleOptions(options: BuilderOptions) {

        const config = this.project.GetConfiguration<ArmBaseCompileData>().config;
        const toolchain = this.project.getToolchain();
        const settingManager = SettingManager.GetInstance();

        if (!options.global)
            options.global = Object.create(null);

        /**
         * xxx.model.json 中的 cpu id 历史格式：
         *      <cortex_name>-[fp/dp type]
         * 
         * 通过在 xxx.model.json 中增加一些带有 -sp 或者 -dp 后缀的条目来增加 fpu 支持, 就像下面这样：
         *      "armv8-m.main"   : "-mfpu=none",
         *      "armv8-m.main-sp": "-mfpu=fpv5-sp-d16",
         *      "armv8-m.main-dp": "-mfpu=fpv5-d16"
         * 
         * unify_builder 会根据这些条目来匹配 options.global['microcontroller-cpu'] 传入的 cpu_id, 然后生成对应的编译参数
         */
        const cpu_id = config.compileConfig.cpuType.toLowerCase();
        let fpu_suffix = ARMCodeBuilder.getFpuSuffix(config.compileConfig.cpuType, 
            config.compileConfig.floatingPointHardware);

        /**
         * 对于 GCC 当使用 march 代替 mcpu 时，则无需指定 mfpu，
         * 而是通过添加 +<扩展名> 来增加扩展功能，因此清除 fpu_suffix
        */
        if (toolchain.name == 'GCC' && ArmCpuUtils.isArmArchName(cpu_id)) {
            fpu_suffix = '';
        }

        options.global['microcontroller-cpu']   = cpu_id + fpu_suffix;
        options.global['microcontroller-fpu']   = cpu_id + fpu_suffix;
        options.global['microcontroller-float'] = cpu_id + fpu_suffix;

        // 遗留参数，后面可能删除
        options.global['target'] = cpu_id + fpu_suffix;

        // arch extensions
        if (ArmCpuUtils.isArmArchName(cpu_id)) {
            const opts = config.compileConfig.archExtensions.split(',');
            // for gcc
            if (isGccFamilyToolchain(toolchain.name)) {
                options.global['$arch-extensions'] = opts.join('');
            }
            // for armcc
            else if (toolchain.name == 'AC6') {
                options.global['$clang-arch-extensions']   = opts.join('');
                // 对于 linker 和 asm, 我们要将 '+' 替换成 '.' 字符
                options.global['$armlink-arch-extensions'] = opts.map(v => v.replace('+', '.')).join('');
            }
        }

        if (!options['linker']) {
            options.linker = Object.create(null);
        }

        const ldFileList: string[] = [];

        let scatterFilePath: string = config.compileConfig.scatterFilePath;

        switch (toolchain.name) {

            // 'armcc' can select whether use custom linker file
            case 'AC5':
            case 'AC6':
                {
                    if (config.compileConfig.useCustomScatterFile) { // use custom linker script files
                        scatterFilePath.split(',')
                            .filter(s => s.trim() != '')
                            .forEach((sctPath) => {
                                ldFileList.push(this.convLinkerScriptPathForCompiler(sctPath));
                            });
                    } else { // auto generate scatter file
                        const sctPath = this.GenMemScatterFile(config).path;
                        ldFileList.push(this.convLinkerScriptPathForCompiler(sctPath));
                    }
                }
                break;

            // arm gcc
            case 'GCC':
                {
                    scatterFilePath.split(',')
                        .filter(s => s.trim() != '')
                        .forEach((sctPath) => {
                            ldFileList.push(this.convLinkerScriptPathForCompiler(sctPath));
                        });
                }
                break;

            // iar
            case 'IAR_ARM':
                {
                    scatterFilePath.split(',')
                        .filter(s => s.trim() != '')
                        .forEach((sctPath) => {
                            ldFileList.push(this.convLinkerScriptPathForCompiler(sctPath));
                        });
                }
                break;
            default:
                break;
        }

        // set linker script
        options.linker['link-scatter'] = ldFileList;

        // for armcc
        if (['AC5', 'AC6'].includes(toolchain.name)) {

            // if no scatter, will use X/O Base, R/O Base options
            if (ldFileList.length == 0) {

                let xo_base = options.linker['xo-base']?.trim();
                let ro_base = options.linker['ro-base']?.trim();
                let rw_base = options.linker['rw-base']?.trim();

                let ld_flag: string[] = [];

                if (xo_base) ld_flag.push(`--xo-base ${xo_base}`);
                if (ro_base) ld_flag.push(`--ro-base ${ro_base} --entry ${ro_base}`);
                if (rw_base) ld_flag.push(`--rw-base ${rw_base}`);

                ld_flag.push('--entry Reset_Handler', '--first __Vectors');

                options.linker['misc-controls'] = ld_flag.join(' ') + ' ' + (options.linker['misc-controls'] || '');
            }
        }

        if (options.afterBuildTasks === undefined) {
            options.afterBuildTasks = [];
        }

        if (options['linker']['output-format'] !== 'lib') {

            const extraCommands: any[] = [];

            // convert axf to elf
            // why we need this ? see: https://stackoverflow.com/questions/49508277/warning-loadable-section-my-section-outside-of-elf-segments
            if (['AC5', 'AC6'].includes(config.toolchain) &&
                settingManager.IsConvertAxf2Elf() &&
                options['linker']['$disableOutputTask'] != true) {

                const tool_root_folder = this.project.getToolchainLocation().path;
                const ouput_path = `\${outDir}${File.sep}${config.name}`;
                const axf2elf_log = `\${outDir}${File.sep}axf2elf.log`;

                extraCommands.push({
                    name: 'axf to elf',
                    command: `axf2elf -d "${tool_root_folder}" -i "${ouput_path}.axf" -o "${ouput_path}.elf" > "${axf2elf_log}"`
                });
            }

            // insert command lines
            if (settingManager.isInsertCommandsAtBegin()) {
                options.afterBuildTasks = extraCommands.concat(options.afterBuildTasks);
            } else {
                options.afterBuildTasks = options.afterBuildTasks.concat(extraCommands);
            }
        }
    }
}

class RiscvCodeBuilder extends CodeBuilder {

    protected getMcuMemorySize(): MemorySize | undefined {
        return undefined;
    }

    protected preHandleOptions(options: BuilderOptions) {

        const config = this.project.GetConfiguration<RiscvCompileData>().config;

        const ldFileList: string[] = [];
        config.compileConfig.linkerScriptPath.split(',')
            .filter(s => s.trim() != '')
            .forEach((sctPath) => {
                ldFileList.push(this.convLinkerScriptPathForCompiler(sctPath));
            });

        if (!options['linker']) {
            options.linker = Object.create(null);
        }

        // set linker script
        options.linker['linker-script'] = ldFileList;
    }
}

class MipsCodeBuilder extends CodeBuilder {

    protected getMcuMemorySize(): MemorySize | undefined {
        return undefined;
    }

    protected preHandleOptions(options: BuilderOptions) {

        const config = this.project.GetConfiguration<MipsCompileData>().config;

        const ldFileList: string[] = [];
        config.compileConfig.linkerScriptPath.split(',')
            .filter(s => s.trim() != '')
            .forEach((sctPath) => {
                ldFileList.push(this.convLinkerScriptPathForCompiler(sctPath));
            });

        if (!options['linker']) {
            options.linker = Object.create(null);
        }

        // set linker script
        options.linker['linker-script'] = ldFileList;
    }
}

class AnyGccCodeBuilder extends CodeBuilder {

    protected getMcuMemorySize(): MemorySize | undefined {
        return undefined;
    }

    protected preHandleOptions(options: BuilderOptions) {

        const config = this.project.GetConfiguration<AnyGccCompileData>().config;

        if (!options['linker']) {
            options.linker = Object.create(null);
        }

        // set linker script
        options.linker['linker-script'] = config.compileConfig.linkerScriptPath.split(',')
            .filter(s => s.trim() != '')
            .map((sctPath) => {
                return this.convLinkerScriptPathForCompiler(sctPath);
            });
    }
}

interface AreaSectorInfo {
    StartAddr: number;
    Size: number;
}

interface Stm8DeviceAreaInfo {
    AreaName: string;
    MemType: string;
    SectorList: AreaSectorInfo[];
    ProtectList: string[];
    IsErasableArea: boolean;
}

class C51CodeBuilder extends CodeBuilder {

    protected getMcuMemorySize(): MemorySize | undefined {

        if (this.project.getUploaderType() == 'STVP') {
            try {
                const model = <STVPFlasherOptions>this.project.GetConfiguration().uploadConfigModel.data;
                const stvp_utils = ResManager.GetInstance().getStvpUtilExe().path;
                const t = child_process.execFileSync(stvp_utils, ['query', '--list-area', model.deviceName]).toString();
                const a = JSON.parse(t);
                if (!Array.isArray(a)) return undefined;
                const areaLi: Stm8DeviceAreaInfo[] = <Stm8DeviceAreaInfo[]>a;
                const memSize: MemorySize = { ram: 0, rom: 0 };
                areaLi.forEach(area => {
                    if (area.AreaName == "RamExec") {
                        area.SectorList.forEach(s => (<number>memSize.ram) += s.Size);
                    } else if (area.AreaName == "PROGRAM MEMORY") {
                        area.SectorList.forEach(s => (<number>memSize.rom) += s.Size);
                    }
                });
                return memSize;
            } catch (error) { GlobalEvent.emit('msg', ExceptionToMessage(error, 'Hidden')); }
        }

        return undefined;
    }

    protected preHandleOptions(options: BuilderOptions) {

        const config = this.project.GetConfiguration<C51BaseCompileData>().config;
        const toolchain = this.project.getToolchain();

        /* set linker script if it's existed */
        if (config.compileConfig.linkerScript) {

            const ldFileList: string[] = [];

            config.compileConfig.linkerScript.split(',')
                .filter(s => s.trim() != '')
                .forEach((sctPath) => {
                    ldFileList.push(this.convLinkerScriptPathForCompiler(sctPath, true));
                });

            if (!options['linker']) {
                options.linker = Object.create(null);
            }

            switch (toolchain.name) {
                // cosmic
                case 'COSMIC_STM8':
                    options.linker['linker-script'] = ldFileList;
                    break;
                default:
                    break;
            }
        }
    }
}
