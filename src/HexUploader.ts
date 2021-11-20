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

import { AbstractProject } from "./EIDEProject";
import { ResManager } from "./ResManager";
import { File } from "../lib/node-utility/File";
import { GlobalEvent } from "./GlobalEvents";
import { SettingManager } from "./SettingManager";
import { CmdLineHandler } from "./CmdLineHandler";
import { gotoSet_text, view_str$download_software } from "./StringTable";
import { CodeConverter } from "./CodeConverter";
import { ToolchainName } from "./ToolchainManager";
import { runShellCommand } from './utility';
import { WorkspaceManager } from "./WorkspaceManager";

import * as vscode from "vscode";
import * as NodePath from 'path';
import * as os from "os";
import * as fs from 'fs';
import * as utility from './utility';
import * as ini from 'ini';
import { ResInstaller } from "./ResInstaller";

let _mInstance: HexUploaderManager | undefined;

export type HexUploaderType = 'JLink' | 'STVP' | 'STLink' | 'stcgal' | 'pyOCD' | 'OpenOCD' | 'Custom';

export interface UploadOption {
    bin: string;
}

export interface HexUploaderInfo {
    label?: string;
    type: HexUploaderType;
    description?: string;
    filters?: ToolchainName[]; // if undefined, not have filter
}

export class HexUploaderManager {

    private uploaderList: HexUploaderInfo[] = [
        { type: 'JLink', description: 'for Cortex-M chips, only JLink interface', filters: ['AC5', 'AC6', 'GCC', 'RISCV_GCC'] },
        { type: 'STLink', description: 'for STM32 chips, only STLink interface', filters: ['AC5', 'AC6', 'GCC'] },
        { type: 'pyOCD', description: 'for Cortex-M chips', filters: ['AC5', 'AC6', 'GCC', 'RISCV_GCC'] },
        { type: 'OpenOCD', description: 'for Cortex-M chips', filters: ['AC5', 'AC6', 'GCC', 'RISCV_GCC'] },
        { type: 'stcgal', description: 'for STC chips', filters: ['Keil_C51', 'SDCC'] },
        { type: 'STVP', description: 'for STM8 chips, only STLink interface', filters: ['IAR_STM8', 'SDCC'] },
        { type: 'Custom', label: 'Shell', description: 'download program by custom shell command' }
    ];

    private constructor() {
    }

    getUploaderLabelByName(uploaderName: HexUploaderType): string {

        const index = this.uploaderList.findIndex((info) => {
            return info.type == uploaderName;
        });

        if (index != -1) {
            return this.uploaderList[index].label || uploaderName;
        }

        return uploaderName;
    }

    getUploaderList(toolType: ToolchainName): HexUploaderInfo[] {
        return this.uploaderList.filter((info) => {
            return info.filters ? info.filters.includes(toolType) : true;
        });
    }

    createUploader(prj: AbstractProject): HexUploader<any> {
        switch (prj.GetConfiguration().config.uploader) {
            case 'JLink':
                return new JLinkUploader(prj);
            case 'STLink':
                return new STLinkUploader(prj);
            case 'stcgal':
                return new StcgalUploader(prj);
            case 'STVP':
                return new STVPHexUploader(prj);
            case 'pyOCD':
                return new PyOCDUploader(prj);
            case 'OpenOCD':
                return new OpenOCDUploader(prj);
            case 'Custom':
                return new CustomUploader(prj);
            default:
                throw new Error('Invalid uploader type !');
        }
    }

    static getInstance(): HexUploaderManager {
        if (_mInstance === undefined) {
            _mInstance = new HexUploaderManager();
        }
        return _mInstance;
    }
}

//------------------------------------------------------

interface UploaderPreData<T> {
    isOk: boolean | Error;
    params?: T;
}

export abstract class HexUploader<InvokeParamsType> {

    abstract readonly toolType: HexUploaderType;

    protected project: AbstractProject;
    protected shellPath: string | undefined;
    protected isPowershell: boolean;

    constructor(prj: AbstractProject) {
        this.project = prj;
        this.shellPath = ResManager.checkWindowsShell() ? undefined : ResManager.GetInstance().getCMDPath();
        this.isPowershell = /powershell.exe$/i.test(vscode.env.shell);
    }

    async upload() {

        const dat = await this._prepare();

        if (dat.isOk === false) { // canceled
            return;
        }

        else if (dat.isOk instanceof Error) { // has a error
            throw dat.isOk;
        }

        // start program
        this._launch(dat.params);
    }

    protected getUploadOptions<T extends UploadOption>(): T {
        const option: T = JSON.parse(JSON.stringify(this.project.GetConfiguration().uploadConfigModel.data));
        option.bin = this.project.ToAbsolutePath(option.bin);
        return option;
    }

    protected toAbsolute(_path: string): File {
        const nomalPath = NodePath.normalize(_path);
        const file = NodePath.isAbsolute(nomalPath) ?
            new File(nomalPath) : File.fromArray([this.project.GetRootDir().path, nomalPath]);
        return file;
    }

    protected abstract _prepare(): Promise<UploaderPreData<InvokeParamsType>>;

    protected abstract _launch(params: InvokeParamsType | undefined): void;
}

//======================== uploader implement ==============================

/**
 * jlink programer
*/
export enum ProtocolType {
    JTAG = 0,
    SWD = 1,
    FINE = 3,
    cJTAG = 7
}

export interface CPUInfo {
    vendor: string;
    cpuName: string;
}

export interface JLinkOptions extends UploadOption {

    baseAddr?: string;

    cpuInfo: CPUInfo;

    proType: ProtocolType;

    speed?: number;

    otherCmds: string;
}

class JLinkUploader extends HexUploader<any> {

    toolType: HexUploaderType = 'JLink';

    protected async _prepare(): Promise<UploaderPreData<string[]>> {

        if (!new File(SettingManager.GetInstance().getJlinkDir()).IsDir()) {
            await ResInstaller.instance().setOrInstallTools(this.toolType, `Not found 'JLink' install directory !`);
            return { isOk: false };
        }

        const option = this.getUploadOptions<JLinkOptions>();

        // create output dir
        const outFolder = new File(this.project.ToAbsolutePath(this.project.getOutputDir()));
        outFolder.CreateDir(true);

        // clear base addr for hex file
        if (/\.hex$/i.test(option.bin)) {
            option.baseAddr = undefined;
        }

        const jlinkCommandsFile = File.fromArray([outFolder.path, 'commands.jlink']);
        const jlinkCmdFileLines: string[] = [
            'r',
            'halt',
            `loadfile "${option.bin}"${option.baseAddr ? (`,${option.baseAddr}`) : ''}`,
            'r',
            'go',
            'exit'
        ];

        const codeConverter = new CodeConverter();
        const codePage = ResManager.getLocalCodePage();
        const content = jlinkCmdFileLines.join(os.EOL);

        // write commands file
        if (codePage && codeConverter.ExistCode(codePage)) {
            fs.writeFileSync(jlinkCommandsFile.path, codeConverter.toTargetCode(content, codePage));
        } else {
            jlinkCommandsFile.Write(content);
        }

        // -AutoConnect 1 -Device <DevName> -If <Interface> -Speed <value> -CommandFile <file>
        const cmdList: string[] = [
            '-ExitOnError', '1',
            '-AutoConnect', '1',
            '-Device', option.cpuInfo.cpuName,
            '-If', ProtocolType[option.proType],
            '-Speed', `${option.speed || 4000}`,
            '-CommandFile', jlinkCommandsFile.path
        ];

        if ([ProtocolType.JTAG, ProtocolType.cJTAG].includes(option.proType)) {
            cmdList.push('-JTAGConf', '-1,-1');
        }

        return {
            isOk: true,
            params: cmdList
        };
    }

    protected _launch(commandLines: string[]): void {
        const jlinkPath = `${SettingManager.GetInstance().getJlinkDir()}${NodePath.sep}JLink.exe`;
        const option = this.getUploadOptions<JLinkOptions>();
        const commandLine = CmdLineHandler.getCommandLine(jlinkPath, commandLines, this.isPowershell);
        runShellCommand(this.toolType, `${commandLine} ${option.otherCmds || ''}`, this.shellPath);
    }
}

/**
 * stcgal programer
*/
export interface C51FlashOption extends UploadOption {
    eepromImgPath: string;
    options: string;
}

class StcgalUploader extends HexUploader<string[]> {

    toolType: HexUploaderType = 'stcgal';

    static readonly optionKeyMap: { [key: string]: string } = {
        'device': '-P',
        'port': '-p',
        'baudrate': '-b',
        'oscFreq': '-t',
        'handshakeBaudrate': '-l',
        'option': '-o'
    };

    constructor(prj: AbstractProject) {
        super(prj);
    }

    protected async _prepare(): Promise<UploaderPreData<string[]>> {

        const resManager = ResManager.GetInstance();

        let portList: string[];
        try {
            portList = resManager.enumSerialPort();
        } catch (error) {
            GlobalEvent.emit('error', error);
            return { isOk: false };
        }

        if (portList.length === 0) {
            vscode.window.showWarningMessage('Not found any serialport !');
            return { isOk: false };
        }

        let option: any = Object.create(null);

        const opFile = new File(this.project.ToAbsolutePath(this.getUploadOptions<C51FlashOption>().options));
        if (opFile.IsFile()) {
            try {
                option = JSON.parse(opFile.Read());
            } catch (error) {
                GlobalEvent.emit('msg', {
                    type: 'Warning',
                    contentType: 'string',
                    content: 'Invalid flash option file !'
                });
            }
        }

        // not found port OR invalid port
        if (!option['port'] || !portList.includes(option['port'])) {
            if (portList.length > 1) {
                const port = await vscode.window.showQuickPick(portList, {
                    placeHolder: 'select a serialport to connect',
                    canPickMany: false
                });
                if (!port) {
                    return { isOk: false };
                }
                option['port'] = port;
            } else {
                option['port'] = portList[0];
            }
        }

        const commands: string[] = [];

        for (const key in option) {

            if (typeof option[key] === 'number') {
                option[key] = (<number>option[key]).toString();
            }

            if (option[key] !== '') {
                if (key === 'option') {
                    if (typeof option[key] === 'object') {
                        const devOption = option[key];
                        for (const key in devOption) {
                            if (typeof devOption[key] === 'number') {
                                devOption[key] = (<number>devOption[key]).toString();
                            }
                            if (devOption[key] !== '') {
                                commands.push('-o ' + key + '=' + devOption[key]);
                            }
                        }
                    }
                } else if (StcgalUploader.optionKeyMap[key]) {
                    commands.push(StcgalUploader.optionKeyMap[key] + ' ' + option[key]);
                }
            }
        }

        return {
            isOk: true,
            params: commands
        };
    }

    protected _launch(commands: string[]): void {

        const option = this.getUploadOptions<C51FlashOption>();

        commands.push('"' + option.bin + '"');

        const eepromFile = this.toAbsolute(option.eepromImgPath);
        if (eepromFile.IsFile()) {
            commands.push('"' + eepromFile.path + '"');
        }

        // run
        runShellCommand(this.toolType, 'python -m stcgal -a ' + commands.join(' '), ResManager.GetInstance().getCMDPath());
    }
}

/**
 * STLink programer
*/
export type STLinkProtocolType = 'SWD' | 'JTAG';

export interface STLinkOptions extends UploadOption {

    proType: STLinkProtocolType;

    address: string;

    resetMode: string;

    runAfterProgram: boolean;

    speed: number;

    elFile: string; /* external loader file */

    optionBytes: string; /* option bytes file */

    otherCmds: string;
}

class STLinkUploader extends HexUploader<string[]> {

    toolType: HexUploaderType = 'STLink';

    constructor(prj: AbstractProject) {
        super(prj);
    }

    private genCommandForStlinkCli(exe: File): string[] {

        const commands: string[] = [];
        const options = this.getUploadOptions<STLinkOptions>();

        /* connection commands */
        commands.push(
            '-c', options.proType, `FREQ=${options.speed.toString()}`, 'UR'
        );

        /* reset mode */
        if (options.resetMode && options.resetMode != 'default') {
            const optMap: any = { 'SWrst': 'Srst', 'HWrst': 'Hrst' };
            commands.push(optMap[options.resetMode] || options.resetMode);
        }

        /* flash commands */
        commands.push(
            '-P', options.bin
        );

        if (/\.bin$/i.test(options.bin)) {
            commands.push(options.address || '0x08000000');
        }

        if (/\.stldr$/i.test(options.elFile)) {
            const elFolder = File.fromArray([NodePath.dirname(exe.path), 'ExternalLoader']);
            commands.push('-EL', options.elFile.replace('<stlink>', elFolder.path));
        }

        // option bytes commands
        const optionFile = new File(this.project.ToAbsolutePath(options.optionBytes));
        if (optionFile.IsFile()) {
            const conf = <any>ini.parse(optionFile.Read());
            const confList: string[] = [];
            for (const key in conf) { confList.push(`${key}=${conf[key]}`) }
            if (confList.length > 0) {
                commands.push('-OB');
                confList.forEach((val) => { commands.push(val) });
                commands.push('-rOB');
            }
        }

        commands.push(
            '-V', 'after_programming'
        );

        /* misc commands */
        commands.push(
            '-NoPrompt',
            '-TVolt'
        );

        if (options.runAfterProgram) {
            commands.push('-Run');
        }

        return commands;
    }

    private genCommandForCubeProgramer(exe: File): string[] {

        const commands: string[] = [];
        const options = this.getUploadOptions<STLinkOptions>();

        /* connect cmd */
        commands.push('-c', `port=${options.proType}`, `freq=${options.speed}`);

        /* reset mode */
        if (options.resetMode && options.resetMode != 'default') {
            commands.push(`reset=${options.resetMode}`);
        }

        /* external loader */
        if (/\.stldr$/i.test(options.elFile)) {
            const elFolder = File.fromArray([NodePath.dirname(exe.path), 'ExternalLoader']);
            commands.push('-el', options.elFile.replace('<stlink>', elFolder.path));
        }

        // option bytes commands
        const optionFile = new File(this.project.ToAbsolutePath(options.optionBytes));
        if (optionFile.IsFile()) {
            const conf = <any>ini.parse(optionFile.Read());
            const confList: string[] = [];
            for (const key in conf) { confList.push(`${key}=${conf[key]}`) }
            if (confList.length > 0) {
                commands.push('-ob');
                confList.forEach((val) => { commands.push(val) });
                commands.push('-ob', 'displ');
            }
        }

        /* download program */
        commands.push('--download', options.bin);

        if (/\.bin$/i.test(options.bin)) {
            commands.push(options.address || '0x08000000');
        }

        /* verify program */
        commands.push('-v');

        if (options.runAfterProgram) { commands.push('--go') }

        return commands;
    }

    protected async _prepare(): Promise<UploaderPreData<string[]>> {

        const exe = new File(SettingManager.GetInstance().getSTLinkExePath());
        if (!exe.IsFile()) {
            await ResInstaller.instance().setOrInstallTools(this.toolType, `Not found 'ST-LINK_CLI.exe' or 'STM32_Programmer_CLI.exe' !`);
            return { isOk: false };
        }

        let commands: string[];

        /* use stlink cli */
        if (exe.noSuffixName.toLowerCase().startsWith('st-link_cli')) {
            commands = this.genCommandForStlinkCli(exe);
        }

        /* use cube programer */
        else {
            commands = this.genCommandForCubeProgramer(exe);
        }

        return {
            isOk: true,
            params: commands
        };
    }

    protected _launch(commands: string[]): void {

        const commandLine = CmdLineHandler.getCommandLine(
            SettingManager.GetInstance().getSTLinkExePath(), commands, this.isPowershell
        );

        const options = this.getUploadOptions<STLinkOptions>();

        // run
        runShellCommand(this.toolType, `${commandLine} ${options.otherCmds || ''}`, this.shellPath);
    }
}

/**
 * STVP programer
*/
export interface STVPFlasherOptions extends UploadOption {

    deviceName: string;

    eepromFile: string;

    optionByteFile: string;
}

class STVPHexUploader extends HexUploader<string[]> {

    toolType: HexUploaderType = 'STVP';

    constructor(prj: AbstractProject) {
        super(prj);
    }

    protected async _prepare(): Promise<UploaderPreData<string[]>> {

        const exe = new File(SettingManager.GetInstance().getStvpExePath());
        if (!exe.IsFile()) {
            await ResInstaller.instance().setOrInstallTools(this.toolType, `Not found STVP: \'STVP_CmdLine.exe\' !`);
            return { isOk: false };
        }

        const options = this.getUploadOptions<STVPFlasherOptions>();
        const commands: string[] = [];

        // connection commands
        commands.push('-BoardName=ST-LINK');
        commands.push('-Port=USB');
        commands.push('-ProgMode=SWIM');
        commands.push('-Device=' + options.deviceName);

        // misc commands
        commands.push('-no_progress');
        commands.push('-no_loop');
        commands.push('-no_log');

        // not verify
        commands.push('-no_verif');

        const binFile = this.toAbsolute(options.bin);
        if (binFile.IsFile()) {
            commands.push('-FileProg=\"' + binFile.path + '\"');
        } else {
            commands.push('-no_progProg');
        }

        const eepromFile = this.toAbsolute(options.eepromFile);
        if (eepromFile.IsFile()) {
            commands.push('-FileData=\"' + eepromFile.path + '\"');
        } else {
            commands.push('-no_progData');
        }

        const opFile = this.toAbsolute(options.optionByteFile);
        if (opFile.IsFile()) {
            commands.push('-FileOption=\"' + opFile.path + '\"');
        } else {
            commands.push('-no_progOption');
        }

        return {
            isOk: true,
            params: commands
        };
    }

    protected _launch(commands: string[]): void {

        const commandLine = CmdLineHandler.getCommandLine(
            SettingManager.GetInstance().getStvpExePath(), commands, this.isPowershell, true
        );

        // run
        runShellCommand(this.toolType, commandLine, this.shellPath);
    }
}

/**
 * pyOCD programer
*/
export interface PyOCDFlashOptions extends UploadOption {

    targetName: string;

    config?: string;

    speed?: string;

    baseAddr?: string;
}

class PyOCDUploader extends HexUploader<string[]> {

    toolType: HexUploaderType = 'pyOCD';

    protected async _prepare(): Promise<UploaderPreData<string[]>> {

        const commandLines: string[] = [];
        const option = this.getUploadOptions<PyOCDFlashOptions>();

        if (option.config) {
            const confFile = new File(this.project.ToAbsolutePath(option.config));
            if (confFile.IsFile()) {
                commandLines.push('--config');
                commandLines.push(confFile.path);
            }
        }

        if (/\.bin$/i.test(option.bin)) {
            commandLines.push('-a');
            commandLines.push(option.baseAddr || '0x08000000');
        }

        // target name
        commandLines.push('-t');
        commandLines.push(option.targetName);

        // speed
        if (option.speed) {
            commandLines.push('-f');
            commandLines.push(option.speed);
        }

        // file path
        commandLines.push(option.bin);

        return {
            isOk: true,
            params: commandLines
        };
    }

    protected _launch(commands: string[]): void {

        const commandLine: string = 'python -m pyocd flash ' + commands.map((line) => {
            return CmdLineHandler.quoteString(line, '"');
        }).join(' ');

        // run
        runShellCommand(this.toolType, commandLine, ResManager.GetInstance().getCMDPath());
    }
}

/**
 * OpenOCD flasher
*/
export interface OpenOCDFlashOptions extends UploadOption {

    target: string;

    interface: string;

    baseAddr?: string;
}

class OpenOCDUploader extends HexUploader<string[]> {

    toolType: HexUploaderType = 'OpenOCD';

    protected async _prepare(): Promise<UploaderPreData<string[]>> {

        const exe = new File(SettingManager.GetInstance().getOpenOCDExePath());
        if (!exe.IsFile()) {
            await ResInstaller.instance().setOrInstallTools(this.toolType, `Not found \'OpenOCD.exe\' !`);
            return { isOk: false };
        }

        const option = this.getUploadOptions<OpenOCDFlashOptions>();
        const addrStr = /\.bin$/i.test(option.bin) ? (option.baseAddr || '0x08000000') : '';
        const commands: string[] = [];

        const interfaceFileName = option.interface.startsWith('${workspaceFolder}/')
            ? option.interface.replace('${workspaceFolder}/', '') : `interface/${option.interface}`;

        const targetFileName = option.target.startsWith('${workspaceFolder}/')
            ? option.target.replace('${workspaceFolder}/', '') : `target/${option.target}`;

        const wsFolder = WorkspaceManager.getInstance().getWorkspaceRoot();
        if (wsFolder) {
            commands.push(
                `-s "${wsFolder.path}"`
            );
        }

        commands.push(
            `-f ${interfaceFileName}.cfg`,
            `-f ${targetFileName}.cfg`,
            `-c "init"`,
            `-c "reset init"`,
            `-c "program \\"${option.bin.replace(/\\{1,}/g, '/')}\\" ${addrStr} verify reset exit"`
        );

        return {
            isOk: true,
            params: commands
        };
    }

    protected _launch(commands: string[]): void {
        const exePath = SettingManager.GetInstance().getOpenOCDExePath();
        const commandLine = `${CmdLineHandler.quoteString(exePath, '"')} ${commands.join(' ')}`;
        runShellCommand(this.toolType, commandLine, ResManager.GetInstance().getCMDPath());
    }
}
/**
 * Custom flasher
*/
export interface CustomFlashOptions extends UploadOption {
    commandLine: string;
}

class CustomUploader extends HexUploader<string> {

    toolType: HexUploaderType = 'Custom';

    protected async _prepare(): Promise<UploaderPreData<string>> {

        const option = this.getUploadOptions<CustomFlashOptions>();

        if (option.commandLine === undefined) {
            return {
                isOk: new Error('command line can not be empty !')
            };
        }

        const portList = ResManager.GetInstance().enumSerialPort();
        const commandLine = option.commandLine
            .replace(/\$\{hexFile\}|\$\{binFile\}|\$\{programFile\}/ig, option.bin)
            .replace(/\$\{port\}/ig, portList[0] || 'none');

        return {
            isOk: true,
            params: commandLine
        };
    }

    protected _launch(commandLine: string): void {
        runShellCommand(this.toolType, commandLine,
            ResManager.GetInstance().getCMDPath(), this.project.getProjectEnv());
    }
}
