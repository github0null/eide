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
    view_str$prompt$tool_install_mode_online, view_str$prompt$tool_install_mode_local, view_str$operation$empty_anygcc_prj
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

import * as events from 'events';
import * as fs from 'fs';
import * as vscode from 'vscode';
import * as NodePath from 'path';
import { ResInstaller } from './ResInstaller';
import { AbstractProject } from './EIDEProject';

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

        this.view = vscode.window.createTreeView('Operation', { treeDataProvider: this.provider });
        this.UpdateView();

        GlobalEvent.on('extension_close', () => {
            this.view.dispose();
        });

        SettingManager.GetInstance().on('onChanged', () => {
            this.UpdateView();
        });
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
            iconPath: {
                light: icoPath.path,
                dark: icoPath.path
            }
        });

        icoPath = resManager.GetIconByName('Import_16x.svg');
        this.provider.AddData({
            label: view_str$import_project,
            command: {
                title: view_str$import_project,
                command: '_cl.eide.Operation.Import'
            },
            tooltip: import_project_hit,
            iconPath: {
                light: icoPath.path,
                dark: icoPath.path
            }
        });

        icoPath = resManager.GetIconByName('OpenFileFromProject_16x.svg');
        this.provider.AddData({
            label: open_project,
            command: {
                title: open_project,
                command: '_cl.eide.Operation.Open'
            },
            tooltip: open_project_hit,
            iconPath: {
                light: icoPath.path,
                dark: icoPath.path
            }
        });

        icoPath = resManager.GetIconByName('SerialPort_16x.svg');
        this.provider.AddData({
            label: view_str$operation$open_serialport,
            command: {
                title: view_str$operation$open_serialport,
                command: '_cl.eide.Operation.OpenSerialPortMonitor'
            },
            tooltip: view_str$operation$open_serialport,
            iconPath: {
                light: icoPath.path,
                dark: icoPath.path
            }
        });

        const tcList: ToolchainName[] = ['AC5', 'GCC', 'IAR_STM8', 'SDCC', 'Keil_C51', 'RISCV_GCC', 'ANY_GCC', 'GNU_SDCC_STM8'];
        const toolchainManager = ToolchainManager.getInstance();
        const checkResults = tcList.map((tcName) => { return toolchainManager.isToolchainPathReady(tcName); });
        const status: CheckStatus = checkResults.every((val) => { return val; }) ?
            CheckStatus.All_Verified : (checkResults.includes(true) ? CheckStatus.All_Verified : CheckStatus.All_Failed);
        icoPath = resManager.GetIconByName(<string>this.statusIconMap.get(status));
        this.provider.AddData({
            label: view_str$operation$setToolchainPath,
            command: {
                title: view_str$operation$setToolchainPath,
                command: '_cl.eide.Operation.SetToolchainPath'
            },
            tooltip: view_str$operation$setToolchainPath,
            iconPath: {
                light: icoPath.path,
                dark: icoPath.path
            }
        });

        /* setup env if toolchain is ready */
        vscode.commands.executeCommand('setContext', 'cl.eide.toolchain_ready', status != CheckStatus.All_Failed);

        icoPath = resManager.GetIconByName('Settings_16x.svg');
        this.provider.AddData({
            label: view_str$operation$openSettings,
            command: {
                title: view_str$operation$openSettings,
                command: '_cl.eide.Operation.openSettings'
            },
            tooltip: view_str$operation$openSettings,
            iconPath: {
                light: icoPath.path,
                dark: icoPath.path
            }
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
                'EIDE workspace': ['code-workspace']
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
                            label: view_str$operation$empty_anygcc_prj,
                            detail: 'for any gcc famliy toolchains',
                            type: 'ANY-GCC'
                        }
                    ];

                    templateItem = await vscode.window.showQuickPick(itemList);
                }
                break;

            case 'internal-template':
                {
                    const itemList: ProjectTemplatePickItem[] = [
                        {
                            label: '8051 Quickstart',
                            detail: 'Universal 8051 quickstart project',
                            templateName: 'mcs51',
                            type: 'C51'
                        },
                        {
                            label: '89C52 SDCC Quickstart',
                            detail: '89c52 quickstart project (with sdcc compiler)',
                            templateName: '89c52_sdcc',
                            type: 'C51'
                        },
                        {
                            label: 'STC15 Quickstart',
                            detail: 'stc15 quickstart project',
                            templateName: 'stc15',
                            type: 'C51'
                        },
                        {
                            label: 'AVR FreeRTOS Quickstart',
                            detail: 'avr atmega128 quickstart project (FreeRTOS) (WinAVR-GCC compiler)',
                            templateName: 'avr_atmega128_rtos',
                            type: 'ANY-GCC'
                        },
                        {
                            label: 'STM8 Quickstart',
                            detail: 'stm8s103 quickstart project',
                            templateName: 'stm8s103f3',
                            type: 'C51'
                        },
                        {
                            label: 'STM8 SDCC Quickstart',
                            detail: 'stm8s103 quickstart project (with sdcc compiler)',
                            templateName: 'stm8s103_sdcc',
                            type: 'C51'
                        },
                        {
                            label: 'STM32F1 Quickstart',
                            detail: 'stm32f1xx quickstart project',
                            templateName: 'stm32f1xx',
                            type: 'ARM'
                        },
                        {
                            label: 'STM32F1 GCC Quickstart',
                            detail: 'stm32f1xx gcc quickstart project (with gcc compiler)',
                            templateName: 'stm32f1xx_gcc',
                            type: 'ARM'
                        },
                        {
                            label: 'GD32VF103 Quickstart',
                            detail: 'gd32vf103 quickstart project (riscv mcu)',
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

        const prjFileUri = await vscode.window.showOpenDialog({
            openLabel: 'Import',
            canSelectFolders: false,
            canSelectFiles: true,
            canSelectMany: false,
            filters: {
                'MDK': ['uvprojx'],
                'KEIL C51': ['uvproj']
            }
        });

        if (prjFileUri === undefined || prjFileUri.length === 0) {
            return;
        }

        const selection = await vscode.window.showInformationMessage(
            view_str$operation$import_sel_out_folder,
            'Yes', 'No'
        );

        const importOption: ImportOptions = {
            projectFile: new File(prjFileUri[0].fsPath),
            outDir: new File(NodePath.dirname(prjFileUri[0].fsPath)),
            createNewFolder: false
        };

        // coexist with Keil project ?, if not, redirect output folder
        if (selection === 'No') {

            const folderUri = await vscode.window.showOpenDialog({
                openLabel: 'Select',
                defaultUri: vscode.Uri.parse(importOption.outDir.ToUri()),
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

    private getStatusTxt(status: boolean): string {
        return status ? '✔' : '✘';
    }

    async OnSetToolchainPath() {

        const settingManager = SettingManager.GetInstance();
        const toolchainManager = ToolchainManager.getInstance();

        const pickItems: ToolchainDespPickItem[] = [
            {
                label: 'Keil C51',
                type: 'Keil_C51',
                description: this.getStatusTxt(toolchainManager.isToolchainPathReady('Keil_C51')),
                detail: view_str$operation$setKeil51Path
            },
            {
                label: 'MDK',
                type: 'AC5',
                description: this.getStatusTxt(settingManager.isMDKIniReady()),
                detail: view_str$operation$setMDKPath
            },
            {
                label: 'ARMCC V5',
                type: 'AC5',
                description: this.getStatusTxt(toolchainManager.isToolchainPathReady('AC5')),
                detail: view_str$operation$setToolchainInstallDir.replace('${name}', 'ARMCC V5 Toolchain')
            },
            {
                label: 'ARMCC V6',
                type: 'AC6',
                description: this.getStatusTxt(toolchainManager.isToolchainPathReady('AC6')),
                detail: view_str$operation$setToolchainInstallDir.replace('${name}', 'ARMCC V6 Toolchain')
            },
            {
                label: 'GNU Arm Embedded Toolchain',
                type: 'GCC',
                description: this.getStatusTxt(toolchainManager.isToolchainPathReady('GCC')),
                detail: view_str$operation$setToolchainInstallDir.replace('${name}', 'GNU Arm Embedded Toolchain')
            },
            {
                label: 'IAR For STM8 (iccstm8)',
                type: 'IAR_STM8',
                description: this.getStatusTxt(toolchainManager.isToolchainPathReady('IAR_STM8')),
                detail: view_str$operation$setToolchainInstallDir.replace('${name}', 'IAR For STM8')
            },
            {
                label: 'Small Device C Compiler (SDCC)',
                type: 'SDCC',
                description: this.getStatusTxt(toolchainManager.isToolchainPathReady('SDCC')),
                detail: view_str$operation$setToolchainInstallDir.replace('${name}', 'SDCC')
            },
            {
                label: 'SDCC With GNU Patch For STM8 (Only for stm8)',
                type: 'GNU_SDCC_STM8',
                description: this.getStatusTxt(toolchainManager.isToolchainPathReady('GNU_SDCC_STM8')),
                detail: view_str$operation$setToolchainInstallDir.replace('${name}', 'GNU_SDCC_STM8')
            },
            {
                label: 'RISC-V GCC Toolchain (RISC-V GCC)',
                type: 'RISCV_GCC',
                description: this.getStatusTxt(toolchainManager.isToolchainPathReady('RISCV_GCC')),
                detail: view_str$operation$setToolchainInstallDir.replace('${name}', 'RISC-V GCC Toolchain')
            },
            {
                label: 'ANY GCC Toolchain',
                type: 'ANY_GCC',
                description: this.getStatusTxt(toolchainManager.isToolchainPathReady('ANY_GCC')),
                detail: view_str$operation$setToolchainInstallDir.replace('${name}', 'ANY GCC Toolchain')
            }
        ];

        const item = await vscode.window.showQuickPick(pickItems, {
            canPickMany: false,
            placeHolder: view_str$operation$setToolchainPath
        });
        if (item === undefined) {
            return;
        }

        /* select install mode */

        const resInstaller = ResInstaller.instance();
        const tool = resInstaller.getTool(item.type);
        if (tool && !tool.no_binaries) { /* have online package */

            const pickItems: vscode.QuickPickItem[] = [
                {
                    label: 'Online',
                    detail: view_str$prompt$tool_install_mode_online
                },
                {
                    label: 'Offline',
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

        if (item.type == 'Keil_C51' || item.label == 'MDK') {
            dialogOption = {
                openLabel: view_str$prompt$select_file,
                filters: {
                    "TOOLS.INI file": ['INI']
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
            settingManager.SetC51INIPath(path[0].fsPath);
        }

        else if (item.label == 'MDK') {
            settingManager.SetMdkINIPath(path[0].fsPath);
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
                    return <CategoryPickItem>{
                        name: group.name,
                        label: group.dispName || group.name,
                        description: group.desc || ""
                    };
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
        const redirectUri = (uri: string) => settingManager.isUseGithubProxy() ? utility.redirectHost(uri) : uri;

        // URL: https://api.github.com/repos/github0null/eide-doc/contents/eide-template-list
        const rawUrl = `api.github.com/repos/${settingManager.getGithubRepositoryUrl()}`;
        const acToken = settingManager.getGithubRepositoryToken();
        const remoteUrl = acToken ? rawUrl : redirectUri(rawUrl); // if token is enabled, not proxy

        let targetTempFile: File | undefined;

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
                    title: 'Searching from ' + hostName + ' ...',
                    cancellable: true
                }, (_, token): Thenable<NetResponse<any>> => {
                    return new Promise(async (resolve) => {

                        token.onCancellationRequested(() => {
                            netReq.emit('abort');
                        });

                        const headers: any = {
                            'User-Agent': 'Mozilla/5.0'
                        };

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
                    gitFileInfo.download_url = gitFileInfo.download_url ? redirectUri(gitFileInfo.download_url) : undefined;
                    gitFileInfo.git_url = redirectUri(gitFileInfo.git_url);
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
                    title: 'Downloading "index.json" ...',
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

                if (temp_sel_item.download_url === undefined) {
                    this.locked = false;
                    GlobalEvent.emit('msg', newMessage('Warning', `error !, download url is null !`));
                    return;
                }

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

            } catch (error) {
                GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
                this.locked = false;
                return;
            }
        }

        //====================================================

        if (targetTempFile === undefined) {
            this.locked = false;
            return;
        }

        const name = await vscode.window.showInputBox({
            placeHolder: input_project_name,
            ignoreFocusOut: true,
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

    async onOpenSerialPortMonitor(port?: string) {

        const resManager = ResManager.GetInstance();
        const option = SettingManager.GetInstance().getPortSerialMonitorOptions();

        try {
            const portName: string | undefined = port || option.defaultPort;
            if (!portName) {
                return;
            }

            const paramList: string[] = [
                '-n', portName,
                '-b', option.baudRate.toString(),
                '-d', option.dataBits.toString(),
                '-p', option.parity.toString(),
                '-s', option.stopBits.toString(),
                '-l', option.useUnixCRLF ? '1' : '0'
            ];

            let terminal: vscode.Terminal;
            const terminalName = portName;

            const cIndex = vscode.window.terminals.findIndex((term) => { return term.name === terminalName; });
            const cmdPath = resManager.getCMDPath();

            // close exist terminal
            if (cIndex !== -1) { vscode.window.terminals[cIndex].dispose(); }

            const opts: vscode.TerminalOptions = {
                name: terminalName,
                shellPath: cmdPath,
                env: process.env
            };

            terminal = vscode.window.createTerminal(opts);
            terminal.show(true);

            /* send command */
            const commandLine = `"${resManager.getSerialPortExe().path}" ${paramList.join(' ')}`;
            terminal.sendText(`${resManager.getMonoName()} ${commandLine}`);

        } catch (error) {
            GlobalEvent.emit('error', error);
        }
    }
}
