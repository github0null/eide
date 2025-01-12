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
import * as yaml from 'yaml';
import * as ini from 'ini';
import * as jsonc_parser from 'jsonc-parser';

import { File } from '../lib/node-utility/File';
import { ResManager } from './ResManager';
import { GlobalEvent } from './GlobalEvents';
import { AbstractProject, CheckError, DataChangeType, VirtualSource } from './EIDEProject';
import { ToolchainName, ToolchainManager } from './ToolchainManager';
import {
    BuilderOptions,
    CreateOptions, VirtualFolder, VirtualFile, ImportOptions,
    ProjectTargetInfo, ProjectConfigData, ProjectType, ProjectConfiguration, ProjectBaseApi, MAPPED_KEYS_IN_TARGET_INFO
} from './EIDETypeDefine';
import {
    PackInfo, ComponentFileItem, DeviceInfo,
    getComponentKeyDescription, ArmBaseCompileData, ArmBaseCompileConfigModel,
    RiscvCompileData, AnyGccCompileData
} from "./EIDEProjectModules";
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
    view_str$compile$selectToolchain, view_str$compile$selectFlasher, view_str$project$needRefresh, view_str$project$fileNotExisted,
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
    view_str$prompt$removeSrcDir,
    view_str$project$folder_type_virtual_desc,
    view_str$project$folder_type_fs_desc,
    view_str$msg$err_ewt_hash,
    view_str$msg$err_ept_hash,
    view_str$prompt$eclipse_imp_warning,
    view_str$prompt$need_reload_project,
    view_str$prompt$needReloadToUpdateEnv,
    getLocalLanguageType,
    LanguageIndexs,
    txt_yes,
    txt_no,
    remove_this_item,
} from './StringTable';
import { CodeBuilder, BuildOptions } from './CodeBuilder';
import { ExceptionToMessage, newMessage } from './Message';
import { SettingManager } from './SettingManager';
import { HexUploaderManager, HexUploaderType, JLinkOptions, JLinkProtocolType, OpenOCDFlashOptions, PyOCDFlashOptions } from './HexUploader';
import { SevenZipper, CompressOption } from './Compress';
import { DependenceManager } from './DependenceManager';
import { ArrayDelRepetition } from '../lib/node-utility/Utility';
import {
    copyObject, downloadFileWithProgress,
    runShellCommand, redirectHost, readGithubRepoFolder, FileCache,
    genGithubHash, md5, toArray, newMarkdownString, newFileTooltipString, FileTooltipInfo, escapeXml,
    readGithubRepoTxtFile, downloadFile, notifyReloadWindow, formatPath, execInternalCommand,
    copyAndMakeObjectKeysToLowerCase,
    sortPaths,
    getGccBinutilsVersion,
    compareVersion,
    getGccSystemSearchList,
    openocd_getConfigList,
    pyocd_getTargetList,
    generateDotnetProgramCmd
} from './utility';
import { concatSystemEnvPath, DeleteDir, exeSuffix, kill, osType, DeleteAllChildren, userhome } from './Platform';
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
import * as eclipseParser from './EclipseProjectParser';
import { isArray } from 'util';
import { parseIarCompilerLog, CompilerDiagnostics, parseGccCompilerLog, parseArmccCompilerLog, parseKeilc51CompilerLog, parseSdccCompilerLog, parseCosmicStm8CompilerLog } from './ProblemMatcher';
import * as iarParser from './IarProjectParser';
import * as ArmCpuUtils from './ArmCpuUtils';
import { ShellFlasherIndexItem } from './WebInterface/WebInterface';
import { jsonc } from 'jsonc';
import { SimpleUIConfig, SimpleUIConfigData_input, SimpleUIConfigData_options, SimpleUIConfigData_text, SimpleUIConfigData_table, SimpleUIConfigData_boolean } from "./SimpleUIDef";
import { StatusBarManager } from './StatusBarManager';

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

function getTreeItemTypeName(typ: TreeItemType): string {
    return TreeItemType[typ];
}

type GroupRegion = 'PACK' | 'Components' | 'ComponentItem';

interface TreeItemValue {
    label?: string;         // UI item label, if it's null, item label is '${keyAlias || key} : ${value}' or '${value}'
    key?: string;           // key name will be show in label
    keyAlias?: string;      // key's alias name will be show in label
    value: string | File;   // if TreeItem refer to a file, the value type must be 'File'
    isVirtualFile?: boolean;
    contextVal?: string;
    tooltip?: string | vscode.MarkdownString;
    icon?: string;
    obj?: any;
    childKey?: string;
    child?: string[];
    projectIndex: number;
    groupRegion?: GroupRegion;
    collapsibleState?: vscode.TreeItemCollapsibleState;
    otherCtx?: { [key: string]: string | boolean | number; };
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
                // case 'sourceList':
                //     this.type = 'SOURCE_GROUP';
                //     break;
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

    static PROJ_ROOT_ITEM_TYPES = [
        TreeItemType.PROJECT,
        TreeItemType.PACK,
        TreeItemType.COMPILE_CONFIGURATION,
        TreeItemType.UPLOAD_OPTION,
        TreeItemType.DEPENDENCE,
        TreeItemType.SETTINGS,
    ];

    type: TreeItemType;
    val: TreeItemValue;

    constructor(type: TreeItemType, val: TreeItemValue, prjUid?: string) {

        super('', vscode.TreeItemCollapsibleState.None);

        if (val.value instanceof File) {
            this.label = val.value.name;
        } else {
            const name = val.keyAlias || val.key;
            this.label = name ? `${name} : ${val.value}` : val.value;
        }

        if (val.label) {
            this.label = val.label;
        }

        // setup unique id
        if (prjUid) {
            // tree root's id is project uid
            if (type == TreeItemType.SOLUTION) {
                this.id = prjUid;
            }
            // tree sub item's id is their type
            else if (ProjTreeItem.PROJ_ROOT_ITEM_TYPES.includes(type)) {
                this.id = `${prjUid}:${TreeItemType[type]}`;
            }
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

    public static isVirtualFolderItem(type: TreeItemType): boolean {
        return TreeItemType[type].startsWith('V_FOLDER');
    }

    private GetTooltip(): string | vscode.MarkdownString {

        if (this.val.tooltip) {
            return this.val.tooltip;
        }

        if (this.val.value instanceof File) {
            return this.val.value.path;
        } else if (ProjTreeItem.isItem(this.type)) {
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
                if (this.val.otherCtx && this.val.otherCtx['hasExtraArgs']) {
                    name = 'file_type_c_configured.svg';
                } else {
                    name = 'file_type_c.svg';
                }
                break;
            case '.h':
                name = 'file_type_cheader.svg';
                break;
            case '.cpp':
            case '.cc':
            case '.cxx':
            case '.c++':
                if (this.val.otherCtx && this.val.otherCtx['hasExtraArgs']) {
                    name = 'file_type_cpp_configured.svg';
                } else {
                    name = 'file_type_cpp.svg';
                }
                break;
            case '.hpp':
            case '.hxx':
            case '.inc':
                name = 'file_type_cppheader.svg';
                break;
            case '.s':
            case '.asm':
            case '.a51':
                if (this.val.otherCtx && this.val.otherCtx['hasExtraArgs']) {
                    name = 'AssemblerSourceFile_configured_16x.svg';
                } else {
                    name = 'AssemblerSourceFile_16x.svg';
                }
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
            case '.sm8':
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
                if (this.val.otherCtx && this.val.otherCtx['hasExtraArgs']) {
                    name = 'folder_type_config.svg';
                } else {
                    name = 'Folder_32x.svg';
                }
                break;
            case TreeItemType.FOLDER_ROOT:
                if (this.val.otherCtx && this.val.otherCtx['hasExtraArgs']) {
                    name = 'FolderRoot_configured_32x.svg';
                } else {
                    name = 'FolderRoot_32x.svg';
                }
                break;
            case TreeItemType.V_FOLDER:
            case TreeItemType.V_FOLDER_ROOT:
                if (this.val.otherCtx && this.val.otherCtx['hasExtraArgs']) {
                    name = 'folder_type_config.svg';
                } else {
                    name = 'folder_virtual.svg';
                }
                break;
            case TreeItemType.COMPONENT_GROUP:
                name = 'Component_16x.svg';
                break;
            case TreeItemType.PACK_GROUP:
                name = 'Cube_16x.svg';
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
            case TreeItemType.PACK: // only for cpu pakage, not cmsis package
                name = 'CPU_16x.svg';
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

    clear() {
        this.itemCache.clear();
    }

    getRootTreeItem(prj: AbstractProject): ProjTreeItem | undefined {
        const cache = this.itemCache.get(prj.getWsPath());
        if (cache) {
            return cache.root;
        }
    }

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

class ProjectDataProvider implements vscode.TreeDataProvider<ProjTreeItem>, vscode.TreeDragAndDropController<ProjTreeItem> {

    private static readonly recName = 'sln.record';
    private static readonly RecMaxNum = 50;

    private event: events.EventEmitter;
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

        this.event = new events.EventEmitter();
        this.context = _context;
        this.dataChangedEvent = new vscode.EventEmitter<ProjTreeItem>();
        this.context.subscriptions.push(this.dataChangedEvent);
        this.onDidChangeTreeData = this.dataChangedEvent.event;
        this.recFile = File.fromArray([ResManager.GetInstance().getEideHomeFolder().path, ProjectDataProvider.recName]);
        this.loadRecord();
    }

    onDispose() {
        this.SaveAll();
        this.CloseAll();
        this.saveRecord();
    }

    public on(event: 'rootItems_inited', listener: () => void): void;
    public on(event: any, listener: (arg?: any) => void): void {
        this.event.on(event, listener);
    }

    //---------------------------------------
    // TreeDragAndDropController
    //---------------------------------------

    static readonly PROJECT_TREE_ITEM_MIME_ID: string = `application/vnd.code.tree.cl.eide.view.projects`;

    readonly dragMimeTypes: string[] = [
        ProjectDataProvider.PROJECT_TREE_ITEM_MIME_ID
    ];

    readonly dropMimeTypes: string[] = [
        ProjectDataProvider.PROJECT_TREE_ITEM_MIME_ID,
        'text/uri-list'
    ];

    handleDrag(source: readonly ProjTreeItem[], dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Thenable<void> | void {

        console.log('[cl.eide] handleDrag');
        console.log(source);

        const fList: File[] = [];

        for (const treeItem of source) {
            if (ProjTreeItem.isFileItem(treeItem.type) &&
                treeItem.val.value instanceof File) {
                fList.push(treeItem.val.value);
            }
        }

        if (fList.length > 0) {
            const val = fList.map(f => vscode.Uri.file(f.path).toString()).join('\r\n');
            dataTransfer.set('text/uri-list', new vscode.DataTransferItem(val));
        }
    }

    handleDrop(target: ProjTreeItem | undefined, dataTransfer: vscode.DataTransfer, token: vscode.CancellationToken): Thenable<void> | void {

        console.log('[cl.eide] handleDrop');

        if (target == undefined)
            return;

        console.log(target);

        if (!ProjTreeItem.isVirtualFolderItem(target.type) && target.type != TreeItemType.PROJECT) {
            console.log(`[cl.eide] 'target' is not a virtual folder`);
            return; // it's not a virtual folder
        }

        const targetProject = this.GetProjectByIndex(target.val.projectIndex);
        const targetProjectUid = targetProject.getUid();
        const targetVirtualFolder = <VirtualFolderInfo>target.val.obj;

        let dataTransferItem: vscode.DataTransferItem | undefined;

        // DataTransferItem struct:
        //   data:{ value: '{"id":"cl.eide.view.projects","itemHandles":[0/…3b0d9bcc1193787cc:PROJECT/0:user/0:dlink.h"]}' }
        dataTransferItem = dataTransfer.get(ProjectDataProvider.PROJECT_TREE_ITEM_MIME_ID);
        if (dataTransferItem) {

            const vPaths = (<string[]>JSON.parse(dataTransferItem.value)['itemHandles'])
                .filter(s => s.includes(`${targetProjectUid}:PROJECT/`))
                .map(s => s.replace(/^.+?:PROJECT\//, `${VirtualSource.rootName}/`).replace(/\d+:/g, ''));

            console.log(`[cl.eide] try drop file items '[ ${vPaths.join(', ')} ]' -> '${targetVirtualFolder.path}/'`);

            const vSourceManager = targetProject.getVirtualSourceManager();

            for (const vpath of vPaths) {

                // if it is itself, ignore
                if (vpath == targetVirtualFolder.path) {
                    console.log(`[cl.eide] '${vpath}' -> '${targetVirtualFolder.path}/' it is itself, ignore`);
                    continue;
                }

                // it's a file ?
                const vf = vSourceManager.getFile(vpath);
                if (vf) {
                    const nf = vSourceManager.addFile(targetVirtualFolder.path, vf.path);
                    if (nf) { // moved done, del old
                        vSourceManager.removeFile(vpath);
                        console.log(`[cl.eide] '${vpath}' -> '${targetVirtualFolder.path}/' moved done`);
                    }
                    continue;
                }

                // it's a folder ?
                const vd = vSourceManager.getFolder(vpath);
                if (vd && !File.isSubPathOf(vpath, targetVirtualFolder.path)) { // can't move parent into their child
                    const npath = vSourceManager.insertFolder(targetVirtualFolder.path, vd);
                    if (npath) { // moved done, del old
                        vSourceManager.removeFolder(vpath);
                        console.log(`[cl.eide] '${vpath}' -> '${targetVirtualFolder.path}/' moved done`);
                    }
                    continue;
                }
            }

            return;
        }

        // DataTransferItem struct:
        //  data:{ value: 'file:///c%3A/xx/xxx.c\r\nfile:///xxx/xxx/m.c' }
        dataTransferItem = dataTransfer.get('text/uri-list');
        if (dataTransferItem) {
            const fileList: string[] = (<string>dataTransferItem.value).split(/\r\n|\n/).map(s => vscode.Uri.parse(s).fsPath);
            console.log(`[cl.eide] drop files: { ${fileList.join(',')} }`);
            targetProject.getVirtualSourceManager().addFiles(targetVirtualFolder.path, fileList);
            return;
        }
    }

    // ------------------------------------------

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

        prj.Save(false, 1000); // save project file with a delay
    }

    private toLowercaseEIDEFolder(wsFolder: File) {

        if (wsFolder.IsDir()) {

            // rename eide folder name
            const folderList = wsFolder.GetList(File.EXCLUDE_ALL_FILTER, [/^\.EIDE$/]);
            if (folderList.length > 0) {
                const oldEideFolder = folderList[0];
                fs.renameSync(oldEideFolder.path, `${oldEideFolder.dir}${File.sep}${AbstractProject.EIDE_DIR}`);
            }

            // rename eide conf file
            const eideFolder = File.fromArray([wsFolder.path, AbstractProject.EIDE_DIR]);
            if (eideFolder.IsDir()) {
                const fList = eideFolder.GetList([/^EIDE\.json$/], File.EXCLUDE_ALL_FILTER);
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
        if (workspaceManager.getWorkspaceRoot() === undefined) {
            return;
        }

        const wsFolders = workspaceManager.getWorkspaceList();
        const validList: File[] = [];

        for (const wsDir of wsFolders) {
            const wsList = wsDir.GetList([/.code-workspace$/i], File.EXCLUDE_ALL_FILTER);
            if (wsList.length > 0) {

                // convert .EIDE to .eide
                this.toLowercaseEIDEFolder(wsDir);

                const eideConfigFile = File.fromArray([wsDir.path, AbstractProject.EIDE_DIR, AbstractProject.prjConfigName]);
                if (eideConfigFile.IsFile()) {
                    validList.push(wsList[0]);
                }
            }
        }

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
    }

    GetProjectByIndex(index: number): AbstractProject {
        return this.prjList[index];
    }

    getProjectByUid(uid: string): AbstractProject | undefined {
        const idx = this.getIndexByProjectUid(uid);
        if (idx != -1) {
            return this.GetProjectByIndex(idx);
        }
    }

    getIndexByProjectUid(uid: string): number {
        return this.prjList.findIndex(prj => prj.getUid() == uid);
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

        // update treeview ui
        this.dataChangedEvent.fire(ele);

        // whole treeview updated
        this.updateStatusBarForActiveProjects();
    }

    updateStatusBarForActiveProjects() {

        const statusbars = StatusBarManager.getInstance();

        statusbars.foreach((bar, name) => {

            const activeProj = this.getActiveProject();

            if (name == 'project') {
                bar.text = `EIDE Project: ${activeProj?.getCurrentTarget() || 'unspecified'}`;
                if (activeProj) {
                    let txt = `Switch target for eide project:`;
                    txt += `${os.EOL}  - path: \`${activeProj.getProjectRoot().path}\``;
                    bar.tooltip = new vscode.MarkdownString(txt);
                } else {
                    bar.tooltip = `Switch target for eide project`;
                }
            }

            else if (name == 'build') {
                bar.text = `$(tools) Build`;
                if (activeProj) {
                    let txt = `Build eide project:`;
                    let repath = activeProj.ToRelativePath(activeProj.getExecutablePath());
                    txt += `${os.EOL}  - output: \`${repath}\``;
                    bar.tooltip = new vscode.MarkdownString(txt);
                } else {
                    bar.tooltip = `Build eide project`;
                }
            }

            else if (name == 'flash') {
                bar.text = '$(arrow-down) Flash';
                if (activeProj) {
                    try {
                        const flasher = HexUploaderManager.getInstance().createUploader(activeProj);
                        let txt = `Upload binary file to device:`;
                        flasher.getAllProgramFiles().forEach(f => {
                            let repath = activeProj.ToRelativePath(f.path) || f.path;
                            txt += `${os.EOL}  - \`${repath}\``
                        });
                        bar.tooltip = new vscode.MarkdownString(txt);
                    } catch (error) {
                        bar.tooltip = `Upload binary file to device`;
                        GlobalEvent.log_error(error);
                    }
                } else {
                    bar.tooltip = `Upload binary file to device`;
                }
            }
        });
    }

    clearTreeViewCache() {
        this.treeCache.clear();
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

        const index = this.prjList.findIndex((prj) => prj.getWsPath() == this.activePrjPath);
        if (index != -1) {
            return this.prjList[index];
        }
    }

    getParent(element: ProjTreeItem): vscode.ProviderResult<ProjTreeItem> {

        if (element.type == TreeItemType.SOLUTION)
            return undefined;

        if (ProjTreeItem.PROJ_ROOT_ITEM_TYPES.includes(element.type))
            return this.treeCache.getRootTreeItem(this.GetProjectByIndex(element.val.projectIndex));

        /* 除了几个根节点之外，其他的忽略，getParent 主要用于 {@link TreeView.reveal reveal} API. */
        return undefined;
    }

    getTreeItem(element: ProjTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: ProjTreeItem | undefined): vscode.ProviderResult<ProjTreeItem[]> {

        let iList: ProjTreeItem[] = [];

        if (element === undefined) {

            this.prjList.forEach((project, projectIndex) => {

                // --- init root Treeitem

                const isActived = this.activePrjPath === project.getWsPath();
                const cItem = new ProjTreeItem(TreeItemType.SOLUTION, {
                    value: project.getProjectName() + ' : ' + project.getProjectCurrentTargetName(),
                    projectIndex: projectIndex,
                    icon: this.prjList.length > 1 ? (isActived ? 'active.svg' : 'idle.svg') : undefined,
                    tooltip: new vscode.MarkdownString([
                        `**Name:** \`${project.getProjectName()}\``,
                        `- **Uid:** \`${project.getUid()}\``,
                        `- **Config:** \`${project.getProjectCurrentTargetName()}\``,
                        `- **Path:** \`${project.GetRootDir().path}\``
                    ].join(os.EOL)),
                }, project.getUid());

                iList.push(cItem);
                // cache project root item
                this.treeCache.setTreeItem(project, cItem, true);

                // --- pre-init primary TreeItems

                const primaryItems: ProjTreeItem[] = [];

                primaryItems.push(new ProjTreeItem(TreeItemType.PROJECT, {
                    value: view_str$project$title,
                    projectIndex: projectIndex,
                    tooltip: view_str$project$title,
                    obj: <VirtualFolderInfo>{ path: VirtualSource.rootName, vFolder: project.getVirtualSourceRoot() }
                }, project.getUid()));

                if (project.getProjectType() === 'ARM') { // only display for ARM project 
                    primaryItems.push(new ProjTreeItem(TreeItemType.PACK, {
                        value: pack_info,
                        projectIndex: projectIndex,
                        tooltip: pack_info
                    }, project.getUid()));
                }

                const toolchain = project.getToolchain();
                const toolprefix = toolchain.getToolchainPrefix ? toolchain.getToolchainPrefix() : undefined;
                primaryItems.push(new ProjTreeItem(TreeItemType.COMPILE_CONFIGURATION, {
                    value: `${compile_config} : ${toolchain.name}`,
                    projectIndex: projectIndex,
                    tooltip: newMarkdownString([
                        `${compile_config} : ${toolchain.name}`,
                        ` - **Id:** \`${toolchain.name}\``,
                        ` - **Prefix:** ` + (toolprefix ? `\`${toolprefix}\`` : ''),
                        ` - **Family:** \`${toolchain.categoryName}\``,
                        ` - **Description:** \`${ToolchainManager.getInstance().getToolchainDesc(toolchain.name)}\``,
                    ])
                }, project.getUid()));

                const curUploader = project.GetConfiguration().uploadConfigModel.uploader;
                const uploaderLabel = HexUploaderManager.getInstance().getUploaderLabelByName(curUploader);
                primaryItems.push(new ProjTreeItem(TreeItemType.UPLOAD_OPTION, {
                    value: `${uploadConfig_desc} : ${uploaderLabel}`,
                    projectIndex: projectIndex,
                    contextVal: curUploader == 'Custom' ? `${getTreeItemTypeName(TreeItemType.UPLOAD_OPTION)}_Shell` : undefined,
                    tooltip: `${uploadConfig_desc} : ${uploaderLabel}`
                }, project.getUid()));

                primaryItems.push(new ProjTreeItem(TreeItemType.DEPENDENCE, {
                    value: project_dependence,
                    projectIndex: projectIndex,
                    tooltip: project_dependence
                }, project.getUid()));

                primaryItems.push(new ProjTreeItem(TreeItemType.SETTINGS, {
                    value: view_str$project$other_settings,
                    projectIndex: projectIndex,
                    tooltip: view_str$project$other_settings
                }, project.getUid()));

                // cache primary views
                primaryItems.forEach(item => this.treeCache.setTreeItem(project, item));
            });

            // --- notify primary items all inited
            setTimeout(() => this.event.emit('rootItems_inited'), 300);

        } else {

            const project = this.prjList[element.val.projectIndex];
            const prjExtraArgs = project.getSourceExtraArgsCfg();

            switch (element.type) {
                case TreeItemType.SOLUTION:
                    {
                        const itemTypes: TreeItemType[] = [
                            TreeItemType.PROJECT,
                            TreeItemType.PACK,
                            TreeItemType.COMPILE_CONFIGURATION,
                            TreeItemType.UPLOAD_OPTION,
                            TreeItemType.DEPENDENCE,
                            TreeItemType.SETTINGS,
                        ];

                        for (const itemType of itemTypes) {
                            const item = this.treeCache.getTreeItem(project, itemType);
                            if (item) {
                                iList.push(item);
                            }
                        }
                    }
                    break;
                case TreeItemType.PROJECT:
                    {
                        // add some specific folder to first
                        const _depsFolder = project
                            .getVirtualSourceManager()
                            .getFolder(`${VirtualSource.rootName}/${DependenceManager.DEPS_VFOLDER_NAME}`);
                        if (_depsFolder && (_depsFolder.files.length + _depsFolder.folders.length) > 0) {
                            const folderDispName = view_str$project$cmsis_components;
                            const itemType = TreeItemType.V_FOLDER_ROOT;
                            const vFolderPath = `${VirtualSource.rootName}/${_depsFolder.name}`;
                            const hasExtraArgs = project.hasExtraArgsForFolder(vFolderPath, prjExtraArgs, true);
                            iList.push(new ProjTreeItem(itemType, {
                                value: folderDispName,
                                obj: <VirtualFolderInfo>{ path: vFolderPath, vFolder: _depsFolder },
                                projectIndex: element.val.projectIndex,
                                otherCtx: { hasExtraArgs: hasExtraArgs },
                                contextVal: 'FOLDER_ROOT_DEPS',
                                icon: 'DependencyGraph_16x.svg',
                                tooltip: newFileTooltipString({
                                    name: folderDispName,
                                    path: vFolderPath,
                                    desc: undefined,
                                    attr: {
                                        'SubFiles': _depsFolder.files.length.toString(),
                                        'SubFolders': _depsFolder.folders.length.toString()
                                    }
                                })
                            }));
                        }

                        // push filesystem source folder
                        project.getSourceRootFolders()
                            .sort((folder_1, folder_2) => { return folder_1.displayName.localeCompare(folder_2.displayName); })
                            .forEach((rootInfo) => {
                                const folderDispName = rootInfo.displayName;
                                const isExisted = rootInfo.fileWatcher.file.IsDir();
                                let dirIcon: string | undefined;
                                if (rootInfo.needUpdate || !isExisted) dirIcon = 'StatusWarning_16x.svg';
                                let dirDesc: string | undefined;
                                if (rootInfo.needUpdate) dirDesc = view_str$project$needRefresh;
                                if (!isExisted) dirDesc = view_str$project$fileNotExisted;
                                const hasExtraArgs = project.hasExtraArgsForFolder(rootInfo.fileWatcher.file.path, prjExtraArgs);
                                iList.push(new ProjTreeItem(TreeItemType.FOLDER_ROOT, {
                                    value: folderDispName,
                                    obj: rootInfo.fileWatcher.file,
                                    projectIndex: element.val.projectIndex,
                                    icon: dirIcon,
                                    otherCtx: { hasExtraArgs: hasExtraArgs },
                                    tooltip: newFileTooltipString({
                                        name: rootInfo.displayName,
                                        path: rootInfo.fileWatcher.file.path,
                                        desc: dirDesc,
                                        attr: {}
                                    }, project.getRootDir())
                                }));
                            });

                        // push virtual source folder
                        project.getVirtualSourceRoot().folders
                            .sort((folder1, folder2) => { return folder1.name.localeCompare(folder2.name); })
                            .forEach((vFolder) => {
                                if (vFolder.name == DependenceManager.DEPS_VFOLDER_NAME) return; // skip <deps> folder
                                const vFolderPath = `${VirtualSource.rootName}/${vFolder.name}`;
                                const isExcluded = project.isExcluded(vFolderPath);
                                const itemType = isExcluded ? TreeItemType.V_EXCFOLDER : TreeItemType.V_FOLDER_ROOT;
                                const hasExtraArgs = project.hasExtraArgsForFolder(vFolderPath, prjExtraArgs, true);
                                iList.push(new ProjTreeItem(itemType, {
                                    value: vFolder.name,
                                    obj: <VirtualFolderInfo>{ path: vFolderPath, vFolder: vFolder },
                                    projectIndex: element.val.projectIndex,
                                    otherCtx: { hasExtraArgs: hasExtraArgs },
                                    tooltip: newFileTooltipString({
                                        name: vFolder.name,
                                        path: vFolderPath,
                                        desc: isExcluded ? view_str$project$excludeFolder : undefined,
                                        attr: {
                                            'SubFiles': vFolder.files.length.toString(),
                                            'SubFolders': vFolder.folders.length.toString()
                                        }
                                    })
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
                                const hasExtraArgs = project.hasExtraArgsForFile(file.path, vFilePath, prjExtraArgs);
                                iList.push(new ProjTreeItem(itemType, {
                                    value: file,
                                    collapsibleState: project.getSourceRefs(file).length > 0 ?
                                        vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                                    obj: <VirtualFileInfo>{ path: vFilePath, vFile: vFile },
                                    projectIndex: element.val.projectIndex,
                                    otherCtx: { hasExtraArgs: hasExtraArgs },
                                    tooltip: newFileTooltipString({
                                        name: file.name,
                                        path: file.path,
                                        desc: isFileExcluded ? view_str$project$excludeFile : undefined,
                                        attr: {
                                            'VirtualPath': vFilePath
                                        }
                                    }, project.getRootDir()),
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
                                let uiContext: string | undefined;
                                // 为 "链接器脚本文件" 增加一个可以打开文件的小按钮
                                if (/\b(linkerScript|scatterFile)/.test(key)) {
                                    uiContext = 'COMPILE_CONFIGURATION_ITEM_FILEPATH';
                                }
                                iList.push(new ProjTreeItem(TreeItemType.COMPILE_CONFIGURATION_ITEM, {
                                    key: key,
                                    keyAlias: cConfig.GetKeyDescription(key),
                                    value: cConfig.getKeyValue(key),
                                    tooltip: newMarkdownString([
                                        `${cConfig.GetKeyDescription(key)}`,
                                        `- **Value:** \`${cConfig.getKeyValue(key)}\``]),
                                    icon: cConfig.getKeyIcon(key),
                                    projectIndex: element.val.projectIndex,
                                    contextVal: uiContext
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
                                        keyAlias: model.GetKeyDescription(key),
                                        value: model.getKeyValue(key),
                                        tooltip: newMarkdownString([
                                            `${model.GetKeyDescription(key)}`,
                                            `- **Value:** \`${model.getKeyValue(key)}\``]),
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

                            let depValues: string[] = (<any>customDep)[key];

                            if (key == 'incList' || key == 'libList') { // is path list ?
                                depValues = sortPaths(depValues.map((val) => project.toRelativePath(val)), '/');
                            }

                            if (Array.isArray(depValues)) {
                                iList.push(new ProjTreeItem(TreeItemType.DEPENDENCE_GROUP_ARRAY_FIELD, {
                                    value: config.GetDepKeyDesc(key),
                                    tooltip: newMarkdownString([
                                        `${config.GetDepKeyDesc(key, getLocalLanguageType() == LanguageIndexs.Chinese)}`,
                                        `- **Count:** \`${depValues.length}\``]),
                                    obj: new ModifiableDepInfo('None', key),
                                    childKey: key,
                                    child: depValues,
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
                            keyAlias: view_str$settings$prj_name,
                            tooltip: newMarkdownString(`**${view_str$settings$prj_name}**: \`${config.config.name}\``),
                            projectIndex: element.val.projectIndex
                        }));

                        // setting: out folder
                        iList.push(new ProjTreeItem(TreeItemType.SETTINGS_ITEM, {
                            key: 'outDir',
                            value: File.normalize(config.config.outDir),
                            keyAlias: view_str$settings$outFolderName,
                            tooltip: newMarkdownString(`**${view_str$settings$outFolderName}**: \`${config.config.outDir}\``),
                            projectIndex: element.val.projectIndex
                        }));

                        // setting: project env
                        iList.push(new ProjTreeItem(TreeItemType.SETTINGS_ITEM, {
                            key: 'project.env',
                            value: 'object {...}',
                            keyAlias: view_str$settings$prjEnv,
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

                            const fchildren = dir.GetList()
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
                                        otherCtx: {
                                            hasExtraArgs: project.hasExtraArgsForFolder(f.path, prjExtraArgs, false)
                                        },
                                        tooltip: newFileTooltipString({
                                            name: f.name,
                                            path: f.path,
                                            desc: isExcluded ? view_str$project$excludeFolder : undefined,
                                            attr: {}
                                        }, project.getRootDir()),
                                        projectIndex: element.val.projectIndex
                                    }));
                                } else { // is file
                                    const type = isExcluded ? TreeItemType.EXCFILE_ITEM : TreeItemType.FILE_ITEM;
                                    const treeItem = new ProjTreeItem(type, {
                                        value: f,
                                        collapsibleState: project.getSourceRefs(f).length > 0 ?
                                            vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                                        projectIndex: element.val.projectIndex,
                                        otherCtx: {
                                            hasExtraArgs: project.hasExtraArgsForFile(f.path, undefined, prjExtraArgs)
                                        },
                                        tooltip: newFileTooltipString({
                                            name: f.name,
                                            path: f.path,
                                            desc: isExcluded ? view_str$project$excludeFile : undefined,
                                            attr: {}
                                        }, project.getRootDir())
                                    });
                                    // use normal file icon for 'obj' file
                                    if (!project.isAutoSearchObjectFile()) {
                                        if (AbstractProject.libFileFilter.test(f.name)) {
                                            treeItem.iconPath = vscode.ThemeIcon.File;
                                        }
                                    }
                                    iFileList.push(treeItem);
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
                                    otherCtx: {
                                        hasExtraArgs: project.hasExtraArgsForFolder(vFolderPath, prjExtraArgs, true)
                                    },
                                    tooltip: newFileTooltipString({
                                        name: vFolder.name,
                                        path: vFolderPath,
                                        desc: isFolderExcluded ? view_str$project$excludeFolder : undefined,
                                        attr: {
                                            'SubFiles': vFolder.files.length.toString(),
                                            'SubFolders': vFolder.folders.length.toString()
                                        }
                                    })
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
                                    otherCtx: {
                                        hasExtraArgs: project.hasExtraArgsForFile(file.path, vFilePath, prjExtraArgs)
                                    },
                                    tooltip: newFileTooltipString({
                                        name: file.name,
                                        path: file.path,
                                        desc: isFileExcluded ? view_str$project$excludeFile : undefined,
                                        attr: {
                                            'VirtualPath': vFilePath
                                        }
                                    }, project.getRootDir())
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
                                tooltip: newFileTooltipString(refFile, project.getRootDir()),
                            }));
                        }
                    }
                    break;
                // output folder
                case TreeItemType.OUTPUT_FOLDER:
                    {
                        // put output files
                        const outFolder = project.getOutputFolder();
                        if (outFolder.IsDir()) {
                            const fList = outFolder.GetList([AbstractProject.buildOutputMatcher], File.EXCLUDE_ALL_FILTER);
                            fList.forEach((file) => {
                                iList.push(new ProjTreeItem(TreeItemType.OUTPUT_FILE_ITEM, {
                                    value: file,
                                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                                    projectIndex: element.val.projectIndex,
                                    tooltip: newFileTooltipString({
                                        name: file.name,
                                        path: file.path,
                                        attr: {}
                                    }, project.getRootDir()),
                                }));
                            });
                        }

                        // put virtual views
                        {
                            // Symbol Table
                            // - not support sdcc, keil_c51 now !
                            if (!['Keil_C51', 'SDCC'].includes(project.getToolchain().name)) {

                                let vFile = File.fromArray([project.getRootDir().path, `${project.getUid()}.elf-symbols`]);
                                iList.push(new ProjTreeItem(TreeItemType.OUTPUT_FILE_ITEM, {
                                    label: `Symbol Table`,
                                    value: vFile,
                                    isVirtualFile: true,
                                    collapsibleState: vscode.TreeItemCollapsibleState.None,
                                    projectIndex: element.val.projectIndex,
                                    tooltip: `Symbols Of Program`,
                                    icon: `Table_16x.svg`
                                }));
                                if (VirtualDocument.instance().hasDocument(vFile.path) == false) {
                                    VirtualDocument.instance().registerDocumentGetter(vFile.path,
                                        (uri, args) => this.printProjectBinarySymbols(uri, args[0], args[1]));
                                }
                            }
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

                                    const devFamily = project.GetPackManager().getDeviceFamily();
                                    let description: vscode.MarkdownString | string | undefined;
                                    if (devFamily && devFamily.description) {
                                        description = devFamily.description; // newMarkdownString(devFamily.description);
                                    }

                                    iList.push(new ProjTreeItem(TreeItemType.ITEM, {
                                        key: 'DeviceName',
                                        value: device.name,
                                        projectIndex: element.val.projectIndex,
                                        tooltip: description
                                    }));

                                    iList.push(new ProjTreeItem(TreeItemType.ITEM, {
                                        key: 'Endian',
                                        value: device.endian || 'null',
                                        projectIndex: element.val.projectIndex
                                    }));

                                    iList.push(new ProjTreeItem(TreeItemType.ITEM, {
                                        key: 'SvdPath',
                                        value: device.svdPath ? project.toRelativePath(device.svdPath) : 'null',
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
                                            const list: string[] = (<ComponentFileItem[]>component[key])
                                                .map(item => project.toRelativePath(item.path));
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

    /*
      文档：https://sourceware.org/binutils/docs-2.39/binutils.html#nm 
      下面说明符号类型：对于每一个符号来说，其类型如果是小写的，则表明该符号是local的；大写则表明该符号是global(external)的。
        A	该符号的值是绝对的，在以后的链接过程中，不允许进行改变。这样的符号值，常常出现在中断向量表中，例如用符号来表示各个中断向量函数在中断向量表中的位置。
        B	该符号的值出现在非初始化数据段(bss)中。例如，在一个文件中定义全局static int test。则该符号test的类型为b，位于bss section中。其值表示该符号在bss段中的偏移。一般而言，bss段分配于RAM中
        C	该符号为common。common symbol是未初始话数据段。该符号没有包含于一个普通section中。只有在链接过程中才进行分配。符号的值表示该符号需要的字节数。例如在一个c文件中，定义int test，并且该符号在别的地方会被引用，则该符号类型即为C。否则其类型为B。
        D	该符号位于初始话数据段中。一般来说，分配到data section中。例如定义全局int baud_table[5] = {9600, 19200, 38400, 57600, 115200}，则会分配于初始化数据段中。
        G	该符号也位于初始化数据段中。主要用于small object提高访问small data object的一种方式。
        I	该符号是对另一个符号的间接引用。
        N	该符号是一个debugging符号。
        R	该符号位于只读数据区。例如定义全局const int test[] = {123, 123};则test就是一个只读数据区的符号。注意在cygwin下如果使用gcc直接编译成MZ格式时，源文件中的test对应_test，并且其符号类型为D，即初始化数据段中。但是如果使用m6812-elf-gcc这样的交叉编译工具，源文件中的test对应目标文件的test,即没有添加下划线，并且其符号类型为R。一般而言，位于rodata section。值得注意的是，如果在一个函数中定义const char *test = “abc”, const char test_int = 3。使用nm都不会得到符号信息，但是字符串“abc”分配于只读存储器中，test在rodata section中，大小为4。
        S	符号位于非初始化数据区，用于small object。
        T	该符号位于代码区text section。
        U	该符号在当前文件中是未定义的，即该符号的定义在别的文件中。例如，当前文件调用另一个文件中定义的函数，在这个被调用的函数在当前就是未定义的；但是在定义它的文件中类型是T。但是对于全局变量来说，在定义它的文件中，其符号类型为C，在使用它的文件中，其类型为U。
        V	该符号是一个weak object。
        W	The symbol is a weak symbol that has not been specifically tagged as a weak object symbol. 未明确指定的弱链接符号；同链接的其他对象文件中有它的定义就用上，否则就用一个系统特别指定的默认值。
        -	该符号是a.out格式文件中的stabs symbol。
        ?	该符号类型没有定义
    */
    private convGnuSymbolType2ReadableString(typ: string): string {

        let typeStr: string | undefined;

        switch (typ.toLowerCase()) {
            case 'a':
                typeStr = 'ABS'
                break;
            case 'b':
                typeStr = 'BSS'
                break;
            case 'c':
                typeStr = 'COMMON'
                break;
            case 'd':
                typeStr = 'DATA'
                break;
            case 'i':
                typeStr = `Indirect Reference`
                break;
            case 'n':
                typeStr = `Debug`
                break;
            case 'r':
                typeStr = `DATA (Read Only)`
                break;
            case 't':
                typeStr = `TEXT`
                break;
            case 'u':
                typeStr = `Undefined`
                break;
            case 'v':
                typeStr = `Weak`
                break;
            case 'w':
                typeStr = `Weak (unspecified)`
                break;
            default:
                break;
        }

        if (typeStr) {
            if (typ.toLowerCase() == typ) { // is a lowercase word
                typeStr += ' (Local)'
            }
        }

        if (typeStr) {
            return `${typ}: ${typeStr}`;
        }

        return typ;
    }

    private printProjectBinarySymbols(uri: vscode.Uri,
        sortType?: 'addr' | 'size', dispType?: 'hide_no_sized' | 'show_all'): Promise<string> {

        if (sortType == undefined) {
            sortType = 'addr';
        }

        if (dispType == undefined) {
            dispType = 'show_all';
        }

        return new Promise((resolve) => {

            const uid = new File(uri.fsPath).noSuffixName;
            const prj = this.getProjectByUid(uid);

            if (prj == undefined) {
                resolve(`Error: Not found project '${uid}' !`);
                return;
            }

            try {

                const toolchain = prj.getToolchain();
                const toolchainPrefix = toolchain.getToolchainPrefix ? toolchain.getToolchainPrefix() : '';

                let elfpath = '';
                let elftool = '';
                let elfcmds = [''];
                let elfsort = false; // elftool has sorted ?

                let staMatcher: RegExp | undefined;
                let endMatcher: RegExp | undefined;
                let symMatcher: RegExp | undefined;
                let symTypConv: ((type: string) => string) | undefined;
                let locMatcher: RegExp | undefined;

                // sometimes a long line has been truncated, like this:
                //  4183: Temperature_Sampling_NVIC_Configuration
                //                              0x800f4d1   5 Code Gb   0x38
                // we need match and recover them !
                let truncatStaMatcher: RegExp | undefined;
                let truncatEndMatcher: RegExp | undefined;

                switch (toolchain.name) {
                    // armcc fmt: 
                    //   #  Symbol Name                Value      Bind  Sec  Type  Vis  Size
                    case 'AC5':
                    case 'AC6':
                        elfpath = prj.getExecutablePath();
                        elftool = [toolchain.getToolchainDir().path, 'bin', `fromelf${exeSuffix()}`].join(File.sep);
                        elfcmds = ['--text', '-s', elfpath];
                        staMatcher = /\(SHT_SYMTAB\)/
                        endMatcher = /^\*\* Section/
                        truncatStaMatcher = /^\s*\d+\s+(?:[^\s]+)\s*$/i
                        truncatEndMatcher = /^\s*0x[0-9a-f]+\s+/i
                        symMatcher = /^\s*\d+\s+(?<name>[^\s]+)\s+(?<addr>0x[0-9a-f]+)\s+(?:[^\s]+)\s+(?:[^\s]+)\s+(?<type>[^\s]+)\s+(?:[^\s]+)(?<size>\s+[^\s]+)?/i
                        break;
                    // iar fmt:
                    //   # Name                                Value      Sec Type Bd Size   Group Other
                    case 'IAR_ARM':
                        elfpath = prj.getExecutablePath();
                        elftool = [toolchain.getToolchainDir().path, 'bin', `ielfdumparm${exeSuffix()}`].join(File.sep);
                        elfcmds = ['-s', '.symtab', elfpath];
                        symMatcher = /^\s*\d+:\s+(?<name>[^\s]+)\s+(?<addr>0x[0-9a-f]+)\s+(?:[^\s]+)\s+(?<type>[^\s]+\s+[^\s]+)(?<size>\s+0x[0-9a-f]+)?/i;
                        truncatStaMatcher = /^\s*\d+:\s+(?:[^\s]+)\s*$/i
                        truncatEndMatcher = /^\s*0x[0-9a-f]+\s+/i
                        break;
                    case 'IAR_STM8':
                        elfpath = prj.getExecutablePath();
                        elftool = [toolchain.getToolchainDir().path, 'stm8', 'bin', `ielfdumpstm8${exeSuffix()}`].join(File.sep);
                        elfcmds = ['-s', '.symtab', elfpath];
                        symMatcher = /^\s*\d+:\s+(?<name>[^\s]+)\s+(?<addr>0x[0-9a-f]+)\s+(?:[^\s]+)\s+(?<type>[^\s]+\s+[^\s]+)(?<size>\s+0x[0-9a-f]+)?/i;
                        truncatStaMatcher = /^\s*\d+:\s+(?:[^\s]+)\s*$/i
                        truncatEndMatcher = /^\s*0x[0-9a-f]+\s+/i
                        break;
                    case 'GCC':
                    case 'RISCV_GCC':
                    case 'ANY_GCC':
                    case 'MIPS_GCC':
                    case 'MTI_GCC':
                        elfpath = prj.getExecutablePath();
                        elftool = [toolchain.getToolchainDir().path, 'bin', `${toolchainPrefix}nm${exeSuffix()}`].join(File.sep);
                        elfcmds = sortType == 'size' ? ['-l', '-S', '--size-sort', elfpath] : ['-ln', '-S', elfpath];
                        elfsort = true;
                        symMatcher = /^(?<addr>[0-9a-f]+)\s+(?<size>[0-9a-f]+\s+)?(?<type>\w)\s+(?<name>[^\s]+)\s+(?<loca>.*)/i;
                        symTypConv = (t) => this.convGnuSymbolType2ReadableString(t)
                        break;
                    case 'COSMIC_STM8':
                        // cobj -s .\stm8-cosmic.sm8
                        //  __memory:       0000001a section .bss defined public
                        //  __stack:        000003ff section absolute defined public absolute
                        //  c_y:            00000007 section .ubsct defined public zpage
                        //  f_exit:         00008221 section .text defined public
                        //  f_main:         00008165 section .text defined public
                        elfpath = prj.getExecutablePath();
                        elftool = [toolchain.getToolchainDir().path, `cobj${exeSuffix()}`].join(File.sep);
                        elfcmds = ['-s', elfpath];
                        symMatcher = /^\s*(?<name>\w+):\s+(?<addr>[0-9a-f]+)\s+\w+\s+(?<type>[\w\.]+)/i;
                        break;
                    default:
                        throw new Error(`Not support symbol view for '${toolchain.name}' !`);
                }

                if (!File.IsFile(elfpath)) {
                    throw new Error(`Not found elf file: '${elfpath}', please build your project !`);
                }

                if (!File.IsFile(elftool)) {
                    throw new Error(`Not found elf tool: '${elftool}' !`);
                }

                let textLines = child_process.execFileSync(elftool, elfcmds).toString().split(/\r\n|\n/);

                // filter lines
                // notes:
                //  - will contain the line that matched by 'staMatcher'
                //  - Not  contain the line that matched by 'endMatcher'
                if (staMatcher) {

                    let matchedLines: string[] = [];
                    let started = false;

                    for (const line of textLines) {

                        if (!started && staMatcher.test(line)) {
                            started = true;
                        }

                        if (started) {

                            if (matchedLines.length > 0 &&
                                endMatcher && endMatcher.test(line)) {
                                break;
                            }

                            matchedLines.push(line);
                        }
                    }

                    textLines = matchedLines;
                }

                // if no pattern, output raw text
                if (symMatcher === undefined) {
                    resolve(textLines.join(os.EOL));
                    return;
                }

                const tableHeader: string[] = ['Address', 'Size', 'Type', 'Symbol Name', 'Location'];

                let resultLines: string[][] = [];

                let col_addr_maxLen = tableHeader[0].length;
                let col_size_maxLen = tableHeader[1].length;
                let col_type_maxLen = tableHeader[2].length;
                let col_name_maxLen = tableHeader[3].length;
                let col_loca_maxLen = tableHeader[4].length;

                let sym_cur_file_location: string | undefined;

                let sym_count = 0;

                for (let i = 0; i < textLines.length; i++) {

                    let line = textLines[i];

                    if (locMatcher) {
                        const m = locMatcher.exec(line);
                        if (m && m.groups) {
                            sym_cur_file_location = m.groups['loca']?.trim();
                        }
                    }

                    if (truncatStaMatcher && truncatEndMatcher) {
                        let nxtLine = i + 1 < textLines.length ? textLines[i + 1] : undefined;
                        if (nxtLine &&
                            truncatStaMatcher.test(line) && truncatEndMatcher.test(nxtLine)) {
                            line = line + nxtLine;
                            i++;
                        }
                    }

                    const m = symMatcher.exec(line);
                    if (!(m && m.groups)) { // no matched
                        continue;
                    }

                    let addr = m.groups['addr']?.trim();
                    let size = m.groups['size']?.trim();
                    let type = m.groups['type']?.trim();
                    let name = m.groups['name']?.trim();
                    let loca = m.groups['loca']?.trim();

                    if (!addr || !name) {
                        continue;
                    }

                    sym_count++;

                    if (type && symTypConv) {
                        type = symTypConv(type);
                    }

                    // symbol name is a source file ?
                    if (/\.(?:c|cpp|cxx|c\+\+|cc|s|asm)$/i.test(name)) {
                        sym_cur_file_location = name;
                        continue;
                    }

                    size = size || '--';
                    type = type || '--';
                    loca = loca || sym_cur_file_location || '--';

                    if (dispType == 'hide_no_sized' && size == '--') {
                        continue; // ignore no-size symbols
                    }

                    col_addr_maxLen = addr.length > col_addr_maxLen ? addr.length : col_addr_maxLen;
                    col_size_maxLen = size.length > col_size_maxLen ? size.length : col_size_maxLen;
                    col_type_maxLen = type.length > col_type_maxLen ? type.length : col_type_maxLen;
                    col_name_maxLen = name.length > col_name_maxLen ? name.length : col_name_maxLen;
                    col_loca_maxLen = loca.length > col_loca_maxLen ? loca.length : col_loca_maxLen;

                    resultLines.push([addr, size, type, name, loca]);
                }

                // sort lines
                if (!elfsort) {

                    if (sortType == 'addr') {

                        resultLines = resultLines.sort((a1, a2) => {
                            const addr_1 = parseInt(a1[0], 16);
                            const addr_2 = parseInt(a2[0], 16);
                            return addr_1 - addr_2;
                        });
                    }

                    else if (sortType == 'size') {

                        let notSizeSyms: string[][] = [];
                        let hasSizeSyms: string[][] = [];

                        resultLines.forEach(sym => {
                            if (sym[1].startsWith('--')) {
                                notSizeSyms.push(sym);
                            } else {
                                hasSizeSyms.push(sym);
                            }
                        });

                        hasSizeSyms = hasSizeSyms.sort((a1, a2) => {
                            const size_1 = parseInt(a1[1], 16);
                            const size_2 = parseInt(a2[1], 16);
                            return size_1 - size_2;
                        });

                        resultLines = notSizeSyms.concat(hasSizeSyms);
                    }
                }

                // dump result

                let headerLines = [
                    '',
                    'ELF Symbols',
                    `  - Tool: '${elftool}'`,
                    `  - Cmds: '${elfcmds.join(' ')}'`,
                    `  - Symbol Count: ${sym_count}`,
                    ''
                ];

                let outputLines: string[] = headerLines;

                // make header
                {
                    outputLines.push(
                        `--${''.padEnd(col_addr_maxLen, '-')}-` +
                        `--${''.padEnd(col_size_maxLen, '-')}-` +
                        `--${''.padEnd(col_type_maxLen, '-')}-` +
                        `--${''.padEnd(col_name_maxLen, '-')}-` +
                        `--${''.padEnd(col_loca_maxLen, '-')}-`);

                    outputLines.push(
                        `| ${tableHeader[0].padEnd(col_addr_maxLen)} ` +
                        `| ${tableHeader[1].padEnd(col_size_maxLen)} ` +
                        `| ${tableHeader[2].padEnd(col_type_maxLen)} ` +
                        `| ${tableHeader[3].padEnd(col_name_maxLen)} ` +
                        `| ${tableHeader[4].padEnd(col_loca_maxLen)} `);

                    outputLines.push(
                        `--${''.padEnd(col_addr_maxLen, '-')}-` +
                        `--${''.padEnd(col_size_maxLen, '-')}-` +
                        `--${''.padEnd(col_type_maxLen, '-')}-` +
                        `--${''.padEnd(col_name_maxLen, '-')}-` +
                        `--${''.padEnd(col_loca_maxLen, '-')}-`);
                }

                for (let i = 1; i < resultLines.length; i++) {

                    outputLines.push(
                        `| ${resultLines[i][0].padEnd(col_addr_maxLen)} ` +
                        `| ${resultLines[i][1].padEnd(col_size_maxLen)} ` +
                        `| ${resultLines[i][2].padEnd(col_type_maxLen)} ` +
                        `| ${resultLines[i][3].padEnd(col_name_maxLen)} ` +
                        `| ${resultLines[i][4].padEnd(col_loca_maxLen)} `);
                }

                outputLines.push('');

                resolve(outputLines.join(os.EOL));

                //
                // @deprecated Because this lib is too slow
                //

                // let maxLen = 0;
                // for (const l of headerLines) {
                //     if (l.length > maxLen) maxLen = l.length;
                // }

                // for (let i = 1; i < headerLines.length; i++) {
                //     headerLines[i] = headerLines[i].padEnd(maxLen);
                // }

                // const tableCfg: TxtTable.TableUserConfig = {

                //     header: {
                //         alignment: 'center',
                //         content: headerLines.join('\n')
                //     },

                //     drawHorizontalLine: (idx, rowCount) => idx <= 2 || idx === rowCount,

                //     columns: {
                //         0: { width: col_addr_maxLen },
                //         1: { width: col_size_maxLen },
                //         2: { width: col_type_maxLen },
                //         3: { width: col_name_maxLen },
                //         4: { width: col_loca_maxLen }
                //     },

                //     border: {
                //         topBody: `─`,
                //         topJoin: `┬`,
                //         topLeft: `┌`,
                //         topRight: `┐`,

                //         bottomBody: `─`,
                //         bottomJoin: `┴`,
                //         bottomLeft: `└`,
                //         bottomRight: `┘`,

                //         bodyLeft: `│`,
                //         bodyRight: `│`,
                //         bodyJoin: `│`,

                //         joinBody: `─`,
                //         joinLeft: `├`,
                //         joinRight: `┤`,
                //         joinJoin: `┼`
                //     }
                // };

                // const result = TxtTable.table(resultLines, tableCfg);

                // resolve(result);

            } catch (error) {
                resolve('Error: ' + (<Error>error).message);
            }
        });
    }

    private async _OpenProject(workspaceFilePath: string): Promise<AbstractProject | undefined> {

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
            GlobalEvent.emit('msg', newMessage('Warning', `File not existed, [path]: ${eideConfigFile.path}`));
            return undefined;
        }

        let eideProjInfo: ProjectConfigData<any>;
        try {
            eideProjInfo = jsonc.parse(eideConfigFile.Read());
        } catch (error) {
            GlobalEvent.emit('msg', newMessage('Warning', `Load '${eideConfigFile.path}' failed !`));
            GlobalEvent.log_error(error);
        }

        const existedPrjIdx = this.prjList.findIndex((prj) => prj.getWsPath() == workspaceFilePath || prj.getUid() == eideProjInfo.miscInfo.uid);
        if (existedPrjIdx != -1) {
            GlobalEvent.emit('msg', newMessage('Warning', project_is_opened));
            return undefined;
        }

        try {
            const prj = AbstractProject.NewProject();
            await prj.Load(wsFile);
            this.registerProject(prj);
            GlobalEvent.emit('project.opened', prj);
            return prj;
        } catch (err) {
            GlobalEvent.emit('msg', newMessage('Warning', project_load_failed));
            GlobalEvent.log_error(err);
            GlobalEvent.emit('globalLog.show');
            return undefined;
        }
    }

    setActiveProject(index: number) {
        const prj = this.prjList[index];
        const wsPath = prj.getWsPath();
        if (this.activePrjPath !== wsPath) {
            this.activePrjPath = wsPath;
            this.UpdateView();
            GlobalEvent.emit('project.activeStatusChanged', prj.getUid());
        }
    }

    async OpenProject(workspaceFilePath: string, switchWorkspaceImmediately?: boolean): Promise<AbstractProject | undefined> {

        const wsFolder = new File(NodePath.dirname(workspaceFilePath));

        // convert .EIDE to .eide
        this.toLowercaseEIDEFolder(wsFolder);

        // check workspace
        const prjFile = File.fromArray([wsFolder.path, AbstractProject.EIDE_DIR, AbstractProject.prjConfigName]);
        if (!prjFile.IsFile()) { // not found project file, open workspace ?
            const msg = `Not found eide project in this workspace !, Open this workspace directly ?`;
            const selection = await vscode.window.showInformationMessage(msg, continue_text, cancel_text);
            if (selection === continue_text) { WorkspaceManager.getInstance().openWorkspace(new File(workspaceFilePath)); }
            return undefined;
        }

        const prj = await this._OpenProject(workspaceFilePath);
        if (prj) {
            this.SwitchProject(prj, switchWorkspaceImmediately);
            return prj;
        }

        return undefined;
    }

    async CreateProject(option: CreateOptions): Promise<AbstractProject | undefined> {

        // check folder
        const dList = option.outDir.GetList(File.EXCLUDE_ALL_FILTER);
        if (dList.findIndex((_folder) => { return _folder.name === option.name; }) !== -1) {
            const item = await vscode.window.showWarningMessage(`${WARNING}: ${project_exist_txt}`, 'Yes', 'No');
            if (item === undefined || item === 'No') {
                return undefined;
            }
        }

        try {
            const prj = AbstractProject.NewProject();
            await prj.Create(option);
            this.registerProject(prj);
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
            // make dir
            const outDir = File.fromArray([rootDir.path, '.cmsis', packZipFile.noSuffixName]);
            if (outDir.IsDir()) { continue; } /* folder existed, exit */
            outDir.CreateDir(true);
            // unzip
            const compresser = new SevenZipper(ResManager.GetInstance().Get7zDir());
            compresser.UnzipSync(packZipFile, outDir);
            folders.push(outDir);
        }

        return folders;
    }

    ImportProject(option: ImportOptions) {

        let catchErr = (error: any) => {
            const msg = `${view_str$operation$import_failed}: ${(<Error>error).message}`;
            GlobalEvent.emit('msg', newMessage('Warning', msg));
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Hidden'));
        }

        switch (option.type) {
            case 'mdk':
                this.ImportKeilProject(option).catch(err => catchErr(err));
                break;
            case 'eclipse':
                this.ImportEclipseProject(option).catch(err => catchErr(err));
                break;
            case 'iar':
                this.ImportIarProject(option).catch(err => catchErr(err));
                break;
            default:
                break;
        }
    }

    private async ImportIarProject(option: ImportOptions) {

        if (!ToolchainManager.getInstance().isToolchainPathReady('IAR_ARM')) {
            const msg = `Your 'IAR_ARM' toolchain path is invalid, we suggest that you set it before start to import !`;
            const ans = await vscode.window.showWarningMessage(msg, `Ok`, 'Skip');
            if (ans != 'Skip') {
                if (ans == 'Ok') { // jump to setup toolchain
                    vscode.commands.executeCommand('eide.operation.install_toolchain');
                }
                return;
            }
        }

        const ewwInfo = await iarParser.parseIarWorkbench(
            new File(option.projectFile.path), SettingManager.GetInstance().getIarForArmDir());
        const ewwRoot = new File(option.projectFile.dir);

        let projectnum = 0;
        for (const _ in ewwInfo.projects) projectnum++;

        if (projectnum == 0)
            throw new Error(`Not found any project in this IAR workbench ! [path]: ${option.projectFile.path}`);

        const vscWorkspace = {
            "folders": <any[]>[]
        };

        const vscWorkspaceFile = File.fromArray([ewwRoot.path, `${ewwInfo.name}.code-workspace`]);

        const toolchainType: ToolchainName = 'IAR_ARM';

        //
        let project0workspacefile: File = <any>undefined;
        for (const path_ in ewwInfo.projects) {

            const iarproj = ewwInfo.projects[path_];
            const iarPrjRoot = new File(NodePath.dirname(path_));

            const needCreateNewDir = File.normalize(iarPrjRoot.path) == File.normalize(ewwRoot.path);
            const basePrj = AbstractProject.NewProject().createBase({
                name: iarproj.name,
                projectName: iarproj.name,
                type: 'ARM',
                outDir: iarPrjRoot
            }, needCreateNewDir);

            const prjRoot = basePrj.rootFolder;

            vscWorkspace.folders.push({
                name: iarproj.name,
                path: ewwRoot.ToRelativePath(prjRoot.path) || prjRoot.path
            });

            if (!project0workspacefile)
                project0workspacefile = basePrj.workspaceFile;

            const eidePrjCfg = basePrj.prjConfig.config;
            const eideFolder = File.fromArray([prjRoot.path, AbstractProject.EIDE_DIR]);

            // export project env
            {
                const envFile = File.fromArray([eideFolder.path, 'env.ini']);
                const envCont = [
                    `###########################################################`,
                    `#              project environment variables`,
                    `###########################################################`,
                    ``,
                ];

                iarproj.envs['PROJ_DIR'] = needCreateNewDir ? '..' : '.';

                for (const key in iarproj.envs) {
                    envCont.push(`${key} = ${iarproj.envs[key]}`);
                }

                envFile.Write(envCont.join(os.EOL));
            }

            // file groups
            eidePrjCfg.virtualFolder = iarproj.fileGroups;
            eidePrjCfg.outDir = 'build';
            basePrj.prjConfig.setToolchain(toolchainType);

            // targets
            let firstTargetName: string = '';
            for (const tname in iarproj.targets) {

                if (!firstTargetName)
                    firstTargetName = tname;

                const targetName = tname;
                const iarTarget = iarproj.targets[tname];

                const nEideTarget: ProjectTargetInfo = {
                    excludeList: iarTarget.excludeList,
                    toolchain: eidePrjCfg.toolchain,
                    compileConfig: copyObject(eidePrjCfg.compileConfig),
                    uploader: eidePrjCfg.uploader,
                    uploadConfig: copyObject(eidePrjCfg.uploadConfig),
                    uploadConfigMap: copyObject(eidePrjCfg.uploadConfigMap),
                    custom_dep: {
                        name: 'default',
                        incList: [],
                        defineList: [],
                        libList: []
                    },
                    builderOptions: {},
                };
                eidePrjCfg.targets[targetName] = nEideTarget;

                nEideTarget.custom_dep.defineList = toArray(iarTarget.settings['ICCARM.CCDefines']);
                nEideTarget.custom_dep.incList = toArray(iarTarget.settings['ICCARM.CCIncludePath2']);

                //
                // compiler base config
                //
                const compilerMod = <ArmBaseCompileConfigModel>basePrj.prjConfig.compileConfigModel;
                const compilerOpt = <ArmBaseCompileData>nEideTarget.compileConfig;

                if (iarTarget.core) {
                    const expname = iarTarget.core;
                    const cpus = compilerMod.getValidCpus();
                    const idx = cpus.findIndex(n => expname == n || expname.toLowerCase().startsWith(n.toLowerCase()));
                    if (idx != -1) {
                        compilerOpt.cpuType = cpus[idx];
                    }
                }

                if (ArmCpuUtils.hasFpu(compilerOpt.cpuType)) {
                    if (iarTarget.settings['General.FPU2'] != '0') {
                        compilerOpt.floatingPointHardware =
                            ArmCpuUtils.hasFpu(compilerOpt.cpuType, true) ? 'double' : 'single';
                    }
                }

                compilerOpt.scatterFilePath = iarTarget.icfPath;

                //
                // builder options
                //
                const toolchain = ToolchainManager.getInstance().getToolchain(eidePrjCfg.type, eidePrjCfg.toolchain);
                const builderConfig = toolchain.getDefaultConfig();

                const iar2eideOptsMap = iarParser.IAR2EIDE_OPTS_MAP;

                // set iar compiler options
                for (const cfgGroupName in iar2eideOptsMap) {

                    const optsGrp = iar2eideOptsMap[cfgGroupName];

                    for (const iarsname in iar2eideOptsMap[cfgGroupName]) {

                        if (typeof iarTarget.settings[iarsname] != 'string')
                            continue;

                        const iarOptVal = <string>iarTarget.settings[iarsname];

                        for (const fieldname in optsGrp[iarsname]) {
                            const eideOptVal = optsGrp[iarsname][fieldname][iarOptVal];
                            if (eideOptVal) {
                                (<any>builderConfig)[cfgGroupName][fieldname] = eideOptVal;
                            }
                        }
                    }
                }

                // copy string options

                const optToString = (obj: string | string[]): string => {
                    if (isArray(obj)) {
                        return obj[0];
                    } else {
                        return obj;
                    }
                };

                // linker
                {
                    builderConfig.linker['LIB_FLAGS'] = toArray(iarTarget.settings['ILINK.IlinkAdditionalLibs']);

                    if (iarTarget.settings['ILINK.IlinkOverrideProgramEntryLabel'] == '1') {
                        builderConfig.linker['program-entry'] = optToString(iarTarget.settings['ILINK.IlinkProgramEntryLabel']);
                    }

                    builderConfig.linker['config-defines'] = toArray(iarTarget.settings['ILINK.IlinkConfigDefines']);

                    const extraOpts: string[] = [];

                    toArray(iarTarget.settings['ILINK.IlinkKeepSymbols'])
                        .forEach(s => extraOpts.push(`--keep ${s}`));

                    toArray(iarTarget.settings['ILINK.IlinkDefines'])
                        .forEach(s => extraOpts.push(`--define_symbol ${s}`));

                    if (iarTarget.settings['ILINK.IlinkUseExtraOptions'] == '1') {
                        toArray(iarTarget.settings['ILINK.IlinkExtraOptions'])
                            .forEach(opt => extraOpts.push(opt));
                    }

                    builderConfig.linker['misc-controls'] = extraOpts.join(' ');
                }

                // asm
                {
                    builderConfig["asm-compiler"]['defines'] = toArray(iarTarget.settings['AARM.ADefines']);

                    if (iarTarget.settings['AARM.AExtraOptionsCheckV2'] == '1') {
                        builderConfig["asm-compiler"]['misc-controls'] =
                            toArray(iarTarget.settings['AARM.AExtraOptionsV2']);
                    }
                }

                // cpp
                {
                    const extraOpts: string[] = [];

                    toArray(iarTarget.settings['ICCARM.PreInclude'])
                        .forEach(s => extraOpts.push(`--preinclude ${s}`));

                    if (iarTarget.settings['ICCARM.IExtraOptionsCheck'] == '1') {
                        toArray(iarTarget.settings['ICCARM.IExtraOptions'])
                            .forEach(s => extraOpts.push(s));
                    }

                    builderConfig["c/cpp-compiler"]['misc-controls'] = extraOpts.join(' ');
                }

                // builder tasks
                {
                    if (iarTarget.builderActions.prebuild) {
                        builderConfig.beforeBuildTasks?.push({
                            name: 'iar prebuild',
                            command: iarTarget.builderActions.prebuild,
                            stopBuildAfterFailed: true,
                        });
                    }

                    if (iarTarget.builderActions.postbuild) {
                        builderConfig.afterBuildTasks?.push({
                            name: 'iar postbuild',
                            command: iarTarget.builderActions.postbuild
                        });
                    }
                }

                nEideTarget.builderOptions[toolchainType] = builderConfig;
            }

            // init current target

            const tname = firstTargetName;
            const curTarget: any = eidePrjCfg.targets[tname];
            eidePrjCfg.mode = tname; // set current target name
            for (const key in curTarget) {
                if (key === 'custom_dep') {
                    eidePrjCfg.dependenceList =
                        [{ groupName: 'custom', depList: [curTarget[key]] }];
                    continue;
                }
                if (!MAPPED_KEYS_IN_TARGET_INFO.includes(key))
                    continue;
                (<any>eidePrjCfg)[key] = curTarget[key];
            }

            // save all config

            basePrj.prjConfig.Save();
        }

        // store vscode workspace
        fs.writeFileSync(vscWorkspaceFile.path, JSON.stringify(vscWorkspace, undefined, 4));

        // switch project
        const selection = await vscode.window.showInformationMessage(
            view_str$operation$import_done, continue_text, cancel_text);
        if (selection === continue_text) {
            WorkspaceManager.getInstance().openWorkspace(vscWorkspace.folders.length > 1
                ? vscWorkspaceFile
                : project0workspacefile);
        }
    }

    private async ImportEclipseProject(option: ImportOptions) {

        const ePrjInfo = await eclipseParser.parseEclipseProject(option.projectFile.path);
        const ePrjRoot = new File(option.projectFile.dir);

        let nPrjType: ProjectType = 'ANY-GCC';

        switch (ePrjInfo.type) {
            case 'arm':
                nPrjType = 'ARM';
                break;
            case 'riscv':
                nPrjType = 'RISC-V';
                break;
            case 'sdcc':
                nPrjType = 'C51';
            default:
                break;
        }

        const basePrj = AbstractProject.NewProject().createBase({
            name: ePrjInfo.name,
            projectName: ePrjInfo.name,
            type: nPrjType,
            outDir: ePrjRoot
        }, false);

        const nPrjConfig = basePrj.prjConfig.config;
        const eideFolder = File.fromArray([ePrjRoot.path, AbstractProject.EIDE_DIR]);

        nPrjConfig.virtualFolder = ePrjInfo.virtualSource;
        nPrjConfig.outDir = 'build';

        if (ePrjInfo.sourceEntries.length > 0) {
            nPrjConfig.srcDirs = ePrjInfo.sourceEntries;
        } else {
            nPrjConfig.srcDirs = File.NotMatchFilter(ePrjRoot.GetList(File.EXCLUDE_ALL_FILTER), File.EXCLUDE_ALL_FILTER,
                [/^\./, /^(build|dist|out|bin|obj|exe|debug|release|log[s]?|ipch|docs|doc|img|image[s]?)$/i])
                .map(d => ePrjRoot.ToRelativePath(d.path) || d.path);
        }

        // init all target
        for (const eTarget of ePrjInfo.targets) {

            const nEideTarget: ProjectTargetInfo = {
                excludeList: eTarget.excList,
                toolchain: nPrjConfig.toolchain,
                compileConfig: copyObject(nPrjConfig.compileConfig),
                uploader: nPrjConfig.uploader,
                uploadConfig: copyObject(nPrjConfig.uploadConfig),
                uploadConfigMap: copyObject(nPrjConfig.uploadConfigMap),
                builderOptions: {},
                custom_dep: {
                    name: 'default',
                    incList: [],
                    defineList: [],
                    libList: []
                }
            };

            nEideTarget.custom_dep.defineList = eTarget.globalArgs.cMacros;
            nEideTarget.custom_dep.incList = eTarget.globalArgs.cIncDirs;

            var getRootIncompatibleArgs = (t: eclipseParser.EclipseProjectTarget): string[] => {

                const res: string[] = [];

                if (!t.incompatibleArgs['/']) return res;
                const bArgs: any = t.incompatibleArgs['/'];
                for (const key in bArgs) {
                    if (!isArray(bArgs[key])) continue;
                    for (const arg of bArgs[key]) {
                        res.push(arg);
                    }
                }

                return res;
            };

            // for arm gcc toolchain
            if (nEideTarget.toolchain == 'GCC') {

                var guessArmCpuType = (t: eclipseParser.EclipseProjectTarget): string | undefined => {

                    // @note: this list is trimed, not full
                    const armCpuTypeList = [
                        'Cortex-M0',
                        'Cortex-M23',
                        'Cortex-M33',
                        'Cortex-M3',
                        'Cortex-M4',
                        'Cortex-M7'
                    ];

                    for (const arg of getRootIncompatibleArgs(t)) {
                        const mRes = /(cortex-m[\w\+]+)/.exec(arg);
                        if (mRes && mRes.length > 1) {
                            const name = mRes[1].toLowerCase();
                            const idx = armCpuTypeList.map(c => c.toLowerCase())
                                .findIndex(c => name == c || name.startsWith(c));
                            if (idx != -1) return armCpuTypeList[idx];
                        }
                    }
                };

                const compilerOpt = <ArmBaseCompileData>nEideTarget.compileConfig;
                compilerOpt.cpuType = guessArmCpuType(eTarget) || 'Cortex-M3';
                compilerOpt.floatingPointHardware = ArmCpuUtils.hasFpu(compilerOpt.cpuType) ? 'single' : 'none';
                compilerOpt.useCustomScatterFile = true;
                compilerOpt.scatterFilePath = '';

                getRootIncompatibleArgs(eTarget).forEach(arg => {
                    if (/linker script/i.test(arg)) {
                        const mRes = /[^=]+=(.+)$/.exec(arg);
                        if (mRes && mRes.length > 1) {
                            const p = eclipseParser.formatFilePath(mRes[1].trim());
                            if (/\.ld[s]?$/i.test(p)) {
                                compilerOpt.scatterFilePath = p;
                            }
                        }
                    }
                });
            }

            // for riscv gcc toolchain
            else if (nEideTarget.toolchain == 'RISCV_GCC') {

                const compilerOpt = <RiscvCompileData>nEideTarget.compileConfig;

                compilerOpt.linkerScriptPath = '';

                getRootIncompatibleArgs(eTarget).forEach(arg => {
                    if (/linker script/i.test(arg)) {
                        const mRes = /[^=]+=(.+)$/.exec(arg);
                        if (mRes && mRes.length > 1) {
                            const p = eclipseParser.formatFilePath(mRes[1].trim());
                            if (/\.ld[s]?$/i.test(p)) {
                                compilerOpt.linkerScriptPath = p;
                            }
                        }
                    }
                });
            }

            // for any gcc toolchain
            else if (nEideTarget.toolchain == 'ANY_GCC') {

                const compilerOpt = <AnyGccCompileData>nEideTarget.compileConfig;

                compilerOpt.linkerScriptPath = '';

                getRootIncompatibleArgs(eTarget).forEach(arg => {
                    if (/linker script/i.test(arg)) {
                        const mRes = /[^=]+=(.+)$/.exec(arg);
                        if (mRes && mRes.length > 1) {
                            const p = eclipseParser.formatFilePath(mRes[1].trim());
                            if (/\.ld[s]?$/i.test(p)) {
                                compilerOpt.linkerScriptPath = p;
                            }
                        }
                    }
                });
            }

            // init compiler args for target
            {
                const toolchain = ToolchainManager.getInstance().getToolchain(nPrjConfig.type, nPrjConfig.toolchain);
                const toolchainDefConf = toolchain.getDefaultConfig();

                // glob
                toolchainDefConf.global['misc-control'] = eTarget.globalArgs.globalArgs.filter(a => a.trim() != '');

                // asm
                {
                    let flags: string[] = [];
                    const asmCfg = toolchainDefConf["asm-compiler"];

                    if (asmCfg['ASM_FLAGS']) flags.push(asmCfg['ASM_FLAGS']);
                    eTarget.globalArgs.sMacros.forEach(m => flags.push(`-D${m}`));
                    eTarget.globalArgs.assemblerArgs.forEach(arg => flags.push(arg));

                    flags = flags.filter(p => p.trim() != '');
                    if (asmCfg['ASM_FLAGS'] != undefined) {
                        asmCfg['ASM_FLAGS'] = flags.join(' ');
                    } else {
                        asmCfg['misc-control'] = flags.join(' ');
                    }
                }

                // c
                {
                    let flags: string[] = [];
                    let cxxFlags: string[] = [];
                    const ccCfg = toolchainDefConf["c/cpp-compiler"];

                    if (ccCfg['C_FLAGS']) flags.push(ccCfg['C_FLAGS']);
                    if (ccCfg['CXX_FLAGS']) cxxFlags.push(ccCfg['CXX_FLAGS']);

                    eTarget.globalArgs.cCompilerArgs.forEach(arg => {
                        flags.push(arg);
                        cxxFlags.push(arg);
                    });

                    flags = flags.filter(p => p.trim() != '');
                    cxxFlags = cxxFlags.filter(p => p.trim() != '');
                    if (ccCfg['C_FLAGS'] != undefined) {
                        ccCfg['C_FLAGS'] = flags.join(' ');
                        ccCfg['CXX_FLAGS'] = cxxFlags.join(' ');
                    } else {
                        ccCfg['misc-control'] = flags.join(' ');
                    }
                }

                // linker
                {
                    if (!toolchainDefConf.linker) toolchainDefConf.linker = {};
                    const ldCfg = toolchainDefConf.linker;

                    const flags: string[] = eTarget.globalArgs.linkerArgs.filter(a => a.trim() != '');
                    if (ldCfg['LD_FLAGS'] != undefined) {
                        ldCfg['LD_FLAGS'] = flags.join(' ');
                        const libFlags = eTarget.globalArgs.linkerLibArgs.filter(a => a.trim() != '');
                        if (ldCfg['LIB_FLAGS'] != undefined) {
                            ldCfg['LIB_FLAGS'] = libFlags.join(' ');
                        }
                    } else {
                        ldCfg['misc-control'] = flags.join(' ');
                    }
                }

                nEideTarget.builderOptions[toolchain.name] = toolchainDefConf;
            }

            nPrjConfig.targets[eTarget.name] = nEideTarget;
        }

        // init current target
        const curTarget: any = nPrjConfig.targets[ePrjInfo.targets[0].name];
        nPrjConfig.mode = ePrjInfo.targets[0].name; // set current target name
        for (const name in curTarget) {
            if (name === 'custom_dep') {
                nPrjConfig.dependenceList = [{
                    groupName: 'custom', depList: [curTarget[name]]
                }];
                continue;
            }
            if (!MAPPED_KEYS_IN_TARGET_INFO.includes(name))
                continue;
            (<any>nPrjConfig)[name] = curTarget[name];
        }

        // save all config
        basePrj.prjConfig.Save();

        // show warning

        var getAllKeys = (obj: any): string[] => {
            if (typeof obj != 'object') return [];
            const keys: string[] = [];
            for (const key in obj) keys.push(key);
            return keys;
        };

        if (getAllKeys(ePrjInfo.envs).length > 0 ||
            ePrjInfo.targets.some(t => getAllKeys(t.incompatibleArgs).length > 0)) {

            let warnLines = [
                `!!! ${WARNING} !!!`,
                '',
                view_str$prompt$eclipse_imp_warning,
                '',
                '---',
                ''
            ];

            if (getAllKeys(ePrjInfo.envs).length > 0) {
                warnLines.push(
                    `##### Eclipse Project Environment Variables #####`,
                    ``,
                    yaml.stringify({ 'Envs': ePrjInfo.envs }),
                    ``
                );
            }

            warnLines.push(
                `##### Configurations For All Targets #####`,
                ``
            );

            ePrjInfo.targets.forEach(target => {
                warnLines.push(
                    `//`,
                    `///// Target: '${target.name}' /////`,
                    `//`,
                    '',
                    yaml.stringify({ 'Incompatible Args': target.incompatibleArgs }),
                    ''
                );
            });

            const f = File.fromArray([ePrjRoot.path, `eclipse.${AbstractProject.importerWarningBaseName}`]);
            f.Write(warnLines.join(os.EOL));
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(f.ToUri()));

            vscode.window.showTextDocument(doc, {
                preview: false,
                selection: doc.lineAt(0).range,
            });
        }

        // switch project
        const selection = await vscode.window.showInformationMessage(
            view_str$operation$import_done, continue_text, cancel_text);
        if (selection === continue_text) {
            WorkspaceManager.getInstance().openWorkspace(basePrj.workspaceFile);
        }
    }

    private async ImportKeilProject(option: ImportOptions) {

        const keilPrjFile = option.projectFile;
        const keilParser = KeilParser.NewInstance(option.projectFile, <any>option.mdk_prod);
        const targets = keilParser.ParseData();

        if (targets.length == 0) {
            throw Error(`Not found any target in '${keilPrjFile.path}' !`);
        }

        const nPrjOutDir = <File>option.outDir;

        const baseInfo = AbstractProject.NewProject().createBase({
            name: nPrjOutDir.name,
            projectName: keilPrjFile.noSuffixName,
            type: targets[0].type,
            outDir: nPrjOutDir
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
            const vPath = `${VirtualSource.rootName}/${File.ToUnixPath(group.name)}`;
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
            const fileTypes: string[] = ['source', 'header'];
            rte_deps.forEach((dep) => {

                // check category
                if (!(dep.category && fileTypes.includes(dep.category))) {
                    GlobalEvent.log_warn(`[Keil RTE Import] dependence '${dep.name}' is not a source file !`);
                    unresolved_deps.push(dep); /* resolve failed !, store dep */
                    return;
                }

                // check source file
                if (!dep.instance) {
                    GlobalEvent.log_warn(`[Keil RTE Import] dependence '${dep.name}' have no instances !`);
                    unresolved_deps.push(dep); /* resolve failed !, store dep */
                    return;
                }

                const srcList = dep.instance.map(p => File.ToUnixPath(p));
                const vFolder = getVirtualFolder(`${VirtualSource.rootName}/::${dep.class}`, false);

                if (!vFolder) {
                    GlobalEvent.log_warn(`[Keil RTE Import] No such folder '::${dep.class}'`);
                    unresolved_deps.push(dep); /* resolve failed !, store dep */
                    return;
                }

                /* resolve dependences */
                for (const srcPath of srcList) {

                    /* check condition */
                    if (!File.IsFile(srcPath)) {
                        GlobalEvent.log_warn(`[Keil RTE Import] No such file '${srcPath}'`);
                        continue;
                    }

                    const srcRePath = baseInfo.rootFolder.ToRelativePath(srcPath);

                    /* add to project */
                    vFolder.files.push({ path: srcRePath || srcPath });

                    /* if it's a header, add to include path */
                    if (dep.category == 'header') {
                        if (srcRePath)
                            incs.push(`${baseInfo.rootFolder.path}${File.sep}${NodePath.dirname(srcRePath)}`);
                        else
                            incs.push(NodePath.dirname(srcPath));
                    }
                }
            });

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
                            .ToRelativePath(dep.instance[0]) || dep.instance[0]
                    }

                    const nLine: string[] = [
                        `FileName: '${dep.name}'`,
                        `\tClass:     '${dep.class}'`,
                        `\tCategory:  '${dep.category}'`,
                        `\tLocation:  '${locate}'`,
                    ];

                    lines.push(nLine.join(os.EOL));
                });

                const cont = lines.join(`${os.EOL}${os.EOL}`);
                const file = File.fromArray([baseInfo.rootFolder.path, `keil.${AbstractProject.importerWarningBaseName}`]);
                file.Write(cont); // write content to file
                const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(file.ToUri()));
                vscode.window.showTextDocument(doc, { preview: false });
            }
        }

        const mergeBuilderOpts = (baseOpts_: any, opts: any): any => {

            const baseOpts = copyObject(baseOpts_);

            if (opts == undefined) return baseOpts;

            for (const clasName in opts) {
                if (baseOpts[clasName] == undefined) {
                    baseOpts[clasName] = opts[clasName];
                } else {
                    for (const key in opts[clasName]) {
                        baseOpts[clasName][key] = opts[clasName][key];
                    }
                }
            }

            return baseOpts;
        }

        const replaceUserTaskTmpVar = (t: any) => {
            const reKeilPrjDir = baseInfo.rootFolder.ToRelativeLocalPath(keilPrjFile.dir) || keilPrjFile.dir;
            if (reKeilPrjDir === '.') {
                t.command = t.command.replace('$<cd:mdk-proj-dir> && ', '');
            } else {
                if (t.command.startsWith('bash')) {
                    t.command = t.command.replace('$<cd:mdk-proj-dir>', `cd ${File.ToUnixPath(reKeilPrjDir)}`);
                } else {
                    if (File.isAbsolute(reKeilPrjDir))
                        t.command = t.command.replace('$<cd:mdk-proj-dir>', `cd /D ${reKeilPrjDir}`);
                    else
                        t.command = t.command.replace('$<cd:mdk-proj-dir>', `cd .\\${reKeilPrjDir}`);
                }
            }
        }

        // project env
        const prjenv: any = {};

        // init all targets
        for (const keilTarget of targets) {

            const newTarget: ProjectTargetInfo = <any>{};
            const defIncList: string[] = [];

            // copy from cur proj info
            newTarget.compileConfig = copyObject(projectInfo.compileConfig);
            newTarget.uploader = projectInfo.uploader;
            newTarget.uploadConfig = copyObject(projectInfo.uploadConfig);
            newTarget.uploadConfigMap = copyObject(projectInfo.uploadConfigMap);
            newTarget.builderOptions = {};

            //
            // import specific configs
            //

            // C51 project
            if (keilTarget.type === 'C51') {
                const keilCompileConf = (<KeilC51Option>keilTarget.compileOption);
                // base config
                newTarget.toolchain = 'Keil_C51';
                const toolchain = ToolchainManager.getInstance().getToolchain('C51', 'Keil_C51');
                if (keilCompileConf.includeFolder) {
                    const absPath = [toolchain.getToolchainDir().path, 'INC', keilCompileConf.includeFolder].join(File.sep);
                    defIncList.push(baseInfo.rootFolder.ToRelativePath(absPath) || absPath);
                }
                // import builder options
                const opts: BuilderOptions = mergeBuilderOpts(
                    toolchain.getDefaultConfig(), keilCompileConf.optionsGroup[keilCompileConf.toolchain]);
                newTarget.builderOptions[toolchain.name] = opts;
            }

            // ARM project
            else {
                const keilCompileConf = <KeilARMOption>keilTarget.compileOption;
                const prjCompileOption = (<ArmBaseCompileData>newTarget.compileConfig);
                // base config
                newTarget.toolchain = keilCompileConf.toolchain;
                prjCompileOption.cpuType = keilCompileConf.cpuType;
                prjCompileOption.floatingPointHardware = keilCompileConf.floatingPointHardware || 'none';
                prjCompileOption.useCustomScatterFile = keilCompileConf.useCustomScatterFile;
                prjCompileOption.storageLayout = keilCompileConf.storageLayout;

                if (keilCompileConf.scatterFilePath) {
                    prjCompileOption.scatterFilePath =
                        baseInfo.rootFolder.ToRelativePath(keilCompileConf.scatterFilePath) || keilCompileConf.scatterFilePath;
                } else { // if no scatter, will use X/O Base, R/O Base options, make scatterFilePath empty
                    prjCompileOption.scatterFilePath = '';
                }

                // import builder options
                const toolchain = ToolchainManager.getInstance().getToolchain('ARM', keilCompileConf.toolchain);
                const opts: BuilderOptions = mergeBuilderOpts(
                    toolchain.getDefaultConfig(), keilCompileConf.optionsGroup[keilCompileConf.toolchain]);
                opts.beforeBuildTasks?.forEach((t) => replaceUserTaskTmpVar(t));
                opts.afterBuildTasks?.forEach((t) => replaceUserTaskTmpVar(t));
                newTarget.builderOptions[toolchain.name] = opts;
            }

            // init custom dependence after specific configs done
            newTarget.custom_dep = <any>{ name: 'default' };
            const incList = keilTarget.incList.map((path) => baseInfo.rootFolder.ToRelativePath(path) || path);
            newTarget.custom_dep.incList = defIncList.concat(incList);
            newTarget.custom_dep.defineList = keilTarget.defineList;
            newTarget.custom_dep.libList = [];

            // fill exclude list
            newTarget.excludeList = [];
            for (const group of keilTarget.fileGroups) {
                const vFolderPath = `${VirtualSource.rootName}/${File.ToUnixPath(group.name)}`;
                if (group.disabled) { newTarget.excludeList.push(vFolderPath); } // add disabled group
                for (const file of group.files) {
                    if (file.disabled) { // add disabled file
                        newTarget.excludeList.push(`${vFolderPath}/${file.file.name}`);
                    }
                }
            }

            // env
            if (keilTarget.env && Object.keys(keilTarget.env).length > 0) {
                prjenv[`${keilTarget.name}`] = copyObject(keilTarget.env);
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
            if (!MAPPED_KEYS_IN_TARGET_INFO.includes(name))
                continue;
            (<any>projectInfo)[name] = curTarget[name];
        }

        // save all config
        baseInfo.prjConfig.Save();

        // save env
        if (Object.keys(prjenv).length > 0) {
            File.fromArray([baseInfo.rootFolder.path, AbstractProject.EIDE_DIR, 'env.ini'])
                .Write(ini.stringify(prjenv));
        }

        // switch project
        const selection = await vscode.window.showInformationMessage(
            view_str$operation$import_done, continue_text, cancel_text);
        if (selection === continue_text) {
            WorkspaceManager.getInstance().openWorkspace(baseInfo.workspaceFile);
        }
    }

    async CreateFromTemplate(option: CreateOptions) {

        const compresser = new SevenZipper(ResManager.GetInstance().Get7zDir());
        const templateFile = <File>option.templateFile;

        const targetDir = new File(option.outDir.path + File.sep + option.name);
        const targetWorkspaceFilePath = targetDir.path + File.sep + option.name + AbstractProject.workspaceSuffix;

        try {

            targetDir.CreateDir(true);

            const err = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Creating project`
            }, async (progress): Promise<Error> => {

                progress.report({ message: 'Unzip template', increment: 10 });

                const e = await compresser.Unzip(templateFile, targetDir);
                if (e) return e;

                progress.report({ message: 'Generating', increment: 50 });

                return new Promise((resolve) => {

                    const post_create_task = async () => {

                        try {

                            const wsFileList = targetDir.GetList([/\.code-workspace$/i], File.EXCLUDE_ALL_FILTER);
                            const wsFile: File | undefined = wsFileList.length > 0 ? wsFileList[0] : undefined;

                            if (wsFile) {

                                // rename workspace file name
                                fs.renameSync(wsFile.path, targetWorkspaceFilePath);

                                // rename project
                                if (templateFile.suffix != '.ewt') { // ignore eide workspace project

                                    // convert .EIDE to .eide
                                    this.toLowercaseEIDEFolder(targetDir);

                                    // init project
                                    {
                                        const prjFile = File.fromArray([targetDir.path, AbstractProject.EIDE_DIR, AbstractProject.prjConfigName]);
                                        if (!prjFile.IsFile()) throw Error(`project file: '${prjFile.path}' is not exist !`);

                                        try {
                                            const prjConf: ProjectConfigData<any> = JSON.parse(prjFile.Read());
                                            prjConf.name = option.name; // set project name
                                            if (prjConf.miscInfo) prjConf.miscInfo.uid = undefined; // reset uid
                                            prjFile.Write(JSON.stringify(prjConf, undefined, 2));
                                        } catch (error) {
                                            throw Error(`Init project failed !, msg: ${error.message}`);
                                        }
                                    }
                                }
                            }

                            resolve(undefined);

                        } catch (error) {
                            resolve(error);
                        }
                    };

                    setTimeout(post_create_task, 400);
                });
            });

            if (err) {
                throw err;
            }

            // switch workspace if user select `yes`
            const item = await vscode.window.showInformationMessage(
                view_str$operation$create_prj_done, 'Yes', 'Later'
            );

            // switch workspace
            if (item === 'Yes') {
                const wsFile = new File(targetWorkspaceFilePath);
                if (wsFile.IsFile()) {
                    WorkspaceManager.getInstance().openWorkspace(wsFile);
                }
            }

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
        this.prjList.forEach(sln => sln.Save(true));
    }

    CloseAll() {
        this.prjList.forEach(sln => sln.Close());
        this.prjList = [];
    }

    //---

    getRecords(): string[] {
        return Array.from(this.slnRecord);
    }

    clearAllRecords() {
        this.slnRecord = [];
        this.saveRecord();
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
                this.slnRecord = [];
                GlobalEvent.emit('msg', ExceptionToMessage(err, 'Hidden'));
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

    private registerProject(proj: AbstractProject) {
        this.prjList.push(proj);
        proj.on('dataChanged', (type) => this.onProjectChanged(proj, type));
        this.addRecord(proj.getWsPath());
        this.UpdateView();
    }

    Close(index: number): string | undefined {

        if (index < 0 || index >= this.prjList.length) {
            GlobalEvent.emit('error', new Error('Project index out of range: ' + index.toString()));
            return;
        }

        const sln = this.prjList[index];

        sln.Close();
        this.prjList.splice(index, 1);
        this.UpdateView();

        return sln.getUid();
    }

    private async SwitchProject(prj: AbstractProject, immediately?: boolean) {
        if (immediately) {
            WorkspaceManager.getInstance().openWorkspace(prj.GetWorkspaceConfig().GetFile());
        } else {
            const selection = await vscode.window.showInformationMessage(switch_workspace_hint, continue_text, cancel_text);
            if (selection === continue_text) {
                WorkspaceManager.getInstance().openWorkspace(prj.GetWorkspaceConfig().GetFile());
            }
        }
    }
}

interface BuildCommandInfo {
    title: string;
    command: string;
    program?: string;
    order?: number;
    ignoreFailed?: boolean;
}

interface ImporterProjectInfo {
    name: string;
    target?: string;
    incList: string[];
    defineList: string[];
    files: VirtualFolder;
    excludeList?: string[] | { [targetName: string]: string[] };
}

class PathCompletionItem extends vscode.CompletionItem {

    file: File;

    constructor(f: File) {

        super(f.name);

        this.file = f;

        if (f.IsExist()) {
            this.kind = f.IsDir() ? vscode.CompletionItemKind.Folder : vscode.CompletionItemKind.File;
        }

        this.detail = f.path;
        this.insertText = f.name;
    }
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

    private compiler_diags: Map<string, vscode.DiagnosticCollection>;

    private autosaveTimer: NodeJS.Timeout | undefined;

    private isRevealed: boolean = false; // 用于标记，初始化后是否已触发了展开首个树视图的操作

    constructor(context: vscode.ExtensionContext) {

        this._event = new events.EventEmitter();
        this.compiler_diags = new Map();

        this.dataProvider = new ProjectDataProvider(context);
        this.cppcheck_diag = vscode.languages.createDiagnosticCollection('cppcheck');

        this.view = vscode.window.createTreeView('cl.eide.view.projects', {
            treeDataProvider: this.dataProvider,
            dragAndDropController: this.dataProvider,
            canSelectMany: true,
        });
        context.subscriptions.push(this.view);

        // 当主要的几个根视图初始化后，触发展开树视图
        this.dataProvider.on('rootItems_inited', () => {
            if (this.isRevealed == false) {
                this.isRevealed = true;
                const proj = this.dataProvider.getActiveProject();
                // 当工作区有多个项目的时候，不进行展开操作
                if (proj && this.dataProvider.getProjectCount() == 1) {
                    const item = this.dataProvider.treeCache.getTreeItem(proj, TreeItemType.PROJECT);
                    if (item) {
                        this.view.reveal(item, {
                            select: false,
                            focus: false,
                            expand: false
                        });
                    }
                }
            }
        });

        // item click event
        context.subscriptions.push(vscode.commands.registerCommand(ProjTreeItem.ITEM_CLICK_EVENT, (item) => this.OnTreeItemClick(item)));

        // create vsc output channel
        this.cppcheck_out = vscode.window.createOutputChannel('eide-static-check-log');
        this.cppToolsOut = vscode.window.createOutputChannel('eide-cpptools-log');

        // register doc event
        context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((doc) => {
            this.YamlConfigProvider_notifyDocSaved(doc);
        }));
        context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((doc) => {
            this.YamlConfigProvider_notifyDocClosed(doc);
        }));

        // register yaml config provider
        {
            const providerList: ModifiableYamlConfigProvider[] = [
                new VFolderSourcePathsModifier(),
                new ProjectAttrModifier(),
                new ProjectExcSourceModifier()
            ];

            for (const provider of providerList) {
                this.registerModifiableYamlConfigProvider(provider.id, provider);
            }
        }

        // register path completion item provider
        context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider({ scheme: 'file', pattern: '**/*.eide.*.{yml,yaml}' }, this.newPathStringCompletionItemProvider(), '/', '\\'));

        // register task end event callback
        context.subscriptions.push(
            vscode.tasks.onDidEndTask((t) => {
                if (['eide.flasher', 'eide.builder'].includes(t.execution.task.source)) {
                    this.dataProvider.updateStatusBarForActiveProjects();
                }
            }));

        // register project hook
        GlobalEvent.on('project.opened', (prj) => this.onProjectOpened(prj));
        GlobalEvent.on('project.closed', (uid) => this.onProjectClosed(uid));
        GlobalEvent.on('project.activeStatusChanged', (uid) => this.notifyCpptoolsRefresh());

        this.on('request_open_project', (fsPath: string) => this.dataProvider.OpenProject(fsPath));
        this.on('request_create_project', (option: CreateOptions) => this.dataProvider.CreateProject(option));
        this.on('request_create_from_template', (option) => this.dataProvider.CreateFromTemplate(option));
        this.on('request_import_project', (option) => this.dataProvider.ImportProject(option));
    }

    onDispose() {
        this.dataProvider.onDispose();
    }

    loadWorkspace() {
        this.dataProvider.LoadWorkspaceProject();
    }

    enableAutoSave(enable: boolean) {
        if (enable) {
            if (this.autosaveTimer) {
                this.autosaveTimer.refresh();
            } else {
                this.autosaveTimer = setInterval(() => this.SaveAll(), 3 * 60 * 1000);
            }
        } else {
            if (this.autosaveTimer) {
                clearInterval(this.autosaveTimer);
                this.autosaveTimer = undefined;
            }
        }
    }

    newPathStringCompletionItemProvider(): vscode.CompletionItemProvider<PathCompletionItem> {
        return {
            provideCompletionItems: (document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext):
                vscode.ProviderResult<PathCompletionItem[] | vscode.CompletionList<PathCompletionItem>> => {

                let proj: AbstractProject | undefined;

                for (const provider of this.yamlCfgProviderList.values()) {
                    proj = provider.getSourceProjectByFileName(NodePath.basename(document.fileName));
                    if (proj) {
                        break;
                    }
                }

                if (proj == undefined) {
                    return;
                }

                const fullrange = document.getWordRangeAtPosition(position, /[^\s"]+|"[^"]+"/);
                if (fullrange) {

                    let txt = document.getText(new vscode.Range(fullrange.start, position)).trim()
                        .replace(/^(\/|\\)+/, '')
                        .replace(/(\/|\\)+$/, '');

                    let p = new File(proj.toAbsolutePath(txt));
                    if (p.IsDir()) {
                        return p.GetList(undefined, undefined).map(f => new PathCompletionItem(f));
                    }
                }
            }
        };
    }

    // -----------------------------------------
    //  cpptools intellisense provider
    // -----------------------------------------

    name: string = 'eide';

    extensionId: string = 'cl.eide';

    private isRegisteredCpptoolsProvider: boolean = false;

    private async registerCpptoolsProvider(prj: AbstractProject) {

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

        // active cpptools
        {
            const cpptoolsId = "ms-vscode.cpptools";
            const extension = vscode.extensions.getExtension(cpptoolsId);
            if (extension) {
                if (!extension.isActive) {
                    try {
                        GlobalEvent.log_info(`Active extension: '${cpptoolsId}'`);
                        await extension.activate();
                    } catch (error) {
                        GlobalEvent.log_warn(error);
                    }
                }
            } else {
                GlobalEvent.log_warn(`The extension '${cpptoolsId}' is not enabled or installed !`);
            }
        }

        // get cpptools api if we have not get
        if (!this.cppToolsApi) {
            this.cppToolsApi = await getCppToolsApi(Version.v5);
            if (!this.cppToolsApi) {
                const msg = `Can't get cpptools api, please active c/c++ extension, otherwise, the c/c++ intellisence config cannot be provided !`;
                this.cppToolsOut.appendLine(`[error] ${msg}`);
                return;
            }
        }

        // register cpptools provider, skip if already registered
        if (this.cppToolsApi && !this.isRegisteredCpptoolsProvider) {

            this.cppToolsApi.registerCustomConfigurationProvider(this);
            this.cppToolsOut.appendLine(`[init] register CustomConfigurationProvider done !\r\n`);

            // update cppConfig now
            prj.forceUpdateCpptoolsConfig();

            // set flag
            this.isRegisteredCpptoolsProvider = true;
        }
    }

    notifyCpptoolsRefresh() {

        if (this.cppToolsApi) {
            if (this.cppToolsApi.notifyReady) {
                this.cppToolsApi.notifyReady(this);
            } else {
                this.cppToolsApi.didChangeCustomConfiguration(this);
                this.cppToolsApi.didChangeCustomBrowseConfiguration(this);
            }
        }
    }

    // Map<sourePath, ProjectUid[]>
    private _sourceWhereFroms: Map<string, string[]> = new Map();

    canProvideConfiguration(uri: vscode.Uri, token?: vscode.CancellationToken | undefined): Thenable<boolean> {

        this.cppToolsOut.appendLine(`[source] cpptools request provideConfigurations for '${uri.fsPath}'`);

        return new Promise(async (resolve) => {

            const providerList: string[] = [];

            await this.dataProvider.traverseProjectsAsync(async (prj) => {

                const result = await prj.canProvideConfiguration(uri, token);
                if (result) {
                    providerList.push(prj.getUid());
                }

                return false; // don't break loop
            });

            if (providerList.length > 0) {
                this._sourceWhereFroms.set(uri.fsPath, providerList);
                resolve(true);
            } else {
                this._sourceWhereFroms.delete(uri.fsPath);
                resolve(false);
            }
        });
    }

    provideConfigurations(uris: vscode.Uri[], token?: vscode.CancellationToken | undefined): Thenable<SourceFileConfigurationItem[]> {

        return new Promise(async (resolve) => {

            let result: SourceFileConfigurationItem[] = [];

            const activePrjUid = this.getActiveProject()?.getUid();

            for (const uri of uris) {

                const prjList = this._sourceWhereFroms.get(uri.fsPath);
                if (prjList == undefined || prjList.length == 0) continue;

                let proj: AbstractProject | undefined;
                if (activePrjUid) {
                    const pidx = prjList.findIndex(uid => uid == activePrjUid);
                    if (pidx != -1) {
                        proj = this.dataProvider.getProjectByUid(prjList[pidx]);
                    }
                } else {
                    proj = this.dataProvider.getProjectByUid(prjList[0]);
                }

                if (proj) {
                    result = result.concat(await proj.provideConfigurations([uri], token));
                }
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

    // ----------------------------------------
    //  clangd config provider
    // ----------------------------------------

    private async registerClangdProvider(prj: AbstractProject) {

        if (this.cppToolsApi)
            return; // 如果 cpptools 激活了，则禁用 clangd，防止两个冲突

        prj.on('cppConfigChanged', () => {

            const envs = prj.getProjectVariables();
            if (envs['EIDE_CLANGD_PROVIDER_ENABLE'] == '0') {
                GlobalEvent.log_info(`ignore update .clangd, because EIDE_CLANGD_PROVIDER_ENABLE=0 is set`);
                return;
            }

            // ----------------------
            // setup clangd config
            // ----------------------
            try {
                let cfg: any = {};
                const fclangd = File.fromArray([prj.getProjectRoot().path, '.clangd']);
                if (fclangd.IsFile()) {
                    cfg = yaml.parse(fclangd.Read());
                }
                if (!cfg['CompileFlags']) cfg['CompileFlags'] = {};
                if (!cfg['CompileFlags']['Add']) cfg['CompileFlags']['Add'] = []
                //
                cfg['CompileFlags']['CompilationDatabase'] = './' + File.ToUnixPath(prj.getOutputDir());
                const toolchain = prj.getToolchain();
                const gccLikePath = toolchain.getGccFamilyCompilerPathForCpptools('c++');
                if (gccLikePath) { // 仅兼容gcc的编译器
                    cfg['CompileFlags']['Compiler'] = gccLikePath;
                    let clangdCompileFlags = <string[]>(cfg['CompileFlags']['Add']);
                    let compilerArgs = prj.getCpptoolsConfig().cppCompilerArgs;
                    if (/GCC/.test(toolchain.name)) {
                        const tRoot = toolchain.getToolchainDir().path;
                        clangdCompileFlags = clangdCompileFlags.filter(p => !File.isSubPathOf(tRoot, p.substr(2)));
                        let li = getGccSystemSearchList(File.ToLocalPath(gccLikePath), ['-xc++'].concat(compilerArgs || []));
                        if (li) {
                            li.forEach(p => {
                                clangdCompileFlags.push(`-I${File.normalize(p)}`);
                            });
                        }
                    } else {
                        clangdCompileFlags.push(`-I${toolchain.getToolchainDir().path}/include`);
                        clangdCompileFlags.push(`-I${toolchain.getToolchainDir().path}/include/libcxx`);
                    }
                    // // add flags
                    // if (compilerArgs)
                    //     compilerArgs.forEach(arg => clangdCompileFlags.push(arg));
                    // // add user includes
                    // prj.getCpptoolsConfig().includePath
                    //     .forEach(path => clangdCompileFlags.push(`-I${path}`));
                    // // add user defines
                    // prj.getCpptoolsConfig().defines
                    //     .forEach(d => clangdCompileFlags.push(`-D${d}`));
                    // del repeat
                    cfg['CompileFlags']['Add'] = ArrayDelRepetition(clangdCompileFlags);
                }
                fclangd.Write(yaml.stringify(cfg));
            } catch (error) {
                GlobalEvent.log_error(error);
            }
        });

        prj.forceUpdateCpptoolsConfig();
    }

    // -----------------------------------------
    //  Project Explorer 
    // -----------------------------------------

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
            this.getActiveProject();
    }

    getActiveProject(): AbstractProject | undefined {
        return this.dataProvider.getActiveProject();
    }

    getProjectCount(): number {
        return this.dataProvider.getProjectCount();
    }

    Refresh() {
        this.dataProvider.clearTreeViewCache();
        this.dataProvider.UpdateView();
    }

    Close(item: ProjTreeItem) {
        const uid = this.dataProvider.Close(item.val.projectIndex);
        GlobalEvent.emit('project.closed', uid);
    }

    SaveAll() {
        this.dataProvider.SaveAll();
    }

    // -------

    openLibsGeneratorConfig(prjItem?: ProjTreeItem) {

        const proj = this.getProjectByTreeItem(prjItem);
        if (proj == undefined) {
            GlobalEvent.emit('msg', newMessage('Warning', 'No activated project !'));
            return;
        }

        const optFile = proj.getLibsGeneratorCfgFile();
        vscode.window.showTextDocument(vscode.Uri.parse(optFile.ToUri()), { preview: true });
    }

    private async onProjectOpened(prj: AbstractProject) {

        await this.registerCpptoolsProvider(prj);

        await this.registerClangdProvider(prj);

        this.updateCompilerDiagsAfterBuild(prj);

        prj.on('projectFileChanged', () => this.onProjectFileChanged(prj));
    }

    private __autosaveDisableTimeoutTimer: NodeJS.Timeout | undefined;
    private async onProjectFileChanged(prj: AbstractProject) {

        const nam = prj.getProjectName();
        const uid = prj.getUid();
        const wsf = prj.getWorkspaceFile();

        //
        // disable autosave
        //
        this.enableAutoSave(false);

        if (this.__autosaveDisableTimeoutTimer) {
            this.__autosaveDisableTimeoutTimer.refresh();
        } else {
            this.__autosaveDisableTimeoutTimer = setTimeout((_this: ProjectExplorer) => {
                _this.__autosaveDisableTimeoutTimer = undefined;
                _this.enableAutoSave(true);
            }, 5 * 60 * 1000, this);
        }

        //
        // do something
        //
        const msg = view_str$prompt$need_reload_project.replace('{}', prj.getProjectName());
        const ans = await vscode.window.showInformationMessage(msg, 'Yes', 'No');
        if (ans == 'Yes') {
            await this.reloadProject(uid, wsf);
        }

        if (this.__autosaveDisableTimeoutTimer) {
            clearTimeout(this.__autosaveDisableTimeoutTimer);
            this.__autosaveDisableTimeoutTimer = undefined;
        }

        //
        // enable auto save
        //
        this.enableAutoSave(true);
    }

    private async reloadProject(uid: string, workspaceFile: File): Promise<boolean> {

        const idx = this.dataProvider.getIndexByProjectUid(uid);
        if (idx == -1) {
            GlobalEvent.emit('msg', newMessage('Error', `Project '${uid}' is not actived !`));
            return false;
        }

        this.dataProvider.Close(idx);

        return new Promise((resolve) => {
            setTimeout(async () => {
                try {
                    await this.dataProvider.OpenProject(workspaceFile.path, true);
                    this.Refresh();
                    resolve(true);
                } catch (error) {
                    GlobalEvent.emit('error', error);
                    resolve(false);
                }
            }, 500);
        });
    }

    private async onProjectClosed(uid: string | undefined) {

        if (!uid) return;

        // clear vscode diags
        if (this.compiler_diags.has(uid)) {
            this.compiler_diags.get(uid)?.clear();
        }
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

        pickBox.onDidTriggerButton((e) => {

            // create target
            if (e.tooltip === pickBox.buttons[0].tooltip) {
                this.createTarget(prj);
            }

            // delete target
            if (e.tooltip === pickBox.buttons[1].tooltip) {
                this.deleteTarget(prj);
            }

            pickBox.hide();
            pickBox.dispose();
        });

        let curItem: vscode.QuickPickItem | undefined;

        pickBox.onDidChangeSelection((items: readonly vscode.QuickPickItem[]) => {
            curItem = items.length > 0 ? items[0] : undefined;
        });

        pickBox.onDidAccept(() => {

            if (curItem !== undefined) {
                const targetName = curItem.label;
                // switch target
                if (targetName) {
                    prj.switchTarget(targetName);
                }
            }

            pickBox.hide();
            pickBox.dispose();
        });

        pickBox.show();
    }

    async showQuickPickAndSwitchActiveProject() {

        const selections: vscode.QuickPickItem[] = [];

        this.dataProvider.foreachProject((proj) => {
            selections.push(<any>{
                uid: proj.getUid(),
                label: proj.getProjectName(),
                description: `uid: ${proj.getUid()}`,
                detail: `loc: ${proj.getWorkspaceFile().path}`
            });
        });

        if (selections.length > 0) {

            const result: any = await vscode.window.showQuickPick(selections, {
                title: `Switch Active Project`,
                canPickMany: false,
            });

            if (result) {
                const idx = this.dataProvider.getIndexByProjectUid(result.uid);
                if (idx != -1) {
                    const acvtiveProj = this.dataProvider.getActiveProject();
                    if (acvtiveProj && result.uid == acvtiveProj.getUid()) return;
                    this.dataProvider.setActiveProject(idx);
                }
            }
        }
    }

    async showQuickPickAndSwitchActiveTarget() {

        const activeProj = this.getActiveProject();

        if (activeProj) {

            const selections = activeProj.getTargets().map<vscode.QuickPickItem>((name) => { return { label: name }; });

            const result = await vscode.window.showQuickPick(selections, {
                title: `Switch Active Target`,
                canPickMany: false
            });

            if (result) {
                if (result.label != activeProj.getCurrentTarget()) {
                    activeProj.switchTarget(result.label);
                }
            }
        }
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
                this.dataProvider.OpenProject(item.detail);
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

    saveProject(prjItem?: ProjTreeItem) {

        const prj = this.getProjectByTreeItem(prjItem);

        if (prj === undefined) {
            GlobalEvent.emit('msg', newMessage('Warning', 'No active project !'));
            return;
        }

        prj.Save();
    }

    private _buildLock: boolean = false;
    BuildSolution(prjItem?: ProjTreeItem, options?: BuildOptions) {

        try {

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
            prj.Save(true);

            const codeBuilder = CodeBuilder.NewBuilder(prj);
            const toolchain = prj.getToolchain().name;

            // build launched event
            codeBuilder.on('launched', () => {
                if (this.compiler_diags.has(prj.getUid())) {
                    this.compiler_diags.get(prj.getUid())?.clear();
                }
                const buildbar = StatusBarManager.getInstance().get('build');
                if (buildbar) {
                    buildbar.text = `$(loading~spin) Building`;
                }
            });

            // build finish event
            codeBuilder.on('finished', (done) => {
                prj.notifyUpdateSourceRefs(toolchain);
                this.notifyUpdateOutputFolder(prj);
                this.updateCompilerDiagsAfterBuild(prj);
                if (options?.flashAfterBuild && done) this.UploadToDevice(prjItem);
                this.dataProvider.updateStatusBarForActiveProjects();
            });

            // start build
            codeBuilder.build(options);

            setTimeout(() => {
                this._buildLock = false;
            }, 500);

        } catch (error) {
            GlobalEvent.emit('error', error);
        }
    }

    private updateCompilerDiagsAfterBuild(prj: AbstractProject) {

        let diag_res: CompilerDiagnostics | undefined;

        try {

            const logFile = File.fromArray([prj.getOutputFolder().path, 'compiler.log']);

            switch (prj.getToolchain().name) {
                case 'IAR_ARM':
                case 'IAR_STM8':
                    diag_res = parseIarCompilerLog(prj, logFile);
                    break;
                case 'Keil_C51':
                    diag_res = parseKeilc51CompilerLog(prj, logFile);
                    break;
                case 'AC5':
                    diag_res = parseArmccCompilerLog(prj, logFile);
                    break;
                case 'SDCC':
                    diag_res = parseSdccCompilerLog(prj, logFile);
                    break;
                case 'COSMIC_STM8':
                    diag_res = parseCosmicStm8CompilerLog(prj, logFile);
                    break;
                default:
                    diag_res = parseGccCompilerLog(prj, logFile);
                    break;
            }

        } catch (error) {
            GlobalEvent.log_warn(error);
        }

        if (diag_res) {

            const uid = prj.getUid();

            let cc_diags: vscode.DiagnosticCollection;

            if (this.compiler_diags.has(uid)) {
                cc_diags = <any>this.compiler_diags.get(uid);
            } else {
                cc_diags = vscode.languages.createDiagnosticCollection(prj.getProjectName());
                this.compiler_diags.set(uid, cc_diags);
            }

            for (const path in diag_res) {
                const uri = vscode.Uri.file(path);
                cc_diags.set(uri, diag_res[path]);
            }
        }
    }

    buildWorkspace(rebuild?: boolean) {

        if (this.dataProvider.getProjectCount() == 0) {
            GlobalEvent.emit('msg', newMessage('Warning', 'No project is opened !'));
            return;
        }

        const cmdList: BuildCommandInfo[] = [];

        this.dataProvider.foreachProject((project, index) => {

            const projectName = project.GetConfiguration().config.name;

            const buildCfg: BuildCommandInfo = {
                title: `build '${projectName}'`,
                command: ''
            };

            /* get project order */
            const envConfig = project.getProjectRawEnv();
            const targetName = project.getCurrentTarget().toLowerCase();
            if (envConfig) {
                /////////////////////////////
                // prj build order
                let cfgName = 'EIDE_BUILD_ORDER';
                // parse global config
                if (envConfig[cfgName]) {
                    buildCfg.order = parseInt(envConfig[cfgName]);
                }
                // parse target config
                if (envConfig[targetName] &&
                    envConfig[targetName][cfgName]) {
                    buildCfg.order = parseInt(envConfig[targetName][cfgName]);
                }
                /////////////////////////////
                // ignore if failed ?
                cfgName = 'EIDE_BUILD_SKIP_IF_FAILED';
                // parse global config
                if (envConfig[cfgName]) {
                    buildCfg.ignoreFailed = (parseInt(envConfig[cfgName])) === 1;
                }
                // parse target config
                if (envConfig[targetName] &&
                    envConfig[targetName][cfgName]) {
                    buildCfg.ignoreFailed = (parseInt(envConfig[targetName][cfgName])) === 1;
                }
            }

            // make default order is 100
            if (buildCfg.order == undefined ||
                buildCfg.order == null ||
                buildCfg.order == NaN) {
                buildCfg.order = 100;
            }

            /* gen command */
            const builder = CodeBuilder.NewBuilder(project);
            const cmdLine = builder.genBuildCommand({ not_rebuild: !rebuild }, true);
            if (cmdLine) {
                buildCfg.command = cmdLine || '';
                cmdList.push(buildCfg);
            }
        });

        /* gen params file */
        const paramsFile = File.fromArray([os.tmpdir(), `eide-ws-params.tmp`]);
        paramsFile.Write(JSON.stringify(cmdList));

        /* launch */
        const commandLine = generateDotnetProgramCmd(
            ResManager.instance().getUnifyBuilderExe(), ['-r', paramsFile.path]);
        runShellCommand('build workspace', commandLine);
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
        if (os.platform() == 'win32') {
            runShellCommand('clean', `cmd /E:ON /C del /S /Q "${outDir}"`);
        } else {
            if (outDir == '/' || outDir == userhome()) {
                GlobalEvent.emit('msg', newMessage('Error', `Cannot delete ${outDir} !`));
            } else {
                runShellCommand('clean', `rm -rf -v "${outDir}"`);
            }
        }

        setTimeout(() => {
            this.notifyUpdateOutputFolder(prj);
        }, 1500);
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

    compileSingleFile(item: ProjTreeItem) {

        const project = this.getProjectByTreeItem(item);
        if (!project)
            return;
        if (!(item.val.value instanceof File))
            return;

        try {
            const srcPath = item.val.value.path;
            const dbinfo = project.getSourceCompileDatabase(srcPath);
            if (dbinfo) {
                runShellCommand(`compile: ${NodePath.basename(srcPath)}`, dbinfo.command, {
                    useTerminal: true,
                    cwd: dbinfo.directory
                });
            } else {
                throw Error(`No compile commands for this file: ${srcPath}`);
            }
        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
        }
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
                GlobalEvent.emit('msg', newMessage('Info', export_keil_xml_ok + prj.toRelativePath(xmlFile.path)));
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

        // URL: https://api.github.com/repos/github0null/eide-cmsis-pack/contents/packages
        const repoUrl = redirectHost('api.github.com/repos/' + SettingManager.GetInstance().getCmsisPackRepositoryUrl());

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

                const url = redirectHost(gitFileInfo.download_url);
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

    async ExportMakefile(prjItem?: ProjTreeItem) {

        const prj = this.getProjectByTreeItem(prjItem);

        if (prj === undefined) {
            GlobalEvent.emit('msg', newMessage('Error', 'No active project !'));
            return;
        }
        if (this._buildLock) {
            GlobalEvent.emit('msg', newMessage('Error', 'builder busy !, please wait !'));
            return;
        }

        // gen command line
        prj.Save(true);
        const builder = CodeBuilder.NewBuilder(prj);
        const cmdLine = builder.genBuildCommand({ otherArgs: ['--out-makefile', '--dry-run'] });
        if (cmdLine === undefined) {
            GlobalEvent.emit('msg', newMessage('Error', `Fail to generate build command`));
            return;
        }

        // do export

        vscode.window.withProgress({
            title: `Export Makefile`,
            location: vscode.ProgressLocation.Notification
        }, (progress, cancel) => {
            return new Promise<boolean>((resolve) => {
                const proc = new ExeCmd();
                let errLines: string[] = [`Execute: ${cmdLine}`];
                proc.on('launch', () => {
                    progress.report({ message: 'Running ...' });
                });
                proc.on('line', str => {
                    errLines.push(str);
                    progress.report({ message: str });
                });
                proc.on('close', exitInfo => {
                    if (exitInfo.code == 0) {
                        progress.report({ message: 'All Done.' });
                        setTimeout(() => resolve(true), 1000);
                    } else {
                        resolve(false);
                        GlobalEvent.emit('msg', newMessage('Error', `Fail to export Makefile, code=${exitInfo.code}`));
                        if (errLines.length > 0) {
                            GlobalEvent.log_warn(errLines.slice(-100).join(os.EOL));
                        }
                    }
                });
                cancel?.onCancellationRequested(_ => {
                    if (!kill(<number>proc.pid())) {
                        GlobalEvent.emit('msg', newMessage('Error', `Can not kill process: ${proc.pid()} !`));
                    }
                });
                proc.Run(<string>cmdLine, undefined, { cwd: prj.getProjectRoot().path });
            });
        });
    }

    private exportLocked: boolean = false;
    async ExportProjectTemplate(prjItem?: ProjTreeItem, isWorkspace?: boolean) {

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
                '*.eide-template',
                '*.log',
                '*.ept',
                `${AbstractProject.EIDE_DIR}${File.sep}*.db3`,
                `${AbstractProject.EIDE_DIR}${File.sep}*.dat`,
            ];

            // if this is a project, prehandle it
            let prj: AbstractProject | undefined;
            if (prjItem && isWorkspace == undefined) {
                prj = this.dataProvider.GetProjectByIndex(prjItem.val.projectIndex);
                const prjConfig = prj.GetConfiguration().config;
                rootDir = prj.GetRootDir();
                templateName = prjConfig.name;
                tmp_suffix = 'ept';
                const prjOutFolder = File.normalize(prj.GetConfiguration().config.outDir);
                defExcludeList.push(`${prjOutFolder}`, `${prjOutFolder}${File.sep}*`);
                resIgnoreList = prj.readIgnoreList();
            }

            /* invalid root folder, exit */
            if (rootDir == undefined) {
                this.exportLocked = false;
                return;
            }

            const prjRootDir = <File>rootDir;
            const distDir = <File>rootDir;
            const tFile: File = File.fromArray([distDir.path, `${templateName}.${tmp_suffix}`]);

            // delete old template file
            if (tFile.IsFile()) {
                fs.unlinkSync(tFile.path);
            }

            const option: CompressOption = {
                zipType: '7z',
                fileName: tFile.name,
                excludeList: ArrayDelRepetition(defExcludeList.concat(resIgnoreList))
            };

            const compresser = new SevenZipper(ResManager.GetInstance().Get7zDir());

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: isWorkspace ? `Packing workspace` : `Packing project`,
                cancellable: false
            }, (progress, __): Thenable<Error | null> => {
                return new Promise(async (resolve) => {

                    progress.report({ message: 'zipping ...' });

                    const err = await compresser.Zip(prjRootDir, option, distDir);
                    if (err) {
                        GlobalEvent.emit('msg', ExceptionToMessage(err, 'Warning'));
                    } else {
                        progress.report({ message: 'export done !' });
                    }

                    setTimeout(() => resolve(err), 1500);
                });
            });

            if (prj) { // save prj
                prj.Save();
            }

        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
        }

        this.exportLocked = false;
    }

    async ShowProjectVariables(item: ProjTreeItem) {

        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        const prjVars = prj.getProjectVariables();

        const vars: { [k: string]: string }[] = [];

        const cfg: SimpleUIConfig = {
            title: 'Project Variables',
            readonly: true,
            btns: {
                submit: {
                    title: '',
                    hidden: true
                },
                reset: {
                    title: '',
                    hidden: true
                }
            },
            items: {
                vars: {
                    type: 'table',
                    attrs: {},
                    name: '',
                    data: <SimpleUIConfigData_table>{
                        value: vars,
                        default: vars,
                    }
                }
            }
        };

        for (const key in prjVars) {
            vars.push({
                Name: key,
                Value: prjVars[key] || ''
            });
        }

        WebPanelManager.instance().showSimpleConfigUI(cfg, async () => {
            // nothing todo
        });
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
                    const rePath = prj.ToRelativePath(folderPath);

                    // if can't calculate repath, skip
                    if (rePath === undefined || rePath.trim() === '') {
                        GlobalEvent.emit('msg', newMessage('Warning', `Can't calculate relative path for '${folderPath}' !`));
                        continue;
                    }

                    if (rePath === '.' || rePath.split('/').every(p => p == '..')) { // ignore these folders
                        GlobalEvent.emit('msg', newMessage('Warning', `source folder can not be '${rePath}' !`));
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

        if (!(item.val.obj instanceof File)) {
            return;
        }

        const srcDir = item.val.obj;

        const answer = await vscode.window.showInformationMessage(view_str$prompt$removeSrcDir.replace('{}', srcDir.path), txt_yes, txt_no);
        if (answer == txt_yes) {
            const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
            prj.GetConfiguration().RemoveSrcDir(srcDir.path);
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
                'c/c++': ['c', 'cpp', 'cxx', 'cc', 'c++', 'h', 'hxx', 'hpp', 'inc'],
                'c/c++ source': ['c', 'cpp', 'cxx', 'cc', 'c++'],
                'c/c++ header': ['h', 'hxx', 'hpp', 'inc'],
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

    async Virtual_removeFolder(item: ProjTreeItem, items: ProjTreeItem[]) {
        if (items == undefined) items = [item];

        for (const folderItem of items) {
            const project = this.dataProvider.GetProjectByIndex(folderItem.val.projectIndex);
            const curFolder = <VirtualFolderInfo>folderItem.val.obj;

            const answer = await vscode.window.showInformationMessage(view_str$prompt$removeSrcDir.replace('{}', curFolder.path), txt_yes, txt_no);
            if (answer == txt_yes) {
                project.getVirtualSourceManager().removeFolder(curFolder.path);
            }
        }
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

    async Virtual_removeFile(item: ProjTreeItem, items: ProjTreeItem[]) {
        if (items == undefined) items = [item];

        for (const fileItem of items) {
            const project = this.dataProvider.GetProjectByIndex(fileItem.val.projectIndex);
            const curFile = <VirtualFileInfo>fileItem.val.obj;
            project.getVirtualSourceManager().removeFile(curFile.path);
        }
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

    private async modifyExtraCompilerArgs_forFile(project: AbstractProject, item: ProjTreeItem) {

        let fspath: string | undefined;
        let virtpath: string | undefined;

        if (item.type === TreeItemType.V_FILE_ITEM) {
            virtpath = (<VirtualFileInfo>item.val.obj).path;
        }

        if (item.val.value instanceof File) { // if value is a file, use it
            fspath = project.toRelativePath(item.val.value.path);
        }

        if (!fspath)
            return;

        const extraArgs = project.getSourceExtraArgsCfg();
        if (!extraArgs)
            return;

        const argsMap    = project.getExtraArgsForSource(fspath, virtpath, extraArgs);
        const absPattern = project.getExtraArgsAbsPatternForSource(fspath, virtpath, extraArgs);
        const ccOptions  = absPattern ? (argsMap[absPattern] || '') : '';

        // merge all inherited args
        let inheritedArgs: string = '';
        for (const key in argsMap) {
            const val = argsMap[key]?.trim();
            if (key != absPattern && val) {
                inheritedArgs = `${inheritedArgs} ${val}`;
            }
        }
        inheritedArgs = inheritedArgs.trim();

        const ui_cfg: SimpleUIConfig = {
            title: `Modify Compiler Options (file: ${NodePath.basename(fspath)})`,
            items: {},
        };

        if (inheritedArgs) { // 继承于其他匹配模式
            ui_cfg.items['inherit'] = {
                type: 'input',
                attrs: { readonly: true },
                name: `Inherited Options (from other pattern, check your 'files.options.yml' file for details !)`,
                data: <SimpleUIConfigData_input>{
                    value: inheritedArgs,
                    default: inheritedArgs
                }
            };
        }

        ui_cfg.items['args'] = {
            type: 'input',
            attrs: {},
            name: 'Append Compiler Options',
            data: <SimpleUIConfigData_input>{
                placeHolder: [
                    `For Append   Options. e.g. " -Os -flto " ...`,
                    `For Replace  Options. e.g. " $<replace:-O1/-O2> " ...`,
                    `For Override Options. e.g. " $<override:-I./include -g -O2 -flto> " ...`,
                ].join(os.EOL),
                value: ccOptions,
                default: ccOptions,
            },
        };

        try {
            const db = project.getSourceCompileDatabase(fspath);
            if (db) {
                ui_cfg.items['current_commands'] = {
                    type: 'input',
                    attrs: { readonly: true },
                    name: `Current Compiler Commands`,
                    data: <SimpleUIConfigData_input>{
                        value: db.command,
                        default: db.command
                    }
                };
            }
        } catch (error) {
            // nothing todo
        }

        WebPanelManager.instance().showSimpleConfigUI(ui_cfg, async (new_cfg) => {

            const nArgs = (<SimpleUIConfigData_input>new_cfg.items['args'].data).value.replace(/\r\n|\n/g, ' ').trim();

            let pattern: string;

            if (virtpath) {
                pattern = virtpath;
            } else {
                pattern = project.toRelativePath(<string>fspath)
                    .replace(/\.\.\//g, '')
                    .replace(/\.\//g, '');
            }

            let category: string = 'files';
            let argsConf: any = extraArgs;

            if (virtpath) {
                category = 'virtualPathFiles';
            }

            if (!argsConf[category])
                argsConf[category] = {};

            if (nArgs) {
                argsConf[category][pattern] = nArgs;
            } else {
                if (argsConf[category][pattern] != undefined)
                    delete argsConf[category][pattern];
            }

            project.setSourceExtraArgsCfg(extraArgs);
            project.onSourceCompilerOptionsChanged();

            // update explorer
            if (virtpath) {
                project.getVirtualSourceManager().notifyUpdateFile(<string>virtpath);
            } else {
                project.getNormalSourceManager().notifyUpdateFile(project.toAbsolutePath(<string>fspath));
            }
        });
    }

    private async modifyExtraCompilerArgs_forFolder(project: AbstractProject, item: ProjTreeItem) {

        let folderpath: string | undefined;
        let isVirtpath: boolean | undefined;

        if (item.type == TreeItemType.V_FOLDER ||
            item.type == TreeItemType.V_FOLDER_ROOT) {
            folderpath = (<VirtualFileInfo>item.val.obj).path;
            isVirtpath = true;
        }

        if (item.val.obj instanceof File) { // if value is a file, use it
            folderpath = project.toRelativePath(item.val.obj.path);
        }

        if (!folderpath)
            return;

        const extraArgs = project.getSourceExtraArgsCfg();
        if (!extraArgs)
            return;

        const argsMap    = project.getExtraArgsForFolder(folderpath, isVirtpath, extraArgs);
        const absPattern = project.getExtraArgsAbsPatternForFolder(folderpath, isVirtpath, extraArgs);
        const ccOptions  = absPattern ? (argsMap[absPattern] || '') : '';

        // merge all inherited args
        let inheritedOptions: string = '';
        for (const key in argsMap) {
            const val = argsMap[key]?.trim();
            if (key != absPattern && val) {
                inheritedOptions = `${inheritedOptions} ${val}`;
            }
        }
        inheritedOptions = inheritedOptions.trim();

        const ui_cfg: SimpleUIConfig = {
            title: `Modify Compiler Options (dir: ${NodePath.basename(folderpath)})`,
            items: {},
        };

        if (inheritedOptions) { // 继承于其他匹配模式
            ui_cfg.items['inherit'] = {
                type: 'input',
                attrs: { readonly: true },
                name: `Inherited Options (from other args pattern, check your 'files.options.yml' file for details !)`,
                data: <SimpleUIConfigData_input>{
                    value: inheritedOptions,
                    default: inheritedOptions
                }
            };
        }

        ui_cfg.items['args'] = {
            type: 'input',
            attrs: {},
            name: 'Append Compiler Options',
            data: <SimpleUIConfigData_input>{
                placeHolder: [
                    `For Append   Options. e.g. " -Os -flto " ...`,
                    `For Replace  Options. e.g. " $<replace:-O1/-O2> " ...`,
                    `For Override Options. e.g. " $<override:-I./include -g -O2 -flto> " ...`,
                ].join(os.EOL),
                value: ccOptions,
                default: ccOptions,
            },
        };

        const isRecursived = absPattern ? absPattern.endsWith('/**') : false;

        ui_cfg.items['recursive'] = {
            type: 'bool',
            attrs: {},
            name: 'Recurse All Children',
            data: <SimpleUIConfigData_boolean>{
                value: isRecursived,
                default: isRecursived,
            },
        };

        WebPanelManager.instance().showSimpleConfigUI(ui_cfg, async (new_cfg) => {

            const nArgs = (<SimpleUIConfigData_input>new_cfg.items['args'].data).value.replace(/\r\n|\n/g, ' ').trim();
            const isRecursive = (<SimpleUIConfigData_boolean>new_cfg.items['recursive'].data).value;

            let pattern: string;

            if (isVirtpath) {
                pattern = <string>folderpath;
            } else {
                pattern = project.toRelativePath(<string>folderpath).replace(/\.\.\//g, '').replace(/\.\//g, '');
            }

            let category: string = 'files';
            let argsConf: any = extraArgs;

            if (isVirtpath) {
                category = 'virtualPathFiles';
            }

            if (!argsConf[category])
                argsConf[category] = {};

            if (absPattern)
                delete argsConf[category][absPattern];

            if (nArgs) {
                argsConf[category][pattern + (isRecursive ? '/**' : '/*')] = nArgs;
            } else {
                for (const suffix of ['', '/*', '/**']) { // clear all
                    if (argsConf[category][pattern + suffix] != undefined)
                        delete argsConf[category][pattern + suffix];
                }
            }

            project.setSourceExtraArgsCfg(extraArgs);
            project.onSourceCompilerOptionsChanged();

            // update explorer
            if (isVirtpath) {
                project.getVirtualSourceManager().notifyUpdateFolder(<string>folderpath);
            } else {
                project.getNormalSourceManager().notifyUpdateFolder(project.toAbsolutePath(<string>folderpath));
            }
        });
    }

    async modifyExtraCompilerArgs(type: 'file' | 'folder', item: ProjTreeItem) {

        const project = this.getProjectByTreeItem(item);
        if (!project)
            return;

        if (type == 'file') {
            this.modifyExtraCompilerArgs_forFile(project, item);
        }
        else { // folder
            this.modifyExtraCompilerArgs_forFolder(project, item);
        }
    }

    private async showDisassemblyForElf(elfPath: string, prj: AbstractProject) {

        const isGccToolchain = (name: ToolchainName) => { return /GCC/.test(name); };

        try {

            const toolchainName = prj.getToolchain().name;

            // prepare command
            let exeFile: File;
            let cmds: string[];

            const dasmFile = File.fromArray([prj.getOutputFolder().path, `${NodePath.basename(elfPath)}.edasm`]);
            if (dasmFile.IsFile()) { // force del tmp file
                try { fs.unlinkSync(dasmFile.path); } catch (error) { }
            }

            if (isGccToolchain(toolchainName)) { // gcc
                const toolchain = ToolchainManager.getInstance().getToolchainByName(toolchainName);
                if (!toolchain) throw new Error(`Can't get toolchain '${toolchainName}'`);
                const toolPrefix = toolchain.getToolchainPrefix ? toolchain.getToolchainPrefix() : '';
                exeFile = File.fromArray([prj.getToolchain().getToolchainDir().path, 'bin', `${toolPrefix}objdump${exeSuffix()}`]);
                if (!exeFile.IsFile()) { throw Error(`Not found '${exeFile.name}' !`) }
                cmds = ['-S', '-l', elfPath, '>', dasmFile.path];
                // https://interrupt.memfault.com/blog/gnu-binutils#new-feature-visualize-jumps
                const binutilsVer = getGccBinutilsVersion(exeFile.dir, toolPrefix, 'objdump');
                if (binutilsVer && compareVersion(binutilsVer, '2.34') > 0) {
                    cmds = ['--visualize-jumps'].concat(cmds);
                }
            }
            else if (toolchainName.startsWith('AC')) { // armcc
                exeFile = File.fromArray([prj.getToolchain().getToolchainDir().path, 'bin', `fromelf${exeSuffix()}`]);
                if (!exeFile.IsFile()) { throw Error(`Not found '${exeFile.name}' !`) }
                cmds = ['-c', elfPath, '--output', dasmFile.path];
            } else {
                throw new Error(`Not support toolchain: '${toolchainName}' !`);
            }

            // do disassembly code
            const err = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Disassemble program',
                cancellable: false,
            }, async (progress): Promise<Error | undefined> => {
                try {
                    progress.report({ message: elfPath });
                    await new Promise((resolve) => { setTimeout(() => resolve(), 500); });

                    // run
                    const cmdLine = CmdLineHandler.getCommandLine(exeFile.path, cmds, false);
                    child_process.execSync(cmdLine, { encoding: 'ascii' });

                    progress.report({ message: 'Done !' });
                    await new Promise((resolve) => { setTimeout(() => resolve(), 500); });
                } catch (error) {
                    return error;
                }
            });

            if (err) { throw err }

            // check result file
            if (!dasmFile.IsFile()) {
                throw new Error(`Not found disassembly result file: '${dasmFile.path}' !`);
            }

            // show
            vscode.window.showTextDocument(vscode.Uri.file(dasmFile.path), {
                preview: true,
                viewColumn: vscode.ViewColumn.Two
            });

        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
        }
    }

    async showDisassembly(uri: vscode.Uri, prj?: AbstractProject) {

        const supportList = ['AC5', 'AC6'];

        const isGccToolchain = (name: ToolchainName) => { return /GCC/.test(name); };

        try {

            const notSupprotMsg = `Only support '${supportList.join(',')}' and 'GCC' compiler !`;

            // check condition
            const activePrj = prj || this.dataProvider.getActiveProject();
            if (!activePrj) { throw new Error('Not found active project !'); }
            const toolchainName = activePrj.getToolchain().name;
            if (!supportList.includes(toolchainName) && !isGccToolchain(toolchainName)) { throw new Error(notSupprotMsg); }

            let srcPath = uri.fsPath;

            // prehandle src name
            if (/\.(?:elf|axf)\.info$/i.test(srcPath)) { // it's axf.info readonly doc
                srcPath = NodePath.dirname(srcPath) + NodePath.sep + NodePath.basename(srcPath, '.info');
            }

            if (/\.(?:elf|axf)$/i.test(srcPath)) { // it's an executable file, use it
                await this.showDisassemblyForElf(srcPath, activePrj);
                return;
            }

            // get obj file
            const objPath = activePrj.getSourceObjectPath(srcPath);

            if (typeof objPath != 'string') {
                throw new Error(`Not found any reference for this source file !, [path]: '${srcPath}'`);
            }

            if (!File.IsFile(objPath)) {
                throw new Error(`Object file is not existed !, [path]: '${objPath}'`);
            }

            // prepare command
            let exeFile: File;
            let cmds: string[];

            const tmpFile = File.fromArray([os.tmpdir(), `${NodePath.basename(srcPath)}.edasm`]);
            if (tmpFile.IsFile()) { // force del tmp file
                try { fs.unlinkSync(tmpFile.path); } catch (error) { }
            }

            if (isGccToolchain(toolchainName)) { // gcc
                const toolchain = ToolchainManager.getInstance().getToolchainByName(toolchainName);
                if (!toolchain) throw new Error(`Can't get toolchain '${toolchainName}'`);
                const toolPrefix = toolchain.getToolchainPrefix ? toolchain.getToolchainPrefix() : '';
                exeFile = File.fromArray([activePrj.getToolchain().getToolchainDir().path, 'bin', `${toolPrefix}objdump${exeSuffix()}`]);
                if (!exeFile.IsFile()) { throw Error(`Not found '${exeFile.name}' !`) }
                cmds = ['-S', '-l', objPath, '>', tmpFile.path];
                // https://interrupt.memfault.com/blog/gnu-binutils#new-feature-visualize-jumps
                const binutilsVer = getGccBinutilsVersion(exeFile.dir, toolPrefix, 'objdump');
                if (binutilsVer && compareVersion(binutilsVer, '2.34') > 0) {
                    cmds = ['--visualize-jumps'].concat(cmds);
                }
            }
            else if (toolchainName.startsWith('AC')) { // armcc
                exeFile = File.fromArray([activePrj.getToolchain().getToolchainDir().path, 'bin', `fromelf${exeSuffix()}`]);
                if (!exeFile.IsFile()) { throw Error(`Not found '${exeFile.name}' !`) }
                cmds = ['-c', objPath, '--output', tmpFile.path];
            }
            else { // none
                throw new Error(notSupprotMsg);
            }

            // do disassembly code
            const cmdLine = CmdLineHandler.getCommandLine(exeFile.path, cmds, false);
            child_process.execSync(cmdLine, { encoding: 'ascii' });

            // check result file
            if (!tmpFile.IsFile()) {
                throw new Error(`Not found disassembly result file: '${tmpFile.path}' !`);
            }

            // parse result
            const asmLines = tmpFile.Read().split(/\r\n|\n/);
            const asmFile = `${srcPath}.edasm`;
            const asmFileUri = vscode.Uri.parse(VirtualDocument.instance().getUriByPath(asmFile));

            if (tmpFile.IsFile()) { // del tmp file
                try { fs.unlinkSync(tmpFile.path); } catch (error) { }
            }

            // try jump to target line in asm
            let selection: vscode.Range | undefined;

            if (vscode.window.activeTextEditor &&
                vscode.window.activeTextEditor.document.uri.toString() == uri.toString()) {

                // for gcc toolchain
                // jump to example: 
                //          c:/xxx/xxx\sourceName.c:123
                //
                if (isGccToolchain(toolchainName)) {

                    const activeTextEditor = vscode.window.activeTextEditor;
                    const curLine = activeTextEditor.selection.start.line;

                    const safeName = NodePath.basename(srcPath)
                        .replace(/\./g, String.raw`\.`)
                        .replace(/\(/g, String.raw`\(`).replace(/\)/g, String.raw`\)`)
                        .replace(/\[/g, String.raw`\[`).replace(/\]/g, String.raw`\]`)
                        .replace(/\{/g, String.raw`\{`).replace(/\}/g, String.raw`\}`)
                        .replace(/\^/g, String.raw`\^`).replace(/\$/g, String.raw`\$`)
                        .replace(/\*/g, String.raw`\*`)
                        .replace(/\+/g, String.raw`\+`)
                        .replace(/\?/g, String.raw`\?`)
                        .replace(/\|/g, String.raw`\|`);

                    const lmatcher = new RegExp(`.+\\b${safeName}:\\d+\\b`);
                    const tMatcher = new RegExp(`.+\\b${safeName}:${curLine + 1}\\b`);

                    for (let idx = 0; idx < asmLines.length; idx++) {
                        const line = asmLines[idx];
                        if (lmatcher.test(line)) {
                            // found target line
                            if (selection == undefined && tMatcher.test(line)) {
                                const pos = new vscode.Position(idx + 1, 0);
                                selection = new vscode.Range(pos, pos);
                            }
                            // clear line number content
                            asmLines[idx] = '';
                        }
                    }
                }

                // for armcc toolchain
                // jump to example: 
                //          ** Section #4 'i.delay' (SHT_PROGBITS) [SHF_ALLOC + SHF_EXECINSTR]
                //
                else if (toolchainName.startsWith('AC')) {
                    const matcher = /^\s*\*\* Section #\d+ 'i\./;
                    for (let idx = 0; idx < asmLines.length; idx++) {
                        const line = asmLines[idx];
                        if (matcher.test(line)) {
                            const pos = new vscode.Position(idx, 0);
                            selection = new vscode.Range(pos, pos);
                            break; // found it, exit
                        }
                    }
                }
            }

            // show
            VirtualDocument.instance().updateDocument(asmFile, asmLines.join('\n'));
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
        WebPanelManager.instance().showCmsisConfigWizard(uri);
    }

    async cppcheckFile(uri: vscode.Uri) {

        // !!! COMMING SOON !!!

        /* const path: any = SettingManager.GetInstance().getCppcheckerExe();
        if (!path) {
            const done = await ResInstaller.instance().setOrInstallTools('cppcheck', `Not found 'cppcheck${exeSuffix()}' !`);
            if (!done) { return; }
        }

        const exeFile = new File(path);
        if (!exeFile.IsFile()) {
            const done = await ResInstaller.instance().setOrInstallTools('cppcheck', `Not found 'cppcheck${exeSuffix()}' ! [path]: ${exeFile.path}`);
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
            await ResInstaller.instance().setOrInstallTools('cppcheck', `Not found 'cppcheck${exeSuffix()}' !`);
            return;
        }

        const exeFile = new File(path);
        if (!exeFile.IsFile()) {
            await ResInstaller.instance().setOrInstallTools('cppcheck', `Not found 'cppcheck${exeSuffix()}', [path]: '${exeFile.path}'`);
            return;
        }

        const cppcheck_has_platform = (plat: string): boolean => {
            return File.IsFile(`${exeFile.dir}/platforms/${plat}.xml`);
        };
        const cppcheck_has_cfg = (cfgname: string): boolean => {
            return File.IsFile(`${exeFile.dir}/cfg/${cfgname}.cfg`);
        };

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
        const builderOpts = prjConfig.compileConfigModel.getOptions();
        const defMacros: string[] = ['__VSCODE_CPPTOOL']; /* it's for internal force include header */
        let defList: string[] = defMacros.concat(depMerge.defineList);
        depMerge.incList = ArrayDelRepetition(depMerge.incList.concat(prj.getSourceIncludeList()));
        const includeList: string[] = depMerge.incList.map(p => prj.resolveEnvVar(p)).map(p => File.ToUnixPath(confRootDir.ToRelativePath(p) || p));
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
                    const rePath = confRootDir.ToRelativePath(source.file.path);
                    srcList.push(rePath || source.file.path);
                }
            }

            return srcList;
        }

        /* set cppcheck conf */
        const is8bit = prjConfig.config.type == 'C51';
        const cfgList: string[] = ['gnu'];

        if (['Keil_C51'].includes(toolchain.name)) {
            GlobalEvent.emit('msg', newMessage('Warning', `We don't support cppcheck for '${toolchain.name}' !`));
            return;
        }

        if (os.platform() == 'win32') {
            if (toolchain.name == 'GCC' && cppcheck_has_cfg('armgcc'))
                cfgList.push('armgcc');
            else if (toolchain.name == 'RISCV_GCC' && cppcheck_has_cfg('riscv'))
                cfgList.push('riscv');
            else
                defList = defList.concat(
                    toolchain.getInternalDefines(<any>prjConfig.config.compileConfig, builderOpts));
        } else {
            defList = defList.concat(
                toolchain.getInternalDefines(<any>prjConfig.config.compileConfig, builderOpts));
        }

        if (toolchain.name == 'ANY_GCC' && toolchain.getToolchainPrefix) {
            const prefix = toolchain.getToolchainPrefix();
            if (/avr/i.test(prefix)) { // it's avr compiler
                cfgList.push('avr');
            } else if (prefix == '') { // it's local compiler
                cfgList.push('std');
            }
        }

        const fixedDefList = defList.map((str) => str.replace(/"/g, '&quot;'));

        let cppcheck_plat: string = 'unix32';
        if (is8bit) {
            if (os.platform() == 'win32' && cppcheck_has_platform('mcs51'))
                cppcheck_plat = 'mcs51';
            else
                cppcheck_plat = 'avr8';
        }

        const sourceList = getSourceList(prj);
        cppcheckConf = cppcheckConf
            .replace('${cppcheck_build_folder}', File.normalize(prj.getOutputRoot()))
            .replace('${platform}', cppcheck_plat)
            .replace('${lib_list}', cfgList.map((str) => `<library>${escapeXml(str)}</library>`).join(os.EOL + '\t\t'))
            .replace('${include_list}', includeList.map((str) => `<dir name="${escapeXml(str)}/"/>`).join(os.EOL + '\t\t'))
            .replace('${macro_list}', fixedDefList.map((str) => `<define name="${escapeXml(str)}"/>`).join(os.EOL + '\t\t'))
            .replace('${source_list}', sourceList.map((str) => `<dir name="${escapeXml(str)}"/>`).join(os.EOL + '\t\t'));

        confFile.Write(cppcheckConf);

        /* make command */

        let max_cpus = os.cpus().length;
        if (max_cpus > sourceList.length * 2) max_cpus = sourceList.length;
        if (max_cpus < 4) max_cpus = 4;
        if (max_cpus > 12) max_cpus = 12;
        cmds.push(
            '-j', max_cpus.toString(),
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
                    env: concatSystemEnvPath([exeFile.dir, `${exeFile.dir}${File.sep}cfg`])
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
                        const uri = vscode.Uri.file(fpath);
                        const diags = Array.from(this.cppcheck_diag.get(uri) || []);
                        const line = parseInt(mRes[pattern.line]);
                        const col = parseInt(mRes[pattern.column]);
                        const col_s = col > 0 ? (col - 1) : 0;
                        const range = new vscode.Range(
                            new vscode.Position(line - 1, col_s),
                            new vscode.Position(line - 1, col_s + 10));
                        const diag = new vscode.Diagnostic(range, mRes[pattern.message], toVscServerity(mRes[pattern.severity]));
                        diag.source = 'cppcheck';
                        diags.push(diag);
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

                const _args: string[] = cmds.map(s => (s.includes(' ') && !s.trimStart().startsWith('"')) ? `"${s}"` : s);
                this.cppcheck_out.append(`>>> Exec cppcheck\n -> ${exeFile.name} ${_args.join(' ')}\n\n`);
                process.Run(exeFile.name, _args, opts);
            });
        });
    }

    private install_lock: boolean = false;
    async installCmsisSourcePack(item: ProjTreeItem, type: 'header' | 'lib' | 'idrv') {

        if (this.install_lock) {
            GlobalEvent.emit('msg', newMessage('Warning', 'Operation is in pending !'));
            return;
        }

        this.install_lock = true; // lock op

        try {

            const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
            if (prj) {
                switch (type) {
                    case 'header':
                        prj.installCmsisSourceCodePack(
                            ResManager.GetInstance().getCMSISHeaderPacks().map(f => {
                                return {
                                    name: f.noSuffixName,
                                    zippath: f.path,
                                    exportIncs: ['.']
                                }
                            }));
                        break;
                    case 'lib':
                        prj.installCmsisLibs();
                        break;
                    case 'idrv':
                        prj.installCmsisSourceCodePack([
                            {
                                name: 'driver',
                                zippath: [ResManager.instance().GetAppDataDir().path, 'cmsis_driver_interface_v5_9_0.7z'].join(File.sep),
                                exportIncs: [
                                    'Include',
                                    'VIO/Include'
                                ]
                            }
                        ]);
                        break;
                    default:
                        break;
                }
            }

        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
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

    async ModifyCompileConfig_openFile(item: ProjTreeItem) {

        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        const key = <string>item.val.key;

        if (/\b(linkerScript|scatterFile)/.test(key)) {
            const scatterFilePath = <string>item.val.value;
            const ldFileList: string[] = [];
            scatterFilePath.split(',')
                .filter(s => s.trim() != '')
                .forEach((sctPath) => {
                    ldFileList.push(sctPath);
                });
            try {
                if (ldFileList.length == 1) {
                    const fpath = prj.ToAbsolutePath(ldFileList[0]);
                    vscode.window.showTextDocument(
                        vscode.Uri.parse(File.ToUri(fpath)), { preview: true });
                } else if (ldFileList.length > 1) {
                    const sel = await vscode.window.showQuickPick(ldFileList, {
                        canPickMany: false,
                        placeHolder: `Select One To Open`
                    });
                    if (sel) {
                        const fpath = prj.ToAbsolutePath(sel);
                        vscode.window.showTextDocument(
                            vscode.Uri.parse(File.ToUri(fpath)), { preview: true });
                    }
                }
            } catch (error) {
                GlobalEvent.emit('error', error);
            }
        }
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
                    const oldFolderName = File.normalize(prjConfig.outDir);

                    const newName = await vscode.window.showInputBox({
                        value: oldFolderName,
                        ignoreFocusOut: true,
                        validateInput: (input: string): string | undefined => {
                            return !/^[\w-]+$/.test(input) ? `not match RegExp: /^[\\w-]+$/` : undefined;
                        }
                    });

                    if (newName && newName !== oldFolderName) {
                        prjConfig.outDir = newName;
                        this.updateSettingsView(prj);
                        prj.Save();
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
                        placeHolder: 'Input new project name',
                        validateInput: (name) => AbstractProject.validateProjectName(name)
                    });

                    if (newName && newName !== prjConfig.name) {
                        prjConfig.name = newName; // update project name
                        this.dataProvider.UpdateView(); // udpate all view
                        prj.Save(true);
                        // rename workspace file
                        const wsFile = prj.getWorkspaceFile();
                        const newWsFile = File.from(wsFile.dir, `${newName}${wsFile.suffix}`);
                        fs.renameSync(wsFile.path, newWsFile.path);
                        WorkspaceManager.getInstance().openWorkspace(newWsFile);
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

    async ImportSourceFromExtProject(treeItem: ProjTreeItem) {

        const prj = this.dataProvider.GetProjectByIndex(treeItem.val.projectIndex);

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
                        .execFileSync(`${scriptRoot.path}/qjs${exeSuffix()}`, cmds, { cwd: scriptRoot.path })
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
                            if (selectedItem) {
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
                                    return { path: prj.toRelativePath(file.path) }
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

                    //
                    // exclude source
                    //
                    if (prjInfo.excludeList) {

                        prjInfo.excludeList = Array.isArray(prjInfo.excludeList) ?
                            prjInfo.excludeList :
                            prjInfo.excludeList[prjInfo.target || 'null'];

                        if (Array.isArray(prjInfo.excludeList)) {

                            const excRePathLi = prjInfo.excludeList
                                .filter(path => path.trim() != '')
                                .map(path => prj.toRelativePath(path));

                            const realExcLi: string[] = [];

                            prj.getVirtualSourceManager().traverse((vFolderInfo) => {
                                vFolderInfo.folder.files.forEach(vFile => {
                                    if (excRePathLi.includes(vFile.path)) {
                                        const vFullPath = `${vFolderInfo.path}/${NodePath.basename(vFile.path)}`;
                                        realExcLi.push(vFullPath);
                                    }
                                });
                            });

                            realExcLi.forEach(vPath => prj.excludeSourceFile(vPath));
                        }
                    }

                    // show message and exit
                    progress.report({ message: `done !` });

                    prj.Save();

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
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: true,
            canSelectFiles: false,
            canSelectFolders: true,
            openLabel: add_include_path,
            defaultUri: vscode.Uri.file(prj.GetRootDir().path)
        });

        if (uris && uris.length > 0) {
            const dupLi = prj
                .addIncludePaths(uris.map(uri => { return uri.fsPath; }))
                .map(path => prj.ToRelativePath(path) || path);
            if (dupLi.length > 0) {
                const msg = `${dupLi.length} redundant include paths (ignored): ${JSON.stringify(dupLi)}`;
                GlobalEvent.emit('msg', newMessage('Warning', msg));
            }
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
        const pickItems: vscode.QuickPickItem[] = [];
        const includesMap: Map<string, string> = new Map();

        let includes: string[] = [];

        // add dependence include paths
        prj.GetConfiguration().getAllDepGroup().forEach((group) => {
            for (const dep of group.depList) {
                for (const incPath of dep.incList) {
                    const repath = prj.toRelativePath(incPath);
                    if (includes.includes(repath))
                        continue; // skip it existed
                    includes.push(repath);
                    includesMap.set(repath, group.groupName);
                }
            }
        });

        // add source include paths
        prj.getSourceIncludeList().forEach((incPath) => {
            const repath = prj.toRelativePath(incPath);
            includes.push(repath);
            includesMap.set(repath, 'source');
        });

        includes = sortPaths(includes, '/');

        for (const repath of includes) {

            const incPath = repath;
            const grpName = includesMap.get(repath);

            let descpLi: string[] = [];

            if (grpName && grpName != ProjectConfiguration.CUSTOM_GROUP_NAME) {
                descpLi.push(grpName);
            }

            if (File.isEnvPath(incPath)) {
                descpLi.push(`loc: ${prj.resolveEnvVar(incPath)}`);
            }

            pickItems.push({
                label: incPath,
                description: descpLi.join(', ')
            });
        }

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
                    libMaps.set(prj.toRelativePath(libPath), group.groupName);
                }
            }
        });

        for (const keyVal of libMaps) {

            const libPath = keyVal[0];
            const grpName = keyVal[1];

            let descpLi: string[] = [];

            if (grpName != ProjectConfiguration.CUSTOM_GROUP_NAME) {
                descpLi.push(grpName);
            }

            if (File.isEnvPath(libPath)) {
                descpLi.push(`loc: ${prj.resolveEnvVar(libPath)}`);
            }

            pickItems.push({
                label: libPath,
                description: descpLi.join(', ')
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

    ExcludeSourceFile(item: ProjTreeItem, items: ProjTreeItem[]) {
        if (items == undefined) items = [item];

        for (const sourceItem of items) {
            const prj = this.dataProvider.GetProjectByIndex(sourceItem.val.projectIndex);

            // if it's a virtual file, we use virtual path
            if (sourceItem.type === TreeItemType.V_FILE_ITEM) {
                prj.excludeSourceFile((<VirtualFileInfo>sourceItem.val.obj).path);
            }

            // if it's a fs file, we use fs path
            else if (sourceItem.val.value instanceof File) {
                prj.excludeSourceFile(sourceItem.val.value.path);
            }
        }
    }

    UnexcludeSourceFile(item: ProjTreeItem, items: ProjTreeItem[]) {
        if (items == undefined) items = [item];

        for (const sourceItem of items) {
            const prj = this.dataProvider.GetProjectByIndex(sourceItem.val.projectIndex);

            if (sourceItem.type === TreeItemType.V_EXCFILE_ITEM) {
                prj.unexcludeSourceFile((<VirtualFileInfo>sourceItem.val.obj).path);
            }
            else if (sourceItem.val.value instanceof File) {
                prj.unexcludeSourceFile(sourceItem.val.value.path);
            }
        }
    }

    ExcludeFolder(item: ProjTreeItem, items: ProjTreeItem[], onlyChildren?: boolean) {
        if (items == undefined) items = [item];

        for (const folderItem of items) {
            const prj = this.dataProvider.GetProjectByIndex(folderItem.val.projectIndex);

            switch (folderItem.type) {
                // filesystem folder
                case TreeItemType.FOLDER:
                case TreeItemType.FOLDER_ROOT:
                    if (onlyChildren) {
                        const dir = <File>folderItem.val.obj;
                        dir.GetList(undefined, File.EXCLUDE_ALL_FILTER).forEach(f => {
                            prj.excludeSourceFile(f.path);
                        });
                    } else {
                        prj.excludeFolder((<File>folderItem.val.obj).path);
                    }
                    break;
                // virtual folder
                case TreeItemType.V_FOLDER:
                case TreeItemType.V_FOLDER_ROOT:
                    if (onlyChildren) {
                        const dir = <VirtualFolderInfo>folderItem.val.obj;
                        dir.vFolder.files.forEach(f => {
                            prj.excludeSourceFile(`${dir.path}/${NodePath.basename(f.path)}`);
                        });
                    } else {
                        prj.excludeFolder((<VirtualFolderInfo>folderItem.val.obj).path);
                    }
                    break;
                default:
                    break;
            }
        }
    }

    UnexcludeFolder(item: ProjTreeItem, items: ProjTreeItem[], onlyChildren?: boolean) {
        if (items == undefined) items = [item];

        for (const folderItem of items) {
            const prj = this.dataProvider.GetProjectByIndex(folderItem.val.projectIndex);

            if (onlyChildren) { // viewItem == FOLDER || viewItem == V_FOLDER || viewItem == FOLDER_ROOT || viewItem == V_FOLDER_ROOT
                switch (folderItem.type) {
                    // filesystem folder
                    case TreeItemType.FOLDER:
                    case TreeItemType.FOLDER_ROOT:
                        {
                            const dir = <File>folderItem.val.obj;
                            dir.GetList(undefined, File.EXCLUDE_ALL_FILTER).forEach(f => {
                                prj.unexcludeSourceFile(f.path);
                            });
                        }
                        break;
                    // virtual folder
                    case TreeItemType.V_FOLDER:
                    case TreeItemType.V_FOLDER_ROOT:
                        {
                            const dir = <VirtualFolderInfo>folderItem.val.obj;
                            dir.vFolder.files.forEach(f => {
                                prj.unexcludeSourceFile(`${dir.path}/${NodePath.basename(f.path)}`);
                            });
                        }
                        break;
                    default:
                        break;
                }
            }

            else { // viewItem == EXCFOLDER || viewItem == V_EXCFOLDER
                switch (folderItem.type) {
                    // filesystem folder
                    case TreeItemType.EXCFOLDER:
                        prj.unexcludeFolder((<File>folderItem.val.obj).path);
                        break;
                    // virtual folder
                    case TreeItemType.V_EXCFOLDER:
                        prj.unexcludeFolder((<VirtualFolderInfo>folderItem.val.obj).path);
                        break;
                    default:
                        break;
                }
            }
        }
    }

    async showFileInExplorer(item: ProjTreeItem) {

        let file: File | undefined;

        if (item.val.value instanceof File) { // if value is a file, use it
            file = new File(File.normalize(item.val.value.path));
        }

        if (file) {
            vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(file.path));
        }
    }

    ////////////////////////////////// modifiable yaml config implements ////////////////////////////////////////

    private yamlCfgProviderList: Map<string, ModifiableYamlConfigProvider> = new Map();

    registerModifiableYamlConfigProvider(id: string, provider: ModifiableYamlConfigProvider) {
        this.yamlCfgProviderList.set(id, provider);
    }

    private YamlConfigProvider_notifyDocSaved(doc: vscode.TextDocument) {

        const docName = NodePath.basename(doc.uri.fsPath);

        this.yamlCfgProviderList.forEach((val, key) => {
            if (docName.endsWith(`eide.${key}.yaml`)) {
                val.onYamlDocSaved(doc);
            }
        });
    }

    private YamlConfigProvider_notifyDocClosed(doc: vscode.TextDocument) {

        const docName = NodePath.basename(doc.uri.fsPath);

        this.yamlCfgProviderList.forEach((val, key) => {
            if (docName.endsWith(`eide.${key}.yaml`)) {
                val.onYamlDocClosed(doc);
            }
        });
    }

    async openYamlConfig(item: ProjTreeItem, id: string) {

        const provider = this.yamlCfgProviderList.get(id);
        if (provider == undefined) {
            throw new Error(`not found any registed config provider: '${id}'`);
        }

        // provide file
        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        const defFileName = `${prj.getUid()}.eide.${id}.yaml`;
        const res = await provider.provideYamlDocument(prj, item, defFileName);
        if (res instanceof Error) {
            GlobalEvent.emit('msg', ExceptionToMessage(res, 'Warning'));
            return;
        }

        // show file if we need
        if (res) {
            vscode.window.showTextDocument(
                vscode.Uri.file(res.path), { preview: false }
            );
        }
    }

    ///////////////////////////////////////////////////////////////////////////

    CopyItemValue(item: ProjTreeItem) {
        if (item.val.value instanceof File) {
            vscode.env.clipboard.writeText(item.val.value.path);
        } else if (typeof item.val.value == 'string') {
            vscode.env.clipboard.writeText(item.val.value);
        }
    }

    async showFilesOptions(item: ProjTreeItem) {
        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        const optFile = prj.getSourceExtraArgsCfgFile();
        vscode.window.showTextDocument(vscode.Uri.parse(optFile.ToUri()), { preview: true });
    }

    ///////////////////////////////////////////////////////////////////////////////

    async editDependenceItem(item: ProjTreeItem) {

        if (item.val.value instanceof File)
            throw new Error('editDependenceItem: Invalid context item');

        const itype = (<ModifiableDepInfo>item.val.obj).type;

        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        let newVal = await vscode.window.showInputBox({
            value: item.val.value,
            ignoreFocusOut: true,
            validateInput: (input: string): string | undefined => {
                if (input.trim() === '')
                    return 'Cannot be empty or whitespace !'
                if (itype == 'DEFINE_ITEM') {
                    if (!/^\w+(=[^\s].*)?$/i.test(input))
                        return "Cannot have whitespace on either side of '=' !";
                }
            }
        });

        if (newVal) {
            newVal = newVal.trim();
            switch (itype) {
                case 'INC_ITEM':
                    prj.GetConfiguration().CustomDep_ModifyIncDir(prj.ToAbsolutePath(<string>item.val.value), prj.ToAbsolutePath(newVal));
                    break;
                case 'DEFINE_ITEM':
                    prj.GetConfiguration().CustomDep_ModifyDefine(<string>item.val.value, newVal);
                    break;
                case 'LIB_ITEM':
                    prj.GetConfiguration().CustomDep_ModifyLib(prj.ToAbsolutePath(<string>item.val.value), prj.ToAbsolutePath(newVal));
                    break;
                default:
                    break;
            }
        }
    }

    async RemoveDependenceItem(item: ProjTreeItem) {

        if (item.val.value instanceof File)
            throw new Error('RemoveDependenceItem: Invalid context item');

        const msg = `${WARNING}: ${remove_this_item.replace('{}', item.val.value)}`;
        const choice = await vscode.window.showWarningMessage(msg, 'Yes', 'No');
        if (choice === undefined || choice === 'No')
            return undefined;

        const prj = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        switch ((<ModifiableDepInfo>item.val.obj).type) {
            case 'INC_ITEM':
                prj.GetConfiguration().CustomDep_RemoveIncDir(prj.ToAbsolutePath(item.val.value));
                break;
            case 'DEFINE_ITEM':
                prj.GetConfiguration().CustomDep_RemoveDefine(item.val.value);
                break;
            case 'LIB_ITEM':
                prj.GetConfiguration().CustomDep_RemoveLib(prj.ToAbsolutePath(item.val.value));
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

    async onConfigureToolchain(item: ProjTreeItem) {

        const project = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        const setting = SettingManager.GetInstance();

        let toolchainPathSettingName = setting.trimSettingTag(project.getToolchain().settingName);
        let toolchainPath = setting.getConfiguration().get(toolchainPathSettingName) || '';

        let cfg: SimpleUIConfig = {
            title: 'Toolchain Configurations',
            items: {
                'path': {
                    type: 'input',
                    attrs: {
                        singleLine: true,
                    },
                    name: 'Toolchain Path',
                    data: <SimpleUIConfigData_input>{
                        placeHolder: 'toolchain dir, like: ${userRoot}/.eide/tools/<toolchain_id>',
                        value: toolchainPath,
                        default: toolchainPath
                    }
                }
            }
        };

        let toolchainPrefix = setting.getGccFamilyToolPrefix(project.getToolchain().name);
        if (toolchainPrefix != undefined) {
            cfg.items['prefix'] = {
                type: 'input',
                attrs: {
                    singleLine: true,
                    size: 30,
                },
                name: 'Toolchain Prefix',
                data: <SimpleUIConfigData_input>{
                    placeHolder: 'like: arm-none-eabi-',
                    value: toolchainPrefix,
                    default: toolchainPrefix
                },
            };
        }

        WebPanelManager.instance().showSimpleConfigUI(cfg, async (newCfg) => {

            // update toolchain path
            setting.getConfiguration().update(
                toolchainPathSettingName, newCfg.items['path'].data.value, vscode.ConfigurationTarget.Workspace);

            // update toolchain prefix
            setting.setGccFamilyToolPrefix(project.getToolchain().name, newCfg.items['prefix'].data.value);
        });
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

    async fetchShellFlasher(item: ProjTreeItem) {

        const project = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        const resManager = ResManager.GetInstance();

        const err = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Setup Shell Flasher`,
            cancellable: true
        }, async (reporter, cancel): Promise<Error | undefined> => {

            try {

                const REPO_PATH = 'github0null/eide_shell_flasher_index';

                // get index.json
                //

                if (cancel.isCancellationRequested) {
                    return;
                }

                reporter.report({ message: 'fetching index.json' });
                const idxTxt = await readGithubRepoTxtFile(REPO_PATH, 'index.json');
                if (typeof idxTxt != 'string') {
                    throw idxTxt || new Error(`Cannot read index.json`);
                }

                const idxObj = <ShellFlasherIndexItem[]>JSON.parse(idxTxt);
                const pickItems: any[] = [];

                idxObj.forEach((item, idx) => {
                    if (item.platform.includes(osType())) {
                        let detail = item.detail || `no detail`;
                        if (item.provider) detail = detail + `, provider: ${item.provider}`;
                        pickItems.push(<vscode.QuickPickItem>{
                            idx: idx,
                            label: item.name,
                            detail: detail
                        });
                    }
                });

                // select flasher
                //

                if (cancel.isCancellationRequested) {
                    return;
                }

                reporter.report({ message: 'select flasher' });
                const sel = await vscode.window.showQuickPick(pickItems, {
                    title: 'Select Flasher',
                    matchOnDescription: true,
                    matchOnDetail: true,
                    canPickMany: false,
                    ignoreFocusOut: true
                });

                if (sel == undefined) {
                    return;
                }

                // install
                //

                if (cancel.isCancellationRequested) {
                    return;
                }

                const tarFlasher = idxObj[sel.idx];

                reporter.report({ message: 'download shell scripts' });

                // download and install flasher script
                const scriptsList = await readGithubRepoFolder(`https://api.github.com/repos/${REPO_PATH}/contents/scripts/${tarFlasher.id}`);
                if (scriptsList instanceof Error) {
                    if (scriptsList.message?.trim() != 'Not Found')
                        throw scriptsList;
                } else {
                    let scriptDir = new File(project.getRootDir().path);
                    if (tarFlasher.scriptInstallDir) scriptDir = File.fromArray([scriptDir.path, tarFlasher.scriptInstallDir]);
                    scriptDir.CreateDir(true);
                    for (const scriptInfo of scriptsList) {
                        if (scriptInfo.download_url) {
                            const buff = await downloadFile(redirectHost(scriptInfo.download_url));
                            if (!(buff instanceof Buffer)) throw buff || new Error(`Cannot download '${scriptInfo.name}'`);
                            fs.writeFileSync(`${scriptDir.path}/${scriptInfo.name}`, buff);
                        }
                    }
                }

                let needReload = false;
                if (tarFlasher.resources[osType()]) {

                    if (cancel.isCancellationRequested)
                        return;

                    const res = tarFlasher.resources[osType()];

                    let installDir: File;
                    let isFirstInstall: boolean = false;

                    if (res.locationType == 'workspace')
                        installDir = File.fromArray([project.getRootDir().path, res.location]);
                    else // global
                        installDir = File.fromArray([resManager.getEideToolsInstallDir(), res.location]);

                    // if have a resource and not install, download it
                    if (res.zipType != 'none' && installDir.IsDir() == false) {

                        reporter.report({ message: 'downloading resources' });
                        const buf = await downloadFile(redirectHost(res.url));
                        if (!(buf instanceof Buffer)) throw buf || new Error('Cannot download resource');
                        const tmpPath = os.tmpdir() + File.sep + Date.now().toString();
                        fs.writeFileSync(tmpPath, buf);

                        reporter.report({ message: 'unzip resources' });
                        installDir.CreateDir(true);
                        const szip = new SevenZipper();
                        const r = szip.UnzipSync(new File(tmpPath), installDir);
                        GlobalEvent.log_info(r);

                        isFirstInstall = true;
                    }

                    if (res.setupCommand) {
                        reporter.report({ message: 'execuate setup command ...' });
                        const done = await execInternalCommand(res.setupCommand, installDir.path, cancel);
                        if (!done) {
                            if (cancel.isCancellationRequested) {
                                GlobalEvent.emit('globalLog.append', `\n----- user canceled -----\n`);
                                return;
                            } else {
                                return new Error(`Setup command failed, see detail in 'OUTPUT panel' -> 'eide.log' !`);
                            }
                        }
                    }

                    needReload = isFirstInstall && res.locationType == 'global';
                }

                if (cancel.isCancellationRequested) {
                    return;
                }

                project.GetConfiguration().uploadConfigModel.SetKeyValue('bin', tarFlasher.flashConfigTemplate.bin);
                project.GetConfiguration().uploadConfigModel.SetKeyValue('commandLine', tarFlasher.flashConfigTemplate.commandLine);
                project.GetConfiguration().uploadConfigModel.SetKeyValue('eraseChipCommand', tarFlasher.flashConfigTemplate.eraseChipCommand);

                GlobalEvent.emit('msg', newMessage('Info', `Shell flasher '${tarFlasher.id}' has been setup !`));
                if (needReload) {
                    notifyReloadWindow(view_str$prompt$needReloadToUpdateEnv);
                }

                return;

            } catch (error) {
                return error;
            }
        });

        if (err) {
            GlobalEvent.emit('msg', ExceptionToMessage(err, 'Warning'));
        }
    }

    private async genDebugConfig_internal(
        type: 'jlink' | 'openocd' | 'pyocd',
        prj: AbstractProject, old_cfgs: any[]): Promise<{ debug_config: any, override_idx: number } | undefined> {

        const _elfPath = File.ToUnixPath(prj.getOutputDir()) + '/' + `${prj.getProjectName()}.elf`;
        const _debugConfigTemplates = {
            'jlink': {
                cwd: '${workspaceRoot}',
                type: 'cortex-debug',
                request: 'launch',
                name: `${prj.getProjectCurrentTargetName()}: JLINK`,
                servertype: 'jlink',
                interface: 'swd',
                executable: _elfPath,
                runToEntryPoint: "main",
                device: ''
            },
            'openocd': {
                cwd: '${workspaceRoot}',
                type: 'cortex-debug',
                request: 'launch',
                name: `${prj.getProjectCurrentTargetName()}: OpenOCD`,
                servertype: 'openocd',
                executable: _elfPath,
                runToEntryPoint: "main",
                configFiles: [
                ]
            },
            'pyocd': {
                cwd: '${workspaceRoot}',
                type: 'cortex-debug',
                request: 'launch',
                name: `${prj.getProjectCurrentTargetName()}: pyOCD`,
                servertype: 'pyocd',
                executable: _elfPath,
                runToEntryPoint: "main",
                targetId: '<mcu-name>',
                serverArgs: []
            }
        };

        const debugConfig: any = _debugConfigTemplates[type];

        /* set gdb toolchain */
        const toolchain = prj.getToolchain();
        if (toolchain.getToolchainPrefix) {
            debugConfig.toolchainPrefix = toolchain.getToolchainPrefix().trim().replace(/-$/, '');
        } else if (debugConfig.toolchainPrefix) {
            debugConfig.toolchainPrefix = undefined;
        }

        /* set svd file */
        const device = prj.GetPackManager().getCurrentDevInfo();
        if (device && device.svdPath && debugConfig.svdFile == undefined) {
            debugConfig.svdFile = prj.ToRelativePath(device.svdPath) || device.svdPath;
        }

        const isChinese = getLocalLanguageType() == LanguageIndexs.Chinese;
        const ui: SimpleUIConfig = {
            title: (isChinese ? '创建 Cortex-Debug ({}) 调试配置模板' : 'Create Cortex-Debug ({}) Configuration Template').replace('{}', type.toUpperCase()),
            viewColumn: vscode.ViewColumn.One,
            notTakeFocus: false,
            btns: {
                'submit': {
                    title: isChinese ? '新建' : 'Create',
                    hidden: false
                },
                'reset': {
                    title: '',
                    hidden: true
                }
            },
            items: {
                'name': {
                    type: 'input',
                    name: isChinese ? '名称' : 'Name',
                    attrs: { 'singleLine': true, 'size': 60 },
                    data: <SimpleUIConfigData_input>{
                        value: debugConfig.name
                    }
                },
                'request': {
                    type: 'options',
                    name: isChinese ? '调试模式' : 'Request',
                    attrs: {},
                    data: <SimpleUIConfigData_options>{
                        value: 0,
                        default: 0,
                        enum: ['launch', 'attach'],
                        enumDescriptions: isChinese ? ['启动', '附加'] : ['launch', 'attach'],
                    }
                }
            }
        };

        let uiResultConv: (data: SimpleUIConfig, debugConfig: any) => void = (a, b) => {
            throw new Error('uiResultConv NOT IMPLEMENT !');
        };

        /* For JLink */
        if (type == 'jlink') {

            if (prj.getUploaderType() == 'JLink') {
                const jlinkUploadConf = <JLinkOptions>prj.GetConfiguration().config.uploadConfig;
                debugConfig.interface = JLinkProtocolType[jlinkUploadConf.proType].toLowerCase();
                debugConfig.device    = jlinkUploadConf.cpuInfo.cpuName;
            }

            /* setup ui */
            ui.items['interface'] = {
                type: 'options',
                name: isChinese ? '接口类型' : 'Interface',
                attrs: {},
                data: <SimpleUIConfigData_options>{
                    value: debugConfig.interface == 'swd' ? 0 : 1,
                    default: 0,
                    enum: ['swd', 'jtag'],
                    enumDescriptions: ['SWD', 'JTAG'],
                }
            };
            ui.items['device'] = {
                type: 'input',
                name: isChinese ? '芯片型号' : 'Device Name',
                attrs: { 'singleLine': true, size: 30 },
                data: <SimpleUIConfigData_input>{
                    value: debugConfig.device,
                    placeHolder: 'STM32F103C8'
                },
            };
            uiResultConv = (data, outConfig) => {
                outConfig.interface = ['swd', 'jtag'][data.items['interface'].data.value];
                outConfig.device = data.items['device'].data.value;
            };
        }

        /* For OPENOCD */
        else if (type == 'openocd') {

            const toCfgPath = (typ: 'interface' | 'target', cfgname: string): string => {
                if (cfgname.trim() != '') {
                    let fpath: string = cfgname.startsWith('${workspaceFolder}/')
                        ? cfgname.replace('${workspaceFolder}/', '')
                        : `${typ}/${cfgname}`;
                    if (!fpath.endsWith('.cfg'))
                        fpath += '.cfg';
                    return fpath;
                }
                return '';
            };

            const interface_enums = [''].concat(openocd_getConfigList('interface', prj.getRootDir()).map(c => c.name));
            const target_enums = [''].concat(openocd_getConfigList('target', prj.getRootDir()).map(c => c.name));

            let inferface_default = 0;
            let target_default = 0;

            if (prj.getUploaderType() == 'OpenOCD') {
                const flasherConf = <OpenOCDFlashOptions>prj.GetConfiguration().config.uploadConfig;
                if (flasherConf.interface) {
                    (<any[]>debugConfig.configFiles).push(toCfgPath('interface', flasherConf.interface));
                    let idx = interface_enums.findIndex(n => n == flasherConf.interface);
                    if (idx != -1)
                        inferface_default = idx;
                }
                if (flasherConf.target) {
                    (<any[]>debugConfig.configFiles).push(toCfgPath('target', flasherConf.target));
                    let idx = target_enums.findIndex(n => n == flasherConf.target);
                    if (idx != -1)
                        target_default = idx;
                }
            }

            /* setup ui */
            ui.items['interface'] = {
                type: 'options',
                name: isChinese ? '接口' : 'Interface',
                attrs: {},
                data: <SimpleUIConfigData_options>{
                    value: inferface_default,
                    default: inferface_default,
                    enum: interface_enums,
                    enumDescriptions: interface_enums.map(n => n == '' ? 'None' : n),
                }
            };
            ui.items['target'] = {
                type: 'options',
                name: isChinese ? '目标' : 'Target',
                attrs: {},
                data: <SimpleUIConfigData_options>{
                    value: target_default,
                    default: target_default,
                    enum: target_enums,
                    enumDescriptions: target_enums.map(n => n == '' ? 'None' : n),
                }
            };
            uiResultConv = (data, outConfig) => {
                const cfgFiles: string[] = [];
                const i_idx = (<SimpleUIConfigData_options>data.items['interface'].data).value;
                const i_path = interface_enums[i_idx];
                if (i_path)
                    cfgFiles.push(toCfgPath('interface', i_path));
                const t_idx = (<SimpleUIConfigData_options>data.items['target'].data).value;
                const t_path = target_enums[t_idx];
                if (t_path)
                    cfgFiles.push(toCfgPath('target', t_path));
                outConfig.configFiles = cfgFiles;
            };
        }

        /* For PYOCD */
        else if (type == 'pyocd') {

            let target_idx_default = 0;
            let pyocd_config_path: string | undefined;

            if (prj.getUploaderType() == 'pyOCD') {
                const flasherConf = <PyOCDFlashOptions>prj.GetConfiguration().config.uploadConfig;
                debugConfig.targetId = flasherConf.targetName;
                if (flasherConf.config) {
                    pyocd_config_path = prj.toAbsolutePath(flasherConf.config);
                    if (File.IsFile(pyocd_config_path)) {
                        debugConfig.serverArgs = [
                            '--config', pyocd_config_path
                        ];
                    }
                }
            }

            const target_enums = await vscode.window.withProgress<string[] | Error>({
                location: vscode.ProgressLocation.Notification,
                title: 'Get pyOCD Targets List'
            }, () => {
                return new Promise((resolve) => {
                    try {
                        const r = pyocd_getTargetList(prj.getRootDir(), pyocd_config_path).map(t => <string>t['name']);
                        resolve(r);
                    } catch (error) {
                        resolve(error);
                    }
                });
            });

            if (target_enums instanceof Error)
                throw target_enums;
            if (target_enums == undefined)
                throw new Error(`pyocd_getTargetList -> target_enums is undefined`);

            const idx = target_enums.findIndex(t => t == debugConfig.targetId);
            if (idx != -1)
                target_idx_default = idx;

            /* setup ui */
            ui.items['target'] = {
                type: 'options',
                name: isChinese ? '目标' : 'Target',
                attrs: {},
                data: <SimpleUIConfigData_options>{
                    value: target_idx_default,
                    default: target_idx_default,
                    enum: target_enums,
                    enumDescriptions: target_enums,
                }
            };
            if (prj.getUploaderType() != 'pyOCD') {
                ui.items['config'] = {
                    type: 'input',
                    name: isChinese ? 'pyocd.yml 配置文件路径' : 'pyocd.yml Path',
                    attrs: { 'singleLine': true },
                    data: <SimpleUIConfigData_input>{
                        value: '',
                        placeHolder: './pyocd.yml'
                    },
                };
            }
            uiResultConv = (data, outConfig) => {
                const t_idx = (<SimpleUIConfigData_options>data.items['target'].data).value;
                const targetId = target_enums[t_idx];
                if (targetId)
                    outConfig.targetId = targetId;
                else
                    throw new Error(`targetId is null ! idx=${t_idx}`);
                if (data.items['config']) {
                    const _cfgPath = (<SimpleUIConfigData_input>data.items['config'].data).value;
                    if (_cfgPath) {
                        const absPath = prj.toAbsolutePath(_cfgPath);
                        outConfig.serverArgs = [
                            '--config', absPath
                        ];
                    }
                }
            };
        }

        return new Promise((resolve) => {

            WebPanelManager.instance().showSimpleConfigUI(ui,
                // on submited
                async (data, panel) => {

                    /* update configs */
                    debugConfig.name = data.items['name'].data.value;
                    debugConfig.request = ['launch', 'attach'][data.items['request'].data.value];
                    if (debugConfig.request == 'attach')
                        debugConfig.runToEntryPoint = undefined;
                    uiResultConv(data, debugConfig);

                    /* check override ? */
                    const idx = old_cfgs.findIndex(cfg => cfg.name == debugConfig.name);
                    if (idx != -1) {
                        const item = await vscode.window.showWarningMessage(
                            isChinese
                                ? `${WARNING}: 名称为 '${debugConfig.name}' 的调试配置已经存在，需要覆盖它吗？`
                                : `${WARNING}: Debugger Configuration '${debugConfig.name}' is already existed ! Override It ?`,
                            'Yes', 'No');
                        if (item === undefined || item === 'No') {
                            return 'canceled';
                        }
                    }

                    resolve({ debug_config: debugConfig, override_idx: idx });
                    setTimeout(() => panel.dispose(), 100);
                },
                // on msg
                (msg) => {
                });
        });
    }

    async genDebugConfigTemplate(item: ProjTreeItem, type: 'jlink' | 'openocd' | 'pyocd') {

        const project = this.dataProvider.GetProjectByIndex(item.val.projectIndex);
        const cfgfile = File.from(project.GetWorkspaceConfig().GetFile().dir, AbstractProject.vsCodeDir, 'launch.json');

        try {

            let cur_cfgs;
            if (cfgfile.IsFile())
                cur_cfgs = <any[]>jsonc_parser.parse(cfgfile.Read(), undefined, { allowTrailingComma: true }).configurations;
            else
                cur_cfgs = [];

            const result = await this.genDebugConfig_internal(type, project, cur_cfgs);
            if (!result) {
                return; // skip if user canceled
            }

            if (!cfgfile.IsFile()) {
                cfgfile.Write(JSON.stringify({
                    version: '0.2.0',
                    configurations: [result.debug_config]
                }, undefined, 4));
                vscode.window.showTextDocument(vscode.Uri.file(cfgfile.path), { preview: true });
                return;
            }

            /* merge debugConfig and write into launch.json */
            let edits: jsonc_parser.EditResult;
            let fmtOpts = <jsonc_parser.FormattingOptions>{ tabSize: 4, insertSpaces: true };
            let raw_cont = cfgfile.Read();
            if (result.override_idx != -1)
                edits = jsonc_parser.modify(raw_cont, ['configurations', result.override_idx], result.debug_config, { formattingOptions: fmtOpts });
            else
                edits = jsonc_parser.modify(raw_cont, ['configurations', 0], result.debug_config, { formattingOptions: fmtOpts, isArrayInsertion: true });
            cfgfile.Write(jsonc_parser.applyEdits(raw_cont, edits));

            /* show launch.json */
            const document = await vscode.workspace.openTextDocument(vscode.Uri.file(cfgfile.path));
            let cursorSel: vscode.Range | undefined;
            if (edits.length > 0) {
                const s = document.positionAt(edits[0].offset);
                const e = document.positionAt(edits[0].offset + edits[0].length);
                cursorSel = new vscode.Range(s, e);
            }
            vscode.window.showTextDocument(document, { preview: true, selection: cursorSel });
        } catch (error) {
            GlobalEvent.emit('error', error);
        }
    }

    private prev_click_info: ItemClickInfo | undefined = undefined;

    private async OnTreeItemClick(item: ProjTreeItem) {

        if (ProjTreeItem.isFileItem(item.type)) {

            const file = <File>item.val.value;

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

                if (item.val.isVirtualFile) {
                    const uri = vscode.Uri.parse(VirtualDocument.instance().getUriByPath(file.path));
                    VirtualDocument.instance().updateDocument(file.path);
                    vscode.window.showTextDocument(uri, { preview: isPreview });
                } else {
                    /* We need use 'vscode.open' command, not 'showTextDocument' API, 
                     * because API can't open bin file */
                    vscode.commands.executeCommand('vscode.open', vscode.Uri.file(file.path), { preview: isPreview });
                }

            } catch (error) {
                GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
            }
        }
    }

    private showBinaryFiles(binFile: File, isPreview?: boolean): boolean | undefined {

        try {

            // if not found, exited
            if (!binFile.IsExist()) return undefined;

            const suffix = binFile.suffix.toLowerCase();

            // show armcc axf file
            if (suffix == '.axf') {

                const fromelf = File.fromArray([
                    SettingManager.GetInstance().getArmcc5Dir().path, 'bin', `fromelf${exeSuffix()}`
                ]);

                let cont: string;

                try {
                    if (!fromelf.IsFile())
                        throw new Error(`Not found '${fromelf.path}' !`);
                    cont = child_process
                        .execFileSync(fromelf.path, ['--text', '-v', binFile.path], { maxBuffer: 50 * 1024 * 1024 })
                        .toString();
                } catch (error) {
                    const err = <Error>error;
                    cont = `${err.name}: ${err.message}\n${err.stack}`;
                }

                const vDoc = VirtualDocument.instance();
                const docName = `${binFile.path}.info`;
                vDoc.updateDocument(docName, cont);

                const uri = vscode.Uri.parse(vDoc.getUriByPath(docName));
                vscode.window.showTextDocument(uri, { preview: isPreview });

                return true;
            }

            // show gnu elf file
            else if (suffix == '.elf') {

                let readelf: string = 'arm-none-eabi-readelf';
                let elfsize: string = 'arm-none-eabi-size';

                const activePrj = this.getActiveProject();
                if (activePrj) {
                    const toolchain = activePrj.getToolchain();
                    if (!['AC5', 'AC6'].includes(toolchain.name) && toolchain.getToolchainPrefix) {
                        readelf = [toolchain.getToolchainDir().path, 'bin', `${toolchain.getToolchainPrefix()}readelf`].join(File.sep);
                        elfsize = [toolchain.getToolchainDir().path, 'bin', `${toolchain.getToolchainPrefix()}size`].join(File.sep);
                    }
                }

                let cont: string;

                try {
                    cont = child_process
                        .execFileSync(`${readelf}${exeSuffix()}`, ['-e', binFile.path], { maxBuffer: 50 * 1024 * 1024 })
                        .toString();
                } catch (error) {
                    const err = <Error>error;
                    cont = `${err.name}: ${err.message}\n${err.stack}`;
                }

                // show elf size
                try {
                    let tLines = child_process
                        .execFileSync(`${elfsize}${exeSuffix()}`, ['-A', binFile.path])
                        .toString().split(/\r\n|\n/g);
                    tLines = tLines.filter(s => s.trim() != '').map(s => `  ${s}`);
                    tLines.push(os.EOL);
                    tLines = [os.EOL + 'ELF Size:'].concat(tLines);
                    cont += tLines.join(os.EOL);
                } catch (error) {
                    // do nothing
                }

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

interface ModifiableYamlConfigProvider {

    id: string; // uid for this provider

    provideYamlDocument(project: AbstractProject, viewItem: ProjTreeItem, defFileName: string): Promise<File | Error | undefined>;

    onYamlDocSaved(doc: vscode.TextDocument): Promise<void>;

    onYamlDocClosed(doc: vscode.TextDocument): Promise<void>;

    getSourceProjectByFileName(filename: string): AbstractProject | undefined;
}

class VFolderSourcePathsModifier implements ModifiableYamlConfigProvider {

    id: string = 'src-path-cfg';

    // KV: <ymlFileName, {vFolderPath: string, project: EideProject}>
    private prjFolderSourceChangesMap: Map<string, { vFolderPath: string, project: AbstractProject }> = new Map();

    async provideYamlDocument(project: AbstractProject, item: ProjTreeItem, defFileName: string): Promise<File | Error | undefined> {

        const vSourceManager = project.getVirtualSourceManager();

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

            const repath = project.toRelativePath(path);
            const vFileInfo = vSourceManager.getFile(vInfo.path);
            if (vFileInfo) {
                vFileInfo.path = repath;
                const vDir = NodePath.dirname(vInfo.path);
                // we use 'notifyUpdateFolder', not 'notifyUpdateFile', 
                // because we need to update c/c++ intellisense config
                vSourceManager.notifyUpdateFolder(vDir);
            } else {
                return new Error(`Internal error: can't get obj from virtual path: '${vInfo.path}'`);
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

                let yamlFile: File;

                let oldName = getOldFileNameByProject(vInfo.path, project);
                if (oldName) {
                    yamlFile = File.fromArray([os.tmpdir(), oldName]);
                } else { // if file not exist, add to mapper
                    yamlFile = File.fromArray([os.tmpdir(), defFileName]);
                    this.prjFolderSourceChangesMap.set(yamlFile.name, { vFolderPath: vInfo.path, project: project });
                }

                const yamlLines: string[] = [
                    `#`,
                    `# You can modify files path by editing and saving this file (allow relative path).`,
                    `#`,
                    `# format:`,
                    '#     - path: ./src_1.c',
                    '#     - path: ../xxx/xxx/src_2.c',
                    '#     - path: xxx/${VAR}/src_3.c',
                    '#     - path: d:/path/xxx/src_n.c',
                    `#`,
                    ``,
                    yml.stringify(vFolderInfo.files, { indent: 4 })
                ];

                yamlFile.Write(yamlLines.join(os.EOL));

                return yamlFile;

            } else {
                return new Error(`Internal error: can't get obj from virtual path: '${vInfo.path}'`);
            }
        }
    }

    async onYamlDocSaved(doc: vscode.TextDocument): Promise<void> {

        const fileName = NodePath.basename(doc.uri.fsPath);
        const info = this.prjFolderSourceChangesMap.get(fileName);
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
                        path: info.project.toRelativePath(vFile.path)
                    };
                });
            }

            vFolderInfo.files = fileList || [];
            vSrcManger.notifyUpdateFolder(info.vFolderPath);

        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
        }
    }

    async onYamlDocClosed(doc: vscode.TextDocument): Promise<void> {

        // skip irrelevant files
        const fileName = NodePath.basename(doc.uri.fsPath);
        if (!this.prjFolderSourceChangesMap.has(fileName)) return;

        // do 
        try {
            this.prjFolderSourceChangesMap.delete(fileName); // remove from mapper
            fs.unlinkSync(`${os.tmpdir()}/${fileName}`);
        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Hidden'));
        }
    }

    getSourceProjectByFileName(filename: string): AbstractProject | undefined {
        return this.prjFolderSourceChangesMap.get(filename)?.project;
    }
}

class ProjectAttrModifier implements ModifiableYamlConfigProvider {

    id: string = 'prj-attr-cfg';

    // KV: <ymlFileName, EideProject>
    private prjCusDepChangesMap: Map<string, AbstractProject> = new Map();

    async provideYamlDocument(project: AbstractProject, viewItem: ProjTreeItem, defFileName: string): Promise<File | Error | undefined> {

        const prj = project;
        const cusDep = prj.GetConfiguration().CustomDep_getDependence();

        // gen deps yaml content
        const yamlLines: string[] = [
            `#`,
            `# You can modify the configuration by editing and saving this file.`,
            `#`,
            `# example:`,
            `#`,
            `# IncludeFolders:`,
            '#     - ./dir_1',
            '#     - ../xxx/xxx/dir_2',
            '#     - xxx/variable/path/${VAR1}/${VAR2}/dir_3',
            '#     - d:/absolute/path/xxx/dir_n',
            `# LibraryFolders:`,
            '#     - ./dir_1',
            '#     - ../xxx/xxx/dir_2',
            `# Defines:`,
            '#     - TEST',
            '#     - DEFINE_1=123',
            '#     - DEFINE_2=${VAR1}',
            '#',
        ];

        // fill data
        {
            // push include path
            yamlLines.push(
                ``,
                `# Header Include Path`,
                `IncludeFolders:`,
            );
            cusDep.incList.forEach((path) => {
                yamlLines.push(`    - ${prj.toRelativePath(path)}`)
            });

            // push lib folder path
            yamlLines.push(
                ``,
                `# Library Search Path`,
                `LibraryFolders:`,
            );
            cusDep.libList.forEach((path) => {
                yamlLines.push(`    - ${prj.toRelativePath(path)}`)
            });

            // push macros
            yamlLines.push(
                ``,
                `# Preprocessor Definitions`,
                `Defines:`,
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
            tmpFile = File.fromArray([os.tmpdir(), defFileName]);
            this.prjCusDepChangesMap.set(tmpFile.name, prj);
        }

        tmpFile.Write(yamlStr);

        return tmpFile;
    }

    async onYamlDocSaved(doc: vscode.TextDocument): Promise<void> {

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
                    .map((path: string) => prj.ToAbsolutePath(path, false));
                cusDep.incList = ArrayDelRepetition(li);
            } else {
                cusDep.incList = [];
            }

            // lib list
            if (Array.isArray(cfg.LibraryFolders)) {
                const li = cfg.LibraryFolders
                    .filter((path: any) => typeof (path) == 'string')
                    .map((path: string) => prj.ToAbsolutePath(path, false));
                cusDep.libList = ArrayDelRepetition(li);
            } else {
                cusDep.libList = [];
            }

            // macro list
            if (Array.isArray(cfg.Defines)) {
                const li = cfg.Defines.filter((path: any) => typeof (path) == 'string');
                cusDep.defineList = ArrayDelRepetition(li);
            } else {
                cusDep.defineList = [];
            }

            prj.GetConfiguration().CustomDep_NotifyChanged();

        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
        }
    }

    async onYamlDocClosed(doc: vscode.TextDocument): Promise<void> {

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

    getSourceProjectByFileName(filename: string): AbstractProject | undefined {
        return this.prjCusDepChangesMap.get(filename);
    }
}

class ProjectExcSourceModifier implements ModifiableYamlConfigProvider {

    id: string = 'src-exc-cfg';

    private yamlFilesMap: Map<string, AbstractProject> = new Map();

    async provideYamlDocument(project: AbstractProject, viewItem: ProjTreeItem, defFileName: string): Promise<File | Error | undefined> {

        const prj = project;

        // gen deps yaml content
        const yamlLines: string[] = [
            `#`,
            `# You can modify the configuration by editing and saving this file.`,
            `#`,
            '# format:',
            '#      - ./xxx/xxx_src_1.c',
            '#      - ../xx/a/b/x/xxx_src_2.c',
            '#      - <virtual_root>/virtual_folder_1/xxx_src_1.c',
            '#      - <virtual_root>/virtual_folder_1/dir/xxx_src_2.c',
            '#',
            ``,
        ];

        try {

            prj.GetConfiguration().config.excludeList.forEach((path) => {
                yamlLines.push(`- ${path}`);
            });

            const getOldNameByProject = (prj: AbstractProject) => {
                for (const KV of this.yamlFilesMap) {
                    if (KV[1].getWsPath().toLowerCase() == prj.getWsPath().toLowerCase()) {
                        return KV[0];
                    }
                }
            };

            const yamlStr = yamlLines.join(os.EOL);
            const oldName = getOldNameByProject(prj);

            let ymlFile: File;
            if (oldName) {
                ymlFile = File.fromArray([os.tmpdir(), oldName]);
            } else {
                ymlFile = File.fromArray([os.tmpdir(), defFileName]);
                this.yamlFilesMap.set(ymlFile.name, prj);
            }

            ymlFile.Write(yamlStr);

            return ymlFile;

        } catch (error) {
            return error;
        }
    }

    async onYamlDocSaved(doc: vscode.TextDocument): Promise<void> {

        const yamlFile = new File(doc.uri.fsPath);

        const prj = this.yamlFilesMap.get(yamlFile.name);
        if (!prj) return;

        try {
            const excList = yml.parse(yamlFile.Read());
            if (!Array.isArray(excList)) { throw new Error(`Type error, exclude list must be an array !`); }
            const newExcLi = excList.map(p => File.ToUnixPath(p));
            const oldExcLi = prj.GetConfiguration().config.excludeList;
            prj.GetConfiguration().config.excludeList = newExcLi;
            prj.notifySourceExplorerViewRefresh();
            // update filesystem source link
            const diffNew2Old = newExcLi.filter(p => !oldExcLi.includes(p));
            const diffOld2New = oldExcLi.filter(p => !newExcLi.includes(p));
            const needUpdateLi = ArrayDelRepetition(diffNew2Old.concat(diffOld2New)).filter(p => !p.startsWith(VirtualSource.rootName));
            needUpdateLi.forEach(dir => prj.getNormalSourceManager().notifyUpdateFolder(prj.ToAbsolutePath(dir)));
        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
        }
    }

    async onYamlDocClosed(doc: vscode.TextDocument): Promise<void> {

        const fileName = NodePath.basename(doc.uri.fsPath);
        const prj = this.yamlFilesMap.get(fileName);
        if (!prj) return;

        try {
            this.yamlFilesMap.delete(fileName);
            fs.unlinkSync(`${os.tmpdir()}/${fileName}`);
        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Hidden'));
        }
    }

    getSourceProjectByFileName(filename: string): AbstractProject | undefined {
        return this.yamlFilesMap.get(filename);
    }
}
