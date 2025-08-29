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

import * as events from 'events';
import * as os from 'os';
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as NodePath from 'path';
import { jsonc } from 'jsonc';
import * as child_process from 'child_process';

import { File } from "../lib/node-utility/File";
import { FileWatcher } from "../lib/node-utility/FileWatcher";
import {
    include_desc, lib_desc, source_list_desc, definition_list_desc,
    view_str$prompt$loadws_cfg_failed
} from "./StringTable";
import { ArrayDelRepetition } from "../lib/node-utility/Utility";
import { GlobalEvent } from "./GlobalEvents";
import { ExceptionToMessage, newMessage } from "./Message";
import { ToolchainName } from './ToolchainManager';
import { HexUploaderType } from "./HexUploader";
import { VirtualSource } from "./EIDEProject";
import * as utility from './utility';
import { CompileConfigModel, UploadConfigModel, SdccCompileConfigModel, GccCompileConfigModel, RiscvCompileConfigModel, AnyGccCompileConfigModel, MipsCompileConfigModel } from './EIDEProjectModules';

// ----------------------------------------------------------
// - project struct define
// ----------------------------------------------------------

// !! eide project config file version !!
export const EIDE_CONF_VERSION = '3.6';

//
//  'C51': 8BIT MCU Project (like: mcs51, stm8, ...)
//  'ARM': Cortex-M Project
//  'RISC-V': RISCV Project
//  'ANY-GCC': Any GCC Toolchain Project
//
export type ProjectType = 'C51' | 'ARM' | 'RISC-V' | 'ANY-GCC' | 'MIPS';

export interface CreateOptions {
    name: string; // project folder name
    projectName?: string;
    outDir: File; // project location
    templateFile?: File;
    type: ProjectType;
}

export type ImportProjectIDEType = 'mdk' | 'eclipse' | 'iar';

export interface ImportOptions {
    type: ImportProjectIDEType;
    outDir?: File;
    projectFile: File;
    createNewFolder?: boolean;
    mdk_prod?: 'c51' | 'arm';
}

export interface Dependence {
    name: string;
    incList: string[];          // absolute path with env variables
    libList: string[];          // absolute path with env variables
    defineList: string[];
}

export interface DependenceGroup {
    groupName: string;
    depList: Dependence[];
}

export interface ProjectMiscInfo {
    uid: string | undefined;
}

export interface BuilderOptions {
    version: number;
    beforeBuildTasks?: any[];
    afterBuildTasks?: any[];
    global?: any;
    ['c/cpp-compiler']?: any;
    ['asm-compiler']?: any;
    linker?: any;
}

// 备注：由于历史原因，插件运行时会将 eide.json 直接转成json对象作为 项目的数据结构 使用；
// 但插件运行时的数据结构和eide.json文件的内容是不一样的，有一些键仅在插件内部使用；
// 需要保证一些键位于json对象的根下，因此需要将这些键从 targets 复制到上一层，
// 对比 ProjectTargetInfo 与 ProjectConfigData 相同的键，这些键如下：
export const MAPPED_KEYS_IN_TARGET_INFO = [
    'excludeList',
    'toolchain',
    'compileConfig',
    'uploader',
    'uploadConfig',
    'uploadConfigMap',
    'custom_dep',
];
export interface ProjectTargetInfo {
    excludeList: string[];
    toolchain: ToolchainName;
    compileConfig: any;
    uploader: HexUploaderType;
    uploadConfig: any | null;
    uploadConfigMap: { [uploader: string]: any };
    custom_dep: Dependence;
    builderOptions: { [toolchain: string]: BuilderOptions };
}

export interface VirtualFile {
    // this must be an relative path
    // because virtual file path may be outside the project root directory
    path: string;
}

export interface VirtualFolder {
    name: string;
    files: VirtualFile[];
    folders: VirtualFolder[];
}

export interface BuilderConfigData { }

// 备注：由于历史原因，插件运行时会将 eide.json 直接转成json对象作为 项目的数据结构 使用；
// 但插件运行时的数据结构和eide.json文件的内容是不一样的，有一些键仅在插件内部使用；
// 是不需要保存到 eide.json 文件中去，因此在保存项目数据结构时，需要排除这些键，如下：
const EXCL_KEYS_IN_EIDE_JSON = [
    'mode',
    'excludeList',
    'toolchain',
    'compileConfig',
    'uploader',
    'uploadConfig',
    'uploadConfigMap'
];
export interface ProjectConfigData<T extends BuilderConfigData> {

    name: string;
    type: ProjectType;

    // cur target info (virtual node)
    mode: string; // target name (And for historical reasons, that's what it's called)
    excludeList: string[];
    toolchain: ToolchainName;
    compileConfig: T; //【历史遗留属性】用于储存一些 公共的 编译相关的 属性
    uploader: HexUploaderType;
    uploadConfig: any | null;
    uploadConfigMap: { [uploader: string]: any };

    // dependences (virtual node: 'custom', 'built-in')
    dependenceList: DependenceGroup[];

    // all targets
    targets: { [target: string]: ProjectTargetInfo };

    // source
    srcDirs: string[];
    virtualFolder: VirtualFolder;

    outDir: string;
    deviceName: string | null;
    packDir: string | null;
    miscInfo: ProjectMiscInfo;
    version: string;
}

export interface ProjectUserContextData {

    target?: string;
}

export type ProjectConfigEventType =
    'dependence' | 'srcRootAdd' | 'srcRootRemoved' | 'compiler' | 'uploader' | 'projectFileChanged';

export interface ProjectConfigEvent {
    type: ProjectConfigEventType;
    data?: any;
}

export interface ProjectBaseApi {
    getRootDir: () => File;
    toolchainName: () => ToolchainName;
    toAbsolutePath: (path: string) => string;
    toRelativePath: (path: string) => string;
    resolveEnvVar: (path: string) => string;
}

// -------------------------------------------------
// - other utils types
// -------------------------------------------------

export interface ManagerInterface {
    Init(): void;
}

export interface FileItem {
    file: File;
    disabled?: boolean;
}

export interface FileGroup {
    name: string;       // dir name if it's system folder, else it's a virtual path (with '<virtual_root>/' header)
    files: FileItem[];
    disabled?: boolean;
}

export interface ProjectFileGroup extends FileGroup {
    dir: File;
    isRoot: boolean;
}

// ----------------------------------------------------------
// - class
// ----------------------------------------------------------

class EventItem {

    readonly name: string;
    private args: string[];

    constructor(event: string) {
        this.name = event;
        this.args = [];
    }

    add(arg: string) {
        const index = this.args.findIndex((item) => { return item === arg; });
        if (index !== -1) {
            this.args.splice(index, 1);
        }
        this.args.push(arg);
    }

    getArgs(): string[] {
        return this.args;
    }
}

export abstract class Configuration<ConfigType = any, EventType = any> {

    readonly FILE_NAME: string;

    config: ConfigType;
    needReloadProject = false;

    private _eventMergeFlag: boolean;
    private _eventCache: EventItem[];
    protected _event: events.EventEmitter;

    protected cfgFile: File;
    protected watcher: FileWatcher;

    protected isDelUnknownKeysWhenLoad: boolean = true;
    protected lastSaveTime: number = 0;

    constructor(configFile: File, type?: ProjectType) {
        this._event = new events.EventEmitter();
        this._eventMergeFlag = false;
        this._eventCache = [];
        this.cfgFile = configFile;
        this.FILE_NAME = configFile.name;
        this.watcher = new FileWatcher(configFile, false);
        this.watcher.on('error', (err) => GlobalEvent.log_error(err));
        this.watcher.OnChanged = () => this.InitConfig(this.watcher.file.Read());
        this.config = this.GetDefault(this.readTypeFromFile(configFile) || type);
    }

    public load(): Configuration<ConfigType, EventType> {

        try {
            const meta = fs.statSync(this.cfgFile.path);
            this.lastSaveTime = meta.mtime.getTime();
        } catch (err) {
            // nothing todo
        }

        if (this.cfgFile.IsFile()) {
            this.InitConfig(this.cfgFile.Read());
        } else {
            this.Save(true);
        }

        return this;
    }

    Dispose(): void {
        this.watcher.Close();
    }

    GetFile(): File {
        return this.cfgFile;
    }

    Watch() {
        try {
            this.watcher.Watch();
        } catch (error) {
            GlobalEvent.emit('error', <Error>error);
        }
    }

    on(event: 'dataChanged', listener: (dataType: EventType) => void): void;
    on(event: any, listener: (arg?: any) => void): void {
        this._event.on(event, listener);
    }

    protected emit(event: 'dataChanged', dataType: EventType): void;
    protected emit(event: any, arg?: any): void {
        if (this._eventMergeFlag) {
            this.cacheEvent(event, arg);
        } else {
            this._event.emit(event, arg);
        }
    }

    private cacheEvent(event: any, arg?: any) {
        const index = this._eventCache.findIndex((item) => { return item.name === event; });
        if (index !== -1) {
            this._eventCache[index].add(arg || '');
        } else {
            const item = new EventItem(event);
            item.add(arg || '');
            this._eventCache.push(item);
        }
    }

    beginCacheEvents() {
        this._eventMergeFlag = true;
    }

    endCachedEvents() {

        for (const item of this._eventCache) {
            for (const arg of item.getArgs()) {
                this._event.emit(item.name, arg);
            }
        }

        this._eventCache = [];
        this._eventMergeFlag = false;
    }

    protected InitConfig(json: string | object): void {

        const _configFromFile: any = (typeof json === 'string') ? this.Parse(json) : json;

        // clear invalid property
        if (this.isDelUnknownKeysWhenLoad) {
            for (const key in (<any>_configFromFile)) {
                if ((<any>this.config)[key] === undefined) {
                    _configFromFile[key] = undefined;
                }
            }
        }

        // set config
        this.config = _configFromFile;

        //
        this.afterInitConfigData();

        this._event.emit('dataChanged');
    }

    private _json_equal(str1: string, str2: string): boolean {

        try {
            const s1 = jsonc.uglify(str1);
            const s2 = jsonc.uglify(str2);
            return s1 == s2;
        } catch (error) {
            // nothing todo
        }

        return str1 == str2;
    }

    Save(force?: boolean): void {

        let oldContent: string | undefined;
        let newContent: string = this.ToJson();

        try {
            if (this.cfgFile.IsExist()) oldContent = this.cfgFile.Read();
        } catch (error) {
            GlobalEvent.log_error(error);
        }

        // ! 注意这里比较两个 json 字符串是否相等，需要去除空白字符，不要直接比较字符串，
        // ! 不同平台上项目文件中的 \n 可能不同，会导致 git 提示有更改
        if (oldContent == undefined || !this._json_equal(oldContent, newContent)) {
            this.lastSaveTime = Date.now();
            this.cfgFile.Write(newContent);
        }
    }

    protected afterInitConfigData() {
        // TODO
    }

    protected Parse(jsonStr: string): ConfigType {
        return <ConfigType>JSON.parse(jsonStr);
    }

    protected ToJson(): string {
        return JSON.stringify(this.config, undefined, 4);
    }

    protected abstract readTypeFromFile(configFile: File): ProjectType | undefined;

    abstract GetDefault(type?: ProjectType): ConfigType;
}

export class ConfigMap {

    private map: Map<string, Configuration>;

    constructor() {
        this.map = new Map();
    }

    Set<T>(confg: Configuration<T>, key?: string): Configuration<T> {
        this.map.set(key !== undefined ? key : confg.FILE_NAME, confg);
        return confg;
    }

    Get<T>(key: string): Configuration<T> {
        return <Configuration<T>>this.map.get(key);
    }

    GetAll(): Configuration[] {
        return Array.from(this.map.values());
    }

    Clear() {
        this.Dispose();
        this.map.clear();
    }

    Dispose() {
        this.map.forEach((val) => {
            val.Dispose();
        });
    }

    SaveAll() {
        this.map.forEach((val) => {
            val.Save();
        });
    }
}

export class ProjectConfiguration<T extends BuilderConfigData>
    extends Configuration<ProjectConfigData<T>, ProjectConfigEvent> {

    static readonly BUILD_IN_GROUP_NAME = 'build-in';
    static readonly CUSTOM_GROUP_NAME = 'custom';
    static readonly MERGE_DEP_NAME = 'merge';
    static readonly USR_CTX_FILE_NAME = '.eide.usr.ctx.json';

    compileConfigModel: CompileConfigModel<any> = <any>null;
    uploadConfigModel: UploadConfigModel<any> = <any>null;

    protected project: ProjectBaseApi;
    protected rootDir: File;

    constructor(eideJsonFile: File, type?: ProjectType) {

        super(eideJsonFile, type);

        this.rootDir = new File(NodePath.dirname(this.cfgFile.dir));

        this.project = {
            getRootDir: () => this.rootDir,
            toolchainName: () => this.config.toolchain,
            toRelativePath: (p) => this.toRelativePath(p),
            toAbsolutePath: (p) => this.toAbsolutePath(p),
            resolveEnvVar: (p) => p
        };

        const _cb = () => {
            try {
                const meta = fs.statSync(this.cfgFile.path);
                if (meta.mtime.getTime() > this.lastSaveTime + 3000) {
                    this.onProjectFileChanged();
                }
            } catch (err) {
                // nothing todo
            }
        };

        this.watcher.OnChanged = _cb
        this.watcher.OnRename = _cb;
    }

    private __fileChgEvtEmitDelayTimer: NodeJS.Timeout | undefined;
    private onProjectFileChanged() {
        if (this.__fileChgEvtEmitDelayTimer) {
            this.__fileChgEvtEmitDelayTimer.refresh();
        } else {
            this.__fileChgEvtEmitDelayTimer = setTimeout((this_: ProjectConfiguration<any>) => {
                this_.__fileChgEvtEmitDelayTimer = undefined;
                this_.emit('dataChanged', { type: 'projectFileChanged' });
            }, 600, this);
        }
    }

    public load(): ProjectConfiguration<any> {

        super.load();

        this.compileConfigModel = CompileConfigModel.getInstance(this.config);
        this.uploadConfigModel = UploadConfigModel.getInstance(this.config.uploader, this.project);

        this.compileConfigModel.Update(this.config.compileConfig);
        this.config.compileConfig = this.compileConfigModel.data;
        this.compileConfigModel.on('dataChanged', () => this.emit('dataChanged', { type: 'compiler' }));

        this.uploadConfigModel.Update(this.config.uploadConfig);
        this.config.uploadConfig = this.uploadConfigModel.data;
        this.uploadConfigModel.on('dataChanged', () => this.emit('dataChanged', { type: 'uploader' }));

        // update upload model
        this.compileConfigModel.on('dataChanged', () => this.uploadConfigModel.emit('NotifyUpdate', this));

        this.Watch();

        return this;
    }

    private getRootDir(): File {
        return this.rootDir;
    }

    private toAbsolutePath(path_: string): string {
        const path = path_.trim();
        if (File.isAbsolute(path)) { return File.normalize(path); }
        return File.normalize(this.getRootDir().path + File.sep + path);
    }

    private toRelativePath(path_: string): string {
        const path = path_.trim();
        return this.getRootDir().ToRelativePath(path) || File.ToUnixPath(path);
    }

    private MergeDepList(depList: Dependence[], name?: string): Dependence {

        const merge: Dependence = {
            name: name ? name : ProjectConfiguration.MERGE_DEP_NAME,
            incList: [],
            libList: [],
            defineList: [],
        };

        depList.forEach(dep => {
            merge.defineList = merge.defineList.concat(dep.defineList);
            merge.libList = merge.libList.concat(dep.libList);
            merge.incList = merge.incList.concat(dep.incList);
        });

        // clear duplicate
        merge.defineList = ArrayDelRepetition(merge.defineList);
        merge.libList = ArrayDelRepetition(merge.libList);
        merge.incList = ArrayDelRepetition(merge.incList);

        return merge;
    }

    protected readTypeFromFile(configFile: File): ProjectType | undefined {
        if (configFile.IsFile()) {
            try {
                const prjObj = JSON.parse(configFile.Read());
                return <ProjectType>prjObj['type'];
            } catch (error) {
                GlobalEvent.emit('msg', ExceptionToMessage(error, 'Hidden'));
            }
        }
    }

    GetDefault(type?: ProjectType): ProjectConfigData<any> {
        switch (type) {
            case 'C51':
                return {
                    name: 'undefined',
                    type: type,
                    mode: 'Debug',
                    toolchain: 'SDCC',
                    uploader: 'Custom',
                    dependenceList: [],
                    compileConfig: SdccCompileConfigModel.getDefaultConfig(),
                    srcDirs: [],
                    virtualFolder: { name: VirtualSource.rootName, files: [], folders: [] },
                    excludeList: [],
                    outDir: 'build',
                    deviceName: null,
                    packDir: null,
                    uploadConfig: null,
                    uploadConfigMap: {},
                    miscInfo: <any>{},
                    targets: {},
                    version: EIDE_CONF_VERSION
                };
            case 'ARM':
                return {
                    name: 'undefined',
                    type: type,
                    mode: 'Debug',
                    toolchain: 'GCC',
                    dependenceList: [],
                    compileConfig: GccCompileConfigModel.getDefaultConfig(),
                    uploader: 'JLink',
                    srcDirs: [],
                    virtualFolder: { name: VirtualSource.rootName, files: [], folders: [] },
                    excludeList: [],
                    outDir: 'build',
                    deviceName: null,
                    packDir: null,
                    uploadConfig: null,
                    uploadConfigMap: {},
                    miscInfo: <any>{},
                    targets: {},
                    version: EIDE_CONF_VERSION
                };
            case 'RISC-V':
                return {
                    name: 'undefined',
                    type: type,
                    mode: 'Debug',
                    toolchain: 'RISCV_GCC',
                    dependenceList: [],
                    compileConfig: RiscvCompileConfigModel.getDefaultConfig(),
                    uploader: 'JLink',
                    srcDirs: [],
                    virtualFolder: { name: VirtualSource.rootName, files: [], folders: [] },
                    excludeList: [],
                    outDir: 'build',
                    deviceName: null,
                    packDir: null,
                    uploadConfig: null,
                    uploadConfigMap: {},
                    miscInfo: <any>{},
                    targets: {},
                    version: EIDE_CONF_VERSION
                };
            case 'MIPS':
                return {
                    name: 'undefined',
                    type: type,
                    mode: 'Debug',
                    toolchain: 'MTI_GCC',
                    dependenceList: [],
                    compileConfig: MipsCompileConfigModel.getDefaultConfig(),
                    uploader: 'Custom',
                    srcDirs: [],
                    virtualFolder: { name: VirtualSource.rootName, files: [], folders: [] },
                    excludeList: [],
                    outDir: 'build',
                    deviceName: null,
                    packDir: null,
                    uploadConfig: null,
                    uploadConfigMap: {},
                    miscInfo: <any>{},
                    targets: {},
                    version: EIDE_CONF_VERSION
                };
            case 'ANY-GCC':
                return {
                    name: 'undefined',
                    type: type,
                    mode: 'Debug',
                    toolchain: 'ANY_GCC',
                    dependenceList: [],
                    compileConfig: AnyGccCompileConfigModel.getDefaultConfig(),
                    uploader: 'JLink',
                    srcDirs: [],
                    virtualFolder: { name: VirtualSource.rootName, files: [], folders: [] },
                    excludeList: [],
                    outDir: 'build',
                    deviceName: null,
                    packDir: null,
                    uploadConfig: null,
                    uploadConfigMap: {},
                    miscInfo: <any>{},
                    targets: {},
                    version: EIDE_CONF_VERSION
                };
            default:
                throw new Error(`not support this project type: '${type}'`);
        }
    }

    setHexUploader(uploader: HexUploaderType) {

        const oldModel = this.uploadConfigModel;

        // save as old config
        this.config.uploadConfigMap[oldModel.uploader] = utility.copyObject(oldModel.data);

        // get old config from map
        const oldCfg = this.config.uploadConfigMap[uploader];
        if (oldCfg && oldCfg.bin == null) {
            oldCfg.bin = ''; // compat old cfg
        }

        // update new config
        this.uploadConfigModel = UploadConfigModel.getInstance(uploader, this.project);
        this.config.uploader = uploader;
        this.uploadConfigModel.data = utility.copyObject(oldCfg) || this.uploadConfigModel.data;
        this.config.uploadConfig = this.uploadConfigModel.data; // bind obj

        // update listeners
        this.uploadConfigModel.copyListenerFrom(oldModel);

        // update compileConfigModel listener
        this.compileConfigModel.on('dataChanged', () => this.uploadConfigModel.emit('NotifyUpdate', this));
    }

    setToolchain(toolchain: ToolchainName) {

        const oldModel = this.compileConfigModel;
        const oldToolchain = this.config.toolchain;

        // bind
        this.config.toolchain = toolchain; // update toolchain name
        this.compileConfigModel = CompileConfigModel.getInstance(this.config);
        this.config.compileConfig = this.compileConfigModel.data; // bind obj

        // update
        this.compileConfigModel.copyCommonCompileConfigFrom(oldToolchain, oldModel);
        this.compileConfigModel.copyListenerFrom(oldModel);
    }

    //---

    getMiscInfo(): ProjectMiscInfo {
        return this.config.miscInfo;
    }

    getOutDir(): string {
        return this.getOutDirRoot() + File.sep + this.config.mode;
    }

    getOutDirRoot(): string {
        return this.config.outDir;
    }

    //-----------------------------------------------------------

    GetDepKeyDesc(key: string, withRawName?: boolean): string {
        switch (key) {
            case 'incList':
                return include_desc + (withRawName ? ` (IncludePaths)` : '');
            case 'libList':
                return lib_desc + (withRawName ? ` (StaticLibrarySearchDirs)` : '');
            // case 'sourceList':
            //     return source_list_desc + (withRawName ? ` (SourceFiles)` : '');
            case 'defineList':
                return definition_list_desc + (withRawName ? ` (C/C++ Macros)` : '');
            default:
                return key;
        }
    }

    //-----------------------------------------------------------

    IsDependenceEmpty(groupName?: string): boolean {

        if (this.config.dependenceList.length > 0) {

            if (groupName) {

                const group = this.GetDepGroupByName(groupName);

                if (group) {

                    return group.depList.length === 0;
                }

                return true;
            }

            return false;

        } else {
            return true;
        }
    }

    IsExisted(groupName: string, depName?: string): boolean {
        return depName ? this.GetDependence(groupName, depName) !== undefined
            : this.GetDepGroupByName(groupName) !== undefined;
    }

    //--------------------------------------------------------

    /**
     * @param gExclude [<groupName>, <groupName>.<depName>]
     */
    GetAllMergeDep(gExclude?: string[]): Dependence {

        const resultList: Dependence[] = [];
        let groups = this.config.dependenceList;

        if (gExclude) {
            groups = groups.filter((_group) => { return !gExclude.includes(_group.groupName); });
        }

        groups.forEach(depGroup => {
            depGroup.depList.filter((dep) => {
                return gExclude === undefined || !gExclude.includes(`${depGroup.groupName}.${dep.name}`);
            }).forEach(dep => {
                resultList.push(dep);
            });
        });

        return this.MergeDepList(resultList);
    }

    getAllDepGroup(): DependenceGroup[] {
        return Array.from(this.config.dependenceList);
    }

    MergeDependence(groupName: string, dep: Dependence) {
        const targetDep = this.GetDependence(groupName, dep.name);
        if (targetDep) {
            const _newDep: any = this.MergeDepList([targetDep, dep], targetDep.name);
            for (let key in <any>targetDep) {
                (<any>targetDep)[key] = _newDep[key];
            }
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    AddDependence(groupName: string, dep: Dependence) {
        let depGroup = this.GetDepGroupByName(groupName);
        if (!depGroup) {
            depGroup = {
                groupName: groupName,
                depList: []
            };
            this.config.dependenceList.push(depGroup);
        }
        const index = this.GetDepIndexByName(depGroup, dep.name);
        if (index === -1) {
            depGroup.depList.push(dep);
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    AddDepGroup(depGroup: DependenceGroup) {
        if (this.GetDepGroupIndexByName(depGroup.groupName) === -1) {
            this.config.dependenceList.push(depGroup);
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    //------------------------------------------------------------

    RemoveDependence(groupName: string, depName: string) {
        const depGroup = this.GetDepGroupByName(groupName);
        if (depGroup) {
            const index = this.GetDepIndexByName(depGroup, depName);
            if (index !== -1) {
                depGroup.depList.splice(index, 1);
                if (depGroup.depList.length === 0) {
                    this.RemoveDepGroup(depGroup.groupName);
                    return;
                }
                this.emit('dataChanged', { type: 'dependence' });
            }
        }
    }

    RemoveDepGroup(groupName: string) {
        const index = this.GetDepGroupIndexByName(groupName);
        if (index !== -1) {
            this.config.dependenceList.splice(index, 1);
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    //----------------------------------------------------------------------

    GetDepGroupIndexByName(groupName: string): number {
        return this.config.dependenceList.findIndex(depGroup => { return depGroup.groupName === groupName; });
    }

    GetDepGroupByName(groupName: string): DependenceGroup | undefined {
        const index = this.GetDepGroupIndexByName(groupName);
        if (index !== -1) {
            return this.config.dependenceList[index];
        }
        return undefined;
    }

    GetDepIndexByName(group: DependenceGroup, depName: string): number {
        return group.depList.findIndex(dep => { return dep.name === depName; });
    }

    GetDependence(groupName: string, depName: string): Dependence | undefined {
        const depGroup = this.GetDepGroupByName(groupName);
        if (depGroup) {
            const index = depGroup.depList.findIndex(dep => { return dep.name === depName; });
            if (index !== -1) {
                return depGroup.depList[index];
            }
        }
        return undefined;
    }

    AddSrcDir(absPath: string) {
        if (!this.config.srcDirs.includes(absPath)) {
            this.config.srcDirs.push(absPath);
            this.emit('dataChanged', { type: 'srcRootAdd', data: absPath });
        }
    }

    addSrcDirAtFirst(absPath: string) {
        if (!this.config.srcDirs.includes(absPath)) {
            this.config.srcDirs.unshift(absPath);
            this.emit('dataChanged', { type: 'srcRootAdd', data: absPath });
        }
    }

    RemoveSrcDir(absPath: string) {
        const index = this.config.srcDirs.findIndex((path) => { return path === absPath; });
        if (index !== -1) {
            this.config.srcDirs.splice(index, 1);
            this.emit('dataChanged', { type: 'srcRootRemoved', data: absPath });
        }
    }

    //======================== build-in ==============================

    private BuildIn_NewGroup(): DependenceGroup {
        return {
            groupName: ProjectConfiguration.BUILD_IN_GROUP_NAME,
            depList: []
        };
    }

    private BuildIn_NewDependence(): Dependence {
        return {
            name: 'default',
            incList: [],
            libList: [],
            defineList: []
        };
    }

    BuildIn_getDependence(): Dependence {

        const index = this.config.dependenceList.findIndex((dep) => {
            return dep.groupName === ProjectConfiguration.BUILD_IN_GROUP_NAME;
        });

        if (index === -1) {
            const dep = this.BuildIn_NewGroup();
            dep.depList.push(this.BuildIn_NewDependence());
            this.config.dependenceList.push(dep);
            return dep.depList[0];
        }

        const depIndex = this.config.dependenceList[index].depList.findIndex((dep) => {
            return dep.name === 'default';
        });

        if (depIndex === -1) {
            const nDep = this.BuildIn_NewDependence();
            this.config.dependenceList[index].depList.push(nDep);
            return nDep;
        }

        return this.config.dependenceList[index].depList[depIndex];
    }

    BuildIn_AddAllFromDefineList(defineList: string[]) {
        let needNotify: boolean = false;
        const dep = this.BuildIn_getDependence();

        defineList.forEach((define) => {
            if (!dep.defineList.includes(define)) {
                dep.defineList.push(define);
                needNotify = true;
            }
        });

        if (needNotify) {
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    BuildIn_RemoveAllDefines() {

        const dep = this.BuildIn_getDependence();
        const oldLen = dep.defineList.length;

        dep.defineList = []; // clear all

        if (oldLen !== dep.defineList.length) {
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    BuildIn_RemoveFromDefineList(_defineList: string[]) {

        const dep = this.BuildIn_getDependence();
        const oldLen = dep.defineList.length;

        dep.defineList = dep.defineList.filter((define) => {
            return !_defineList.includes(define);
        });

        if (oldLen !== dep.defineList.length) {
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    /////////////////////////////////////////////////////////
    // custom dependence
    /////////////////////////////////////////////////////////

    CustomDep_GetEnabledKeys(): string[] {
        return [
            'incList',
            'libList',
            'defineList'
        ];
    }

    private CustomDep_NewGroup(): DependenceGroup {
        return {
            groupName: ProjectConfiguration.CUSTOM_GROUP_NAME,
            depList: []
        };
    }

    private CustomDep_NewDependence(): Dependence {
        return {
            name: 'default',
            incList: [],
            libList: [],
            defineList: []
        };
    }

    CustomDep_getDependence(): Dependence {

        const index = this.config.dependenceList.findIndex((dep) => {
            return dep.groupName === ProjectConfiguration.CUSTOM_GROUP_NAME;
        });

        if (index === -1) {
            const group = this.CustomDep_NewGroup();
            group.depList.push(this.CustomDep_NewDependence());
            this.config.dependenceList.push(group);
            return group.depList[0];
        }

        const depIndex = this.config.dependenceList[index].depList.findIndex((dep) => {
            return dep.name === 'default';
        });

        if (depIndex === -1) {
            const nDep = this.CustomDep_NewDependence();
            this.config.dependenceList[index].depList.push(nDep);
            return nDep;
        }

        return this.config.dependenceList[index].depList[depIndex];
    }

    CustomDep_NotifyChanged() {
        this.emit('dataChanged', { type: 'dependence' });
    }

    // --- includePath

    CustomDep_AddIncDir(dir: File) {
        const dep = this.CustomDep_getDependence();
        if (!dep.incList.includes(dir.path)) {
            dep.incList.push(dir.path);
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    CustomDep_AddIncDirAtFirst(dir: File) {
        const dep = this.CustomDep_getDependence();
        if (!dep.incList.includes(dir.path)) {
            dep.incList.unshift(dir.path);
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    /**
     * @return duplicated paths list
    */
    CustomDep_AddIncFromPathList(pathList: string[]): string[] {

        let needNotify: boolean = false;
        const dupList: string[] = [];
        const dep = this.CustomDep_getDependence();

        pathList.forEach((path) => {
            if (!dep.incList.includes(path)) {
                dep.incList.push(path);
                needNotify = true;
            } else {
                dupList.push(path);
            }
        });

        if (needNotify) {
            this.emit('dataChanged', { type: 'dependence' });
        }

        return dupList;
    }

    CustomDep_ModifyIncDir(path: string, newPath: string) {
        if (path == newPath || newPath.trim() == '')
            return;
        const dep = this.CustomDep_getDependence();
        let index = dep.incList.findIndex((p) => { return p === path; });
        if (index !== -1) {
            dep.incList[index] = newPath;
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    CustomDep_RemoveIncDir(path: string) {
        const dep = this.CustomDep_getDependence();
        let index = dep.incList.findIndex((p) => { return p === path; });
        if (index !== -1) {
            dep.incList.splice(index, 1);
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    CustomDep_RemoveIncDirs(pathList: string[]) {
        const dep = this.CustomDep_getDependence();
        const oldLen = dep.incList.length;

        dep.incList = dep.incList.filter((incPath) => {
            return !pathList.includes(incPath);
        });

        if (oldLen !== dep.incList.length) {
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    // --- defines (macros)

    CustomDep_AddDefine(define: string) {
        const dep = this.CustomDep_getDependence();
        if (!dep.defineList.includes(define)) {
            dep.defineList.push(define);
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    CustomDep_AddAllFromDefineList(defineList: string[]) {
        let needNotify: boolean = false;
        const dep = this.CustomDep_getDependence();
        defineList.forEach((define) => {
            if (!dep.defineList.includes(define)) {
                dep.defineList.push(define);
                needNotify = true;
            }
        });

        if (needNotify) {
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    CustomDep_ModifyDefine(_define: string, newDefine: string) {
        if (_define == newDefine || newDefine.trim() == '')
            return;
        const dep = this.CustomDep_getDependence();
        let index = dep.defineList.findIndex((define) => { return define === _define; });
        if (index !== -1) {
            dep.defineList[index] = newDefine;
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    CustomDep_RemoveDefine(_define: string) {
        const dep = this.CustomDep_getDependence();
        let index = dep.defineList.findIndex((define) => { return define === _define; });
        if (index !== -1) {
            dep.defineList.splice(index, 1);
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    CustomDep_RemoveFromDefineList(_defineList: string[]) {

        const dep = this.CustomDep_getDependence();
        const oldLen = dep.defineList.length;

        dep.defineList = dep.defineList.filter((define) => {
            return !_defineList.includes(define);
        });

        if (oldLen !== dep.defineList.length) {
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    // --- libraries dir

    CustomDep_AddAllFromLibList(pathList: string[]) {

        let needNotify: boolean = false;
        const dep = this.CustomDep_getDependence();

        pathList.forEach((path) => {
            if (!dep.libList.includes(path)) {
                dep.libList.push(path);
                needNotify = true;
            }
        });

        if (needNotify) {
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    CustomDep_ModifyLib(path: string, newPath: string) {
        if (path == newPath || newPath.trim() == '')
            return;
        const dep = this.CustomDep_getDependence();
        let index = dep.libList.findIndex((p) => { return path === p; });
        if (index !== -1) {
            dep.libList[index] = newPath;
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    CustomDep_RemoveLib(path: string) {
        const dep = this.CustomDep_getDependence();
        let index = dep.libList.findIndex((p) => { return path === p; });
        if (index !== -1) {
            dep.libList.splice(index, 1);
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    // --- src dirs

    /* CustomDep_AddAllFromSourceList(_sourceList: string[]) {

        let needNotify: boolean = false;
        const dep = this.CustomDep_getDependence();
        _sourceList.forEach((source) => {
            if (!dep.sourceDirList.includes(source)) {
                dep.sourceDirList.push(source);
                needNotify = true;
            }
        });

        if (needNotify) {
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    CustomDep_RemoveSource(source: string) {
        const dep = this.CustomDep_getDependence();
        let index = dep.sourceDirList.findIndex((src) => { return src === source; });
        if (index !== -1) {
            dep.sourceDirList.splice(index, 1);
            this.emit('dataChanged', { type: 'dependence' });
        }
    } */

    // --- store

    cloneCurrentTarget(): ProjectTargetInfo {

        const target = this.config;

        const custom_dep = <Dependence>utility.deepCloneObject(this.CustomDep_getDependence());
        custom_dep.incList = custom_dep.incList.map((path) => this.toRelativePath(path));
        custom_dep.libList = custom_dep.libList.map((path) => this.toRelativePath(path));

        let builderOpts: any = {};
        if (target.targets[target.mode] &&
            target.targets[target.mode].builderOptions !== undefined) {
            builderOpts = utility.deepCloneObject(target.targets[target.mode].builderOptions);
        }

        return {
            excludeList: Array.from(target.excludeList),
            toolchain: target.toolchain,
            compileConfig: utility.deepCloneObject(target.compileConfig),
            uploader: target.uploader,
            uploadConfig: utility.deepCloneObject(target.uploadConfig),
            uploadConfigMap: utility.deepCloneObject(target.uploadConfigMap),
            custom_dep: custom_dep,
            builderOptions: builderOpts
        };
    }

    private recoverTarget(targetName?: string) {

        if (!targetName || !this.config.targets[targetName]) {
            // roll back to default target
            targetName = utility.getFirstKey(this.config.targets);
        }

        if (!targetName) {
            if (this.config.mode == undefined)
                throw new Error(`no any target can be recovered !`);
            else
                return; // not found any target can be recovered
        }

        const target = this.config.targets[targetName];

        if (!target)
            throw new Error(`not found target: '${targetName}' in 'eide.json' !`);

        this.config.mode = targetName;
        this.config.excludeList = Array.from(target.excludeList);

        this.config.toolchain = target.toolchain;
        this.config.compileConfig = utility.deepCloneObject(target.compileConfig);

        this.config.uploader = target.uploader;
        this.config.uploadConfig = utility.deepCloneObject(target.uploadConfig);
        this.config.uploadConfigMap = utility.deepCloneObject(target.uploadConfigMap);

        const custom_dep = this.CustomDep_getDependence();
        custom_dep.incList = Array.from(target.custom_dep.incList);
        custom_dep.libList = Array.from(target.custom_dep.libList);
        custom_dep.defineList = Array.from(target.custom_dep.defineList);
    }

    getProjectUsrCtxFile(): File {
        return File.fromArray([this.getRootDir().path, ProjectConfiguration.USR_CTX_FILE_NAME]);
    }

    getProjectUsrCtx(): ProjectUserContextData {

        const f = this.getProjectUsrCtxFile();

        if (f.IsFile()) {
            try {
                return JSON.parse(f.Read());
            } catch (error) {
                GlobalEvent.log_error(error);
                return {}; // empty obj
            }
        }

        return {}; // empty obj
    };

    setProjectUsrCtx(data: ProjectUserContextData) {

        const usrCtxFile = this.getProjectUsrCtxFile();

        let oldUsrCtxCont: string | undefined;
        if (usrCtxFile.IsExist()) {
            try {
                oldUsrCtxCont = usrCtxFile.Read();
            } catch (error) {
                GlobalEvent.log_error(error);
            }
        }

        try {
            let newUsrCtxCont = JSON.stringify(data, undefined, 4);
            if (oldUsrCtxCont != newUsrCtxCont) {
                usrCtxFile.Write(newUsrCtxCont);
            }
        } catch (error) {
            GlobalEvent.log_error(error);
        }
    }

    //---

    protected afterInitConfigData() {

        //
        // load target
        //

        // compatible missing field for old project
        let defCfg = <any>this.GetDefault(this.config.type);
        let curCfg = <any>this.config;
        for (const key in defCfg) {
            if (curCfg[key] == undefined &&
                EXCL_KEYS_IN_EIDE_JSON.includes(key) == false) {
                curCfg[key] = defCfg[key];
            }
        }

        // compatible virtualFolder field for old project
        if (Array.isArray(this.config.virtualFolder)) {
            this.config.virtualFolder = {
                name: VirtualSource.rootName,
                files: [],
                folders: this.config.virtualFolder
            };
        }

        //  old project(ver < 3.3) have 'mode' field
        //  new project(ver >= 3.3) not have 'mode' field
        if (this.config.mode == undefined) {
            const usrCtx = this.getProjectUsrCtx();
            this.recoverTarget(usrCtx.target);
        } else {
            // 如果是很旧的项目，则需要重新加载一次以更新项目数据
            this.needReloadProject = true;
        }

        // fill missing field after target recovered
        for (const key in defCfg) {
            if (curCfg[key] == undefined) {
                curCfg[key] = defCfg[key];
            }
        }

        //
        // format path
        //

        this.config.srcDirs = ArrayDelRepetition(this.config.srcDirs.map((path) => { return this.toAbsolutePath(path); }));

        for (const depGroup of this.config.dependenceList) {
            for (const dep of depGroup.depList) {
                dep.incList = ArrayDelRepetition(dep.incList.map((path) => { return this.toAbsolutePath(path); }));
                dep.libList = ArrayDelRepetition(dep.libList.map((path) => { return this.toAbsolutePath(path); }));
            }
        }
    }

    protected ToJson(): string {

        const eidePrjObj = <ProjectConfigData<T>>utility.deepCloneObject(this.config);

        //
        // store target 
        //

        eidePrjObj.targets[eidePrjObj.mode] = this.cloneCurrentTarget();

        //
        // convert abspath to relative path before save to file
        //

        eidePrjObj.srcDirs = eidePrjObj.srcDirs.map((path) => this.toRelativePath(path));

        // ignore some 'dynamic' dependence
        eidePrjObj.dependenceList = eidePrjObj.dependenceList.filter((g) => {
            return g.groupName !== ProjectConfiguration.BUILD_IN_GROUP_NAME
                && g.groupName !== ProjectConfiguration.CUSTOM_GROUP_NAME;
        });

        for (const depGroup of eidePrjObj.dependenceList) {
            for (const dep of depGroup.depList) {
                dep.incList = dep.incList.map((path) => this.toRelativePath(path));
                dep.libList = dep.libList.map((path) => this.toRelativePath(path));
            }
        }

        return utility.ToJsonStringExclude(eidePrjObj, EXCL_KEYS_IN_EIDE_JSON, 2);
    }

    Save(force?: boolean) {
        const usrCtx = this.getProjectUsrCtx();
        usrCtx.target = this.config.mode; // save current target
        this.setProjectUsrCtx(usrCtx);
        super.Save();
    }
}

//-------------------------------------------------------------------------

export interface CppBrowseInfo {
    databaseFilename?: string;
    limitSymbolsToIncludedHeaders?: boolean;
    path?: string[];
}

export interface CppConfigItem {
    name: string;
    includePath: string[];
    defines: string[];
    compilerPath?: string;
    compilerArgs?: string[];
    forcedInclude?: string[];
    browse?: CppBrowseInfo;
    intelliSenseMode?: string;
    cStandard?: string;
    cppStandard?: string;
    cCompilerArgs?: string[];
    cppCompilerArgs?: string[];
    configurationProvider?: string;
}

export interface CppConfig {
    configurations: CppConfigItem[];
    version: number;
}

export interface WorkspaceConfig {
    folders: { name?: string, path: string }[];
    settings?: any;
    [key: string]: any;
}

export class WorkspaceConfiguration extends Configuration<WorkspaceConfig> {

    isDelUnknownKeysWhenLoad = false;
    isLoadFailed = false;

    protected readTypeFromFile(configFile: File): ProjectType | undefined {
        return undefined;
    }

    protected Parse(jsonStr: string): WorkspaceConfig {
        try {
            const obj = <any>jsonc.parse(jsonStr);
            this.isLoadFailed = false;
            return obj;
        } catch (error) {
            GlobalEvent.log_error(error);
            GlobalEvent.emit('msg', newMessage('Warning', 
                view_str$prompt$loadws_cfg_failed.replace('{}', this.FILE_NAME)));
            this.isLoadFailed = true;
            return this.GetDefault();
        }
    }

    protected ToJson(): string {
        return jsonc.stringify(this.config, undefined, 4);
    }

    // workspace only can be force save, because user will modify this file, 
    // so we can not override it
    Save(force?: boolean) {
        if (force)
            super.Save();
    }

    GetDefault(): WorkspaceConfig {
        return {
            folders: [
                {
                    path: "."
                }
            ],
            settings: {},
            extensions: {}
        };
    }
}