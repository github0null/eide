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
import * as fs from 'fs';
import * as os from 'os';
import * as node7z from 'node-7z';
import * as NodePath from 'path';
import * as ChildProcess from 'child_process';
import * as yaml from 'yaml';

import { GlobalEvent } from './GlobalEvents';
import { OperationExplorer } from './OperationExplorer';
import { ProjectExplorer } from './EIDEProjectExplorer';
import { ResManager } from './ResManager';
import { LogAnalyzer } from './LogAnalyzer';
import { ResInstaller } from './ResInstaller';

import {
    ERROR, WARNING, INFORMATION,
    view_str$operation$serialport, view_str$operation$baudrate, view_str$operation$serialport_name,
    txt_install_now, txt_yes, view_str$prompt$feedback, rating_text, later_text
} from './StringTable';
import { LogDumper } from './LogDumper';
import { StatusBarManager } from './StatusBarManager';
import { File } from '../lib/node-utility/File';
import { newMessage, ExceptionToMessage } from './Message';
import { SettingManager } from './SettingManager';
import { WorkspaceManager } from './WorkspaceManager';
import { VirtualDocument } from './VirtualDocsProvider';
import * as utility from './utility';
import * as platform from './Platform';

const extension_deps: string[] = [];

let projectExplorer: ProjectExplorer;

// set yaml global style
yaml.scalarOptions.str.fold.lineWidth = 1000;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

    // init event emiter
    RegisterGlobalEvent();
    RegisterMsgListener();

    GlobalEvent.emit('globalLog', newMessage('Info', 'Embedded IDE launch begin'));

    // init platform
    try {
        platform.init();
    } catch (error) {
        const msg = (<Error>error).message;
        vscode.window.showErrorMessage(msg);
        GlobalEvent.emit('globalLog', newMessage('Error', msg));
        return;
    }

    // try active dependence plug-ins
    for (const name of extension_deps) {
        const extension = vscode.extensions.getExtension(name);
        if (extension) {
            if (!extension.isActive) {
                try {
                    GlobalEvent.emit('globalLog', newMessage('Info', `Active extension: '${name}'`));
                    await extension.activate();
                } catch (error) {
                    GlobalEvent.emit('globalLog', ExceptionToMessage(error, 'Warning'));
                }
            }
        } else {
            GlobalEvent.emit('globalLog', newMessage('Warning', `The extension '${name}' is not enabled or installed !`));
        }
    }

    // init eide components
    const done = await InitComponents(context);
    if (!done) {
        vscode.window.showErrorMessage(`${ERROR} : Install eide binaries failed !, You can download offline [vsix package](https://github.com/github0null/eide/releases) and install it !`);
        return;
    }

    // register vscode commands
    const subscriptions = context.subscriptions;

    // global user commands
    subscriptions.push(vscode.commands.registerCommand('eide.ShowUUID', () => ShowUUID()));
    subscriptions.push(vscode.commands.registerCommand('eide.c51ToSdcc', () => c51ToSDCC()));
    subscriptions.push(vscode.commands.registerCommand('eide.ReloadJlinkDevs', () => reloadJlinkDevices()));
    subscriptions.push(vscode.commands.registerCommand('eide.ReloadStm8Devs', () => reloadStm8Devices()));
    subscriptions.push(vscode.commands.registerCommand('eide.selectBaudrate', () => onSelectSerialBaudrate()));
    subscriptions.push(vscode.commands.registerCommand('eide.create.clang-format.file', () => newClangFormatFile()));

    // internal command
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.selectCurSerialName', () => onSelectCurSerialName()));

    // operations
    const operationExplorer = new OperationExplorer(context);
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.Operation.Open', () => operationExplorer.OnOpenProject()));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.Operation.Create', () => operationExplorer.OnCreateProject()));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.Operation.Import', () => operationExplorer.OnImportProject()));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.Operation.SetToolchainPath', () => operationExplorer.OnSetToolchainPath()));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.Operation.SetupUtilTools', () => operationExplorer.setupUtilTools()));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.Operation.OpenSerialPortMonitor', (port) => operationExplorer.onOpenSerialPortMonitor(port)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.Operation.openSettings', () => SettingManager.jumpToSettings('@ext:cl.eide')));

    // operations user cmds
    subscriptions.push(vscode.commands.registerCommand('eide.operation.install_toolchain', () => operationExplorer.OnSetToolchainPath()));
    subscriptions.push(vscode.commands.registerCommand('eide.operation.import_project', () => operationExplorer.OnImportProject()));
    subscriptions.push(vscode.commands.registerCommand('eide.operation.new_project', () => operationExplorer.OnCreateProject()));
    subscriptions.push(vscode.commands.registerCommand('eide.operation.open_project', () => operationExplorer.OnOpenProject()));

    // projects
    projectExplorer = new ProjectExplorer(context);
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.workspace.build', () => projectExplorer.buildWorkspace()));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.workspace.rebuild', () => projectExplorer.buildWorkspace(true)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.workspace.open.config', () => projectExplorer.openWorkspaceConfig()));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.workspace.make.template', (item) => projectExplorer.ExportProjectTemplate(undefined, true)));

    // project user cmds
    subscriptions.push(vscode.commands.registerCommand('eide.project.save', (item) => projectExplorer.saveProject(item)));
    subscriptions.push(vscode.commands.registerCommand('eide.project.rebuild', (item) => projectExplorer.BuildSolution(item)));
    subscriptions.push(vscode.commands.registerCommand('eide.project.build', (item) => projectExplorer.BuildSolution(item, { useFastMode: true })));
    subscriptions.push(vscode.commands.registerCommand('eide.project.clean', (item) => projectExplorer.BuildClean(item)));
    subscriptions.push(vscode.commands.registerCommand('eide.project.uploadToDevice', (item) => projectExplorer.UploadToDevice(item)));
    subscriptions.push(vscode.commands.registerCommand('eide.reinstall.binaries', () => checkAndInstallBinaries(true)));
    subscriptions.push(vscode.commands.registerCommand('eide.project.flash.erase.all', (item) => projectExplorer.UploadToDevice(item, true)));
    subscriptions.push(vscode.commands.registerCommand('eide.project.buildAndFlash', (item) => projectExplorer.BuildSolution(item, { useFastMode: true, flashAfterBuild: true })));
    subscriptions.push(vscode.commands.registerCommand('eide.project.genBuilderParams', (item) => projectExplorer.BuildSolution(item, { useFastMode: true, onlyGenParams: true })));

    // operations bar
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.historyRecord', () => projectExplorer.openHistoryRecords()));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.clearHistoryRecord', () => projectExplorer.clearAllHistoryRecords()));

    // project
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.showBuildParams', (item) => projectExplorer.BuildSolution(item, { useDebug: true })));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.setActive', (item) => projectExplorer.setActiveProject(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.close', (item) => projectExplorer.Close(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.saveAll', () => projectExplorer.SaveAll()));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.refresh', () => projectExplorer.Refresh()));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.switchMode', (item) => projectExplorer.switchTarget(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.exportAsTemplate', (item) => projectExplorer.ExportProjectTemplate(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.show_proj_vars', (item) => projectExplorer.ShowProjectVariables(item)));

    // project explorer
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.addSrcDir', (item) => projectExplorer.AddSrcDir(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.removeSrcDir', (item) => projectExplorer.RemoveSrcDir(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.sourceRoot.refresh', (item) => projectExplorer.refreshSrcRoot(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.modify.files.options', (item) => projectExplorer.showFilesOptions(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.import.ext.source.struct', (item) => projectExplorer.ImportSourceFromExtProject(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.source.modify.exclude_list', (item) => projectExplorer.openYamlConfig(item, 'src-exc-cfg')));

    // symbol view editor commands
    const virtDoc = VirtualDocument.instance();
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.symbol_view.sort_by_addr',
        (url) => virtDoc.updateDocument(url.fsPath, undefined, 'addr', virtDoc.getLastGetterArgs(url.fsPath)[1])));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.symbol_view.sort_by_size',
        (url) => virtDoc.updateDocument(url.fsPath, undefined, 'size', virtDoc.getLastGetterArgs(url.fsPath)[1])));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.symbol_view.disp_hide_no_sized',
        (url) => virtDoc.updateDocument(url.fsPath, undefined, virtDoc.getLastGetterArgs(url.fsPath)[0], 'hide_no_sized')));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.symbol_view.disp_show_all',
        (url) => virtDoc.updateDocument(url.fsPath, undefined, virtDoc.getLastGetterArgs(url.fsPath)[0], 'show_all')));

    // filesystem files
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.source.filesystem_folder_add_file', (item) => projectExplorer.fs_folderAddFile(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.source.filesystem_folder_add', (item) => projectExplorer.fs_folderAdd(item)));

    // virtual files
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.source.virtual_folder_add_file', (item) => projectExplorer.Virtual_folderAddFile(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.source.virtual_folder_add', (item) => projectExplorer.Virtual_folderAdd(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.source.virtual_folder_remove', (item) => projectExplorer.Virtual_removeFolder(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.source.virtual_folder_rename', (item) => projectExplorer.Virtual_renameFolder(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.source.virtual_file_remove', (item) => projectExplorer.Virtual_removeFile(item)));

    // file other operations
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.excludeSource', (item) => projectExplorer.ExcludeSourceFile(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.unexcludeSource', (item) => projectExplorer.UnexcludeSourceFile(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.excludeFolder', (item) => projectExplorer.ExcludeFolder(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.unexcludeFolder', (item) => projectExplorer.UnexcludeFolder(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.excludeFolder.childSrcs', (item) => projectExplorer.ExcludeFolder(item, true)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.unexcludeFolder.childSrcs', (item) => projectExplorer.UnexcludeFolder(item, true)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.source.file.show.dir', (item) => projectExplorer.showFileInExplorer(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.source.modify.path', (item) => projectExplorer.openYamlConfig(item, 'src-path-cfg')));

    // package
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.installCMSISHeaders', (item) => projectExplorer.installCmsisSourcePack(item, 'header')));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.installCmsisLibs', (item) => projectExplorer.installCmsisSourcePack(item, 'lib')));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.removePackage', (item) => projectExplorer.UninstallKeilPackage(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.addPackage', (item) => projectExplorer.InstallKeilPackage(item.val.projectIndex)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.exportXml', (item) => projectExplorer.ExportKeilXml(item.val.projectIndex)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.setDevice', (item) => projectExplorer.SetDevice(item.val.projectIndex)));

    // builder
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.modifyCompileConfig', (item) => projectExplorer.ModifyCompileConfig(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.switchToolchain', (item) => projectExplorer.onSwitchCompileTools(item)));

    // flasher
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.modifyUploadConfig', (item) => projectExplorer.ModifyUploadConfig(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.switchUploader', (item) => projectExplorer.switchUploader(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.fetchShellFlasher', (item) => projectExplorer.fetchShellFlasher(item)));

    // project deps
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.addIncludeDir', (item) => projectExplorer.AddIncludeDir(item.val.projectIndex)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.addDefine', (item) => projectExplorer.AddDefine(item.val.projectIndex)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.addLibDir', (item) => projectExplorer.AddLibDir(item.val.projectIndex)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.showIncludeDir', (item) => projectExplorer.showIncludeDir(item.val.projectIndex)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.showDefine', (item) => projectExplorer.showDefine(item.val.projectIndex)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.showLibDir', (item) => projectExplorer.showLibDir(item.val.projectIndex)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.modifyOtherSettings', (item) => projectExplorer.ModifyOtherSettings(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.modify.deps', (item) => projectExplorer.openYamlConfig(item, 'prj-attr-cfg')));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.removeDependenceItem', (item) => projectExplorer.RemoveDependenceItem(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.importDependenceFromPack', (item) => projectExplorer.ImportPackageDependence(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.removeDependenceFromPack', (item) => projectExplorer.RemovePackageDependence(item)));

    // tree view global
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.copyItemValue', (item) => projectExplorer.CopyItemValue(item)));

    // other project tools
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.source.show_disassembly', (url) => projectExplorer.showDisassembly(url)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.source.show_cmsis_config_wizard', (url) => projectExplorer.showCmsisConfigWizard(url)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.cppcheck.check_all', (item) => projectExplorer.cppcheckProject(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.cppcheck.clear_all', (item) => projectExplorer.clearCppcheckDiagnostic()));
    //subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.cppcheck.check_file', (url) => projectExplorer.cppcheckFile(url)));

    operationExplorer.on('request_open_project', (fsPath) => projectExplorer.emit('request_open_project', fsPath));
    operationExplorer.on('request_create_project', (option) => projectExplorer.emit('request_create_project', option));
    operationExplorer.on('request_create_from_template', (option) => projectExplorer.emit('request_create_from_template', option));
    operationExplorer.on('request_import_project', (option) => projectExplorer.emit('request_import_project', option));

    // others
    vscode.workspace.registerTextDocumentContentProvider(VirtualDocument.scheme, VirtualDocument.instance());
    vscode.workspace.registerTaskProvider(EideTaskProvider.TASK_TYPE_MSYS, new EideTaskProvider());

    // auto save project
    projectExplorer.enableAutoSave(true);

    // load project in this workspace
    projectExplorer.loadWorkspace();

    // hook
    postLaunchHook(context);

    // launch done
    GlobalEvent.emit('extension_launch_done');
    GlobalEvent.emit('globalLog', newMessage('Info', 'Embedded IDE launch done'));
}

// this method is called when your extension is deactivated
export function deactivate() {
    GlobalEvent.emit('extension_close');
    StatusBarManager.getInstance().disposeAll();
}

function postLaunchHook(extensionCtx: vscode.ExtensionContext) {

    const resManager = ResManager.instance();
    const appUsrData = resManager.getAppUsrData() || {};
    const isFirstLaunch = appUsrData['InstallTime'] == undefined;

    // is first launch ?
    if (isFirstLaunch) {

        // setup install time
        resManager.setAppUsrData('InstallTime', Date.now().toString());

        // only enable github proxy for GMT+8:00 by default
        const timeZone = Math.floor((new Date().getTimezoneOffset() / 60) * -1);
        if (timeZone != 8) {
            // disable settings: 'EIDE.Repository.UseProxy'
            SettingManager.GetInstance().setConfigValue('Repository.UseProxy', false);
        }
    }

    // not first launch
    else {

        // A few days ago, show feedback message
        const some_days = 7 * (24 * 3600 * 1000);
        if (!appUsrData['Feedbacked'] &&
            Date.now() - appUsrData['InstallTime'] > some_days) {
            resManager.setAppUsrData('Feedbacked', true);
            const msg = view_str$prompt$feedback;
            vscode.window.showInformationMessage(msg, rating_text).then((ans) => {
                if (ans == rating_text) {
                    utility.openUrl(`https://marketplace.visualstudio.com/items?itemName=CL.eide&ssr=false#review-details`);
                }
            });
        }
    }

    // refresh external tools now
    ResInstaller.instance().refreshExternalToolsIndex().catch(err => {
        GlobalEvent.emit('globalLog', ExceptionToMessage(err, 'Warning'));
    });
}

//////////////////////////////////////////////////
// internal vsc-commands funcs
//////////////////////////////////////////////////

let serial_curPort: string | undefined;
let serial_nameBar: vscode.StatusBarItem | undefined;
let serial_baudBar: vscode.StatusBarItem | undefined;
let serial_openBar_args: string[] = [<any>null];

function ShowUUID() {
    vscode.window.showInputBox({
        value: platform.GetUUID()
    });
}

function reloadJlinkDevices() {
    if (ResManager.GetInstance().loadJlinkDevList()) {
        GlobalEvent.emit('msg', newMessage('Info', 'Done !, JLink devices list has been reloaded !'));
    }
}

function reloadStm8Devices() {
    if (ResManager.GetInstance().loadStm8DevList()) {
        GlobalEvent.emit('msg', newMessage('Info', 'Done !, STM8 devices list has been reloaded !'));
    }
}

function updateSerialportBarState() {
    if (SettingManager.GetInstance().isShowSerialportStatusbar()) {
        StatusBarManager.getInstance().show('serialport');
        StatusBarManager.getInstance().show('serialport-name');
        StatusBarManager.getInstance().show('serialport-baud');
    } else {
        StatusBarManager.getInstance().hide('serialport');
        StatusBarManager.getInstance().hide('serialport-name');
        StatusBarManager.getInstance().hide('serialport-baud');
    }
}

async function newClangFormatFile() {

    let root = WorkspaceManager.getInstance().getWorkspaceRoot();
    if (!root) {
        const li = WorkspaceManager.getInstance().getWorkspaceList();
        if (li.length > 0) {
            root = li[0];
        }
    }

    if (root) {
        const fSrc = File.fromArray([ResManager.GetInstance().GetAppDataDir().path, '.clang-format']);
        fs.copyFileSync(fSrc.path, [root.path, '.clang-format'].join(File.sep));
        vscode.window.showInformationMessage(`.clang-format file was created in '${fSrc.dir}' !`);
    } else {
        vscode.window.showWarningMessage(`No opened workspace or folders !`);
    }
}

async function onSelectSerialBaudrate() {

    const baudList: string[] = [
        '600', '1200', '2400',
        '4800', '9600', '14400',
        '19200', '28800', '38400',
        '57600', '115200', '230400',
        '460800', '576000', '921600'
    ];

    const baudrate = await vscode.window.showQuickPick(baudList, {
        placeHolder: 'select a baudrate for serialport'
    });

    if (baudrate) {
        SettingManager.GetInstance().setSerialBaudrate(
            parseInt(baudrate),
            WorkspaceManager.getInstance().hasWorkspaces() == false
        );
    }
}

async function onSelectCurSerialName() {
    try {
        const portList: string[] = ResManager.GetInstance().enumSerialPort();

        if (portList.length === 0) {
            GlobalEvent.emit('msg', newMessage('Info', 'Not found any serial port !'));
            return;
        }

        const portName = await vscode.window.showQuickPick(portList, {
            canPickMany: false,
            placeHolder: 'select a serial port to open'
        });

        if (portName && portName != serial_curPort) {
            serial_curPort = portName;
            if (serial_nameBar) {
                serial_nameBar.text = `${view_str$operation$serialport_name}: ${serial_curPort}`;
                serial_nameBar.tooltip = serial_curPort;
                serial_openBar_args[0] = serial_curPort;
                updateSerialportBarState();
            }
        }
    } catch (error) {
        GlobalEvent.emit('error', error);
    }
}

//////////////////////////////////////////////////
// eide binaries installer
//////////////////////////////////////////////////

function checkBinFolder(binFolder: File): boolean {
    return binFolder.IsDir() &&
        File.fromArray([binFolder.path, File.ToLocalPath(`builder/bin/unify_builder${platform.exeSuffix()}`)]).IsFile();
}

async function checkAndInstallBinaries(forceInstall?: boolean): Promise<boolean> {

    const resManager = ResManager.GetInstance();

    const binFolder = resManager.GetBinDir();
    const eideCfg = resManager.getAppConfig<any>();
    const minReqVersion = eideCfg['binary_min_version'];

    // !! for compatibility with offline-package !!
    // if we found eide binaries in plug-in root folder, move it 
    const builtInBinFolder = File.fromArray([resManager.getAppRootFolder().path, 'bin'])
    if (checkBinFolder(builtInBinFolder)) {
        if (os.platform() == 'win32') {
            ChildProcess.execSync(`xcopy "${builtInBinFolder.path}" "${binFolder.path}\\" /H /E /Y`);
            platform.DeleteDir(builtInBinFolder); // rm it after copy done ! 
        } else {
            platform.DeleteDir(binFolder); // rm existed folder
            ChildProcess.execSync(`mv -f "${builtInBinFolder.path}" "${binFolder.dir}/"`);
        }
    }

    /* check eide binaries */
    // if user force reinstall, delete old 'bin' dir
    if (forceInstall) {
        platform.DeleteDir(binFolder);
    }

    // if binaries is installed, we need check binaries's version
    else if (checkBinFolder(binFolder)) {

        let localVersion: string | undefined;

        // get local binary version from disk
        // check binaries Main_Ver (<Main_Ver>.xx.xx <=> <Main_Ver>.xx.xx)
        const verFile = File.fromArray([binFolder.path, 'VERSION']);
        if (verFile.IsFile()) {
            const cont = verFile.Read().trim();
            if (utility.isVersionString(cont)) {
                localVersion = cont;
                const mainLocalVersion = parseInt(localVersion.split('.')[0]);
                const mainMinReqVersion = parseInt(minReqVersion.split('.')[0]);
                if (mainMinReqVersion != mainLocalVersion) { // local Main verson != min Main version
                    localVersion = undefined; // local binaries is invalid, force update
                }
            }
        }

        // try fetch update after 5sec delay
        if (localVersion) {
            setTimeout(async (curLocalVersion: string) => {
                const done = await tryUpdateBinaries(binFolder, curLocalVersion, true); // no prompt
                if (!done) {
                    const msg = `Update eide-binaries failed, please restart vscode to try again !`;
                    const sel = await vscode.window.showErrorMessage(msg, 'Restart', 'Cancel');
                    if (sel == 'Restart') {
                        vscode.commands.executeCommand('workbench.action.reloadWindow');
                    }
                }
            }, 5 * 1000, localVersion);
        }

        // binaries folder is existed, but can not get local binaries version, 
        // the binaries maybe damaged, we need to force reinstall it
        else {
            platform.DeleteDir(binFolder); // del existed folder
            return await tryUpdateBinaries(binFolder, undefined, true);
        }

        // export current binaries version
        if (localVersion) {
            process.env['EIDE_BINARIES_VER'] = localVersion;
        }

        return true;
    }

    // not found binaries folder, install it
    return await tryUpdateBinaries(binFolder, undefined, true);
}

async function tryUpdateBinaries(binFolder: File, localVer?: string, notConfirm?: boolean): Promise<boolean> {

    const eideCfg = ResManager.GetInstance().getAppConfig<any>();
    const minReqVersion = eideCfg['binary_min_version'];

    const getVersionFromRepo = async (): Promise<string | Error | undefined> => {
        try {
            const url = `https://api.github.com/repos/github0null/eide-resource/contents/binaries/${platform.getRuntimeId()}/VERSION`;
            const cont = await utility.requestTxt(utility.redirectHost(url));
            if (typeof cont != 'string') return cont;
            let obj: any = undefined;
            try { obj = JSON.parse(cont); } catch (error) { return error; }
            if (typeof obj.content != 'string') return obj.content;
            return Buffer.from(obj.content, 'base64').toString();
        } catch (error) {
            return error;
        }
    };

    const getAvailableBinariesVersions = async (): Promise<string[] | Error | undefined> => {
        try {
            const url = `https://api.github.com/repos/github0null/eide-resource/contents/binaries/${platform.getRuntimeId()}`;
            const fList = await utility.readGithubRepoFolder(utility.redirectHost(url));
            if (fList instanceof Error) throw fList;
            return fList.filter(f => f.name.startsWith('bin-'))
                .map(f => f.name.replace('bin-', '').replace('.7z', ''))
                .filter(vStr => utility.isVersionString(vStr));
        } catch (error) {
            return error;
        }
    };

    let preinstallVersion: string | undefined;

    // compare version if local version is available
    if (localVer) {
        const newVersion = await getVersionFromRepo();
        if (typeof newVersion == 'string') {
            const remotVer = newVersion.trim();
            if (utility.isVersionString(remotVer)) {
                const localMainVer: string = localVer.split('.')[0];
                const remotMainVer: string = remotVer.split('.')[0];
                if (localMainVer == remotMainVer && // main version number must be equal
                    utility.compareVersion(remotVer, localVer) > 0) { // remote version > local version ?
                    preinstallVersion = remotVer; // local binaries need update
                }
            }
        }
    }

    // can not match version, get version list from repo
    // select the latest version for min version requirment
    else {
        const vList = await getAvailableBinariesVersions();
        if (vList && Array.isArray(vList)) {
            const minMainVer: string = minReqVersion.split('.')[0];
            const validVerList = vList.filter(ver => ver.split('.')[0] == minMainVer);
            if (validVerList.length > 0) {
                preinstallVersion = validVerList[0];
                for (const ver of validVerList) {
                    if (utility.compareVersion(ver, preinstallVersion) > 0) {
                        preinstallVersion = ver;
                    }
                }
            }
        }
    }

    // check version
    if (localVer) { // binaries is installed, found local version
        if (preinstallVersion == undefined) {
            return true; // local version is latested, not need update
        }
    } else { // binaries is not installed
        if (preinstallVersion == undefined) {
            const err = new Error(`Can not fetch binaries version from remote github repo (binaries minimum version required: '${minReqVersion}'), Check your network and retry !`);
            GlobalEvent.emit('error', err);
            return false;
        }
    }

    // check bin folder
    // show notify to user and request a confirm
    if (checkBinFolder(binFolder) && preinstallVersion) {

        if (!notConfirm) {
            const msg = `New update for eide binaries, version: '${preinstallVersion}', [ChangeLog](https://github.com/github0null/eide-resource/pulls?q=is%3Apr+is%3Aclosed), install now ?`;
            const sel = await vscode.window.showInformationMessage(msg, 'Yes', 'Later');
            if (sel != 'Yes') { return true; } // user canceled
        }

        // del old bin folder before install
        platform.DeleteDir(binFolder);
    }

    return await tryInstallBinaries(binFolder, preinstallVersion);
}

async function tryInstallBinaries(binFolder: File, binVersion: string): Promise<boolean> {

    // zip type
    const binType = '7z';

    // binaries download site
    let downloadSites: string[] = [
        `https://raw-github.github0null.io/github0null/eide-resource/master/binaries/${platform.getRuntimeId()}/bin-${binVersion}.${binType}`,
        `https://raw-github.em-ide.com/github0null/eide-resource/master/binaries/${platform.getRuntimeId()}/bin-${binVersion}.${binType}`,
        `https://raw.githubusercontent.com/github0null/eide-resource/master/binaries/${platform.getRuntimeId()}/bin-${binVersion}.${binType}`
    ];

    // random order
    {
        const sValMap: Map<string, number> = new Map();
        downloadSites.forEach(s => sValMap.set(s, Math.floor(Math.random() * 100)));
        downloadSites = downloadSites.sort((a, b) => (sValMap.get(a) || 0) - (sValMap.get(b) || 0));
    }

    let installedDone = false;

    try {
        const tmpFile = File.fromArray([os.tmpdir(), `eide-binaries-${binVersion}.${binType}`]);

        /* make dir */
        binFolder.CreateDir(true);

        const done = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Downloading eide binaries',
            cancellable: false
        }, async (progress, token): Promise<boolean> => {

            let res: Buffer | undefined | Error = undefined;

            for (const site of downloadSites) {
                res = await utility.downloadFileWithProgress(site, tmpFile.name, progress, token);
                if (res instanceof Buffer) { break; } /* if done, exit loop */
                progress.report({ message: 'failed, switch to next download site ...' });
            }

            if (res instanceof Error) { /* download failed */
                GlobalEvent.emit('msg', ExceptionToMessage(res, 'Warning'));
                return false;
            } else if (res == undefined) { /* canceled */
                return false;
            }

            /* save to file */
            fs.writeFileSync(tmpFile.path, res);

            return true;
        });

        /* download done, unzip and install it */
        if (done) {

            installedDone = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Installing eide binaries`,
                cancellable: false
            }, async (progress, __): Promise<boolean> => {

                return new Promise((resolve_) => {

                    let resolved = false;
                    const resolveIf = (data: boolean) => {
                        if (!resolved) {
                            resolved = true;
                            resolve_(data);
                        }
                    };

                    let prevPercent: number = 0;

                    // start unzip
                    node7z.extractFull(tmpFile.path, binFolder.path, {
                        $bin: ResManager.GetInstance().Get7za().path,
                        $progress: true,
                        recursive: true
                    })
                        // unzip done
                        .on('end', () => {
                            progress.report({ message: `Install eide binaries done !` });
                            setTimeout(() => resolveIf(true), 500);
                        })

                        // unzip error
                        .on('error', (err) => {
                            GlobalEvent.emit('error', err);
                            resolveIf(false);
                        })

                        // progress
                        .on('progress', (info) => {
                            prevPercent = info.percent;
                        })

                        // file info
                        .on('data', (data) => {
                            progress.report({ message: `${prevPercent}%, in '${data.file}'` });
                        });
                });
            });
        }

        /* del tmp file */
        if (tmpFile.IsFile()) {
            try { fs.unlinkSync(tmpFile.path) } catch (error) { }
        }

    } catch (error) {
        GlobalEvent.emit('error', error);
    }

    /* clear dir if failed */
    if (!installedDone) {
        platform.DeleteDir(binFolder);
    }

    // chmod executable's permission
    if (installedDone) {
        initBinariesExecutablePermission();
    }

    return installedDone;
}

//////////////////////////////////////////////////
// environment sutup
//////////////////////////////////////////////////

let isEnvSetuped: boolean = false;

let isExport2ExtensionCtx = false;

function exportEnvToSysPath(context?: vscode.ExtensionContext) {

    const settingManager = SettingManager.GetInstance();
    const resManager = ResManager.GetInstance();
    const builderFolder = resManager.getBuilderDir();

    // export some eide binaries path to system env path
    const systemEnvPaths: string[] = [
        File.normalize(`${builderFolder.path}/bin`), // builder bin folder
        File.normalize(`${builderFolder.path}/utils`), // utils tool folder
        File.normalize(`${builderFolder.dir}/scripts`),
        File.normalize(`${resManager.Get7zDir().path}`), // export built-in 7za tool
        File.normalize(`${resManager.getBuiltInToolsDir().path}/utils`) // builtin utils tool folder
    ];

    //
    const eideToolsFolder = new File(File.normalize(`${os.homedir()}/.eide/tools`));
    if (!eideToolsFolder.IsDir()) {
        try {
            new File(eideToolsFolder.path).CreateDir(true);
        } catch (error) {
            // nothing todo
        }
    }

    // export def tools path to system env path from extension setting
    const pathList: { key: string, path: string, extraPath?: string[] }[] = [];

    // try to export some user setted tools path to env
    [
        { key: 'EIDE_TOOL_GCC_ARM', path: `${settingManager.getGCCDir().path}${File.sep}bin` },
        { key: 'EIDE_TOOL_JLINK', path: `${settingManager.getJlinkDir()}` },
        { key: 'EIDE_TOOL_OPENOCD', path: `${NodePath.dirname(settingManager.getOpenOCDExePath())}` }
    ].forEach(o => {
        if (File.IsDir(o.path)) {
            pathList.push(o);
        }
    });

    // search tools folder and export path to system env
    eideToolsFolder.GetList(File.EXCLUDE_ALL_FILTER).forEach((subDir) => {

        if (!/^\w+$/.test(subDir.name)) return; // filter dir name

        let binFolderPaths: string[] = [];

        // try get path from 'BIN_PATH' file
        const BIN_PATH_FILE = File.fromArray([subDir.path, 'BIN_PATH']);
        if (BIN_PATH_FILE.IsFile()) {

            let binDirs: string[] = [];
            try {
                binDirs = BIN_PATH_FILE.Read().split(/\r\n|\n/)
                    .map(s => s.trim())
                    .filter(s => s != '');
            } catch (error) {
                GlobalEvent.emit('globalLog', ExceptionToMessage(error, 'Warning'));
            }

            binDirs.forEach(dir => {
                const binFolder = File.normalize(`${subDir.path}/${dir}`);
                if (File.IsDir(binFolder)) {
                    binFolderPaths.push(binFolder);
                }
            });
        }

        // try use ./bin
        if (binFolderPaths.length == 0) {
            const binFolder = File.normalize(`${subDir.path}/bin`);
            if (File.IsDir(binFolder)) {
                binFolderPaths.push(binFolder);
            }
        }

        // export bin folder if we found
        if (binFolderPaths.length > 0) {
            const keyName = `EIDE_TOOL_${subDir.name.toUpperCase()}`;
            if (pathList.findIndex(o => o.key == keyName) != -1) return; // skip repeat key name
            pathList.push({
                key: keyName,
                path: binFolderPaths[0],
                extraPath: binFolderPaths.length > 1 ? binFolderPaths.slice(1) : undefined
            });
        }
    });

    // search built-in tools and export path to system env
    builderFolder.GetList(File.EXCLUDE_ALL_FILTER).forEach((subDir) => {
        const binFolder = File.normalize(`${subDir.path}/bin`);
        if (File.IsDir(binFolder)) {
            pathList.push({
                key: `EIDE_${subDir.name.toUpperCase()}`,
                path: binFolder
            });
        }
    });

    // append all tools to system env paths
    pathList
        .filter((env) => File.IsDir(env.path))
        .forEach(envInfo => {
            systemEnvPaths.push(envInfo.path);
            if (envInfo.extraPath) {
                envInfo.extraPath.forEach(p => systemEnvPaths.push(p));
            }
        });

    /* append to System Path if we not */
    if (isEnvSetuped == false) {
        isEnvSetuped = true;
        platform.prependToSysEnv(process.env, systemEnvPaths);
    }

    /* update env key value */
    for (const env of pathList) {
        if (File.IsDir(env.path)) {
            process.env[env.key] = env.path;
        } else {
            process.env[env.key] = '';
        }
    }

    // .NET 工具会收集用法数据，帮助我们改善你的体验。它由 Microsoft 收集并与社区共享。
    // 你可通过使用喜欢的 shell 将 DOTNET_CLI_TELEMETRY_OPTOUT 环境变量设置为 "1" 或 "true" 来选择退出遥测。
    // 阅读有关 .NET CLI 工具遥测的更多信息: https://aka.ms/dotnet-cli-telemetry
    process.env['DOTNET_CLI_TELEMETRY_OPTOUT'] = '1'; // disable telemetry

    //
    // export to vscode extension envs
    //
    if (context && !isExport2ExtensionCtx) {

        isExport2ExtensionCtx = true;

        context.environmentVariableCollection.persistent = false;

        context.environmentVariableCollection.prepend('DOTNET_CLI_TELEMETRY_OPTOUT', '1');

        for (const env of pathList) {
            if (File.IsDir(env.path)) {
                context.environmentVariableCollection.append(env.key, env.path);
            }
        }
    }
}

async function checkAndInstallRuntime() {

    const dotnet_chk_cmd = `dotnet --list-runtimes`;

    //
    // if not found dotnet, preset dotnet root folder into system env
    // dotnet path: 'C:\Program Files\dotnet'
    //
    if (os.platform() == 'win32') {
        try {
            ChildProcess.execSync(dotnet_chk_cmd);
        } catch (error) {
            if (platform.osType() == 'win32') {
                platform.appendToSysEnv(process.env, ['C:\\Program Files\\dotnet']);        // for win x64
                platform.appendToSysEnv(process.env, ['C:\\Program Files (x86)\\dotnet']);  // for win x86
            }
        }
    }

    //
    // check/install .NET
    //
    try {
        GlobalEvent.emit('globalLog', newMessage('Info', 'Checking .NET6 runtime ...'));
        GlobalEvent.emit('globalLog', newMessage('Info', `Exec cmd: '${dotnet_chk_cmd}'`));
        const dotnetInfo = ChildProcess.execSync(dotnet_chk_cmd).toString().trim();
        GlobalEvent.emit('globalLog.append', dotnetInfo + os.EOL);
        // check dotnet version
        let dotnetVerLine: string | undefined;
        const lines = dotnetInfo.trim().split(/\r\n|\n/);
        for (const line_ of lines) {
            const line = line_.trim();
            if (line.toLowerCase().startsWith('Microsoft.NETCore.App 6.'.toLowerCase())) {
                dotnetVerLine = line;
                GlobalEvent.emit('globalLog', newMessage('Info', `.NET6 runtime: '${dotnetVerLine}' found !`));
                break;
            }
        }
        if (!dotnetVerLine) {
            throw new Error(`Can not match .NET6 runtime`);
        }
    } catch (error) {

        GlobalEvent.emit('globalLog', ExceptionToMessage(error, 'Error'));

        GlobalEvent.emit('globalLog.show'); // show error log for user
        GlobalEvent.emit('globalLog', newMessage('Info', 'Not found [.NET6 Runtime](https://dotnet.microsoft.com/en-us/download/dotnet/6.0) !'));

        /* @deprecated
        const msg = `Not found [.NET6 Runtime](https://dotnet.microsoft.com/en-us/download/dotnet/6.0), please install it !`;
        const sel = await vscode.window.showWarningMessage(msg, txt_install_now);
        if (!sel) { return } // user canceled */

        // for other platform, user need install it manually
        if (os.platform() != 'win32') {
            const msg = `Not found [.NET6 runtime](https://dotnet.microsoft.com/en-us/download/dotnet/6.0) on your pc, please install it !`;
            vscode.window.showWarningMessage(msg);
            // https://dotnet.microsoft.com/en-us/download/dotnet/scripts
            utility.openUrl(`https://dotnet.microsoft.com/en-us/download/dotnet/scripts`);
        }

        // win32, we can auto install it
        else {
            const defPkgName = 'dotnet-runtime-6.0.5-win-x64.exe';

            let pkgReady: boolean = false;
            let pkgFile: File;

            // if found local installer pkg, use it
            const localPkg = File.fromArray([ResManager.GetInstance().getAppRootFolder().path, defPkgName]);
            if (localPkg.IsFile()) {
                pkgReady = true;
                pkgFile = localPkg;
            }

            // if not found local installer pkg, download it
            else {

                pkgFile = File.fromArray([os.tmpdir(), defPkgName]);
                if (pkgFile.IsFile()) { // if we have a cached old file, check it
                    const sevenZip = utility.newSevenZipperInstance();
                    const pkgSha256 = sevenZip.sha256(pkgFile);
                    const reqSha256 = 'A085714B879DC1CB85538109640E22A2CBFF2B91195DF540A5F98AEA09AF2C1E'.toLowerCase();
                    if (pkgSha256 == reqSha256) { pkgReady = true; } // sha256 verified, use cached old file
                    else { try { fs.unlinkSync(pkgFile.path); } catch{ } } // sha256 verify failed, del old file
                }

                if (!pkgReady) { // if no cached pkg, download it

                    const downloadUrl = `https://download.visualstudio.microsoft.com/download/pr/b395fa18-c53b-4f7f-bf91-6b2d3c43fedb/d83a318111da9e15f5ecebfd2d190e89/dotnet-runtime-6.0.5-win-x64.exe`;

                    pkgReady = await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: 'Downloading .NET6 runtime installer',
                        cancellable: false
                    }, async (progress, token): Promise<boolean> => {

                        const res = await utility.downloadFileWithProgress(downloadUrl, pkgFile.name, progress, token);

                        if (res instanceof Buffer) {
                            try {
                                fs.writeFileSync(pkgFile.path, res);
                                return true;
                            } catch (error) {
                                return false;
                            }
                        }

                        if (res instanceof Error) {
                            GlobalEvent.emit('error', res);
                        }

                        return false;
                    });
                }
            }

            if (pkgReady && pkgFile.IsFile()) {
                try {
                    ChildProcess.execFileSync(pkgFile.path);
                    const sel = await vscode.window.showInformationMessage(`Ok ! Now you need relaunch VsCode !`, txt_yes);
                    if (sel) {
                        vscode.commands.executeCommand('workbench.action.reloadWindow');
                    }
                } catch (error) {
                    GlobalEvent.emit('msg', newMessage('Error', `Install [.NET6 runtime](https://dotnet.microsoft.com/en-us/download/dotnet/6.0) failed, you need install it manually !`));
                }
            } else {
                vscode.window.showWarningMessage(`Install .NET6 runtime failed, you need install it manually !`);
                // https://dotnet.microsoft.com/en-us/download/dotnet/scripts
                // https://dotnet.microsoft.com/en-us/download/dotnet/thank-you/runtime-6.0.5-windows-x64-installer
                utility.openUrl(`https://dotnet.microsoft.com/en-us/download/dotnet/thank-you/runtime-6.0.5-windows-x64-installer`);
            }
        }
    }
}

function initBinariesExecutablePermission() {

    const resManager = ResManager.GetInstance();

    // chmod +x for other executable files
    if (os.platform() != 'win32') {

        const exeLi: string[] = [];

        // get exe file list from folders
        for (const dir of [
            File.fromArray([resManager.GetBinDir().path, 'scripts']),
            File.fromArray([resManager.getBuilderDir().path, 'utils']),
            File.fromArray([resManager.getBuilderDir().path, 'bin'])
        ]) {
            dir.GetList(undefined, File.EXCLUDE_ALL_FILTER)
                .forEach((f) => {
                    if (!f.suffix) { // nosuffix file is an exe file
                        exeLi.push(f.path);
                    }
                });
        }

        for (const path of exeLi) {
            try {
                ChildProcess.execSync(`chmod +x "${path}"`);
                GlobalEvent.emit('globalLog', newMessage('Info', `chmod +x "${path}"`));
            } catch (error) {
                GlobalEvent.emit('globalLog', ExceptionToMessage(error, 'Error'));
            }
        }
    }
}

async function InitComponents(context: vscode.ExtensionContext): Promise<boolean | undefined> {

    // init managers
    const resManager = ResManager.GetInstance(context);
    const settingManager = SettingManager.GetInstance(context);

    LogDumper.getInstance();

    // chmod +x for 7za 
    if (os.platform() != 'win32') {
        try {
            ChildProcess.execSync(`chmod +x "${resManager.Get7za().path}"`);
        } catch (error) {
            GlobalEvent.emit('msg', ExceptionToMessage(error, 'Error'));
        }
    }

    /* check binaries, if not found, install it ! */
    const done = await checkAndInstallBinaries();
    if (!done) { return false; } /* exit if failed */

    // check and install .NET6 runtime
    await checkAndInstallRuntime();

    // register telemetry hook if user enabled
    try {
        if (settingManager.isEnableTelemetry()) {
            const TelemetryTask = require('./Private/TelemetryTask');
            TelemetryTask.registerTelemetryHook();
        }
    } catch (error) {
        // ignore error
    }

    // set some toolpath to env
    exportEnvToSysPath(context);

    // init status bar
    {
        const statusBarManager = StatusBarManager.getInstance();
        const serialDefCfg = settingManager.getPortSerialMonitorOptions();

        // init default port name
        serial_curPort = serialDefCfg.defaultPort;

        // get current active port
        try {
            const ports = ResManager.GetInstance().enumSerialPort();
            if (ports.length > 0) {
                if (ports.length == 1 || !ports.includes(serialDefCfg.defaultPort)) {
                    serial_curPort = ports[0];
                }
            }
        } catch (error) {
            // nothing todo
        }

        // serial btn
        const serial_openBar = statusBarManager.create('serialport');
        serial_openBar.text = '$(plug) ' + view_str$operation$serialport;
        serial_openBar.tooltip = view_str$operation$serialport;
        serial_openBar_args[0] = serial_curPort;
        serial_openBar.command = {
            title: 'open serialport',
            command: '_cl.eide.Operation.OpenSerialPortMonitor',
            arguments: serial_openBar_args,
        };

        // serial name btn
        serial_nameBar = statusBarManager.create('serialport-name');
        serial_nameBar.text = `${view_str$operation$serialport_name}: ${serial_curPort || 'none'}`;
        serial_nameBar.tooltip = 'serial name';
        serial_nameBar.command = '_cl.eide.selectCurSerialName';

        // serial baudrate btn
        serial_baudBar = statusBarManager.create('serialport-baud');
        const baudrate = settingManager.getSerialBaudrate();
        serial_baudBar.text = `${view_str$operation$baudrate}: ${baudrate}`;
        serial_baudBar.tooltip = serial_baudBar.text;
        serial_baudBar.command = 'eide.selectBaudrate';

        // show now
        updateSerialportBarState();
    }

    // register msys bash profile for windows
    if (os.platform() == 'win32') {
        context.subscriptions.push(vscode.window.registerTerminalProfileProvider(EideTerminalProvider.MSYS_BASH_ID,
            new EideTerminalProvider(EideTerminalProvider.MSYS_BASH_ID)));
    }

    context.subscriptions.push(
        vscode.window.registerTerminalProfileProvider(EideTerminalProvider.SYSTEM_SHELL_ID,
            new EideTerminalProvider(EideTerminalProvider.SYSTEM_SHELL_ID)));

    // update onchanged
    settingManager.on('onChanged', (e) => {

        /* serialport */
        if (e.affectsConfiguration('EIDE.SerialPortMonitor.ShowStatusBar')) {
            updateSerialportBarState();
        }
        else if (e.affectsConfiguration('EIDE.SerialPortMonitor.BaudRate') && serial_baudBar) {
            const baudrate = settingManager.getSerialBaudrate();
            serial_baudBar.text = `${view_str$operation$baudrate}: ${baudrate}`;
            serial_baudBar.tooltip = serial_baudBar.text;
            updateSerialportBarState();
        }

        /* set some toolpath to env when path is changed */
        if (e.affectsConfiguration('EIDE.ARM.GCC.InstallDirectory') ||
            e.affectsConfiguration('EIDE.JLink.InstallDirectory') ||
            e.affectsConfiguration('EIDE.OpenOCD.ExePath')) {
            exportEnvToSysPath();
        }
    });

    // register map view provider
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider('cl.eide.map.view',
            new MapViewEditorProvider(), { webviewOptions: { enableFindWidget: true } }));

    // terminal link providers
    context.subscriptions.push(
        vscode.window.registerTerminalLinkProvider(new EideTerminalLinkProvider()));

    return true;
}

function RegisterMsgListener() {
    LogAnalyzer.on('Error', (msg) => vscode.window.showErrorMessage((msg.title ? msg.title : ERROR) + ' : ' + msg.text));
    LogAnalyzer.on('Warning', (msg) => vscode.window.showWarningMessage((msg.title ? msg.title : WARNING) + ' : ' + msg.text));
    LogAnalyzer.on('Info', (msg) => vscode.window.showInformationMessage((msg.title ? msg.title : INFORMATION) + ' : ' + msg.text));
}

let prj_count: number = 0;

function RegisterGlobalEvent() {

    LogAnalyzer.on('Log', (msg) => {
        // no workspace, log to output panel
        if (LogAnalyzer.GetInstance().getLogListenerCount() < 2) {
            GlobalEvent.emit('globalLog', msg);
        }
    });

    const outChannel = vscode.window.createOutputChannel('eide-log');
    GlobalEvent.on('globalLog', (msg) => outChannel.appendLine(LogDumper.Msg2String(msg)));
    GlobalEvent.on('globalLog.append', (log) => outChannel.append(log));
    GlobalEvent.on('globalLog.show', () => outChannel.show());

    GlobalEvent.on('project.opened', () => {
        prj_count++; // increment cnt
        vscode.commands.executeCommand('setContext', 'cl.eide.projectActived', true);
        vscode.commands.executeCommand('setContext', 'cl.eide.enable.active', prj_count > 1);
    });

    GlobalEvent.on('project.closed', () => {
        prj_count--; // reduce cnt
        vscode.commands.executeCommand('setContext', 'cl.eide.projectActived', prj_count != 0);
        vscode.commands.executeCommand('setContext', 'cl.eide.enable.active', prj_count > 1);
    });
}

////////////////////////////////////////////
// --- task provider
////////////////////////////////////////////

interface EideShellTaskDef extends vscode.TaskDefinition {

    label: string;

    name?: string;

    command: string;

    options?: {
        cwd?: string;
    };

    env?: { [key: string]: string }
}

class EideTaskProvider implements vscode.TaskProvider {

    public static TASK_TYPE_MSYS = 'eide.msys';

    provideTasks(token: vscode.CancellationToken): vscode.ProviderResult<vscode.Task[]> {
        return undefined;
    }

    resolveTask(task_: vscode.Task, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Task> {

        const workspaceManager = WorkspaceManager.getInstance();

        if (task_.definition.type == EideTaskProvider.TASK_TYPE_MSYS) {

            const definition: EideShellTaskDef = <any>task_.definition;

            const task = new vscode.Task(definition, vscode.TaskScope.Workspace,
                definition.name || definition.label, EideTaskProvider.TASK_TYPE_MSYS, definition.problemMatchers);

            const shellcommand = definition.command;
            task.execution = new vscode.ShellExecution(shellcommand, {
                executable: platform.osType() == 'win32' ? `${process.env['EIDE_MSYS']}/bash.exe` : '/bin/bash',
                shellArgs: ['-c'],
                cwd: definition?.options?.cwd || workspaceManager.getCurrentFolder()?.path,
                env: utility.mergeEnv(process.env, definition.env || {})
            });

            task.group = definition.group;

            return task;
        }

        return undefined;
    }
}

////////////////////////////////////////////
// --- terminal link provider
////////////////////////////////////////////

class EideTerminalLink extends vscode.TerminalLink {
    file?: string;
    line?: number;
}

interface TerminalLinkPattern {
    regexp: RegExp;
    file: number;
    line: number;
    col?: number;
}

class EideTerminalLinkProvider implements vscode.TerminalLinkProvider<EideTerminalLink> {

    private workspace: File | undefined;

    private patterns: TerminalLinkPattern[] = [

        // keil c51
        {
            regexp: new RegExp("IN LINE (\\d+) OF ([^:]+):", 'i'),
            line: 1,
            file: 2
        },

        // armcc
        {
            regexp: new RegExp("^\"([^\"]+)\", line (\\d+):", 'i'),
            file: 1,
            line: 2
        },

        // gcc
        {
            regexp: new RegExp("^(.+):(\\d+):(\\d+):", 'i'),
            file: 1,
            line: 2,
            col: 3
        },

        // iar
        {
            regexp: new RegExp("^\\s*\"([^\"]+)\",(\\d+)\\s+", 'i'),
            file: 1,
            line: 2
        }
    ];

    constructor() {
        this.workspace = WorkspaceManager.getInstance().getWorkspaceRoot();
    }

    private toAbsPath(path: string): string {

        if (this.workspace == undefined || NodePath.isAbsolute(path)) {
            return path;
        }

        return File.normalize(`${this.workspace.path}/${path}`);
    }

    async provideTerminalLinks(context: vscode.TerminalLinkContext, token: vscode.CancellationToken): Promise<EideTerminalLink[]> {

        // only for eide builder task
        if (!context.terminal.name.trim().includes('build')) {
            return [];
        }

        for (const pattern of this.patterns) {
            const m = pattern.regexp.exec(context.line);
            if (m && m.length > 1) {
                const link = new EideTerminalLink(m.index, m[0].length);
                link.file = this.toAbsPath(m[pattern.file]);
                link.line = parseInt(m[pattern.line]) - 1;
                return [link];
            }
        }

        return [];
    }

    async handleTerminalLink(link: EideTerminalLink): Promise<void> {

        if (!link.file || !link.line || link.line == -1)
            return;

        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(link.file));

        vscode.window.showTextDocument(doc, {
            preview: true,
            selection: doc.lineAt(link.line).range
        });
    }
}

///////////////////////////////////////////////
// --- terminal provider
///////////////////////////////////////////////

class EideTerminalProvider implements vscode.TerminalProfileProvider {

    public static readonly MSYS_BASH_ID = 'eide.msys.bash';
    public static readonly SYSTEM_SHELL_ID = 'eide.system.shell';

    private type: string;

    constructor(id: string) {
        this.type = id;
    }

    provideTerminalProfile(token: vscode.CancellationToken): vscode.ProviderResult<vscode.TerminalProfile> {

        switch (this.type) {
            case EideTerminalProvider.MSYS_BASH_ID:
                return this.provideMsysTerminal();
            case EideTerminalProvider.SYSTEM_SHELL_ID:
                return this.provideSystemTerminal();
            default:
                return undefined;
        }
    }

    private cwd(allowUseLocActiveFolder?: boolean): string {

        let cwd = os.homedir();

        const workspace = WorkspaceManager.getInstance().getWorkspaceRoot();
        if (workspace && workspace.IsDir()) {
            cwd = workspace.path;
        } else if (allowUseLocActiveFolder) {
            const wsLi = WorkspaceManager.getInstance().getWorkspaceList();
            if (wsLi.length > 0) cwd = wsLi[0].path;
        }

        return cwd;
    }

    private provideSystemTerminal(): vscode.ProviderResult<vscode.TerminalProfile> {

        let shellName: string;
        let shellPath: string;

        if (platform.osType() == 'win32') {
            let f = ResManager.GetInstance().getPowerShell();
            if (f) {
                shellName = 'powershell';
                shellPath = f.path;
            } else {
                let cmd = ResManager.GetInstance().getCMDPath();
                if (cmd) {
                    shellName = 'cmd';
                    shellPath = cmd;
                } else {
                    GlobalEvent.emit('msg', newMessage('Error', `We can not found 'cmd.exe' in your pc !`));
                    return undefined;
                }
            }
        } else {
            shellName = 'shell';
            shellPath = '/bin/bash';
        }

        const welcome = [
            `--------------------------------------------`,
            `          \x1b[32;22m ${shellName} (eide env) \x1b[0m`,
            `--------------------------------------------`,
            ``
        ];

        return new vscode.TerminalProfile({
            name: shellName,
            shellPath: shellPath,
            cwd: this.cwd(true),
            env: process.env,
            strictEnv: true,
            message: welcome.join('\r\n')
        });
    }

    private provideMsysTerminal(): vscode.ProviderResult<vscode.TerminalProfile> {

        // welcome msg
        const welcome = [
            `--------------------------------------------`,
            `          \x1b[32;22m welcome to msys bash \x1b[0m`,
            `--------------------------------------------`,
            ``
        ];

        // check bash folder
        if (!process.env['EIDE_MSYS'] ||
            !File.IsDir(process.env['EIDE_MSYS'])) {
            return undefined;
        }

        return new vscode.TerminalProfile({
            name: 'msys bash',
            shellPath: `${process.env['EIDE_MSYS']}/bash.exe`,
            cwd: this.cwd(true),
            env: process.env,
            strictEnv: true,
            message: welcome.join('\r\n')
        });
    }
}

///////////////////////////////////////////////////
// --- .mapView viewer
///////////////////////////////////////////////////

import { FileWatcher } from '../lib/node-utility/FileWatcher';

interface MapViewRef {

    uid: string;

    vscWebview: vscode.Webview;

    title: string;

    toolName: string;

    treeDepth: number;

    mapPath: string;
};

interface MapViewInfo {

    watcher: FileWatcher;

    refList: MapViewRef[];
};

class MapViewEditorProvider implements vscode.CustomTextEditorProvider {

    private mapViews: Map<string, MapViewInfo> = new Map();

    resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel, token: vscode.CancellationToken): void | Thenable<void> {

        const viewFile = new File(document.fileName);
        const title = viewFile.noSuffixName;

        // view uid
        const uid = `${viewFile.path}-${Date.now().toString()}`;

        // init
        webviewPanel.title = title;
        webviewPanel.iconPath = vscode.Uri.file(ResManager.GetInstance().GetIconByName('Report_16x.svg').path);
        webviewPanel.webview.html = this.genHtmlCont(title, 'No Content');
        webviewPanel.onDidDispose(() => this.deleteRef(viewFile.path, uid));

        if (!viewFile.IsFile()) {
            webviewPanel.webview.html = this.genHtmlCont(title, `<span class="error">Error</span>: Not found file '${viewFile.path}' !`);
            return;
        }

        // check tool type
        const conf: { tool?: string, fileName?: string } = yaml.parse(viewFile.Read());
        if (!conf.tool) {
            webviewPanel.webview.html = this.genHtmlCont(title, `<span class="error">Error</span>: Invalid toolchain type !`);
            return;
        }

        let toolName = 'ARM_MICRO';
        let fileDepth = SettingManager.GetInstance().getMapViewParserDepth();

        if (fileDepth < 0)
            fileDepth = 1;

        switch (conf.tool) {
            case 'AC5':
            case 'AC6':
                toolName = 'ARM_MICRO';
                break;
            case 'GCC':
                toolName = 'GCC_ARM';
                break;
            default:
                webviewPanel.webview.html = this.genHtmlCont(title,
                    `<span class="error">Error</span>: We don't support this toolchain type: '${conf.tool}' yet !`);
                return;
        }

        // get map file
        const defName = viewFile.noSuffixName + '.map';
        const mapFile = File.fromArray([viewFile.dir, conf.fileName || defName]);

        if (!mapFile.IsFile()) {
            webviewPanel.webview.html = this.genHtmlCont(title, `<span class="error">Error</span>: Not found file '${mapFile.path}' !`);
            return;
        }

        // auto update when file changed 
        try {

            let mInfo = this.mapViews.get(viewFile.path);
            if (mInfo == undefined) {
                mInfo = { watcher: new FileWatcher(mapFile, false), refList: [] };
                mInfo.watcher.OnChanged = () => this.showMapView();
                mInfo.watcher.Watch();
                this.mapViews.set(viewFile.path, mInfo);
            }

            this.pushRef(viewFile.path, {
                uid: uid,
                vscWebview: webviewPanel.webview,
                title: title,
                toolName: toolName,
                treeDepth: fileDepth,
                mapPath: mapFile.path
            });

        } catch (error) {
            // do nothing
        }

        this.showMapView();
    }

    private pushRef(viewFilePath: string, item: MapViewRef) {

        const mInfo = this.mapViews.get(viewFilePath);
        if (mInfo) {
            const idx = mInfo.refList.findIndex((inf) => inf.uid == item.uid);
            if (idx == -1) {
                mInfo.refList.push(item);
            }
        }
    }

    private deleteRef(viewFilePath: string, uid: string) {

        const mInfo = this.mapViews.get(viewFilePath);
        if (mInfo) {

            const idx = mInfo.refList.findIndex((inf) => inf.uid == uid);
            if (idx != -1) {
                delete mInfo.refList[idx].vscWebview;
                mInfo.refList.splice(idx, 1);
            }

            if (mInfo.refList.length == 0) {
                try { mInfo.watcher.Close(); } catch (error) { }
                this.mapViews.delete(viewFilePath);
            }
        }
    }

    private showMapView() {

        this.mapViews.forEach((mInfo) => {

            for (const vInfo of mInfo.refList) {
                try {

                    let lines: string[];

                    if (os.platform() == 'win32') {
                        lines = ChildProcess
                            .execSync(`memap -t ${vInfo.toolName} -d ${vInfo.treeDepth} "${vInfo.mapPath}"`)
                            .toString().split(/\r\n|\n/);
                    } else {
                        const memapRoot = ResManager.GetInstance().getBuilderDir().path + File.sep + 'utils';
                        const command = `python memap -t ${vInfo.toolName} -d ${vInfo.treeDepth} "${vInfo.mapPath}"`;
                        lines = ChildProcess
                            .execSync(command, { cwd: memapRoot })
                            .toString().split(/\r\n|\n/);
                    }

                    // append color
                    for (let index = 0; index < lines.length; index++) {
                        const line = lines[index];
                        lines[index] = line
                            .replace(/\((\+[^0]\d*)\)/g, `(<span class="success">$1</span>)`)
                            .replace(/\((\-[^0]\d*)\)/g, `(<span class="error">$1</span>)`)
                            .replace(/^(\s*\|\s*)(Subtotals)/, `$1<span class="info">$2</span>`)
                            .replace(/^(\s*Total)/, `\n$1`);
                    }

                    vInfo.vscWebview.html = this.genHtmlCont(vInfo.title, lines.join('\n'));

                } catch (error) {
                    vInfo.vscWebview.html = this.genHtmlCont(vInfo.title, `<span class="error">Parse error</span>: \r\n${error.message}`);
                }
            }
        });
    }

    private genHtmlCont(title: string, cont: string): string {
        return `
        <!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>${title}</title>
                <style type="text/css">
                    body {
                        font-family: var(--vscode-editor-font-family);
                        font-size: var(--vscode-editor-font-size);
                    }
                    pre {
                        font-family: var(--vscode-editor-font-family);
                        font-size: var(--vscode-editor-font-size);
                    }
                    .success {
                        color: var(--vscode-terminal-ansiGreen);
                    }
                    .error {
                        color: var(--vscode-errorForeground);
                    }
                    .info {
                        color: var(--vscode-editorInfo-foreground);
                    }
                </style>
			</head>
			<body>
                <section>
				    <pre>${cont}</pre>
                </section>
			</body>
			</html>
        `;
    }
}

///////////////////////////////////////////////////
// KEIL_C51 -> SDCC converter
///////////////////////////////////////////////////

const sfrMap: Map<string, string> = new Map();

const insMap: any = {
    //sfr P0   = 0x80; => __sfr __at (0x80) P0   ;
    '__${1} __at(${3}) ${2};': /^\s*\b(sfr|sbit)\s+(\w+)\s*=\s*(0x[a-f0-9]+|\d+)\s*;/i
};

const keywordMap: any = {
    '__at(${1})': /\b_at_\s+([0-9A-Fa-fXx]+)\b/,
    '__using(${1})': /\busing\s+(\d+)\b/,
    '__interrupt(${1})': /\binterrupt\s+(\d+)\b/
};

function c51ToSDCC() {

    // file filter
    const fileFilter = /\.(?:h|c)$/i;

    if (vscode.window.activeTextEditor) {

        if (!fileFilter.test(vscode.window.activeTextEditor.document.fileName)) {
            GlobalEvent.emit('msg', newMessage('Warning', 'this file is not a .h/.c file !'));
            return;
        }

        const file = new File(vscode.window.activeTextEditor.document.uri.fsPath);
        const bkFile = new File(file.path + '.bk');

        if (file.IsFile()) {
            try {
                // backup
                fs.copyFileSync(file.path, bkFile.path);

                const res: string[] = [];
                sfrMap.clear();
                const lines = fs.readFileSync(file.path, 'utf8').split(/\n|\r\n/);

                lines.forEach((_line, index) => {
                    res.push(handleLine(_line, index + 1));
                });

                fs.writeFileSync(file.path, res.join(os.EOL));

                GlobalEvent.emit('msg', newMessage('Info', 'Convert finished !'));

            } catch (error) {
                GlobalEvent.emit('msg', ExceptionToMessage(error, 'Warning'));
            }
        } else {
            GlobalEvent.emit('msg', newMessage('Warning', 'not found file: \'' + file.path + '\''));
        }
    }
}

function handleLine(_line: string, index: number): string {

    let line = _line;

    // handle keyword
    for (const keyword in keywordMap) {
        const matchs = keywordMap[keyword].exec(line);
        if (matchs && matchs.length > 0) {
            let replacer = keyword;

            for (let i = 1; i < matchs.length; i++) {
                replacer = replacer.replace('${' + i.toString() + '}', matchs[i]);
            }

            line = line.replace(matchs[0], replacer);
        }
    }

    // handle registers
    for (const key in insMap) {
        const matchs = insMap[key].exec(line);

        if (matchs && matchs.length > 1) {
            let replacer = key;

            for (let i = 1; i < matchs.length; i++) {
                replacer = replacer.replace('${' + i.toString() + '}', matchs[i]);
            }

            line = line.replace(matchs[0], replacer);

            if (sfrMap.has(matchs[2])) {
                throw new Error('multiple sfr register \'' + matchs[2] + '\'' + ' at line: ' + index.toString());
            }

            sfrMap.set(matchs[2], matchs[3]);

            return line;
        }
    }

    //sbit  P00 = P0^0; => __sbit __at (0x80) P0_0 ;
    let replacer = '__sbit __at(${value}) ${1};';
    const reg = /^\s*\bsbit\s+(\w+)\s*=\s*(\w+)\s*\^\s*(\d+)\s*;/i;

    const matchs = reg.exec(line);
    if (matchs && matchs.length === 4) {
        replacer = replacer.replace('${1}', matchs[1]);

        if (!sfrMap.has(matchs[2])) {
            throw new Error('not found sfr register \'' + matchs[2] + '\' at line: ' + index.toString());
        }

        const val = parseInt(<string>sfrMap.get(matchs[2]))
            + parseInt(matchs[3]);
        replacer = replacer.replace('${value}', '0x' + val.toString(16));

        line = line.replace(matchs[0], replacer);
        return line;
    }

    return line;
}
