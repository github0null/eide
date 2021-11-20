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
import * as events from 'events';
import * as os from 'os';
import * as ini from 'ini';
import * as NodePath from 'path';

import { File } from '../lib/node-utility/File';
import { GlobalEvent } from './GlobalEvents';
import { ExceptionToMessage } from './Message';
import * as Utility from './utility';
import { find } from './Platform';

export enum CheckStatus {
    All_Verified,
    Section_Failed,
    All_Failed
}

export interface PortSerialOption {
    defaultPort: string;
    baudRate: number;
    dataBits: number;
    parity: number;
    stopBits: number;
    useUnixCRLF: boolean;
}

let _instance: SettingManager | undefined;

export interface INIStatus {
    [name: string]: boolean;
}

function formatPath(path: string): string {
    return path.trim().replace(/\\\s*$/, '');
}

export class SettingManager {

    public static readonly TAG = 'EIDE';

    private _event: events.EventEmitter;
    private pathCache: Map<string, string>;
    private envPathCache: Map<string, string>;
    private eideEnv: Map<string, string>;

    private _checkStatus: INIStatus = {
        'ARM': false,
        'C51': false
    };

    private constructor(context?: vscode.ExtensionContext) {

        this._event = new events.EventEmitter();

        this.pathCache = new Map();
        this.envPathCache = new Map();
        this.eideEnv = new Map();

        if (context == undefined) {
            throw new Error('eide context is undefined !');
        }

        /* add env */
        this.eideEnv.set('${eideRoot}', context.extensionPath);
        this.eideEnv.set('${userRoot}', os.homedir());

        this.refreshMDKStatus();
        this.refreshC51Status();

        vscode.workspace.onDidChangeConfiguration((e) => {

            if (e.affectsConfiguration(SettingManager.TAG)) {

                if (e.affectsConfiguration('EIDE.ARM.INI.Path')) {
                    this.refreshMDKStatus();
                }

                if (e.affectsConfiguration('EIDE.C51.INI.Path')) {
                    this.refreshC51Status();
                }

                this._event.emit('onChanged', e);
            }
        });

        /* compate old version config */
        /* const confMap: any = {
            'JLink.InstallDirectory': 'ARM.JLink.ToolDirectory',
            'OpenOCD.ExePath': 'ARM.OpenOCD.ExePath',
            'STLink.ExePath': 'ARM.StlinkExePath',
        };
        for (const key in confMap) {
            const nowVal = this.getConfiguration().get<string>(key);
            const oldVal = this.getConfiguration().get<string>(confMap[key]);
            if (!nowVal && oldVal) { // not found value, and old value existed, set it
                this.setConfigValue(key, oldVal);
                this.getConfiguration().update(confMap[key], undefined); // clear old value
            }
        } */
    }

    static GetInstance(context?: vscode.ExtensionContext): SettingManager {
        if (_instance === undefined) {
            _instance = new SettingManager(context);
        }
        return _instance;
    }

    on(event: 'onChanged', listener: (e: vscode.ConfigurationChangeEvent) => void): void;
    on(event: any, listener: (arg?: any) => void): void {
        this._event.on(event, listener);
    }

    once(event: 'onChanged', listener: (e: vscode.ConfigurationChangeEvent) => void): void;
    once(event: any, listener: (arg?: any) => void): void {
        this._event.once(event, listener);
    }

    getConfiguration(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration(SettingManager.TAG);
    }

    setConfigValue(key: string, val: any) {
        this.getConfiguration().update(key, val, vscode.ConfigurationTarget.Global);
    }

    replaceEnvVariable(str: string): string {

        this.eideEnv.forEach((value, key) => {
            const regExpr = key.replace('$', '\\$')
                .replace('{', '\\{')
                .replace('}', '\\}');
            str = str.replace(new RegExp(regExpr, 'gi'), value);
        });

        return str;
    }

    /**
     * 800:"workbench.action.openSettings"
     * 801:"workbench.action.openSettings2"
     * 802:"workbench.action.openSettingsJson"
     */
    static async jumpToSettings(name: string) {
        await vscode.commands.executeCommand('workbench.action.openSettings', name);
    }

    //------------------------- env and path --------------------------

    private getExePathFromConfig(confName: string, execName: string): string | undefined {

        const path = this.getConfiguration().get<string>(confName);

        if (path) {
            return Utility.formatPath(this.replaceEnvVariable(path));
        }

        else if (this.envPathCache.has(execName)) {
            return <string>this.envPathCache.get(execName)
        }

        else {
            const absPath = find(execName);
            if (absPath) {
                this.envPathCache.set(execName, absPath);
                return absPath;
            }
        }
    }

    private getGccFolderFromConfig(confName: string, execName: string): string | undefined {

        const path = this.getConfiguration().get<string>(confName);

        if (path) {
            return Utility.formatPath(this.replaceEnvVariable(path));
        }

        else if (this.envPathCache.has(execName)) {
            return <string>this.envPathCache.get(execName);
        }

        else {
            const absPath = find(execName);
            if (absPath) {
                const dirName = NodePath.dirname(NodePath.dirname(absPath));
                this.envPathCache.set(execName, dirName);
                return dirName;
            }
        }
    }

    //-------------------------- Serialport --------------------------------

    isShowSerialportStatusbar(): boolean {
        return this.getConfiguration().get<boolean>('SerialPortMonitor.ShowStatusBar') || false;
    }

    getPortSerialMonitorOptions(): PortSerialOption {
        return {
            defaultPort: this.getConfiguration().get<string>('SerialPortMonitor.DefaultPort') || 'null',
            baudRate: this.getConfiguration().get<number>('SerialPortMonitor.BaudRate') || 9600,
            dataBits: this.getConfiguration().get<number>('SerialPortMonitor.DataBits') || 8,
            parity: this.getConfiguration().get<number>('SerialPortMonitor.Parity') || 0,
            stopBits: this.getConfiguration().get<number>('SerialPortMonitor.StopBits') || 0,
            useUnixCRLF: this.getConfiguration().get<boolean>('SerialPortMonitor.useUnixLF') || false,
        };
    }

    getSerialBaudrate(): number {
        return this.getConfiguration().get<number>('SerialPortMonitor.BaudRate') || 115200
    }

    setSerialBaudrate(baudrate: number, toGlobal?: boolean) {
        return this.getConfiguration().update('SerialPortMonitor.BaudRate', baudrate, toGlobal);
    }

    //--------------------- Global Option ------------------------

    isDisplaySourceRefs(): boolean {
        return this.getConfiguration().get<boolean>('Option.ShowSourceReferences') || false;
    }

    isGenerateMakefileParams(): boolean {
        return this.getConfiguration().get<boolean>('Builder.GenerateMakefileParameters') || false;
    }

    isPrintRelativePathWhenBuild(): boolean {
        return this.getConfiguration().get<boolean>('Option.PrintRelativePathWhenBuild') || false;
    }

    getGithubRepositoryUrl(): string {
        return (this.getConfiguration().get<string>('Template.Repository.Url') || 'null')
            .trim().replace(/^https:\/\//i, '');
    }

    isUseGithubProxy(): boolean {
        return this.getConfiguration().get<boolean>('Template.Repository.UseProxy') || false;
    }

    isUseTaskToBuild(): boolean {
        return this.getConfiguration().get<boolean>('Option.UseTaskToBuild') || false;
    }

    getINIStatus(): INIStatus {
        return JSON.parse(JSON.stringify(this._checkStatus));
    }

    isInsertCommandsAtBegin(): boolean {
        return this.getConfiguration().get<boolean>('Option.InsertExtraCommandsAtBegin') || false;
    }

    getCppcheckerExe(): string | undefined {
        return this.getExePathFromConfig('Cppcheck.ExecutablePath', 'cppcheck');
    }

    //----------------------------- Flasher --------------------------------

    getJlinkDir(): string {

        const path = this.getConfiguration().get<string>('JLink.InstallDirectory');
        const execName = 'JLink';

        if (path) {
            return Utility.formatPath(this.replaceEnvVariable(path));
        }

        else if (this.envPathCache.has(execName)) {
            return <string>this.envPathCache.get(execName)
        }

        else {
            const absPath = find(execName);
            if (absPath) {
                const dirName = NodePath.dirname(absPath);
                this.envPathCache.set(execName, dirName);
                return dirName;
            }
            return 'null';
        }
    }

    getJlinkDevXmlFile(): File | undefined {
        const path = this.getConfiguration().get<string>('JLink.DeviceXmlPath');
        if (path) {
            const file = new File(path);
            if (file.IsFile()) {
                return file;
            }
        }
    }

    getStvpExePath(): string {
        return this.replaceEnvVariable(
            this.getExePathFromConfig('STM8.STVP.CliExePath', 'STVP_CmdLine') || 'null'
        );
    }

    getSTLinkExePath(): string {

        const flasher =
            this.getExePathFromConfig('STLink.ExePath', 'STM32_Programmer_CLI') ||
            this.getExePathFromConfig('STLink.ExePath', 'ST-LINK_CLI');

        return this.replaceEnvVariable(flasher || 'null');
    }

    getOpenOCDExePath(): string {
        return this.replaceEnvVariable(
            this.getExePathFromConfig('OpenOCD.ExePath', 'openocd') || 'null'
        );
    }

    //-----------------------------IAR-------------------------------

    getIARForStm8Dir(): File {

        const path = this.getConfiguration().get<string>('IAR.STM8.InstallDirectory');
        const execName = 'iccstm8';

        if (path) {
            return new File(Utility.formatPath(this.replaceEnvVariable(path)));
        }

        else if (this.envPathCache.has(execName)) {
            return new File(<string>this.envPathCache.get(execName))
        }

        else {
            const absPath = find(execName);
            if (absPath) {
                const dirName = NodePath.dirname(NodePath.dirname(NodePath.dirname(absPath)));
                this.envPathCache.set(execName, dirName);
                return new File(dirName);
            }
            return new File('null');
        }
    }

    //---------------------------- ARM ----------------------------

    isUseMultithreadMode(): boolean {
        return this.getConfiguration().get<number>('Builder.ThreadNumber') != 1;
    }

    getThreadNumber(): number {
        const num = this.getConfiguration().get<number>('Builder.ThreadNumber') || -1;
        if (num <= 0) { return os.cpus().length; }
        return num;
    }

    IsConvertAxf2Elf(): boolean {
        return this.getConfiguration().get<boolean>('ARM.Option.AxfToElf') || false;
    }

    IsAutoGenerateRTEHeader(): boolean {
        return this.getConfiguration().get<boolean>('ARM.Option.AutoGenerateRTE_Components') || false;
    }

    getGCCPrefix(): string {
        return this.getConfiguration().get<string>('ARM.GCC.Prefix') || '';
    }

    getGCCDir(): File {
        const execName = `${this.getGCCPrefix()}gcc`;
        return new File(this.getGccFolderFromConfig('ARM.GCC.InstallDirectory', execName) || 'null');
    }

    SetARMINIPath(path: string) {
        this.setConfigValue('ARM.INI.Path', path);
    }

    private GetARMINIFile(): File {
        const iniPath = this.getConfiguration().get<string>('ARM.INI.Path') || '';
        return new File(Utility.formatPath(iniPath));
    }

    GetMdkDir(): File {
        return new File(this.pathCache.get('MDK') || 'null');
    }

    private refreshMDKStatus(): void {

        /* parse from env */
        if (process.env && process.env['Keil_Root']) {
            const rootFolder = Utility.formatPath(process.env['Keil_Root']);
            const armFolder = File.fromArray([rootFolder, 'ARM']);
            if (armFolder.IsDir() &&
                File.fromArray([armFolder.path, 'ARMCC']).IsDir()) {
                this.pathCache.set('MDK', armFolder.path);
                this._checkStatus['ARM'] = true;
                return; /* found it, exit */
            }
        }

        /* parse from ini file */
        const iniFile = this.GetARMINIFile();
        if (iniFile.IsFile()) {
            try {
                const iniData = ini.parse(iniFile.Read());

                // check ini file fields
                if (iniData["ARM"] && iniData["ARM"]["PATH"]) {
                    const binDir = new File(formatPath((<string>iniData["ARM"]["PATH"]).replace(/"/g, '')));
                    // update and check
                    this.pathCache.set('MDK', binDir.path);
                    const cDir = File.fromArray([binDir.path, 'ARMCC']);
                    if (!cDir.IsDir()) { throw new Error('Not found folder, [path]: ' + cDir.path); }
                    this._checkStatus['ARM'] = true;
                    return; // mdk path is valid, return it
                }

                // invalid ini file
                else {
                    this.pathCache.delete('MDK');
                    throw new Error('Invalid ARM INI file, [path] : ' + iniFile.path);
                }
            } catch (error) {
                GlobalEvent.emit('globalLog', ExceptionToMessage(error, 'Hidden'));
            }
        }

        this._checkStatus['ARM'] = false;
    }

    //------------------------------- SDCC --------------------------------

    getSdccDir(): File {
        return new File(this.getGccFolderFromConfig('SDCC.InstallDirectory', 'sdcc') || 'null');
    }

    getGnuSdccStm8Dir(): File {
        return new File(this.getGccFolderFromConfig('STM8.GNU-SDCC.InstallDirectory', 'stm8-as') || 'null');
    }

    //------------------------------- RISC-V ----------------------------------

    getRiscvToolFolder(): File {
        const execName = `${this.getRiscvToolPrefix()}gcc`;
        return new File(this.getGccFolderFromConfig('RISCV.InstallDirectory', execName) || 'null');
    }

    getRiscvToolPrefix(): string {
        return this.getConfiguration().get<string>('RISCV.ToolPrefix') || '';
    }

    //------------------------------- C51 ----------------------------------

    SetC51INIPath(path: string) {
        this.setConfigValue('C51.INI.Path', path);
    }

    private GetC51INIFile(): File {
        const iniPath = this.getConfiguration().get<string>('C51.INI.Path') || '';
        return new File(Utility.formatPath(iniPath));
    }

    GetC51Dir(): File {
        return new File(this.pathCache.get('C51') || 'null');
    }

    private refreshC51Status(): void {

        /* parse from env */
        if (process.env && process.env['Keil_Root']) {
            const rootFolder = Utility.formatPath(process.env['Keil_Root']);
            const c51Folder = File.fromArray([rootFolder, 'C51']);
            if (c51Folder.IsDir() &&
                File.fromArray([c51Folder.path, 'BIN']).IsDir()) {
                this.pathCache.set('C51', c51Folder.path);
                this._checkStatus['C51'] = true;
                return; /* found it, exit */
            }
        }

        /* parse from ini file */
        const iniFile = this.GetC51INIFile();
        if (iniFile.IsFile()) {
            try {
                const iniData = ini.parse(iniFile.Read());

                // check ini file fields
                if (iniData["C51"] && iniData["C51"]["PATH"]) {
                    const binDir = new File(formatPath((<string>iniData["C51"]["PATH"]).replace(/"/g, '')));
                    // update and check
                    this.pathCache.set('C51', binDir.path);
                    const cDir = File.fromArray([binDir.path, 'BIN']);
                    if (!cDir.IsDir()) { throw new Error('Not found folder, [path]: ' + cDir.path); }
                    this._checkStatus['C51'] = true;
                    return; // keil c51 path is valid, return it
                }

                // invalid ini file
                else {
                    this.pathCache.delete('C51');
                    throw new Error('Invalid C51 INI file, [path] : ' + iniFile.path);
                }
            } catch (error) {
                GlobalEvent.emit('globalLog', ExceptionToMessage(error, 'Hidden'));
            }
        }

        this._checkStatus['C51'] = false;
    }
}