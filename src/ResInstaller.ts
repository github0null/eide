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
import * as os from 'os';
import * as fs from 'fs';
import * as child_process from 'child_process';
import * as NodePath from 'path';

import { HexUploaderType } from "./HexUploader";
import { SettingManager } from './SettingManager';
import { txt_install_now, txt_jump2settings, view_str$prompt$install_tools_by_online } from './StringTable';
import { ToolchainName } from "./ToolchainManager";
import * as utility from './utility';
import { File } from '../lib/node-utility/File';
import { GlobalEvent } from './GlobalEvents';
import { ExceptionToMessage, newMessage } from './Message';
import { SevenZipper } from './Compress';
import { ResManager } from './ResManager';
import * as platform from './Platform';
import { ExternalUtilToolIndexDef } from './WebInterface/WebInterface';
import { ExeCmd } from '../lib/node-utility/Executable';

let _instance: ResInstaller | undefined;

export type ExternalToolName = ToolchainName | HexUploaderType | 'cppcheck' | string;

export interface ExternalToolInfo {

    resource_name: string;
    readable_name: string;
    detail?: string;
    is_third_party?: boolean;
    getDrvInstaller?: () => string | undefined;
    postInstallCmd?: () => string | undefined;

    // for built-in tools
    setting_name?: string;
    require_name?: string;
    no_binaries?: boolean;

    // for external tools
    url?: string;
    bin_dir?: string;
    zip_type?: string;
};

export interface UtilToolInfo extends ExternalToolInfo {
    id: ExternalToolName;
};

export class ResInstaller {

    private locker: Map<string, boolean> = new Map();
    private toolsMap: Map<string, ExternalToolInfo> = new Map();
    private builtin_tool_list: string[] = [];

    private downloadSites: string[] = [
        'https://raw-github.github0null.io/github0null/eide-resource/master/packages',
        'https://raw.githubusercontent.com/github0null/eide-resource/master/packages'
    ];

    private constructor() {

        const no_binaries = os.platform() != 'win32'; // we not provide binaries for non-win32 platform.

        this.registerTool('SDCC', {
            resource_name: 'sdcc',
            readable_name: 'Small Device C Compiler (SDCC) (latest version)',
            setting_name: 'SDCC.InstallDirectory',
            no_binaries: no_binaries
        });

        /* this.registerTool('GNU_SDCC_STM8', {
            setting_name: 'STM8.GNU-SDCC.InstallDirectory',
            resource_name: 'stm8_gnu_sdcc',
            no_binaries: no_binaries
        }); */

        this.registerTool('GCC', {
            resource_name: 'gcc_arm',
            readable_name: 'GNU Arm Embedded Toolchain (stable)',
            setting_name: 'ARM.GCC.InstallDirectory',
            no_binaries: no_binaries
        });

        this.registerTool('RISCV_GCC', {
            resource_name: 'gcc_riscv',
            readable_name: 'RISC-V GCC Toolchain',
            setting_name: 'RISCV.InstallDirectory',
            no_binaries: no_binaries
        });

        this.registerTool('JLink', {
            resource_name: 'jlink',
            readable_name: 'JLink (v6.90)',
            setting_name: 'JLink.InstallDirectory',
            no_binaries: no_binaries,
            getDrvInstaller: () => {
                if (platform.osType() == 'win32') {
                    const arch = /(?:32|86)$/.test(os.arch()) ? 'x86' : 'x64';
                    return ['USBDriver', arch, `dpinst_${arch}${platform.exeSuffix()}`].join(File.sep);
                }
            }
        });

        this.registerTool('STVP', {
            resource_name: 'stvp',
            readable_name: 'STVP Flasher For STM8',
            setting_name: 'STM8.STVP.CliExePath',
            require_name: `STVP_CmdLine${platform.exeSuffix()}`,
            no_binaries: no_binaries,
            getDrvInstaller: () => {
                if (platform.osType() == 'win32') {
                    const arch = /(?:32|86)$/.test(os.arch()) ? 'x86' : 'x64';
                    return ['STTubDriver', `dpinst_${arch}${platform.exeSuffix()}`].join(File.sep);
                }
            }
        });

        /* this.registerTool('STLink', { setting_name: 'STLink.ExePath', require_name: `ST-LINK_CLI${platform.exeSuffix()}` }); */

        this.registerTool('STLink', {
            resource_name: 'st_cube_programer',
            readable_name: 'STM32 Cube Programmer CLI',
            setting_name: 'STLink.ExePath',
            require_name: `bin/STM32_Programmer_CLI${platform.exeSuffix()}`,
            no_binaries: no_binaries,
            getDrvInstaller: () => {
                if (platform.osType() == 'win32') {
                    const arch = /(?:32|86)$/.test(os.arch()) ? 'x86' : 'amd64';
                    return ['Drivers', 'stsw-link009_v3', `dpinst_${arch}${platform.exeSuffix()}`].join(File.sep);
                }
            }
        });

        this.registerTool('OpenOCD', {
            resource_name: 'openocd',
            readable_name: 'OpenOCD Programmer (v0.10.0 stable)',
            setting_name: 'OpenOCD.ExePath',
            require_name: `bin/openocd${platform.exeSuffix()}`,
            no_binaries: no_binaries
        });

        this.registerTool('cppcheck', {
            resource_name: 'cppcheck',
            readable_name: 'Cppcheck (Code Inspection)',
            setting_name: 'Cppcheck.ExecutablePath',
            require_name: `cppcheck${platform.exeSuffix()}`,
            no_binaries: no_binaries
        });

        for (const key of this.toolsMap.keys()) {
            this.builtin_tool_list.push(key.toLowerCase());
        }
    }

    private registerTool(name: ExternalToolName, info: ExternalToolInfo) {
        this.toolsMap.set(name.toLowerCase(), info);
    }

    getTool(name: ExternalToolName): ExternalToolInfo | undefined {
        return this.toolsMap.get(name.toLowerCase());
    }

    hasTool(name: ExternalToolName): boolean {
        return this.toolsMap.has(name.toLowerCase());
    }

    isToolInstalled(name: ExternalToolName): boolean | undefined {
        const tool = this.toolsMap.get(name.toLowerCase());
        if (tool) {
            const instDir = File.fromArray([ResManager.GetInstance().getUtilToolsDir(), tool.resource_name]);
            if (instDir.IsDir()) {
                if (tool.require_name) {
                    const p = NodePath.normalize(instDir.path + File.sep + tool.require_name);
                    return File.IsExist(p);
                } else {
                    return true;
                }
            }
        }
    }

    listAllTools(): UtilToolInfo[] {

        let res: UtilToolInfo[] = [];

        for (const kv of this.toolsMap) {
            const tool = kv[1];
            res.push({
                id: <ExternalToolName>kv[0],
                resource_name: tool.resource_name,
                readable_name: tool.readable_name,
                setting_name: tool.setting_name,
                require_name: tool.require_name,
                no_binaries: tool.no_binaries,
                is_third_party: tool.is_third_party,
                url: tool.url,
                detail: tool.detail
            });
        }

        res = res.sort((a, b) => {
            if (!a.is_third_party && b.is_third_party) return -1;
            if (a.is_third_party && !b.is_third_party) return 1;
            return a.resource_name.localeCompare(b.resource_name);
        });

        return res;
    }

    private lock(name: ExternalToolName): boolean {
        const key = name.toLowerCase();
        if (this.locker.get(key)) { return false; }
        this.locker.set(key, true);
        return true;
    }

    private unlock(name: ExternalToolName) {
        this.locker.delete(name.toLowerCase());
    }

    async refreshExternalToolsIndex() {

        const defIdxUrl = 'https://raw.githubusercontent.com/github0null/eide_default_external_tools_index/master/index.json';
        const idxUrl = utility.redirectHost(
            SettingManager.GetInstance().getExternalToolsIndexUrl() || defIdxUrl);

        const cont = await utility.requestTxt(idxUrl);

        if (cont instanceof Error) {
            GlobalEvent.emit('globalLog', ExceptionToMessage(cont, 'Warning'));
            return;
        }

        // invalid content
        if (!cont) return;

        let idxArray: ExternalUtilToolIndexDef[];

        try {
            idxArray = <ExternalUtilToolIndexDef[]>JSON.parse(cont);
            if (!Array.isArray(idxArray)) throw new Error(`Index file must be a json array obj !`);
        } catch (error) {
            GlobalEvent.emit('globalLog', ExceptionToMessage(error, 'Warning'));
            return;
        }

        // clear old tools
        const del_keys: string[] = [];
        this.toolsMap.forEach((val, key) => { if (val.is_third_party) del_keys.push(key); });
        del_keys.forEach(k => this.toolsMap.delete(k));

        const node_plat = os.platform();
        for (const tool of idxArray) {
            if (this.builtin_tool_list.includes(tool.id)) continue; // skip built-in tools
            if (!tool.resources[node_plat]) continue; // skip invalid platform
            this.registerTool(tool.id, {
                is_third_party: true,
                resource_name: tool.id,
                readable_name: tool.name,
                url: tool.resources[node_plat].url,
                zip_type: tool.resources[node_plat].zip_type,
                bin_dir: tool.resources[node_plat].bin_dir,
                detail: tool.resources[node_plat].detail,
                getDrvInstaller: () => {
                    if (node_plat != 'win32') return undefined;
                    const arch: string = /(?:32|86)$/.test(os.arch()) ? 'x86' : 'x64';
                    const drvPathMap = tool.resources[node_plat].win_drv_path;
                    if (drvPathMap) {
                        return drvPathMap[arch];
                    }
                },
                postInstallCmd: () => tool.resources[node_plat].post_install_cmd
            });
        }
    }

    /**
     * install a tool online
     *  
     * @return whether installed done !
    */
    async installTool(name: ExternalToolName): Promise<boolean> {

        const toolInfo = <ExternalToolInfo>this.getTool(name);

        /* lock installer */
        if (this.lock(name) == false) {
            GlobalEvent.emit('msg', newMessage('Warning', 'Busy !, This package is in installing !'));
            return false;
        }

        /* download it ! */
        let installedDone: boolean = false;
        const resourceName: string = toolInfo.resource_name;

        let resourceFile: File;

        if (toolInfo.is_third_party) {
            resourceFile = File.fromArray([os.tmpdir(), `${resourceName}.${toolInfo.zip_type}`]);
        } else {
            resourceFile = File.fromArray([os.tmpdir(), `${resourceName}.7z`])
        }

        try {

            const done = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Downloading package',
                cancellable: true
            }, async (progress, token): Promise<boolean> => {

                let res: Buffer | undefined | Error = undefined;

                // for built-in tools
                if (!toolInfo.is_third_party) {

                    /* random select the order of site */
                    if (Math.random() > 0.5) {
                        this.downloadSites.reverse();
                    }

                    for (const site of this.downloadSites) {
                        const downloadUrl = utility.redirectHost(`${site}/${resourceFile.name}`);
                        res = await utility.downloadFileWithProgress(downloadUrl, resourceFile.name, progress, token);
                        if (res instanceof Buffer) { break; } /* if done, exit loop */
                        progress.report({ message: 'Switch to next download site !' });
                    }
                }
                // for external tools
                else {
                    const downloadUrl = utility.redirectHost(toolInfo.url || 'null');
                    res = await utility.downloadFileWithProgress(downloadUrl, resourceFile.name, progress, token);
                }

                if (res instanceof Error) { /* download failed */
                    GlobalEvent.emit('msg', ExceptionToMessage(res, 'Warning'));
                    return false;
                } else if (res == undefined) { /* canceled */
                    return false;
                }

                /* save to file */
                fs.writeFileSync(resourceFile.path, res);

                return true;
            });

            /* download done, unzip and install it */
            if (done) {
                installedDone = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Installing package '${resourceName}'`,
                    cancellable: true
                }, (progress, cancel): Promise<boolean> => {

                    return new Promise(async (resolve_) => {

                        let __locked__ = false;
                        const resolveIf = (data: any) => {
                            if (!__locked__) {
                                __locked__ = true;
                                resolve_(data);
                            }
                        };

                        const resManager = ResManager.GetInstance();
                        const unzipper = new SevenZipper(resManager.Get7zDir());
                        const outDir = File.fromArray([resManager.getUtilToolsDir(), resourceName]);

                        platform.DeleteAllChildren(outDir);
                        outDir.CreateDir(true);

                        progress.report({ message: `Unzipping ...` });

                        cancel.onCancellationRequested(_ => {
                            progress.report({ message: `Canceling ...` });
                        });

                        const unzipErr = await unzipper.Unzip(resourceFile, outDir);
                        if (unzipErr) {
                            GlobalEvent.emit('msg', ExceptionToMessage(unzipErr, 'Warning'));
                            resolveIf(false);
                            return;
                        }

                        if (cancel.isCancellationRequested) {
                            resolveIf(false);
                            return;
                        }

                        progress.report({ message: `Unzipped done !, installing ...` });

                        // set bin dir
                        if (toolInfo.bin_dir) {
                            const BIN_PATH_FILE = File.fromArray([outDir.path, 'BIN_PATH']);
                            BIN_PATH_FILE.Write(`${toolInfo.bin_dir}`);
                        }

                        // run post install cmd
                        if (toolInfo.postInstallCmd) {

                            const command = toolInfo.postInstallCmd();
                            if (command) {

                                const done = await (new Promise<boolean>((resolve) => {

                                    progress.report({ message: `Running post-install cmd: '${command}' ...` });

                                    const proc = new ExeCmd();

                                    proc.on('launch', () => {
                                        GlobalEvent.emit('globalLog.show');
                                        GlobalEvent.emit('globalLog.append', `\n>>> exec cmd: '${command}'\n\n`);
                                    });

                                    proc.on('data', str => {
                                        GlobalEvent.emit('globalLog.append', str);
                                    });

                                    proc.on('close', exitInfo => {
                                        resolve(exitInfo.code == 0);
                                    });

                                    cancel.onCancellationRequested(_ => {
                                        if (!platform.kill(<number>proc.pid())) {
                                            GlobalEvent.emit('msg', newMessage('Warning', `Can not kill process: ${proc.pid()} !`));
                                        }
                                    });

                                    proc.Run(<string>command, undefined, { cwd: outDir.path });
                                }));

                                if (!done) {

                                    if (cancel.isCancellationRequested) {
                                        GlobalEvent.emit('globalLog.append', `\n----- user canceled -----\n`);
                                        GlobalEvent.emit('msg', newMessage('Info', `Installation has been canceled !`));
                                    } else {
                                        GlobalEvent.emit('msg', newMessage('Warning', `Install failed, see detail in 'eide.log' !`));
                                    }

                                    resolveIf(false);
                                    return;
                                }
                            }
                        }

                        // update eide settings
                        if (toolInfo.setting_name) {
                            let setting_val = ['${userRoot}', '.eide', 'tools', resourceName].join(File.sep);
                            setting_val = toolInfo.require_name ? `${setting_val}/${toolInfo.require_name}` : setting_val;
                            SettingManager.GetInstance().setConfigValue(toolInfo.setting_name, File.ToUnixPath(setting_val));
                        }

                        // install drivers if we need
                        if (toolInfo.getDrvInstaller) {
                            let drvExePath = toolInfo.getDrvInstaller();
                            if (drvExePath) {
                                drvExePath = outDir.path + File.sep + drvExePath;
                                utility.runShellCommand(`install driver`, `"${drvExePath}"`, undefined, true);
                            }
                        }

                        /* notify */
                        progress.report({ message: `'${resourceName}' installed done !` });

                        /* return it with delay */
                        setTimeout(() => resolveIf(true), 1500);
                    });
                });
            }

        } catch (error) {
            GlobalEvent.emit('error', error);
        }

        /* unlock */
        this.unlock(name);

        if (installedDone) {
            const msg = `You need to restart eide to refresh System Environment Variables !`;
            const sel = await vscode.window.showInformationMessage(msg, 'OK', 'Later');
            if (sel == 'OK') {
                await vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
        }

        return installedDone;
    }

    /**
     * jump to settings or install a tool online
     *  
     * @return whether installed done ! if jump to settings, it's false !
    */
    async setOrInstallTools(name: ExternalToolName, msg: string, setting_name?: string): Promise<boolean> {

        if (this.hasTool(name) == false) { /* not found tool, goto settings */
            vscode.window
                .showWarningMessage(msg, txt_jump2settings)
                .then((item) => {
                    if (item) {
                        SettingManager.jumpToSettings(setting_name || '@ext:cl.eide');
                    }
                });
            return false;
        }

        /* found tool, set, install or cancel it */
        const toolInfo = <ExternalToolInfo>this.getTool(name);

        let item: string | undefined;
        if (toolInfo.no_binaries) { // if no binaries, we only jump to settings
            item = await vscode.window.showWarningMessage(msg, txt_jump2settings);
        } else { // if have binaries, user need to do a select.
            item = await vscode.window.showWarningMessage(msg + `, ${view_str$prompt$install_tools_by_online}`,
                txt_install_now, txt_jump2settings);
        }

        if (!item) { return false; } // user canceled, exit

        if (item == txt_jump2settings) { // user select set it, jump to setting
            SettingManager.jumpToSettings(`${SettingManager.TAG}.${toolInfo.setting_name}` || '@ext:cl.eide');
            return false;
        }

        // user select 'install now', do it !
        return this.installTool(name);
    }

    public static instance(): ResInstaller {
        if (!_instance) { _instance = new ResInstaller(); }
        return _instance;
    }
}

