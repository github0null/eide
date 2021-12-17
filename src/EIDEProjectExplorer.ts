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
import * as fs from 'fs';
import * as NodePath from 'path';
import * as child_process from 'child_process';
import * as os from 'os';

import { File } from '../lib/node-utility/File';
import { ResManager } from './ResManager';
import { GlobalEvent } from './GlobalEvents';
import { AbstractProject, CheckError, DataChangeType, VirtualSource } from './EIDEProject';
import { ToolchainName, ToolchainManager } from './ToolchainManager';
import { CreateOptions, PackInfo, ComponentFileItem, DeviceInfo, getComponentKeyDescription, VirtualFolder, VirtualFile, ImportOptions, ProjectTargetInfo, ArmBaseCompileData, ProjectConfigData } from './EIDETypeDefine';
import { WorkspaceManager } from './WorkspaceManager';
import {
    can_not_close_project, project_is_opened, project_load_failed,
    continue_text, cancel_text, project_exist_txt,
    project_record_read_failed, pack_info, compile_config, set_device_hint,
    switch_workspace_hint, add_include_path, add_define, project_dependence,
    view_str$pack$installed_component, not_support_no_arm_project,
    install_this_pack, export_keil_xml_ok, export_keil_xml_failed,
    invalid_project_path,
    uploadConfig_desc, add_lib_path, view_str$pack$components,
    view_str$project$title, view_str$project$excludeFolder, view_str$project$excludeFile,
    view_str$pack$install_component_failed, view_str$pack$remove_component_failed,
    view_str$compile$selectToolchain, view_str$compile$selectFlasher, view_str$project$needRefresh,
    WARNING, view_str$project$cmsis_components, view_str$project$other_settings, view_str$settings$outFolderName,
    view_str$dialog$add_to_source_folder, view_str$project$sel_target, view_str$project$folder_type_fs,
    view_str$project$folder_type_virtual, view_str$project$sel_folder_type,
    view_str$project$add_source,
    view_str$settings$prj_name,
    view_str$operation$import_done,
    view_str$operation$import_failed,
    view_str$operation$create_prj_done,
    view_str$settings$prjEnv,
    view_str$prompt$unresolved_deps,
    view_str$prompt$prj_location,
    view_str$prompt$src_folder_must_be_a_child_of_root,
    view_str$project$folder_type_virtual_desc,
    view_str$project$folder_type_fs_desc
} from './StringTable';
import { CodeBuilder, BuildOptions } from './CodeBuilder';
import { ExceptionToMessage, newMessage } from './Message';
import { SettingManager } from './SettingManager';
import { HexUploaderManager, HexUploaderType } from './HexUploader';
import { Compress, CompressOption } from './Compress';
import { DependenceManager } from './DependenceManager';
import { ArrayDelRepetition } from '../lib/node-utility/Utility';
import {
    copyObject, downloadFileWithProgress, getDownloadUrlFromGit,
    runShellCommand, redirectHost, readGithubRepoFolder, FileCache,
    genGithubHash
} from './utility';
import { append2SysEnv, DeleteDir, kill } from './Platform';
import { KeilARMOption, KeilC51Option, KeilParser, KeilRteDependence } from './KeilXmlParser';
import { VirtualDocument } from './VirtualDocsProvider';
import { ResInstaller } from './ResInstaller';
import { ExeCmd, ExecutableOption, ExeFile } from '../lib/node-utility/Executable';
import { CmdLineHandler } from './CmdLineHandler';
import { WebPanelManager } from './WebPanelManager';
import * as yml from 'yaml';
import { GitFileInfo } from './WebInterface/GithubInterface';
import {
    CppToolsApi, Version, CustomConfigurationProvider, getCppToolsApi,
    SourceFileConfigurationItem, WorkspaceBrowseConfiguration
} from 'vscode-cpptools';

enum TreeItemType {
    SOLUTION,
    PROJECT,

    PACK,
    PACK_GROUP,
    COMPONENT_GROUP,

    DEPENDENCE,
    DEPENDENCE_GROUP,
    DEPENDENCE_SUB_GROUP,
    DEPENDENCE_GROUP_ARRAY_FIELD,
    DEPENDENCE_ITEM,

    COMPILE_CONFIGURATION,
    COMPILE_CONFIGURATION_ITEM,

    UPLOAD_OPTION,
    UPLOAD_OPTION_GROUP,
    UPLOAD_OPTION_ITEM,

    SETTINGS,
    SETTINGS_ITEM,

    //
    // item must end with '_ITEM'
    //

    ITEM,
    GROUP,

    //
    // clickable file item must end with '_FILE_ITEM'
    //

    // file system folder
    FOLDER,
    EXCFOLDER,
    FOLDER_ROOT,
    EXCFILE_ITEM,
    FILE_ITEM,

    // virtual folder
    V_FOLDER,
    V_EXCFOLDER,
    V_FOLDER_ROOT,
    V_EXCFILE_ITEM,
    V_FILE_ITEM,

    // source refs
    SRCREF_FILE_ITEM,

    // output 
    OUTPUT_FOLDER,
    OUTPUT_FILE_ITEM,

    ACTIVED_ITEM,
    ACTIVED_GROUP
}

type GroupRegion = 'PACK' | 'Components' | 'ComponentItem';

interface TreeItemValue {
    key?: string;
    alias?: string;
    value: string | File; // if TreeItem refer to a file, the value type is 'File'
    contextVal?: string;
    tooltip?: string;
    icon?: string;
    obj?: any;
    childKey?: string;
    child?: string[];
    projectIndex: number;
    groupRegion?: GroupRegion;
    collapsibleState?: vscode.TreeItemCollapsibleState;
}

type ModifiableDepType = 'INC_GROUP' | 'INC_ITEM'
    | 'DEFINE_GROUP' | 'DEFINE_ITEM'
    | 'LIB_GROUP' | 'LIB_ITEM'
    | 'SOURCE_GROUP' | 'SOURCE_ITEM'
    | 'None';

class ModifiableDepInfo {

    type: ModifiableDepType;

    constructor(_type: ModifiableDepType, key?: string) {
        this.type = _type;
        if (key) {
            switch (key) {
                case 'incList':
                    this.type = 'INC_GROUP';
                    break;
                case 'defineList':
                    this.type = 'DEFINE_GROUP';
                    break;
                case 'libList':
                    this.type = 'LIB_GROUP';
                    break;
                case 'sourceDirList':
                    this.type = 'SOURCE_GROUP';
                    break;
                default:
                    this.type = 'None';
                    break;
            }
        }
    }

    GetItemDepType(): ModifiableDepInfo {
        switch (this.type) {
            case 'INC_GROUP':
                return new ModifiableDepInfo('INC_ITEM');
            case 'DEFINE_GROUP':
                return new ModifiableDepInfo('DEFINE_ITEM');
            case 'LIB_GROUP':
                return new ModifiableDepInfo('LIB_ITEM');
            case 'SOURCE_GROUP':
                return new ModifiableDepInfo('SOURCE_ITEM');
            default:
                return new ModifiableDepInfo('None');
        }
    }
}

export class ProjTreeItem extends vscode.TreeItem {

    static ITEM_CLICK_EVENT = 'ProjectView.ItemClick';

    type: TreeItemType;
    val: TreeItemValue;

    constructor(type: TreeItemType, val: TreeItemValue) {

        super('', vscode.TreeItemCollapsibleState.None);

        if (val.value instanceof File) {
            this.label = val.value.name;
        } else {
            const lableName: string | undefined = val.alias ? val.alias : val.key;
            this.label = lableName ? (`${lableName} : ${val.value}`) : val.value;
        }

        this.val = val;
        this.type = type;

        this.contextValue = this.GetContext();
        this.tooltip = this.GetTooltip();

        if (ProjTreeItem.isItem(type)) {
            this.command = {
                command: ProjTreeItem.ITEM_CLICK_EVENT,
                title: ProjTreeItem.ITEM_CLICK_EVENT,
                arguments: [this]
            };
        }

        this.collapsibleState = val.collapsibleState || this.GetCollapsibleState(type);

        this.InitIcon();
    }

    public static isItem(type: TreeItemType): boolean {
        return TreeItemType[type].endsWith('ITEM');
    }

    public static isFileItem(type: TreeItemType): boolean {
        return TreeItemType[type].endsWith('FILE_ITEM');
    }

    private GetTooltip(): string {
        if (this.val.value instanceof File) {
            return this.val.value.path;
        }
        else if (this.val.tooltip) {
            return this.val.tooltip;
        }
        else if (ProjTreeItem.isItem(this.type)) {
            return this.val.value;
        }
        return TreeItemType[this.type];
    }

    private GetContext(): string {
        if (this.val.obj instanceof ModifiableDepInfo) {
            return this.val.obj.type;
        }
        if (this.val.contextVal) {
            return this.val.contextVal;
        }
        return TreeItemType[this.type];
    }

    private GetCollapsibleState(type: TreeItemType): vscode.TreeItemCollapsibleState {
        if (ProjTreeItem.isItem(type)) {
            return vscode.TreeItemCollapsibleState.None;
        }
        return vscode.TreeItemCollapsibleState.Collapsed;
    }

    private InitIcon() {

        const iconName = this.val.icon ? this.val.icon : this.GetIconName();
        if (iconName !== undefined) {

            if (iconName instanceof vscode.ThemeIcon) {
                this.iconPath = iconName;
                return;
            }

            const iconFile = ResManager.GetInstance().GetIconByName(iconName);
            if (iconFile !== undefined) {
                this.iconPath = {
                    light: iconFile.path,
                    dark: iconFile.path
                };
            } else {
                GlobalEvent.emit('msg', newMessage('Warning', 'Load Icon \'' + iconName + '\' Failed!'));
            }
        }
    }

    private getSourceFileIconName(fileName_: string, suffix_: string): string | vscode.ThemeIcon | undefined {

        let name: string | vscode.ThemeIcon | undefined;

        const fileName = fileName_.toLowerCase();
        const suffix = suffix_.toLowerCase();

        switch (suffix) {
            case '.c':
                name = 'file_type_c.svg';
                break;
            case '.h':
                name = 'file_type_cheader.svg';
                break;
            case '.cpp':
            case '.cc':
            case '.cxx':
            case '.c++':
                name = 'file_type_cpp.svg';
                break;
            case '.hpp':
            case '.hxx':
            case '.inc':
                name = 'file_type_cppheader.svg';
                break;
            case '.s':
            case '.asm':
            case '.a51':
                name = 'AssemblerSourceFile_16x.svg';
                break;
            case '.lib':
            case '.a':
                name = 'Library_16x.svg';
                break;
            case '.o':
            case '.obj':
            case '.axf':
            case '.elf':
            case '.bin':
            case '.out':
                name = 'file_type_binary.svg';
                break;
            case '.map':
                name = 'file_type_map.svg';
                break;
            // other suffix
            default:
                if (fileName.endsWith('.map.view')) {
                    name = 'Report_16x.svg';
                } else {
                    name = vscode.ThemeIcon.File; //'document-light.svg';
                }
                break;
        }

        return name;
    }

    private GetIconName(): string | vscode.ThemeIcon | undefined {
        let name: string | vscode.ThemeIcon | undefined;

        switch (this.type) {
            /* case TreeItemType.SRCREF_FILE_ITEM:
                name = 'Reference_16x.svg';
                break; */
            case TreeItemType.EXCFILE_ITEM:
            case TreeItemType.V_EXCFILE_ITEM:
                name = 'FileExclude_16x.svg';
                break;
            case TreeItemType.EXCFOLDER:
            case TreeItemType.V_EXCFOLDER:
                name = 'FolderExclude_32x.svg';
                break;
            case TreeItemType.FOLDER:
                name = 'Folder_32x.svg';
                break;
            case TreeItemType.FOLDER_ROOT:
                name = 'FolderRoot_32x.svg';
                break;
            case TreeItemType.V_FOLDER:
            case TreeItemType.V_FOLDER_ROOT:
                name = 'folder_virtual.svg';
                break;
            case TreeItemType.COMPONENT_GROUP:
                name = 'Component_16x.svg';
                break;
            case TreeItemType.PACK_GROUP:
                name = 'PackageItem_16x.svg';
                break;
            case TreeItemType.DEPENDENCE_SUB_GROUP:
            case TreeItemType.GROUP:
                name = 'CheckboxGroup_16x.svg';
                break;
            case TreeItemType.SOLUTION:
                name = 'ApplicationClass_16x.svg';
                break;
            case TreeItemType.PROJECT:
                name = 'Class_16x.svg';
                break;
            case TreeItemType.COMPILE_CONFIGURATION:
                name = 'Builder_16x.svg';
                break;
            case TreeItemType.PACK:
                name = 'Package_16x.svg';
                break;
            case TreeItemType.UPLOAD_OPTION:
                name = 'TransferDownload_16x.svg';
                break;
            case TreeItemType.DEPENDENCE_GROUP:
                name = 'DependencyGraph_16x.svg';
                break;
            case TreeItemType.DEPENDENCE:
                name = 'Property_16x.svg';
                break;
            case TreeItemType.SETTINGS:
                name = 'Settings_16x.svg';
                break;
            case TreeItemType.SETTINGS_ITEM:
                name = 'Property_16x.svg';
                break;
            case TreeItemType.DEPENDENCE_GROUP_ARRAY_FIELD:
                name = 'KPI_16x.svg';
                break;
            case TreeItemType.ACTIVED_GROUP:
                name = 'TestCoveredPassing_16x.svg';//'RecursivelyCheckAll_16x.svg';
                break;
            case TreeItemType.OUTPUT_FOLDER:
                name = 'folder_type_binary.svg';
                break;
            default:
                {
                    // if it's a source file, get icon
                    if (ProjTreeItem.isFileItem(this.type) && this.val.value instanceof File) {
                        const file: File = this.val.value;
                        // if file is existed, get icon by suffix
                        if (file.IsFile()) {
                            name = this.getSourceFileIconName(file.name, file.suffix);
                        }
                        // if file not existed, show warning icon
                        else {
                            name = 'StatusWarning_16x.svg';
                        }
                    }
                }
                break;
        }

        return name;
    }
}

interface ItemCache {
    root: ProjTreeItem;
    [name: string]: ProjTreeItem;
}

interface ItemClickInfo {
    name: string;
    time: number;
}

interface VirtualFolderInfo {
    path: string;
    vFolder: VirtualFolder;
}

interface VirtualFileInfo {
    path: string;       // virtual path
    vFile: VirtualFile; // virtual file info
}

class ProjectItemCache {

    // <projectPath, {root: TreeItem, itemList: TreeItem[]}>
    private itemCache: Map<string, ItemCache> = new Map();

    getTreeItem(prj: AbstractProject, itemType: TreeItemType): ProjTreeItem | undefined {
        const cache = this.itemCache.get(prj.getWsPath());
        if (cache) {
            return cache[TreeItemType[itemType]];
        }
    }

    setTreeItem(prj: AbstractProject, item: ProjTreeItem, isRoot?: boolean) {
        const cache = this.itemCache.get(prj.getWsPath());
        if (cache) {
            if (isRoot) {
                cache.root = item;
            } else {
                cache[TreeItemType[item.type]] = item;
            }
        } else if (isRoot) { // if not found and type is root, set it
            this.itemCache.set(prj.getWsPath(), { root: item });
        }
    }

    delTreeItem(prj: AbstractProject, itemType?: TreeItemType): ProjTreeItem | undefined {
        const cache = this.itemCache.get(prj.getWsPath());
        if (cache) {
            if (itemType) {
                const key = TreeItemType[itemType];
                const deleted = cache[key];
                cache[key] = <any>undefined; // del item
                return deleted;
            } else { // del all
                this.itemCache.delete(prj.getWsPath());
            }
        }
    }
}

class ProjectDataProvider implements vscode.TreeDataProvider<ProjTreeItem> {

    private static readonly recName = 'sln.record';
    private static readonly RecMaxNum = 50;

    private prjList: AbstractProject[] = [];
    private slnRecord: string[] = [];
    private recFile: File;
    private context: vscode.ExtensionContext;
    private activePrjPath: string | undefined;

    // project tree item refresh cache
    treeCache: ProjectItemCache = new ProjectItemCache();

    onDidChangeTreeData?: vscode.Event<ProjTreeItem | null | undefined> | undefined;
    dataChangedEvent: vscode.EventEmitter<ProjTreeItem | undefined>;

    constructor(_context: vscode.ExtensionContext) {
        this.context = _context;

        this.dataChangedEvent = new vscode.EventEmitter<ProjTreeItem>();
        this.context.subscriptions.push(this.dataChangedEvent);
        this.onDidChangeTreeData = this.dataChangedEvent.event;

        this.recFile = File.fromArray([ResManager.GetInstance().GetAppDataDir().path, ProjectDataProvider.recName]);
        this.loadRecord();

        GlobalEvent.on('extension_close', () => {
            this.saveRecord();
            this.SaveAll();
            this.CloseAll();
        });

        this.LoadWorkspaceProject();
    }

    onProjectChanged(prj: AbstractProject, type?: DataChangeType) {
        switch (type) {
            case 'files':
                this.UpdateView(this.treeCache.getTreeItem(prj, TreeItemType.PROJECT));
                break;
            case 'compiler':
                this.UpdateView(this.treeCache.getTreeItem(prj, TreeItemType.COMPILE_CONFIGURATION));
                break;
            case 'uploader':
                this.UpdateView(this.treeCache.getTreeItem(prj, TreeItemType.UPLOAD_OPTION));
                break;
            case 'pack':
                this.UpdateView(this.treeCache.getTreeItem(prj, TreeItemType.PACK));
                break;
            case 'dependence':
                this.UpdateView(this.treeCache.getTreeItem(prj, TreeItemType.PACK));
                this.UpdateView(this.treeCache.getTreeItem(prj, TreeItemType.DEPENDENCE));
                break;
            default:
                this.UpdateView();
                break;
        }
    }

    //----------------

    private toLowercaseEIDEFolder(wsFolder: File) {

        if (wsFolder.IsDir()) {

            // rename eide folder name
            const folderList = wsFolder.GetList(File.EMPTY_FILTER, [/^\.EIDE$/]);
            if (folderList.length > 0) {
                const oldEideFolder = folderList[0];
                fs.renameSync(oldEideFolder.path, `${oldEideFolder.dir}${File.sep}${AbstractProject.EIDE_DIR}`);
            }

            // rename eide conf file
            const eideFolder = File.fromArray([wsFolder.path, AbstractProject.EIDE_DIR]);
            if (eideFolder.IsDir()) {
                const fList = eideFolder.GetList([/^EIDE\.json$/], File.EMPTY_FILTER);
                if (fList.length > 0) {
                    const oldEideConfFile = fList[0];
                    fs.renameSync(oldEideConfFile.path, `${oldEideConfFile.dir}${File.sep}${AbstractProject.prjConfigName}`);
                }
            }
        }
    }

    LoadWorkspaceProject() {

        const workspaceManager = WorkspaceManager.getInstance();

        // not a workspace, exit
        if (workspaceManager.getWorkspaceRoot() === undefined) { return; }

        const wsFolders = workspaceManager.getWorkspaceList();
        const validList: File[] = [];

        for (const wsDir of wsFolders) {
            const wsList = wsDir.GetList([/.code-workspace$/i], File.EMPTY_FILTER);
            if (wsList.length > 0) {

                // convert .EIDE to .eide
                this.toLowercaseEIDEFolder(wsDir);

                const eideConfigFile = File.fromArray([wsDir.path, AbstractProject.EIDE_DIR, AbstractProject.prjConfigName]);
                if (eideConfigFile.IsFile()) {
                    validList.push(wsList[0]);
                }
            }
        }

        GlobalEvent.once('response_init_component', () => {

            /* init active project */
            if (validList.length > 0) {
                this.activePrjPath = validList[0].path;
            }

            /* if prj count > 1, this is a workspace project
             * active workspace control btns
             */
            if (validList.length > 1) {
                vscode.commands.executeCommand('setContext', 'cl.eide.isWorkspaceProject', true);
            }

            for (const wsFile of validList) {
                this._OpenProject(wsFile.path);
            }
        });

        if (validList.length > 0) {
            GlobalEvent.emit('request_init_component');
        }
    }

    GetProjectByIndex(index: number): AbstractProject {
        return this.prjList[index];
    }

    getProjectCount(): number {
        return this.prjList.length;
    }

    /**
     * traverse all projects by async mode
     * @note if callbk_func's return code == true, loop will be break
     */
    async traverseProjectsAsync(fn: (prj: AbstractProject, index: number) => Promise<boolean | undefined>) {
        for (let index = 0; index < this.prjList.length; index++) {
            const res = await fn(this.prjList[index], index);
            if (res) { break; }
        }
    }

    /**
     * traverse all projects by block mode
     * @note if callbk_func's return code == true, loop will be break
     */
    traverseProjects(fn: (prj: AbstractProject, index: number) => boolean | undefined) {
        for (let index = 0; index < this.prjList.length; index++) {
            const res = fn(this.prjList[index], index);
            if (res) { break; }
        }
    }

    foreachProject(callbk: (val: AbstractProject, index: number) => void): void {
        this.prjList.forEach(callbk);
    }

    UpdateView(ele?: ProjTreeItem) {
        this.dataChangedEvent.fire(ele);
    }

    isRootWorkspaceProject(prj: AbstractProject): boolean {
        const rootDir = prj.GetRootDir();
        const wsDir = WorkspaceManager.getInstance().getWorkspaceRoot();
        if (rootDir && wsDir) {
            return rootDir.path === wsDir.path;
        }
        return false;
    }

    getActiveProject(): AbstractProject | undefined {

        if (this.prjList.length == 1) {
            return this.prjList[0];
        }

        const index = this.prjList.findIndex((prj) => {
            return prj.getWsPath() == this.activePrjPath;
        });
        if (index != -1) {
            return this.prjList[index];
        }
    }

    getTreeItem(element: ProjTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: ProjTreeItem | undefined): vscode.ProviderResult<ProjTreeItem[]> {

        let iList: ProjTreeItem[] = [];

        if (element === undefined) {

            this.prjList.forEach((sln, index) => {

                const isActive = this.activePrjPath === sln.getWsPath();
                const cItem = new ProjTreeItem(TreeItemType.SOLUTION, {
                    value: sln.GetConfiguration().config.name + ' : ' + sln.GetConfiguration().config.mode,
                    tooltip: sln.GetRootDir().path,
                    projectIndex: index,
                    icon: this.prjList.length > 1 ? (isActive ? 'active.svg' : 'idle.svg') : undefined
                });
                iList.push(cItem);

                // cache project root item
                this.treeCache.setTreeItem(sln, cItem, true);
            });
        } else {

            const project = this.prjList[element.val.projectIndex];
            const prjType = project.GetConfiguration().config.type;

            switch (element.type) {
                case TreeItemType.SOLUTION:
                    {
                        iList.push(new ProjTreeItem(TreeItemType.PROJECT, {
                            value: view_str$project$title,
                            projectIndex: element.val.projectIndex,
                            tooltip: view_str$project$title,
                            obj: <VirtualFolderInfo>{ path: VirtualSource.rootName, vFolder: project.getVirtualSourceRoot() }
                        }));

                        if (prjType === 'ARM') { // only display for ARM project 
                            iList.push(new ProjTreeItem(TreeItemType.PACK, {
                                value: pack_info,
                                projectIndex: element.val.projectIndex,
                                tooltip: pack_info
                            }));
                        }

                        iList.push(new ProjTreeItem(TreeItemType.COMPILE_CONFIGURATION, {
                            value: `${compile_config} : ${project.getToolchain().name}`,
                            projectIndex: element.val.projectIndex,
                            tooltip: `${compile_config} : ${ToolchainManager.getInstance().getToolchainDesc(project.getToolchain().name)}`
                        }));

                        const curUploader = project.GetConfiguration().uploadConfigModel.uploader;
                        const uploaderLabel = HexUploaderManager.getInstance().getUploaderLabelByName(curUploader);
                        iList.push(new ProjTreeItem(TreeItemType.UPLOAD_OPTION, {
                            value: `${uploadConfig_desc} : ${uploaderLabel}`,
                            projectIndex: element.val.projectIndex,
                            tooltip: `${uploadConfig_desc} : ${uploaderLabel}`
                        }));

                        iList.push(new ProjTreeItem(TreeItemType.DEPENDENCE, {
                            value: project_dependence,
                            projectIndex: element.val.projectIndex,
                            tooltip: project_dependence
                        }));

                        iList.push(new ProjTreeItem(TreeItemType.SETTINGS, {
                            value: view_str$project$other_settings,
                            projectIndex: element.val.projectIndex,
                            tooltip: view_str$project$other_settings
                        }));

                        // cache sub root view
                        iList.forEach((item) => {
                            this.treeCache.setTreeItem(project, item);
                        });
                    }
                    break;
                case TreeItemType.PROJECT:
                    {
                        // push filesystem source folder
                        project.getSourceRootFolders()
                            .sort((info_1, info_2) => {
                                const isComponent = info_1.displayName === DependenceManager.DEPENDENCE_DIR;
                                return isComponent ? -1 : info_1.displayName.localeCompare(info_2.displayName);
                            })
                            .forEach((rootInfo) => {
                                const isComponent = rootInfo.displayName === DependenceManager.DEPENDENCE_DIR;
                                const folderDispName = isComponent ? view_str$project$cmsis_components : rootInfo.displayName;
                                iList.push(new ProjTreeItem(TreeItemType.FOLDER_ROOT, {
                                    value: folderDispName,
                                    obj: rootInfo.fileWatcher.file,
                                    projectIndex: element.val.projectIndex,
                                    contextVal: isComponent ? 'FOLDER_ROOT_DEPS' : undefined,
                                    tooltip: rootInfo.needUpdate ? view_str$project$needRefresh : folderDispName,
                                    icon: rootInfo.needUpdate ?
                                        'StatusWarning_16x.svg' : (isComponent ? 'DependencyGraph_16x.svg' : undefined)
                                }));
                            });

                        // push virtual source folder
                        project.getVirtualSourceRoot().folders
                            .sort((folder1, folder2) => { return folder1.name.localeCompare(folder2.name); })
                            .forEach((vFolder) => {
                                const vFolderPath = `${VirtualSource.rootName}/${vFolder.name}`;
                                const itemType = project.isExcluded(vFolderPath) ? TreeItemType.V_EXCFOLDER : TreeItemType.V_FOLDER_ROOT;
                                iList.push(new ProjTreeItem(itemType, {
                                    value: vFolder.name,
                                    obj: <VirtualFolderInfo>{ path: vFolderPath, vFolder: vFolder },
                                    projectIndex: element.val.projectIndex,
                                    tooltip: `${vFolder.name} (${vFolder.files.length} files, ${vFolder.folders.length} folders)`
                                }));
                            });

                        // put virtual source files
                        project.getVirtualSourceRoot().files
                            .sort((a, b) => a.path.localeCompare(b.path))
                            .forEach((vFile) => {
                                const file = new File(project.ToAbsolutePath(vFile.path));
                                const vFilePath = `${VirtualSource.rootName}/${file.name}`;
                                const isFileExcluded = project.isExcluded(vFilePath);
                                const itemType = isFileExcluded ? TreeItemType.V_EXCFILE_ITEM : TreeItemType.V_FILE_ITEM;
                                iList.push(new ProjTreeItem(itemType, {
                                    value: file,
                                    collapsibleState: project.getSourceRefs(file).length > 0 ?
                                        vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                                    obj: <VirtualFileInfo>{ path: vFilePath, vFile: vFile },
                                    projectIndex: element.val.projectIndex,
                                    tooltip: isFileExcluded ? view_str$project$excludeFile : file.path,
                                }));
                            });

                        // show output files
                        if (SettingManager.GetInstance().isShowOutputFilesInExplorer()) {
                            const label = `Output Files`;
                            const tItem = new ProjTreeItem(TreeItemType.OUTPUT_FOLDER, {
                                value: label,
                                collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
                                projectIndex: element.val.projectIndex,
                                tooltip: label,
                            });
                            iList.push(tItem);
                            this.treeCache.setTreeItem(project, tItem);
                        } else {
                            this.treeCache.delTreeItem(project, TreeItemType.OUTPUT_FOLDER);
                        }
                    }
                    break;
                case TreeItemType.PACK:
                    {
                        const packInfo = project.GetPackManager().GetPack();
                        if (packInfo) {
                            iList.push(new ProjTreeItem(TreeItemType.PACK_GROUP, {
                                value: packInfo.name,
                                projectIndex: element.val.projectIndex,
                                groupRegion: 'PACK'
                            }));
                        }
                    }
                    break;
                case TreeItemType.COMPILE_CONFIGURATION:
                    {
                        const cConfig = project.GetConfiguration().compileConfigModel;
                        const keyMap = <any>cConfig.GetDefault();
                        const excludeKeys = project.getToolchain().excludeViewList || [];

                        for (const key in keyMap) {
                            if (cConfig.isKeyEnable(key) && !excludeKeys.includes(key)) {
                                iList.push(new ProjTreeItem(TreeItemType.COMPILE_CONFIGURATION_ITEM, {
                                    key: key,
                                    alias: cConfig.GetKeyDescription(key),
                                    value: cConfig.getKeyValue(key),
                                    tooltip: cConfig.GetKeyDescription(key),
                                    icon: cConfig.getKeyIcon(key),
                                    projectIndex: element.val.projectIndex
                                }));
                            }
                        }
                    }
                    break;
                case TreeItemType.UPLOAD_OPTION:
                    {
                        const model = project.GetConfiguration().uploadConfigModel;
                        const config = model.GetDefault();

                        if (config) {
                            for (const key in config) {
                                if (model.isKeyEnable(key)) {
                                    iList.push(new ProjTreeItem(TreeItemType.UPLOAD_OPTION_ITEM, {
                                        key: key,
                                        alias: model.GetKeyDescription(key),
                                        value: model.getKeyValue(key),
                                        tooltip: model.GetKeyDescription(key),
                                        icon: model.getKeyIcon(key),
                                        projectIndex: element.val.projectIndex
                                    }));
                                }
                            }
                        }
                    }
                    break;
                case TreeItemType.DEPENDENCE:
                    {
                        const config = project.GetConfiguration();
                        const customDep = config.CustomDep_getDependence();
                        const keyList = config.CustomDep_GetEnabledKeys();

                        for (const key of keyList) {
                            const depValues: string[] = (<any>customDep)[key];
                            if (Array.isArray(depValues)) {
                                iList.push(new ProjTreeItem(TreeItemType.DEPENDENCE_GROUP_ARRAY_FIELD, {
                                    value: config.GetDepKeyDesc(key),
                                    tooltip: config.GetDepKeyDesc(key),
                                    obj: new ModifiableDepInfo('None', key),
                                    childKey: key,
                                    child: depValues
                                        .map((val) => { return project.ToRelativePath(val) || val; })
                                        .sort((val_1, val_2) => { return val_1.length - val_2.length; }),
                                    projectIndex: element.val.projectIndex
                                }));
                            }
                        }
                    }
                    break;
                case TreeItemType.SETTINGS:
                    {
                        const config = project.GetConfiguration();

                        // setting: project name
                        iList.push(new ProjTreeItem(TreeItemType.SETTINGS_ITEM, {
                            key: 'name',
                            value: config.config.name,
                            alias: view_str$settings$prj_name,
                            tooltip: view_str$settings$prj_name,
                            projectIndex: element.val.projectIndex
                        }));

                        // setting: out folder
                        iList.push(new ProjTreeItem(TreeItemType.SETTINGS_ITEM, {
                            key: 'outDir',
                            value: NodePath.normalize(config.config.outDir),
                            alias: view_str$settings$outFolderName,
                            tooltip: view_str$settings$outFolderName,
                            projectIndex: element.val.projectIndex
                        }));

                        // setting: project env
                        iList.push(new ProjTreeItem(TreeItemType.SETTINGS_ITEM, {
                            key: 'project.env',
                            value: 'object {...}',
                            alias: view_str$settings$prjEnv,
                            tooltip: view_str$settings$prjEnv,
                            projectIndex: element.val.projectIndex
                        }));
                    }
                    break;
                case TreeItemType.DEPENDENCE_GROUP:
                case TreeItemType.DEPENDENCE_SUB_GROUP:
                    // deprecated
                    break;
                case TreeItemType.DEPENDENCE_GROUP_ARRAY_FIELD:
                    {
                        const arr = <string[]>element.val.child;
                        let depInfo: ModifiableDepInfo | undefined;

                        if (element.val.obj instanceof ModifiableDepInfo) {
                            depInfo = element.val.obj.GetItemDepType();
                        }

                        for (const val of arr) {
                            iList.push(new ProjTreeItem(TreeItemType.DEPENDENCE_ITEM, {
                                value: val,
                                obj: depInfo,
                                projectIndex: element.val.projectIndex
                            }));
                        }
                    }
                    break;
                // filesystem folder
                case TreeItemType.FOLDER:
                case TreeItemType.FOLDER_ROOT:
                    if (element.val.obj && element.val.obj instanceof File) {
                        const dir: File = element.val.obj;
                        if (dir.IsDir()) {

                            const fchildren = dir
                                .GetList(AbstractProject.getFileFilters())
                                .filter((f) => !AbstractProject.excludeDirFilter.test(f.name));

                            const iFileList: ProjTreeItem[] = [];
                            const iFolderList: ProjTreeItem[] = [];

                            fchildren.forEach((f) => {

                                const isExcluded = project.isExcluded(f.path);

                                if (f.IsDir()) { // is folder
                                    const type = isExcluded ? TreeItemType.EXCFOLDER : TreeItemType.FOLDER;
                                    iFolderList.push(new ProjTreeItem(type, {
                                        value: f.name,
                                        obj: f,
                                        tooltip: isExcluded ? view_str$project$excludeFolder : f.name,
                                        projectIndex: element.val.projectIndex
                                    }));
                                } else { // is file
                                    const type = isExcluded ? TreeItemType.EXCFILE_ITEM : TreeItemType.FILE_ITEM;
                                    iFileList.push(new ProjTreeItem(type, {
                                        value: f,
                                        collapsibleState: project.getSourceRefs(f).length > 0 ?
                                            vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                                        projectIndex: element.val.projectIndex,
                                        tooltip: isExcluded ? view_str$project$excludeFile : f.path,
                                    }));
                                }
                            });

                            // merge folders and files
                            iList = iFolderList.concat(iFileList);
                        }
                    }
                    break;
                // virtual folder
                case TreeItemType.V_FOLDER:
                case TreeItemType.V_FOLDER_ROOT:
                    {
                        const curFolder = <VirtualFolderInfo>element.val.obj;

                        // put child folders
                        curFolder.vFolder.folders
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .forEach((vFolder) => {
                                const vFolderPath = `${curFolder.path}/${vFolder.name}`;
                                const isFolderExcluded = project.isExcluded(vFolderPath);
                                const itemType = isFolderExcluded ? TreeItemType.V_EXCFOLDER : TreeItemType.V_FOLDER;
                                iList.push(new ProjTreeItem(itemType, {
                                    value: vFolder.name,
                                    obj: <VirtualFolderInfo>{ path: vFolderPath, vFolder: vFolder },
                                    projectIndex: element.val.projectIndex,
                                    tooltip: isFolderExcluded
                                        ? view_str$project$excludeFolder
                                        : `${vFolder.name} (${vFolder.files.length} files, ${vFolder.folders.length} folders)`,
                                }));
                            });

                        // put child files
                        curFolder.vFolder.files
                            .sort((a, b) => a.path.localeCompare(b.path))
                            .forEach((vFile) => {
                                const file = new File(project.ToAbsolutePath(vFile.path));
                                const vFilePath = `${curFolder.path}/${file.name}`;
                                const isFileExcluded = project.isExcluded(vFilePath);
                                const itemType = isFileExcluded ? TreeItemType.V_EXCFILE_ITEM : TreeItemType.V_FILE_ITEM;
                                iList.push(new ProjTreeItem(itemType, {
                                    value: file,
                                    collapsibleState: project.getSourceRefs(file).length > 0 ?
                                        vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                                    obj: <VirtualFileInfo>{ path: vFilePath, vFile: vFile },
                                    projectIndex: element.val.projectIndex,
                                    tooltip: isFileExcluded ? view_str$project$excludeFile : file.path,
                                }));
                            });
                    }
                    break;
                case TreeItemType.EXCFOLDER:
                case TreeItemType.EXCFILE_ITEM:
                case TreeItemType.V_EXCFOLDER:
                case TreeItemType.V_EXCFILE_ITEM:
                    // ignore
                    break;
                // show refs
                case TreeItemType.FILE_ITEM:
                case TreeItemType.V_FILE_ITEM:
                    {
                        const srcFile: File = <File>element.val.value;
                        const refs = project.getSourceRefs(srcFile);

                        for (const refFile of refs) {
                            iList.push(new ProjTreeItem(TreeItemType.SRCREF_FILE_ITEM, {
                                value: refFile,
                                projectIndex: element.val.projectIndex,
                                tooltip: refFile.path,
                            }));
                        }
                    }
                    break;
                // output folder
                case TreeItemType.OUTPUT_FOLDER:
                    {
                        const outFolder = project.getOutputFolder();
                        if (outFolder.IsDir()) {
                            const fList = outFolder.GetList([AbstractProject.buildOutputMatcher], File.EMPTY_FILTER);
                            fList.forEach((file) => {
                                iList.push(new ProjTreeItem(TreeItemType.OUTPUT_FILE_ITEM, {
                                    value: file,
                                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                                    projectIndex: element.val.projectIndex,
                                    tooltip: file.path,
                                }));
                            });
                        }
                    }
                    break;
                // output file item
                case TreeItemType.OUTPUT_FILE_ITEM:
                    break;
                case TreeItemType.COMPONENT_GROUP:
                case TreeItemType.ACTIVED_GROUP:
                case TreeItemType.PACK_GROUP:
                case TreeItemType.GROUP:
                    switch (element.val.groupRegion) {
                        case 'PACK':
                            {
                                const deviceInfo = project.GetPackManager().GetCurrentDevice();
                                if (deviceInfo) {

                                    iList.push(new ProjTreeItem(TreeItemType.ITEM, {
                                        key: 'PackageName',
                                        value: deviceInfo.packInfo.name,
                                        projectIndex: element.val.projectIndex
                                    }));
                                    iList.push(new ProjTreeItem(TreeItemType.ITEM, {
                                        key: 'Vendor',
                                        value: deviceInfo.packInfo.vendor,
                                        projectIndex: element.val.projectIndex
                                    }));

                                    const device = <DeviceInfo>project.GetPackManager().getCurrentDevInfo();

                                    iList.push(new ProjTreeItem(TreeItemType.ITEM, {
                                        key: 'Core',
                                        value: device.core || 'null',
                                        projectIndex: element.val.projectIndex
                                    }));

                                    iList.push(new ProjTreeItem(TreeItemType.ITEM, {
                                        key: 'DeviceName',
                                        value: device.name,
                                        projectIndex: element.val.projectIndex
                                    }));

                                    iList.push(new ProjTreeItem(TreeItemType.ITEM, {
                                        key: 'Endian',
                                        value: device.endian || 'null',
                                        projectIndex: element.val.projectIndex
                                    }));

                                    iList.push(new ProjTreeItem(TreeItemType.ITEM, {
                                        key: 'SvdPath',
                                        value: device.svdPath ? (project.ToRelativePath(device.svdPath) || device.svdPath) : 'null',
                                        projectIndex: element.val.projectIndex
                                    }));

                                    iList.push(new ProjTreeItem(TreeItemType.GROUP, {
                                        value: view_str$pack$components,
                                        groupRegion: 'Components',
                                        projectIndex: element.val.projectIndex,
                                        tooltip: view_str$pack$components,
                                    }));
                                }
                            }
                            break;
                        case 'Components':
                            {
                                const packInfo = project.GetPackManager().GetPack();
                                const prjConfig = project.GetConfiguration();
                                if (packInfo) {
                                    packInfo.components.forEach((component, index) => {
                                        if (component.enable) {

                                            const type = prjConfig.IsExisted((<PackInfo>packInfo).name, component.groupName) ?
                                                TreeItemType.ACTIVED_GROUP : TreeItemType.COMPONENT_GROUP;
                                            const description = type === TreeItemType.ACTIVED_GROUP ?
                                                (`${component.description} (${view_str$pack$installed_component})`) : component.description;

                                            iList.push(new ProjTreeItem(type, {
                                                obj: index,
                                                value: component.groupName,
                                                groupRegion: 'ComponentItem',
                                                tooltip: description,
                                                projectIndex: element.val.projectIndex
                                            }));
                                        }
                                    });
                                }
                            }
                            break;
                        case 'ComponentItem':
                            {
                                const packInfo = project.GetPackManager().GetPack();
                                if (packInfo) {

                                    const component: any = packInfo.components[element.val.obj];
                                    for (const key in component) {

                                        if (Array.isArray(component[key])) {
                                            const list: string[] = (<ComponentFileItem[]>component[key]).map<string>((item) => {
                                                return project.ToRelativePath(item.path) || item.path;
                                            });

                                            iList.push(new ProjTreeItem(TreeItemType.GROUP, {
                                                value: getComponentKeyDescription(key),
                                                child: list,
                                                projectIndex: element.val.projectIndex
                                            }));
                                        }
                                    }
                                }
                            }
                            break;
                        default:
                            {
                                if (element.val.child) {
                                    element.val.child.forEach((v) => {
                                        iList.push(new ProjTreeItem(TreeItemType.ITEM, {
                                            value: v,
                                            projectIndex: element.val.projectIndex
                                        }));
                                    });
                                }
                            }
                            break;
                    }
                    break;
                case TreeItemType.ITEM:
                    //Do nothing
                    break;
                default:
                    break;
            }
        }
        return iList;
    }

    private _OpenProject(workspaceFilePath: string): AbstractProject | undefined {

        const wsFile: File = new File(workspaceFilePath);
        if (!wsFile.IsFile()) {
            GlobalEvent.emit('msg', {
                type: 'Warning',
                contentType: 'string',
                content: invalid_project_path + wsFile.path
            });
            return undefined;
        }

        const eideConfigFile = File.fromArray([wsFile.dir, AbstractProject.EIDE_DIR, AbstractProject.prjConfigName]);
        if (!eideConfigFile.IsFile()) {
            GlobalEvent.emit('msg', {
                type: 'Warning',
                contentType: 'string',
                content: 'Not found eide project file, [path]: ' + eideConfigFile.path
            });
            return undefined;
        }

        const prjIndex = this.prjList.findIndex((prj) => { return prj.getWsPath() === workspaceFilePath; });
        if (prjIndex === -1) {
            try {
                const prj = AbstractProject.NewProject();
                prj.Load(wsFile);
                this.AddProject(prj);
                GlobalEvent.emit('project.opened', prj);
                return prj;
            } catch (err) {

                if (err instanceof CheckError) {
                    GlobalEvent.emit('msg', {
                        type: 'Warning',
                        contentType: 'string',
                        content: err.message
                    });
                } else {
                    GlobalEvent.emit('error', err);
                }

                GlobalEvent.emit('msg', {
                    type: 'Warning',
                    contentType: 'string',
                    content: project_load_failed
                });
                return undefined;
            }
        }

        GlobalEvent.emit('msg', {
            type: 'Warning',
            contentType: 'string',
            content: project_is_opened
        });

        return undefined;
    }

    setActiveProject(index: number) {
        const prj = this.prjList[index];
        const wsPath = prj.getWsPath();
        if (this.activePrjPath !== wsPath) {
            this.activePrjPath = wsPath;
            this.UpdateView();
        }
    }

    async OpenProject(workspaceFilePath: string): Promise<AbstractProject | undefined> {

        // convert .EIDE to .eide
        this.toLowercaseEIDEFolder(new File(NodePath.dirname(workspaceFilePath)));

        const prj = this._OpenProject(workspaceFilePath);

        if (prj) {
            this.SwitchProject(prj);
            return prj;
        }

        return undefined;
    }

    async CreateProject(option: CreateOptions): Promise<AbstractProject | undefined> {

        // check folder
        const dList = option.outDir.GetList(File.EMPTY_FILTER);
        if (dList.findIndex((_folder) => { return _folder.name === option.name; }) !== -1) {
            const item = await vscode.window.showWarningMessage(`${WARNING}: ${project_exist_txt}`, 'Yes', 'No');
            if (item === undefined || item === 'No') {
                return undefined;
            }
        }

        try {
            const prj = AbstractProject.NewProject();
            prj.Create(option);
            this.AddProject(prj);
            this.SwitchProject(prj);
            return prj;
        } catch (err) {
            GlobalEvent.emit('error', err);
            GlobalEvent.emit('msg', newMessage('Warning', project_load_failed));
            return undefined;
        }
    }

    private importCmsisHeaders(rootDir: File): File[] {

        const folders: File[] = [];

        const packList = ResManager.GetInstance().getCMSISHeaderPacks();
        if (packList.length === 0) {
            return folders;
        }

        for (const packZipFile of packList) {
            const outDir = File.fromArray([rootDir.path, '.cmsis', packZipFile.noSuffixName]);
            if (outDir.IsDir()) { continue; } /* folder existed, exit */
            outDir.CreateDir(true);

            const compresser = new Compress(ResManager.GetInstance().Get7zDir());
            compresser.UnzipSync(packZipFile, outDir);
            folders.push(outDir);
        }

        return folders;
    }

    async ImportProject(option: ImportOptions) {

        try {

            const keilPrjFile = option.projectFile;
            const keilParser = KeilParser.NewInstance(option.projectFile);
            const targets = keilParser.ParseData();

            if (targets.length == 0) {
                throw Error(`Not found any target in '${keilPrjFile.path}' !`);
            }

            const baseInfo = AbstractProject.NewProject().createBase({
                name: option.outDir.name,
                type: targets[0].type,
                outDir: option.outDir
            }, false);

            const projectInfo = baseInfo.prjConfig.config;

            // init project info
            projectInfo.virtualFolder = {
                name: VirtualSource.rootName,
                files: [],
                folders: []
            };

            const getVirtualFolder = (path: string, noCreate?: boolean): VirtualFolder | undefined => {

                if (!path.startsWith(`${VirtualSource.rootName}/`)) {
                    throw Error(`'${path}' is not a virtual path`);
                }

                const pathList = path.split('/');
                pathList.splice(0, 1); // remvoe root

                // init start search folder
                let curFolder: VirtualFolder = projectInfo.virtualFolder;

                for (const name of pathList) {
                    const index = curFolder.folders.findIndex((folder) => { return folder.name === name; });
                    if (index === -1) {
                        if (noCreate) { return undefined; }
                        const newFolder = { name: name, files: [], folders: [] };
                        curFolder.folders.push(newFolder);
                        curFolder = newFolder;
                    } else {
                        curFolder = curFolder.folders[index];
                    }
                }

                return curFolder;
            };

            // init file group
            const fileFilter = AbstractProject.getFileFilters();
            targets[0].fileGroups.forEach((group) => {
                const vPath = `${VirtualSource.rootName}/${group.name.replace(/\\/g, '/')}`;
                const VFolder = <VirtualFolder>getVirtualFolder(vPath);
                group.files.forEach((fileItem) => {
                    if (fileFilter.some((reg) => reg.test(fileItem.file.name))) {
                        VFolder.files.push({
                            path: baseInfo.rootFolder.ToRelativePath(fileItem.file.path) || fileItem.file.path
                        });
                    }
                });
            });

            /* import RTE dependence */
            const rte_deps = targets[0].rte_deps;
            const unresolved_deps: KeilRteDependence[] = [];
            if (rte_deps) {

                /* import cmsis headers */
                const incs: string[] = this.importCmsisHeaders(baseInfo.rootFolder).map((f) => f.path);

                /* try resolve all deps */
                const mdkRoot = SettingManager.GetInstance().GetMdkArmDir();
                if (mdkRoot) { // MDK ARM dir, like: 'D:\keil\ARM'
                    const fileTypes: string[] = ['source', 'header'];
                    rte_deps.forEach((dep) => {
                        /* check dep whether is valid */
                        if (fileTypes.includes(dep.category || '') && dep.class && dep.packPath) {
                            const srcFileLi: File[] = [];
                            const vFolder = getVirtualFolder(`${VirtualSource.rootName}/::${dep.class}`, true);

                            /* add all candidate files */
                            if (dep.instance) { srcFileLi.push(new File(dep.instance[0])) }
                            srcFileLi.push(File.fromArray([mdkRoot.path, 'PACK', dep.packPath, dep.path]));

                            /* resolve dependences */
                            for (const srcFile of srcFileLi) {

                                /* check condition */
                                if (!srcFile.IsFile()) { continue; }
                                if (dep.category == 'source' && !vFolder) { continue; }

                                let srcRePath: string | undefined = baseInfo.rootFolder.ToRelativePath(srcFile.path, false);

                                /* if it's not in workspace, copy it */
                                if (srcRePath == undefined) {
                                    srcRePath = ['.cmsis', dep.packPath, dep.path].join(File.sep);
                                    const realFolder = File.fromArray([baseInfo.rootFolder.path, NodePath.dirname(srcRePath)]);
                                    realFolder.CreateDir(true);
                                    realFolder.CopyFile(srcFile);
                                }

                                /* if it's a source, add to project */
                                if (dep.category == 'source' && vFolder) {
                                    vFolder.files.push({ path: srcRePath });
                                }

                                /* if it's a header, add to include path */
                                else if (dep.category == 'header') {
                                    incs.push(`${baseInfo.rootFolder.path}${File.sep}${NodePath.dirname(srcRePath)}`);
                                }

                                return; /* resolved !, exit */
                            }
                        }
                        /* resolve failed !, store dep */
                        unresolved_deps.push(dep);
                    });
                }

                /* add include paths for targets */
                const mdk_rte_folder = File.fromArray([`${keilPrjFile.dir}`, 'RTE']);
                targets.forEach((target) => {
                    target.incList = target.incList.concat(incs);
                    target.incList.push(`${mdk_rte_folder.path}${File.sep}_${target.name}`); /* add RTE_Components header */
                });

                /* log unresolved deps */
                if (unresolved_deps.length > 0) {

                    const title = `!!! ${WARNING} !!!`;

                    const lines: string[] = [
                        `${title}`,
                        view_str$prompt$unresolved_deps,
                        view_str$prompt$prj_location.replace('{}', baseInfo.workspaceFile.path),
                        '---'
                    ];

                    unresolved_deps.forEach((dep) => {

                        let locate = dep.packPath;
                        if (dep.instance) {
                            locate = baseInfo.rootFolder
                                .ToRelativePath(dep.instance[0], false) || dep.instance[0]
                        }

                        const nLine: string[] = [
                            `FileName: '${dep.path}'`,
                            `\tClass:     '${dep.class}'`,
                            `\tCategory:  '${dep.category}'`,
                            `\tLocation:  '${locate}'`,
                        ];

                        lines.push(nLine.join(os.EOL));
                    });

                    const cont = lines.join(`${os.EOL}${os.EOL}`);
                    const file = File.fromArray([baseInfo.rootFolder.path, `${title}.txt`]);
                    file.Write(cont); // write content to file
                    const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(file.ToUri()));
                    vscode.window.showTextDocument(doc, { preview: false });
                }
            }

            // init all targets
            for (const keilTarget of targets) {

                const newTarget: ProjectTargetInfo = <any>{};
                const defIncList: string[] = [];

                // copy from cur proj info
                newTarget.compileConfig = copyObject(projectInfo.compileConfig);
                newTarget.uploader = projectInfo.uploader;
                newTarget.uploadConfig = copyObject(projectInfo.uploadConfig);
                newTarget.uploadConfigMap = copyObject(projectInfo.uploadConfigMap);

                // set specific configs
                if (keilTarget.type === 'C51') { // C51 project
                    const cmpConfig = (<KeilC51Option>keilTarget.compileOption);
                    // set toolchain
                    newTarget.toolchain = 'Keil_C51';
                    // set def include folders
                    const toolchain = ToolchainManager.getInstance().getToolchainByName('Keil_C51');
                    if (cmpConfig.includeFolder && toolchain) {
                        const absPath = [toolchain.getToolchainDir().path, 'INC', cmpConfig.includeFolder].join(File.sep);
                        defIncList.push(baseInfo.rootFolder.ToRelativePath(absPath) || absPath);
                    }
                }
                // ARM project
                else {
                    const keilCompileConf = <KeilARMOption>keilTarget.compileOption;
                    const prjCompileOption = (<ArmBaseCompileData>newTarget.compileConfig);
                    // set toolchain
                    newTarget.toolchain = keilCompileConf.toolchain;
                    // set cpu type
                    prjCompileOption.cpuType = keilCompileConf.cpuType;
                    // set cpu float point
                    prjCompileOption.floatingPointHardware = keilCompileConf.floatingPointHardware || 'none';
                    // set whether use custom scatter file
                    prjCompileOption.useCustomScatterFile = keilCompileConf.useCustomScatterFile;
                    // set lds path
                    if (keilCompileConf.scatterFilePath) {
                        prjCompileOption.scatterFilePath = baseInfo.rootFolder.
                            ToRelativePath(keilCompileConf.scatterFilePath) || keilCompileConf.scatterFilePath;
                    }
                    // set storage layout
                    prjCompileOption.storageLayout = keilCompileConf.storageLayout;
                }

                // init custom dependence after specific configs done
                newTarget.custom_dep = <any>{ name: 'default', sourceDirList: [], libList: [] };
                const incList = keilTarget.incList.map((path) => { return baseInfo.rootFolder.ToRelativePath(path) || path; });
                newTarget.custom_dep.incList = defIncList.concat(incList);
                newTarget.custom_dep.defineList = keilTarget.defineList;

                // fill exclude list
                newTarget.excludeList = [];
                for (const group of keilTarget.fileGroups) {
                    const vFolderPath = `${VirtualSource.rootName}/${group.name.replace(/\\/g, '/')}`;
                    if (group.disabled) { newTarget.excludeList.push(vFolderPath); } // add disabled group
                    for (const file of group.files) {
                        if (file.disabled) { // add disabled file
                            newTarget.excludeList.push(`${vFolderPath}/${file.file.name}`);
                        }
                    }
                }

                projectInfo.targets[keilTarget.name] = newTarget;
            }

            // init current target
            const curTarget: any = projectInfo.targets[targets[0].name];
            projectInfo.mode = targets[0].name; // current target name
            for (const name in curTarget) {
                if (name === 'custom_dep') {
                    projectInfo.dependenceList = [{
                        groupName: 'custom', depList: [curTarget[name]]
                    }];
                    continue;
                }
                (<any>projectInfo)[name] = curTarget[name];
            }

            // save all config
            baseInfo.prjConfig.Save();

            // switch project
            const selection = await vscode.window.showInformationMessage(
                view_str$operation$import_done, continue_text, cancel_text);
            if (selection === continue_text) {
                WorkspaceManager.getInstance().openWorkspace(baseInfo.workspaceFile);
            }

        } catch (error) {
            const msg = `${view_str$operation$import_failed}: ${(<Error>error).message}`;
            GlobalEvent.emit('msg', newMessage('Warning', msg));
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Hidden'));
        }
    }

    async CreateFromTemplate(option: CreateOptions) {

        const compresser = new Compress(ResManager.GetInstance().Get7zDir());
        const templateFile = <File>option.templateFile;

        try {
            const targetDir = new File(option.outDir.path + File.sep + option.name);
            targetDir.CreateDir(true);

            const res = await compresser.Unzip(templateFile, targetDir);
            if (res) { throw res; }

            setTimeout(async () => {

                try {

                    const wsFileList = targetDir.GetList([/\.code-workspace$/i], File.EMPTY_FILTER);
                    const wsFile: File | undefined = wsFileList.length > 0 ? wsFileList[0] : undefined;

                    if (wsFile) {

                        // rename workspace file name
                        const targetPath = targetDir.path + File.sep + option.name + AbstractProject.workspaceSuffix;
                        fs.renameSync(wsFile.path, targetPath);

                        // rename project
                        if (templateFile.suffix != '.ewt') { // ignore eide workspace project

                            // convert .EIDE to .eide
                            this.toLowercaseEIDEFolder(targetDir);

                            // rename project name
                            {
                                const prjFile = File.fromArray([targetDir.path, AbstractProject.EIDE_DIR, AbstractProject.prjConfigName]);
                                if (!prjFile.IsFile()) throw Error(`project file: '${prjFile.path}' is not exist !`);

                                try {
                                    const prjConf: ProjectConfigData<any> = JSON.parse(prjFile.Read());
                                    prjConf.name = option.name; // set project name
                                    prjFile.Write(JSON.stringify(prjConf));
                                } catch (error) {
                                    throw Error(`change project name failed !, msg: ${error.message}`);
                                }
                            }
                        }

                        // switch workspace if user select `yes`
                        const item = await vscode.window.showInformationMessage(
                            view_str$operation$create_prj_done, 'Yes', 'Later'
                        );

                        // switch workspace
                        if (item === 'Yes') {
                            const wsFile = new File(targetPath);
                            if (wsFile.IsFile()) {
                                WorkspaceManager.getInstance().openWorkspace(wsFile);
                            }
                        }
                    }
                } catch (error) {
                    GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
                }
            }, 400);

        } catch (error) {
            GlobalEvent.emit('msg', newMessage('Warning', `Create project failed !, msg: ${(<Error>error).message}`));
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Hidden'));
        }
    }

    async UninstallKeilPackage(item: ProjTreeItem) {
        const prj = this.prjList[item.val.projectIndex];
        if (prj.GetPackManager().GetPack()) {
            return prj.UninstallPack(<string>item.val.value);
        }
    }

    SaveAll() {
        this.prjList.forEach(sln => {
            sln.Save();
        });
    }

    CloseAll() {
        this.prjList.forEach(sln => {
            sln.Close();
        });
        this.prjList = [];
    }

    //---

    getRecords(): string[] {
        return Array.from(this.slnRecord);
    }

    clearAllRecords() {
        this.slnRecord = [];
    }

    removeRecord(record: string) {
        const i = this.slnRecord.findIndex(str => { return str === record; });
        if (i !== -1) {
            this.slnRecord.splice(i, 1);
        }
    }

    saveRecord() {
        if (this.slnRecord.length > ProjectDataProvider.RecMaxNum) {
            this.slnRecord.splice(0, this.slnRecord.length - ProjectDataProvider.RecMaxNum);
        }
        this.recFile.Write(JSON.stringify(this.slnRecord));
    }

    private addRecord(path: string) {
        if (!this.slnRecord.includes(path)) {
            this.slnRecord.push(path);
        }
    }

    private loadRecord() {
        if (this.recFile.IsFile()) {
            try {
                this.slnRecord = JSON.parse(this.recFile.Read());
            } catch (err) {
                vscode.window.showWarningMessage(project_record_read_failed);
                this.slnRecord = [];
            }
        }
    }

    //---

    async SetDevice(index: number) {

        const prj = this.prjList[index];
        const packInfo = prj.GetPackManager().GetPack();

        if (packInfo) {
            const devList = prj.GetPackManager().GetDeviceList().map((dev) => {
                return <vscode.QuickPickItem>{ label: dev.name, description: dev.core };
            });
            const item = await vscode.window.showQuickPick(devList, {
                placeHolder: 'Found ' + devList.length + ' devices, ' + set_device_hint,
                canPickMany: false,
                matchOnDescription: true
            });
            if (item) {
                prj.GetPackManager().SetDeviceInfo(item.label, item.description);
            }
        }
    }

    private AddProject(proj: AbstractProject) {
        this.prjList.push(proj);
        this.addRecord(proj.getWsPath());
        proj.on('dataChanged', (type) => this.onProjectChanged(proj, type));
        this.UpdateView();
    }

    Close(index: number) {

        if (index < 0 || index >= this.prjList.length) {
            GlobalEvent.emit('error', new Error('index out of range: ' + index.toString()));
            return;
        }

        const sln = this.prjList[index];
        if (this.isRootWorkspaceProject(sln)) {
            GlobalEvent.emit('msg', {
                type: 'Warning',
                contentType: 'string',
                content: can_not_close_project
            });
            return;
        }

        sln.Close();
        this.prjList.splice(index, 1);
        this.UpdateView();
    }

    private async SwitchProject(prj: AbstractProject) {
        const selection = await vscode.window.showInformationMessage(switch_workspace_hint, continue_text, cancel_text);
        if (selection === continue_text) {
            WorkspaceManager.getInstance().openWorkspace(prj.GetWorkspaceConfig().GetFile());
        }
    }
}

interface BuildCommandInfo {
    title: string;
    command: string;
    program?: string;
    order?: number;
}

interface ImporterProjectInfo {
    name: string;
    target?: string;
    incList: string[];
    defineList: string[];
    files: VirtualFolder;
}

export class ProjectExplorer implements CustomConfigurationProvider {

    private readonly vFolderNameMatcher = /^\w[\w\t \-:@\.]*$/;

    private view: vscode.TreeView<ProjTreeItem>;
    private dataProvider: ProjectDataProvider;

    private _event: events.EventEmitter;
    private cppcheck_diag: vscode.DiagnosticCollection;
    private cppcheck_out: vscode.OutputChannel;

    private cppToolsApi: CppToolsApi | undefined;
    private cppToolsOut: vscode.OutputChannel;

    constructor(context: vscode.ExtensionContext) {

        this._event = new events.EventEmitter();

        // register hook
        GlobalEvent.on('project.opened', (prj) => this.onProjectOpened(prj));

        this.dataProvider = new ProjectDataProvider(context);
        this.cppcheck_diag = vscode.languages.createDiagnosticCollection('cppcheck');

        this.view = vscode.window.createTreeView('Project', { treeDataProvider: this.dataProvider });
        context.subscriptions.push(this.view);

        // item click event
        context.subscriptions.push(vscode.commands.registerCommand(ProjTreeItem.ITEM_CLICK_EVENT, (item) => this.OnTreeItemClick(item)));

        // create vsc output channel
        this.cppcheck_out = vscode.window.createOutputChannel('eide-cppcheck');
        this.cppToolsOut = vscode.window.createOutputChannel('eide-cpptools-log');

        // register doc event
        context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((doc) => {
            this.onCustomDepYamlSaved(doc);
            this.onFolderSourceYamlSaved(doc);
        }));
        context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((doc) => {
            this.onCustomDepYamlClosed(doc);
            this.onFolderSourceYamlClosed(doc);
        }));

        this.on('request_open_project', (fsPath: string) => this.dataProvider.OpenProject(fsPath));
        this.on('request_create_project', (option: CreateOptions) => this.dataProvider.CreateProject(option));
        this.on('request_create_from_template', (option) => this.dataProvider.CreateFromTemplate(option));
        this.on('request_import_project', (option) => this.dataProvider.ImportProject(option));
    }

    ////////////////////////////////// cpptools intellisense provider ///////////////////////////////////

    name: string = 'eide';

    extensionId: string = 'cl.eide';

    private isRegisteredCpptoolsProvider: boolean = false;

    private async onProjectOpened(prj: AbstractProject) {

        // notify cpptools update when project config changed
        prj.on('cppConfigChanged', () => {
            if (this.cppToolsApi) {
                if (this.cppToolsApi.notifyReady) {
                    this.cppToolsApi.notifyReady(this);
                } else {
                    this.cppToolsApi.didChangeCustomConfiguration(this);
                    this.cppToolsApi.didChangeCustomBrowseConfiguration(this);
                }
            }
        });

        // get cpptools api if we have not get
        if (!this.cppToolsApi) {
            this.cppToolsApi = await getCppToolsApi(Version.v5);
            if (!this.cppToolsApi) {
                const msg = `Can't get cpptools api, please active c/c++ extension, otherwise, the c/++ intellisence config cannot be provided !`;
                GlobalEvent.emit('msg', newMessage('Warning', msg));
                this.cppToolsOut.appendLine(`[error] ${msg}`);
                return;
            }
        }

        // register cpptools provider, skip if already registered
        if (this.cppToolsApi && !this.isRegisteredCpptoolsProvider) {

            this.cppToolsApi.registerCustomConfigurationProvider(this);
            this.cppToolsOut.appendLine(`[init] register CustomConfigurationProvider done !`);

            if (this.cppToolsApi.notifyReady) {
                this.cppToolsApi.notifyReady(this);
            } else {
                this.cppToolsApi.didChangeCustomConfiguration(this);
                this.cppToolsApi.didChangeCustomBrowseConfiguration(this);
            }

            // set flag
            this.isRegisteredCpptoolsProvider = true;
        }
    }

    canProvideConfiguration(uri: vscode.Uri, token?: vscode.CancellationToken | undefined): Thenable<boolean> {
        return new Promise(async (resolve) => {
            let result = false;
            await this.dataProvider.traverseProjectsAsync(async (prj) => {
                result = await prj.canProvideConfiguration(uri, token);
                return result;
            });
            resolve(result);
        });
    }

    provideConfigurations(uris: vscode.Uri[], token?: vscode.CancellationToken | undefined): Thenable<SourceFileConfigurationItem[]> {
        return new Promise(async (resolve) => {
            let result: SourceFileConfigurationItem[] = [];
            for (const uri of uris) {
                await this.dataProvider.traverseProjectsAsync(async (prj) => {
                    if (await prj.canProvideConfiguration(uri, token)) {
                        result = result.concat(await prj.provideConfigurations([uri], token));
                        return true;
                    }
                });
            }
            resolve(result);
            this.cppToolsOut.appendLine(`[source] provideConfigurations`);
            this.cppToolsOut.appendLine(yml.stringify(result));
        });
    }

    canProvideBrowseConfigurationsPerFolder(token?: vscode.CancellationToken | undefined): Thenable<boolean> {
        return new Promise(async (resolve) => {
            let result = false;
            await this.dataProvider.traverseProjectsAsync(async (prj) => {
                result = await prj.canProvideBrowseConfigurationsPerFolder(token);
                return result;
            });
            resolve(result);
        });
    }

    provideFolderBrowseConfiguration(uri: vscode.Uri, token?: vscode.CancellationToken | undefined): Thenable<WorkspaceBrowseConfiguration | null> {
        return new Promise(async (resolve) => {
            let result: WorkspaceBrowseConfiguration | null = null;
            await this.dataProvider.traverseProjectsAsync(async (prj) => {
                result = await prj.provideFolderBrowseConfiguration(uri, token);
                return result !== null;
            });
            resolve(result);
            this.cppToolsOut.appendLine(`[folder] provideFolderBrowseConfiguration for '${uri.fsPath}'`);
            this.cppToolsOut.appendLine(yml.stringify(result));
        });
    }

    /**
     * @note we not support
    */
    canProvideBrowseConfiguration(token?: vscode.CancellationToken | undefined): Thenable<boolean> {
        return new Promise((resolve) => {
            resolve(false);
        });
    }

    /**
     * @note we not support
    */
    provideBrowseConfiguration(token?: vscode.CancellationToken | undefined): Thenable<WorkspaceBrowseConfiguration | null> {
        return new Promise((resolve) => {
            resolve(null);
        });
    }

    dispose() {
        this.dataProvider.traverseProjects((prj) => {
            prj.dispose();
            return undefined;
        });
    }

    ////////////////////////////////// Project Explorer ///////////////////////////////////

    private on(event: 'request_open_project', listener: (fsPath: string) => void): void;
    private on(event: 'request_create_project', listener: (option: CreateOptions) => void): void;
    private on(event: 'request_create_from_template', listener: (option: CreateOptions) => void): void;
    private on(event: 'request_import_project', listener: (option: ImportOptions) => void): void;
    private on(event: any, listener: (arg?: any) => void): void {
        this._event.on(event, listener);
    }

    emit(event: 'request_open_project', fsPath: string): void;
    emit(event: 'request_create_project', option: CreateOptions): void;
    emit(event: 'request_create_from_template', option: CreateOptions): void;
    emit(event: 'request_import_project', option: ImportOptions): void;
    emit(event: any, arg?: any): void {
        this._event.emit(event, arg);
    }

    getProjectByTreeItem(prjItem?: ProjTreeItem): AbstractProject | undefined {
        return prjItem instanceof ProjTreeItem ?
            this.dataProvider.GetProjectByIndex(prjItem.val.projectIndex) :
            this.dataProvider.getActiveProject();
    }

    getProjectCount(): number {
        return this.dataProvider.getProjectCount();
    }

    Refresh() {
        this.dataProvider.UpdateView();
    }

    Close(item: ProjTreeItem) {
        this.dataProvider.Close(item.val.projectIndex);
        GlobalEvent.emit('project.closed');
    }

    SaveAll() {
        this.dataProvider.SaveAll();
    }

    private async createTarget(prj: AbstractProject) {

        let targetName = await vscode.window.showInputBox({
            placeHolder: 'Input a target name',
            ignoreFocusOut: true,
            validateInput: (val: string) => {
                if (val.length > 25) { return `string is too long !, length must < 25, current is ${val.length}`; }
                if (!/^[\w\-]+$/.test(val)) { return `string can only contain word, number '-' or '_' !`; }
                return undefined;
            }
        });

        if (targetName) {

            if (prj.getTargets().includes(targetName)) {
                GlobalEvent.emit('msg', newMessage('Warning', `Target '${targetName}' is existed !`));
                return;
            }

            prj.switchTarget(targetName);
        }
    }

    private async deleteTarget(prj: AbstractProject) {

        const selTarget = await vscode.window.showQuickPick(prj.getTargets(), { placeHolder: 'Select a target to delete' });
        if (selTarget === undefined) { return; }

        const curTarget = prj.getCurrentTarget();
        if (selTarget === curTarget) {
            GlobalEvent.emit('msg', newMessage('Warning', `Target '${curTarget}' is actived !, can't remove it !`));
            return;
        }

        const opt_str = await vscode.window.showInformationMessage(
            `Target '${selTarget}' will be deleted !, Are you sure ?`,
            'Yes', 'No'
        );

        /* if user canceled, exit */
        if (opt_str != 'Yes') { return; }

        prj.deleteTarget(selTarget);
    }

    switchTarget(prjItem: ProjTreeItem) {

        const prj = this.dataProvider.GetProjectByIndex(prjItem.val.projectIndex);
        const resManager = ResManager.GetInstance();

        const pickBox = vscode.window.createQuickPick();
        pickBox.title = view_str$project$sel_target;
        pickBox.placeholder = view_str$project$sel_target;
        pickBox.items = prj.getTargets().map<vscode.QuickPickItem>((name: string) => { return { label: name }; });
        pickBox.buttons = [
            {
                iconPath: {
                    dark: vscode.Uri.parse(resManager.GetIconByName('Add_16xMD.svg').ToUri()),
                    light: vscode.Uri.parse(resManager.GetIconByName('Add_16xMD.svg').ToUri())
                },
                tooltip: 'New Target'
            },
            {
                iconPath: {
                    dark: vscode.Uri.parse(resManager.GetIconByName('trash_dark.svg').ToUri()),
                    light: vscode.Uri.parse(resManager.GetIconByName('trash_light.svg').ToUri())
                },
                tooltip: 'Delete Target'
            }
        ];

        pickBox.onDidTriggerButton(async (e) => {

            // create target
            if (e.tooltip === pickBox.buttons[0].tooltip) {
                await this.createTarget(prj);
            }

            // delete target
            if (e.tooltip === pickBox.buttons[1].tooltip) {
                await this.deleteTarget(prj);
            }

            pickBox.dispose();
        });

        let curItem: vscode.QuickPickItem | undefined;

        pickBox.onDidChangeSelection((items: readonly vscode.QuickPickItem[]) => {
            curItem = items.length > 0 ? items[0] : undefined;
        });

        pickBox.onDidAccept(async () => {

            if (curItem !== undefined) {
                const targetName = curItem.label;
                // switch target
                if (targetName) {
                    prj.switchTarget(targetName);
                }
            }

            pickBox.dispose();
        });

        pickBox.show();
    }

    clearCppcheckDiagnostic(): void {
        this.cppcheck_diag.clear();
    }

    openHistoryRecords() {

        const records: vscode.QuickPickItem[] = this.dataProvider
            .getRecords()
            .map((record) => {
                return <vscode.QuickPickItem>{
                    label: NodePath.basename(record, '.code-workspace'),
                    detail: record
                };
            });

        vscode.window.showQuickPick(records.reverse(), {
            canPickMany: false,
            placeHolder: `Found ${records.length} results, select one to open`,
            matchOnDescription: false,
            matchOnDetail: true,
            ignoreFocusOut: false
        }).then((item: vscode.QuickPickItem | undefined) => {
            if (item !== undefined && item.detail) {
                this.dataProvider.OpenProject(item.detail).then((prj) => {
                    if (prj === undefined) {
                        this.dataProvider.removeRecord(<string>item.detail);
                    }
                });
            }
        });
    }

    clearAllHistoryRecords() {
        this.dataProvider.clearAllRecords();
    }

    notifyUpdateOutputFolder(prj: AbstractProject) {
        const item = this.dataProvider.treeCache.getTreeItem(prj, TreeItemType.OUTPUT_FOLDER);
        if (item) {
            this.dataProvider.UpdateView(item);
        }
    }

    private _buildLock: boolean = false;
    BuildSolution(prjItem?: ProjTreeItem, options?: BuildOptions) {

        const prj = this.getProjectByTreeItem(prjItem);

        if (prj === undefined) {
            GlobalEvent.emit('msg', newMessage('Warning', 'No active project !'));
            return;
        }

        if (this._buildLock) {
            GlobalEvent.emit('msg', newMessage('Warning', 'build busy !, please wait !'));
            return;
        }

        this._buildLock = true;

        // save project before build
        prj.Save();

        try {
            const codeBuilder = CodeBuilder.NewBuilder(prj);

            // set event handler
            const toolchain = prj.getToolchain().name;

            // notify view update after build done !
            codeBuilder.on('finished', () => {
                prj.notifyUpdateSourceRefs(toolchain);
                this.notifyUpdateOutputFolder(prj);
            });

            // start build
            codeBuilder.build(options);

            // update debug configuration
            prj.updateDebugConfig();

        } catch (error) {
            GlobalEvent.emit('error', error);
        }

        setTimeout(() => {
            this._buildLock = false;
        }, 500);
    }

    buildWorkspace(rebuild?: boolean) {

        if (this.dataProvider.getProjectCount() == 0) {
            GlobalEvent.emit('msg', newMessage('Warning', 'No project is opened !'));
            return;
        }

        const cmdList: BuildCommandInfo[] = [];

        this.dataProvider.foreachProject((project, index) => {

            const projectName = project.GetConfiguration().config.name;
            let projectOrder: number | undefined = undefined;

            /* get project order */
            const envConfig = project.getProjectRawEnv();
            const targetName = project.getCurrentTarget().toLowerCase();
            if (envConfig) {
                const cfgName = 'EIDE_BUILD_ORDER';
                // parse global config
                if (envConfig[cfgName]) {
                    projectOrder = parseInt(envConfig[cfgName]) || undefined;
                }
                // parse target config
                if (envConfig[targetName] && envConfig[targetName][cfgName]) {
                    projectOrder = parseInt(envConfig[targetName][cfgName]) || undefined;
                }
            }

            /* gen command */
            const builder = CodeBuilder.NewBuilder(project);
            const cmdLine = builder.genBuildCommand({ useFastMode: !rebuild }, true);
            if (cmdLine) {
                if (projectOrder == undefined || projectOrder == NaN) {
                    projectOrder = 100; /* make default order is 100 */
                }
                cmdList.push({
                    title: `build '${projectName}'`,
                    command: CmdLineHandler.DeleteCmdPrefix(cmdLine),
                    order: projectOrder
                });
            }
        });

        /* gen params file */
        const paramsFile = File.fromArray([os.tmpdir(), `eide-ws-params.tmp`]);
        paramsFile.Write(JSON.stringify(cmdList));

        /* launch */
        const resManager = ResManager.GetInstance();
        const cmds = [`${ResManager.GetInstance().getBuilder().path}`].concat(['-r', paramsFile.path]);
        const exeName: string = resManager.getMonoExecutable().path;
        const commandLine = CmdLineHandler.getCommandLine(exeName, cmds);
        runShellCommand('build-workspace', commandLine, resManager.getCMDPath());
    }

    openWorkspaceConfig() {
        try {
            const wsFile = WorkspaceManager.getInstance().getWorkspaceFile();
            if (wsFile == undefined) { throw new Error('No workspace opened !'); }
            const uri = vscode.Uri.parse(wsFile.ToUri());
            vscode.window.showTextDocument(uri, { preview: true });
        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
        }
    }

    BuildClean(prjItem?: ProjTreeItem) {

        const prj = this.getProjectByTreeItem(prjItem);

        if (prj === undefined) {
            GlobalEvent.emit('msg', newMessage('Warning', 'No active project !'));
            return;
        }

        const outDir = prj.ToAbsolutePath(prj.getOutputDir());
        runShellCommand('clean', `cmd /E:ON /C del /S /Q "${outDir}"`, ResManager.GetInstance().getCMDPath());
    }

    private _uploadLock: boolean = false;
    async UploadToDevice(prjItem?: ProjTreeItem, eraseAll?: boolean) {

        const prj = this.getProjectByTreeItem(prjItem);

        if (prj === undefined) {
            GlobalEvent.emit('msg', newMessage('Warning', 'No active project !'));
            return;
        }

        if (this._uploadLock) {
            GlobalEvent.emit('msg', newMessage('Warning', 'upload busy !, please wait !'));
            return;
        }

        this._uploadLock = true;
        const uploader = HexUploaderManager.getInstance().createUploader(prj);

        try {
            await uploader.upload(eraseAll);
        } catch (error) {
            GlobalEvent.emit('error', error);
        }

        this._uploadLock = false;
    }

    ExportKeilXml(prjIndex: number) {
        try {
            const prj = this.dataProvider.GetProjectByIndex(prjIndex);
            const matchList: ToolchainName[] = ['AC5', 'AC6', 'GCC', 'Keil_C51'];

            // limit toolchain
            if (!matchList.includes(prj.getToolchain().name)) {
                GlobalEvent.emit('msg', newMessage('Warning', `Not support for toolchain '${prj.getToolchain().name}' !`));
                return;
            }

            const xmlFile = prj.ExportToKeilProject();

            if (xmlFile) {
                GlobalEvent.emit('msg', newMessage('Info', export_keil_xml_ok + prj.ToRelativePath(xmlFile.path)));
            } else {
                GlobalEvent.emit('msg', newMessage('Warning', export_keil_xml_failed));
            }
        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
        }
    }

    private installLocked: boolean = false;
    InstallKeilPackage(prjIndex: number) {

        if (this.installLocked) {
            GlobalEvent.emit('msg', {
                type: 'Warning',
                contentType: 'string',
                content: 'Busy !, Please wait for the current operation to complete !'
            });
            return;
        }

        this.installLocked = true;
        const prj = this.dataProvider.GetProjectByIndex(prjIndex);

        if (prj.GetConfiguration().config.type !== 'ARM') { // only for ARM project
            GlobalEvent.emit('msg', {
                type: 'Warning',
                contentType: 'string',
                content: not_support_no_arm_project
            });
            this.installLocked = false;
            return;
        }

        if (prj.GetPackManager().GetPack()) {
            GlobalEvent.emit('msg', {
                type: 'Warning',
                contentType: 'string',
                content: 'You should uninstall old package before install a new one !'
            });
            this.installLocked = false;
            return;
        }

        vscode.window.withProgress<void>({
            location: vscode.ProgressLocation.Notification,
            title: `Installing cmsis package`
        }, (progress) => {
            return new Promise(async (resolve_) => {

                const resolve = () => {
                    this.installLocked = false;
                    resolve_();
                };

                try {

                    progress.report({ message: 'preparing ...' });

                    let packFile: File;

                    const insType = await vscode.window.showQuickPick<vscode.QuickPickItem>([
                        {
                            label: 'From Repo',
                            detail: 'Download cmsis pack from the repository and install'
                        },
                        {
                            label: 'From Disk',
                            detail: 'Select cmsis pack file from your computer and install'
                        }
                    ], {
                        placeHolder: `Select an installation type. Press 'Esc' to exit`,
                        canPickMany: false,
                        ignoreFocusOut: true
                    });

                    if (insType === undefined) { // canceled, exit
                        resolve();
                        return;
                    }

                    // download from internet
                    if (insType.label == 'From Repo') {

                        progress.report({ message: 'waiting download task done ...' });

                        const res = await this.startDownloadCmsisPack();

                        if (res === undefined) { // canceled, exit
                            resolve();
                            return;
                        }

                        if (res instanceof Error) {
                            GlobalEvent.emit('msg', ExceptionToMessage(res, 'Warning'));
                            resolve();
                            return;
                        }

                        packFile = res;
                    }

                    // from disk
                    else {
                        const urls = await vscode.window.showOpenDialog({
                            defaultUri: vscode.Uri.file(prj.GetRootDir().path),
                            canSelectFolders: false,
                            canSelectFiles: true,
                            openLabel: install_this_pack,
                            filters: {
                                'Cmsis Package': ['pack']
                            }
                        });

                        if (urls === undefined) { // canceled, exit
                            resolve();
                            return;
                        }

                        packFile = new File(urls[0].fsPath);
                    }

                    await prj.InstallPack(packFile, (_progress, msg) => {
                        progress.report({
                            increment: _progress ? 12 : undefined,
                            message: msg
                        });
                    });

                    resolve();

                } catch (error) {
                    GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
                    resolve();
                }
            });
        });
    }

    private async startDownloadCmsisPack(): Promise<File | Error | undefined> {

        const redirectUri = (uri: string) => {
            return SettingManager.GetInstance().isUseGithubProxy() ? redirectHost(uri) : uri;
        };

        // URL: https://api.github.com/repos/github0null/eide-cmsis-pack/contents/packages
        const repoUrl = redirectUri('api.github.com/repos/' + SettingManager.GetInstance().getCmsisPackRepositoryUrl());

        return await vscode.window.withProgress<File | Error | undefined>({
            location: vscode.ProgressLocation.Notification,
            title: `Download cmsis package`
        }, async (progress, cancelToken) => {

            progress.report({ message: `reading package list ...` });

            const pkgList = await readGithubRepoFolder(repoUrl);
            if (pkgList instanceof Error) {
                return pkgList;
            }

            progress.report({ message: `waiting cmsis package selection ...` });

            const itemList: vscode.QuickPickItem[] = pkgList
                .filter((inf) => inf.type == 'file')
                .map((fileInfo) => {
                    return {
                        label: fileInfo.name,
                        detail: `Size: ${(fileInfo.size / 1000000).toFixed(1)} MB, Sha: ${fileInfo.sha}`,
                        val: fileInfo
                    };
                });

            const item: any = await vscode.window.showQuickPick(itemList, {
                placeHolder: `Found ${pkgList.length} packages, select one to install. Press 'Esc' to exit`,
                canPickMany: false,
                ignoreFocusOut: true,
                matchOnDescription: true
            });

            if (item == undefined) { // user canceled
                return undefined;
            }

            try {

                const gitFileInfo: GitFileInfo = item.val;
                let packageFile: File | undefined;

                const resManager = ResManager.GetInstance();
                const packDir = File.fromArray([resManager.getEideHomeFolder().path, 'pack', 'cmsis']);
                packDir.CreateDir(true);

                // read cache
                const cache = new FileCache(packDir);
                packageFile = cache.get(gitFileInfo.name, gitFileInfo.sha);
                if (packageFile) { // found cache, use it
                    return packageFile;
                }

                // download it
                progress.report({ message: `initializing download '${gitFileInfo.name}' ...` });

                if (gitFileInfo.download_url == undefined) {
                    return new Error(`Can't download '${gitFileInfo.name}', not download url found !`);
                }

                const url = redirectUri(gitFileInfo.download_url);
                const buff = await downloadFileWithProgress(url, gitFileInfo.name, progress, cancelToken);

                if (buff == undefined) { // canceled
                    return undefined;
                }

                if (buff instanceof Error) {
                    return buff;
                }

                // save file
                packageFile = File.fromArray([packDir.path, gitFileInfo.name]);
                fs.writeFileSync(packageFile.path, buff);

                // add to cache
                const sha = genGithubHash(buff);
                cache.add(packageFile.name, sha);
                cache.save();

                return packageFile;

            } catch (error) {
                return error;
            }
        });
    }

    private exportLocked: boolean = false;
    async ExportToTemplate(prjItem?: ProjTreeItem, isWorkspace?: boolean) {

        if (this.exportLocked) {
            GlobalEvent.emit('msg', {
                type: 'Warning',
                contentType: 'string',
                content: 'Busy, please try again later !'
            });
            return;
        }

        this.exportLocked = true;

        try {
            let templateName = isWorkspace ? WorkspaceManager.getInstance().getWorkspaceRoot()?.name : undefined;
            let rootDir = isWorkspace ? WorkspaceManager.getInstance().getWorkspaceRoot() : undefined;
            let tmp_suffix = isWorkspace ? 'ewt' : 'ept';
            let resIgnoreList: string[] = [];

            const defExcludeList: string[] = [
                '.git',
                '.git\\*',
                '*.eide-template',
                '*.log',
                `${AbstractProject.EIDE_DIR}\\*.db3`,
                `${AbstractProject.EIDE_DIR}\\*.dat`,
                `${AbstractProject.vsCodeDir}\\c_cpp_properties.json`
            ];

            /* if this is a project, handle it ! */
            if (prjItem && isWorkspace == undefined) {
                const prj = this.dataProvider.GetProjectByIndex(prjItem.val.projectIndex);
                const prjConfig = prj.GetConfiguration().config;
                rootDir = prj.GetRootDir();
                templateName = prjConfig.name;
                tmp_suffix = 'ept';
                const prjOutFolder = NodePath.normalize(prj.GetConfiguration().config.outDir);
                defExcludeList.push(`${prjOutFolder}`, `${prjOutFolder}\\*`);
                resIgnoreList = prj.readIgnoreList();
                const prjUid = prjConfig.miscInfo.uid;
                prjConfig.miscInfo.uid = undefined; // clear uid before save prj
                prj.Save(); // save project
                prjConfig.miscInfo.uid = prjUid; // restore uid
            }

            /* invalid root folder, exit */
            if (rootDir == undefined) {
                this.exportLocked = false;
                return;
            }

            const templateFile: File = File.fromArray([rootDir.path, `${templateName}.${tmp_suffix}`]);

            // delete old template file
            if (templateFile.IsFile()) {
                fs.unlinkSync(templateFile.path);
            }

            const option: CompressOption = {
                zipType: '7z',
                fileName: templateFile.name,
                excludeList: ArrayDelRepetition(defExcludeList.concat(resIgnoreList))
            };

            const compresser = new Compress(ResManager.GetInstance().Get7zDir());

            const err = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: isWorkspace ? `Packing workspace` : `Packing project`,
                cancellable: false
            }, (progress, __): Thenable<Error | null> => {
                return new Promise(async (resolve) => {
                    progress.report({ message: 'zipping ...' });
                    const err = await compresser.Zip(<File>rootDir, option, rootDir);
                    progress.report({ message: 'export done !' });
                    setTimeout(() => resolve(err), 1500);
                });
            });

            if (err) {
                GlobalEvent.emit('msg', ExceptionToMessage(err, 'Warning'));
            }
        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
        }

        this.exportLocked = false;
    }

    async generateMakefile(prjItem: ProjTreeItem) {
        try {
            const mkFileName = 'Makefile';
            const resManager = ResManager.GetInstance();

            const cache = resManager.getCache(mkFileName);
            const tmpFile = resManager.getCachedFileByName(mkFileName);

            /* if found cache, check it, if not found, download it */
            const hasCache: boolean = (cache != undefined) && tmpFile.IsFile();

            const err = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: hasCache ? 'Checking makefile template' : 'Downloading makefile template',
                cancellable: true
            }, (progress, token): Thenable<Error | undefined> => {
                return new Promise(async (resolve) => {

                    const fileInfo = await getDownloadUrlFromGit('eide_makefile_template', '', mkFileName);
                    if (fileInfo instanceof Error || fileInfo == undefined) {
                        if (hasCache) { /* can't get from network ? use cache */
                            resolve(undefined);
                            return;
                        } else {
                            resolve(fileInfo || new Error(`not found Makefile in repo !`));
                            return;
                        }
                    }

                    const downloadUrl: string | undefined = fileInfo['download_url'];
                    const fileHash: string | undefined = fileInfo['sha'];
                    if (downloadUrl == undefined || fileHash == undefined) {
                        if (hasCache) { /* can't get from network ? use cache */
                            resolve(undefined);
                            return;
                        } else {
                            resolve(new Error(`not found Makefile in repo !`));
                            return;
                        }
                    }

                    if (hasCache && cache?.sha == fileHash) { /* check makefile whether need update ? if not, exit */
                        resolve(undefined);
                        return;
                    }

                    const data = await downloadFileWithProgress(<string>downloadUrl, tmpFile.name, progress, token);

                    if (data instanceof Buffer) {
                        fs.writeFileSync(tmpFile.path, data);
                        resManager.addCache({
                            name: tmpFile.name,
                            size: data.length,
                            version: '1.0',
                            sha: <string>fileHash
                        });
                        resolve(undefined);
                        return;
                    }

                    else if (data instanceof Error) {
                        if (hasCache) { /* can't get from network ? use cache */
                            resolve(undefined);
                            return;
                        } else {
                            resolve(data);
                            return;
                        }
                    }

                    // res is undefined, operation canceled
                    resolve(new Error(`operation canceled !`));
                });
            });

            if (err) { /* if operation failed, exit */
                GlobalEvent.emit('msg', ExceptionToMessage(err, 'Warning'));
                return;
            }

            const prj = this.dataProvider.GetProjectByIndex(prjItem.val.projectIndex);
            const targetFile = new File(prj.getWsFile().dir + File.sep + mkFileName);

            /* already existed, override ? */
            if (targetFile.IsFile()) {
                const isOk = await vscode.window.showInformationMessage(
                    `Makefile is already existed !, Override it ?`,
                    'Yes', 'No');
                if (isOk == 'No') return; /* exit */
            }

            /* generate makefile */
            fs.copyFileSync(tmpFile.path, targetFile.path);
            GlobalEvent.emit('msg', newMessage('Info', 'Generate Done !'));

        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
        }
    }

    async AddSrcDir(item: ProjTreeItem) {

        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);

        const folderType = await vscode.window.showQuickPick<vscode.QuickPickItem>(
            [
                {
                    label: view_str$project$folder_type_virtual,
                    detail: view_str$project$folder_type_virtual_desc
                },
                {
                    label: view_str$project$folder_type_fs,
                    detail: view_str$project$folder_type_fs_desc
                }
            ],
            {
                placeHolder: view_str$project$sel_folder_type
            });

        if (folderType === undefined) {
            return;
        }

        // add folder from filesystem
        if (folderType.label === view_str$project$folder_type_fs) {

            const folderList = await vscode.window.showOpenDialog({
                canSelectMany: true,
                canSelectFiles: false,
                canSelectFolders: true,
                openLabel: view_str$dialog$add_to_source_folder,
                defaultUri: vscode.Uri.file(prj.GetRootDir().path),
            });

            if (folderList && folderList.length > 0) {

                for (const folderUri of folderList) {

                    const folderPath = folderUri.fsPath;
                    const rePath = prj.ToRelativePath(folderPath, false);

                    // if can't calculate repath, skip
                    if (rePath === undefined) {
                        GlobalEvent.emit('msg', newMessage('Warning', `Can't calculate relative path for '${folderPath}' !`));
                        continue;
                    }

                    if (rePath === '.' || rePath.trim() === '' ||   // is current root folder
                        rePath === '..' || rePath.startsWith(`..${File.sep}`)) // is parent folder
                    {
                        GlobalEvent.emit('msg', newMessage('Warning', view_str$prompt$src_folder_must_be_a_child_of_root));
                        continue;
                    }

                    prj.GetConfiguration().AddSrcDir(folderPath);
                }
            }
        }

        // add root virtual folder
        else {

            const folderName = await vscode.window.showInputBox({
                placeHolder: 'Input a folder name',
                ignoreFocusOut: true,
                validateInput: (input) => {
                    if (!this.vFolderNameMatcher.test(input)) {
                        return `must match '${this.vFolderNameMatcher.source}'`;
                    }
                }
            });

            if (folderName) {
                prj.getVirtualSourceManager().addFolder(folderName);
            }
        }
    }

    async RemoveSrcDir(item: ProjTreeItem) {
        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        if (item.val.obj instanceof File) {
            prj.GetConfiguration().RemoveSrcDir(item.val.obj.path);
        } else {
            GlobalEvent.emit('error', new Error('remove source root failed !'));
        }
    }

    async refreshSrcRoot(item: ProjTreeItem) {

        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);

        switch (item.type) {
            case TreeItemType.OUTPUT_FOLDER:
                this.notifyUpdateOutputFolder(prj);
                break;
            case TreeItemType.V_FOLDER_ROOT:
                prj.refreshSourceRoot((<VirtualFolderInfo>item.val.obj).path);
                break;
            default:
                if (typeof item.val.value === 'string') {
                    prj.refreshSourceRoot(<string>item.val.value);
                }
                break;
        }
    }

    // virtual source

    async Virtual_folderAddFile(item: ProjTreeItem) {

        const project = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        const curFolder = <VirtualFolderInfo>item.val.obj;

        const fileUriList = await vscode.window.showOpenDialog({
            canSelectMany: true,
            canSelectFiles: true,
            canSelectFolders: false,
            openLabel: view_str$project$add_source,
            defaultUri: vscode.Uri.file(project.GetRootDir().path),
            filters: {
                'c/c++': ['c', 'cpp', 'cxx', 'cc', 'c++'],
                'header': ['h', 'hxx', 'hpp', 'inc'],
                'asm': ['s', 'asm', 'a51'],
                'lib': ['lib', 'a', 'o', 'obj'],
                'any (*.*)': ['*']
            }
        });

        if (fileUriList === undefined) {
            return;
        }

        project.getVirtualSourceManager().addFiles(
            curFolder.path,
            fileUriList.map((uri) => uri.fsPath)
        );
    }

    async Virtual_folderAdd(item: ProjTreeItem) {

        const project = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        const curFolder = <VirtualFolderInfo>item.val.obj;

        const folderName = await vscode.window.showInputBox({
            placeHolder: 'Input a folder name',
            ignoreFocusOut: true,
            validateInput: (input) => {
                if (!this.vFolderNameMatcher.test(input)) {
                    return `must match '${this.vFolderNameMatcher.source}'`;
                }
            }
        });

        if (folderName) {
            project.getVirtualSourceManager().addFolder(folderName, curFolder.path);
        }
    }

    async Virtual_removeFolder(item: ProjTreeItem) {
        const project = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        const curFolder = <VirtualFolderInfo>item.val.obj;
        project.getVirtualSourceManager().removeFolder(curFolder.path);
    }

    async Virtual_renameFolder(item: ProjTreeItem) {

        const project = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        const curFolder = <VirtualFolderInfo>item.val.obj;

        const folderName = await vscode.window.showInputBox({
            prompt: 'Input the new name',
            ignoreFocusOut: true,
            value: curFolder.vFolder.name,
            validateInput: (input) => {
                if (!this.vFolderNameMatcher.test(input)) { return `must match '${this.vFolderNameMatcher.source}'`; }
                return undefined;
            }
        });

        if (folderName) {
            project.getVirtualSourceManager().renameFolder(curFolder.path, folderName);
        }
    }

    async Virtual_removeFile(item: ProjTreeItem) {
        const project = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        const curFile = <VirtualFileInfo>item.val.obj;
        project.getVirtualSourceManager().removeFile(curFile.path);
    }

    // filesystem folder

    async fs_folderAddFile(item: ProjTreeItem) {

        const folderPath = item.val.obj.path;

        const fName = await vscode.window.showInputBox({
            placeHolder: 'Input a file name',
            ignoreFocusOut: true
        });

        if (fName) {
            try {
                const filePath = folderPath + File.sep + fName;
                if (!File.IsFile(filePath)) { fs.writeFileSync(filePath, ''); }
            } catch (error) {
                GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
            }
        }
    }

    async fs_folderAdd(item: ProjTreeItem) {

        const folderPath = item.val.obj.path;

        const folderName = await vscode.window.showInputBox({
            placeHolder: 'Input a folder name',
            ignoreFocusOut: true
        });

        if (folderName) {
            try {
                fs.mkdirSync(folderPath + File.sep + folderName);
            } catch (error) {
                GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
            }
        }
    }

    async showDisassembly(uri: vscode.Uri) {

        const supportList = ['RISCV_GCC', 'GCC', 'AC5', 'AC6'];

        try {

            // check condition
            const activePrj = this.dataProvider.getActiveProject();
            if (!activePrj) { throw new Error('Not found active project !'); }
            const toolchainName = activePrj.getToolchain().name;
            if (!supportList.includes(toolchainName)) {
                throw new Error(`Only support '${supportList.join(',')}' compiler !`);
            }

            // parser ref json
            const srcPath = uri.fsPath;
            const refFile = File.fromArray([activePrj.ToAbsolutePath(activePrj.getOutputDir()), 'ref.json']);
            if (!refFile.IsFile()) { throw new Error(`Not found 'ref.json' at output folder, you need build project !`) }
            const ref = JSON.parse(refFile.Read());
            if (!ref[srcPath]) { throw new Error(`Not found any reference for this source file !`) }

            // get obj file
            let objPath: string | undefined;
            if (typeof ref[srcPath] == 'string') { objPath = <string>ref[srcPath]; }
            else if (Array.isArray(ref[srcPath])) { objPath = ref[srcPath][0]; }
            if (objPath == undefined) { throw new Error(`Not found any reference for this source file !`) }

            // prepare command
            let exeFile: File;
            let cmds: string[];

            switch (toolchainName) {
                case 'GCC':
                case 'RISCV_GCC':
                    {
                        const toolPrefix = toolchainName == 'GCC' ?
                            SettingManager.GetInstance().getGCCPrefix() :
                            SettingManager.GetInstance().getRiscvToolPrefix();
                        exeFile = File.fromArray([activePrj.getToolchain().getToolchainDir().path, 'bin', `${toolPrefix}objdump.exe`]);
                        if (!exeFile.IsFile()) { throw Error(`Not found '${exeFile.name}' !`) }
                        cmds = ['-S', objPath];
                    }
                    break;
                case 'AC5':
                case 'AC6':
                    {
                        exeFile = File.fromArray([activePrj.getToolchain().getToolchainDir().path, 'bin', `fromelf.exe`]);
                        if (!exeFile.IsFile()) { throw Error(`Not found '${exeFile.name}' !`) }
                        cmds = ['-c', objPath];
                    }
                    break;
                default:
                    throw new Error(`Only support '${supportList.join(',')}' compiler !`);
            }

            /* executable */
            const asmTxt = child_process.execFileSync(exeFile.path, cmds, { encoding: 'ascii' });
            const asmFile = `${srcPath}.edasm`;
            const asmFileUri = vscode.Uri.parse(VirtualDocument.instance().getUriByPath(asmFile));

            // try jump to target line in asm
            let selection: vscode.Range | undefined;
            if (vscode.window.activeTextEditor &&
                vscode.window.activeTextEditor.document.uri.toString() == uri.toString()) {
                const activeTextEditor = vscode.window.activeTextEditor;
                const doc = activeTextEditor.document;
                const lines = asmTxt.split(/\r\n|\n/);
                // search full line
                {
                    const tLine = doc.lineAt(activeTextEditor.selection.start.line).text.trim();
                    if (tLine.length >= 3) { // skip short lines
                        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
                            if (lines[lineIdx].includes(tLine)) {
                                const pos = new vscode.Position(lineIdx, 0);
                                selection = new vscode.Selection(pos, pos);
                                break;
                            }
                        }
                    }
                }
                // search word
                if (!selection) {
                    const rng = doc.getWordRangeAtPosition(activeTextEditor.selection.start, /[a-z_]\w*/i);
                    if (rng) {
                        const tWord = doc.getText(rng);
                        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
                            const idx = lines[lineIdx].indexOf(tWord);
                            if (idx != -1) {
                                const pos = new vscode.Position(lineIdx, idx);
                                selection = new vscode.Selection(pos, pos);
                                break;
                            }
                        }
                    }
                }
            }

            // show
            VirtualDocument.instance().updateDocument(asmFile, asmTxt);
            vscode.window.showTextDocument(asmFileUri, {
                preview: true,
                viewColumn: vscode.ViewColumn.Two,
                selection: selection
            });

        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
        }
    }

    async showCmsisConfigWizard(uri: vscode.Uri) {
        WebPanelManager.newInstance().showCmsisConfigWizard(uri);
    }

    async cppcheckFile(uri: vscode.Uri) {

        // !!! COMMING SOON !!!

        /* const path: any = SettingManager.GetInstance().getCppcheckerExe();
        if (!path) {
            const done = await ResInstaller.instance().setOrInstallTools('cppcheck', `Not found 'cppcheck.exe' !`);
            if (!done) { return; }
        }

        const exeFile = new File(path);
        if (!exeFile.IsFile()) {
            const done = await ResInstaller.instance().setOrInstallTools('cppcheck', `Not found 'cppcheck.exe' ! [path]: ${exeFile.path}`);
            if (!done) { return; }
        }

        const activePrj = this.dataProvider.getActiveProject();
        if (!activePrj) {
            GlobalEvent.emit('msg', newMessage('Warning', 'No actived project !'));
            return;
        }


        const cmds: string[] = [
            `${exeFile.path}`,
            `--enable=warning`,
            `--enable=performance`,
            `--enable=portability`
        ];

        runShellCommand('cppcheck-file', cmds.join(' ')); */
    }

    async cppcheckProject(item?: ProjTreeItem) {

        const path: any = SettingManager.GetInstance().getCppcheckerExe();
        if (!path) {
            await ResInstaller.instance().setOrInstallTools('cppcheck', `Not found 'cppcheck.exe' !`);
            return;
        }

        const exeFile = new File(path);
        if (!exeFile.IsFile()) {
            await ResInstaller.instance().setOrInstallTools('cppcheck', `Not found 'cppcheck.exe' ! [path]: ${exeFile.path}`);
            return;
        }

        const prj = this.getProjectByTreeItem(item);
        if (!prj) {
            GlobalEvent.emit('msg', newMessage('Warning', 'Not found project by this item !'));
            return;
        }

        const confTmpFile = File.fromArray([prj.getWsFile().dir, 'conf.cppcheck']);
        if (!confTmpFile.IsFile()) { /* if not found cppcheck conf template, create it ! */
            try {
                const tmpPath = ResManager.GetInstance().GetAppDataDir().path + File.sep + 'cppcheck.xml';
                fs.copyFileSync(tmpPath, confTmpFile.path);
            } catch (error) {
                GlobalEvent.emit('error', error);
                return;
            }
        }

        /* prepare cppcheck */
        const cmds: string[] = [];
        const confRootDir: File = File.fromArray([prj.ToAbsolutePath(prj.getOutputRoot()), '.cppcheck']);
        const confFile: File = File.fromArray([confRootDir.path, 'tmp.cppcheck']);
        confRootDir.CreateDir(true);
        let cppcheckConf: string = confTmpFile.Read();

        /* get project source info */
        const toolchain = prj.getToolchain();
        const prjConfig = prj.GetConfiguration();
        const depMerge = prjConfig.GetAllMergeDep();
        const builderOpts = prjConfig.compileConfigModel.getOptions(prj.getEideDir().path, prjConfig.config);
        const defMacros: string[] = ['__VSCODE_CPPTOOL']; /* it's for internal force include header */
        let defList: string[] = defMacros.concat(depMerge.defineList);
        depMerge.incList = ArrayDelRepetition(depMerge.incList.concat(prj.getSourceIncludeList()));
        const includeList: string[] = depMerge.incList.map((_path) => { return File.ToUnixPath(confRootDir.ToRelativePath(_path) || _path); });
        const intrHeader: string[] | undefined = toolchain.getForceIncludeHeaders();

        const getSourceList = (project: AbstractProject): string[] => {

            const srcList: string[] = [];
            const fGoups = project.getFileGroups();
            const srcFilter = AbstractProject.cppfileFilter;

            for (const group of fGoups) {
                // skip disabled group
                if (group.disabled) continue;
                for (const source of group.files) {
                    // skip disabled file
                    if (source.disabled) continue;
                    // skip non-source and asm file
                    if (!srcFilter.test(source.file.path)) continue;
                    const rePath = confRootDir.ToRelativePath(source.file.path, false);
                    srcList.push(rePath || source.file.path);
                }
            }

            return srcList;
        }

        /* set cppcheck conf */
        const is8bit = prjConfig.config.type == 'C51';
        const cfgList: string[] = ['gnu'];

        if (['Keil_C51'].includes(toolchain.name)) {
            GlobalEvent.emit('msg', newMessage('Warning', `We don't support cppcheck for ${toolchain.name} !`));
            return;
        }

        switch (toolchain.name) {
            case 'GCC':
                cfgList.push('armgcc');
                break;
            case 'RISCV_GCC':
                cfgList.push('riscv');
                break;
            default:
                defList = defList.concat(toolchain.getInternalDefines(builderOpts));
                break;
        }

        const fixedDefList = defList.map((str) => str.replace(/"/g, '&quot;'));

        cppcheckConf = cppcheckConf
            .replace('${cppcheck_build_folder}', 'build')
            .replace('${platform}', is8bit ? 'mcs51' : 'arm32-wchar_t2')
            .replace('${lib_list}', cfgList.map((str) => `<library>${str}</library>`).join(os.EOL + '\t\t'))
            .replace('${include_list}', includeList.map((str) => `<dir name="${str}/"/>`).join(os.EOL + '\t\t'))
            .replace('${macro_list}', fixedDefList.map((str) => `<define name="${str}"/>`).join(os.EOL + '\t\t'))
            .replace('${source_list}', getSourceList(prj).map((str) => `<dir name="${str}"/>`).join(os.EOL + '\t\t'));

        confFile.Write(cppcheckConf);

        /* make command */

        cmds.push(
            '-j', '4',
            `--error-exitcode=0`,
            `--report-progress`,
            `--enable=warning`,
            `--enable=performance`,
            `--enable=portability`,
            `--project=${confFile.path}`,
            `--relative-paths=${prj.getWsFile().dir}`
        );

        if (intrHeader && intrHeader.length > 0) {
            for (const path of intrHeader) {
                cmds.push(`--include=${path}`);
            }
        }

        /* launch process */

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Checking Project',
            cancellable: true
        }, (progress, cancel): Thenable<void> => {

            return new Promise((_resolve) => {

                let isResolved = false;
                const resolve = (data: any | undefined) => {
                    if (isResolved) return;
                    isResolved = true;
                    _resolve(data);
                };

                const process = new ExeCmd();
                const opts: ExecutableOption = {
                    encoding: 'utf8',
                    shell: ResManager.GetInstance().getCMDPath(),
                    env: append2SysEnv([exeFile.dir, `${exeFile.dir}${File.sep}cfg`])
                };

                // user want cancel operations
                cancel.onCancellationRequested(() => {
                    const pid = process.pid();
                    if (pid) { kill(pid); }
                });

                // user canceled, but process not launch, so we need
                // kill process after it launched
                process.on('launch', () => {
                    if (cancel.isCancellationRequested) {
                        const pid = process.pid();
                        if (pid) { kill(pid); }
                    }
                });

                // parse cppcheck progress
                // example: '29/37 files checked 96% done'
                const progMatcher = /^\d+\/\d+\s+files\s+checked\s+(\d+)%/i;
                let prev_prog: number = 0;
                process.on('line', (line) => {
                    const mRes = progMatcher.exec(line);
                    if (mRes && mRes.length > 1) {
                        const cur_prog = parseInt(mRes[1]);
                        progress.report({ message: line, increment: cur_prog - prev_prog });
                        prev_prog = cur_prog;
                    }
                    else if (line.startsWith('Checking') || line.startsWith('checking')) {
                        return; // ignore other progress info
                    }
                    else { // other msg ? output to panel
                        this.cppcheck_out.appendLine(line);
                    }
                });

                const pattern = {
                    "regexp": "^(.+):(\\d+):(\\d+):\\s+(\\w+):\\s+(.*)$",
                    "file": 1,
                    "line": 2,
                    "column": 3,
                    "severity": 4,
                    "message": 5
                };

                const toVscServerity = (str: string): vscode.DiagnosticSeverity => {
                    if (str.startsWith('err')) return vscode.DiagnosticSeverity.Error;
                    if (str.startsWith('warn')) return vscode.DiagnosticSeverity.Warning;
                    if (str == 'note' || str.startsWith('info')) return vscode.DiagnosticSeverity.Information;
                    return vscode.DiagnosticSeverity.Hint;
                };

                /* clear old diag and status */
                this.clearCppcheckDiagnostic();
                this.cppcheck_out.clear();

                const errMatcher = new RegExp(pattern.regexp, 'i');
                let diagnosticCnt: number = 0;
                process.on('errLine', (line) => {
                    // match gcc format error msg
                    const mRes = errMatcher.exec(line);
                    if (mRes && mRes.length > 5) {
                        diagnosticCnt += 1; /* increment cnt */
                        const fpath = prj.ToAbsolutePath(mRes[pattern.file]);
                        const uri = vscode.Uri.parse(File.ToUri(fpath));
                        const diags = Array.from(this.cppcheck_diag.get(uri) || []);
                        const line = parseInt(mRes[pattern.line]);
                        const col = parseInt(mRes[pattern.column]);
                        const pos = new vscode.Position(line - 1, col - 1);
                        diags.push(new vscode.Diagnostic(
                            new vscode.Range(pos, pos),
                            mRes[pattern.message],
                            toVscServerity(mRes[pattern.severity])
                        ));
                        this.cppcheck_diag.set(uri, diags);
                    }
                    // we not need log other cppcheck err msg
                });

                process.on('close', (exitInfo) => {
                    resolve(undefined);
                    if (cancel.isCancellationRequested == false) { // user not canceled 
                        if (exitInfo.code != 0) { // cppcheck launch failed
                            GlobalEvent.emit('msg', newMessage('Warning', 'Cppcheck launch failed, please check error msg on the output panel !'));
                            this.cppcheck_out.show();
                        }
                        else if (diagnosticCnt == 0) {
                            GlobalEvent.emit('msg', newMessage('Info', 'Cppcheck not found any problems !'));
                        }
                    }
                });

                process.on('error', (err) => {
                    GlobalEvent.emit('msg', ExceptionToMessage(err));
                });

                process.Run(exeFile.name, cmds, opts);
            });
        });
    }

    private install_lock: boolean = false;
    async installCMSISHeaders(item: ProjTreeItem) {

        if (this.install_lock) {
            GlobalEvent.emit('msg', newMessage('Warning', 'Operation is busy !'));
            return;
        }

        this.install_lock = true; // lock op

        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        if (prj) {
            try {
                prj.installCMSISHeaders();
            } catch (error) {
                GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
            }
        }

        this.install_lock = false; // unlock op
    }

    setActiveProject(item: ProjTreeItem) {
        this.dataProvider.setActiveProject(item.val.projectIndex);
    }

    async UninstallKeilPackage(item: ProjTreeItem) {

        if (this.installLocked) {
            GlobalEvent.emit('msg', newMessage('Warning', `Busy !, Please wait for the current operation to complete !`));
            return;
        }

        const result = await vscode.window.showInformationMessage(
            `Do you really want to uninstall this package: '${item.val.value}' ?`,
            'Yes', 'No'
        );

        try {
            if (result === 'Yes') {
                this.installLocked = true;
                await this.dataProvider.UninstallKeilPackage(item);
                GlobalEvent.emit('msg', newMessage('Info', `package '${<string>item.val.value}' has been uninstalled`));
            }
        } catch (error) {
            GlobalEvent.emit('error', error);
        }

        this.installLocked = false;
    }

    SetDevice(prjIndex: number) {
        this.dataProvider.SetDevice(prjIndex);
    }

    ModifyCompileConfig(item: ProjTreeItem) {
        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        prj.GetConfiguration().compileConfigModel.ShowModifyWindow(<string>item.val.key, prj.GetRootDir());
    }

    ModifyUploadConfig(item: ProjTreeItem) {
        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        const key = <string>item.val.key;
        prj.GetConfiguration().uploadConfigModel.ShowModifyWindow(key, prj.GetRootDir());
    }

    private updateSettingsView(prj: AbstractProject) {
        this.dataProvider.UpdateView(this.dataProvider.treeCache.getTreeItem(prj, TreeItemType.SETTINGS));
    }

    async ModifyOtherSettings(item: ProjTreeItem) {

        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        const key = <string>item.val.key;

        switch (key) {
            // output folder
            case 'outDir':
                {
                    const prjConfig = prj.GetConfiguration().config;
                    const oldFolderName = NodePath.normalize(prjConfig.outDir);

                    const newName = await vscode.window.showInputBox({
                        value: oldFolderName,
                        ignoreFocusOut: true,
                        validateInput: (input: string): string | undefined => {
                            return !/^[\w-]+$/.test(input) ? `not match RegExp: /^[\\w-]+$/` : undefined;
                        }
                    });

                    if (newName && newName !== oldFolderName) {
                        const oldFolder = new File(prj.ToAbsolutePath(prjConfig.outDir));
                        DeleteDir(oldFolder);
                        prjConfig.outDir = `.${File.sep}${newName}`;
                        this.updateSettingsView(prj);
                    }
                }
                break;
            // project name
            case 'name':
                {
                    const prjConfig = prj.GetConfiguration().config;

                    const newName = await vscode.window.showInputBox({
                        value: prjConfig.name,
                        ignoreFocusOut: true,
                        placeHolder: 'Input project name',
                        validateInput: (name) => AbstractProject.validateProjectName(name)
                    });

                    if (newName && newName !== prjConfig.name) {
                        prjConfig.name = newName; // update project name
                        this.dataProvider.UpdateView(); // udpate all view
                    }
                }
                break;
            // 'project.env'
            case 'project.env':
                {
                    vscode.window.showTextDocument(
                        vscode.Uri.parse(prj.getEnvFile().ToUri()), { preview: true });
                }
                break;
            default:
                break;
        }
    }

    async ImportSourceFromExtProject(item: ProjTreeItem) {

        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);

        try {
            //
            // select importer
            //
            const scriptRoot = File.fromArray([ResManager.GetInstance().GetBinDir().path, 'scripts']);
            const imptrFolder = File.fromArray([scriptRoot.path, 'importer']);
            const items: any[] = [];

            imptrFolder.GetList([/^(?:[^\.]+)\.(?:[^\.]+)\.js$/i])
                .forEach((imptrFile) => {
                    const m = /^(?<type>[^\.]+)\.(?<suffix>[^\.]+)\.js$/i.exec(imptrFile.name);
                    if (m && m.groups) {
                        items.push({
                            label: m.groups['type'].replace(/\-/g, ' ').replace(/_/g, ' '),
                            detail: `project file suffix: '${m.groups['suffix']}'`,
                            suffix: m.groups['suffix'],
                            file: imptrFile
                        });
                    }
                });

            const imptrType: any = await vscode.window.showQuickPick<vscode.QuickPickItem>(items, {
                placeHolder: `Select an importer`,
                canPickMany: false
            });

            if (imptrType == undefined) {
                return;
            }

            const filter: any = {};
            filter[<string>imptrType.label] = [imptrType.suffix];

            const uri = await vscode.window.showOpenDialog({
                openLabel: 'Import This File',
                canSelectFiles: true,
                filters: filter,
                defaultUri: vscode.Uri.file(prj.GetRootDir().path)
            });

            if (uri == undefined) {
                return;
            }

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Importing Resources`,
                cancellable: false
            }, async (progress, __) => {
                try {
                    //
                    // show progress message
                    //
                    progress.report({ message: `running importer ...` });
                    await new Promise((resolve) => {
                        setTimeout(() => resolve(), 500);
                    });

                    //
                    // run importer
                    //
                    const prjFile = new File(uri[0].fsPath);
                    const imptrName = (<File>imptrType.file).noSuffixName;
                    const cmds = ['--std', './importer/index.js', imptrName, prjFile.path];
                    const result = child_process
                        .execFileSync(`${scriptRoot.path}/qjs.exe`, cmds, { cwd: scriptRoot.path })
                        .toString();

                    let prjList: ImporterProjectInfo[];
                    try {
                        prjList = JSON.parse(result);
                        if (!Array.isArray(prjList)) throw new Error('project list must be an array !');
                    } catch (error) {
                        throw new Error(`Import Error !, msg: '${result}'`);
                    }

                    //
                    // select project
                    //
                    let prjInfo: ImporterProjectInfo | undefined;

                    if (prjList.length > 0) {
                        // if have multi project, select one to import
                        if (prjList.length > 1) {
                            const itemList = prjList.map((prj) => {
                                return {
                                    id: `${prj.name}-${prj.target}`,
                                    label: prj.name,
                                    description: prj.target,
                                    detail: `${prjFile.name} -> ${prj.name}${prj.target ? (': ' + prj.target) : ''}`
                                }
                            });
                            const selectedItem = await vscode.window.showQuickPick<any>(itemList,
                                {
                                    placeHolder: `Found ${prjList.length} sub project, select one to import`,
                                    ignoreFocusOut: true,
                                    canPickMany: false
                                }
                            );
                            if (item != undefined) {
                                const index = itemList.findIndex((item) => item.id == selectedItem.id);
                                if (index != -1) {
                                    prjInfo = prjList[index];
                                }
                            }
                        }
                        // if only have one, use it
                        else {
                            prjInfo = prjList[0];
                        }
                    }

                    if (prjInfo == undefined) {
                        return;
                    }

                    // make abs path to relative path
                    const formatVirtualFolder = (vFolderRoot: VirtualFolder) => {
                        const folderStack: VirtualFolder[] = [vFolderRoot];
                        while (folderStack.length > 0) {
                            const vFolder = folderStack.pop();
                            if (vFolder) {
                                vFolder.files = vFolder.files.map((file) => {
                                    return { path: prj.ToRelativePath(file.path) || file.path }
                                });
                                vFolder.folders.forEach((folder) => {
                                    folderStack.push(folder)
                                });
                            }
                        }
                    };

                    //
                    // start import project
                    //
                    const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
                    const prjConf = prj.GetConfiguration();
                    prjConf.config.virtualFolder = prjInfo.files;
                    formatVirtualFolder(prjConf.config.virtualFolder);
                    const deps = prjConf.CustomDep_getDependence();
                    deps.incList = prjInfo.incList;
                    deps.libList = [];
                    deps.defineList = prjInfo.defineList;

                    //
                    // notify update
                    //
                    prj.getVirtualSourceManager().load();
                    prjConf.CustomDep_NotifyChanged();

                    // show message and exit
                    progress.report({ message: `done !` });

                    await new Promise((resolve) => {
                        setTimeout(() => resolve(), 1000);
                    });

                } catch (error) {
                    GlobalEvent.emit('error', error);
                }
            });

        } catch (error) {
            GlobalEvent.emit('error', error);
        }
    }

    async AddIncludeDir(prjIndex: number) {
        const prj = this.dataProvider.GetProjectByIndex(prjIndex);
        const uri = await vscode.window.showOpenDialog({
            canSelectMany: true,
            canSelectFiles: false,
            canSelectFolders: true,
            openLabel: add_include_path,
            defaultUri: vscode.Uri.file(prj.GetRootDir().path)
        });
        if (uri && uri.length > 0) {
            prj.addIncludePaths(uri.map(_uri => { return _uri.fsPath; }));
        }
    }

    async AddDefine(prjIndex: number) {
        const prj = this.dataProvider.GetProjectByIndex(prjIndex);
        const str = await vscode.window.showInputBox({
            placeHolder: add_define,
            ignoreFocusOut: true,
            validateInput: (_val: string): string | undefined => {
                const val = _val.trim();
                if (val !== '') {
                    const defines = val.endsWith(';') ? val : (val + ';');
                    if (!/^(?:[a-zA-Z_][\w]*(?:=[^;=]+)?;)+$/.test(defines)) {
                        return 'Format error !';
                    }
                }
                return undefined;
            }
        });
        if (str && str.trim() !== '') {
            str.split(';')
                .filter((define) => { return define.trim() !== ''; })
                .forEach((define) => {
                    prj.GetConfiguration().CustomDep_AddDefine(define);
                });
        }
    }

    async AddLibDir(prjIndex: number) {
        const prj = this.dataProvider.GetProjectByIndex(prjIndex);
        const uri = await vscode.window.showOpenDialog({
            canSelectMany: true,
            canSelectFiles: false,
            canSelectFolders: true,
            openLabel: add_lib_path,
            defaultUri: vscode.Uri.file(prj.GetRootDir().path)
        });
        if (uri && uri.length > 0) {
            prj.GetConfiguration().CustomDep_AddAllFromLibList(uri.map(_uri => { return _uri.fsPath; }));
        }
    }

    async showIncludeDir(prjIndex: number) {

        const prj = this.dataProvider.GetProjectByIndex(prjIndex);
        let pickItems: vscode.QuickPickItem[] = [];
        const includesMap: Map<string, string> = new Map();

        // add dependence include paths
        prj.GetConfiguration().getAllDepGroup().forEach((group) => {
            for (const dep of group.depList) {
                for (const incPath of dep.incList) {
                    includesMap.set(prj.ToRelativePath(incPath, false) || incPath, group.groupName);
                }
            }
        });

        // add source include paths
        prj.getSourceIncludeList().forEach((incPath) => {
            includesMap.set(prj.ToRelativePath(incPath, false) || incPath, 'source');
        });

        for (const keyVal of includesMap) {
            pickItems.push({
                label: keyVal[0],
                description: keyVal[1]
            });
        }

        // sort result
        pickItems = pickItems.sort((i1, i2) => {
            if (i1.description && i2.description && i1.description != i2.description) {
                return i1.description.localeCompare(i2.description);
            } else {
                return i1.label.length - i2.label.length;
            }
        });

        const item = await vscode.window.showQuickPick(pickItems, {
            placeHolder: `${pickItems.length} results, click one copy to clipboard`
        });

        if (item) {
            vscode.env.clipboard.writeText(item.label);
        }
    }

    async showLibDir(prjIndex: number) {

        const prj = this.dataProvider.GetProjectByIndex(prjIndex);
        let pickItems: vscode.QuickPickItem[] = [];
        const libMaps: Map<string, string> = new Map();

        prj.GetConfiguration().getAllDepGroup().forEach((group) => {
            for (const dep of group.depList) {
                for (const libPath of dep.libList) {
                    libMaps.set(prj.ToRelativePath(libPath, false) || libPath, group.groupName);
                }
            }
        });

        for (const keyVal of libMaps) {
            pickItems.push({
                label: keyVal[0],
                description: keyVal[1]
            });
        }

        // sort result
        pickItems = pickItems.sort((i1, i2) => {
            if (i1.description && i2.description && i1.description != i2.description) {
                return i1.description.localeCompare(i2.description);
            } else {
                return i1.label.length - i2.label.length;
            }
        });

        const item = await vscode.window.showQuickPick(pickItems, {
            placeHolder: `${pickItems.length} results, click one copy to clipboard`
        });

        if (item) {
            vscode.env.clipboard.writeText(item.label);
        }
    }

    async showDefine(prjIndex: number) {

        const prj = this.dataProvider.GetProjectByIndex(prjIndex);
        let pickItems: vscode.QuickPickItem[] = [];
        const defineMaps: Map<string, string> = new Map();

        // add dependence macros
        prj.GetConfiguration().getAllDepGroup().forEach((group) => {
            for (const dep of group.depList) {
                for (const macro of dep.defineList) {
                    defineMaps.set(macro, group.groupName);
                }
            }
        });

        for (const keyVal of defineMaps) {
            pickItems.push({
                label: keyVal[0],
                description: keyVal[1]
            });
        }

        // sort result
        pickItems = pickItems.sort((i1, i2) => {
            if (i1.description && i2.description && i1.description != i2.description) {
                return i1.description.localeCompare(i2.description);
            } else {
                return i1.label.length - i2.label.length;
            }
        });

        const item = await vscode.window.showQuickPick(pickItems, {
            placeHolder: `${pickItems.length} results, click one copy to clipboard`
        });

        if (item) {
            vscode.env.clipboard.writeText(item.label);
        }
    }

    ExcludeSourceFile(item: ProjTreeItem) {

        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);

        // if it's a virtual file, we use virtual path
        if (item.type === TreeItemType.V_FILE_ITEM) {
            prj.excludeSourceFile((<VirtualFileInfo>item.val.obj).path);
        }

        // if it's a fs file, we use fs path
        else if (item.val.value instanceof File) {
            prj.excludeSourceFile(item.val.value.path);
        }
    }

    UnexcludeSourceFile(item: ProjTreeItem) {

        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);

        if (item.type === TreeItemType.V_EXCFILE_ITEM) {
            prj.unexcludeSourceFile((<VirtualFileInfo>item.val.obj).path);
        }
        else if (item.val.value instanceof File) {
            prj.unexcludeSourceFile(item.val.value.path);
        }
    }

    ExcludeFolder(item: ProjTreeItem) {

        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);

        switch (item.type) {
            // filesystem folder
            case TreeItemType.FOLDER:
            case TreeItemType.FOLDER_ROOT:
                prj.excludeFolder(item.val.obj.path);
                break;
            // virtual folder
            case TreeItemType.V_FOLDER:
            case TreeItemType.V_FOLDER_ROOT:
                prj.excludeFolder((<VirtualFolderInfo>item.val.obj).path);
                break;
            default:
                break;
        }
    }

    UnexcludeFolder(item: ProjTreeItem) {

        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);

        switch (item.type) {
            // filesystem folder
            case TreeItemType.EXCFOLDER:
                prj.unexcludeFolder(item.val.obj.path);
                break;
            // virtual folder
            case TreeItemType.V_EXCFOLDER:
                prj.unexcludeFolder((<VirtualFolderInfo>item.val.obj).path);
                break;
            default:
                break;
        }
    }

    async showFileInExplorer(item: ProjTreeItem) {

        let file: File | undefined;

        if (item.val.value instanceof File) { // if value is a file, use it
            file = new File(NodePath.normalize(item.val.value.path));
        }

        if (file) {
            vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(file.path));
        }
    }

    // KV: <ymlFileName, {vFolderPath: string, project: EideProject}>
    private prjFolderSourceChangesMap: Map<string, { vFolderPath: string, project: AbstractProject }> = new Map();
    async modifySourcesPath(item: ProjTreeItem) {

        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        const vSourceManager = prj.getVirtualSourceManager();

        // virtual file
        if (item.type === TreeItemType.V_FILE_ITEM ||
            item.type === TreeItemType.V_EXCFILE_ITEM) {

            const vInfo = <VirtualFileInfo>item.val.obj;
            const path = await vscode.window.showInputBox({
                value: vInfo.vFile.path,
                ignoreFocusOut: true,
                prompt: `Input a file path (allow relative path)`
            });

            if (path == undefined) {
                return;
            }

            const repath = prj.ToRelativePath(path) || path;
            const vFileInfo = vSourceManager.getFile(vInfo.path);
            if (vFileInfo) {
                vFileInfo.path = repath;
                const vDir = NodePath.dirname(vInfo.path);
                // we use 'notifyUpdateFolder', not 'notifyUpdateFile', 
                // because we need to update c/c++ intellisense config
                vSourceManager.notifyUpdateFolder(vDir);
            } else {
                GlobalEvent.emit('msg', newMessage('Error', `Internal error: can't get obj from virtual path: '${vInfo.path}'`));
            }
        }

        // virtual folder
        else if (item.type === TreeItemType.PROJECT ||
            item.type === TreeItemType.V_FOLDER ||
            item.type === TreeItemType.V_FOLDER_ROOT) {

            const vInfo = <VirtualFolderInfo>item.val.obj;
            const vFolderInfo = vSourceManager.getFolder(vInfo.path);
            if (vFolderInfo) {

                const getOldFileNameByProject = (vPath: string, prj: AbstractProject) => {
                    for (const KV of this.prjFolderSourceChangesMap) {
                        if (KV[1].vFolderPath == vPath &&
                            KV[1].project.getWsPath().toLowerCase() == prj.getWsPath().toLowerCase()) {
                            return KV[0];
                        }
                    }
                };

                let tmpFile: File;

                let oldName = getOldFileNameByProject(vInfo.path, prj);
                if (oldName) {
                    tmpFile = File.fromArray([os.tmpdir(), oldName]);
                } else { // if file not exist, add to mapper
                    tmpFile = File.fromArray([os.tmpdir(), `eide-vfolder-${Date.now()}.yaml`]);
                    this.prjFolderSourceChangesMap.set(tmpFile.name, { vFolderPath: vInfo.path, project: prj });
                }

                const yamlLines: string[] = [
                    `#`,
                    `# You can modify files path by editing and saving this file (allow relative path).`,
                    `#`,
                    ``,
                    yml.stringify(vFolderInfo.files, { indent: 4 })
                ];

                tmpFile.Write(yamlLines.join(os.EOL));
                vscode.window.showTextDocument(vscode.Uri.file(tmpFile.path), { preview: false });

            } else {
                GlobalEvent.emit('msg', newMessage('Error', `Internal error: can't get obj from virtual path: '${vInfo.path}'`));
            }
        }
    }

    // callbk, if config file saved, apply the changes
    private onFolderSourceYamlSaved(doc: vscode.TextDocument) {

        const tmpFileName = NodePath.basename(doc.fileName);
        const info = this.prjFolderSourceChangesMap.get(tmpFileName);

        // skip irrelevant files
        if (info == undefined) return;

        // save to config
        try {

            const vSrcManger = info.project.getVirtualSourceManager();
            const vFolderInfo = vSrcManger.getFolder(info.vFolderPath);
            if (!vFolderInfo) {
                throw new Error(`Virtual folder '${info.vFolderPath}' is not exist !`);
            }

            let fileList: VirtualFile[] = yml.parse(doc.getText());
            if (fileList != undefined && !Array.isArray(fileList)) {
                throw new Error(`Type error, files list must be an array, please check your yaml config file !`);
            }

            // convert to repath
            if (fileList) {
                fileList = fileList.map((vFile) => {
                    return {
                        path: info.project.ToRelativePath(vFile.path) || vFile.path
                    };
                });
            }

            vFolderInfo.files = fileList || [];
            vSrcManger.notifyUpdateFolder(info.vFolderPath);

        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
        }
    }

    // callbk, if config file closed, rm tmp file
    private onFolderSourceYamlClosed(doc: vscode.TextDocument) {

        // skip irrelevant files
        const tmpFileName = NodePath.basename(doc.fileName);
        if (!this.prjFolderSourceChangesMap.has(tmpFileName)) return;

        // do 
        try {
            this.prjFolderSourceChangesMap.delete(tmpFileName); // remove from mapper
            fs.unlinkSync(`${os.tmpdir()}/${tmpFileName}`);
        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Hidden'));
        }
    }

    CopyItemValue(item: ProjTreeItem) {
        if (item.val.value instanceof File) {
            vscode.env.clipboard.writeText(item.val.value.path);
        } else {
            vscode.env.clipboard.writeText(item.val.value);
        }
    }

    async showFilesOptions(item: ProjTreeItem) {
        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        const optFile = prj.getFilesOptionsFile();
        vscode.window.showTextDocument(vscode.Uri.parse(optFile.ToUri()), { preview: true });
    }

    // callbk, if config file saved, apply the changes
    private onCustomDepYamlSaved(doc: vscode.TextDocument) {

        const tmpFileName = NodePath.basename(doc.fileName);
        const prj = this.prjCusDepChangesMap.get(tmpFileName);

        // skip irrelevant files
        if (prj == undefined) return;

        // save to config
        try {

            const cusDep = prj.GetConfiguration().CustomDep_getDependence();
            const cfg = yml.parse(doc.getText());

            // inc list
            if (Array.isArray(cfg.IncludeFolders)) {
                const li = cfg.IncludeFolders
                    .filter((path: any) => typeof (path) == 'string')
                    .map((path: string) => prj.ToAbsolutePath(path));
                cusDep.incList = ArrayDelRepetition(li);
            } else {
                cusDep.incList = [];
            }

            // lib list
            if (Array.isArray(cfg.LibraryFolders)) {
                const li = cfg.LibraryFolders
                    .filter((path: any) => typeof (path) == 'string')
                    .map((path: string) => prj.ToAbsolutePath(path));
                cusDep.libList = ArrayDelRepetition(li);
            } else {
                cusDep.libList = [];
            }

            // macro list
            if (Array.isArray(cfg.Defines)) {
                const li = cfg.Defines
                    .filter((path: any) => typeof (path) == 'string');
                cusDep.defineList = ArrayDelRepetition(li);
            } else {
                cusDep.defineList = [];
            }

            prj.GetConfiguration().CustomDep_NotifyChanged();

        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
        }
    }

    // callbk, if config file closed, rm tmp file
    private onCustomDepYamlClosed(doc: vscode.TextDocument) {

        // skip irrelevant files
        const tmpFileName = NodePath.basename(doc.fileName);
        if (!this.prjCusDepChangesMap.has(tmpFileName)) return;

        // do 
        try {
            this.prjCusDepChangesMap.delete(tmpFileName); // remove from mapper
            fs.unlinkSync(`${os.tmpdir()}/${tmpFileName}`);
        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Hidden'));
        }
    }

    // KV: <ymlFileName, EideProject>
    private prjCusDepChangesMap: Map<string, AbstractProject> = new Map();
    async ModifyCustomDependence(item: ProjTreeItem) {

        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        const cusDep = prj.GetConfiguration().CustomDep_getDependence();

        // gen deps yaml content
        const yamlLines: string[] = [
            `#`,
            `# You can modify the configuration by editing and saving this file.`,
            `#`
        ];

        // fill data
        {
            // push include path
            yamlLines.push(
                ``,
                `# Header Include Path`,
                `IncludeFolders:`,
                `#   - ./Your/Include/Folder/Path`
            );
            cusDep.incList.forEach((path) => {
                yamlLines.push(`    - ${prj.ToRelativePath(path) || path}`)
            });

            // push lib folder path
            yamlLines.push(
                ``,
                `# Library Search Path`,
                `LibraryFolders:`,
                `#   - ./Your/Library/Path`
            );
            cusDep.libList.forEach((path) => {
                yamlLines.push(`    - ${prj.ToRelativePath(path) || path}`)
            });

            // push macros
            yamlLines.push(
                ``,
                `# Preprocessor Definitions`,
                `Defines:`,
                `#   - TEST=1`
            );
            cusDep.defineList.forEach((macro) => {
                yamlLines.push(`    - ${macro}`)
            });
        }

        const getTmpPathByProject = (prj: AbstractProject) => {
            for (const KV of this.prjCusDepChangesMap) {
                if (KV[1].getWsPath().toLowerCase() == prj.getWsPath().toLowerCase()) {
                    return KV[0];
                }
            }
        };

        // write and open file
        const yamlStr = yamlLines.join(os.EOL);
        const oldName = getTmpPathByProject(prj);
        let tmpFile: File;

        if (oldName) {
            tmpFile = File.fromArray([os.tmpdir(), oldName]);
        } else {// if file not exist, add to mapper
            tmpFile = File.fromArray([os.tmpdir(), `eide-deps-${Date.now()}.yaml`]);
            this.prjCusDepChangesMap.set(tmpFile.name, prj);
        }

        tmpFile.Write(yamlStr);
        vscode.window.showTextDocument(vscode.Uri.parse(tmpFile.ToUri()), { preview: false });
    }

    RemoveDependenceItem(item: ProjTreeItem) {
        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        switch ((<ModifiableDepInfo>item.val.obj).type) {
            case 'INC_ITEM':
                prj.GetConfiguration().CustomDep_RemoveIncDir(prj.ToAbsolutePath(<string>item.val.value));
                break;
            case 'DEFINE_ITEM':
                prj.GetConfiguration().CustomDep_RemoveDefine(<string>item.val.value);
                break;
            case 'LIB_ITEM':
                prj.GetConfiguration().CustomDep_RemoveLib(prj.ToAbsolutePath(<string>item.val.value));
                break;
            default:
                break;
        }
    }

    ImportPackageDependence(item: ProjTreeItem): void {
        let prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        try {
            prj.InstallComponent(<string>item.val.value);
        } catch (err) {
            GlobalEvent.emit('msg', {
                type: 'Warning',
                contentType: 'string',
                content: view_str$pack$install_component_failed
            });
            GlobalEvent.emit('msg', ExceptionToMessage(err, 'Hidden'));
        }
    }

    RemovePackageDependence(item: ProjTreeItem): void {
        let prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        try {
            prj.UninstallComponent(<string>item.val.value);
        } catch (err) {
            GlobalEvent.emit('msg', {
                type: 'Warning',
                contentType: 'string',
                content: view_str$pack$remove_component_failed
            });
            GlobalEvent.emit('msg', ExceptionToMessage(err, 'Hidden'));
        }
    }

    async onSwitchCompileTools(item: ProjTreeItem) {

        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        const toolchianManager = ToolchainManager.getInstance();
        const pickItems: any[] = [];

        for (const name of toolchianManager.getToolchainNameList(prj.GetConfiguration().config.type)) {
            pickItems.push({
                label: toolchianManager.getToolchainDesc(name),
                value: name,
                description: name
            });
        }

        const pItem = await vscode.window.showQuickPick(pickItems, {
            canPickMany: false,
            placeHolder: view_str$compile$selectToolchain,
        });

        if (pItem == undefined) return; /* user canceled */

        if (prj.getToolchain().name !== <ToolchainName>pItem.value) {
            prj.setToolchain(<ToolchainName>pItem.value);
        }
    }

    async switchUploader(item: ProjTreeItem) {

        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        const prjConfig = prj.GetConfiguration().config;

        const pickerItems: any[] = HexUploaderManager.getInstance()
            .getUploaderList(prjConfig.toolchain)
            .map<vscode.QuickPickItem>((item) => {
                return {
                    label: item.label || item.type,
                    uploader: item.type,
                    description: item.description
                };
            });

        const selection = await vscode.window.showQuickPick(pickerItems, {
            placeHolder: view_str$compile$selectFlasher
        });

        if (selection && selection.uploader !== prjConfig.uploader) {
            try {
                prj.setUploader(<HexUploaderType>selection.uploader);
            } catch (error) {
                GlobalEvent.emit('error', error);
            }
        }
    }

    private prev_click_info: ItemClickInfo | undefined = undefined;

    private async OnTreeItemClick(item: ProjTreeItem) {

        if (ProjTreeItem.isFileItem(item.type)) {

            const file = <File>item.val.value;
            const vsUri = vscode.Uri.parse(file.ToUri());
            let isPreview = true;

            if (this.prev_click_info &&
                this.prev_click_info.name === file.path &&
                this.prev_click_info.time + 260 > Date.now()) {
                isPreview = false;
            }

            // reset it
            this.prev_click_info = {
                name: file.path,
                time: Date.now()
            };

            try {

                // try to show it by eide, if failed, show it 
                // by vscode default api
                if (this.showBinaryFiles(file, isPreview)) return;

                /* We need use 'vscode.open' command, not 'showTextDocument' API, 
                 * because API can't open bin file */
                vscode.commands.executeCommand('vscode.open', vsUri, { preview: isPreview });

            } catch (error) {
                GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
            }
        }
    }

    private showBinaryFiles(binFile: File, isPreview?: boolean): boolean | undefined {

        try {

            const suffix = binFile.suffix.toLowerCase();

            // show armcc axf file
            if (suffix == '.axf') {

                const fromelf = File.fromArray([
                    SettingManager.GetInstance().getArmcc5Dir().path, 'bin', 'fromelf.exe'
                ]);

                if (!fromelf.IsFile()) return;

                const cont = child_process
                    .execFileSync(fromelf.path, ['--text', '-e', binFile.path])
                    .toString();

                const vDoc = VirtualDocument.instance();
                const docName = `${binFile.path}.info`;
                vDoc.updateDocument(docName, cont);

                const uri = vscode.Uri.parse(vDoc.getUriByPath(docName));
                vscode.window.showTextDocument(uri, { preview: isPreview });

                return true;
            }

            // show gnu elf file
            else if (suffix == '.elf') {

                const readelf = File.fromArray([
                    ResManager.GetInstance().getBuilderDir(), 'readelf.exe'
                ]);

                if (!readelf.IsFile()) return;

                const cont = child_process
                    .execFileSync(readelf.path, ['-e', binFile.path])
                    .toString();

                const vDoc = VirtualDocument.instance();
                const docName = `${binFile.path}.info`;
                vDoc.updateDocument(docName, cont);

                const uri = vscode.Uri.parse(vDoc.getUriByPath(docName));
                vscode.window.showTextDocument(uri, { preview: isPreview });

                return true;
            }

        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Hidden'));
        }
    }
}
