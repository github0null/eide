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
import { find, exeSuffix, userhome } from './Platform';
import { WorkspaceManager } from './WorkspaceManager';
import { ToolchainName } from './ToolchainManager';

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
        this.eideEnv.set('${userRoot}', userhome());
        this.eideEnv.set('${userHome}', userhome());

        try {
            this.refreshMDKStatus();
            this.refreshC51Status();
        } catch (error) {
            GlobalEvent.log_warn(error);
        }

        vscode.workspace.onDidChangeConfiguration((e) => {

            if (e.affectsConfiguration(SettingManager.TAG)) {

                try {

                    if (e.affectsConfiguration('EIDE.ARM.INI.Path')) {
                        this.refreshMDKStatus();
                    }

                    if (e.affectsConfiguration('EIDE.C51.INI.Path')) {
                        this.refreshC51Status();
                    }

                    if (e.affectsConfiguration('EIDE.Builder.EnvironmentVariables')) {
                        this.syncGlobalEnvVariablesToNodeEnv();
                    }

                } catch (error) {
                    GlobalEvent.log_warn(error);
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

    trimSettingTag(setting_id: string): string {
        return setting_id.replace(SettingManager.TAG + '.', '');
    }

    getConfiguration(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration(SettingManager.TAG);
    }

    setConfigValue(key: string, val: any) {
        this.getConfiguration().update(key, val, vscode.ConfigurationTarget.Global);
    }

    private _formatPathForPluginSettings(path_: string): string {

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

    // --- source tree

    isAutoSearchIncludePath(): boolean {
        return this.getConfiguration().get<boolean>('SourceTree.AutoSearchIncludePath') || false;
    }

    isAutoSearchObjFile(): boolean {
        return this.getConfiguration().get<boolean>('SourceTree.AutoSearchObjFile') || false;
    }

    //------------------------- env and path --------------------------

    private getFullPathByPluginConfig(configName: string): string | undefined {
        const path = this.getConfiguration().get<string>(configName);
        if (path) {
            const p = Utility.formatPath(this._formatPathForPluginSettings(path));
            if (File.IsExist(p)) {
                return p;
            }
        }
    }

    private findExePathInSystemEnv(exeName: string): string | undefined {

        if (this.envPathCache.has(exeName)) {
            return <string>this.envPathCache.get(exeName);
        }

        else {
            const absPath = find(exeName);
            if (absPath) {
                this.envPathCache.set(exeName, absPath);
                return absPath;
            }
        }
    }

    private findExeDirInSystemEnv(exeName: string): string | undefined {

        if (this.envPathCache.has(exeName)) {
            return <string>this.envPathCache.get(exeName);
        }

        else {
            const absPath = find(exeName);
            if (absPath) {
                const dirpath = NodePath.dirname(absPath);
                this.envPathCache.set(exeName, dirpath);
                return dirpath;
            }
        }
    }

    private findGccCompilerRootInSystemEnv(gccName: string): string | undefined {

        if (this.envPathCache.has(gccName)) {
            return <string>this.envPathCache.get(gccName);
        }

        else {
            const absPath = find(gccName);
            if (absPath) {
                const dirName = NodePath.dirname(NodePath.dirname(absPath));
                this.envPathCache.set(gccName, dirName);
                return dirName;
            }
        }
    }

    //--------------------- Global Option ------------------------

    syncGlobalEnvVariablesToNodeEnv() {
        const envs = this.getGlobalEnvVariables();
        for (const key in envs) {
            process.env[key] = envs[key];
        }
    }

    getGlobalEnvVariables(): { [key: string]: string } {
        const lines = this.getConfiguration().get<string[]>('Builder.EnvironmentVariables') || [];
        const result: { [key: string]: string } = {};
        for (const _line of lines) {
            const str = _line.trim();
            if (str.startsWith('#'))
                continue;
            const sep_idx = str.indexOf('=');
            if (sep_idx == -1)
                continue;
            const k = str.substring(0, sep_idx).trim();
            if (!/^\w+$/.test(k))
                continue;
            const v = str.substring(sep_idx + 1).trim();
            if (v) {
                result[k] = v;
            }
        }
        return result;
    }

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

    getExternalToolsIndexUrl(): string | undefined {
        const url = this.getConfiguration().get<string>('ExternalTools.IndexUrl');
        if (url) {
            return url.trim();
        }
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
        return this.getFullPathByPluginConfig('Cppcheck.ExecutablePath')
            || this.findExePathInSystemEnv('cppcheck');
    }

    //----------------------------- Flasher --------------------------------

    getJlinkDir(): string {
        return this.getFullPathByPluginConfig('JLink.InstallDirectory')
            || this.findExeDirInSystemEnv('JLink')
            || 'null';
    }

    getStvpExePath(): string {
        return this.getFullPathByPluginConfig('STM8.STVP.CliExePath')
            || this.findExePathInSystemEnv('STVP_CmdLine')
            || 'null';
    }

    getSTLinkExePath(): string {
        return this.getFullPathByPluginConfig('STLink.ExePath')
            || this.findExePathInSystemEnv('STM32_Programmer_CLI')
            || this.findExePathInSystemEnv('ST-LINK_CLI')
            || 'null';
    }

    getOpenOCDExePath(): string {
        return this.getFullPathByPluginConfig('OpenOCD.ExePath')
            || this.findExePathInSystemEnv('openocd')
            || 'null';
    }

    //--------------------------COSMIC-----------------------------

    getCosmicStm8ToolsDir(): File {

        const p = this.getFullPathByPluginConfig('STM8.COSMIC.InstallDirectory');
        if (p) {
            return new File(p);
        }

        const execName = 'cxstm8';

        if (this.envPathCache.has(execName)) {
            return new File(<string>this.envPathCache.get(execName))
        }

        else {
            const absPath = find(execName);
            if (absPath) {
                const dirName = NodePath.dirname(absPath);
                this.envPathCache.set(execName, dirName);
                return new File(dirName);
            }
        }

        return new File('null');
    }

    //-----------------------------IAR-------------------------------

    getIARForStm8Dir(): File {

        const p = this.getFullPathByPluginConfig('IAR.STM8.InstallDirectory');
        if (p) {
            return new File(p);
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

        return new File('null');
    }

    getIarForArmDir(): File {
        return new File(
            this.getFullPathByPluginConfig('IAR.ARM.Toolchain.InstallDirectory') ||
            this.findGccCompilerRootInSystemEnv('iccarm') ||
            'null'
        );
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
        return new File(
            this.getFullPathByPluginConfig('ARM.GCC.InstallDirectory') ||
            this.findGccCompilerRootInSystemEnv(`${this.getGCCPrefix()}gcc`) ||
            'null'
        );
    }

    // ---

    getArmcc5Dir(): File {
        return new File(
            this.getFullPathByPluginConfig('ARM.ARMCC5.InstallDirectory') ||
            this.pathCache.get('ARMCC5') ||
            this.findGccCompilerRootInSystemEnv('armcc') ||
            'null'
        );
    }

    getArmcc6Dir(): File {
        return new File(
            this.getFullPathByPluginConfig('ARM.ARMCC6.InstallDirectory') ||
            this.pathCache.get('ARMCC6') ||
            this.findGccCompilerRootInSystemEnv('armclang') ||
            'null'
        );
    }

    SetMdkIniOrUv4Path(path: string) {
        this.setConfigValue('ARM.INI.Path', path);
    }

    private GetMdkINIOrUv4File(): File {
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
        const iniFile = this.GetMdkINIOrUv4File();

        if (iniFile.IsFile()) {

            // is uv4.exe
            if (iniFile.suffix.toLowerCase() == '.exe') {

                const armccDir = File.fromArray([NodePath.dirname(iniFile.dir), 'ARM', 'ARMCC']);
                const armclangDir = File.fromArray([NodePath.dirname(iniFile.dir), 'ARM', 'ARMCLANG']);

                let cnt = 0;

                if (armccDir.IsDir()) { this.pathCache.set('ARMCC5', armccDir.path); cnt++; };
                if (armclangDir.IsDir()) { this.pathCache.set('ARMCC6', armclangDir.path); cnt++; }

                if (cnt > 0) {
                    this._checkStatus['MDK'] = true;
                    return;
                }
            }

            // is ini
            else {

                const iniData = ini.parse(iniFile.Read());

                if (iniData["ARM"] && iniData["ARM"]["PATH"]) {

                    // mdk ARM dir
                    const mdkArmDir = new File(formatPath((<string>iniData["ARM"]["PATH"]).replace(/"/g, '')));

                    // cache arm dir
                    if (mdkArmDir.IsDir()) {
                        this.pathCache.set('MDK', mdkArmDir.path);
                    }

                    let cnt = 0;

                    // cache armcc5 path
                    const armcc5Dir = File.fromArray([mdkArmDir.path, 'ARMCC', 'bin']);
                    if (armcc5Dir.IsDir()) { this.pathCache.set('ARMCC5', armcc5Dir.dir); cnt++; }

                    // cache armcc6 path
                    const armcc6Dir = File.fromArray([mdkArmDir.path, 'ARMCLANG', 'bin']);
                    if (armcc6Dir.IsDir()) { this.pathCache.set('ARMCC6', armcc6Dir.dir); cnt++; }

                    // check all
                    if (cnt > 0) {
                        this._checkStatus['MDK'] = true;
                        return; // mdk path is ok, return
                    }
                }
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

        // not found any path
        this.pathCache.delete('ARMCC5');
        this.pathCache.delete('ARMCC6');
        this._checkStatus['MDK'] = false;
    }

    //------------------------------- SDCC --------------------------------

    getSdccDir(): File {
        return new File(
            this.getFullPathByPluginConfig('SDCC.InstallDirectory') ||
            this.findGccCompilerRootInSystemEnv('sdcc') ||
            'null'
        );
    }

    getGnuSdccStm8Dir(): File {
        return new File('null'); // disabled
    }

    //------------------------------- RISC-V ----------------------------------

    getRiscvToolFolder(): File {
        return new File(
            this.getFullPathByPluginConfig('RISCV.InstallDirectory') ||
            this.findGccCompilerRootInSystemEnv(`${this.getRiscvToolPrefix()}gcc`) ||
            'null'
        );
    }

    getRiscvToolPrefix(): string {
        return this.getConfiguration().get<string>('RISCV.ToolPrefix') || '';
    }

    //------------------------------- MTI GCC ----------------------------------

    getMipsToolFolder(): File {
        return new File(
            this.getFullPathByPluginConfig('MIPS.InstallDirectory') ||
            this.findGccCompilerRootInSystemEnv(`${this.getMipsToolPrefix()}gcc`) ||
            'null'
        );
    }

    getMipsToolPrefix(): string {
        return this.getConfiguration().get<string>('MIPS.ToolPrefix') || '';
    }

    //------------------------------- Any GCC ----------------------------------

    getAnyGccToolFolder(): File {
        return new File(
            this.getFullPathByPluginConfig('Toolchain.AnyGcc.InstallDirectory') ||
            this.findGccCompilerRootInSystemEnv(`${this.getAnyGccToolPrefix()}gcc`) ||
            'null'
        );
    }

    getAnyGccToolPrefix(): string {
        return this.getConfiguration().get<string>('Toolchain.AnyGcc.ToolPrefix') || '';
    }

    setGccFamilyToolPrefix(id: ToolchainName, newPrefix: string, global?: boolean) {

        const region = global ? vscode.ConfigurationTarget.Global : vscode.ConfigurationTarget.Workspace;

        switch (id) {
            case 'GCC':
                this.getConfiguration().update('ARM.GCC.Prefix', newPrefix, region);
                break;
            case 'RISCV_GCC':
                this.getConfiguration().update('RISCV.ToolPrefix', newPrefix, region);
                break;
            case 'ANY_GCC':
                this.getConfiguration().update('Toolchain.AnyGcc.ToolPrefix', newPrefix, region);
                break;
            default:
                break;
        }
    }

    getGccFamilyToolPrefix(id: ToolchainName): string | undefined {
        switch (id) {
            case 'GCC':
                return this.getGCCPrefix();
            case 'RISCV_GCC':
                return this.getRiscvToolPrefix();
            case 'ANY_GCC':
                return this.getAnyGccToolPrefix();
            case 'MIPS_GCC':
            case 'MTI_GCC':
                return this.getMipsToolPrefix();
            default:
                return undefined;
        }
    }

    //------------------------------- C51 ----------------------------------

    SetC51IniOrUv4Path(path: string) {
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

        const iniFile = this.GetC51INIFile();

        if (iniFile.IsFile()) {

            // is uv4.exe
            if (iniFile.suffix.toLowerCase() == '.exe') {
                const c51BinDir = File.fromArray([NodePath.dirname(iniFile.dir), 'C51', 'BIN']);
                if (c51BinDir.IsDir()) {
                    this.pathCache.set('C51', c51BinDir.dir);
                    this._checkStatus['C51'] = true;
                    return;
                }
            }

            // is ini file
            else {
                const iniData = ini.parse(iniFile.Read());
                if (iniData["C51"] && iniData["C51"]["PATH"]) {
                    const c51BinDir = File.fromArray([formatPath((<string>iniData["C51"]["PATH"]).replace(/"/g, '')), 'BIN']);
                    if (c51BinDir.IsDir()) {
                        this.pathCache.set('C51', c51BinDir.dir);
                        this._checkStatus['C51'] = true;
                        return;
                    }
                }
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

        // not found any path
        this.pathCache.delete('C51');
        this._checkStatus['C51'] = false;
    }
}