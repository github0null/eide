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
import * as unzipper from 'unzipper';
import * as NodePath from 'path';
import * as ChildProcess from 'child_process';

import { GlobalEvent } from './GlobalEvents';
import { OperationExplorer } from './OperationExplorer';
import { ProjectExplorer } from './EIDEProjectExplorer';
import { ResManager } from './ResManager';
import { LogAnalyzer } from './LogAnalyzer';

import { ERROR, WARNING, INFORMATION, view_str$operation$serialport, view_str$operation$baudrate } from './StringTable';
import { LogDumper } from './LogDumper';
import { StatusBarManager } from './StatusBarManager';
import { File } from '../lib/node-utility/File';
import { newMessage, ExceptionToMessage } from './Message';
import { SettingManager } from './SettingManager';
import { WorkspaceManager } from './WorkspaceManager';
import { VirtualDocument } from './VirtualDocsProvider';
import * as utility from './utility';
import * as platform from './Platform';

let projectExplorer: ProjectExplorer;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

    // if not Windows platform, exit
    if (os.platform() !== 'win32') {
        vscode.window.showErrorMessage(`${ERROR} : This plug-in is only for 'Windows' platform !`);
        return;
    }

    RegisterGlobalEvent();
    RegisterMsgListener();

    GlobalEvent.emit('globalLog', newMessage('Info', 'Embedded IDE launch begin'));

    /* init eide components */
    const done = await InitComponents(context);
    if (!done) {
        vscode.window.showErrorMessage(`${ERROR} : Install eide binaries failed !, You can download offline [vsix package](https://github.com/github0null/eide/releases) and install it !`);
        return;
    }

    /* register vscode commands */
    const subscriptions = context.subscriptions;

    // global user commands
    subscriptions.push(vscode.commands.registerCommand('eide.ShowUUID', () => ShowUUID()));
    subscriptions.push(vscode.commands.registerCommand('eide.c51ToSdcc', () => c51ToSDCC()));
    subscriptions.push(vscode.commands.registerCommand('eide.ReloadJlinkDevs', () => reloadJlinkDevices()));
    subscriptions.push(vscode.commands.registerCommand('eide.ReloadStm8Devs', () => reloadStm8Devices()));
    subscriptions.push(vscode.commands.registerCommand('eide.selectBaudrate', () => onSelectSerialBaudrate()));

    const operationExplorer = new OperationExplorer(context);
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.Operation.Open', () => operationExplorer.OnOpenProject()));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.Operation.Create', () => operationExplorer.OnCreateProject()));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.Operation.Import', () => operationExplorer.OnImportProject()));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.Operation.SetToolchainPath', () => operationExplorer.OnSetToolchainPath()));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.Operation.OpenSerialPortMonitor', () => operationExplorer.onOpenSerialPortMonitor()));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.Operation.openSettings', () => SettingManager.jumpToSettings('@ext:cl.eide')));

    // public cmds
    subscriptions.push(vscode.commands.registerCommand('eide.operation.install_toolchain', () => operationExplorer.OnSetToolchainPath()));
    subscriptions.push(vscode.commands.registerCommand('eide.operation.import_project', () => operationExplorer.OnImportProject()));
    subscriptions.push(vscode.commands.registerCommand('eide.operation.new_project', () => operationExplorer.OnCreateProject()));

    projectExplorer = new ProjectExplorer(context);

    subscriptions.push(vscode.commands.registerCommand('_cl.eide.workspace.build', () => projectExplorer.buildWorkspace()));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.workspace.rebuild', () => projectExplorer.buildWorkspace(true)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.workspace.open.config', () => projectExplorer.openWorkspaceConfig()));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.workspace.make.template', (item) => projectExplorer.ExportToTemplate(undefined, true)));

    // public cmds
    subscriptions.push(vscode.commands.registerCommand('eide.project.rebuild', (item) => projectExplorer.BuildSolution(item)));
    subscriptions.push(vscode.commands.registerCommand('eide.project.build', (item) => projectExplorer.BuildSolution(item, { useFastMode: true })));
    subscriptions.push(vscode.commands.registerCommand('eide.project.clean', (item) => projectExplorer.BuildClean(item)));
    subscriptions.push(vscode.commands.registerCommand('eide.project.uploadToDevice', (item) => projectExplorer.UploadToDevice(item)));
    subscriptions.push(vscode.commands.registerCommand('eide.reinstall.binaries', () => checkAndInstallBinaries(context, true)));

    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.historyRecord', () => projectExplorer.openHistoryRecords()));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.clearHistoryRecord', () => projectExplorer.clearAllHistoryRecords()));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.showBuildParams', (item) => projectExplorer.BuildSolution(item, { useDebug: true })));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.generate.makefile', (item) => projectExplorer.generateMakefile(item)));

    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.setActive', (item) => projectExplorer.setActiveProject(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.close', (item) => projectExplorer.Close(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.saveAll', () => projectExplorer.SaveAll()));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.refresh', () => projectExplorer.Refresh()));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.switchMode', (item) => projectExplorer.switchTarget(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.exportAsTemplate', (item) => projectExplorer.ExportToTemplate(item)));

    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.addSrcDir', (item) => projectExplorer.AddSrcDir(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.removeSrcDir', (item) => projectExplorer.RemoveSrcDir(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.sourceRoot.refresh', (item) => projectExplorer.refreshSrcRoot(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.modify.files.options', (item) => projectExplorer.showFilesOptions(item)));

    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.source.filesystem_folder_add_file', (item) => projectExplorer.fs_folderAddFile(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.source.filesystem_folder_add', (item) => projectExplorer.fs_folderAdd(item)));

    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.source.virtual_folder_add_file', (item) => projectExplorer.Virtual_folderAddFile(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.source.virtual_folder_add', (item) => projectExplorer.Virtual_folderAdd(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.source.virtual_folder_remove', (item) => projectExplorer.Virtual_removeFolder(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.source.virtual_folder_rename', (item) => projectExplorer.Virtual_renameFolder(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.source.virtual_file_remove', (item) => projectExplorer.Virtual_removeFile(item)));

    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.excludeSource', (item) => projectExplorer.ExcludeSourceFile(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.unexcludeSource', (item) => projectExplorer.UnexcludeSourceFile(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.excludeFolder', (item) => projectExplorer.ExcludeFolder(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.unexcludeFolder', (item) => projectExplorer.UnexcludeFolder(item)));

    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.installCMSISHeaders', (item) => projectExplorer.installCMSISHeaders(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.removePackage', (item) => projectExplorer.UninstallKeilPackage(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.addPackage', (item) => projectExplorer.InstallKeilPackage(item.val.projectIndex)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.exportXml', (item) => projectExplorer.ExportKeilXml(item.val.projectIndex)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.setDevice', (item) => projectExplorer.SetDevice(item.val.projectIndex)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.modifyCompileConfig', (item) => projectExplorer.ModifyCompileConfig(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.switchToolchain', (item) => projectExplorer.onSwitchCompileTools(item)));

    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.modifyUploadConfig', (item) => projectExplorer.ModifyUploadConfig(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.switchUploader', (item) => projectExplorer.switchUploader(item)));

    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.addIncludeDir', (item) => projectExplorer.AddIncludeDir(item.val.projectIndex)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.addDefine', (item) => projectExplorer.AddDefine(item.val.projectIndex)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.addLibDir', (item) => projectExplorer.AddLibDir(item.val.projectIndex)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.showIncludeDir', (item) => projectExplorer.showIncludeDir(item.val.projectIndex)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.showDefine', (item) => projectExplorer.showDefine(item.val.projectIndex)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.showLibDir', (item) => projectExplorer.showLibDir(item.val.projectIndex)));

    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.modifyOtherSettings', (item) => projectExplorer.ModifyOtherSettings(item)));

    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.modify.deps', (item) => projectExplorer.ModifyCustomDependence(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.removeDependenceItem', (item) => projectExplorer.RemoveDependenceItem(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.importDependenceFromPack', (item) => projectExplorer.ImportPackageDependence(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.removeDependenceFromPack', (item) => projectExplorer.RemovePackageDependence(item)));

    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.copyItemValue', (item) => projectExplorer.CopyItemValue(item)));

    /* other project tools */
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.source.show_disassembly', (url) => projectExplorer.showDisassembly(url)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.source.show_cmsis_config_wizard', (url) => projectExplorer.showCmsisConfigWizard(url)));
    //subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.cppcheck.check_file', (url) => projectExplorer.cppcheckFile(url)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.cppcheck.check_all', (item) => projectExplorer.cppcheckProject(item)));
    subscriptions.push(vscode.commands.registerCommand('_cl.eide.project.cppcheck.clear_all', (item) => projectExplorer.clearCppcheckDiagnostic()));

    operationExplorer.on('request_open_project', (fsPath) => projectExplorer.emit('request_open_project', fsPath));
    operationExplorer.on('request_create_project', (option) => projectExplorer.emit('request_create_project', option));
    operationExplorer.on('request_create_from_template', (option) => projectExplorer.emit('request_create_from_template', option));
    operationExplorer.on('request_import_project', (option) => projectExplorer.emit('request_import_project', option));

    // others
    vscode.workspace.registerTextDocumentContentProvider(VirtualDocument.scheme, VirtualDocument.instance());

    /* auto save project */
    setInterval(() => projectExplorer.SaveAll(), 5 * 60 * 1000);

    // launch done
    GlobalEvent.emit('extension_launch_done');
    GlobalEvent.emit('globalLog', newMessage('Info', 'Embedded IDE launch done'));
}

// this method is called when your extension is deactivated
export function deactivate() {
    console.log('extension close');
    StatusBarManager.getInstance().disposeAll();
    GlobalEvent.emit('extension_close');
}

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
        StatusBarManager.getInstance().show('serialport-baud');
    } else {
        StatusBarManager.getInstance().hide('serialport');
        StatusBarManager.getInstance().hide('serialport-baud');
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

async function checkAndInstallBinaries(constex: vscode.ExtensionContext, forceInstall?: boolean): Promise<boolean> {

    const eideCfg = ResManager.GetInstance().getAppConfig<any>();
    const binVersion = eideCfg['binaray_version'] ? `-${eideCfg['binaray_version']}` : ''

    const downloadSites: string[] = [
        `https://raw.githubusercontent.com/github0null/eide-resource/master/binaries/bin${binVersion}.zip`,
        `https://raw-github.github0null.io/github0null/eide-resource/master/binaries/bin${binVersion}.zip`
    ];

    /* random select the order of site */
    if (Math.random() > 0.5) {
        downloadSites.reverse();
    }

    const rootFolder = new File(constex.extensionPath);
    const binFolder = File.fromArray([rootFolder.path, 'bin']);

    /* check bin folder */
    if (forceInstall) {
        platform.DeleteDir(binFolder);
    } else {
        if (binFolder.IsDir() &&
            File.fromArray([binFolder.path, File.ToLocalPath('lib/mono/4.5/mscorlib.dll')]).IsFile()) {
            return true; /* found it, exit */
        }
    }

    let installedDone = false;

    try {
        const tmpFile = File.fromArray([os.tmpdir(), `eide-binaries${binVersion}.zip`]);

        /* make dir */
        binFolder.CreateDir(true);

        const done = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Downloading eide binaries',
            cancellable: false
        }, async (progress, token): Promise<boolean> => {

            let res: Buffer | undefined | Error = undefined;

            for (const site of downloadSites) {
                const realUrl = utility.redirectHost(site);
                res = await utility.downloadFileWithProgress(realUrl, tmpFile.name, progress, token);
                if (res instanceof Buffer) { break; } /* if done, exit loop */
                progress.report({ message: 'Switch to next download site !' });
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

                    fs.createReadStream(tmpFile.path)

                        /* goto parse */
                        .pipe(unzipper.Parse())

                        /* on unzipping */
                        .on('entry', (entry) => {
                            if (entry.type == 'File') {
                                const file = File.fromArray([binFolder.path, File.ToLocalPath(entry.path)]);
                                progress.report({ message: `Unzipping ${entry.path} ...` });
                                new File(file.dir).CreateDir(true); /* create dir */
                                entry.pipe(fs.createWriteStream(file.path));
                            } else {
                                entry.autodrain();
                            }
                        })

                        /* on unzip closed */
                        .on('close', () => {
                            progress.report({ message: `Install eide binaries done !` });
                            setTimeout(() => resolveIf(true), 500);
                        })

                        /* on unzip error */
                        .on('error', (err) => {
                            GlobalEvent.emit('error', err);
                            resolveIf(false);
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

    return installedDone;
}

let isEnvSetuped: boolean = false;

function exportEnvToSysPath() {

    const settingManager = SettingManager.GetInstance();

    const pathList: { key: string, path: string }[] = [
        { key: 'EIDE_ARM_GCC', path: `${settingManager.getGCCDir().path}${File.sep}bin` },
        { key: 'EIDE_JLINK', path: `${settingManager.getJlinkDir()}` },
        { key: 'EIDE_OPENOCD', path: `${NodePath.dirname(settingManager.getOpenOCDExePath())}` }
    ];

    /* append to system env if we not */
    if (isEnvSetuped == false) {
        const pList = pathList.filter((env) => new File(env.path).IsDir()).map((env) => `${env.path}`);
        platform.exportToSysEnv(process.env, pList);
        isEnvSetuped = true;
    }

    /* update env value */
    for (const env of pathList) {
        if (new File(env.path).IsDir()) {
            process.env[env.key] = env.path;
        } else {
            process.env[env.key] = '';
        }
    }
}

async function InitComponents(context: vscode.ExtensionContext): Promise<boolean | undefined> {

    // init resource manager
    ResManager.GetInstance(context);

    /* check binaries, if not found, install it ! */
    const done = await checkAndInstallBinaries(context);
    if (!done) { return false; } /* exit if failed */

    const settingManager = SettingManager.GetInstance(context);

    try {
        // register telemetry hook
        const TelemetryTask = require('./Telemetry/TelemetryTask');
        TelemetryTask.registerTelemetryHook();
    } catch (error) {
        // ignore error
    }

    // init status bar
    const statusBarManager = StatusBarManager.getInstance();

    // serial btn
    const spBar = statusBarManager.create('serialport');
    spBar.text = '$(plug) ' + view_str$operation$serialport;
    spBar.tooltip = view_str$operation$serialport;
    spBar.command = 'Operation.OpenSerialPortMonitor';

    // serial baudrate btn
    const baudBar = statusBarManager.create('serialport-baud');
    const baudrate = settingManager.getSerialBaudrate();
    baudBar.text = `${view_str$operation$baudrate}: ${baudrate}`;
    baudBar.tooltip = baudBar.text;
    baudBar.command = 'eide.selectBaudrate';

    // show now
    updateSerialportBarState();

    /* set some toolpath to env */
    exportEnvToSysPath();

    // update onchanged
    settingManager.on('onChanged', (e) => {

        /* serialport */

        if (e.affectsConfiguration('EIDE.SerialPortMonitor.ShowStatusBar')) {
            updateSerialportBarState();
        }
        else if (e.affectsConfiguration('EIDE.SerialPortMonitor.BaudRate')) {
            const baudrate = settingManager.getSerialBaudrate();
            baudBar.text = `${view_str$operation$baudrate}: ${baudrate}`;
            baudBar.tooltip = baudBar.text;
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
        vscode.window.registerCustomEditorProvider('cl.eide.map.view', new MapViewEditorProvider(), {
            webviewOptions: { enableFindWidget: true }
        })
    );

    return true;
}

function RegisterMsgListener() {
    LogAnalyzer.on('Error', (msg) => vscode.window.showErrorMessage((msg.title ? msg.title : ERROR) + ' : ' + msg.text));
    LogAnalyzer.on('Warning', (msg) => vscode.window.showWarningMessage((msg.title ? msg.title : WARNING) + ' : ' + msg.text));
    LogAnalyzer.on('Info', (msg) => vscode.window.showInformationMessage((msg.title ? msg.title : INFORMATION) + ' : ' + msg.text));
}

let prj_count: number = 0;

function RegisterGlobalEvent() {

    GlobalEvent.on('request_init_component', () => {
        ResManager.GetInstance().InitWorkspace();
        LogDumper.getInstance();
        GlobalEvent.emit('response_init_component');
    });

    LogAnalyzer.on('Log', (msg) => {
        // no workspace, log to output pannel
        if (LogAnalyzer.GetInstance().getLogListenerCount() < 2) {
            GlobalEvent.emit('globalLog', msg);
        }
    });

    const outChannel = vscode.window.createOutputChannel('eide-log');
    GlobalEvent.on('globalLog', (msg) => {
        outChannel.appendLine(LogDumper.Msg2String(msg));
    });

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

// --- .mapView viewer

import * as yaml from 'yaml'
import { FileWatcher } from '../lib/node-utility/FileWatcher';

interface MapViewRef {

    webview: vscode.Webview;

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

        // init
        webviewPanel.title = title;
        webviewPanel.iconPath = vscode.Uri.parse(ResManager.GetInstance().GetIconByName('file_type_map.svg').ToUri());
        webviewPanel.webview.html = this.genHtmlCont(title, 'No Content');
        webviewPanel.onDidDispose(() => this.deleteRef(viewFile.path, webviewPanel.webview));

        if (!viewFile.IsFile()) {
            webviewPanel.webview.html = this.genHtmlCont(title, `<span class="error">Error</span>: file '${viewFile.path}' is not a file !`);
            return;
        }

        const conf: { tool?: string, fileName?: string } = yaml.parse(viewFile.Read());
        const defName = viewFile.noSuffixName + '.map';
        const mapFile = File.fromArray([viewFile.dir, conf.fileName || defName]);

        if (!mapFile.IsFile()) {
            webviewPanel.webview.html = this.genHtmlCont(title, `<span class="error">Error</span>: file '${mapFile.path}' is not a file !`);
            return;
        }

        if (!conf.tool) {
            webviewPanel.webview.html = this.genHtmlCont(title, `<span class="error">Error</span>: invalid toolchain type !`);
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
                webviewPanel.webview.html = this.genHtmlCont(title, `<span class="error">Error</span>: we not support this toolchain type: '${conf.tool}' !`);
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
                webview: webviewPanel.webview,
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
            const idx = mInfo.refList.findIndex((inf) => inf.webview == item.webview);
            if (idx == -1) {
                mInfo.refList.push(item);
            }
        }
    }

    private deleteRef(viewFilePath: string, webview: vscode.Webview) {

        const mInfo = this.mapViews.get(viewFilePath);
        if (mInfo) {

            const idx = mInfo.refList.findIndex((inf) => inf.webview == webview);
            if (idx != -1) {
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
                    const execPath = ResManager.GetInstance().getBuilderDir() + File.sep + 'memap';
                    const lines = ChildProcess
                        .execSync(`${execPath} -t ${vInfo.toolName} -d ${vInfo.treeDepth} "${vInfo.mapPath}"`)
                        .toString().split(/\r\n|\n/);

                    // append color
                    for (let index = 0; index < lines.length; index++) {
                        const line = lines[index];
                        lines[index] = line
                            .replace(/\((\+[^0]\d*)\)/g, `(<span class="success">$1</span>)`)
                            .replace(/\((\-[^0]\d*)\)/g, `(<span class="error">$1</span>)`)
                            .replace(/^(\s*\|\s*)(Subtotals)/, `$1<span class="info">$2</span>`)
                            .replace(/^(\s*Total)/, `\n$1`);
                    }

                    vInfo.webview.html = this.genHtmlCont(vInfo.title, lines.join('\n'));

                } catch (error) {
                    vInfo.webview.html = this.genHtmlCont(vInfo.title, `<span class="error">Parse error</span>: \r\n${error.message}`);
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

//-----------------------------------------

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
