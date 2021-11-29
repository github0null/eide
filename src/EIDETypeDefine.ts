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
import { FileWatcher } from "../lib/node-utility/FileWatcher";
import {
    include_desc, lib_desc, source_dir_desc, definition_list_desc,
    view_str$compile$storageLayout, view_str$compile$useCustomScatterFile, view_str$compile$scatterFilePath,
    view_str$compile$floatingPointHardware, view_str$compile$cpuType, view_str$compile$deprecated,
    view_str$compile$options,
    view_str$flasher$binPath,
    view_str$flasher$eepromPath,
    view_str$flasher$options,
    view_str$flasher$interfaceType,
    view_str$flasher$cpuName,
    view_str$flasher$downloadSpeed,
    view_str$flasher$baseAddr,
    view_str$flasher$optionBytesPath,
    view_str$flasher$launchApp,
    view_str$flasher$targetName,
    view_str$flasher$commandLine,
    view_str$compile$cpuVendor,
    view_str$flasher$openocd_target_cfg,
    view_str$flasher$openocd_interface_cfg,
    view_str$flasher$optionBytesConfig,
    view_str$flasher$external_loader,
    view_str$flasher$resetMode,
    view_str$flasher$other_cmds
} from "./StringTable";
import { ResManager } from "./ResManager";
import { ArrayDelRepetition } from "../lib/node-utility/Utility";
import { GlobalEvent } from "./GlobalEvents";
import { ExceptionToMessage, newMessage } from "./Message";
import { ToolchainName, IToolchian, ToolchainManager } from './ToolchainManager';
import { HexUploaderType, STLinkOptions, STVPFlasherOptions, C51FlashOption, JLinkOptions, ProtocolType, PyOCDFlashOptions, OpenOCDFlashOptions, STLinkProtocolType, CustomFlashOptions } from "./HexUploader";

import * as events from 'events';
import * as os from 'os';
import * as vscode from 'vscode';
import * as NodePath from 'path';
import { isNullOrUndefined } from "util";
import { AbstractProject } from "./EIDEProject";
import { SettingManager } from "./SettingManager";

import { jsonc } from 'jsonc';
import { WorkspaceManager } from "./WorkspaceManager";
import * as utility from './utility'

// -------------------------------------------

export const EIDE_CONF_VERSION = '2.6';

// -------------------------------------------

export abstract class ManagerInterface {
    abstract Init(): void;
}

export interface FileItem {
    file: File;
    disabled?: boolean; // for mdk file info
}

export interface FileGroup {
    name: string;       // dir name if it's system folder, else it's a virtual path
    files: FileItem[];
    disabled?: boolean; // for mdk group info
}

export interface ProjectFileGroup extends FileGroup {
    dir: File;
    isRoot: boolean;
}

export type ProjectType = 'C51' | 'ARM' | 'RISC-V';

export interface CreateOptions {
    name: string; // folder name
    outDir: File;
    templateFile?: File;
    type: ProjectType;
}

export interface ImportOptions {
    outDir: File;
    projectFile: File;
    createNewFolder?: boolean;
}

export interface Memory {
    startAddr: string;
    size: string;
}

export interface DeviceInfo {
    name: string;
    devClassName: string;
    core?: string;
    define?: string;
    endian?: string;
    svdPath?: string;
    storageLayout: ARMStorageLayout;
}

export interface SubFamily {
    name: string;
    core?: string;
    deviceList: DeviceInfo[];
}

export interface DeviceFamily {
    name: string;
    vendor: string;
    core?: string;
    series: string;
    deviceList: DeviceInfo[];
    subFamilyList: SubFamily[];
}

export interface ComponentFileItem {
    attr?: string;
    condition?: string;
    path: string;
}

export interface Component {
    groupName: string;
    description?: string;
    enable: boolean;
    RTE_define?: string;
    incDirList: ComponentFileItem[];
    headerList: ComponentFileItem[];
    cFileList: ComponentFileItem[];
    asmList: ComponentFileItem[];
    libList?: ComponentFileItem[];
    linkerList?: ComponentFileItem[];
    defineList?: string[];
    condition?: string;
}

export function getComponentKeyDescription(key: string): string {
    switch (key) {
        case 'incDirList':
            return 'Include Path List';
        case 'headerList':
            return 'Header File List';
        case 'cFileList':
            return 'Source File List';
        case 'asmList':
            return 'Assembly File List';
        case 'libList':
            return 'Library Path List';
        case 'linkerList':
            return 'Linker File List';
        default:
            return 'Other List';
    }
}

export interface Condition {
    condition?: string;
    Dvendor?: string;
    Dname?: RegExp;
    compiler?: string;
    compilerOption?: string;
}

export interface ConditionGroup {
    acceptList: Condition[];
    requireList: Condition[];
}

export type ConditionMap = Map<string, ConditionGroup>;

export interface PackInfo {
    vendor: string;
    name: string;
    familyList: DeviceFamily[];
    components: Component[];
    conditionMap: ConditionMap;
}

export interface CurrentDevice {
    packInfo: PackInfo;
    familyIndex: number;
    subFamilyIndex: number;
    deviceIndex: number;
}

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

    private _eventMergeFlag: boolean;
    private _eventCache: EventItem[];

    protected watcher: FileWatcher;
    protected _event: events.EventEmitter;

    constructor(configFile: File, type?: ProjectType) {
        this._event = new events.EventEmitter();
        this._eventMergeFlag = false;
        this._eventCache = [];
        this.FILE_NAME = configFile.name;
        this.watcher = new FileWatcher(configFile, false);
        this.watcher.on('error', (err) => GlobalEvent.emit('error', err));
        this.watcher.OnChanged = () => this.Update(this.watcher.file.Read());
        this.config = this.GetDefault(this.readTypeFromFile(configFile) || type);
        this.Init(configFile);
    }

    protected Init(f: File) {
        if (f.IsFile()) {
            this.Update(f.Read());
        } else {
            f.Write(this.ToJson());
        }
    }

    Dispose(): void {
        this.watcher.Close();
    }

    GetFile(): File {
        return this.watcher.file;
    }

    Watch() {
        this.watcher.Watch();
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

    Update(json: string | object): void {

        const _configFromFile: any = (typeof json === 'string') ? this.Parse(json) : json;

        // clear invalid property
        for (const key in (<any>_configFromFile)) {
            if ((<any>this.config)[key] === undefined) {
                _configFromFile[key] = undefined;
            }
        }

        // set default value for error value property
        for (const key in (<any>this.config)) {
            if (!isNullOrUndefined((<any>this.config)[key])) {
                if (typeof _configFromFile[key] !== typeof (<any>this.config)[key]) {
                    _configFromFile[key] = (<any>this.config)[key];
                }
            }
        }

        // set config
        this.config = _configFromFile;

        this.RefreshAfterConfigUpdate();

        this._event.emit('dataChanged');
    }

    protected RefreshAfterConfigUpdate() {
        // do nothing
    }

    Save(replacer?: (this: any, key: string, value: any) => any, space?: string | number): void {
        this.watcher.file.Write(this.ToJson(replacer, space));
    }

    protected Parse(jsonStr: string): ConfigType {
        return <ConfigType>JSON.parse(jsonStr);
    }

    protected ToJson(replacer?: (this: any, key: string, value: any) => any, space?: string | number): string {
        return JSON.stringify(this.config, replacer, space);
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

export interface Dependence {
    name: string;
    incList: string[];
    libList: string[];
    sourceDirList: string[];
    defineList: string[];
}

export interface DependenceGroup {
    groupName: string;
    depList: Dependence[];
}

export interface ProjectMiscInfo {
    uid: string | undefined;
}

export interface ProjectTargetInfo {
    excludeList: string[];
    toolchain: ToolchainName;
    compileConfig: any;
    uploader: HexUploaderType;
    uploadConfig: any | null;
    uploadConfigMap: { [uploader: string]: any };
    custom_dep: Dependence;
}

export interface VirtualFile {
    path: string;
}

export interface VirtualFolder {
    name: string;
    files: VirtualFile[];
    folders: VirtualFolder[];
}

export interface ProjectConfigData<T extends CompileData> {

    name: string;
    type: ProjectType;
    mode: string; // target name

    // cur target info
    excludeList: string[];
    toolchain: ToolchainName;
    compileConfig: T;
    uploader: HexUploaderType;
    uploadConfig: any | null;
    uploadConfigMap: { [uploader: string]: any };

    // all targets
    targets: { [target: string]: ProjectTargetInfo };

    // source
    srcDirs: string[];
    virtualFolder: VirtualFolder[];

    dependenceList: DependenceGroup[];
    outDir: string;
    deviceName: string | null;
    packDir: string | null;
    miscInfo: ProjectMiscInfo;
    version: string;
}

export type ProjectConfigEventType =
    'dependence' | 'srcRootAdd' | 'srcRootRemoved' | 'compiler' | 'uploader';

export interface ProjectConfigEvent {
    type: ProjectConfigEventType;
    data?: any;
}

export class ProjectConfiguration<T extends CompileData>
    extends Configuration<ProjectConfigData<T>, ProjectConfigEvent> {

    static readonly BUILD_IN_GROUP_NAME = 'build-in';
    static readonly CUSTOM_GROUP_NAME = 'custom';
    static readonly MERGE_DEP_NAME = 'merge';

    compileConfigModel: CompileConfigModel<any>;
    uploadConfigModel: UploadConfigModel<any>;

    private rootDir: File | undefined;

    constructor(f: File, type?: ProjectType) {
        super(f, type);

        this.compileConfigModel = CompileConfigModel.getInstance(this.config);
        this.uploadConfigModel = UploadConfigModel.getInstance(this.config.uploader);

        this.compileConfigModel.Update(this.config.compileConfig);
        this.config.compileConfig = this.compileConfigModel.data;
        this.compileConfigModel.on('dataChanged', () => this.emit('dataChanged', { type: 'compiler' }));

        this.uploadConfigModel.Update(this.config.uploadConfig);
        this.config.uploadConfig = this.uploadConfigModel.data;
        this.uploadConfigModel.on('dataChanged', () => this.emit('dataChanged', { type: 'uploader' }));

        // update upload model
        this.compileConfigModel.on('dataChanged', () => {
            this.uploadConfigModel.emit('NotifyUpdate', this);
        });
    }

    protected Init(f: File) {
        // init project root folder before constructor
        this.rootDir = new File(NodePath.dirname(this.GetFile().dir));
        // init superclass
        super.Init(f);
    }

    private getRootDir(): File {
        return <File>this.rootDir;
    }

    private toAbsolutePath(path: string): string {
        const _path = path.trim();
        if (NodePath.isAbsolute(_path)) {
            return _path;
        }
        return NodePath.normalize(this.getRootDir().path + File.sep + _path);
    }

    private toRelativePath(path: string): string {

        if (!NodePath.isAbsolute(path)) {
            return path;
        }

        const rePath = NodePath.relative(this.getRootDir().path, path);
        if (NodePath.isAbsolute(rePath)) {
            return rePath;
        }

        return `.${NodePath.sep}${rePath}`;
    }

    private MergeDepList(depList: Dependence[], name?: string): Dependence {

        const merge: Dependence = {
            name: name ? name : ProjectConfiguration.MERGE_DEP_NAME,
            incList: [],
            libList: [],
            defineList: [],
            sourceDirList: []
        };

        depList.forEach(dep => {
            merge.defineList = merge.defineList.concat(dep.defineList);
            merge.sourceDirList = merge.sourceDirList.concat(dep.sourceDirList);
            merge.libList = merge.libList.concat(dep.libList);
            merge.incList = merge.incList.concat(dep.incList);
        });

        // clear duplicate
        merge.defineList = ArrayDelRepetition(merge.defineList);
        merge.sourceDirList = ArrayDelRepetition(merge.sourceDirList);
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
                    uploader: 'stcgal',
                    dependenceList: [],
                    compileConfig: SdccCompileConfigModel.getDefaultConfig(),
                    srcDirs: [],
                    virtualFolder: [],
                    excludeList: [],
                    outDir: '.\\build',
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
                    virtualFolder: [],
                    excludeList: [],
                    outDir: '.\\build',
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
                    virtualFolder: [],
                    excludeList: [],
                    outDir: '.\\build',
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

        // save old config
        this.config.uploadConfigMap[oldModel.uploader] = utility.copyObject(oldModel.data);

        // update new config
        this.uploadConfigModel = UploadConfigModel.getInstance(uploader);
        this.config.uploader = uploader;
        this.uploadConfigModel.data =
            utility.copyObject(this.config.uploadConfigMap[uploader]) || this.uploadConfigModel.data;
        this.config.uploadConfig = this.uploadConfigModel.data; // bind obj

        // update listeners
        this.uploadConfigModel.copyListenerFrom(oldModel);

        // update compileConfigModel listener
        this.compileConfigModel.on('dataChanged', () => {
            this.uploadConfigModel.emit('NotifyUpdate', this);
        });
    }

    setToolchain(toolchain: ToolchainName) {

        const oldModel = this.compileConfigModel;
        this.config.toolchain = toolchain; // update toolchain name
        this.compileConfigModel = CompileConfigModel.getInstance(this.config);
        this.config.compileConfig = this.compileConfigModel.data; // bind obj

        // update config
        this.compileConfigModel.copyCommonCompileConfigFrom(oldModel);

        // update listeners
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

    GetDepKeyDesc(key: string): string {
        switch (key) {
            case 'incList':
                return include_desc;
            case 'libList':
                return lib_desc;
            case 'sourceDirList':
                return source_dir_desc;
            case 'defineList':
                return definition_list_desc;
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
            this.config.srcDirs = [absPath].concat(this.config.srcDirs);
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
            sourceDirList: [],
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

    //======================== custom ================================

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
            sourceDirList: [],
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

    CustomDep_RemoveInvalidIncDirs() {
        const dep = this.CustomDep_getDependence();
        dep.incList = dep.incList.filter((_path) => { return new File(_path).IsDir(); });
        dep.libList = dep.libList.filter((_path) => { return new File(_path).IsDir(); });
        dep.sourceDirList = dep.sourceDirList.filter((_path) => { return new File(_path).IsDir(); });
    }

    CustomDep_AddIncDir(dir: File) {
        const dep = this.CustomDep_getDependence();
        if (!dep.incList.includes(dir.path)) {
            dep.incList.push(dir.path);
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    CustomDep_AddIncFromPathList(pathList: string[]) {
        let needNotify: boolean = false;
        const dep = this.CustomDep_getDependence();
        pathList.forEach((path) => {
            if (!dep.incList.includes(path)) {
                dep.incList.push(path);
                needNotify = true;
            }
        });

        if (needNotify) {
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    CustomDep_RemoveIncDir(_path: string) {
        const dep = this.CustomDep_getDependence();
        let index = dep.incList.findIndex((path) => { return path === _path; });
        if (index !== -1) {
            dep.incList.splice(index, 1);
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    CustomDep_RemoveIncDirs(_dirList: string[]) {
        const dep = this.CustomDep_getDependence();
        const oldLen = dep.incList.length;

        dep.incList = dep.incList.filter((incPath) => {
            return !_dirList.includes(incPath);
        });

        if (oldLen !== dep.incList.length) {
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    //--------------------------------------------

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

    //---------------------------lib----------------------

    CustomDep_AddAllFromLibList(_libList: string[]) {

        let needNotify: boolean = false;
        const dep = this.CustomDep_getDependence();
        _libList.forEach((lib) => {
            if (!dep.libList.includes(lib)) {
                dep.libList.push(lib);
                needNotify = true;
            }
        });

        if (needNotify) {
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    CustomDep_RemoveLib(_lib: string) {
        const dep = this.CustomDep_getDependence();
        let index = dep.libList.findIndex((lib) => { return _lib === lib; });
        if (index !== -1) {
            dep.libList.splice(index, 1);
            this.emit('dataChanged', { type: 'dependence' });
        }
    }

    //--------------------------source----------------------

    CustomDep_AddAllFromSourceList(_sourceList: string[]) {

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
    }

    //---

    protected RefreshAfterConfigUpdate() {

        // convert to abs path

        this.config.srcDirs = ArrayDelRepetition(this.config.srcDirs.map((path) => { return this.toAbsolutePath(path); }));

        for (const depGroup of this.config.dependenceList) {
            for (const dep of depGroup.depList) {
                dep.incList = ArrayDelRepetition(dep.incList.map((path) => { return this.toAbsolutePath(path); }));
                dep.libList = ArrayDelRepetition(dep.libList.map((path) => { return this.toAbsolutePath(path); }));
                dep.sourceDirList = ArrayDelRepetition(dep.sourceDirList.map((path) => { return this.toAbsolutePath(path); }));
            }
        }
    }

    Save() {

        // restore old obj
        const oldSrcDirs = JSON.parse(JSON.stringify(this.config.srcDirs));
        const oldDepList = JSON.parse(JSON.stringify(this.config.dependenceList));

        /* convert to relative path */

        this.config.srcDirs = this.config.srcDirs.map((path) => { return this.toRelativePath(path); });

        this.config.dependenceList = this.config.dependenceList.filter((g) => {
            return g.groupName !== ProjectConfiguration.BUILD_IN_GROUP_NAME; /* ignore build-in dep */
        });

        for (const depGroup of this.config.dependenceList) {
            for (const dep of depGroup.depList) {
                dep.incList = dep.incList.map((path) => { return this.toRelativePath(path); });
                dep.libList = dep.libList.map((path) => { return this.toRelativePath(path); });
                dep.sourceDirList = dep.sourceDirList.map((path) => { return this.toRelativePath(path); });
            }
        }

        super.Save(undefined);

        // recover it
        this.config.srcDirs = oldSrcDirs;
        this.config.dependenceList = oldDepList;
    }
}

// ======================== config base =============================

type FieldType = 'INPUT' | 'INPUT_INTEGER' | 'SELECTION' | 'OPEN_FILE' | 'EVENT' | 'Disable';
/*
    'hex file': ['hex'],
    'bin file': ['bin'],
*/
type OpenFileFilter = { [name: string]: string[] };

interface CompileConfigPickItem extends vscode.QuickPickItem {
    val?: any;
}

export interface EventData {
    event: 'openCompileOptions' | 'openMemLayout' | 'openUploadOptions';
    data?: any;
}

export type KeyIcon =
    'ConnectUnplugged_16x.svg' |
    'BinaryFile_16x.svg' |
    'Property_16x.svg' |
    'Memory_16x.svg' |
    'ConfigurationEditor_16x.svg' |
    'CPU_16x.svg' |
    'terminal_16x.svg';

export abstract class ConfigModel<DataType> {

    data: DataType;

    readonly boolList = [
        false,
        true
    ];

    protected _event: events.EventEmitter;

    constructor() {
        this._event = new events.EventEmitter();
        this.data = this.GetDefault();
    }

    on(event: 'dataChanged', listener: () => void): void;
    on(event: 'event', listener: (event: EventData) => void): void;
    on(event: 'NotifyUpdate', listener: (prjConfig: ProjectConfiguration<any>) => void): void;
    on(event: any, listener: (arg?: any) => void): void {
        this._event.on(event, listener);
    }

    emit(event: 'NotifyUpdate', prjConfig: ProjectConfiguration<any>): void;
    emit(event: any, arg?: any): void {
        this._event.emit(event, arg);
    }

    copyListenerFrom(model: ConfigModel<any>) {

        // delete some current listeners
        this._event.eventNames().forEach((event) => {
            if (event == 'NotifyUpdate') return; // skip 'NotifyUpdate' event
            this._event.rawListeners(event).forEach((func) => {
                this._event.removeListener(event, <any>func);
            });
        });

        // copy some listeners from old
        model._event.eventNames().forEach((event) => {
            if (event == 'NotifyUpdate') return; // skip 'NotifyUpdate' event
            model._event.rawListeners(event).forEach((func) => {
                this._event.addListener(event, <any>func);
            });
        });
    }

    async ShowModifyWindow(key: string, prjRootDir: File) {

        const keyType = this.GetKeyType(key);

        switch (keyType) {
            case 'INPUT':
            case 'INPUT_INTEGER':
                {
                    const val = await vscode.window.showInputBox({
                        value: (<any>this.data)[key],
                        ignoreFocusOut: true,
                        validateInput: (input: string): string | undefined => {
                            return this.VerifyString(key, input);
                        }
                    });

                    switch (keyType) {
                        case 'INPUT':
                            this.SetKeyValue(key, val?.trim());
                            break;
                        case 'INPUT_INTEGER':
                            if (val) {
                                const num = parseInt(val);
                                if (num !== NaN) {
                                    this.SetKeyValue(key, num);
                                }
                            }
                            break;
                        default:
                            break;
                    }
                }
                break;
            case 'SELECTION':
                {
                    const itemList = this.GetSelectionList(key) || [];

                    const pickItem = await vscode.window.showQuickPick(itemList, {
                        canPickMany: false,
                        matchOnDescription: true,
                        placeHolder: `found ${itemList.length} results`
                    });

                    if (pickItem) {
                        this.SetKeyValue(key, pickItem.val !== undefined ? pickItem.val : pickItem.label);
                    }
                }
                break;
            case 'OPEN_FILE':
                {
                    const uri = await vscode.window.showOpenDialog({
                        defaultUri: vscode.Uri.parse(prjRootDir.ToUri()),
                        filters: this.GetOpenFileFilters(key) || { '*.*': ['*'] },
                        canSelectFiles: true,
                        canSelectMany: this.IsOpenFileCanSelectMany(key)
                    });

                    if (uri && uri.length > 0) {
                        const path = uri
                            .map((uri_item) => { return prjRootDir.ToRelativePath(uri_item.fsPath) || uri_item.fsPath; })
                            .join(',');
                        this.SetKeyValue(key, path);
                    }
                }
                break;
            case 'EVENT':
                const eData = this.getEventData(key);
                if (eData) {
                    this._event.emit('event', eData);
                }
                break;
            default:
                break;
        }
    }

    SetKeyValue(key: string, value: any) {
        if (value !== undefined) {
            (<any>this.data)[key] = value;
            this.onPropertyChanged(key);
            this._event.emit('dataChanged');
        }
    }

    Update(newConfig?: DataType): void {
        this.data = this.UpdateConfigData(newConfig);
        this._event.emit('datachanged');
    }

    isKeyEnable(key: string): boolean {
        return true;
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        return 'Property_16x.svg';
    }

    protected UpdateConfigData(newConfig?: DataType): DataType {

        const _default: any = this.GetDefault();

        if (newConfig) {

            // clear invalid property
            for (const key in (<any>newConfig)) {
                if (_default[key] === undefined) {
                    (<any>newConfig)[key] = undefined;
                }
            }

            // set default value
            for (const key in _default) {
                if (!isNullOrUndefined(_default[key])) {
                    if (typeof (<any>newConfig)[key] !== typeof _default[key]) {
                        (<any>newConfig)[key] = _default[key];
                    }
                }
            }

            return newConfig;
        }

        return _default;
    }

    protected onPropertyChanged(key: string) {
        // TODO
    }

    protected IsOpenFileCanSelectMany(key: string): boolean {
        return false;
    }

    abstract GetKeyDescription(key: string): string;

    abstract getKeyValue(key: string): string;

    protected abstract GetKeyType(key: string): FieldType;

    protected abstract GetOpenFileFilters(key: string): OpenFileFilter | undefined;

    protected abstract VerifyString(key: string, input: string): string | undefined;

    protected abstract GetSelectionList(key: string): CompileConfigPickItem[] | undefined;

    protected abstract getEventData(key: string): EventData | undefined;

    abstract GetDefault(): DataType;
}

//////////////////////////////////////////////////////////////////////////////////
//                           Compiler Models
//////////////////////////////////////////////////////////////////////////////////

interface CompileData { }

export interface ICompileOptions {
    version: number;
    beforeBuildTasks?: any[];
    afterBuildTasks?: any[];
    global?: any;
    ['c/cpp-compiler']?: any;
    ['asm-compiler']?: any;
    linker?: any;
}

export abstract class CompileConfigModel<T> extends ConfigModel<T> {

    protected prjConfigData: ProjectConfigData<any>;

    constructor(config: ProjectConfigData<any>) {
        super();
        this.prjConfigData = config;
    }

    static getInstance<T extends CompileData>(prjConfigData: ProjectConfigData<any>): CompileConfigModel<T> {
        switch (prjConfigData.toolchain) {
            case 'SDCC':
                return <any>new SdccCompileConfigModel(prjConfigData);
            case 'Keil_C51':
                return <any>new Keil51CompileConfigModel(prjConfigData);
            case 'IAR_STM8':
                return <any>new Iarstm8CompileConfigModel(prjConfigData);
            case 'AC5':
                return <any>new Armcc5CompileConfigModel(prjConfigData);
            case 'AC6':
                return <any>new Armcc6CompileConfigModel(prjConfigData);
            case 'GCC':
                return <any>new GccCompileConfigModel(prjConfigData);
            case 'RISCV_GCC':
                return <any>new RiscvCompileConfigModel(prjConfigData);
            case 'GNU_SDCC_STM8':
                return <any>new SdccGnuStm8CompileConfigModel(prjConfigData);
            default:
                throw new Error('Unsupported toolchain: ' + prjConfigData.toolchain);
        }
    }

    getOptions(eideFolderPath: string, prjConfig: ProjectConfigData<T>): ICompileOptions {
        try {
            const options = JSON.parse(this.getOptionsFile(eideFolderPath, prjConfig).Read());
            return options;
        } catch (error) {
            GlobalEvent.emit('msg', newMessage('Warning', 'Builder options file format error !, use default options !'));
            const toolchain = ToolchainManager.getInstance().getToolchain(prjConfig.type, prjConfig.toolchain);
            const options = toolchain.getDefaultConfig();
            return options;
        }
    }

    getOptionsFile(eideFolderPath: string, prjConfig: ProjectConfigData<T>): File {

        const toolchain = ToolchainManager.getInstance().getToolchain(prjConfig.type, prjConfig.toolchain);

        let configName: string = toolchain.configName;
        const targetName = prjConfig.mode.toLowerCase();

        if (targetName !== 'release') { // ignore 'release' target
            configName = `${targetName}.${configName}`;
        }

        const opFile = File.fromArray([eideFolderPath, configName]);
        if (!opFile.IsFile()) {
            opFile.Write(JSON.stringify(toolchain.getDefaultConfig(), undefined, 4));
        }

        return opFile;
    }

    copyCommonCompileConfigFrom(model: CompileConfigModel<T>) {
        // do nothing
    }
}

// ------ ARM -------

export type RAMTag = 'IRAM' | 'RAM';
export type ROMTag = 'IROM' | 'ROM';

export interface ARMRamItem {
    tag: RAMTag;
    id: number;
    mem: Memory;
    isChecked: boolean;
    noInit: boolean;
}

export interface ARMRomItem {
    tag: ROMTag;
    id: number;
    mem: Memory;
    isChecked: boolean;
    isStartup: boolean;
}

export interface ARMStorageLayout {
    RAM: ARMRamItem[];
    ROM: ARMRomItem[];
}

export type FloatingHardwareOption = 'no_dsp' | 'none' | 'single' | 'double';

export interface ArmBaseCompileData extends CompileData {
    cpuType: string;
    floatingPointHardware: FloatingHardwareOption;
    useCustomScatterFile: boolean;
    scatterFilePath: string;
    storageLayout: ARMStorageLayout;
    options: string;
}

/**
 * @note We need export this class, becasue we need export internal functions 
 * */
export abstract class ArmBaseCompileConfigModel
    extends CompileConfigModel<ArmBaseCompileData> {

    protected cpuTypeList = [
        'Cortex-M0',
        'Cortex-M0+',
        'Cortex-M3',
        'Cortex-M4',
        'Cortex-M7'
    ];

    protected hardwareOptionList: { name: FloatingHardwareOption, desc: string }[] = [
        { name: 'none', desc: 'not use' },
        { name: 'single', desc: 'single precision' },
        { name: 'double', desc: 'double precision' }
    ];

    onPropertyChanged(key: string) {
        switch (key) {
            case 'cpuType':
                if (!this.verifyHardwareOption(this.data.floatingPointHardware)) {
                    this.data.floatingPointHardware = 'none';
                }
                break;
            default:
                break;
        }
    }

    copyCommonCompileConfigFrom(model: ArmBaseCompileConfigModel) {
        this.data.cpuType = model.data.cpuType;
        this.data.floatingPointHardware = model.data.floatingPointHardware;
    }

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'cpuType':
                return view_str$compile$cpuType;
            case 'storageLayout':
                return view_str$compile$storageLayout;
            case 'useCustomScatterFile':
                return view_str$compile$useCustomScatterFile;
            case 'scatterFilePath':
                return view_str$compile$scatterFilePath;
            case 'floatingPointHardware':
                return view_str$compile$floatingPointHardware;
            case 'options':
                return view_str$compile$options;
            default:
                return view_str$compile$deprecated;
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'cpuType':
                return 'CPU_16x.svg';
            case 'storageLayout':
                return 'Memory_16x.svg';
            case 'options':
                return 'ConfigurationEditor_16x.svg';
            default:
                return 'Property_16x.svg';
        }
    }

    getKeyValue(key: string): string {
        switch (key) {
            case 'storageLayout':
                return 'View {...}';
            case 'useCustomScatterFile':
                return this.data.useCustomScatterFile ? 'true' : 'false';
            case 'options':
                return 'Object {...}';
            default:
                return (<any>this.data)[key] || 'null';
        }
    }

    isKeyEnable(key: string): boolean {

        const toolchain = this.prjConfigData.toolchain;

        if (toolchain === 'AC5' || toolchain === 'AC6') {
            switch (key) {
                case 'cpuType':
                case 'useCustomScatterFile':
                case 'options':
                    return true;
                case 'floatingPointHardware':
                    return ['cortex-m33', 'cortex-m4', 'cortex-m7'].includes(this.data.cpuType.toLowerCase());
                case 'storageLayout':
                    return !this.data.useCustomScatterFile;
                case 'scatterFilePath':
                    return this.data.useCustomScatterFile;
                default:
                    return false;
            }
        } else {
            switch (key) {
                case 'cpuType':
                case 'scatterFilePath':
                case 'options':
                    return true;
                case 'floatingPointHardware':
                    return ['cortex-m33', 'cortex-m4', 'cortex-m7'].includes(this.data.cpuType.toLowerCase());
                default:
                    return false;
            }
        }
    }

    Update(newConfig?: ArmBaseCompileData) {
        this.data = this.UpdateConfigData(newConfig);
        this.sortStorage(this.data.storageLayout);
        this._event.emit('datachanged');
    }

    getIRAMx(id: number): Memory | undefined {
        for (const ram of this.data.storageLayout.RAM) {
            if (ram.tag === 'IRAM' && ram.id === id) {
                return ram.mem;
            }
        }
        return undefined;
    }

    getIROMx(id: number): Memory | undefined {
        for (const rom of this.data.storageLayout.ROM) {
            if (rom.tag === 'IROM' && id === rom.id) {
                return rom.mem;
            }
        }
        return undefined;
    }

    updateStorageLayout(newLayout: ARMStorageLayout) {
        this.data.storageLayout = this.sortStorage(newLayout);
        this._event.emit('datachanged');
    }

    sortStorage(storageLayout: ARMStorageLayout): ARMStorageLayout {

        storageLayout.RAM = storageLayout.RAM.sort((a, b): number => {

            if (a.tag === 'IRAM' && b.tag === 'IRAM') {
                return a.id - b.id;
            }

            if (a.tag === 'IRAM' || b.tag === 'IRAM') {
                return a.tag === 'IRAM' ? 1 : -1;
            }

            if (a.id !== -1 && b.id !== -1) {
                return a.id - b.id;
            }

            return parseInt(a.mem.startAddr, 16) < parseInt(b.mem.startAddr, 16) ? -1 : 1;
        });

        let id = 1;
        storageLayout.RAM.forEach((ram) => {
            if (ram.tag === 'RAM') {
                ram.id = id++;
            }
        });

        storageLayout.ROM = storageLayout.ROM.sort((a, b): number => {

            if (a.tag === 'IROM' && b.tag === 'IROM') {
                return a.id - b.id;
            }

            if (a.tag === 'IROM' || b.tag === 'IROM') {
                return a.tag === 'IROM' ? 1 : -1;
            }

            if (a.id !== -1 && b.id !== -1) {
                return a.id - b.id;
            }

            return parseInt(a.mem.startAddr, 16) < parseInt(b.mem.startAddr, 16) ? -1 : 1;
        });

        id = 1;
        storageLayout.ROM.forEach((rom) => {
            if (rom.tag === 'ROM') {
                rom.id = id++;
            }
        });

        return storageLayout;
    }

    protected VerifyString(key: string, input: string): string | undefined {
        return undefined;
    }

    protected verifyHardwareOption(optionName: string): boolean {
        switch (optionName) {
            case 'single':
                return ['cortex-m33', 'cortex-m4', 'cortex-m7'].includes(this.data.cpuType.toLowerCase());
            case 'double':
                return ['cortex-m7'].includes(this.data.cpuType.toLowerCase());
            case 'none':
                return ['cortex-m33', 'cortex-m4', 'cortex-m7'].includes(this.data.cpuType.toLowerCase());
            case 'no_dsp':
                return ['cortex-m33'].includes(this.data.cpuType.toLowerCase());
            default:
                return false;
        }
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] {

        const res: CompileConfigPickItem[] = [];

        switch (key) {
            case 'cpuType':
                this.cpuTypeList.forEach((type) => {
                    res.push({
                        label: type
                    });
                });
                break;
            case 'floatingPointHardware':
                this.hardwareOptionList.filter((option) => {
                    return this.verifyHardwareOption(option.name);
                }).forEach((option) => {
                    res.push({
                        label: option.name,
                        description: option.desc
                    });
                });
                break;
            default:
                this.boolList.forEach((val) => {
                    res.push({
                        label: JSON.stringify(val),
                        val: val
                    });
                });
                break;
        }

        return res;
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'scatterFilePath':
                return 'OPEN_FILE';
            case 'cpuType':
            case 'floatingPointHardware':
            case 'useCustomScatterFile':
                return 'SELECTION';
            case 'storageLayout':
            case 'options':
                return 'EVENT';
            default:
                return 'Disable';
        }
    }

    protected getEventData(key: string): EventData | undefined {
        switch (key) {
            case 'storageLayout':
                return {
                    event: 'openMemLayout'
                };
            case 'options':
                return {
                    event: 'openCompileOptions'
                };
            default:
                return undefined;
        }
    }

    protected IsOpenFileCanSelectMany(key: string): boolean {
        switch (key) {
            case 'scatterFilePath':
                return true;
            default:
                return super.IsOpenFileCanSelectMany(key);
        }
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            case 'scatterFilePath':
                return {
                    'gcc linker script': ['ld', 'lds'],
                    'armcc scatter file': ['sct'],
                    'all': ['*']
                };
            default:
                return undefined;
        }
    }

    static getDefaultConfig(): ArmBaseCompileData {
        return {
            cpuType: 'Cortex-M3',
            floatingPointHardware: 'none',
            useCustomScatterFile: true,
            scatterFilePath: 'undefined',
            storageLayout: {
                RAM: [
                    {
                        tag: 'IRAM',
                        id: 1,
                        mem: {
                            startAddr: '0x20000000',
                            size: '0x5000'
                        },
                        isChecked: true,
                        noInit: false
                    }
                ],
                ROM: [
                    {
                        tag: 'IROM',
                        id: 1,
                        mem: {
                            startAddr: '0x08000000',
                            size: '0x10000'
                        },
                        isChecked: true,
                        isStartup: true
                    }
                ]
            },
            options: 'null'
        };
    }

    GetDefault(): ArmBaseCompileData {
        return ArmBaseCompileConfigModel.getDefaultConfig();
    }
}

class Armcc5CompileConfigModel extends ArmBaseCompileConfigModel {
}

class Armcc6CompileConfigModel extends ArmBaseCompileConfigModel {

    protected cpuTypeList = [
        'Cortex-M0',
        'Cortex-M0+',
        'Cortex-M23',
        'Cortex-M3',
        'Cortex-M33',
        'Cortex-M4',
        'Cortex-M7'
    ];
}

class GccCompileConfigModel extends ArmBaseCompileConfigModel {

    protected cpuTypeList = [
        'Cortex-M0',
        'Cortex-M0+',
        'Cortex-M23',
        'Cortex-M3',
        'Cortex-M33',
        'Cortex-M4',
        'Cortex-M7'
    ];
}

// -------- RISC-V --------

export interface RiscvCompileData extends CompileData {
    linkerScriptPath: string;
    options: string;
}

class RiscvCompileConfigModel extends CompileConfigModel<RiscvCompileData> {

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'linkerScriptPath':
                return view_str$compile$scatterFilePath;
            case 'options':
                return view_str$compile$options;
            default:
                return view_str$compile$deprecated;
        }
    }

    getKeyValue(key: string): string {
        switch (key) {
            case 'options':
                return 'Object {...}';
            default:
                return (<any>this.data)[key] || 'null';
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'options':
                return 'ConfigurationEditor_16x.svg';
            default:
                return 'Property_16x.svg';
        }
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'linkerScriptPath':
                return 'OPEN_FILE';
            case 'options':
                return 'EVENT';
            default:
                return 'Disable';
        }
    }

    protected IsOpenFileCanSelectMany(key: string): boolean {
        switch (key) {
            case 'linkerScriptPath':
                return true;
            default:
                return super.IsOpenFileCanSelectMany(key);
        }
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            case 'linkerScriptPath':
                return {
                    'linker script': ['ld', 'lds'],
                    'any files': ['*']
                };
            default:
                return undefined;
        }
    }

    protected VerifyString(key: string, input: string): string | undefined {
        return undefined;
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] | undefined {
        return undefined;
    }

    protected getEventData(key: string): EventData | undefined {
        switch (key) {
            case 'options':
                return {
                    event: 'openCompileOptions'
                };
            default:
                return undefined;
        }
    }

    static getDefaultConfig(): RiscvCompileData {
        return {
            linkerScriptPath: 'undefined',
            options: 'null'
        };
    }

    GetDefault(): RiscvCompileData {
        return RiscvCompileConfigModel.getDefaultConfig();
    }
}

// -------- 8Bit ----------

export interface C51BaseCompileData extends CompileData {
    options: string;
    linkerScript?: string;
}

abstract class C51BaseCompileConfigModel extends CompileConfigModel<C51BaseCompileData> {

    constructor(config: ProjectConfigData<any>) {
        super(config);
    }

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'options':
                return view_str$compile$options;
            case 'linkerScript':
                return view_str$compile$scatterFilePath;
            default:
                return view_str$compile$deprecated;
        }
    }

    getKeyValue(key: string): string {
        switch (key) {
            case 'options':
                return 'Object {...}';
            default:
                return (<any>this.data)[key] || 'null';
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'options':
                return 'ConfigurationEditor_16x.svg';
            default:
                return 'Property_16x.svg';
        }
    }

    isKeyEnable(key: string): boolean {
        switch (key) {
            case 'options':
                return true;
            default:
                return false;
        }
    }

    protected IsOpenFileCanSelectMany(key: string): boolean {
        switch (key) {
            case 'linkerScript':
                return true;
            default:
                return super.IsOpenFileCanSelectMany(key);
        }
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'options':
                return 'EVENT';
            case 'linkerScript':
                return 'OPEN_FILE';
            default:
                return 'Disable';
        }
    }

    protected getEventData(key: string): EventData | undefined {
        switch (key) {
            case 'options':
                return {
                    event: 'openCompileOptions'
                };
            default:
                return undefined;
        }
    }

    protected VerifyString(key: string, input: string): string | undefined {
        return undefined;
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            case 'linkerScript':
                return {
                    'linker script': ['lds', 'x', 'ld'],
                    'any files': ['*']
                };
            default:
                return undefined;
        }
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] {
        switch (key) {
            default:
                return [];
        }
    }

    static getDefaultConfig(): C51BaseCompileData {
        return {
            linkerScript: 'null',
            options: 'null'
        };
    }

    GetDefault(): C51BaseCompileData {
        return C51BaseCompileConfigModel.getDefaultConfig();
    }
}

class SdccCompileConfigModel extends C51BaseCompileConfigModel {

    static getDefaultConfig(): C51BaseCompileData {
        return {
            options: 'null'
        };
    }

    GetDefault(): C51BaseCompileData {
        return SdccCompileConfigModel.getDefaultConfig();
    }
}

class SdccGnuStm8CompileConfigModel extends C51BaseCompileConfigModel {

    static getDefaultConfig(): C51BaseCompileData {
        return {
            linkerScript: 'null',
            options: 'null'
        };
    }

    isKeyEnable(key: string): boolean {
        return true;
    }

    GetDefault(): C51BaseCompileData {
        return SdccGnuStm8CompileConfigModel.getDefaultConfig();
    }
}

class Keil51CompileConfigModel extends C51BaseCompileConfigModel {

    static getDefaultConfig(): C51BaseCompileData {
        return {
            options: 'null'
        };
    }

    GetDefault(): C51BaseCompileData {
        return Keil51CompileConfigModel.getDefaultConfig();
    }
}

class Iarstm8CompileConfigModel extends C51BaseCompileConfigModel {

    static getDefaultConfig(): C51BaseCompileData {
        return {
            options: 'null'
        };
    }

    GetDefault(): C51BaseCompileData {
        return Iarstm8CompileConfigModel.getDefaultConfig();
    }
}

//////////////////////////////////////////////////////////////////////////////////
//                              Uploader model
//////////////////////////////////////////////////////////////////////////////////

export abstract class UploadConfigModel<T> extends ConfigModel<T> {

    abstract readonly uploader: HexUploaderType;

    static getInstance(uploaderType: HexUploaderType): UploadConfigModel<any> {
        switch (uploaderType) {
            case 'JLink':
                return new JLinkUploadModel();
            case 'STLink':
                return new STLinkUploadModel();
            case 'stcgal':
                return new StcgalUploadModel();
            case 'STVP':
                return new StvpUploadModel();
            case 'pyOCD':
                return new PyOCDUploadModel();
            case 'OpenOCD':
                return new OpenOCDUploadModel();
            case 'Custom':
                return new CustomUploadModel();
            default:
                throw new Error('Invalid uploader type !');
        }
    }

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'bin':
                return view_str$flasher$binPath;
            default:
                return 'none';
        }
    }
}

class StcgalUploadModel extends UploadConfigModel<C51FlashOption> {

    uploader: HexUploaderType = 'stcgal';

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'eepromImgPath':
                return view_str$flasher$eepromPath;
            case 'options':
                return view_str$flasher$options;
            default:
                return super.GetKeyDescription(key);
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'bin':
            case 'eepromImgPath':
                return 'BinaryFile_16x.svg';
            case 'options':
                return 'ConfigurationEditor_16x.svg';
            default:
                return undefined;
        }
    }

    getKeyValue(key: string): string {
        switch (key) {
            case 'options':
                return 'Object {...}';
            default:
                return (<any>this.data)[key] || 'null';
        }
    }

    protected getEventData(key: string): EventData | undefined {
        switch (key) {
            case 'options':
                return {
                    event: 'openUploadOptions',
                    data: {
                        path: this.data.options,
                        default: JSON.stringify({
                            device: "auto",
                            baudrate: "115200"
                        }, undefined, 4)
                    }
                };
            default:
                return undefined;
        }
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'bin':
                return 'OPEN_FILE';
            case 'eepromImgPath':
                return 'INPUT';
            case 'options':
                return 'EVENT';
            default:
                return 'Disable';
        }
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            case 'bin':
                return {
                    'program file': ['hex', 'bin', 's19']
                };
            default:
                return undefined;
        }
    }

    protected VerifyString(key: string, input: string): string | undefined {
        return undefined;
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] {
        return [];
    }

    GetDefault() {
        return {
            bin: 'null',
            eepromImgPath: 'null',
            options: `${AbstractProject.EIDE_DIR}/stc.flash.json`
        };
    }
}

class JLinkUploadModel extends UploadConfigModel<JLinkOptions> {

    uploader: HexUploaderType = 'JLink';

    readonly protocolList = [
        ProtocolType.SWD,
        ProtocolType.JTAG,
        ProtocolType.FINE,
        ProtocolType.cJTAG
    ];

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'proType':
                return view_str$flasher$interfaceType;
            case 'cpuInfo':
                return view_str$flasher$cpuName;
            case 'speed':
                return view_str$flasher$downloadSpeed;
            case 'baseAddr':
                return view_str$flasher$baseAddr;
            case 'otherCmds':
                return view_str$flasher$other_cmds;
            default:
                return super.GetKeyDescription(key);
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'cpuInfo':
                return 'CPU_16x.svg';
            case 'proType':
                return 'ConnectUnplugged_16x.svg';
            case 'bin':
                return 'BinaryFile_16x.svg';
            case 'otherCmds':
                return 'terminal_16x.svg';
            default:
                return 'Property_16x.svg';
        }
    }

    isKeyEnable(key: string): boolean {
        switch (key) {
            case 'cpuInfo':
            case 'speed':
            case 'proType':
            case 'bin':
            case 'otherCmds':
                return true;
            case 'baseAddr':
                return /\.bin$/i.test(this.data.bin);
            default:
                return false;
        }
    }

    getKeyValue(key: string): string {
        switch (key) {
            case 'proType':
                return ProtocolType[this.data.proType];
            case 'speed':
                return (this.data.speed ? this.data.speed.toString() : '4000') + ' kHz';
            case 'cpuInfo':
                return this.data.cpuInfo.cpuName;
            default:
                return (<any>this.data)[key] || 'null';
        }
    }

    protected getEventData(key: string): EventData | undefined {
        return undefined;
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'proType':
            case 'cpuInfo':
                return 'SELECTION';
            case 'baseAddr':
            case 'otherCmds':
                return 'INPUT';
            case 'speed':
                return 'INPUT_INTEGER';
            case 'bin':
                return 'OPEN_FILE';
            default:
                return 'Disable';
        }
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            case 'bin':
                return {
                    'program file': ['hex', 'bin', 's19']
                };
            default:
                return undefined;
        }
    }

    protected VerifyString(key: string, input: string): string | undefined {
        switch (key) {
            case 'speed':
                return /^\d+$/.test(input) ? undefined : 'must be a integer';
            case 'baseAddr':
                return /^0x[0-9a-f]{1,8}$/i.test(input) ? undefined : 'must be a hex number, like: 0x08000000';
            default:
                return undefined;
        }
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] {
        switch (key) {
            case 'proType':
                return this.protocolList.map<CompileConfigPickItem>((protocol) => {
                    return {
                        label: ProtocolType[protocol],
                        val: protocol
                    };
                });
            case 'cpuInfo':
                return ResManager.GetInstance().getJLinkDevList().map<CompileConfigPickItem>((info) => {
                    return {
                        label: info.cpuName,
                        description: info.vendor,
                        val: info
                    };
                });
            default:
                return [];
        }
    }

    GetDefault(): JLinkOptions {
        return {
            bin: 'null',
            baseAddr: '0x08000000',
            cpuInfo: {
                vendor: 'ST',
                cpuName: 'STM32F103C8'
            },
            proType: ProtocolType.SWD,
            speed: 8000,
            otherCmds: ''
        };
    }
}

class STLinkUploadModel extends UploadConfigModel<STLinkOptions> {

    uploader: HexUploaderType = 'STLink';

    readonly protocolList: STLinkProtocolType[] = [
        'SWD',
        'JTAG'
    ];

    readonly resetModeSelList: CompileConfigPickItem[] = [
        { label: 'default' },
        { label: 'Software System Reset', val: 'SWrst' },
        { label: 'Hardware Reset', val: 'HWrst' },
        { label: 'Core Reset', val: 'Crst' }
    ];

    constructor() {
        super();
        this.on('NotifyUpdate', (prjConfig) => {
            // update start address
            const model = <ArmBaseCompileConfigModel>prjConfig.compileConfigModel;
            if (prjConfig.config.uploader === 'STLink' && !model.data.useCustomScatterFile) {
                const mem = model.getIROMx(1);
                if (mem) { (<STLinkOptions>prjConfig.uploadConfigModel.data).address = mem.startAddr; }
            }
            // update option bytes file name
            const targetID = prjConfig.config.mode.toLowerCase();
            this.data.optionBytes = `${AbstractProject.EIDE_DIR}/${targetID}.st.option.bytes.ini`;
        });
    }

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'proType':
                return view_str$flasher$interfaceType;
            case 'speed':
                return view_str$flasher$downloadSpeed;
            case 'address':
                return view_str$flasher$baseAddr;
            case 'runAfterProgram':
                return view_str$flasher$launchApp;
            case 'elFile':
                return view_str$flasher$external_loader;
            case 'optionBytes':
                return view_str$flasher$optionBytesConfig;
            case 'resetMode':
                return view_str$flasher$resetMode;
            case 'otherCmds':
                return view_str$flasher$other_cmds;
            default:
                return super.GetKeyDescription(key);
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'bin':
                return 'BinaryFile_16x.svg';
            case 'proType':
                return 'ConnectUnplugged_16x.svg';
            case 'optionBytes':
                return 'ConfigurationEditor_16x.svg';
            case 'otherCmds':
                return 'terminal_16x.svg';
            default:
                return 'Property_16x.svg';
        }
    }

    isKeyEnable(key: string): boolean {
        switch (key) {
            case 'bin':
            case 'proType':
            case 'runAfterProgram':
            case 'speed':
            case 'elFile':
            case 'optionBytes':
            case 'resetMode':
            case 'otherCmds':
                return true;
            case 'address':
                return /\.bin$/.test(this.data.bin);
            default:
                return false;
        }
    }

    getKeyValue(key: string): string {
        switch (key) {
            case 'proType':
                return this.data.proType;
            case 'runAfterProgram':
                return this.data.runAfterProgram ? 'true' : 'false';
            case 'speed':
                return this.data.speed.toString() + ' kHz';
            case 'optionBytes':
                return 'Object {...}';
            case 'elFile':
                return NodePath.basename(this.data.elFile);
            default:
                return (<any>this.data)[key] || 'null';
        }
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'bin':
                return 'OPEN_FILE';
            case 'runAfterProgram':
            case 'proType':
            case 'resetMode':
                return 'SELECTION';
            case 'speed':
            case 'address':
            case 'otherCmds':
                return 'INPUT';
            case 'elFile':
                return 'SELECTION';
            case 'optionBytes':
                return 'EVENT';
            default:
                return 'Disable';
        }
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            case 'bin':
                return {
                    'program file': ['hex', 'bin', 's19']
                };
            default:
                return undefined;
        }
    }

    protected VerifyString(key: string, input: string): string | undefined {
        switch (key) {
            case 'speed':
                return /^\d+$/.test(input) ? undefined : 'must be an integer';
            case 'address':
                return /^0x[0-9a-f]+$/i.test(input) ? undefined : 'must be a hex number';
            default:
                return undefined;
        }
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] {
        switch (key) {
            case 'runAfterProgram':
                return [
                    { label: 'true', val: true },
                    { label: 'false', val: false }
                ];
            case 'proType':
                return this.protocolList.map((type) => {
                    return { label: type };
                });
            case 'resetMode':
                return this.resetModeSelList;
            case 'elFile':
                {
                    const resultList: CompileConfigPickItem[] = [{ label: 'None', val: 'None' }];

                    // find in workspace
                    const wsFolder = WorkspaceManager.getInstance().getWorkspaceRoot();
                    if (wsFolder) {
                        wsFolder.GetList([/\.stldr$/i], File.EMPTY_FILTER)
                            .forEach((file) => {
                                resultList.push({
                                    label: file.name,
                                    description: 'in workspace',
                                    val: `./${file.name}`
                                });
                            });
                    }

                    // find in stlink folder
                    const stCliPath = SettingManager.GetInstance().getSTLinkExePath();
                    const elFolder = File.fromArray([NodePath.dirname(stCliPath), 'ExternalLoader']);
                    if (elFolder.IsDir()) {
                        elFolder.GetList([/\.stldr$/i], File.EMPTY_FILTER)
                            .forEach((file) => {
                                resultList.push({
                                    label: file.name,
                                    val: `<stlink>/${file.name}`
                                });
                            });
                    }

                    return resultList;
                }
            default:
                return [];
        }
    }

    protected getEventData(key: string): EventData | undefined {
        switch (key) {
            case 'optionBytes':
                {
                    const defDataFile = File.fromArray([
                        ResManager.GetInstance().GetAppDataDir().path, 'def.st.ob.ini'
                    ]);

                    return {
                        event: 'openUploadOptions',
                        data: {
                            path: this.data.optionBytes,
                            default: defDataFile.IsFile() ? defDataFile.Read() : ''
                        }
                    };
                }
            default:
                return undefined;
        }
    }

    GetDefault(): STLinkOptions {
        return {
            bin: 'none path',
            proType: 'SWD',
            resetMode: 'default',
            runAfterProgram: true,
            speed: 4000,
            address: '0x08000000',
            elFile: 'None',
            optionBytes: `${AbstractProject.EIDE_DIR}/st.option.bytes.ini`,
            otherCmds: ''
        };
    }
}

class StvpUploadModel extends UploadConfigModel<STVPFlasherOptions> {

    uploader: HexUploaderType = 'STVP';

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'deviceName':
                return view_str$flasher$cpuName;
            case 'eepromFile':
                return view_str$flasher$eepromPath;
            case 'optionByteFile':
                return view_str$flasher$optionBytesPath;
            default:
                return super.GetKeyDescription(key);
        }
    }

    getKeyValue(key: string): string {
        return (<any>this.data)[key];
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'deviceName':
                return 'SELECTION';
            case 'bin':
            case 'eepromFile':
            case 'optionByteFile':
                return 'INPUT';
            default:
                return 'Disable';
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'bin':
            case 'eepromFile':
            case 'optionByteFile':
                return 'BinaryFile_16x.svg';
            case 'deviceName':
                return 'CPU_16x.svg';
            default:
                return 'Property_16x.svg';
        }
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            default:
                return undefined;
        }
    }

    protected VerifyString(key: string, input: string): string | undefined {
        switch (key) {
            case 'bin':
            case 'eepromFile':
            case 'optionByteFile':
                if (/(?:\.hex|\.s19)$/i.test(input) || /^null$/.test(input)) {
                    return undefined;
                } else {
                    return 'the value must be a hex/s19 file path or \'null\'';
                }
            default:
                return undefined;
        }
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] {
        switch (key) {
            case 'deviceName':
                return ResManager.GetInstance().getStm8DevList()
                    .map<CompileConfigPickItem>((devName) => {
                        return {
                            label: devName
                        };
                    });
            default:
                return [];
        }
    }

    protected getEventData(key: string): EventData | undefined {
        return undefined;
    }

    GetDefault(): STVPFlasherOptions {
        return {
            deviceName: 'STM8S105x4',
            bin: 'null',
            eepromFile: 'null',
            optionByteFile: 'null'
        };
    }
}

class PyOCDUploadModel extends UploadConfigModel<PyOCDFlashOptions> {

    uploader: HexUploaderType = 'pyOCD';

    constructor() {
        super();
        this.on('NotifyUpdate', (prjConfig) => {
            // update option bytes file name
            const targetID = prjConfig.config.mode.toLowerCase();
            this.data.config = `${AbstractProject.EIDE_DIR}/${targetID}.pyocd.yaml`;
        });
    }

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'targetName':
                return view_str$flasher$targetName;
            case 'speed':
                return view_str$flasher$downloadSpeed;
            case 'baseAddr':
                return view_str$flasher$baseAddr;
            case 'config':
                return view_str$flasher$options;
            default:
                return super.GetKeyDescription(key);
        }
    }

    getKeyValue(key: string): string {
        switch (key) {
            case 'config':
                return 'Object {...}';
            default:
                return (<any>this.data)[key] || 'null';
        }
    }

    isKeyEnable(key: string): boolean {
        switch (key) {
            case 'baseAddr':
                return /\.bin$/i.test(this.data.bin);
            default:
                return true;
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'bin':
                return 'BinaryFile_16x.svg';
            case 'targetName':
                return 'CPU_16x.svg';
            case 'speed':
                return 'Property_16x.svg';
            case 'baseAddr':
                return 'Property_16x.svg';
            case 'config':
                return 'ConfigurationEditor_16x.svg';
            default:
                return undefined;
        }
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'bin':
                return 'OPEN_FILE';
            case 'targetName':
                return 'INPUT';
            case 'speed':
                return 'INPUT';
            case 'baseAddr':
                return 'INPUT';
            case 'config':
                return 'EVENT';
            default:
                return 'Disable';
        }
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            case 'bin':
                return {
                    'program file': ['hex', 'bin', 's19']
                };
            default:
                return undefined;
        }
    }

    protected VerifyString(key: string, input: string): string | undefined {
        switch (key) {
            case 'speed':
                return /^\d+[mk]?$/i.test(input) ? undefined : 'must be a number, link: 5000, 5k';
            case 'baseAddr':
                return /^0x[0-9a-f]{1,8}$/i.test(input) ? undefined : 'must be a hex number, like: 0x08000000';
            case 'targetName':
                return /^[^\s]+$/i.test(input) ? undefined : 'must be a chip name, like: stm32f103c8';
            default:
                return undefined;
        }
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] {
        switch (key) {
            default:
                return [];
        }
    }

    protected getEventData(key: string): EventData | undefined {
        switch (key) {
            case 'config':
                return {
                    event: 'openUploadOptions',
                    data: {
                        path: this.data.config,
                        default: ''
                    }
                };
            default:
                return undefined;
        }
    }

    GetDefault(): PyOCDFlashOptions {
        return {
            bin: 'null',
            targetName: 'cortex_m',
            baseAddr: '0x08000000',
            speed: '4M',
            config: `${AbstractProject.EIDE_DIR}/pyocd.yaml`
        };
    }
}

class OpenOCDUploadModel extends UploadConfigModel<OpenOCDFlashOptions> {

    uploader: HexUploaderType = 'OpenOCD';

    configSearchList: { [name: string]: string[] } = {
        'build-in': [
            'scripts',
            'share/openocd/scripts'
        ]
    };

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'target':
                return view_str$flasher$openocd_target_cfg;
            case 'interface':
                return view_str$flasher$openocd_interface_cfg;
            case 'baseAddr':
                return view_str$flasher$baseAddr;
            default:
                return super.GetKeyDescription(key);
        }
    }

    getKeyValue(key: string): string {
        switch (key) {
            case 'target':
            case 'interface':
                // beautify the display for value
                if ((<any>this.data)[key]) {
                    return (<any>this.data)[key].replace('${workspaceFolder}/', './') + '.cfg';
                }
                return 'null';
            default:
                return (<any>this.data)[key] || 'null';
        }
    }

    isKeyEnable(key: string): boolean {
        switch (key) {
            case 'baseAddr':
                return /\.bin$/i.test(this.data.bin);
            default:
                return true;
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'bin':
                return 'BinaryFile_16x.svg';
            case 'target':
                return 'CPU_16x.svg';
            case 'interface':
                return 'ConnectUnplugged_16x.svg';
            case 'baseAddr':
                return 'Property_16x.svg';
            default:
                return undefined;
        }
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'bin':
                return 'OPEN_FILE';
            case 'target':
                return 'SELECTION';
            case 'interface':
                return 'SELECTION';
            case 'baseAddr':
                return 'INPUT';
            default:
                return 'Disable';
        }
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            case 'bin':
                return {
                    'program file': ['hex', 's19', 'bin']
                };
            default:
                return undefined;
        }
    }

    protected VerifyString(key: string, input: string): string | undefined {
        switch (key) {
            case 'baseAddr':
                return /^0x[0-9a-f]{1,8}$/i.test(input) ? undefined : 'must be a hex number, like: 0x08000000';
            default:
                return undefined;
        }
    }

    private getConfigList(configClass: string): { name: string, isInWorkspace?: boolean; }[] | undefined {

        const openocdExe = new File(SettingManager.GetInstance().getOpenOCDExePath());
        const resultList: { name: string, isInWorkspace?: boolean; }[] = [];

        // find in workspace
        const wsFolder = WorkspaceManager.getInstance().getWorkspaceRoot();
        if (wsFolder) {
            for (const path of ['.', '.eide', 'tools']) {
                const cfgFolder = File.fromArray([wsFolder.path, path]);
                if (cfgFolder.IsDir()) {
                    cfgFolder.GetList([/\.cfg$/i], File.EMPTY_FILTER).forEach((file) => {
                        const rePath = (wsFolder.ToRelativePath(file.path, false) || file.name);
                        resultList.push({
                            name: File.ToUnixPath(rePath).replace('.cfg', ''),
                            isInWorkspace: true
                        });
                    });
                }
            }
        }

        // find in build-in path
        for (const path of this.configSearchList['build-in']) {
            const cfgFolder = new File(NodePath.normalize(`${NodePath.dirname(openocdExe.dir)}/${path}/${configClass}`));
            if (cfgFolder.IsDir()) {
                cfgFolder.GetAll([/\.cfg$/i], File.EMPTY_FILTER).forEach((file) => {
                    const rePath = (cfgFolder.ToRelativePath(file.path, false) || file.name);
                    resultList.push({
                        name: File.ToUnixPath(rePath).replace('.cfg', '')
                    });
                });
                break;
            }
        }

        return resultList;
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] | undefined {
        switch (key) {
            case 'target':
            case 'interface':
                return this.getConfigList(key)?.map((item) => {
                    return {
                        label: `${item.name}.cfg`,
                        val: item.isInWorkspace ? `\${workspaceFolder}/${item.name}` : item.name,
                        description: item.isInWorkspace ? 'in workspace' : undefined
                    };
                });
            default:
                return undefined;
        }
    }

    protected getEventData(key: string): EventData | undefined {
        return undefined;
    }

    GetDefault(): OpenOCDFlashOptions {
        return {
            bin: 'null',
            target: 'stm32f1x',
            interface: 'stlink',
            baseAddr: '0x08000000'
        };
    }
}

class CustomUploadModel extends UploadConfigModel<CustomFlashOptions> {

    uploader: HexUploaderType = 'Custom';

    GetKeyDescription(key: string): string {
        switch (key) {
            case 'commandLine':
                return view_str$flasher$commandLine;
            default:
                return super.GetKeyDescription(key);
        }
    }

    getKeyValue(key: string): string {
        return (<any>this.data)[key] || 'null';
    }

    isKeyEnable(key: string): boolean {
        switch (key) {
            default:
                return true;
        }
    }

    getKeyIcon(key: string): KeyIcon | undefined {
        switch (key) {
            case 'bin':
                return 'BinaryFile_16x.svg';
            case 'commandLine':
                return 'terminal_16x.svg';
            default:
                return undefined;
        }
    }

    protected GetKeyType(key: string): FieldType {
        switch (key) {
            case 'bin':
                return 'OPEN_FILE';
            case 'commandLine':
                return 'INPUT';
            default:
                return 'Disable';
        }
    }

    protected GetOpenFileFilters(key: string): OpenFileFilter | undefined {
        switch (key) {
            case 'bin':
                return {
                    'program file': ['hex', 's19', 'bin']
                };
            default:
                return undefined;
        }
    }

    protected VerifyString(key: string, input: string): string | undefined {
        switch (key) {
            default:
                return undefined;
        }
    }

    protected GetSelectionList(key: string): CompileConfigPickItem[] | undefined {
        switch (key) {
            default:
                return undefined;
        }
    }

    protected getEventData(key: string): EventData | undefined {
        return undefined;
    }

    GetDefault(): CustomFlashOptions {
        return {
            bin: 'null',
            commandLine: 'null'
        };
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
    forcedInclude?: string[];
    browse?: CppBrowseInfo;
    intelliSenseMode: string;
}

export interface CppConfig {
    configurations: CppConfigItem[];
    version: number;
}

export class CppConfiguration extends Configuration<CppConfig> {

    protected readTypeFromFile(configFile: File): ProjectType | undefined {
        return undefined;
    }

    protected Parse(jsonStr: string): CppConfig {
        try {
            return <CppConfig>jsonc.parse(jsonStr);
        } catch (error) {
            GlobalEvent.emit('msg', newMessage('Warning', 'parse cpp configuration error !'));
            return this.GetDefault();
        }
    }

    protected ToJson(replacer?: (this: any, key: string, value: any) => any, space?: string | number): string {
        return jsonc.stringify(this.config, replacer, space);
    }

    getConfig(): CppConfigItem {

        const index = this.config.configurations.findIndex((config) => { return config.name === os.platform(); });
        if (index !== -1) {
            return this.config.configurations[index];
        }

        const item: CppConfigItem = {
            name: os.platform(),
            includePath: [],
            defines: [],
            intelliSenseMode: '${default}'
        };

        if (this.config.configurations) {
            this.config.configurations.push(item);
        } else {
            this.config.configurations = [item];
        }

        return item;
    }

    private setConfig(config: CppConfigItem) {
        const index = this.config.configurations.findIndex((_conf) => { return _conf.name === config.name; });
        if (index !== -1) {
            this.config.configurations[index] = config;
        }
    }

    Save() {
        const config = this.getConfig();
        this.Update(this.watcher.file.Read());
        this.setConfig(config);
        super.Save(undefined, 4);
    }

    GetDefault(): CppConfig {
        const item: CppConfigItem = {
            name: os.platform(),
            includePath: [],
            defines: [],
            intelliSenseMode: '${default}'
        };
        return {
            configurations: [item],
            version: 4
        };
    }
}

export interface WorkspaceConfig {
    folders: { name?: string, path: string }[];
    settings?: any;
    [key: string]: any;
}

export class WorkspaceConfiguration extends Configuration<WorkspaceConfig> {

    protected readTypeFromFile(configFile: File): ProjectType | undefined {
        return undefined;
    }

    protected Parse(jsonStr: string): WorkspaceConfig {
        try {
            return <any>jsonc.parse(jsonStr);
        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(
                new Error('parse workspace configuration error !'), 'Warning'));
            return this.GetDefault();
        }
    }

    protected ToJson(replacer?: (this: any, key: string, value: any) => any, space?: string | number): string {
        return jsonc.stringify(this.config, replacer, space);
    }

    Save() {
        // do nothing
    }

    forceSave() {
        super.Save(undefined, 4);
    }

    GetDefault(): WorkspaceConfig {
        return {
            folders: [
                {
                    path: "."
                }
            ],
            settings: {}
        };
    }
}