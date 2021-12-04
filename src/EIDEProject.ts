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

import { File } from '../lib/node-utility/File';
import { FileWatcher } from '../lib/node-utility/FileWatcher';
import { KeilParser } from './KeilXmlParser';
import { ResManager } from './ResManager';
import { Compress } from './Compress';
import {
    CurrentDevice, ConfigMap, FileGroup,
    ProjectConfiguration, ProjectConfigData, WorkspaceConfiguration,
    CppConfiguration, CreateOptions,
    ProjectConfigEvent, ProjectFileGroup, EventData, FileItem, EIDE_CONF_VERSION, ProjectTargetInfo, VirtualFolder, VirtualFile, CompileConfigModel, ArmBaseCompileData, ArmBaseCompileConfigModel, Dependence
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
import { md5, copyObject } from './utility';
import { ResInstaller } from './ResInstaller';
import {
    view_str$prompt$not_found_compiler, view_str$operation$name_can_not_be_blank,
    view_str$operation$name_can_not_have_invalid_char
} from './StringTable';
import { SettingManager } from './SettingManager';

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

    public static isVirtualFile(path: string): boolean {
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

    private traverse(func: (folderInfo: { path: string, folder: VirtualFolder }) => void) {

        const folderStack: { path: string, folder: VirtualFolder }[] = [];

        // put root folders
        this.getFolder()?.folders.forEach((vFolder) => {
            folderStack.push({
                path: `${VirtualSource.rootName}/${vFolder.name}`,
                folder: vFolder
            });
        });

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

    load() {
        this.config = this.project.GetConfiguration().config;
        this.forceUpdateAllFolders(); // refresh all
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

    load() {

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

        this.emit('dataChanged', 'dataChanged');
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
                    .filter((folder) => {
                        return !AbstractProject.excludeDirFilter.some((regexp) => {
                            return regexp.test(folder.name);
                        });
                    })
                    .forEach((folder) => {
                        folderStack.push(folder);
                    });
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

export abstract class AbstractProject {

    static readonly workspaceSuffix = '.code-workspace';
    static readonly vsCodeDir = '.vscode';
    static readonly EIDE_DIR = '.eide';
    static readonly LOG_DIR = 'log';

    static readonly cppConfigName = 'c_cpp_properties.json';
    static readonly prjConfigName = 'eide.json';

    static readonly headerFilter: RegExp[] = [/\.h$/i, /\.hxx$/i, /\.hpp$/i, /\.inc$/i];
    static readonly srcfileFilter: RegExp[] = [/\.cxx$/i, /\.cc$/i, /\.c\+\+$/i, /\.cpp$/i, /\.c$/i];
    static readonly libFileFilter: RegExp[] = [/\.lib$/i, /\.a$/i, /\.o$/i, /\.obj$/i];
    static readonly asmfileFilter: RegExp[] = [/\.s$/i, /\.a51$/i, /\.asm$/i];

    static readonly buildOutputMatcher: RegExp = /\.(?:elf|axf|out|hex|bin|s19|map|map\.view)$/i;

    static readonly excludeDirFilter: RegExp[] = [/^\.git$/i, /^\.vs$/i, /^\.vscode$/i, /^\.eide$/i];
    // this folder list will be excluded when search include path
    static readonly excludeIncSearchList: string[] = [DependenceManager.DEPENDENCE_DIR];

    //-------

    private static readonly dataChangedCountLimit = 5;
    private dataChangedCount = 0;

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

    constructor() {
        this._event = new events.EventEmitter();
        this.sourceRoots = new SourceRootList(this);
        this.virtualSource = new VirtualSource(this);
        this.configMap = new ConfigMap();
        this.packManager = new PackageManager(this);
        this.dependenceManager = new DependenceManager(this);
    }

    protected emit(event: 'dataChanged', type?: DataChangeType): boolean;
    protected emit(event: any, argc?: any): boolean {
        return this._event.emit(event, argc);
    }

    on(event: 'dataChanged', listener: (type?: DataChangeType) => void): this;
    on(event: any, listener: (argc?: any) => void): this {
        this._event.on(event, listener);
        return this;
    }

    static getFileFilters(): RegExp[] {
        return this.srcfileFilter.concat(this.headerFilter, this.libFileFilter, this.asmfileFilter);
    }

    static getSourceFileFilter(): RegExp[] {
        return this.srcfileFilter.concat(this.libFileFilter, this.asmfileFilter);
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
                    const pathReplacer = `.${File.sep}${DependenceManager.DEPENDENCE_DIR}${File.sep}`;
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
    }

    private initProjectConfig() {

        const prjConfig = this.GetConfiguration();

        // clear invalid exclude files (disabled, because we will add virtual folder support)
        /* prjConfig.config.excludeList = prjConfig.config.excludeList.filter((_path) => {
            return new File(this.ToAbsolutePath(_path)).IsExist();
        }); */

        // clear duplicated items
        prjConfig.config.excludeList = ArrayDelRepetition(prjConfig.config.excludeList);

        // clear invalid src folders
        prjConfig.config.srcDirs = prjConfig.config.srcDirs
            .filter(path => { return (new File(path)).IsDir(); });

        // clear invalid package path
        if (prjConfig.config.packDir
            && !(new File(this.ToAbsolutePath(prjConfig.config.packDir))).IsDir()) {
            prjConfig.config.packDir = null;
        }

        // set project name, (disabled, we will support custom project name)
        /* if (prjConfig.config.name !== (<FileWatcher>this.rootDirWatcher).file.name) {
            prjConfig.config.name = (<FileWatcher>this.rootDirWatcher).file.name;
        } */
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

    ToAbsolutePath(path: string): string {
        if (!File.isAbsolute(path)) {
            return NodePath.normalize(this.GetRootDir().path + NodePath.sep + path);
        }
        return NodePath.normalize(path);
    }

    ToRelativePath(path: string, hasPrefix: boolean = true): string | undefined {
        return this.GetRootDir().ToRelativePath(path.trim(), hasPrefix);
    }

    Load(wsFile: File) {
        this.BeforeLoad(wsFile);
        this.LoadConfigurations(wsFile);
        this.loadProjectDirectory();
        this.initProjectConfig();
        this.loadToolchain();
        this.loadUploader();
        this.initProjectComponents();
        this.RegisterEvent();
        this.LoadSourceRootFolders();
        this.AfterLoad();
    }

    Close() {

        if (this.rootDirWatcher) {
            this.rootDirWatcher.Close();
        }

        this.sourceRoots.DisposeAll();

        this.configMap.Dispose();
    }

    Create(option: CreateOptions) {
        this.Load(this.create(option));
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

    //=========== events ============

    NotifyBuilderConfigUpdate(name: string): void {
        this.dependenceManager.flushToolchainDep();
    }

    //=========== project targets ==============

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

    switchTarget(targetName: string) {
        const prjConfig = this.GetConfiguration<any>().config;
        if (targetName !== prjConfig.mode) {
            this._switchTarget(targetName);
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
        uploadConfig_.bin = null;
        for (let toolName in uploadConfigMap_) {
            if (uploadConfigMap_[toolName].bin) { uploadConfigMap_[toolName].bin = null; }
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
        this.setToolchain(targets[targetName].toolchain);
        this.setUploader(targets[targetName].uploader);

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

    setToolchain(name: ToolchainName) {
        const prjConfig = this.GetConfiguration();
        const oldToolchain = this.getToolchain().name;
        prjConfig.setToolchain(name);
        this.reloadToolchain(oldToolchain);
    }

    setUploader(uploader: HexUploaderType) {
        const prjConfig = this.GetConfiguration();
        const oldUploader = prjConfig.config.uploader;
        prjConfig.setHexUploader(uploader);
        this.reloadUploader(oldUploader);
    }

    // @deprecated
    updateUploaderHexFile(notEmitEvent?: boolean) {
        // set upload file path if prev value is not existed
        /* const prevBinFile = new File(this.ToAbsolutePath(this.GetConfiguration().uploadConfigModel.getKeyValue('bin')));
        if (!prevBinFile.IsFile()) {
            const binPath = this.getOutputDir() + File.sep + this.GetConfiguration().config.name + '.hex';
            if (notEmitEvent) {
                this.GetConfiguration().uploadConfigModel.data['bin'] = binPath;
            } else {
                this.GetConfiguration().uploadConfigModel.SetKeyValue('bin', binPath);
            }
        } */
    }

    //--

    isExcluded(path: string): boolean {
        const excludeList = this.GetConfiguration().config.excludeList;
        const rePath = this.ToRelativePath(path) || path;
        const isFolder = VirtualSource.isVirtualFile(path) ?
            this.virtualSource.isFolder(path) : File.IsDir(path);
        if (isFolder) {
            return excludeList.findIndex(excPath => rePath.startsWith(excPath)) !== -1;
        }
        return excludeList.findIndex(excPath => { return rePath === excPath; }) !== -1;
    }

    protected addExclude(path: string): boolean {
        const excludeList = this.GetConfiguration().config.excludeList;
        const rePath = this.ToRelativePath(path) || path;
        if (!excludeList.includes(rePath)) {
            excludeList.push(rePath);
            return true;
        }
        return false;
    }

    protected clearExclude(path: string): boolean {
        const excludeList = this.GetConfiguration().config.excludeList;
        const rePath = this.ToRelativePath(path) || path;
        const index = excludeList.indexOf(rePath);
        if (index !== -1) {
            excludeList.splice(index, 1);
            return true;
        }
        return false;
    }

    excludeSourceFile(path: string) {
        // it is not a header file
        if (!AbstractProject.headerFilter.some((reg) => { return reg.test(path); })) {
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

    addIncludePaths(pathList: string[]) {
        const includeList = this.sourceRoots.getIncludeList();
        this.GetConfiguration().CustomDep_AddIncFromPathList(pathList.filter((absPath) => {
            return !includeList.includes(absPath);
        }));
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

    getEnvFile(): File {

        const prjConfig = this.GetConfiguration();
        const targetName = prjConfig.config.mode.toLowerCase();

        const envFilePath = `${this.getEideDir().path}${File.sep}${targetName}.env.ini`;
        const envFile = new File(envFilePath);

        if (!envFile.IsFile()) {
            const defTxt: string[] = [
                `##################################################################################`,
                `# project environment config, can be used for 'builder', 'downloader' ...`,
                `##################################################################################`,
                ``,
                `# mcu ram size`,
                `#MCU_RAM_SIZE=0x00`,
                ``,
                `# mcu rom size`,
                `#MCU_ROM_SIZE=0x00`,
                ``
            ];
            envFile.Write(defTxt.join(os.EOL));
        }

        return envFile;
    }

    getProjectEnv(): { [name: string]: any } | undefined {

        const envs = this.getEnvConfig();
        if (envs == undefined) { return; }

        // remove none-string obj
        for (const key in envs) {
            if (typeof envs[key] == 'object' ||
                Array.isArray(envs[key]) ||
                key.includes(' ')) {
                delete envs[key];
            }
        }

        // return env objects
        return envs;
    }

    getEnvConfig(): { [name: string]: any } | undefined {
        const envFile = this.getEnvFile();
        if (envFile.IsFile()) {
            try {
                return ini.parse(envFile.Read());
            } catch (error) {
                GlobalEvent.emit('msg', ExceptionToMessage(error, 'Hidden'));
            }
        }
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

    //---

    protected loadToolchain() {
        const prjConfig = this.GetConfiguration();
        const toolManager = ToolchainManager.getInstance();
        this.toolchain = toolManager.getToolchain(prjConfig.config.type, prjConfig.config.toolchain);
        const opFile = prjConfig.compileConfigModel.getOptionsFile(this.getEideDir().path, prjConfig.config);
        toolManager.updateToolchainConfig(opFile, this.toolchain);
    }

    protected reloadToolchain(oldToolchain?: ToolchainName) {
        this.loadToolchain();
        this.dependenceManager.flushToolchainDep();
        this.packManager.refreshComponents();
        this.onToolchainChanged(oldToolchain || this.getToolchain().name);
        this.emit('dataChanged'); // must send global event to refresh view
    }

    protected reloadUploader(oldUploader?: HexUploaderType) {
        const prjConfig = this.GetConfiguration();
        prjConfig.uploadConfigModel.emit('NotifyUpdate', prjConfig); // notify update upload config
        this.onUploaderChanged(oldUploader || prjConfig.config.uploader);
        this.emit('dataChanged'); // must send global event to refresh view
    }

    protected loadUploader() {
        const prjConfig = this.GetConfiguration();
        prjConfig.uploadConfigModel.emit('NotifyUpdate', prjConfig); // notify update upload config
        this.onUploaderChanged(prjConfig.config.uploader);
    }

    protected LoadSourceRootFolders() {
        this.sourceRoots.load();
        this.virtualSource.load();
    }

    protected UpdateCppConfig() {

        const prjConfig = this.GetConfiguration();
        const builderOpts = prjConfig.compileConfigModel.getOptions(this.getEideDir().path, prjConfig.config);

        const depMerge = this.GetConfiguration().GetAllMergeDep();
        const defMacros: string[] = ['__VSCODE_CPPTOOL']; /* it's for internal force include header */
        depMerge.defineList = ArrayDelRepetition(defMacros.concat(depMerge.defineList, this.getToolchain().getInternalDefines(builderOpts)));
        depMerge.incList = ArrayDelRepetition(depMerge.incList.concat(this.getSourceIncludeList()));

        const cppConfig = this.GetCppConfig();
        const cppConfigItem = cppConfig.getConfig();
        const includeList: string[] = depMerge.incList.map((_path) => {
            const rePath = this.ToRelativePath(_path, false);
            return rePath ? `\${workspaceFolder}${File.sep}${rePath}` : _path;
        });

        // update includes to browse info
        cppConfigItem.browse = {
            limitSymbolsToIncludedHeaders: true,
            databaseFilename: '${default}'
        };

        // update includes and defines 
        cppConfigItem.includePath = ['${default}'].concat(includeList);
        cppConfigItem.defines = ['${default}'].concat(depMerge.defineList);

        // update forceinclude headers
        cppConfigItem.forcedInclude = this.getToolchain().getForceIncludeHeaders()?.map((f_path) => {
            return this.ToRelativePath(f_path) || f_path;
        });

        cppConfig.Save();
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

    protected UpdateDataChangedCount() {

        this.dataChangedCount++;

        if (this.dataChangedCount >= AbstractProject.dataChangedCountLimit) {
            this.dataChangedCount = 0;
            this.GetConfiguration().Save();
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

    protected BeforeLoad(wsFile: File): void {
        // check project version
        const eideFile = File.fromArray([wsFile.dir, AbstractProject.EIDE_DIR, AbstractProject.prjConfigName]);
        const conf = <ProjectConfigData<any>>JSON.parse(eideFile.Read());
        if (conf.version) {
            const cur_v = parseInt(conf.version.replace(/\./g, ''));
            const eide_conf_v = parseInt(EIDE_CONF_VERSION.replace(/\./g, ''));
            if (cur_v > eide_conf_v) { // now < old, error
                throw Error(`The project version is '${conf.version}', but eide is '${EIDE_CONF_VERSION}'. Please update eide to the latest version !`);
            }
            else if (eide_conf_v > cur_v) { // now > old, update it
                conf.version = EIDE_CONF_VERSION;
                eideFile.Write(JSON.stringify(conf));
            }
        }
    }

    protected AfterLoad(): void {

        const prjConfig = this.GetConfiguration();

        // clear duplicate include path
        const dep = prjConfig.CustomDep_getDependence();
        const mergeDep = prjConfig.GetAllMergeDep([ProjectConfiguration.CUSTOM_GROUP_NAME]);
        const buildInList = ArrayDelRepetition(this.getSourceIncludeList().concat(mergeDep.incList));
        dep.incList = dep.incList.filter((incPath) => { return !buildInList.includes(incPath); });

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
            const msg = view_str$prompt$not_found_compiler.replace('{}', toolchain.name);
            ResInstaller.instance().setOrInstallTools(toolchain.name, msg, toolchain.settingName);
            return false;
        }
        return true;
    }

    protected onToolchainChanged(oldToolchain: ToolchainName) {
        /* update hex file path for new config */
        this.updateUploaderHexFile(true);
        /* check toolchain is installed ? */
        this.checkAndNotifyInstallToolchain();
    }

    protected onUploaderChanged(oldToolchain: HexUploaderType) {
        this.updateUploaderHexFile(true); // update hex file path for new config
        this.updateDebugConfig(); // update debug config after uploader changed
    }

    protected abstract onComponentUpdate(updateList: ComponentUpdateItem[]): void;

    protected abstract onPrjConfigChanged(type: ProjectConfigEvent): void;

    protected abstract onSourceRootChanged(e: SourceChangedEvent): void;

    protected abstract onDeviceChanged(oledDevice?: CurrentDevice): void;

    protected abstract onPackageChanged(): void;

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

    //======================= Event handler ===========================

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
                this.UpdateCppConfig();
                this.emit('dataChanged', 'files');
                break;
            case 'srcRootRemoved':
                this.sourceRoots.remove(<string>event.data);
                this.UpdateCppConfig();
                this.emit('dataChanged', 'files');
                break;
            case 'compiler':
                this.emit('dataChanged', 'compiler');
                break;
            case 'uploader':
                this.emit('dataChanged', 'uploader');
                break;
            case 'dependence':
                this.UpdateCppConfig();
                this.emit('dataChanged', 'dependence');
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

    //==================================================================

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

    //==================================================================

    public createBase(option: CreateOptions, createNewPrjFolder: boolean = true): BaseProjectInfo {

        const rootDir: File = createNewPrjFolder ?
            File.fromArray([option.outDir.path, option.name]) : option.outDir;
        rootDir.CreateDir(true);

        const wsFile = File.fromArray([rootDir.path, option.name + AbstractProject.workspaceSuffix]);

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

    protected BeforeLoad(wsFile: File): void {
        super.BeforeLoad(wsFile);
    }

    protected AfterLoad(): void {

        super.AfterLoad();

        /* update workspace settings */
        {
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

            if (settings['C_Cpp.default.intelliSenseMode'] === undefined) {
                settings['C_Cpp.default.intelliSenseMode'] = "gcc-arm";
            }

            if (settings['files.autoGuessEncoding'] === undefined) {
                settings['files.autoGuessEncoding'] = true;
            }

            if (settings['C_Cpp.default.cppStandard'] === undefined) {
                settings['C_Cpp.default.cppStandard'] = "c++14";
            }

            if (settings['C_Cpp.default.cStandard'] === undefined) {
                settings['C_Cpp.default.cStandard'] = "c99";
            }

            if (settings['[yaml]'] === undefined) {
                settings['[yaml]'] = {
                    "editor.insertSpaces": true,
                    "editor.tabSize": 4,
                    "editor.autoIndent": "advanced"
                }
            }

            if (toolchain.name === 'Keil_C51') {
                if (settings['C_Cpp.errorSquiggles'] === undefined) {
                    settings['C_Cpp.errorSquiggles'] = "Disabled";
                }
            }

            /* add extension recommendation */
            {
                let recommendExt: string[] = [
                    "cl.eide",
                    "keroc.hex-fmt",
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
            if ((<ProjectFileGroup>_group).dir !== undefined) {
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
}
