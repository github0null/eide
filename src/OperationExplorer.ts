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

import { GlobalEvent } from './GlobalEvents';
import { ResManager } from './ResManager';
import {
    open_project, open_project_hit, create_project, create_project_hit,
    select_out_dir, input_project_name, select_a_template_file, from_disk_desp,
    from_remote_repo_desp, template_location_desp, view_str$operation$open_serialport,
    found_cache_desc, view_str$operation$name_can_not_be_blank,
    view_str$operation$name_can_not_have_invalid_char, view_str$operation$select_prj_type,
    view_str$operation$setToolchainPath, view_str$operation$setKeil51Path, view_str$operation$setMDKPath,
    view_str$operation$setToolchainInstallDir,
    view_str$placeHolder$selectCategory,
    view_str$operation$create_empty_project,
    view_str$operation$create_from_internal_temp,
    view_str$operation$empty_8bit_prj,
    view_str$operation$empty_cortex_prj,
    import_project_hit, view_str$import_project, view_str$operation$import_sel_out_folder, view_str$operation$empty_riscv_prj,
    view_str$operation$create_from_remote_repo, view_str$operation$create_from_local_disk, view_str$operation$create_empty_project_detail,
    view_str$operation$create_from_internal_temp_detail, view_str$operation$create_from_local_disk_detail,
    view_str$operation$create_from_remote_repo_detail, view_str$operation$openSettings,
    view_str$prompt$select_file, view_str$prompt$select_folder, view_str$prompt$select_file_or_folder, view_str$prompt$select_tool_install_mode,
    view_str$prompt$tool_install_mode_online, view_str$prompt$tool_install_mode_local, view_str$operation$empty_anygcc_prj, view_str$operation$setupUtilTools,
    view_str$prompt$setupToolchainPrefix,
    view_str$prompt$needReloadToUpdateEnv,
    view_str$operation$create_prj_done,
    view_str$prompt$requestAndActivateLicence,
    view_str$operation$empty_mips_prj,
    view_str$operation$onlineHelp,
    view_str$operation$onlineHelpTooltip
} from './StringTable';
import { CreateOptions, ImportOptions, ProjectType } from './EIDETypeDefine';
import { File } from '../lib/node-utility/File';
import { SettingManager, CheckStatus } from './SettingManager';
import { NetRequest, NetResponse } from '../lib/node-utility/NetRequest';
import { ExceptionToMessage, newMessage } from './Message';
import { ToolchainName, ToolchainManager } from './ToolchainManager';
import { GitFileInfo } from './WebInterface/GithubInterface';
import { TemplateIndexDef, TemplateInfo } from './WebInterface/WebInterface';
import * as utility from './utility';
import * as toolchainLicence from './ToolchainLicenceActivate';

import * as events from 'events';
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as NodePath from 'path';
import { ResInstaller, ExternalToolName } from './ResInstaller';
import { AbstractProject } from './EIDEProject';
import { WorkspaceManager } from './WorkspaceManager';
import * as child_process from 'child_process';

interface TemplatePickItem extends vscode.QuickPickItem, TemplateInfo {
    cacheFileName: string | undefined;
}

interface TemplateGroup {
    name: string;
    dispName: string | undefined;
    desc: string | undefined;
    templates: TemplatePickItem[];
    children: TemplateGroup[];
}

interface CategoryPickItem extends vscode.QuickPickItem {
    name: string;
}

export class OperationDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {

    private eventSender: vscode.EventEmitter<any>;

    private itemList: Array<vscode.TreeItem>;

    onDidChangeTreeData?: vscode.Event<vscode.TreeItem> | undefined;

    constructor() {
        this.itemList = new Array<vscode.TreeItem>();
        this.eventSender = new vscode.EventEmitter<any>();
        this.onDidChangeTreeData = this.eventSender.event;
    }

    ClearAll() {
        this.itemList = [];
    }

    AddData(newItem: vscode.TreeItem) {
        this.itemList.push(newItem);
    }

    Remove(index: number) {
        if (index !== -1) {
            this.itemList.splice(index, 1);
        }
    }

    GetIndex(command: string): number {
        return this.itemList.findIndex(v => {
            if (v.command !== undefined) {
                return v.command.command === command;
            } else {
                return false;
            }
        });
    }

    Update() {
        this.eventSender.fire(undefined);
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
        return element;
    }

    getChildren(element?: vscode.TreeItem | undefined): vscode.ProviderResult<vscode.TreeItem[]> {
        if (element === undefined) {
            return this.itemList;
        }
    }
}

interface ProjectTemplatePickItem extends vscode.QuickPickItem {
    type: ProjectType;
    templateName?: string;
}

interface ToolchainDespPickItem extends vscode.QuickPickItem {
    type: ToolchainName;
}

export class OperationExplorer {

    private provider: OperationDataProvider;
    private view: vscode.TreeView<vscode.TreeItem>;
    private _event: events.EventEmitter;
    private _context: vscode.ExtensionContext;

    private statusIconMap: Map<number, string>;

    on(event: 'request_open_project', listener: (fsPath: string) => void): void;
    on(event: 'request_create_project', listener: (option: CreateOptions) => void): void;
    on(event: 'request_create_from_template', listener: (option: CreateOptions) => void): void;
    on(event: 'request_import_project', listener: (option: ImportOptions) => void): void;
    on(event: any, listener: (arg?: any) => void): void {
        this._event.on(event, listener);
    }

    private emit(event: 'request_open_project', fsPath: string): void;
    private emit(event: 'request_create_project', option: CreateOptions): void;
    private emit(event: 'request_create_from_template', option: CreateOptions): void;
    private emit(event: 'request_import_project', option: ImportOptions): void;
    private emit(event: any, arg?: any): void {
        this._event.emit(event, arg);
    }

    //---

    constructor(context: vscode.ExtensionContext) {

        this._context = context;
        this._event = new events.EventEmitter();
        this.provider = new OperationDataProvider();

        this.statusIconMap = new Map<number, string>();
        this.statusIconMap.set(CheckStatus.All_Failed, 'StatusCriticalError_16x.svg');
        this.statusIconMap.set(CheckStatus.Section_Failed, 'StatusWarning_16x.svg');
        this.statusIconMap.set(CheckStatus.All_Verified, 'StatusOK_16x.svg');

        this.view = vscode.window.createTreeView('cl.eide.view.operations', { treeDataProvider: this.provider });
        this.UpdateView();

        SettingManager.GetInstance().on('onChanged', () => {
            this.UpdateView();
        });
    }

    onDispose() {
        this.view.dispose();
    }

    private UpdateView() {

        this.provider.ClearAll();

        const resManager = ResManager.GetInstance();

        let icoPath = resManager.GetIconByName('AddBuildQueue_16x.svg');
        this.provider.AddData({
            label: create_project,
            command: {
                title: create_project,
                command: '_cl.eide.Operation.Create'
            },
            tooltip: create_project_hit,
            iconPath: vscode.Uri.file(icoPath.path)
        });

        icoPath = resManager.GetIconByName('OpenFileFromProject_16x.svg');
        this.provider.AddData({
            label: open_project,
            command: {
                title: open_project,
                command: '_cl.eide.Operation.Open'
            },
            tooltip: open_project_hit,
            iconPath: vscode.Uri.file(icoPath.path)
        });

        icoPath = resManager.GetIconByName('Import_16x.svg');
        this.provider.AddData({
            label: view_str$import_project,
            command: {
                title: view_str$import_project,
                command: '_cl.eide.Operation.Import'
            },
            tooltip: import_project_hit,
            iconPath: vscode.Uri.file(icoPath.path)
        });

        //---

        // @deprecated 暂时弃用，isToolchainPathReady 查询会影响启动速度
        // const tcList: ToolchainName[] = ['AC5', 'AC6', 'GCC', 'IAR_ARM', 'IAR_STM8', 'SDCC', 'Keil_C51', 'RISCV_GCC', 'ANY_GCC'];
        // const toolchainManager = ToolchainManager.getInstance();
        // const status: CheckStatus = tcList.some((tcName) => toolchainManager.isToolchainPathReady(tcName))
        //     ? CheckStatus.All_Verified
        //     : CheckStatus.All_Failed;
        // vscode.commands.executeCommand('setContext', 'cl.eide.toolchain_ready', status != CheckStatus.All_Failed);
        // icoPath = resManager.GetIconByName(<string>this.statusIconMap.get(status));
        icoPath = resManager.GetIconByName('Toolbox_16x.svg');
        this.provider.AddData({
            label: view_str$operation$setToolchainPath,
            command: {
                title: view_str$operation$setToolchainPath,
                command: '_cl.eide.Operation.SetToolchainPath'
            },
            tooltip: view_str$operation$setToolchainPath,
            iconPath: vscode.Uri.file(icoPath.path)
        });

        //---

        icoPath = resManager.GetIconByName('PatchPackage_16x.svg');
        this.provider.AddData({
            label: view_str$operation$setupUtilTools,
            command: {
                title: 'Setup Utility Tools',
                command: '_cl.eide.Operation.SetupUtilTools'
            },
            tooltip: view_str$operation$setupUtilTools,
            iconPath: vscode.Uri.file(icoPath.path)
        });

        //---

        icoPath = resManager.GetIconByName('Settings_16x.svg');
        this.provider.AddData({
            label: view_str$operation$openSettings,
            command: {
                title: view_str$operation$openSettings,
                command: '_cl.eide.Operation.openSettings'
            },
            tooltip: view_str$operation$openSettings,
            iconPath: vscode.Uri.file(icoPath.path)
        });

        icoPath = resManager.GetIconByName('StatusHelp_16x.svg');
        this.provider.AddData({
            label: view_str$operation$onlineHelp,
            command: {
                title: view_str$operation$onlineHelp,
                command: '_cl.eide.Operation.onlineHelp'
            },
            tooltip: view_str$operation$onlineHelpTooltip,
            iconPath: vscode.Uri.file(icoPath.path)
        });

        this.provider.Update();
    }

    //--------------- event -----------------

    OnOpenProject() {

        vscode.window.showOpenDialog({
            openLabel: open_project_hit,
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'vscode workspace': ['code-workspace']
            }
        }).then((uri: vscode.Uri[] | undefined) => {
            if (uri !== undefined) {
                this.emit('request_open_project', uri[0].fsPath);
            }
        });
    }

    async OnCreateProject() {

        const prj_type = await vscode.window.showQuickPick([
            {
                label: view_str$operation$create_empty_project,
                type: 'empty-project',
                detail: view_str$operation$create_empty_project_detail
            },
            {
                label: view_str$operation$create_from_internal_temp,
                type: 'internal-template',
                detail: view_str$operation$create_from_internal_temp_detail
            },
            {
                label: view_str$operation$create_from_local_disk,
                type: 'disk-template',
                detail: view_str$operation$create_from_local_disk_detail
            },
            {
                label: view_str$operation$create_from_remote_repo,
                type: 'online-template',
                detail: view_str$operation$create_from_remote_repo_detail
            }
        ], { placeHolder: view_str$operation$select_prj_type });

        if (prj_type === undefined) {
            return; // not select, exit
        }

        let templateItem: ProjectTemplatePickItem | undefined;

        switch (prj_type.type) {

            case 'empty-project':
                {
                    const itemList: ProjectTemplatePickItem[] = [
                        {
                            label: view_str$operation$empty_8bit_prj,
                            detail: 'for 8051, stm8, pic ... chips',
                            type: 'C51'
                        },
                        {
                            label: view_str$operation$empty_cortex_prj,
                            detail: 'for cortex-m chips',
                            type: 'ARM'
                        },
                        {
                            label: view_str$operation$empty_riscv_prj,
                            detail: 'for risc-v chips',
                            type: 'RISC-V'
                        },
                        {
                            label: view_str$operation$empty_mips_prj,
                            detail: 'for mips chips',
                            type: 'MIPS'
                        },
                        {
                            label: view_str$operation$empty_anygcc_prj,
                            detail: 'for any gcc famliy toolchains',
                            type: 'ANY-GCC'
                        }
                    ];

                    templateItem = await vscode.window.showQuickPick(itemList);

                    if (templateItem && templateItem.type == 'C51') {

                        const itemList: ProjectTemplatePickItem[] = [
                            {
                                label: 'Empty Project',
                                detail: 'empty project for any 8bits toolchain',
                                type: 'C51'
                            },
                            {
                                label: '8051 Empty Project (Keil C51 Compiler)',
                                detail: '8051 empty project',
                                templateName: 'mcs51',
                                type: 'C51'
                            },
                            {
                                label: 'STM8 Empty Project (COSMIC Compiler)',
                                detail: 'stm8 empty project',
                                templateName: 'cosmic_stm8_empty',
                                type: 'C51'
                            },
                        ];

                        templateItem = await vscode.window.showQuickPick(itemList);
                    }
                }
                break;

            case 'internal-template':
                {
                    const itemList: ProjectTemplatePickItem[] = [
                        {
                            label: '8051 Quickstart',
                            detail: 'Universal 8051 quickstart project (Keil C51 Compiler)',
                            templateName: 'mcs51',
                            type: 'C51'
                        },
                        {
                            label: '89C52 SDCC Quickstart',
                            detail: '89c52 quickstart project (SDCC)',
                            templateName: '89c52_sdcc',
                            type: 'C51'
                        },
                        {
                            label: 'STC15 Keil_C51 Quickstart',
                            detail: 'stc15 quickstart project (Keil C51 Compiler)',
                            templateName: 'stc15',
                            type: 'C51'
                        },
                        {
                            label: 'AVR FreeRTOS Quickstart',
                            detail: 'avr atmega128 quickstart project (FreeRTOS) (WinAVR-GCC)',
                            templateName: 'avr_atmega128_rtos',
                            type: 'ANY-GCC'
                        },
                        {
                            label: 'STM8S COSMIC Quickstart',
                            detail: 'stm8s quickstart project (STM8S003,STM8S005,STM8S103) (COSMIC STM8 Compiler)',
                            templateName: 'stm8s_cosmic_quickstart',
                            type: 'C51'
                        },
                        {
                            label: 'STM8 IAR Quickstart',
                            detail: 'stm8s103 quickstart project (IAR STM8 Compiler)',
                            templateName: 'stm8s103f3',
                            type: 'C51'
                        },
                        {
                            label: 'STM8 SDCC Quickstart',
                            detail: 'stm8s103 quickstart project (SDCC)',
                            templateName: 'stm8s103_sdcc',
                            type: 'C51'
                        },
                        {
                            label: 'STM32F103 Cortex-M3 Quickstart',
                            detail: 'stm32f1xx gcc quickstart project (ARM GCC)',
                            templateName: 'stm32f1xx_gcc',
                            type: 'ARM'
                        },
                        {
                            label: 'GD32VF103 RISC-V Quickstart',
                            detail: 'gd32vf103 riscv quickstart project (RISC-V GCC)',
                            templateName: 'gd32vf103_riscv',
                            type: 'RISC-V'
                        }
                    ];

                    templateItem = await vscode.window.showQuickPick(itemList);
                }
                break;

            // get template from disk
            case 'disk-template':
                this.OnCreateFromDiskTemplate();
                return; // exit

            // if create from github, jump
            case 'online-template':
                this.OnCreateFromGithubTemplate();
                return; // exit

            default:
                GlobalEvent.emit('msg', newMessage('Warning', `unkown project type ${prj_type.type} !`));
                return; // exit
        }

        // not select, exit
        if (templateItem === undefined) {
            return;
        }

        // require project name
        const name = await vscode.window.showInputBox({
            placeHolder: input_project_name,
            ignoreFocusOut: true,
            value: templateItem.templateName ? `${templateItem.templateName}-quickstart` : 'NewProject1',
            validateInput: (name) => AbstractProject.validateProjectName(name)
        });
        if (name === undefined) {
            return;
        }

        // require project output folder
        const outDir = await vscode.window.showOpenDialog({
            openLabel: select_out_dir,
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false
        });

        if (outDir === undefined) {
            return;
        }

        if (templateItem.templateName) { // create from internal template

            this.emit('request_create_from_template', {
                type: <any>null, // ignore it
                name: name,
                outDir: new File(outDir[0].fsPath),
                templateFile: File.fromArray([
                    ResManager.GetInstance().GetTemplateDir().path, `${templateItem.templateName}.ept`
                ]),
            });

        } else { // create empty project

            this.emit('request_create_project', {
                type: templateItem.type,
                name: name,
                outDir: new File(outDir[0].fsPath)
            });
        }
    }

    async OnImportProject(): Promise<void> {

        const ideType = await vscode.window.showQuickPick<vscode.QuickPickItem>([
            {
                label: 'MDK',
                description: 'arm, 8051 projects',
                detail: `Import Keil MDK Projects (Only Keil v5+)`
            },
            {
                label: 'IAR Workbench',
                description: 'arm projects',
                detail: `Import IAR ARM Projects (IAR Workbench Version >= v7.80.2)`
            },
            {
                label: 'Eclipse',
                description: 'embedded gcc projects',
                detail: `Import Eclipse Projects`
            }
        ], { placeHolder: `Select Project Type` });

        if (!ideType)
            return;

        //
        // for MDK project
        //
        if (ideType.label == "MDK") {

            const prod_type = await vscode.window.showQuickPick<any>([
                {
                    label: 'ARM',
                    detail: `Keil ARM Project`,
                    value: 'arm'
                },
                {
                    label: 'C51',
                    detail: `Keil C51 Project`,
                    value: 'c51'
                }
            ], { placeHolder: `Select MDK Product Type` });
    
            if (!prod_type)
                return;

            const prjFileUri = await vscode.window.showOpenDialog({
                openLabel: 'Import',
                canSelectFolders: false,
                canSelectFiles: true,
                canSelectMany: false,
                filters: {
                    'Keil Project': ['uvprojx', 'uvproj']
                }
            });

            if (prjFileUri === undefined || prjFileUri.length === 0) {
                return;
            }

            const selection = await vscode.window.showInformationMessage(
                view_str$operation$import_sel_out_folder,
                'Yes', 'No'
            );

            const orgPrjRoot = new File(NodePath.dirname(prjFileUri[0].fsPath));

            const importOption: ImportOptions = {
                type: 'mdk',
                mdk_prod: prod_type.value,
                projectFile: new File(prjFileUri[0].fsPath),
                outDir: orgPrjRoot,
                createNewFolder: false
            };

            // coexist with Keil project ?, if not, redirect output folder
            if (selection === 'No') {

                const folderUri = await vscode.window.showOpenDialog({
                    openLabel: 'Select',
                    defaultUri: vscode.Uri.parse(orgPrjRoot.ToUri()),
                    canSelectFolders: true,
                    canSelectFiles: false,
                    canSelectMany: false
                });

                if (folderUri === undefined || folderUri.length === 0) {
                    return;
                }

                importOption.outDir = new File(folderUri[0].fsPath);
                importOption.createNewFolder = true; // we need create a new folder
            }

            // emit event
            this.emit('request_import_project', importOption);
        }

        //
        // for Eclipse
        //
        else if (ideType.label == "Eclipse") {

            const prjFileUri = await vscode.window.showOpenDialog({
                openLabel: 'Import',
                canSelectFolders: false,
                canSelectFiles: true,
                canSelectMany: false,
                filters: {
                    'Eclipse': ['cproject']
                }
            });

            if (!prjFileUri || prjFileUri.length == 0)
                return;

            const importOpts: ImportOptions = {
                type: 'eclipse',
                projectFile: new File(prjFileUri[0].fsPath),
                createNewFolder: false
            };

            // emit event
            this.emit('request_import_project', importOpts);
        }

        //
        // for IAR projects
        //
        else if (ideType.label.startsWith('IAR')) {

            const prjFileUri = await vscode.window.showOpenDialog({
                openLabel: 'Import',
                canSelectFolders: false,
                canSelectFiles: true,
                canSelectMany: false,
                filters: {
                    'IAR Workbench': ['eww']
                }
            });

            if (!prjFileUri || prjFileUri.length == 0)
                return;

            const importOpts: ImportOptions = {
                type: 'iar',
                projectFile: new File(prjFileUri[0].fsPath),
                createNewFolder: false
            };

            // emit event
            this.emit('request_import_project', importOpts);
        }
    }

    private getStatusTxt(status: boolean): string {
        return status ? '✔' : '✘';
    }

    private _SelectToolchain(): Promise<ToolchainDespPickItem | undefined> {

        return new Promise((resolve) => {

            const settingManager = SettingManager.GetInstance();
            const toolchainManager = ToolchainManager.getInstance();
            const resManager = ResManager.GetInstance();

            const toolchainPickItems: ToolchainDespPickItem[] = [
                {
                    type: 'None',
                    label: 'MCS51/STM8/8Bit Compiler',
                    kind: vscode.QuickPickItemKind.Separator,
                },
                {
                    label: 'Keil C51 (cx51) (ide path)',
                    type: 'Keil_C51',
                    description: this.getStatusTxt(toolchainManager.isToolchainPathReady('Keil_C51'))
                        + ` Loc: ${toolchainManager.getToolchainExecutableFolder('Keil_C51')?.path}`,
                    detail: view_str$operation$setKeil51Path
                },
                {
                    label: 'IAR For STM8 (iccstm8) (ide path)',
                    type: 'IAR_STM8',
                    description: this.getStatusTxt(toolchainManager.isToolchainPathReady('IAR_STM8'))
                        + ` Loc: ${toolchainManager.getToolchainExecutableFolder('IAR_STM8')?.path}`,
                    detail: view_str$operation$setToolchainInstallDir.replace('${name}', 'IAR For STM8')
                },
                {
                    label: 'Small Device C Compiler (sdcc)',
                    type: 'SDCC',
                    description: this.getStatusTxt(toolchainManager.isToolchainPathReady('SDCC'))
                        + ` Loc: ${toolchainManager.getToolchainExecutableFolder('SDCC')?.path}`,
                    detail: view_str$operation$setToolchainInstallDir.replace('${name}', 'SDCC')
                },
                {
                    label: 'COSMIC STM8 C Compiler (cxstm8)',
                    type: 'COSMIC_STM8',
                    description: this.getStatusTxt(toolchainManager.isToolchainPathReady('COSMIC_STM8'))
                        + ` Loc: ${toolchainManager.getToolchainExecutableFolder('COSMIC_STM8')?.path}`,
                    detail: view_str$operation$setToolchainInstallDir.replace('${name}', 'COSMIC_STM8'),
                    buttons: [
                        {
                            iconPath: vscode.Uri.file(resManager.GetIconByName('Login_16x.svg').path),
                            tooltip: view_str$prompt$requestAndActivateLicence
                        }
                    ]
                },
                /* {
                    label: 'SDCC With GNU Patch For STM8 (Only for stm8)',
                    type: 'GNU_SDCC_STM8',
                    description: this.getStatusTxt(toolchainManager.isToolchainPathReady('GNU_SDCC_STM8')),
                    detail: view_str$operation$setToolchainInstallDir.replace('${name}', 'GNU_SDCC_STM8')
                }, */

                // armcc (non-free)
                {
                    type: 'None',
                    label: 'Arm C/C++ Compiler (non-free)',
                    kind: vscode.QuickPickItemKind.Separator,
                },
                {
                    label: 'Keil MDK (ide path) (used to locate armcc compiler path)',
                    type: 'AC5',
                    description: this.getStatusTxt(settingManager.isMDKIniReady()),
                    detail: view_str$operation$setMDKPath
                },
                {
                    label: 'ARMCC V5 (armcc) (standalone toolchain)',
                    type: 'AC5',
                    description: this.getStatusTxt(toolchainManager.isToolchainPathReady('AC5'))
                        + ` Loc: ${toolchainManager.getToolchainExecutableFolder('AC5')?.path}`,
                    detail: view_str$operation$setToolchainInstallDir.replace('${name}', 'ARMCC V5 Toolchain')
                },
                {
                    label: 'ARMCC V6 (armclang) (standalone toolchain)',
                    type: 'AC6',
                    description: this.getStatusTxt(toolchainManager.isToolchainPathReady('AC6'))
                        + ` Loc: ${toolchainManager.getToolchainExecutableFolder('AC6')?.path}`,
                    detail: view_str$operation$setToolchainInstallDir.replace('${name}', 'ARMCC V6 Toolchain')
                },
                {
                    label: 'IAR ARM C/C++ Compiler (iccarm) (standalone toolchain)',
                    type: 'IAR_ARM',
                    description: this.getStatusTxt(toolchainManager.isToolchainPathReady('IAR_ARM'))
                        + ` Loc: ${toolchainManager.getToolchainExecutableFolder('IAR_ARM')?.path}`,
                    detail: view_str$operation$setToolchainInstallDir.replace('${name}', 'IAR ARM C/C++ Compiler')
                },

                // gcc family
                {
                    type: 'None',
                    label: 'GCC Family Compiler (free)',
                    kind: vscode.QuickPickItemKind.Separator,
                },
                {
                    label: `GNU Arm Embedded Toolchain (${toolchainManager.getToolchainPrefix('GCC')}gcc)`,
                    type: 'GCC',
                    description: this.getStatusTxt(toolchainManager.isToolchainPathReady('GCC'))
                        + ` Loc: ${toolchainManager.getToolchainExecutableFolder('GCC')?.path}`,
                    detail: view_str$operation$setToolchainInstallDir.replace('${name}', `GNU Arm Embedded Toolchain`),
                    buttons: [
                        {
                            iconPath: vscode.Uri.file(resManager.GetIconByName('EditTitleString_16x.svg').path),
                            tooltip: view_str$prompt$setupToolchainPrefix
                        }
                    ]
                },
                {
                    label: `RISC-V GCC Toolchain (${toolchainManager.getToolchainPrefix('RISCV_GCC')}gcc)`,
                    type: 'RISCV_GCC',
                    description: this.getStatusTxt(toolchainManager.isToolchainPathReady('RISCV_GCC'))
                        + ` Loc: ${toolchainManager.getToolchainExecutableFolder('RISCV_GCC')?.path}`,
                    detail: view_str$operation$setToolchainInstallDir.replace('${name}', `RISC-V GCC Toolchain`),
                    buttons: [
                        {
                            iconPath: vscode.Uri.file(resManager.GetIconByName('EditTitleString_16x.svg').path),
                            tooltip: view_str$prompt$setupToolchainPrefix
                        }
                    ]
                },
                {
                    label: 'MIPS MTI GCC Compiler',
                    type: 'MTI_GCC',
                    description: this.getStatusTxt(toolchainManager.isToolchainPathReady('MTI_GCC'))
                        + ` Loc: ${toolchainManager.getToolchainExecutableFolder('MTI_GCC')?.path}`,
                    detail: view_str$operation$setToolchainInstallDir.replace('${name}', 'MTI_GCC'),
                },
                {
                    label: `Universal GCC Toolchain (${toolchainManager.getToolchainPrefix('ANY_GCC')}gcc)`,
                    type: 'ANY_GCC',
                    description: this.getStatusTxt(toolchainManager.isToolchainPathReady('ANY_GCC'))
                        + ` Loc: ${toolchainManager.getToolchainExecutableFolder('ANY_GCC')?.path}`,
                    detail: view_str$operation$setToolchainInstallDir.replace('${name}', `ANY GCC Toolchain`),
                    buttons: [
                        {
                            iconPath: vscode.Uri.file(resManager.GetIconByName('EditTitleString_16x.svg').path),
                            tooltip: view_str$prompt$setupToolchainPrefix
                        }
                    ]
                }
            ];

            const picker = vscode.window.createQuickPick<ToolchainDespPickItem>();

            {
                picker.title = view_str$operation$setToolchainPath;
                picker.placeholder = 'Click one toolchain to setup it';
                picker.canSelectMany = false;
                picker.items = toolchainPickItems;
                picker.matchOnDescription = true;
                picker.matchOnDetail = true;
                picker.ignoreFocusOut = true;
            }

            let selected: ToolchainDespPickItem | undefined;

            picker.onDidChangeSelection((items) => {
                selected = items.length > 0 ? items[0] : undefined;
            });

            picker.onDidTriggerItemButton(async (ctx) => {

                if (ctx.button.tooltip == view_str$prompt$setupToolchainPrefix) {

                    const toolchain = toolchainManager.getToolchainByName(ctx.item.type);

                    if (toolchain == undefined)
                        return;

                    if (toolchain?.getToolchainPrefix == undefined) {
                        GlobalEvent.emit('msg', newMessage('Warning', `Not support modify prefix for toolchain: '${toolchain.name}'`));
                        return;
                    }

                    const val = await vscode.window.showInputBox({
                        title: view_str$prompt$setupToolchainPrefix + ' (Global)',
                        value: toolchain.getToolchainPrefix(),
                        ignoreFocusOut: true,
                        placeHolder: 'Input a new toolchain prefix'
                    });

                    if (val != undefined) {
                        settingManager.setGccFamilyToolPrefix(toolchain.name, val, true);
                        utility.notifyReloadWindow(view_str$prompt$needReloadToUpdateEnv);
                    }
                }

                if (ctx.button.tooltip == view_str$prompt$requestAndActivateLicence) {

                    picker.hide();
                    picker.dispose();

                    toolchainLicence.requestAndActivateLicence(ctx.item.type);
                }
            });

            picker.onDidAccept(() => {
                picker.hide();
                picker.dispose();
                resolve(selected);
            });

            picker.show();
        });
    }

    async OnSetToolchainPath() {

        const settingManager = SettingManager.GetInstance();

        const item = await this._SelectToolchain();
        if (item == undefined) {
            return;
        }

        /* select install mode */

        const resInstaller = ResInstaller.instance();
        const tool = resInstaller.getTool(item.type);
        if (tool && !tool.no_binaries) { /* have online package */

            const pickItems: vscode.QuickPickItem[] = [
                {
                    label: 'Online',
                    description: 'Download from website and install',
                    detail: view_str$prompt$tool_install_mode_online
                },
                {
                    label: 'Local',
                    description: 'Use existed installation directory',
                    detail: view_str$prompt$tool_install_mode_local
                }
            ];

            const onlineInstall = await vscode.window.showQuickPick(pickItems, {
                canPickMany: false,
                placeHolder: view_str$prompt$select_tool_install_mode
            });

            if (onlineInstall == undefined) {
                return;
            }

            if (onlineInstall.label == 'Online') {
                await resInstaller.installTool(item.type);
                return;
            }
        }

        /* user select install folder */

        let dialogOption: vscode.OpenDialogOptions;

        if (item.type == 'Keil_C51' || item.label.includes('MDK')) {
            dialogOption = {
                openLabel: view_str$prompt$select_file,
                filters: {
                    "UV4.exe or TOOLS.INI": ['exe', 'INI']
                },
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false
            };
        } else {
            dialogOption = {
                openLabel: view_str$prompt$select_folder,
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false
            };
        }

        const path = await vscode.window.showOpenDialog(dialogOption);
        if (path === undefined || path.length === 0) {
            return;
        }

        const tcManager = ToolchainManager.getInstance();

        if (item.type == 'Keil_C51') {
            settingManager.SetC51IniOrUv4Path(path[0].fsPath);
        }

        else if (item.label.includes('MDK')) {
            settingManager.SetMdkIniOrUv4Path(path[0].fsPath);
        }

        else {
            const iToolchian = tcManager.getToolchainByName(item.type);
            if (iToolchian) {
                vscode.workspace.getConfiguration().update(
                    iToolchian.settingName, path[0].fsPath, vscode.ConfigurationTarget.Global
                );
            }
        }
    }

    async setupUtilTools() {

        const resInstaller = ResInstaller.instance();

        const selections: UtilToolPickItem[] = [
            {
                id: 'null',
                label: 'built-in',
                kind: vscode.QuickPickItemKind.Separator
            }
        ];

        let hasDiv: boolean = false;
        resInstaller.listAllTools().forEach(t => {

            const installed = resInstaller.isToolInstalled(t.id) || false;

            if (!t.is_third_party && t.no_binaries)
                return; // skip no_binaries built-in tools

            if (!hasDiv && t.is_third_party) {
                hasDiv = true;
                selections.push({
                    id: 'null',
                    label: 'external',
                    kind: vscode.QuickPickItemKind.Separator
                });
            }

            let detail: string | undefined = t.detail;
            if (!detail) {
                detail = `ID: ${t.resource_name}`;
                if (t.setting_name) { // built-in
                    detail += `, Setting: EIDE.${t.setting_name}`;
                } else if (t.url) {
                    detail += `, From: ${t.url}`;
                }
            }

            selections.push({
                id: t.id,
                label: t.readable_name,
                isInstalled: installed,
                description: this.getStatusTxt(installed),
                detail: detail
            });
        });

        const sel = await vscode.window.showQuickPick(selections, {
            canPickMany: false,
            matchOnDescription: true,
            matchOnDetail: true,
            ignoreFocusOut: true,
            placeHolder: 'Select one to install it'
        });

        if (sel == undefined)
            return;

        if (sel.isInstalled) {
            const msg = `This package '${sel.label}' has been installed, do you want to reinstall it ?`;
            const ans = await vscode.window.showInformationMessage(msg, 'Yes', 'Cancel');
            if (ans != 'Yes') return;
        }

        await resInstaller.installTool(sel.id);
    }

    async selectTemplate(templateGroup: TemplateGroup): Promise<TemplatePickItem | undefined> {

        let prevGroupStack: TemplateGroup[] = [];
        let curTempGroup: TemplateGroup = templateGroup;

        const goBackItemForGroup: vscode.QuickPickItem = { label: '..', description: 'Back', alwaysShow: true };
        const goBackItemForItem: vscode.QuickPickItem = { label: '..', detail: 'Back', alwaysShow: true };

        // selection loop
        while (true) {

            // show child group
            if (curTempGroup.children.length > 0) {

                let category_sel_list: CategoryPickItem[] = curTempGroup.children.map((group) => {
                    if (curTempGroup.name == '/') {
                        return <CategoryPickItem>{
                            name: group.name,
                            label: group.dispName || group.name,
                            detail: group.desc || group.dispName || ""
                        };
                    } else {
                        return <CategoryPickItem>{
                            name: group.name,
                            label: group.dispName || group.name,
                            description: group.desc || ""
                        };
                    }
                }).sort((a, b) => { return a.label.localeCompare(b.label); });

                if (prevGroupStack.length > 0) {
                    category_sel_list = <CategoryPickItem[]>[goBackItemForGroup].concat(category_sel_list);
                }

                const categoryItem = await vscode.window.showQuickPick(category_sel_list, {
                    canPickMany: false,
                    placeHolder: view_str$placeHolder$selectCategory,
                    ignoreFocusOut: true
                });

                // user canceled
                if (categoryItem === undefined) {
                    return undefined;
                }

                // go back
                if (categoryItem.label === '..') {
                    curTempGroup = <TemplateGroup>prevGroupStack.pop();
                    continue;
                }

                const index = curTempGroup.children.findIndex((group) => { return group.name === categoryItem.name; });
                if (index !== -1) {
                    prevGroupStack.push(curTempGroup);
                    curTempGroup = curTempGroup.children[index];
                }
            }

            // show template list
            else {

                const templateList = curTempGroup.templates;
                let selectionList = templateList.sort((a, b) => { return a.label.localeCompare(b.label); });

                if (prevGroupStack.length > 0) {
                    selectionList = <TemplatePickItem[]>[goBackItemForItem].concat(templateList);
                }

                const selection = await vscode.window.showQuickPick(selectionList, {
                    canPickMany: false,
                    matchOnDetail: true,
                    placeHolder: 'found ' + templateList.length.toString() + ' results, select one and install it',
                    ignoreFocusOut: true
                });

                // user canceled
                if (selection === undefined) {
                    return;
                }

                // go back
                if (selection.label === '..') {
                    curTempGroup = <TemplateGroup>prevGroupStack.pop();
                    continue;
                }

                // select ok, return it
                return selection;
            }
        }
    }

    private locked = false;
    async OnCreateFromGithubTemplate() {

        if (this.locked) {
            GlobalEvent.emit('msg', {
                type: 'Warning',
                contentType: 'string',
                content: 'Busy !, please wait'
            });
            return;
        }

        this.locked = true;

        const settingManager = SettingManager.GetInstance();

        // URL: https://api.github.com/repos/github0null/eide-doc/contents/eide-template-list
        const rawUrl = `api.github.com/repos/${settingManager.getGithubRepositoryUrl()}`;
        const acToken = settingManager.getGithubRepositoryToken();
        const remoteUrl = acToken ? rawUrl : utility.redirectHost(rawUrl); // if token is enabled, not proxy

        let targetTempFile: File | undefined;
        let targetCloneUrl: string | undefined;

        // get template from Github
        {
            const netReq = new NetRequest();

            netReq.on('error', (err) => {
                (<Error>err).message = `Failed to connect '${remoteUrl}'`;
                GlobalEvent.emit('msg', ExceptionToMessage(err, 'Hidden'));
            });

            try {

                const pathArr = (remoteUrl).split('/');
                const hostName = pathArr[0];
                const path = '/' + pathArr.slice(1).join('/');

                const res = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Connect repo '${rawUrl}' ...`,
                    cancellable: true
                }, (_, token): Thenable<NetResponse<any>> => {
                    return new Promise(async (resolve) => {

                        token.onCancellationRequested(() => {
                            netReq.emit('abort');
                        });

                        const headers: any = utility.setProxyHeader({
                            'User-Agent': 'Mozilla/5.0'
                        });

                        if (acToken) { // if token is enabled, use it
                            headers['Authorization'] = `token ${acToken}`;
                        }

                        const res = await netReq.Request<any, any>({
                            host: hostName,
                            path: path,
                            timeout: 3000,
                            headers: headers
                        }, 'https');

                        resolve(res);
                    });
                });

                if (!res.success) {
                    GlobalEvent.emit('msg', newMessage('Warning', `Can't connect to Github repository !, msg: ${res.msg || 'null'}`));
                    this.locked = false;
                    return;
                } else if (res.content === undefined) {
                    GlobalEvent.emit('msg', newMessage('Warning', `Can't get content from Github repository !, msg: ${res.msg || 'null'}`));
                    this.locked = false;
                    return;
                }

                const resManager = ResManager.GetInstance();

                // get file list
                const file_list = new Map<string, GitFileInfo>();
                (<GitFileInfo[]>res.content)
                    .filter((obj) => { return obj.type === 'file'; })
                    .forEach((fInfo) => { file_list.set(fInfo.name, fInfo); });

                // redirect uri
                file_list.forEach((gitFileInfo) => {
                    gitFileInfo.download_url = gitFileInfo.download_url ? utility.redirectHost(gitFileInfo.download_url) : undefined;
                    gitFileInfo.git_url = utility.redirectHost(gitFileInfo.git_url);
                });

                // get template index file info
                const indexFileInfo = file_list.get('index.json');
                if (indexFileInfo === undefined) {
                    GlobalEvent.emit('msg', newMessage('Warning', `Not found template 'index.json' at Github repository !`));
                    this.locked = false;
                    return;
                }

                // load index.json
                const indexFileBuf = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Fetching templates index ...',
                    cancellable: false
                }, (_, __): Thenable<Buffer | Error | undefined> => {
                    return new Promise(async (resolve) => {
                        if (indexFileInfo.download_url) {
                            resolve(await utility.downloadFile(indexFileInfo.download_url));
                        } else {
                            resolve(new Error('download url is null !'));
                        }
                    });
                });

                let templateIndexInfo: TemplateIndexDef = <any>null;
                let templateInfoList: TemplateInfo[] = <any>null;

                if (indexFileBuf instanceof Buffer) {
                    templateIndexInfo = JSON.parse(indexFileBuf.toString());
                    templateInfoList = templateIndexInfo.template_list;
                } else {
                    const msg: string = indexFileBuf instanceof Error ? `, msg: ${indexFileBuf.message}` : '';
                    GlobalEvent.emit('msg', newMessage('Warning', `Download template 'index.json' failed !${msg}`));
                    this.locked = false;
                    return;
                }

                const rootTemplateGroup: TemplateGroup = {
                    name: '/',
                    dispName: undefined,
                    desc: undefined,
                    templates: [],
                    children: []
                };

                const getTempGroupByPath = (path: string): TemplateGroup => {

                    const pList = path.split('/');
                    let curGroup: TemplateGroup = rootTemplateGroup;
                    let curPath: string = '';

                    for (const basename of pList) {

                        curPath += `/${basename}`;

                        const index = curGroup.children.findIndex((group) => { return group.name === basename; });

                        // found it
                        if (index !== -1) {
                            curGroup = curGroup.children[index];
                        }

                        // not found, create it
                        else {
                            const nGroup: TemplateGroup = {
                                name: basename, dispName: undefined, desc: undefined,
                                templates: [], children: []
                            };

                            const tPath = curPath.substring(1);
                            if (templateIndexInfo.category_map[tPath]) { // add description if existed
                                nGroup.dispName = templateIndexInfo.category_map[tPath].display_name;
                                nGroup.desc = templateIndexInfo.category_map[tPath].description;
                            }

                            curGroup.children.push(nGroup);
                            curGroup = nGroup;
                        }
                    }

                    return curGroup;
                };

                for (const templateInfo of templateInfoList) {
                    const gitFileInfo = file_list.get(templateInfo.file_name);

                    const tPickItem: TemplatePickItem = {
                        label: templateInfo.display_name,
                        alwaysShow: !templateInfo.disabled,
                        file_name: templateInfo.file_name,
                        display_name: templateInfo.display_name,
                        author: templateInfo.author,
                        version: templateInfo.version,
                        category: templateInfo.category,
                        download_url: gitFileInfo?.download_url || templateInfo.download_url,
                        git_clone_url: templateInfo.git_clone_url,
                        size: gitFileInfo?.size || templateInfo.size,
                        disabled: templateInfo.disabled,
                        upload_time: templateInfo.upload_time,
                        update_time: templateInfo.update_time,
                        cacheFileName: undefined,
                    };

                    // prepare description string
                    const desc_list: string[] = [];

                    // check whether has cache
                    const cacheInfo = resManager.getCache(templateInfo.file_name);
                    const hasCache = cacheInfo !== undefined
                        && cacheInfo.version === tPickItem.version
                        && resManager.getCachedFileByName(templateInfo.file_name).IsFile();
                    if (hasCache) {
                        tPickItem.cacheFileName = templateInfo.file_name;
                        desc_list.push(found_cache_desc);
                    }

                    if (tPickItem.size) {
                        const size_str = (tPickItem.size / 1000).toFixed(1);
                        desc_list.push(`${size_str} KB`);
                    }

                    if (tPickItem.git_clone_url) {
                        desc_list.push(`Git Repo`);
                    }

                    const detail_list: string[] = [];

                    if (tPickItem.author) {
                        detail_list.push(`Author: ${templateInfo.author}`);
                    }

                    if (tPickItem.update_time) {
                        detail_list.push(`Update: ${tPickItem.update_time}`);
                    }

                    if (tPickItem.version) {
                        detail_list.push(`Version: ${tPickItem.version}`);
                    }

                    if (tPickItem.git_clone_url) {
                        detail_list.push(`Git-Url: ${tPickItem.git_clone_url}`);
                    }

                    // set descriptions
                    tPickItem.description = desc_list.join(', ');
                    tPickItem.detail = detail_list.join(', ');

                    for (const category of tPickItem.category) {
                        const tGroup = getTempGroupByPath(category);
                        tGroup.templates.push(tPickItem);
                    }
                }

                const temp_sel_item = await this.selectTemplate(rootTemplateGroup);

                if (temp_sel_item === undefined) { // if selection is empty, exit
                    this.locked = false;
                    return;
                }

                // use git clone
                if (temp_sel_item.git_clone_url) {
                    targetCloneUrl = temp_sel_item.git_clone_url;
                }

                // use template file
                else if (temp_sel_item.download_url) {

                    // found cache, use cache install
                    if (temp_sel_item.cacheFileName) {
                        targetTempFile = resManager.getCachedFileByName(temp_sel_item.cacheFileName);
                    }
                    // has no cache, redownload it
                    else {
                        // create cache file
                        targetTempFile = resManager.getCachedFileByName(temp_sel_item.file_name);

                        const done = await vscode.window.withProgress({
                            location: vscode.ProgressLocation.Notification,
                            title: 'Downloading template',
                            cancellable: true
                        }, (progress, token): Thenable<boolean> => {
                            return new Promise(async (resolve) => {

                                const res = await utility.downloadFileWithProgress(
                                    <string>temp_sel_item.download_url, temp_sel_item.file_name, progress, token);

                                if (res instanceof Buffer) {
                                    fs.writeFileSync((<File>targetTempFile).path, res);
                                    resManager.addCache({
                                        name: (<File>targetTempFile).name,
                                        size: res.length,
                                        version: temp_sel_item.version
                                    });
                                    resolve(true);
                                    return;
                                }

                                else if (res instanceof Error) {
                                    GlobalEvent.emit('msg', ExceptionToMessage(res, 'Warning'));
                                    resolve(false);
                                    return;
                                }

                                // res is undefined, operation canceled
                                resolve(false);
                            });
                        });

                        // download failed, reset targetTempFile to undefined
                        if (done === false) {
                            targetTempFile = undefined;
                        }
                    }
                }

                // error
                else {
                    this.locked = false;
                    GlobalEvent.emit('msg', newMessage('Warning', `'download_url' and 'git_clone_url' can not be null !`));
                }

            } catch (error) {
                GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
                this.locked = false;
                return;
            }
        }

        //
        // start create project
        //

        if (targetTempFile == undefined &&
            targetCloneUrl == undefined) {
            this.locked = false;
            return;
        }

        // do create project by template file
        if (targetTempFile) {

            const projectname = await vscode.window.showInputBox({
                placeHolder: input_project_name,
                ignoreFocusOut: true,
                value: `${targetTempFile.noSuffixName}-template`,
                validateInput: (name) => AbstractProject.validateProjectName(name)
            });

            if (projectname === undefined) {
                this.locked = false;
                return;
            }

            const outDir = await vscode.window.showOpenDialog({
                openLabel: select_out_dir,
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false
            });

            if (outDir === undefined) {
                this.locked = false;
                return;
            }

            const outputDirPath = outDir[0].fsPath;

            this.emit('request_create_from_template', {
                type: <any>'null', // ignore it
                name: projectname,
                templateFile: targetTempFile,
                outDir: new File(outputDirPath)
            });
        }

        // clone git repo now
        else if (targetCloneUrl) {

            const outDir = await vscode.window.showOpenDialog({
                openLabel: select_out_dir,
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false
            });

            if (outDir === undefined) {
                this.locked = false;
                return;
            }

            const outputDirPath = outDir[0].fsPath;

            const done = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Cloning Template`,
                cancellable: true,
            }, (progress, cancel): Promise<boolean> => {
                return new Promise(async (resolve) => {
                    progress.report({ message: targetCloneUrl });
                    const done = await utility.execInternalCommand(`git clone ${targetCloneUrl}`, outputDirPath, cancel);
                    if (done) {
                        try {
                            child_process.execSync(`git remote remove origin`, { cwd: outputDirPath });
                        } catch (error) {
                            // nothing todo
                        }
                    }
                    resolve(done);
                });
            });

            if (done) {
                const item = await vscode.window.showInformationMessage(view_str$operation$create_prj_done, 'Yes', 'Later');
                if (item == 'Yes') {
                    WorkspaceManager.getInstance().openWorkspace(new File(outputDirPath));
                }
            } else {
                GlobalEvent.emit('msg', newMessage('Warning', `Clone project failed !, Check log in 'eide.log' panel`));
            }
        }

        this.locked = false;
    }

    async OnCreateFromDiskTemplate() {

        if (this.locked) {
            GlobalEvent.emit('msg', {
                type: 'Warning',
                contentType: 'string',
                content: 'Busy !, please wait'
            });
            return;
        }

        this.locked = true;

        let targetTempFile: File | undefined;

        const templateFile = await vscode.window.showOpenDialog({
            openLabel: select_a_template_file,
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'eide project template': ['eide-template', 'ept', 'ewt']
            }
        });

        if (templateFile === undefined) {
            this.locked = false;
            return;
        }

        targetTempFile = new File(templateFile[0].fsPath);

        //====================================================

        if (targetTempFile === undefined) {
            this.locked = false;
            return;
        }

        const name = await vscode.window.showInputBox({
            placeHolder: input_project_name,
            ignoreFocusOut: true,
            value: `${targetTempFile.noSuffixName}-template`,
            validateInput: (name) => AbstractProject.validateProjectName(name)
        });

        if (name === undefined) {
            this.locked = false;
            return;
        }

        const outDir = await vscode.window.showOpenDialog({
            openLabel: select_out_dir,
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false
        });

        if (outDir === undefined) {
            this.locked = false;
            return;
        }

        // notify
        this.emit('request_create_from_template', {
            type: <any>'null', // ignore it
            name: name,
            templateFile: targetTempFile,
            outDir: new File(outDir[0].fsPath)
        });

        this.locked = false;
    }
}

interface UtilToolPickItem extends vscode.QuickPickItem {
    id: ExternalToolName;
    isInstalled?: boolean;
}
