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
import * as ini from 'ini';
import * as os from 'os';
import * as yaml from 'yaml';
import {
    CppToolsApi, Version, CustomConfigurationProvider, getCppToolsApi,
    SourceFileConfigurationItem, WorkspaceBrowseConfiguration
} from 'vscode-cpptools';

import { File } from '../lib/node-utility/File';
import { FileWatcher } from '../lib/node-utility/FileWatcher';
import { KeilParser } from './KeilXmlParser';
import { ResManager } from './ResManager';
import { Compress } from './Compress';
import {
    CurrentDevice, ConfigMap, FileGroup,
    ProjectConfiguration, ProjectConfigData, WorkspaceConfiguration,
    CppConfiguration, CreateOptions,
    ProjectConfigEvent, ProjectFileGroup, EventData, FileItem, EIDE_CONF_VERSION, ProjectTargetInfo, VirtualFolder, VirtualFile, CompileConfigModel, ArmBaseCompileData, ArmBaseCompileConfigModel, Dependence, CppConfigItem, ICompileOptions
} from './EIDETypeDefine';
import { ToolchainName, IToolchian, ToolchainManager } from './ToolchainManager';
import { GlobalEvent } from './GlobalEvents';
import { ArrayDelRepetition } from '../lib/node-utility/Utility';
import { ExceptionToMessage, newMessage } from './Message';
import { PackageManager, ComponentUpdateItem, ComponentUpdateType } from './PackageManager';
import { HexUploaderType } from './HexUploader';
import { WebPanelManager } from './WebPanelManager';
import { DependenceManager } from './DependenceManager';
import { isNullOrUndefined } from 'util';
import { DeleteDir } from './Platform';
import { IDebugConfigGenerator } from './DebugConfigGenerator';
import { md5, copyObject, compareVersion } from './utility';
import { ResInstaller } from './ResInstaller';
import {
    view_str$prompt$not_found_compiler, view_str$operation$name_can_not_be_blank,
    view_str$operation$name_can_not_have_invalid_char
} from './StringTable';
import { SettingManager } from './SettingManager';
import { WorkspaceManager } from './WorkspaceManager';
import { ExeCmd } from '../lib/node-utility/Executable';

export class CheckError extends Error {
}

export interface CheckResult {
    success: boolean;
    err?: CheckError;
}

//==========================================

interface SourceProvider {

    getFileGroups(): FileGroup[];

    notifyUpdateFile(path: string): void;

    notifyUpdateFolder(path: string): void;

    forceUpdateAllFolders(): void;
}

export interface FolderInfo {
    displayName: string;
    needUpdate: boolean;
    fileWatcher: FileWatcher;
}

interface SourceRootInfo extends FolderInfo {
    fileWatcher: FileWatcher;
    fileGroups: ProjectFileGroup[];
    incList: string[];
    needUpdate: boolean;
    refreshTimeout?: NodeJS.Timeout;
}

type SourceChangedEvent = 'folderChanged' | 'dataChanged' | 'fileStatusChanged' | 'folderStatusChanged';

export class VirtualSource implements SourceProvider {

    public static rootName = '<virtual_root>';

    private project: AbstractProject;
    private config: ProjectConfigData<any>;
    private _event: events.EventEmitter;

    on(event: 'dataChanged', listener: (event: SourceChangedEvent) => void): void;
    on(event: any, listener: (arg: any) => void): void {
        this._event.on(event, listener);
    }

    private emit(event: 'dataChanged', e: SourceChangedEvent): void;
    private emit(event: any, arg?: any): void {
        this._event.emit(event, arg);
    }

    constructor(prj: AbstractProject) {
        this.project = prj;
        this.config = <any>null;
        this._event = new events.EventEmitter();
    }

    public static isVirtualPath(path: string): boolean {
        return path.startsWith(VirtualSource.rootName);
    }

    public getRoot(): VirtualFolder {
        return this.config.virtualFolder;
    }

    private getFolderByName(vFolder: VirtualFolder, name: string): VirtualFolder | undefined {
        for (const folder of vFolder.folders) {
            if (folder.name === name) {
                return folder;
            }
        }
    }

    traverse(func: (folderInfo: { path: string, folder: VirtualFolder }) => void) {

        const folderStack: { path: string, folder: VirtualFolder }[] = [];

        // put root folders
        const rootFolder = this.getFolder();
        if (rootFolder) {
            folderStack.push({
                path: rootFolder.name,
                folder: rootFolder
            });
        }

        let curFolder: { path: string, folder: VirtualFolder };

        while (folderStack.length > 0) {
            curFolder = <any>folderStack.pop();
            func(curFolder);
            for (const vFolder of curFolder.folder.folders) {
                folderStack.push({
                    path: `${curFolder.path}/${vFolder.name}`,
                    folder: vFolder
                });
            }
        }
    }

    // load

    load(notEmitEvt?: boolean) {
        this.config = this.project.GetConfiguration().config;
        // refresh all
        if (!notEmitEvt) { this.forceUpdateAllFolders(); }
    }

    // get

    getFolder(path?: string): VirtualFolder | undefined {
        if (path === undefined || path === VirtualSource.rootName) {
            return this.getRoot();
        } else {
            const nameList = path.split('/');
            let cur_folder: VirtualFolder = {
                name: '/',
                files: [],
                folders: [this.getRoot()]
            };
            for (const name of nameList) {
                const next = this.getFolderByName(cur_folder, name);
                if (next) {
                    cur_folder = next;
                } else {
                    return undefined;
                }
            }
            return cur_folder;
        }
    }

    getFile(path: string): VirtualFile | undefined {
        const vFolder = this.getFolder(NodePath.dirname(path));
        if (vFolder) {
            const fileName = NodePath.basename(path);
            const index = vFolder.files.findIndex((file) => { return NodePath.basename(file.path) === fileName; });
            if (index !== -1) {
                return vFolder.files[index];
            }
        }
    }

    // implement

    getFileGroups(): FileGroup[] {

        const result: FileGroup[] = [];

        this.traverse((folderInfo) => {
            result.push({
                name: folderInfo.path.replace(`${VirtualSource.rootName}/`, ''),
                disabled: this.project.isExcluded(folderInfo.path) || undefined,
                files: folderInfo.folder.files.map((vFile) => {
                    const file = new File(this.project.ToAbsolutePath(vFile.path));
                    const vFilePath = `${folderInfo.path}/${file.name}`;
                    return {
                        file: file,
                        disabled: this.project.isExcluded(vFilePath) || undefined
                    };
                })
            });
        });

        return result;
    }

    notifyUpdateFile(virtualPath: string): void {

        if (!virtualPath.startsWith(VirtualSource.rootName)) {
            return; // if it's not a virtual file, exit
        }

        this.emit('dataChanged', 'fileStatusChanged');
    }

    notifyUpdateFolder(virtualPath: string): void {

        if (!virtualPath.startsWith(VirtualSource.rootName)) {
            return; // if it's not a virtual folder, exit
        }

        const vFolder = this.getFolder(virtualPath);
        if (vFolder) {
            this.emit('dataChanged', 'folderStatusChanged');
        }
    }

    forceUpdateAllFolders(): void {
        this.emit('dataChanged', 'folderStatusChanged');
    }

    // set

    addFile(folder_path: string, file_path: string): VirtualFile | undefined {

        const folder = this.getFolder(folder_path);
        if (folder === undefined) { throw new Error(`not found virtual folder '${folder_path}'`); }

        // file is not existed, add it
        const vFilePath = `${folder_path}/${NodePath.basename(file_path)}`;
        if (this.getFile(vFilePath) === undefined) {
            const vFile = {
                path: this.project.ToRelativePath(file_path) || file_path,
                disabled: this.project.isExcluded(vFilePath) || undefined
            };
            folder.files.push(vFile);
            this.emit('dataChanged', 'folderChanged');
            return vFile;
        }
    }

    addFiles(folder_path: string, pathList: string[]): VirtualFile[] {

        const folder = this.getFolder(folder_path);
        if (folder === undefined) { throw new Error(`not found virtual folder '${folder_path}'`); }

        const doneList: VirtualFile[] = [];

        for (const abspath of pathList) {
            const vFilePath = `${folder_path}/${NodePath.basename(abspath)}`;
            // file is not existed, add it
            if (this.getFile(vFilePath) === undefined) {
                const vFile: VirtualFile = { path: this.project.ToRelativePath(abspath) || abspath };
                folder.files.push(vFile);
                doneList.push(vFile);
            }
        }

        if (doneList.length > 0) {
            this.emit('dataChanged', 'folderChanged');
        }

        return doneList;
    }

    removeFile(path: string): VirtualFile | undefined {
        const basename = NodePath.basename(path);
        const vFolder = this.getFolder(NodePath.dirname(path));
        if (vFolder) {
            const index = vFolder.files.
                findIndex((f) => { return NodePath.basename(f.path) === basename; });
            if (index !== -1) {
                const rmFile = vFolder.files.splice(index, 1)[0];
                this.emit('dataChanged', 'folderChanged');
                return rmFile;
            }
        }
    }

    addFolder(name: string, parent_path?: string): VirtualFolder | undefined {
        const vFolder = this.getFolder(parent_path);
        if (vFolder) {
            const index = vFolder.folders.findIndex((f) => { return f.name === name; });
            if (index === -1) {
                //const vFolderPath = `${parent_path || VirtualSource.rootName}/${name}`;
                const nFolder: VirtualFolder = { name: name, files: [], folders: [] };
                vFolder.folders.push(nFolder);
                this.emit('dataChanged', 'folderChanged');
                return nFolder;
            }
        }
    }

    removeFolder(path: string): VirtualFolder | undefined {
        const name = NodePath.basename(path);
        const vFolder = this.getFolder(NodePath.dirname(path));
        if (vFolder) {
            const index = vFolder.folders
                .findIndex((f) => { return f.name === name; });
            if (index !== -1) {
                const rmFolder = vFolder.folders.splice(index, 1)[0];
                this.emit('dataChanged', 'folderChanged');
                return rmFolder;
            }
        }
    }

    isFolder(path: string): boolean {
        return this.getFolder(path) !== undefined;
    }

    renameFolder(path: string, newName: string): VirtualFolder | undefined {
        const vFolder = this.getFolder(path);
        if (vFolder) {
            vFolder.name = newName;
            this.emit('dataChanged', 'folderChanged');
            return vFolder;
        }
    }
}

class SourceRootList implements SourceProvider {

    private project: AbstractProject;
    private _event: events.EventEmitter;

    // src info
    private srcFolderMaps: Map<string, SourceRootInfo>;

    on(event: 'dataChanged', listener: (event: SourceChangedEvent) => void): void;
    on(event: any, listener: (arg: any) => void): void {
        this._event.on(event, listener);
    }

    constructor(_project: AbstractProject) {
        this.project = _project;
        this._event = new events.EventEmitter();
        this.srcFolderMaps = new Map();
    }

    load(notEmitEvt?: boolean) {

        this.DisposeAll();

        // load source folders from filesystem
        const srcFolders = this.project.GetConfiguration().config.srcDirs;
        srcFolders.forEach((path) => {
            const f = new File(path);
            if (f.IsDir()) {
                const key: string = this.getRelativePath(path);
                const watcher = new FileWatcher(f, true).Watch();
                watcher.on('error', (err) => GlobalEvent.emit('msg', ExceptionToMessage(err, 'Hidden')));
                watcher.OnRename = (file) => this.onFolderChanged(key, file);
                this.srcFolderMaps.set(key, this.newSourceInfo(key, watcher));
            }
        });

        // update all
        for (const info of this.srcFolderMaps.values()) {
            this.updateFolder(info);
        }

        if (!notEmitEvt) { this.emit('dataChanged', 'dataChanged'); }
    }

    add(absPath: string): boolean {
        const f = new File(absPath);
        if (f.IsDir()) {
            const key: string = this.getRelativePath(absPath);
            const watcher = new FileWatcher(f, true).Watch();
            watcher.on('error', (err) => GlobalEvent.emit('msg', ExceptionToMessage(err, 'Hidden')));
            watcher.OnRename = (file) => this.onFolderChanged(key, file);
            const sourceInfo = this.newSourceInfo(key, watcher);
            this.srcFolderMaps.set(key, sourceInfo);
            this.updateFolder(sourceInfo);
            return true;
        }
        return false;
    }

    remove(absPath: string): boolean {
        const key = this.getRelativePath(absPath);
        return this.removeByKey(key);
    }

    DisposeAll() {

        for (const info of this.srcFolderMaps.values()) {
            info.fileWatcher.Close();
        }

        this.srcFolderMaps.clear();
    }

    notifyUpdateFolder(absPath: string) {

        const dir = NodePath.dirname(absPath);
        const updateList = Array.from(this.srcFolderMaps.values())
            .filter((info) => {
                return dir.startsWith(info.fileWatcher.file.path);
            });

        if (updateList.length > 0) {
            for (const rootInfo of updateList) {
                if (rootInfo.fileWatcher.file.IsDir()) {
                    this.updateFolder(rootInfo);
                }
            }
            this.emit('dataChanged', 'folderStatusChanged');
        }
    }

    notifyUpdateFile(absPath: string) {

        const dir = NodePath.dirname(absPath);
        const updateList = Array.from(this.srcFolderMaps.values())
            .filter((info) => {
                return dir.startsWith(info.fileWatcher.file.path);
            });

        if (updateList.length > 0) {
            updateList.forEach((info) => {
                for (const group of info.fileGroups) {
                    const index = group.files.findIndex((file) => { return file.file.path === absPath; });
                    if (index !== -1) {
                        group.files[index].disabled = this.project.isExcluded(absPath) || undefined;
                    }
                }
            });
            this.emit('dataChanged', 'fileStatusChanged');
        }
    }

    getRootFolderList(): FolderInfo[] {
        return Array.from(this.srcFolderMaps.values());
    }

    getIncludeList(): string[] {
        const res: string[] = [];
        for (const info of this.srcFolderMaps.values()) {
            for (const include of info.incList) {
                res.push(include);
            }
        }
        return res;
    }

    getFileGroups(): ProjectFileGroup[] {
        const res: ProjectFileGroup[] = [];
        for (const info of this.srcFolderMaps.values()) {
            for (const group of info.fileGroups) {
                res.push(group);
            }
        }
        return res;
    }

    forceUpdateAllFolders() {
        for (const info of this.srcFolderMaps.values()) {
            this.updateFolder(info);
        }
        this.emit('dataChanged', 'folderChanged');
    }

    forceUpdateFolder(rePath: string) {
        const rootInfo = this.srcFolderMaps.get(rePath);
        if (rootInfo) {
            if (rootInfo.fileWatcher.file.IsDir()) {
                this.updateFolder(rootInfo);
                this.emit('dataChanged', 'folderChanged');
            } else {
                this.removeByKey(rePath);
                this.emit('dataChanged', 'dataChanged');
            }
        }
    }

    // -- private region

    private emit(event: 'dataChanged', e: SourceChangedEvent): void;
    private emit(event: any, arg?: any): void {
        this._event.emit(event, arg);
    }

    private getRelativePath(abspath: string): string {
        return this.project.ToRelativePath(abspath, false) || abspath;
    }

    private newSourceInfo(displayName: string, watcher: FileWatcher): SourceRootInfo {
        return {
            displayName: displayName,
            fileWatcher: watcher,
            needUpdate: false,
            fileGroups: [],
            incList: []
        };
    }

    private removeByKey(key: string): boolean {
        this.srcFolderMaps.get(key)?.fileWatcher.Close();
        return this.srcFolderMaps.delete(key);
    }

    private onFolderChanged(folderKey: string, targetFile: File) {
        const rootInfo = this.srcFolderMaps.get(folderKey);
        if (rootInfo) {
            if (targetFile.path === rootInfo.fileWatcher.file.path) { // root folder has been renamed
                if (this.removeByKey(folderKey)) {
                    this.emit('dataChanged', 'dataChanged');
                }
            } else {
                if (rootInfo.refreshTimeout) {
                    rootInfo.refreshTimeout.refresh();
                } else {
                    rootInfo.refreshTimeout = setTimeout((folderInfo: SourceRootInfo) => {
                        if (folderInfo.refreshTimeout) {
                            folderInfo.refreshTimeout = undefined;
                            this.updateFolder(folderInfo);
                            this.emit('dataChanged', 'folderChanged');
                        }
                    }, 100, rootInfo);
                }
            }
        }
    }

    private updateFolder(rootInfo: SourceRootInfo) {

        const sourceRoot = rootInfo.fileWatcher.file;
        const folderStack: File[] = [sourceRoot];

        // exclude some root folder when add files to custom include paths
        const disableInclude: boolean = AbstractProject.excludeIncSearchList.includes(
            this.project.ToRelativePath(sourceRoot.path, false) || sourceRoot.path
        );

        const sourceFilter = AbstractProject.getSourceFileFilter();
        const fileFilter = AbstractProject.getFileFilters();

        // clear old data
        rootInfo.incList = [];
        rootInfo.fileGroups = [];
        rootInfo.needUpdate = false;

        try {

            while (folderStack.length > 0) {

                const cFolder = <File>folderStack.pop();
                const isSourceRoot = cFolder.path === sourceRoot.path;
                const fileList = cFolder.GetList(fileFilter, File.EMPTY_FILTER);

                if (fileList.length > 0) {

                    // filter source file and add to file group
                    const srcFiles = fileList.filter((file) => {
                        return sourceFilter.some((regexp) => {
                            return regexp.test(file.name);
                        });
                    });

                    const isFolderExcluded = this.project.isExcluded(cFolder.path) || undefined;

                    if (srcFiles.length > 0) {

                        const group: ProjectFileGroup = {
                            name: cFolder.name,
                            dir: cFolder,
                            disabled: isFolderExcluded,
                            isRoot: isSourceRoot,
                            files: []
                        };

                        for (const _file of srcFiles) {
                            group.files.push({
                                file: _file,
                                disabled: this.project.isExcluded(_file.path) || undefined
                            });
                        }

                        rootInfo.fileGroups.push(group);
                    }

                    // add to include folders
                    if (!disableInclude && !isFolderExcluded) {
                        rootInfo.incList.push(cFolder.path);
                    }
                }

                // push subfolders
                cFolder.GetList(File.EMPTY_FILTER)
                    .filter((folder) => !AbstractProject.excludeDirFilter.test(folder.name))
                    .forEach((folder) => folderStack.push(folder));
            }

        } catch (error) {
            rootInfo.needUpdate = true; // set need update flag
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Hidden'));
        }
    }
}

//============================================

export interface BaseProjectInfo {
    rootFolder: File;
    workspaceFile: File;
    prjConfig: ProjectConfiguration<any>;
}

export interface FilesOptions {
    version: string;
    files?: { [key: string]: string };
    virtualPathFiles?: { [key: string]: string };
}

export type DataChangeType = 'pack' | 'dependence' | 'compiler' | 'uploader' | 'files';

export abstract class AbstractProject implements CustomConfigurationProvider {

    static readonly workspaceSuffix = '.code-workspace';
    static readonly vsCodeDir = '.vscode';
    static readonly EIDE_DIR = '.eide';
    static readonly LOG_DIR = 'log';

    static readonly cppConfigName = 'c_cpp_properties.json';
    static readonly prjConfigName = 'eide.json';

    // avaliable source files
    static readonly headerFilter: RegExp = /\.(?:h|hxx|hpp|inc)$/i;
    static readonly cppfileFilter: RegExp = /\.(?:c|cpp|c\+\+|cc|cxx)$/i;
    static readonly libFileFilter: RegExp = /\.(?:lib|a|o|obj)$/i;
    static readonly asmfileFilter: RegExp = /\.(?:s|asm|a51)$/i;

    // this folder list will be excluded when search include path
    static readonly excludeIncSearchList: string[] = [DependenceManager.DEPENDENCE_DIR];

    // this folder will be excluded when search source path
    static readonly excludeDirFilter: RegExp = /^\.(?:git|vs|vscode|eide)$/i;

    // to show output files
    static readonly buildOutputMatcher: RegExp = /\.(?:elf|axf|out|hex|bin|s19|sct|ld|lds|map|map\.view)$/i;

    //-------

    protected _event: events.EventEmitter;
    protected configMap: ConfigMap;
    protected packManager: PackageManager;
    protected dependenceManager: DependenceManager;
    protected rootDirWatcher: FileWatcher | undefined;
    protected eideDir: File | undefined;
    protected toolchain: IToolchian | undefined;
    protected prevToolchain: IToolchian | undefined;

    // sources
    protected sourceRoots: SourceRootList;
    protected virtualSource: VirtualSource;

    ////////////////////////////////// cpptools provider interface ///////////////////////////////////

    name: string = 'eide';
    extensionId: string = 'cl.eide';
    abstract canProvideConfiguration(uri: vscode.Uri, token?: vscode.CancellationToken | undefined): Thenable<boolean>;
    abstract provideConfigurations(uris: vscode.Uri[], token?: vscode.CancellationToken | undefined): Thenable<SourceFileConfigurationItem[]>;
    abstract canProvideBrowseConfiguration(token?: vscode.CancellationToken | undefined): Thenable<boolean>;
    abstract provideBrowseConfiguration(token?: vscode.CancellationToken | undefined): Thenable<WorkspaceBrowseConfiguration | null>;
    abstract canProvideBrowseConfigurationsPerFolder(token?: vscode.CancellationToken | undefined): Thenable<boolean>;
    abstract provideFolderBrowseConfiguration(uri: vscode.Uri, token?: vscode.CancellationToken | undefined): Thenable<WorkspaceBrowseConfiguration | null>;
    abstract dispose(): void;

    ////////////////////////////////// Abstract Project ///////////////////////////////////

    constructor() {
        this._event = new events.EventEmitter();
        this.sourceRoots = new SourceRootList(this);
        this.virtualSource = new VirtualSource(this);
        this.configMap = new ConfigMap();
        this.packManager = new PackageManager(this);
        this.dependenceManager = new DependenceManager(this);
    }

    protected emit(event: 'dataChanged', type?: DataChangeType): boolean;
    protected emit(event: 'cppConfigChanged'): boolean;
    protected emit(event: any, argc?: any): boolean {
        return this._event.emit(event, argc);
    }

    on(event: 'dataChanged', listener: (type?: DataChangeType) => void): this;
    on(event: 'cppConfigChanged', listener: () => void): this;
    on(event: any, listener: (argc?: any) => void): this {
        this._event.on(event, listener);
        return this;
    }

    static getFileFilters(): RegExp[] {
        return [this.cppfileFilter, this.headerFilter, this.libFileFilter, this.asmfileFilter];
    }

    static getSourceFileFilter(): RegExp[] {
        return [this.cppfileFilter, this.libFileFilter, this.asmfileFilter];
    }

    static equal(p1: AbstractProject, p2: AbstractProject) {
        return p1.getWsPath() === p2.getWsPath();
    }

    static isVirtualSourceGroup(grp: FileGroup): boolean {
        return (<ProjectFileGroup>grp).dir == undefined;
    }

    static validateProjectName(value: string): string | undefined {

        if (value.trim() === '') {
            return view_str$operation$name_can_not_be_blank;
        }

        if (/&|<|>|\(|\)|@|\^|\|/.test(value)) {
            return view_str$operation$name_can_not_have_invalid_char;
        }
    }

    private loadProjectDirectory() {

        // load root folder
        this.rootDirWatcher = new FileWatcher(new File(this.GetWorkspaceConfig().GetFile().dir), false);
        this.rootDirWatcher.on('error', (err) => GlobalEvent.emit('error', err));
        this.eideDir = new File(this.rootDirWatcher.file.path + File.sep + AbstractProject.EIDE_DIR);

        // create log folder
        this.getLogDir().CreateDir();

        // rename old 'deps' folder name for old eide version
        const depsFolder = new File(this.rootDirWatcher.file.path + File.sep + DependenceManager.DEPENDENCE_DIR);
        if (!depsFolder.IsDir()) { // if 'deps' folder is not exist

            // these folder is for old eide version
            const oldDepsFolders = [
                new File(this.rootDirWatcher.file.path + File.sep + 'deps'),
                new File(this.rootDirWatcher.file.path + File.sep + 'dependence')
            ];

            // create new 'deps' folder
            // fs.mkdirSync(depsFolder.path);

            // copy dependence data from old version deps folder
            for (const folder of oldDepsFolders) {
                if (folder.IsDir()) {

                    // copy dependence data
                    fs.renameSync(folder.path, depsFolder.path);

                    // reset exclude info
                    const excludeList = this.GetConfiguration().config.excludeList;
                    const pathMatcher = `.${File.sep}${folder.name}${File.sep}`;
                    const pathReplacer = `${DependenceManager.DEPENDENCE_DIR}/`;
                    for (let index = 0; index < excludeList.length; index++) {
                        const element = excludeList[index];
                        if (element.startsWith(pathMatcher)) {
                            excludeList[index] = element.replace(pathMatcher, pathReplacer);
                        }
                    }

                    break; // exit, when copy done
                }
            }
        }

        // merge old 'env.ini' files for v2.15.3^
        const envFile: File = this.getEnvFile(true);
        if (!envFile.IsFile()) { // if 'env.ini' file is not existed, we try to merge it
            const oldEnv: string[] = [];
            this.eideDir.GetList([/[^\.]+\.env\.ini$/], File.EMPTY_FILTER)
                .forEach((file) => {
                    const tName = NodePath.basename(file.path, '.env.ini');
                    if (tName) {
                        try {
                            const cfg = ini.parse(file.Read());
                            if (cfg['workspace']) { // merge old prj order cfg
                                cfg['EIDE_BUILD_ORDER'] = cfg['workspace']['order'];
                                delete cfg['workspace'];
                            }
                            const cfg_str = ini.stringify(cfg);
                            fs.unlinkSync(file.path); // delete file before
                            oldEnv.push(`[${tName}]`, `${cfg_str}`);
                        } catch (error) {
                            // nothing todo
                        }
                    }
                });
            if (oldEnv.length > 0) {
                const cont = this.getEnvFileDefCont().concat(oldEnv);
                envFile.Write(cont.join(os.EOL));
            }
        }
    }

    private initProjectConfig() {

        const prjConfig = this.GetConfiguration();

        // clear duplicated items
        prjConfig.config.excludeList = ArrayDelRepetition(
            prjConfig.config.excludeList.map(p => File.ToUnixPath(p))
        );

        // clear invalid src folders
        prjConfig.config.srcDirs = prjConfig.config.srcDirs
            .filter(path => { return (new File(path)).IsDir(); });

        // clear invalid package path
        if (prjConfig.config.packDir
            && !(new File(this.ToAbsolutePath(prjConfig.config.packDir))).IsDir()) {
            prjConfig.config.packDir = null;
        }
    }

    private initProjectComponents() {

        const prjConfig = this.GetConfiguration();

        // init components
        this.packManager.Init();
        this.dependenceManager.Init();

        if (prjConfig.config.type === 'ARM') { // force add `dependence` folder to project and include list
            this.dependenceManager.getDependenceRootFolder().CreateDir(false);
            prjConfig.addSrcDirAtFirst(this.dependenceManager.getDependenceRootFolder().path);
            prjConfig.CustomDep_AddIncDir(this.dependenceManager.getDependenceRootFolder());
        }
        else { // remove these folders for other mcu project
            DeleteDir(this.dependenceManager.getDependenceRootFolder());
            prjConfig.RemoveSrcDir(this.dependenceManager.getDependenceRootFolder().path);
            prjConfig.CustomDep_RemoveIncDir(this.dependenceManager.getDependenceRootFolder().path);
        }
    }

    getWsPath(): string {
        return this.GetWorkspaceConfig().GetFile().path;
    }

    getWsFile(): File {
        return this.GetWorkspaceConfig().GetFile();
    }

    GetPackManager(): PackageManager {
        return this.packManager;
    }

    GetDepManager(): DependenceManager {
        return this.dependenceManager;
    }

    getSourceIncludeList(): string[] {
        return this.sourceRoots.getIncludeList();
    }

    getFileGroups(): FileGroup[] {
        return (<FileGroup[]>this.sourceRoots.getFileGroups())
            .concat(this.virtualSource.getFileGroups());
    }

    /**
     * get project root folder
    */
    GetRootDir(): File {
        return (<FileWatcher>this.rootDirWatcher).file;
    }

    getSourceRootFolders(): FolderInfo[] {
        return this.sourceRoots.getRootFolderList();
    }

    getVirtualSourceRoot(): VirtualFolder {
        return this.virtualSource.getRoot();
    }

    getVirtualSourceManager(): VirtualSource {
        return this.virtualSource;
    }

    getNormalSourceManager(): SourceRootList {
        return this.sourceRoots;
    }

    refreshSourceRoot(rePath: string) {
        if (rePath.startsWith(VirtualSource.rootName)) {
            this.virtualSource.notifyUpdateFolder(rePath);
        } else {
            this.sourceRoots.forceUpdateFolder(rePath);
        }
    }

    getOutputDir(): string {
        return this.GetConfiguration().getOutDir();
    }

    getOutputFolder(): File {
        return new File(this.ToAbsolutePath(this.GetConfiguration().getOutDir()));
    }

    getOutputRoot(): string {
        return this.GetConfiguration().getOutDirRoot();
    }

    getEideDir(): File {
        return <File>this.eideDir;
    }

    getLogDir(): File {
        return File.fromArray([(<File>this.eideDir).path, AbstractProject.LOG_DIR]);
    }

    GetConfigMap(): ConfigMap {
        return this.configMap;
    }

    private replacePathEnv(path: string): string {

        const prjConfig = this.GetConfiguration();
        const prjRootDir = this.GetRootDir();
        const outDir = NodePath.normalize(prjRootDir.path + File.sep + prjConfig.getOutDir());

        // replace stable env
        path = path
            .replace(/\$\(OutDir\)|\$\{OutDir\}/ig, outDir)
            .replace(/\$\(ProjectName\)|\$\{ProjectName\}/ig, prjConfig.config.name)
            .replace(/\$\(ExecutableName\)|\$\{ExecutableName\}/ig, `${outDir}${File.sep}${prjConfig.config.name}`)
            .replace(/\$\(ProjectRoot\)|\$\{ProjectRoot\}/ig, prjRootDir.path);

        // replace user env
        const prjEnv = this.getProjectEnv();
        if (prjEnv) {
            const nameMatcher = /^\w+$/;
            for (const key in prjEnv) {
                if (!nameMatcher.test(key)) continue;
                const reg = new RegExp(String.raw`\$\(${key}\)|\$\{${key}\}`, 'ig');
                path = path.replace(reg, prjEnv[key]);
            }
        }

        return path;
    }

    ToAbsolutePath(path_: string): string {
        const path = this.replacePathEnv(path_);
        if (File.isAbsolute(path)) { return NodePath.normalize(path); }
        return NodePath.normalize(this.GetRootDir().path + NodePath.sep + path);
    }

    ToRelativePath(path: string, hasPrefix: boolean = true): string | undefined {
        return this.GetRootDir().ToRelativePath(path.trim(), hasPrefix);
    }

    async Load(wsFile: File) {
        await this.BeforeLoad(wsFile);
        this.LoadConfigurations(wsFile);
        this.loadProjectDirectory();
        this.initProjectConfig();
        this.loadToolchain();
        this.loadUploader();
        this.initProjectComponents();
        this.RegisterEvent();
        this.LoadSourceRootFolders();
        await this.AfterLoad();
    }

    Close() {

        if (this.rootDirWatcher) {
            this.rootDirWatcher.Close();
        }

        this.sourceRoots.DisposeAll();

        this.configMap.Dispose();
    }

    async Create(option: CreateOptions) {
        await this.Load(this.create(option));
    }

    InstallComponent(name: string) {
        const device = this.packManager.GetCurrentDevice();
        if (device) {
            const component = this.packManager.FindComponent(name);
            if (component) {
                this.dependenceManager.InstallComponent(device.packInfo.name, component);
            }
        }
    }

    UninstallComponent(name: string) {
        const device = this.packManager.GetCurrentDevice();
        if (device) {
            const component = this.packManager.FindComponent(name);
            if (component) {
                this.dependenceManager.UninstallComponent(device.packInfo.name, component.groupName);
            }
        }
    }

    GetConfiguration<T>(): ProjectConfiguration<T> {
        return <ProjectConfiguration<T>>this.configMap.Get<ProjectConfigData<any>>(AbstractProject.prjConfigName);
    }

    GetWorkspaceConfig(): WorkspaceConfiguration {
        return <WorkspaceConfiguration>this.configMap.Get<any>(AbstractProject.workspaceSuffix);
    }

    GetCppConfig(): CppConfiguration {
        return <CppConfiguration>this.configMap.Get<any>(AbstractProject.cppConfigName);
    }

    Save() {
        this.configMap.SaveAll();
    }

    InstallPack(packFile: File, reporter?: (progress?: number, message?: string) => void) {
        return this.packManager.Install(packFile, reporter);
    }

    UninstallPack(packName: string) {
        return this.packManager.Uninstall(packName);
    }

    //////////////////////// project targets //////////////////////////

    getCurrentTarget(): string {
        return this.GetConfiguration().config.mode;
    }

    getTargets(): string[] {

        const prjConfig = this.GetConfiguration<any>().config;
        const result: string[] = [];

        for (const name in prjConfig.targets) {
            result.push(name);
        }

        if (prjConfig.targets[prjConfig.mode] === undefined) { // add cur target
            result.push(prjConfig.mode);
        }

        return result;
    }

    async switchTarget(targetName: string) {
        const prjConfig = this.GetConfiguration<any>().config;
        if (targetName !== prjConfig.mode) {
            this._switchTarget(targetName);
            this.reloadToolchain();
            this.reloadUploader();
        }
    }

    deleteTarget(targetName: string) {
        if (this.getCurrentTarget() !== targetName) {
            const prjConfig = this.GetConfiguration().config;
            delete prjConfig.targets[targetName]; // delete it
        }
    }

    private copyTargetObj(): ProjectTargetInfo {

        const prjConfig = this.GetConfiguration();
        const target = prjConfig.config;

        // convert to relative path
        const custom_dep = <Dependence>JSON.parse(JSON.stringify(prjConfig.CustomDep_getDependence()));
        custom_dep.incList = custom_dep.incList.map((path) => { return this.ToRelativePath(path) || path; });
        custom_dep.libList = custom_dep.libList.map((path) => { return this.ToRelativePath(path) || path; });
        custom_dep.sourceDirList = custom_dep.sourceDirList.map((path) => { return this.ToRelativePath(path) || path; });

        const uploadConfig_ = JSON.parse(JSON.stringify(target.uploadConfig));
        const uploadConfigMap_ = JSON.parse(JSON.stringify(target.uploadConfigMap));

        // clear invalid upload config fields
        uploadConfig_.bin = '';
        for (let toolName in uploadConfigMap_) {
            uploadConfigMap_[toolName].bin = '';
        }

        return {
            excludeList: Array.from(target.excludeList),
            toolchain: target.toolchain,
            compileConfig: JSON.parse(JSON.stringify(target.compileConfig)),
            uploader: target.uploader,
            uploadConfig: uploadConfig_,
            uploadConfigMap: uploadConfigMap_,
            custom_dep: custom_dep
        };
    }

    private saveTarget(target: string) {
        const prjConfig = this.GetConfiguration<any>();
        const prjConfigData = prjConfig.config;
        prjConfigData.targets[target] = this.copyTargetObj();
    }

    private _switchTarget(targetName: string) {

        const prjConfig = this.GetConfiguration();
        const prjConfigData = prjConfig.config;
        const targets = prjConfigData.targets;

        // save old target
        this.saveTarget(prjConfigData.mode);

        // if target is not existed, create it
        if (targets[targetName] === undefined) {
            targets[targetName] = this.copyTargetObj();
        }

        // update current target name
        prjConfigData.mode = targetName;

        // get target
        const curTarget = <any>prjConfigData;
        const oldTarget = <any>targets[targetName];

        // update project
        this.setToolchain(targets[targetName].toolchain, true);
        this.setUploader(targets[targetName].uploader, true);

        // update project data
        for (const name in oldTarget) {

            if (name === 'custom_dep') {
                const curDep = this.GetConfiguration().CustomDep_getDependence();
                const oldDep = oldTarget[name];
                for (const key in curDep) { (<any>curDep)[key] = copyObject(oldDep[key]); }
                // convert to abs path
                curDep.incList = curDep.incList.map((path) => { return this.ToAbsolutePath(path); });
                curDep.libList = curDep.libList.map((path) => { return this.ToAbsolutePath(path); });
                curDep.sourceDirList = curDep.sourceDirList.map((path) => { return this.ToAbsolutePath(path); });
                continue;
            }

            if (name === 'compileConfig') {
                const compileConfig = prjConfig.compileConfigModel.data;
                const oldCompileConfig = oldTarget[name];
                // delete all properties
                for (const key in compileConfig) {
                    delete compileConfig[key];
                }
                // update properties
                for (const key in oldCompileConfig) {
                    compileConfig[key] = copyObject(oldCompileConfig[key]);
                }
                continue;
            }

            if (name === 'uploadConfig') {
                const uploadConfig = prjConfig.uploadConfigModel.data;
                const oldUploadConfig = oldTarget[name];
                // delete all properties
                for (const key in uploadConfig) {
                    delete uploadConfig[key];
                }
                // update properties
                for (const key in oldUploadConfig) {
                    uploadConfig[key] = copyObject(oldUploadConfig[key]);
                }
                continue;
            }

            curTarget[name] = copyObject(oldTarget[name]);
        }

        this.sourceRoots.forceUpdateAllFolders();
        this.virtualSource.forceUpdateAllFolders();
    }

    getPrevToolchain(): IToolchian | undefined {
        return this.prevToolchain;
    }

    getToolchain(): IToolchian {
        return <IToolchian>this.toolchain;
    }

    setToolchain(name: ToolchainName, notReload?: boolean) {
        const prjConfig = this.GetConfiguration();
        prjConfig.setToolchain(name);
        if (!notReload) this.reloadToolchain();
    }

    setUploader(uploader: HexUploaderType, notReload?: boolean) {
        const prjConfig = this.GetConfiguration();
        prjConfig.setHexUploader(uploader);
        if (!notReload) this.reloadUploader();
    }

    //--

    isExcluded(path: string): boolean {

        const excList = this.GetConfiguration().config.excludeList;
        const rePath = File.ToUnixPath(this.ToRelativePath(path) || path);
        const isFolder = VirtualSource.isVirtualPath(path) ? this.virtualSource.isFolder(path) : File.IsDir(path);

        if (isFolder) { // is a folder
            return excList.findIndex(excPath => rePath === excPath || rePath.startsWith(`${excPath}/`)) !== -1;
        } else { // is a file
            return excList.findIndex(excPath => rePath === excPath) !== -1;
        }
    }

    protected addExclude(path: string): boolean {
        const excludeList = this.GetConfiguration().config.excludeList;
        const rePath = File.ToUnixPath(this.ToRelativePath(path) || path);
        if (!excludeList.includes(rePath)) { // not existed, add it
            excludeList.push(rePath);
            return true;
        }
        return false;
    }

    protected clearExclude(path: string): boolean {
        const excludeList = this.GetConfiguration().config.excludeList;
        const rePath = File.ToUnixPath(this.ToRelativePath(path) || path);
        const index = excludeList.indexOf(rePath);
        if (index !== -1) { // if existed, clear it
            excludeList.splice(index, 1);
            return true;
        }
        return false;
    }

    excludeSourceFile(path: string) {
        const srcFilter = AbstractProject.getSourceFileFilter();
        if (srcFilter.some((reg) => reg.test(path))) {
            if (this.addExclude(path)) {
                this.sourceRoots.notifyUpdateFile(path);
                this.virtualSource.notifyUpdateFile(path);
            }
        }
    }

    unexcludeSourceFile(path: string) {
        if (this.clearExclude(path)) {
            this.sourceRoots.notifyUpdateFile(path);
            this.virtualSource.notifyUpdateFile(path);
        }
    }

    //--

    excludeFolder(absPath: string) {
        if (this.addExclude(absPath)) {
            this.sourceRoots.notifyUpdateFolder(absPath);
            this.virtualSource.notifyUpdateFolder(absPath);
        }
    }

    unexcludeFolder(absPath: string) {
        if (this.clearExclude(absPath)) {
            this.sourceRoots.notifyUpdateFolder(absPath);
            this.virtualSource.notifyUpdateFolder(absPath);
        }
    }

    //--

    /**
     * @return duplicated paths list
    */
    addIncludePaths(pathList: string[]): string[] {

        const srcIncList = this.sourceRoots.getIncludeList();
        const dupList: string[] = [];
        const incList: string[] = [];

        pathList.forEach((path) => {
            if (srcIncList.includes(path)) {
                dupList.push(path);
            } else {
                incList.push(path);
            }
        });

        this.GetConfiguration()
            .CustomDep_AddIncFromPathList(incList)
            .forEach((p) => { dupList.push(p); });

        return dupList;
    }

    installCMSISHeaders() {

        const packList = ResManager.GetInstance().getCMSISHeaderPacks();
        if (packList.length === 0) {
            GlobalEvent.emit('msg', newMessage('Info', 'Not found available libraries !'));
            return;
        }

        for (const packZipFile of packList) {

            const outDir = File.fromArray([this.GetRootDir().path, '.cmsis', packZipFile.noSuffixName]);
            const rePath = this.ToRelativePath(outDir.path) || outDir.path;

            if (outDir.IsDir()) {
                GlobalEvent.emit('msg', newMessage('Warning', `'${rePath}' directory is already exists !, Aborted !`));
                return;
            }

            outDir.CreateDir(true);
            const compresser = new Compress(ResManager.GetInstance().Get7zDir());
            const zipMsg = compresser.UnzipSync(packZipFile, outDir);

            // add to include folder
            this.addIncludePaths([outDir.path]);
            GlobalEvent.emit('msg', newMessage('Hidden', zipMsg));
            GlobalEvent.emit('msg', newMessage('Info', `Installation completed !, [path]: ${rePath}`));
        }
    }

    //-------------------- other ------------------

    readIgnoreList(): string[] {
        const ignoreFile = new File(this.ToAbsolutePath('.\\.eideignore'));
        if (ignoreFile.IsFile()) {
            return ignoreFile.Read()
                .split(/\r\n|\n/)
                .map((line) => { return line.trim(); })
                .filter((line) => {
                    return line !== '' && !line.startsWith('#') && /^[^\s]+$/.test(line);
                });
        }
        return [];
    }

    private getEnvFileDefCont(): string[] {
        return [
            `###########################################################`,
            `#              project environment variables`,
            `###########################################################`,
            ``,
            `# append command prefix for toolchain`,
            `#COMPILER_CMD_PREFIX=`,
            ``,
            `# mcu ram size (used to print memory usage)`,
            `#MCU_RAM_SIZE=0x00`,
            ``,
            `# mcu rom size (used to print memory usage)`,
            `#MCU_ROM_SIZE=0x00`,
            ``,
            `# put your global variables ...`,
            `#GLOBAL_VAR=`,
            ``,
        ].map((line) => line);
    }

    getEnvFile(notInitFile?: boolean): File {

        const envFile = new File(`${this.getEideDir().path}${File.sep}env.ini`);
        if (!notInitFile && !envFile.IsFile()) {
            const defTxt: string[] = this.getEnvFileDefCont();
            defTxt.push(
                `[debug]`,
                `# put your variables for 'debug' target ...`,
                `#VAR=`
            )
            envFile.Write(defTxt.join(os.EOL));
        }

        return envFile;
    }

    private __env_raw_lastGetTime: number = 0;
    private __env_raw_lastUpdateTime: number = 0;
    private __env_raw_lastEnvObj: { [name: string]: any } | undefined;
    getProjectRawEnv(): { [name: string]: any } | undefined {
        try {
            // limit read interval (150 ms), improve speed
            if (this.__env_raw_lastEnvObj != undefined &&
                Date.now() - this.__env_raw_lastGetTime < 150) {
                return this.__env_raw_lastEnvObj;
            }

            // is env need update ?
            const envFile = this.getEnvFile(true);
            if (envFile.IsFile()) {
                const lastMdTime = fs.statSync(envFile.path).mtimeMs;
                if (this.__env_raw_lastEnvObj == undefined ||
                    lastMdTime > this.__env_raw_lastUpdateTime) {
                    // update env
                    this.__env_raw_lastEnvObj = ini.parse(envFile.Read());
                    this.__env_raw_lastUpdateTime = lastMdTime;
                }

                // return env objects
                this.__env_raw_lastGetTime = Date.now();
                return this.__env_raw_lastEnvObj;
            }
        } catch (error) {
            // nothing todo
        }
    }

    private __env_lastUpdateTime: number = 0;
    private __env_lastEnvObj: { [name: string]: any } | undefined;
    getProjectEnv(): { [name: string]: any } | undefined {

        // limit read interval (200 ms), improve speed
        if (this.__env_lastEnvObj != undefined &&
            Date.now() - this.__env_lastUpdateTime < 200) {
            return this.__env_lastEnvObj;
        }

        let env: { [name: string]: any } | undefined;

        const rawEnv = this.getProjectRawEnv();
        if (rawEnv != undefined) {
            env = JSON.parse(JSON.stringify(rawEnv));

            // override target env var
            const targetName = this.getCurrentTarget().toLowerCase();
            for (const key in env) {
                if (typeof env[key] == 'object' &&
                    Array.isArray(env[key]) == false &&
                    key === targetName) {
                    try {
                        const targetObj = env[key];
                        for (const var_name in targetObj) {
                            env[var_name] = targetObj[var_name];
                        }
                    } catch (error) {
                        // nothing todo
                    }
                }
            }

            // delete non-string obj
            for (const key in env) {
                if (typeof env[key] == 'object' ||
                    Array.isArray(env[key]) ||
                    key.includes(' ')) {
                    delete env[key];
                }
            }
        }

        // update and ret
        this.__env_lastEnvObj = env;
        this.__env_lastUpdateTime = Date.now();
        return this.__env_lastEnvObj;
    }

    getFilesOptionsFile(): File {

        const target = this.getCurrentTarget().toLowerCase();
        const templateFile = File.fromArray([
            ResManager.GetInstance().GetAppDataDir().path, 'template.files.options.yml'
        ]);

        const optFile = File.fromArray([this.getEideDir().path, `${target}.files.options.yml`]);
        if (!optFile.IsFile()) {
            optFile.Write(templateFile.Read());
        }

        return optFile;
    }

    getFilesOptions(): FilesOptions | undefined {

        const optFile = this.getFilesOptionsFile();

        try {
            return yaml.parse(optFile.Read());
        } catch (error) {
            GlobalEvent.emit('msg', newMessage('Warning', `error format '${optFile.name}', it must be a yaml file !`));
        }
    }

    getBuilderOptions(): ICompileOptions {
        const cfg = this.GetConfiguration();
        return cfg.compileConfigModel.getOptions(this.getEideDir().path, cfg.config);
    }

    //---

    protected loadToolchain() {
        const prjConfig = this.GetConfiguration();
        const toolManager = ToolchainManager.getInstance();
        this.toolchain = toolManager.getToolchain(prjConfig.config.type, prjConfig.config.toolchain);
        const opFile = prjConfig.compileConfigModel.getOptionsFile(this.getEideDir().path, prjConfig.config);
        toolManager.updateToolchainConfig(opFile, this.toolchain);
    }

    protected reloadToolchain() {
        this.loadToolchain();
        this.dependenceManager.flushToolchainDep();
        this.packManager.refreshComponents();
        this.onToolchainChanged();
        this.emit('dataChanged'); // must send global event to refresh view
    }

    protected reloadUploader() {
        const prjConfig = this.GetConfiguration();
        prjConfig.uploadConfigModel.emit('NotifyUpdate', prjConfig); // notify update upload config
        this.onUploaderChanged();
        this.emit('dataChanged'); // must send global event to refresh view
    }

    protected loadUploader() {
        const prjConfig = this.GetConfiguration();
        prjConfig.uploadConfigModel.emit('NotifyUpdate', prjConfig); // notify update upload config
        this.onUploaderChanged();
    }

    protected LoadSourceRootFolders() {
        this.sourceRoots.load(true);
        this.virtualSource.load(true);
        this.onSourceRootChanged('dataChanged');
    }

    public updateDebugConfig() {
        const debugConfigGenerator = IDebugConfigGenerator.newInstance(this);
        if (debugConfigGenerator) {
            const launchConfig = File.fromArray([this.GetWorkspaceConfig().GetFile().dir, AbstractProject.vsCodeDir, 'launch.json']);
            debugConfigGenerator.load(launchConfig);
            debugConfigGenerator.update();
        }
    }

    protected ThrowIf(checkRes: CheckResult) {
        if (!checkRes.success) {
            if (checkRes.err) {
                throw checkRes.err;
            }
        }
    }

    protected LoadConfigurations(wsFile: File) {
        this.configMap.Set(new WorkspaceConfiguration(wsFile), AbstractProject.workspaceSuffix);
        this.configMap.Set(new ProjectConfiguration(File.fromArray([wsFile.dir, AbstractProject.EIDE_DIR, AbstractProject.prjConfigName])));
        File.fromArray([wsFile.dir, AbstractProject.vsCodeDir]).CreateDir(true); // create '.vscode' folder if it's not existed
        this.configMap.Set(new CppConfiguration(File.fromArray([wsFile.dir, AbstractProject.vsCodeDir, AbstractProject.cppConfigName])));
    }

    private prevSaveTask: NodeJS.Timeout | undefined;
    protected UpdateDataChangedCount() {
        if (this.prevSaveTask == undefined) {
            this.prevSaveTask = setTimeout(() => {
                try { this.GetConfiguration().Save(); } catch (error) { }
                this.prevSaveTask = undefined;
            }, 300);
        }
    }

    private RegisterEvent(): void {

        this.sourceRoots.on('dataChanged', (e) => this.onSourceRootChanged(e));

        this.virtualSource.on('dataChanged', (e) => this.onSourceRootChanged(e));

        const prjConfig = this.GetConfiguration();

        prjConfig.on('dataChanged', (type) => this.onPrjConfigChanged(type));

        prjConfig.compileConfigModel.on('event', (eDat) => this.onConfigurationEvent(eDat));

        prjConfig.uploadConfigModel.on('event', (eDat) => this.onConfigurationEvent(eDat));

        this.packManager.on('deviceChanged', (dev) => this.onDeviceChanged(dev));

        this.packManager.on('packageChanged', () => this.onPackageChanged());

        this.packManager.on('componentUpdate', (upList) => this.onComponentUpdate(upList));

        ToolchainManager.getInstance().on('onChanged', (tName) => this.onToolchainModified(tName));

        // update config which depend other configs
        this.on('dataChanged', (type) => {

            if (['uploader', 'pack'].includes(<string>type)) {

                // update pyOCD options
                if (type === 'pack' && prjConfig.config.uploader === 'pyOCD') {
                    const deviceInfo = this.GetPackManager().getCurrentDevInfo();
                    if (deviceInfo) {
                        prjConfig.uploadConfigModel.SetKeyValue('targetName', deviceInfo.name.toLowerCase());
                        return; // exit, because this event will trigger 'update debug config' operations
                    }
                }

                // update debug config after uploader changed
                this.updateDebugConfig();
            }
        });
    }

    //---

    protected isAnNewProject?: boolean | undefined;

    protected async BeforeLoad(wsFile: File): Promise<void> {

        // check project version
        const eideFile = File.fromArray([wsFile.dir, AbstractProject.EIDE_DIR, AbstractProject.prjConfigName]);
        const conf = <ProjectConfigData<any>>JSON.parse(eideFile.Read());
        if (conf.version) {
            const prj_version = conf.version;
            const eide_conf_v = EIDE_CONF_VERSION;
            const prjv_vs_eidev = compareVersion(prj_version, eide_conf_v);
            if (prjv_vs_eidev > 0) { // prj version > eide, error
                throw Error(`The project config version is '${conf.version}', but eide is '${EIDE_CONF_VERSION}'. Please update 'eide' to the latest version !`);
            } else if (prjv_vs_eidev < 0) { // prj version < eide, update it
                conf.version = EIDE_CONF_VERSION;
                eideFile.Write(JSON.stringify(conf));
            }
        }

        // check is an new project ?
        if (conf.miscInfo == undefined ||
            conf.miscInfo.uid == undefined) {
            this.isAnNewProject = true;
        }
    }

    protected async AfterLoad(): Promise<void> {

        const prjConfig = this.GetConfiguration();

        // force flush toolchain dependence
        this.dependenceManager.Refresh(true);
        this.emit('dataChanged', 'dependence');

        // update uid if project not have
        if (prjConfig.config.miscInfo.uid === undefined) {
            prjConfig.config.miscInfo.uid = md5(`${this.getEideDir().path}-${Date.now()}`);
        }

        // remove build-in deps for old version
        prjConfig.BuildIn_RemoveAllDefines();

        /* check toolchain is installed ? */
        this.checkAndNotifyInstallToolchain();
    }

    //------------------------ event callback--------------------------

    protected onConfigurationEvent(eventData: EventData): void {

        switch (eventData.event) {
            case 'openCompileOptions':
                try {
                    WebPanelManager.newInstance().showBuilderOptions(this);
                } catch (err) {
                    GlobalEvent.emit('error', err);
                }
                break;
            case 'openMemLayout':
                WebPanelManager.newInstance().showStorageLayoutView(this);
                break;
            case 'openUploadOptions':
                if (eventData.data['path'] !== undefined) {
                    const configFile = new File(this.ToAbsolutePath(eventData.data['path']));
                    if (!configFile.IsFile()) {
                        configFile.Write(eventData.data['default'] || '');
                    }
                    vscode.window.showTextDocument(vscode.Uri.parse(configFile.ToUri()), {
                        preview: true
                    });
                }
                break;
            default:
                GlobalEvent.emit('msg', newMessage('Warning', 'Invalid event \'' + eventData.event + '\''));
                break;
        }
    }

    protected onToolchainModified(tName: ToolchainName) {
        if (tName === this.getToolchain().name) { // reload toolchain
            this.loadToolchain();
            this.dependenceManager.flushToolchainDep();
            this.emit('dataChanged', 'compiler');
        }
    }

    public checkAndNotifyInstallToolchain(): boolean {
        const toolchainManager = ToolchainManager.getInstance();
        const toolchain = this.getToolchain();
        if (!toolchainManager.isToolchainPathReady(toolchain.name)) {
            const dir = toolchainManager.getToolchainExecutableFolder(toolchain.name);
            const msg = view_str$prompt$not_found_compiler.replace('{}', toolchain.name)
                + `, [path]: ${dir?.path}`;
            ResInstaller.instance().setOrInstallTools(toolchain.name, msg, toolchain.settingName);
            return false;
        }
        return true;
    }

    public notifySourceExplorerViewRefresh() {
        this.emit('dataChanged', 'files');
    }

    protected onToolchainChanged() {
        /* check toolchain is installed ? */
        this.checkAndNotifyInstallToolchain();
    }

    protected onUploaderChanged() {
        this.updateDebugConfig(); // update debug config after uploader changed
    }

    protected abstract onComponentUpdate(updateList: ComponentUpdateItem[]): void;

    protected abstract onPrjConfigChanged(type: ProjectConfigEvent): void;

    protected abstract onSourceRootChanged(e: SourceChangedEvent): void;

    protected abstract onDeviceChanged(oledDevice?: CurrentDevice): void;

    protected abstract onPackageChanged(): void;

    abstract NotifyBuilderConfigUpdate(fileName: string): void;

    //-----------------------------------------------------------

    public abstract notifyUpdateSourceRefs(toolchain: ToolchainName | undefined): void;

    public abstract getSourceRefs(file: File): File[];

    //-----------------------------------------------------------

    public abstract createBase(option: CreateOptions, createNewPrjFolder?: boolean): BaseProjectInfo;

    protected abstract create(option: CreateOptions): File;

    abstract ExportToKeilProject(): File | undefined;

    static NewProject(): AbstractProject {
        return new EIDEProject();
    }
}

class EIDEProject extends AbstractProject {

    //////////////////////////////// Event handler ///////////////////////////////////

    protected onComponentUpdate(updateList: ComponentUpdateItem[]): void {

        const packInfo = this.packManager.GetPack();
        if (packInfo) {

            vscode.window.withProgress({
                title: `${packInfo.name}`,
                location: vscode.ProgressLocation.Notification
            }, (progress) => {
                return new Promise<void>((resolve) => {

                    const inc = 1 / updateList.length;
                    this.GetConfiguration().beginCacheEvents();

                    updateList.forEach((compItem, index) => {

                        this.dependenceManager.UninstallComponent(packInfo.name, compItem.name);

                        if (compItem.state === ComponentUpdateType.Expired) { // if need reinstalled
                            const comp = this.packManager.FindComponent(compItem.name);
                            if (comp) {
                                this.dependenceManager.InstallComponent(packInfo.name, comp);
                            }
                        }

                        progress.report({
                            increment: inc,
                            message: `Updating components ${index + 1}/${updateList.length}: ${compItem.name}`
                        });
                    });

                    this.GetConfiguration().endCachedEvents();

                    resolve();
                });
            });
        }
    }

    protected onPrjConfigChanged(event: ProjectConfigEvent): void {

        switch (event.type) {
            case 'srcRootAdd':
                this.sourceRoots.add(<string>event.data);
                this.emit('dataChanged', 'files');
                this.UpdateCppConfig();
                break;
            case 'srcRootRemoved':
                this.sourceRoots.remove(<string>event.data);
                this.emit('dataChanged', 'files');
                this.UpdateCppConfig();
                break;
            case 'compiler':
                this.emit('dataChanged', 'compiler');
                this.UpdateCppConfig();
                break;
            case 'uploader':
                this.emit('dataChanged', 'uploader');
                break;
            case 'dependence':
                this.emit('dataChanged', 'dependence');
                this.UpdateCppConfig();
                break;
            default:
                this.emit('dataChanged');
                break;
        }

        this.UpdateDataChangedCount();
    }

    protected onSourceRootChanged(type: SourceChangedEvent): void {
        switch (type) {
            case 'dataChanged':
                // update to config
                const prjConfig = this.GetConfiguration();
                prjConfig.config.srcDirs = this.getSourceRootFolders()
                    .map((folder) => { return folder.fileWatcher.file.path; });
                // update cpp config
                this.UpdateCppConfig();
                this.emit('dataChanged', 'files');
                break;
            case 'folderStatusChanged':
            case 'folderChanged':
                this.UpdateCppConfig();
                this.emit('dataChanged', 'files');
                break;
            default:
                this.emit('dataChanged', 'files');
                break;
        }
    }

    protected onDeviceChanged(oldDevice?: CurrentDevice | undefined): void {

        const prjConfig = this.GetConfiguration();
        const cConfig = prjConfig.compileConfigModel;

        // project type is ARM
        if (cConfig instanceof ArmBaseCompileConfigModel) {

            const newDevInfo = this.GetPackManager().getCurrentDevInfo();

            // clear old device
            if (oldDevice) {
                const dev = this.packManager.getCurrentDevInfo(oldDevice);
                const define = dev?.define?.split(/ |,/g);
                if (define && newDevInfo) { // if we switch device, remove old device macros 
                    this.GetConfiguration().CustomDep_RemoveFromDefineList(define);
                }
            }

            // update new device
            if (newDevInfo) {

                // update compile options
                cConfig.SetKeyValue('cpuType', newDevInfo.core || 'Cortex-M3');
                cConfig.updateStorageLayout(newDevInfo.storageLayout);

                // update device, set macro
                prjConfig.config.deviceName = newDevInfo.name;
                if (newDevInfo.define) {
                    this.GetConfiguration().CustomDep_AddAllFromDefineList(newDevInfo.define.split(/ |,/g));
                }
            }

            this.emit('dataChanged', 'pack');
        }
    }

    protected onPackageChanged(): void {
        const prjConfig = this.GetConfiguration();
        const packDir = this.GetPackManager().GetPackDir();
        if (packDir) {
            const rePackDir = this.ToRelativePath(packDir.path);
            prjConfig.config.packDir = rePackDir ? rePackDir : null;
        }
        this.dependenceManager.Refresh();
        this.emit('dataChanged', 'pack');
    }

    NotifyBuilderConfigUpdate(fileName: string): void {
        this.dependenceManager.flushToolchainDep();
    }

    //////////////////////////////// source refs ///////////////////////////////////

    private srcRefMap: Map<string, File[]> = new Map();

    public async notifyUpdateSourceRefs(toolchain_: ToolchainName | undefined) {

        /* clear old */
        this.srcRefMap.clear();

        /* check source references is enabled ? */
        if (!SettingManager.GetInstance().isDisplaySourceRefs()) return;

        const toolName = toolchain_ || this.getToolchain().name;

        const outFolder = this.getOutputFolder();
        const refListFile = File.fromArray([outFolder.path, 'ref.json']);
        if (!refListFile.IsFile()) return; /* no refs list file, exit */

        try {
            const refMap = JSON.parse(refListFile.Read());
            for (const srcName in refMap) {
                const refFile = new File((<string>refMap[srcName]).replace(/\.[^\\\/\.]+$/, '.d'));
                if (!refFile.IsFile()) continue;
                const refs = this.parseRefFile(refFile, toolName);
                this.srcRefMap.set(srcName, refs.map((path) => new File(path)));
            }
        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Hidden'));
        }

        // notify update src view
        this.emit('dataChanged', 'files');
    }

    public getSourceRefs(file: File): File[] {
        return this.srcRefMap.get(file.path) || [];
    }

    private whitespaceMatcher = /(?<![\\:]) /;

    private gnu_parseRefLines(lines: string[]): string[] {

        const resultList: string[] = [];

        for (let i = 0; i < lines.length; i++) {

            let line = lines[i].replace(/\\\s*$/, '').trim(); // remove char '\' end of line

            if (i == 0) { // first line is makefile dep format: '<obj>: <deps>'
                let sepIndex = line.indexOf(": ");
                if (sepIndex > 0) line = line.substring(sepIndex + 1).trim();
                else continue; /* line is invalid, skip */
            }

            const subLines = line.split(this.whitespaceMatcher);

            for (const headerName of subLines) {
                if (headerName == '') continue;
                resultList.push(this.ToAbsolutePath(headerName
                    .replace(/\\ /g, " ")
                    .replace(/\\:/g, ":")));
            }
        }

        return ArrayDelRepetition(resultList.slice(1));
    }

    private ac5_parseRefLines(lines: string[], startIndex: number = 1): string[] {

        const resultList: string[] = [];

        for (let i = startIndex; i < lines.length; i++) {
            const sepIndex = lines[i].indexOf(": ");
            if (sepIndex > 0) {
                const line = lines[i].substring(sepIndex + 1).trim();
                resultList.push(this.ToAbsolutePath(line));
            }
        }

        return ArrayDelRepetition(resultList);
    }

    private parseRefFile(dFile: File, toolchain: ToolchainName): string[] {

        const lines: string[] = dFile.Read()
            .split(/\r\n|\n/)
            .filter((line) => line.trim() != '');

        switch (toolchain) {
            case "AC5":
                return this.ac5_parseRefLines(lines);
            case "IAR_STM8":
                return this.ac5_parseRefLines(lines, 2);
            case "SDCC":
            case "AC6":
            case "GCC":
                return this.gnu_parseRefLines(lines);
            default:
                return this.gnu_parseRefLines(lines);
        }
    }

    //////////////////////////////// create project ///////////////////////////////////

    public createBase(option: CreateOptions, createNewPrjFolder: boolean = true): BaseProjectInfo {

        const rootDir: File = createNewPrjFolder ?
            File.fromArray([option.outDir.path, option.name]) : option.outDir;
        rootDir.CreateDir(true);

        const wsFile = File.fromArray([rootDir.path, option.name + AbstractProject.workspaceSuffix]);

        // if workspace is existed, force delete it
        if (wsFile.IsFile()) { try { fs.unlinkSync(wsFile.path); } catch (error) { } }

        File.fromArray([wsFile.dir, AbstractProject.EIDE_DIR]).CreateDir(true);
        File.fromArray([wsFile.dir, AbstractProject.vsCodeDir]).CreateDir(true);

        const wsConfig = new WorkspaceConfiguration(wsFile);
        const prjConfig = new ProjectConfiguration(
            File.fromArray([wsFile.dir, AbstractProject.EIDE_DIR, AbstractProject.prjConfigName]), option.type);
        const cppConfig = new CppConfiguration(
            File.fromArray([wsFile.dir, AbstractProject.vsCodeDir, AbstractProject.cppConfigName]));

        // set project name
        prjConfig.config.name = option.name;

        return {
            rootFolder: rootDir,
            workspaceFile: wsFile,
            prjConfig: prjConfig
        };
    }

    protected create(option: CreateOptions): File {

        const baseInfo = this.createBase(option);

        baseInfo.prjConfig.config.name = option.name;
        baseInfo.prjConfig.config.outDir = '.' + File.sep + 'build';
        baseInfo.prjConfig.config.srcDirs = ['.' + File.sep + 'src'];

        const src = File.fromArray([baseInfo.rootFolder.path, 'src']);
        src.CreateDir(false);

        // create 'main.c' file if not exist
        const mainFile = File.fromArray([src.path, 'main.c']);
        if (!mainFile.IsFile()) {
            mainFile.Write('');
        }

        baseInfo.prjConfig.Save();

        return baseInfo.workspaceFile;
    }

    ExportToKeilProject(): File | undefined {

        let keilFile: File;

        const prjConfig = this.GetConfiguration().config;

        if (!['ARM', 'C51'].includes(prjConfig.type)) { // only support for ARM, C51 project
            throw new Error(`only support for 'ARM', 'C51' project`);
        }

        const keilSuffix = prjConfig.type === 'C51' ? 'uvproj' : 'uvprojx';
        const suffixFilter = [new RegExp('\\.' + keilSuffix + '$', 'i')];

        // local keil file
        const localKeilFile = File.fromArray([this.GetRootDir().path, `${prjConfig.name}.${keilSuffix}`]);

        // get from project root folder
        if (localKeilFile.IsFile()) {
            keilFile = localKeilFile;
        } else {
            const keilFileList = ResManager.GetInstance().GetTemplateDir().GetList(suffixFilter, File.EMPTY_FILTER);
            const fIndex = keilFileList.findIndex((f) => { return f.noSuffixName === prjConfig.type; });
            if (fIndex === -1) {
                throw new Error('Not found \'' + prjConfig.type + '\' keil template file');
            }
            keilFile = keilFileList[fIndex];
        }

        const keilParser = KeilParser.NewInstance(keilFile);

        let cDevice: CurrentDevice | undefined;
        if (prjConfig.type === 'ARM') { // only for ARM project
            cDevice = this.packManager.GetCurrentDevice();
        }

        const fileGroups: FileGroup[] = [];
        let halFiles: FileItem[] = [];

        this.getFileGroups().forEach((_group) => {

            // is filesystem source
            if (!AbstractProject.isVirtualSourceGroup(_group)) {
                const group = <ProjectFileGroup>_group;
                const rePath = this.ToRelativePath(group.dir.path, false);
                // combine HAL folder
                if (rePath && rePath.startsWith(DependenceManager.DEPENDENCE_DIR)) {
                    halFiles = halFiles.concat(group.files);
                }
                else {
                    fileGroups.push(<FileGroup>{
                        name: (<string>rePath).replace(/\\/g, '/').toUpperCase(),
                        files: group.files,
                        disabled: group.disabled
                    });
                }
            }

            // is virtual source
            else {
                fileGroups.push(_group);
            }
        });

        if (halFiles.length > 0) {
            const index = fileGroups.findIndex((group) => { return group.name === 'HAL'; });
            if (index === -1) {
                fileGroups.push(<FileGroup>{
                    name: 'HAL',
                    files: halFiles
                });
            } else {
                fileGroups[index].files = fileGroups[index].files.concat(halFiles);
            }
        }

        // set keil xml
        keilParser.SetKeilXml(this, fileGroups, cDevice);

        return keilParser.Save(this.GetRootDir(), localKeilFile.noSuffixName);
    }

    //////////////////////////////// overrride ///////////////////////////////////

    private async runInstallScript(prjRoot: File, scriptName: string, title?: string): Promise<boolean> {

        const script = File.fromArray([prjRoot.path, AbstractProject.EIDE_DIR, scriptName]);
        const bash = ResManager.GetInstance().getMsysBash();
        if (!script.IsFile()) return true; // not found script, exit

        try {

            const proc = new ExeCmd();
            const cmd = `./${AbstractProject.EIDE_DIR}/${scriptName}`;

            title = title || script.noSuffixName;

            return vscode.window.withProgress({
                title: title,
                location: vscode.ProgressLocation.Notification
            }, (): Thenable<boolean> => {

                return new Promise((resolve) => {

                    proc.on('launch', () => {
                        GlobalEvent.emit('eide.log.append', os.EOL + `>> running '${scriptName}' ...` + os.EOL);
                        GlobalEvent.emit('eide.log.show');
                    });

                    proc.on('line', (line) => GlobalEvent.emit('eide.log.append', line + os.EOL));
                    proc.on('errLine', (line) => GlobalEvent.emit('eide.log.append', line + os.EOL));
                    proc.on('error', (err) => GlobalEvent.emit('globalLog', ExceptionToMessage(err)));

                    proc.on('close', (exitInf) => {
                        GlobalEvent.emit('eide.log.append', os.EOL + `process exited, exitCode: ${exitInf.code}` + os.EOL)
                        resolve(exitInf.code == 0);
                    });

                    proc.Run(cmd, undefined, { cwd: prjRoot.path, shell: bash.path });
                });
            });

        } catch (error) {
            GlobalEvent.emit('globalLog', ExceptionToMessage(error));
            GlobalEvent.emit('eide.log.show');
        }

        return false;
    }

    protected async BeforeLoad(wsFile: File): Promise<void> {

        await super.BeforeLoad(wsFile);

        // run pre-install.sh
        if (this.isAnNewProject) {
            const name = 'pre-install.sh';
            const prjRoot = new File(wsFile.dir);
            const ok = await this.runInstallScript(prjRoot, name, `Running 'post-install' ...`);
            if (!ok) { throw new Error(`Run '${name}' failed !, please check logs in 'eide-log' output panel.`); }
        }
    }

    protected async AfterLoad(): Promise<void> {

        await super.AfterLoad();

        /* update workspace settings */
        if (this.isAnNewProject) {

            const workspaceConfig = this.GetWorkspaceConfig();
            const settings = workspaceConfig.config.settings;
            const toolchain = this.getToolchain();

            if (isNullOrUndefined(settings['files.associations'])) {
                settings['files.associations'] = {
                    ".eideignore": "ignore"
                };
            } else if (isNullOrUndefined(settings['files.associations']['.eideignore'])) {
                settings['files.associations']['.eideignore'] = 'ignore';
            }

            if (settings['files.autoGuessEncoding'] === undefined) {
                settings['files.autoGuessEncoding'] = true;
            }

            if (settings['[yaml]'] === undefined) {
                settings['[yaml]'] = {
                    "editor.insertSpaces": true,
                    "editor.tabSize": 4,
                    "editor.autoIndent": "advanced"
                };
            }

            if (toolchain.name === 'Keil_C51') {
                if (settings['C_Cpp.errorSquiggles'] === undefined) {
                    settings['C_Cpp.errorSquiggles'] = "Disabled";
                }
            }

            // append default task for new project
            const defTasks = [
                {
                    "label": "build",
                    "type": "shell",
                    "command": "${command:eide.project.build}",
                    "group": "build",
                    "problemMatcher": "$gcc"
                },
                {
                    "label": "flash",
                    "type": "shell",
                    "command": "${command:eide.project.uploadToDevice}",
                    "group": "build",
                    "problemMatcher": []
                },
                {
                    "label": "build and flash",
                    "type": "shell",
                    "command": "${command:eide.project.buildAndFlash}",
                    "group": "build"
                },
                {
                    "label": "rebuild",
                    "type": "shell",
                    "command": "${command:eide.project.rebuild}",
                    "group": "build",
                    "problemMatcher": "$gcc"
                },
                {
                    "label": "clean",
                    "type": "shell",
                    "command": "${command:eide.project.clean}",
                    "group": "build",
                    "problemMatcher": []
                }
            ];

            if (!workspaceConfig.config.tasks) {
                workspaceConfig.config.tasks = {
                    "version": "2.0.0",
                    "tasks": defTasks
                }
            }

            else if (Array.isArray(workspaceConfig.config.tasks.tasks)
                && workspaceConfig.config.tasks.tasks.length == 0) {
                workspaceConfig.config.tasks.tasks = defTasks;
            }

            // add extension recommendation
            {
                let recommendExt: string[] = [
                    "cl.eide",
                    "keroc.hex-fmt",
                    "xiaoyongdong.srecord",
                    "hars.cppsnippets",
                    "zixuanwang.linkerscript",
                    "redhat.vscode-yaml"
                ];

                const prjInfo = this.GetConfiguration().config;

                if (prjInfo.type == 'ARM') {
                    recommendExt.push(
                        "dan-c-underwood.arm",
                        "zixuanwang.linkerscript",
                        "marus25.cortex-debug",
                    );
                }

                else if (prjInfo.type == 'C51') {
                    recommendExt.push('cl.stm8-debug');
                }

                if (workspaceConfig.config.extensions &&
                    workspaceConfig.config.extensions.recommendations instanceof Array) {
                    recommendExt = ArrayDelRepetition(recommendExt.concat(workspaceConfig.config.extensions.recommendations));
                }

                if (workspaceConfig.config.extensions == undefined) {
                    workspaceConfig.config.extensions = {};
                }

                workspaceConfig.config.extensions.recommendations = recommendExt;
            }

            workspaceConfig.forceSave();
        }

        /* update src refs */
        this.notifyUpdateSourceRefs(undefined);

        // allow intellisense provider for workspace if we have not
        // and notify cpptools launch
        {
            const cppConfig = this.GetCppConfig();
            const cppConfigItem = cppConfig.getConfig();
            if (!cppConfigItem.configurationProvider) {
                const newCfg: CppConfigItem = {
                    name: os.platform(),
                    includePath: <any>undefined,
                    defines: <any>undefined,
                    configurationProvider: this.extensionId
                };
                cppConfig.setConfig(newCfg);
                cppConfig.saveToFile();
            }
        }

        // run post-install.sh
        if (this.isAnNewProject) {
            this.runInstallScript(this.GetRootDir(), 'post-install.sh', `Running 'post-install' ...`)
                .then((done) => {
                    if (!done) {
                        const msg = `Run 'post-install' failed !, please check logs in 'eide-log' output panel.`;
                        vscode.window.showWarningMessage(msg);
                        GlobalEvent.emit('eide.log.show');
                    }
                });
        }
    }

    ////////////////////////////////// cpptools intellisence provider ///////////////////////////////////

    name: string = 'eide';
    extensionId: string = 'cl.eide';

    private vSourceList: string[] = [];
    private cppToolsConfig: CppConfigItem = {
        name: os.platform(),
        includePath: [],
        defines: []
    };

    private __cpptools_updateTimeout: NodeJS.Timeout | undefined;

    UpdateCppConfig() {

        // if updater not in running, create it
        if (this.__cpptools_updateTimeout == undefined) {
            this.__cpptools_updateTimeout =
                setTimeout(() => this.doUpdateCpptoolsConfig(), 200);
        }

        // we already have a updater in running, now delay it
        else {
            this.__cpptools_updateTimeout.refresh();
        }
    }

    private doUpdateCpptoolsConfig() {

        const builderOpts = this.getBuilderOptions();
        const toolchain = this.getToolchain();
        const prjConfig = this.GetConfiguration();

        // update includes and defines 
        const depMerge = prjConfig.GetAllMergeDep();
        const defMacros: string[] = ['__VSCODE_CPPTOOL']; // it's for internal force include header
        const defLi = defMacros.concat(depMerge.defineList, toolchain.getInternalDefines(builderOpts));
        depMerge.incList = ArrayDelRepetition(depMerge.incList.concat(this.getSourceIncludeList()));
        this.cppToolsConfig.includePath = depMerge.incList.map((_path) => File.ToUnixPath(_path));
        this.cppToolsConfig.defines = ArrayDelRepetition(defLi);

        // update intellisence info
        {
            // clear old value
            this.cppToolsConfig.compilerArgs = undefined;
            this.cppToolsConfig.cCompilerArgs = undefined;
            this.cppToolsConfig.cppCompilerArgs = undefined;

            // preset cpu info for arm project
            if (prjConfig.compileConfigModel instanceof ArmBaseCompileConfigModel) {
                builderOpts.global = builderOpts.global || {};
                const cpuName = prjConfig.compileConfigModel.data.cpuType.toLowerCase();
                const fpuName = prjConfig.compileConfigModel.data.floatingPointHardware.toLowerCase();
                builderOpts.global['cpuType'] = cpuName.replace('cortex-m0+', 'cortex-m0plus');
                builderOpts.global['fpuType'] = fpuName.replace('single', 'sp').replace('double', 'dp');
            }

            // update
            toolchain.updateCppIntellisenceCfg(builderOpts, this.cppToolsConfig);

            // merge c compiler args
            if (this.cppToolsConfig.compilerArgs || this.cppToolsConfig.cCompilerArgs) {

                this.cppToolsConfig.cCompilerArgs = (this.cppToolsConfig.compilerArgs || [])
                    .concat(this.cppToolsConfig.cCompilerArgs || []);

                this.cppToolsConfig.cCompilerArgs = this.cppToolsConfig.cCompilerArgs.map((param) => {
                    return param.replace('${c_cppStandard}', this.cppToolsConfig.cStandard || 'c11');
                });
            }

            // merge c++ compiler args
            if (this.cppToolsConfig.compilerArgs || this.cppToolsConfig.cppCompilerArgs) {

                this.cppToolsConfig.cppCompilerArgs = (this.cppToolsConfig.compilerArgs || [])
                    .concat(this.cppToolsConfig.cppCompilerArgs || []);

                this.cppToolsConfig.cppCompilerArgs = this.cppToolsConfig.cppCompilerArgs.map((param) => {
                    return param.replace('${c_cppStandard}', this.cppToolsConfig.cppStandard || 'c++11');
                });
            }

            // replace var value for global args
            if (this.cppToolsConfig.compilerArgs) {
                this.cppToolsConfig.compilerArgs = (<string[]>this.cppToolsConfig.compilerArgs).map((param) => {
                    return param.replace('${c_cppStandard}', this.cppToolsConfig.cppStandard || 'c++11');
                });
            }
        }

        // update source browse path
        let srcBrowseFolders: string[] = [];

        this.vSourceList = [];
        this.getVirtualSourceManager().traverse((vFolder) => {
            vFolder.folder.files.forEach((vFile) => {
                const fAbsPath = this.ToAbsolutePath(vFile.path);
                this.vSourceList.push(fAbsPath);
                srcBrowseFolders.push(`${File.ToUnixPath(NodePath.dirname(fAbsPath))}/*`);
            });
        });

        this.getNormalSourceManager().getFileGroups().forEach(fGrp => {
            if (fGrp.disabled) { return; } // skip disabled group
            fGrp.files.forEach(fItem => {
                if (fItem.disabled) { return; } // skip disabled file
                srcBrowseFolders.push(`${File.ToUnixPath(fItem.file.dir)}/*`);
            });
        });

        // update includes to browse info
        this.cppToolsConfig.browse = {
            limitSymbolsToIncludedHeaders: true,
            path: ArrayDelRepetition(srcBrowseFolders)
        };

        // compiler path
        this.cppToolsConfig.compilerPath = this.getToolchain().getGccCompilerPath();

        // update forceinclude headers
        this.cppToolsConfig.forcedInclude = [];

        toolchain.getForceIncludeHeaders()?.forEach((f_path) => {
            this.cppToolsConfig.forcedInclude?.push(NodePath.normalize(f_path));
        });

        SettingManager.GetInstance().getForceIncludeList().forEach((path) => {
            this.cppToolsConfig.forcedInclude?.push(this.ToAbsolutePath(path));
        });

        // notify config changed
        this.emit('cppConfigChanged');
        console.log(this.cppToolsConfig);

        // clear timeout obj
        this.__cpptools_updateTimeout = undefined;
    }

    canProvideConfiguration(uri: vscode.Uri, token?: vscode.CancellationToken | undefined): Thenable<boolean> {
        return new Promise((resolve) => {
            const prjRoot = this.GetRootDir();
            if (uri.fsPath.startsWith(prjRoot.path)) {
                resolve(true);
            } else {
                resolve(this.vSourceList.includes(uri.fsPath));
            }
        });
    }

    private readonly cFileMatcher = /\.(?:c|h)$/i;

    provideConfigurations(uris: vscode.Uri[], token?: vscode.CancellationToken | undefined): Thenable<SourceFileConfigurationItem[]> {
        return new Promise((resolve) => {
            resolve(uris.map((uri) => {
                if (this.cFileMatcher.test(uri.fsPath)) { // c files
                    return {
                        uri: uri,
                        configuration: {
                            standard: <any>this.cppToolsConfig.cStandard,
                            includePath: this.cppToolsConfig.includePath,
                            defines: this.cppToolsConfig.defines,
                            forcedInclude: this.cppToolsConfig.forcedInclude,
                            compilerPath: this.cppToolsConfig.compilerPath,
                            compilerArgs: this.cppToolsConfig.cCompilerArgs
                        }
                    };
                } else { // c++ files
                    return {
                        uri: uri,
                        configuration: {
                            standard: <any>this.cppToolsConfig.cppStandard,
                            includePath: this.cppToolsConfig.includePath,
                            defines: this.cppToolsConfig.defines,
                            forcedInclude: this.cppToolsConfig.forcedInclude,
                            compilerPath: this.cppToolsConfig.compilerPath,
                            compilerArgs: this.cppToolsConfig.cppCompilerArgs
                        }
                    };
                }
            }));
        });
    }

    canProvideBrowseConfigurationsPerFolder(token?: vscode.CancellationToken | undefined): Thenable<boolean> {
        return new Promise((resolve) => {
            resolve(true);
        });
    }

    provideFolderBrowseConfiguration(uri: vscode.Uri, token?: vscode.CancellationToken | undefined): Thenable<WorkspaceBrowseConfiguration | null> {
        return new Promise((resolve) => {
            if (this.GetRootDir().path === uri.fsPath) {
                resolve({
                    browsePath: this.cppToolsConfig.browse?.path || [],
                    compilerPath: this.cppToolsConfig.compilerPath,
                    compilerArgs: this.cppToolsConfig.compilerArgs
                });
            } else {
                resolve(null);
            }
        });
    }

    canProvideBrowseConfiguration(token?: vscode.CancellationToken | undefined): Thenable<boolean> {
        return new Promise((resolve) => {
            resolve(false);
        });
    }

    provideBrowseConfiguration(token?: vscode.CancellationToken | undefined): Thenable<WorkspaceBrowseConfiguration | null> {
        return new Promise((resolve) => {
            resolve(null);
        });
    }

    dispose() {
        // nothing todo
    }
}
