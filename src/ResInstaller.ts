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

let _instance: ResInstaller | undefined;

export type ExternalToolName = ToolchainName | HexUploaderType | 'cppcheck';

export interface ExternalToolInfo {
    setting_name: string;
    resource_name?: string;
    require_name?: string;
    no_binaries?: boolean;
    getDrvInstaller?: () => string | undefined;
};

export class ResInstaller {

    private toolsMap: Map<string, ExternalToolInfo>;
    private locker: Map<string, boolean>;

    private downloadSites: string[] = [
        'https://raw-github.github0null.io/github0null/eide-resource/master/packages',
        'https://raw.githubusercontent.com/github0null/eide-resource/master/packages'
    ];

    private constructor() {

        this.toolsMap = new Map();
        this.locker = new Map();

        /* register tools */
        const no_binaries = os.platform() != 'win32'; // we not provide binaries for non-win32 platform.

        this.registerTool('SDCC', {
            setting_name: 'SDCC.InstallDirectory',
            no_binaries: no_binaries
        });

        this.registerTool('GNU_SDCC_STM8', {
            setting_name: 'STM8.GNU-SDCC.InstallDirectory',
            resource_name: 'stm8_gnu_sdcc',
            no_binaries: no_binaries
        });

        this.registerTool('GCC', {
            setting_name: 'ARM.GCC.InstallDirectory',
            resource_name: 'gcc_arm',
            no_binaries: no_binaries
        });

        this.registerTool('RISCV_GCC', {
            setting_name: 'RISCV.InstallDirectory',
            resource_name: 'gcc_riscv',
            no_binaries: no_binaries
        });

        this.registerTool('JLink', {
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
            setting_name: 'STLink.ExePath', resource_name: 'st_cube_programer',
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
            setting_name: 'OpenOCD.ExePath',
            require_name: `bin/openocd${platform.exeSuffix()}`,
            no_binaries: no_binaries
        });

        this.registerTool('cppcheck', {
            setting_name: 'Cppcheck.ExecutablePath',
            require_name: `cppcheck${platform.exeSuffix()}`,
            no_binaries: no_binaries
        });
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

    private lock(name: ExternalToolName): boolean {
        const key = name.toLowerCase();
        if (this.locker.get(key)) { return false; }
        this.locker.set(key, true);
        return true;
    }

    private unlock(name: ExternalToolName) {
        this.locker.delete(name.toLowerCase());
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
        const resourceName: string = toolInfo.resource_name || name.toLowerCase();
        const resourceFile = File.fromArray([os.tmpdir(), `${resourceName}.7z`]);

        try {

            const done = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Downloading package',
                cancellable: true
            }, async (progress, token): Promise<boolean> => {

                let res: Buffer | undefined | Error = undefined;

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
                    cancellable: false
                }, (progress, __): Promise<boolean> => {

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

                        outDir.CreateDir(true);

                        progress.report({ message: `Unzipping ...` });

                        const unzipErr = await unzipper.Unzip(resourceFile, outDir);
                        if (unzipErr) {
                            GlobalEvent.emit('msg', ExceptionToMessage(unzipErr, 'Warning'));
                            resolveIf(false);
                            return;
                        }

                        progress.report({ message: `Unzipped done !, installing ...` });

                        /* update eide settings */
                        let setting_val = ['${userRoot}', '.eide', 'tools', resourceName].join(File.sep);
                        setting_val = toolInfo.require_name ? `${setting_val}/${toolInfo.require_name}` : setting_val;
                        SettingManager.GetInstance().setConfigValue(toolInfo.setting_name, File.ToLocalPath(setting_val));

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
                        setTimeout(() => resolveIf(true), 1000);
                    });
                });
            }

        } catch (error) {
            GlobalEvent.emit('error', error);
        }

        /* unlock */

        this.unlock(name);

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

