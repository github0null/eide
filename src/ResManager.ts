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
import { exeSuffix, GetLocalCodePage } from "./Platform";
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
import { CodeConverter } from "./CodeConverter";

let resManager: ResManager | undefined;

const prjEnvList: string[] = [
    File.sep + AbstractProject.EIDE_DIR + File.sep + 'log'
];

const eideEnvList: string[] = [
    File.sep + 'lib',
    File.sep + 'lang',
    File.sep + 'res' + File.sep + 'html',
    File.sep + 'res' + File.sep + 'icon',
    File.sep + 'res' + File.sep + 'template',
    File.sep + 'res' + File.sep + 'data',
    File.sep + 'res' + File.sep + 'tools',
    File.sep + 'res' + File.sep + 'tools' + File.sep + '7z'
];

const eideBinDirList: string[] = [
    'bin',
    'bin' + File.sep + 'include',
    'bin' + File.sep + 'builder',
];

const codePage = GetLocalCodePage();
const cacheName = 'eide.cache';
const appName = 'cl.eide';

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

    private constructor(context?: vscode.ExtensionContext) {
        super();
        this.dirMap = new Map();
        this.iconMap = new Map();
        this.cacheInfoList = [];
        this.devList = [];
        this.stm8DevList = [];
        this.appConfig = Object.create(null);
        this.extension = <vscode.Extension<any>>vscode.extensions.getExtension<any>(appName);

        if (context) {
            this.context = context;
        } else {
            throw Error('context is undefined');
        }

        this.LoadSysEnv();

        this.InitIcons();
        this.LoadAppConfig();
        this.loadCache();

        /* delay load */
        GlobalEvent.on('extension_launch_done', () => {
            this.loadJlinkDevList();
            this.loadStm8DevList();
        });

        GlobalEvent.on('extension_close', () => {
            this.saveCache();
        });
    }

    static GetInstance(context?: vscode.ExtensionContext): ResManager {
        if (resManager) {
            return resManager;
        }
        resManager = new ResManager(context);
        return resManager;
    }

    static getLocalCodePage(): string | undefined {
        return codePage;
    }

    static getAppFullName(): string {
        return appName;
    }

    static getAppName(): string {
        return appName.split('.')[1];
    }

    static checkWindowsShell(): boolean {
        return /powershell.exe$/i.test(vscode.env.shell)
            || /cmd.exe$/i.test(vscode.env.shell);
    }

    InitWorkspace() {
        const ws = WorkspaceManager.getInstance().getWorkspaceRoot();
        if (ws) {
            this.LoadPrjEnv(ws);
        }
    }

    enumSerialPort(): string[] {
        try {
            const cmd = this.getSerialPortExe().noSuffixName;
            const data = ChildProcess.execSync(cmd, { env: process.env });
            const portList: string[] = JSON.parse(CodeConverter.trimUtf8BomHeader(data));
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
                        if (path && fs.existsSync(path) && fs.lstatSync(path).isDirectory) {
                            const res = path.replace(/\\*\s*$/, '');
                            const psList = new File(res).GetList([/powershell\.exe/i], File.EMPTY_FILTER);
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
        return File.fromArray([os.homedir(), '.eide']);
    }

    GetLogDir(): File {
        const logDir = this.GetDir('log');
        if (logDir === undefined) {
            return this.GetTmpDir();
        }
        return logDir;
    }

    Get7zDir(): File {
        return File.fromArray([(<File>this.GetDir('7z')).path, os.platform()]);
    }

    Get7za(): File {
        return File.fromArray([this.Get7zDir().path, `7za${exeSuffix()}`]);
    }

    getCMSISHeaderPacks(): File[] {
        const dir = File.fromArray([(<File>this.GetDir('include')).path, 'cmsis']);
        return dir.GetList(undefined, File.EMPTY_FILTER).filter((f) => {
            return f.suffix === '.zip' || f.suffix === '.7z';
        });
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

    /* ------------------ builder and runtime ----------------- */

    getBuilderDir(): File {
        return <File>this.GetDir('builder');
    }

    getMsysBash(): File | undefined {
        if (os.platform() == 'win32') {
            return File.fromArray([this.getBuilderDir().path, 'msys', 'bin', `bash${exeSuffix()}`]);
        }
    }

    getBuilder(): File {
        return File.fromArray([this.getBuilderDir().path, 'bin', `unify_builder${exeSuffix()}`]);
    }

    getSerialPortExe(): File {
        return File.fromArray([this.getBuilderDir().path, 'bin', `serial_monitor${exeSuffix()}`]);
    }

    /* --------------- tools -------------------- */

    getUtilToolsDir(): string {
        return [os.homedir(), '.eide', 'tools'].join(File.sep);
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
        try {
            const dataFile = new File(this.GetAppDataDir().path + File.sep + 'stm8.dev');
            if (dataFile.IsFile()) {
                const list = dataFile.Read().split(/\r?\n/);
                this.stm8DevList = list.map((dev) => { return dev.trim(); });
                return true; // done, exit
            } else {
                throw new Error('can\'t load stm8 device list !');
            }
        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
        }
    }

    //---------------------------------------------------

    private GetDir(name: string): File | undefined {
        return this.dirMap.get(name);
    }

    private LoadPrjEnv(ws: File) {
        prjEnvList.forEach((dirPath) => {
            const dir = new File(ws.path + dirPath);
            dir.CreateDir(true);
            this.dirMap.set(dir.name, dir);
        });
    }

    private LoadSysEnv() {

        eideEnvList.forEach((dir) => {
            if (this.context) {
                const f = new File(this.context.extensionPath + dir);
                this.dirMap.set(f.name, f);
            } else {
                throw new Error('Extension Context is undefined');
            }
        });

        const eideHome = File.fromArray([os.homedir(), '.eide']);
        eideHome.CreateDir(); // create if not existed
        eideBinDirList.forEach((dir) => {
            const d = File.fromArray([eideHome.path, dir]);
            this.dirMap.set(d.name, d);
        });
    }
}