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
import { WorkspaceManager } from './WorkspaceManager';

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

interface INIStatus {
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
        'MDK': false,
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

    private toFullPathForSettings(path_: string): string {

        const wsRoot = WorkspaceManager.getInstance().getWorkspaceRoot();

        if (wsRoot && !this.eideEnv.has('${workspaceFolder}')) {
            this.eideEnv.set('${workspaceFolder}', wsRoot.path);
        }

        this.eideEnv.forEach((value, key) => {
            const regExpr = key.replace('$', '\\$')
                .replace('{', '\\{')
                .replace('}', '\\}');
            path_ = path_.replace(new RegExp(regExpr, 'gi'), value);
        });

        if (!NodePath.isAbsolute(path_) && wsRoot) {
            path_ = wsRoot.path + File.sep + path_;
        }

        return path_;
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

        let defPath: string | undefined;

        const path = this.getConfiguration().get<string>(confName);
        if (path) {
            defPath = Utility.formatPath(this.toFullPathForSettings(path));
            if (File.IsExist(defPath)) {
                return defPath;
            }
        }

        if (this.envPathCache.has(execName)) {
            return <string>this.envPathCache.get(execName);
        }

        else {
            const absPath = find(execName);
            if (absPath) {
                this.envPathCache.set(execName, absPath);
                return absPath;
            }
        }

        return defPath;
    }

    private getGccFolderFromConfig(confName: string, execName: string): string | undefined {

        let defPath: string | undefined;

        const path = this.getConfiguration().get<string>(confName);
        if (path) {
            defPath = Utility.formatPath(this.toFullPathForSettings(path));
            if (File.IsExist(defPath)) {
                return defPath;
            }
        }

        if (this.envPathCache.has(execName)) {
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

        return defPath;
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

    /* isEnableAutoUpdateEideBinaries(): boolean {
        return this.getConfiguration().get<boolean>('Option.AutoUpdateEideBinaries') || false;
    } */

    getForceIncludeList(): string[] {
        return this.getConfiguration().get<string[]>('Cpptools.ForceInclude') || [];
    }

    isEnableTelemetry(): boolean {
        return this.getConfiguration().get<boolean>('Option.EnableTelemetry') || false;
    }

    isShowOutputFilesInExplorer(): boolean {
        return true;
    }

    getBuilderAdditionalCommandLine(): string | undefined {
        return this.getConfiguration().get<string>('Builder.AdditionalCommandLine');
    }

    getMapViewParserDepth(): number {
        return this.getConfiguration().get<number>('Option.MapViewParserDepth') || 1;
    }

    isDisplaySourceRefs(): boolean {
        return true;
    }

    isGenerateMakefileParams(): boolean {
        return false;
    }

    isPrintRelativePathWhenBuild(): boolean {
        return true;
    }

    getGithubRepositoryToken(): string | undefined {
        return this.getConfiguration().get<string>('Repository.Template.GithubPersonalToken')?.trim();
    }

    getGithubRepositoryUrl(): string {
        return (this.getConfiguration().get<string>('Repository.Template.Url') || 'null')
            .trim().replace(/^https:\/\//i, '');
    }

    getCmsisPackRepositoryUrl(): string {
        return (this.getConfiguration().get<string>('Repository.CmsisPack.Url') || 'null')
            .trim().replace(/^https:\/\//i, '');
    }

    isUseGithubProxy(): boolean {
        return this.getConfiguration().get<boolean>('Repository.UseProxy') || false;
    }

    isUseTaskToBuild(): boolean {
        return this.getConfiguration().get<boolean>('Option.UseTaskToBuild') || false;
    }

    isKeilC51IniReady(): boolean {
        return this._checkStatus['C51'];
    }

    isMDKIniReady(): boolean {
        return this._checkStatus['MDK'];
    }

    isInsertCommandsAtBegin(): boolean {
        return this.getConfiguration().get<boolean>('Option.InsertExtraCommandsAtBegin') || false;
    }

    getCppcheckerExe(): string | undefined {
        return this.getExePathFromConfig('Cppcheck.ExecutablePath', 'cppcheck');
    }

    //----------------------------- Flasher --------------------------------

    getJlinkDir(): string {

        let defPath: string | undefined;

        const path = this.getConfiguration().get<string>('JLink.InstallDirectory');
        if (path) {
            defPath = Utility.formatPath(this.toFullPathForSettings(path));
            if (File.IsExist(defPath)) {
                return defPath;
            }
        }

        const execName = 'JLink';

        if (this.envPathCache.has(execName)) {
            return <string>this.envPathCache.get(execName)
        }

        else {
            const absPath = find(execName);
            if (absPath) {
                const dirName = NodePath.dirname(absPath);
                this.envPathCache.set(execName, dirName);
                return dirName;
            }
        }

        return defPath || 'null';
    }

    getStvpExePath(): string {
        return this.toFullPathForSettings(
            this.getExePathFromConfig('STM8.STVP.CliExePath', 'STVP_CmdLine') || 'null'
        );
    }

    getSTLinkExePath(): string {

        const flasher =
            this.getExePathFromConfig('STLink.ExePath', 'STM32_Programmer_CLI') ||
            this.getExePathFromConfig('STLink.ExePath', 'ST-LINK_CLI');

        return this.toFullPathForSettings(flasher || 'null');
    }

    getOpenOCDExePath(): string {
        return this.toFullPathForSettings(
            this.getExePathFromConfig('OpenOCD.ExePath', 'openocd') || 'null'
        );
    }

    //-----------------------------IAR-------------------------------

    getIARForStm8Dir(): File {

        let defPath: string | undefined;

        const path = this.getConfiguration().get<string>('IAR.STM8.InstallDirectory');
        if (path) {
            defPath = Utility.formatPath(this.toFullPathForSettings(path));
            if (File.IsExist(defPath)) {
                return new File(defPath);
            }
        }

        const execName = 'iccstm8';

        if (this.envPathCache.has(execName)) {
            return new File(<string>this.envPathCache.get(execName))
        }

        else {
            const absPath = find(execName);
            if (absPath) {
                const dirName = NodePath.dirname(NodePath.dirname(NodePath.dirname(absPath)));
                this.envPathCache.set(execName, dirName);
                return new File(dirName);
            }
        }

        return new File(defPath || 'null');
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

    // ---

    getArmcc5Dir(): File {
        return new File(
            this.getGccFolderFromConfig('ARM.ARMCC5.InstallDirectory', 'armcc') ||
            this.pathCache.get('ARMCC5') ||
            'null'
        );
    }

    getArmcc6Dir(): File {
        return new File(
            this.getGccFolderFromConfig('ARM.ARMCC6.InstallDirectory', 'armclang') ||
            this.pathCache.get('ARMCC6') ||
            'null'
        );
    }

    SetMdkINIPath(path: string) {
        this.setConfigValue('ARM.INI.Path', path);
    }

    private GetMdkINIFile(): File {
        const iniPath = this.getConfiguration().get<string>('ARM.INI.Path') || '';
        return new File(Utility.formatPath(iniPath));
    }

    GetMdkArmDir(): File | undefined {
        const path = this.pathCache.get('MDK');
        if (path) {
            return new File(path);
        }
    }

    private refreshMDKStatus(): void {

        /* parse from ini file */
        const iniFile = this.GetMdkINIFile();
        if (iniFile.IsFile()) {
            try {
                const iniData = ini.parse(iniFile.Read());

                // check ini file fields
                if (iniData["ARM"] && iniData["ARM"]["PATH"]) {

                    // mdk ARM dir
                    const mdkArmDir = new File(formatPath((<string>iniData["ARM"]["PATH"]).replace(/"/g, '')));

                    // cache arm dir
                    if (mdkArmDir.IsDir()) {
                        this.pathCache.set('MDK', mdkArmDir.path);
                    }

                    // cache armcc5 path
                    const armcc5Dir = File.fromArray([mdkArmDir.path, 'ARMCC', 'bin']);
                    if (armcc5Dir.IsDir()) { this.pathCache.set('ARMCC5', armcc5Dir.dir); }

                    // cache armcc6 path
                    const armcc6Dir = File.fromArray([mdkArmDir.path, 'ARMCLANG', 'bin']);
                    if (armcc6Dir.IsDir()) { this.pathCache.set('ARMCC6', armcc6Dir.dir);; }

                    // check all
                    if (!this.pathCache.has('ARMCC5') &&
                        !this.pathCache.has('ARMCC6')) {
                        throw new Error('Not found folder, [path]: ' + armcc5Dir.path);
                    }

                    // update status
                    this._checkStatus['MDK'] = true;

                    return; // mdk path is valid, return it
                }

                // invalid ini file
                else {
                    this.pathCache.delete('ARMCC5');
                    this.pathCache.delete('ARMCC6');
                    throw new Error('Invalid ARM INI file, [path] : ' + iniFile.path);
                }

            } catch (error) {
                GlobalEvent.emit('globalLog', ExceptionToMessage(error, 'Hidden'));
            }
        }

        /* parse from env */
        if (process.env && process.env['Keil_Root']) {
            const rootFolder = Utility.formatPath(process.env['Keil_Root']);
            const armFolder = File.fromArray([rootFolder, 'ARM']);
            if (armFolder.IsDir() &&
                File.fromArray([armFolder.path, 'ARMCC']).IsDir()) {
                this.pathCache.set('MDK', armFolder.path);
                this._checkStatus['MDK'] = true;
                return; /* found it, exit */
            }
        }

        this._checkStatus['MDK'] = false;
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

    //------------------------------- Any GCC ----------------------------------

    getAnyGccToolFolder(): File {
        const execName = `${this.getAnyGccToolPrefix()}gcc`;
        return new File(this.getGccFolderFromConfig('Toolchain.AnyGcc.InstallDirectory', execName) || 'null');
    }

    getAnyGccToolPrefix(): string {
        return this.getConfiguration().get<string>('Toolchain.AnyGcc.ToolPrefix') || '';
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

        this._checkStatus['C51'] = false;
    }
}