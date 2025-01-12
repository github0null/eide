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

import { File } from "../lib/node-utility/File";
import { WorkspaceManager } from "./WorkspaceManager";
import { GlobalEvent } from "./GlobalEvents";
import { exeSuffix, GetLocalCodePage, osType, getArchId, userhome } from "./Platform";
import { ExceptionToMessage } from "./Message";

import * as ChildProcess from 'child_process';
import * as x2js from 'x2js';
import * as events from 'events';
import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { CPUInfo } from "./HexUploader";
import { AbstractProject } from "./EIDEProject";
import { SettingManager } from "./SettingManager";
import * as utility from './utility'
import { CmdLineHandler } from "./CmdLineHandler";
import * as yaml from 'yaml';
import { EncodingConverter } from "./EncodingConverter";
import { jsonc } from "jsonc";

let resManager: ResManager | undefined;

// plug-in built-in folders
const eideBuiltinDirs: { [key: string]: string } = {
    'lib': 'lib',
    'lang': 'lang',
    'html': 'res' + File.sep + 'html',
    'icon': 'res' + File.sep + 'icon',
    'template': 'res' + File.sep + 'template',
    'data': 'res' + File.sep + 'data',
    'tools': 'res' + File.sep + 'tools' + File.sep + osType(),
    '7z': 'res' + File.sep + 'tools' + File.sep + osType() + File.sep + '7z',
};

// eide-binaries built-in folders
const eideBinariesDirs: { [key: string]: string } = {
    'bin': 'bin',
    'include': 'bin' + File.sep + 'include',
    'builder': 'bin' + File.sep + 'builder',
    'utils': 'bin' + File.sep + 'utils',
    'stvp_tools': 'bin' + File.sep + 'utils' + File.sep + 'stvp_tools'
};

const codePage = GetLocalCodePage();
const cacheName = 'eide.cache';

export interface FileCacheInfo {
    name: string;
    size: number;
    version: string;
    sha?: string;
    lastUpdateTime?: string;
}

export interface HostInfo {
    host: string;
    port: number;
}

export class ResManager extends events.EventEmitter {

    //data
    private dirMap: Map<string, File>;
    private iconMap: Map<string, File>;

    private context: vscode.ExtensionContext | undefined;
    private extension: vscode.Extension<any>;

    private devList: CPUInfo[];
    private cacheInfoList: FileCacheInfo[];
    private stm8DevList: string[];

    private appConfig: any;
    private appId: string;

    private constructor(context?: vscode.ExtensionContext) {
        super();
        this.dirMap = new Map();
        this.iconMap = new Map();
        this.cacheInfoList = [];
        this.devList = [];
        this.stm8DevList = [];
        this.appConfig = Object.create(null);

        if (context) {
            this.context = context;
        } else {
            throw Error('context is undefined');
        }

        this.extension = context.extension;
        this.appId = this.extension.id;

        this.LoadResourceFolders();

        this.InitIcons();
        this.LoadAppConfig();
        this.loadCache();

        /* delay load */
        GlobalEvent.on('extension_launch_done', () => {
            this.loadJlinkDevList();
            this.loadStm8DevList();
        });
    }
    onDispose() {
        this.saveCache();
    }

    static GetInstance(context?: vscode.ExtensionContext): ResManager {
        if (resManager) return resManager;
        resManager = new ResManager(context);
        return resManager;
    }

    static instance(): ResManager {
        return ResManager.GetInstance();
    }

    static getLocalCodePage(): string | undefined {
        return codePage;
    }

    public getAppFullName(): string {
        return this.appId;
    }

    public getAppName(): string {
        return this.appId.split('.')[1];
    }

    static checkWindowsShell(): boolean {
        return /powershell.exe$/i.test(vscode.env.shell)
            || /cmd.exe$/i.test(vscode.env.shell);
    }

    enumSerialPort(): string[] {
        try {
            const cmd = utility.generateDotnetProgramCmd(this.getSerialPortExe());
            const data = ChildProcess.execSync(cmd, { env: process.env });
            const portList: string[] = JSON.parse(EncodingConverter.trimUtf8BomHeader(data));
            if (!Array.isArray(portList)) { throw Error("get current port list error !"); }
            return portList;
        } catch (error) {
            throw Error(`enum serialport error !, msg: ${(<Error>error).message}`);
        }
    }

    getVersion(): string {
        return this.extension.packageJSON['version'];
    }

    getPackageJson(): any {
        return this.extension.packageJSON;
    }

    private InitIcons() {
        let dir = this.dirMap.get('icon');
        if (dir) {
            dir.GetList().forEach((f) => {
                this.iconMap.set(f.name, f);
            });
        } else {
            throw new Error('Not found icons dir');
        }
    }

    private loadCache() {
        const cacheFile = new File(this.GetTmpDir().path + File.sep + cacheName);
        try {
            if (cacheFile.IsFile()) {
                this.cacheInfoList = JSON.parse(cacheFile.Read());
            }
        } catch (error) {
            cacheFile.Write('[]');
        }
    }

    private saveCache() {
        const cacheFile = new File(this.GetTmpDir().path + File.sep + cacheName);
        cacheFile.Write(JSON.stringify(this.cacheInfoList));
    }

    //====================

    private LoadAppConfig() {

        const cfgFile = File.fromArray([this.GetAppDataDir().path, 'config.yaml']);

        if (cfgFile.IsFile()) {
            try {
                this.appConfig = yaml.parse(cfgFile.Read());
            } catch (error) {
                GlobalEvent.emit('msg', ExceptionToMessage(error, 'Hidden'));
            }
        }
    }

    getAppConfig<T extends any>(): T {
        return this.appConfig;
    }

    getAppUsrData(): { [key: string]: any } | undefined {

        const dataFile = File.fromArray([this.getEideHomeFolder().path, 'usr-data.yaml']);

        if (dataFile.IsFile()) {
            try {
                return yaml.parse(dataFile.Read());
            } catch (error) {
                // nothing todo
            }
        }
    }

    setAppUsrData(key: string, val: any): void {

        let data = this.getAppUsrData() || {};

        data[key] = val;

        this.getEideHomeFolder().CreateDir(false);

        File.fromArray([this.getEideHomeFolder().path, 'usr-data.yaml']).Write(yaml.stringify(data));
    }

    //=====================

    getCache(name: string): FileCacheInfo | undefined {
        const index = this.cacheInfoList.findIndex((val) => { return val.name === name; });
        if (index !== -1) {
            return this.cacheInfoList[index];
        }
    }

    getCachedFileByName(name: string): File {
        return new File(this.GetTmpDir().path + File.sep + name);
    }

    addCache(cacheInfo: FileCacheInfo) {
        const oldCache = this.getCache(cacheInfo.name);
        if (oldCache === undefined) {
            this.cacheInfoList.push(cacheInfo);
        } else {
            for (const key in cacheInfo) {
                (<any>oldCache)[key] = (<any>cacheInfo)[key];
            }
        }
    }

    GetHostInfo(): HostInfo {
        return {
            host: "47.240.52.92",
            port: 50000
        };
    }

    GetIconByName(name: string): File {
        let f = this.iconMap.get(name);

        if (f === undefined) {
            throw new Error('Can\'t find icon file \'' + name + '\'');
        }

        return f;
    }

    GetTmpDir(): File {
        const f = new File(os.tmpdir() + File.sep + 'EIDE');
        f.CreateDir(true);
        return f;
    }

    // WindowsPowerShell
    getPowerShell(): File | undefined {
        try {
            if (process.env['Path']) {
                const pList = process.env['Path'].split(File.delimiter);
                for (const path of pList) {
                    if (/WindowsPowerShell/.test(path)) {
                        if (path && File.IsDir(path)) {
                            const res = path.replace(/\\*\s*$/, '');
                            const psList = new File(res).GetList([/powershell\.exe/i], File.EXCLUDE_ALL_FILTER);
                            if (psList.length > 0 && psList[0].IsFile()) {
                                return psList[0];
                            }
                        }
                        break;
                    }
                }
            }
        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(<Error>error, 'Warning'));
        }
        return undefined;
    }

    getCMDPath(): string | undefined {
        return process.env['ComSpec'];
    }

    //-----------------------------------------------------------------

    getAppRootFolder(): File {
        if (this.context) {
            return new File(this.context.extensionPath);
        } else {
            throw new Error('Extension Context is undefined');
        }
    }

    getEideHomeFolder(): File {
        return File.fromArray([userhome(), '.eide']);
    }

    getBuiltInToolsDir(): File {
        return <File>this.GetDir('tools');
    }

    getEideToolsInstallDir(): string {
        return [userhome(), '.eide', 'tools'].join(File.sep);
    }

    GetLogDir(): File {
        return this.getEideHomeFolder();
    }

    Get7zDir(): File {
        return <File>this.GetDir('7z');
    }

    Get7za(): File {
        return File.fromArray([this.Get7zDir().path, `7za${exeSuffix()}`]);
    }

    getCMSISHeaderPacks(): File[] {
        const dir = File.fromArray([(<File>this.GetDir('include')).path, 'cmsis']);
        return dir.GetList(undefined, File.EXCLUDE_ALL_FILTER)
            .filter(f => f.suffix === '.zip' || f.suffix === '.7z')
            .filter(f => !f.noSuffixName.startsWith('lib') && !f.noSuffixName.endsWith('_lib'));
    }

    getCmsisLibPacks(): { [name: string]: File } {

        const cmsisDir = File.fromArray([(<File>this.GetDir('include')).path, 'cmsis']);
        const packages: { [name: string]: File } = {
            'libdsp': File.fromArray([cmsisDir.path, 'dsp_lib.7z'])
        };

        const libsDir = File.fromArray([cmsisDir.path, 'libs']);
        const indexFile = File.fromArray([libsDir.path, 'index.json']);
        if (indexFile.IsFile()) {
            try {
                const libs = jsonc.parse(indexFile.Read());
                for (const key in libs) {
                    const libpath = libs[key];
                    if (typeof libpath == 'string') {
                        packages[key] = File.fromArray([libsDir.path, libpath]);
                    }
                }
            } catch (error) {
                // nothing todo
            }
        }

        return packages;
    }

    getStvpToolsDir(): File {
        return <File>this.GetDir('stvp_tools');
    }

    getStvpUtilExe(): File {
        return File.fromArray([this.getStvpToolsDir().path, `stvp_utils${exeSuffix()}`]);
    }

    /* ------- get internal headers ------ */

    getArmccForceIncludeHeaders(): File {
        return File.fromArray([(<File>this.GetDir('include')).path, 'internal_headers', 'armcc_intr.h']);
    }

    getArmclangForceIncludeHeaders(): File {
        return File.fromArray([(<File>this.GetDir('include')).path, 'internal_headers', 'armclang_intr.h']);
    }

    getGccForceIncludeHeaders(): File {
        return File.fromArray([(<File>this.GetDir('include')).path, 'internal_headers', 'gcc_intr.h']);
    }

    getC51ForceIncludeHeaders(): File {
        return File.fromArray([(<File>this.GetDir('include')).path, 'internal_headers', 'c51_intr.h']);
    }

    getIarStm8ForceIncludeHeaders(): File {
        return File.fromArray([(<File>this.GetDir('include')).path, 'internal_headers', 'iar_stm8_intr.h']);
    }

    getIarArmForceIncludeHeaders(): File {
        return File.fromArray([(<File>this.GetDir('include')).path, 'internal_headers', 'iar_arm_intr.h']);
    }

    /* ------------------ builder and runtime ----------------- */

    getLegacyBuilderDir(): File {
        return <File>this.GetDir('builder');
    }

    getMsysBash(): File | undefined {
        if (os.platform() == 'win32') {
            return File.fromArray([this.getLegacyBuilderDir().path, 'msys', 'bin', `bash${exeSuffix()}`]);
        }
    }

    getMsysBinToolPath(toolname: string): string {
        if (os.platform() == 'win32') {
            return File.fromArray([this.getLegacyBuilderDir().path, 'msys', 'bin', `${toolname}${exeSuffix()}`]).path;
        } else {
            return `${toolname}${exeSuffix()}`;
        }
    }

    getUnifyBuilderExe(): File {
        let dirname = 'unify_builder';
        if (osType() == 'darwin')
            dirname += File.sep + getArchId();
        return File.fromArray([this.getBuiltInToolsDir().path, dirname, `unify_builder${exeSuffix()}`]);
    }

    getSerialPortExe(): File {
        return File.fromArray([this.getUnifyBuilderExe().dir, `serial_monitor${exeSuffix()}`]);
    }

    getBuilderModelsDir(plat?: 'win32' | 'unix'): File {
        const platDir = plat || (osType() == 'win32' ? 'win32' : 'unix');
        return File.fromArray([this.GetAppDataDir().path, 'models', platDir]);
    }

    /* ----------------------------------- */

    GetBinDir(): File {
        return <File>this.GetDir('bin');
    }

    GetLibDir(): File {
        return <File>this.GetDir('lib');
    }

    getLangDir(): File {
        return <File>this.GetDir('lang');
    }

    GetHTMLDir(): File {
        return <File>this.GetDir('html');
    }

    GetTemplateDir(): File {
        return <File>this.GetDir('template');
    }

    GetAppDataDir(): File {
        return <File>this.GetDir('data');
    }

    getJLinkDevList(): CPUInfo[] {
        return this.devList;
    }

    getJLinkDevByFullName(fullName: string): CPUInfo | undefined {
        const devIndex = this.devList.findIndex((dev) => { return fullName.startsWith(dev.cpuName); });
        if (devIndex !== -1) {
            return {
                cpuName: this.devList[devIndex].cpuName,
                vendor: this.devList[devIndex].vendor
            };
        }
    }

    loadJlinkDevList(jlinkDevXmlFile?: File): boolean | undefined {

        /* clear old data */
        this.devList = [];

        /* load internal device list */
        const loadDone = this.loadJlinkInternalDevs();

        /* load extension device list */
        try {

            const jlinkDefFile = File.fromArray([SettingManager.GetInstance().getJlinkDir(), 'JLinkDevices.xml']);
            const file = jlinkDevXmlFile || jlinkDefFile;

            if (file && file.IsFile()) {
                const parser = new x2js({
                    arrayAccessFormPaths: ['DataBase.Device', 'Database.Device'],
                    attributePrefix: '$'
                });

                const dom = parser.xml2js<any>(file.Read());

                // compat old DataBase version
                if (dom.DataBase == undefined && dom.Database) {
                    dom.DataBase = dom.Database;
                }

                if (dom.DataBase == undefined || dom.DataBase.Device == undefined) {
                    throw Error(`'JLinkDevices.xml' format error, not found 'DataBase' or 'DataBase.Device' xml node !, [path]: '${file.path}'`);
                }

                const jlinkDevList: any[] = dom.DataBase.Device;
                for (const device of jlinkDevList) {
                    if (device.ChipInfo) {
                        const mcuInf = { vendor: device.ChipInfo.$Vendor, cpuName: device.ChipInfo.$Name };
                        if (this.devList.findIndex((item => item.vendor == mcuInf.vendor && item.cpuName == mcuInf.cpuName)) != -1) continue;
                        this.devList.push(mcuInf);
                    }
                }
            }

            return loadDone;

        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
        }
    }

    private loadJlinkInternalDevs(): boolean | undefined {

        let file: File = File.fromArray([this.GetAppDataDir().path, 'JLinkDevices.xml']);

        /* get jlink internal device list */
        const jlinkExe = SettingManager.GetInstance().getJlinkDir() + File.sep + 'JLink';
        const timestamp = Date.now();
        const devXmlFile = File.fromArray([os.tmpdir(), `jlink_internal_devices_tmp.${timestamp}.xml`]);
        const jlinkTmpCmdFile = File.fromArray([os.tmpdir(), `jlink_cmds_tmp.${timestamp}.jlink`]);
        const jlinkScriptCont = [utility.wrapCommand(['ExpDevListXML', devXmlFile.path]), `exit`];
        jlinkTmpCmdFile.Write(jlinkScriptCont.join(os.EOL));
        const cmd = utility.wrapCommand([jlinkExe, '-CommandFile', jlinkTmpCmdFile.path]);

        /* gen jlink internal device list to file */
        try { fs.unlinkSync(devXmlFile.path) } catch (error) { /* do nothing */ }
        try { ChildProcess.execSync(cmd) } catch (error) { /* do nothing */ }
        try { fs.unlinkSync(jlinkTmpCmdFile.path) } catch (error) { /* do nothing */ } // rm tmp file
        if (devXmlFile.IsFile()) { file = devXmlFile; }

        try {

            if (!file.IsFile()) {
                throw Error(`Not found '${file.name}' file`);
            }

            const parser = new x2js({
                arrayAccessFormPaths: ['DeviceDatabase.VendorInfo.DeviceInfo'],
                attributePrefix: '$'
            });

            const dom = parser.xml2js<any>(file.Read());

            // rm tmp file
            if (devXmlFile.IsFile()) {
                try { fs.unlinkSync(devXmlFile.path) } catch (error) { }
            }

            if (dom.DeviceDatabase == undefined) {
                throw Error(`Not found 'DeviceDatabase' in devices xml, [file]: '${file.path}'`);
            }

            let vendorInfo: any = dom.DeviceDatabase.VendorInfo;
            let dList: any;

            while (vendorInfo) {

                if (!vendorInfo.$Name) {
                    throw new Error('Parser Error on \'VendorInfo.Name\' at JLinkDevices.xml File');
                }

                // skip Unspecified vendor
                if (vendorInfo.$Name !== 'Unspecified') {

                    dList = vendorInfo.DeviceInfo;

                    if (!dList) {
                        throw new Error('Parser Error on \'DeviceInfo\' at JLinkDevices.xml File');
                    }

                    if (dList[0]) {
                        (<any[]>dList).forEach((device) => {
                            if (!device.$Name) {
                                throw new Error('Parser Error on \'DeviceInfo.Name\' at JLinkDevices.xml File');
                            } else {
                                this.devList.push({
                                    vendor: vendorInfo.$Name,
                                    cpuName: device.$Name,
                                });
                            }
                        });
                    } else {
                        this.devList.push({
                            vendor: vendorInfo.$Name,
                            cpuName: dList.$Name
                        });
                    }
                }

                vendorInfo = vendorInfo.VendorInfo;
            }

            return true; // done, exit

        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
        }
    }

    getStm8DevList(): string[] {
        return this.stm8DevList;
    }

    loadStm8DevList(): boolean | undefined {

        // try load from database
        try {
            const t = ChildProcess.execFileSync(this.getStvpUtilExe().path, ['list', '--mcu']).toString();
            const arr = JSON.parse(t);
            if (!Array.isArray(arr)) throw new Error(`stm8 dev list is not an array !`);
            this.stm8DevList = arr;
            return true;
        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Hidden'));
        }

        // load default dev list
        try {
            const dataFile = new File(this.GetAppDataDir().path + File.sep + 'stm8.dev');
            if (!dataFile.IsFile()) throw new Error('can\'t load default stm8 device list !');
            const list = dataFile.Read().split(/\r\n|\n/);
            this.stm8DevList = list.map((dev) => { return dev.trim(); });
            return true; // done, exit
        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Hidden'));
        }
    }

    //---------------------------------------------------

    private GetDir(name: string): File | undefined {
        return this.dirMap.get(name);
    }

    private LoadResourceFolders() {

        for (const key in eideBuiltinDirs) {
            if (!this.context) throw new Error('Extension Context is undefined');
            const dir = File.fromArray([this.context.extensionPath, eideBuiltinDirs[key]]);
            this.dirMap.set(key, dir);
        }

        const eideHome = File.fromArray([userhome(), '.eide']);
        eideHome.CreateDir(); // create if not existed
        for (const key in eideBinariesDirs) {
            const dir = File.fromArray([eideHome.path, eideBinariesDirs[key]]);
            this.dirMap.set(key, dir);
        }
    }
}