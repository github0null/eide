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

import * as vscode from "vscode";
import { File } from "../lib/node-utility/File";
import { ResManager } from "./ResManager";
import { AbstractProject } from "./EIDEProject";
import { ArmBaseCompileConfigModel } from "./EIDETypeDefine";
import { GlobalEvent } from "./GlobalEvents";
import { view_str$compile$options, view_str$compile$storageLayout, view_str$env_desc$builer_folder, view_str$env_desc$compiler_folder, view_str$env_desc$compiler_prefix, view_str$env_desc$output_dir, view_str$env_desc$project_name, view_str$env_desc$project_root, view_str$env_desc$toolchain_root, view_str$operation$done, view_str$project$cmsis_config_wizard } from "./StringTable";
import * as NodePath from 'path';
import * as CmsisConfigParser from './CmsisConfigParser'
import * as os from 'os'

let _instance: WebPanelManager;

export class WebPanelManager {

    private constructor() {
    }

    static newInstance(): WebPanelManager {
        if (_instance === undefined) {
            _instance = new WebPanelManager();
        }
        return _instance;
    }

    showStorageLayoutView(project: AbstractProject): void {

        const resManager = ResManager.GetInstance();

        const panel = vscode.window.createWebviewPanel('MemoryLayoutView',
            view_str$compile$storageLayout, vscode.ViewColumn.One,
            { enableScripts: true, retainContextWhenHidden: true });

        // set web icon
        panel.iconPath = vscode.Uri.parse(resManager.GetIconByName('Memory_16x.svg').ToUri());

        panel.onDidDispose(() => {
            //TODO
        });

        const compileModel = <ArmBaseCompileConfigModel>project.GetConfiguration().compileConfigModel;
        panel.webview.onDidReceiveMessage((_data: any) => {

            /* it's a message */
            if (typeof _data == 'string') {
                switch (_data) {
                    case 'eide.mem-layout.launched': /* webview launched */
                        {
                            panel.webview.postMessage({
                                DEF: project.GetPackManager().getCurrentDevInfo()?.storageLayout,
                                CURRENT: compileModel.data.storageLayout
                            });
                        }
                        break;
                    default:
                        break;
                }
            }

            /* it's ram/rom layout data */
            else {
                try {
                    compileModel.updateStorageLayout(_data);
                    panel.webview.postMessage('eide.mem-layout.status.done');
                } catch (error) {
                    GlobalEvent.emit('error', error);
                    panel.webview.postMessage('eide.mem-layout.status.fail');
                }
            }
        });

        const htmlFolder = File.fromArray([resManager.GetHTMLDir().path, 'mem_layout_view']);
        const htmlFile = File.fromArray([htmlFolder.path, 'index.html']);

        panel.webview.html = htmlFile.Read()
            .replace(/"[\w\-\.\/]+?\.(?:css|js)"/ig, (str) => {
                const fileName = str.substr(1, str.length - 2); // remove '"'
                const absPath = NodePath.normalize(htmlFolder.path + NodePath.sep + fileName);
                return `"${panel.webview.asWebviewUri(vscode.Uri.file(absPath)).toString()}"`;
            });

        panel.reveal();
    }

    showBuilderOptions(project: AbstractProject): void {

        const projectConfig = project.GetConfiguration();
        const resManager = ResManager.GetInstance();
        const htmlFolder = File.fromArray([resManager.GetHTMLDir().path, 'builder_options']);
        const htmlEntryFile = File.fromArray([htmlFolder.path, 'index.html']);

        const panelOptions: vscode.WebviewPanelOptions & vscode.WebviewOptions = {
            enableScripts: true,
            retainContextWhenHidden: true
        };

        const panel = vscode.window.createWebviewPanel(
            'builderOptionsView',
            view_str$compile$options,
            vscode.ViewColumn.One,
            panelOptions
        );

        // init panel data
        panel.iconPath = vscode.Uri.parse(resManager.GetIconByName('Property_16x.svg').ToUri());

        const optionsDataFile = projectConfig.compileConfigModel
            .getOptionsFile(project.getEideDir().path, projectConfig.config);

        const getModelFile = (dataFilePath: string): File => {
            const packageJson = resManager.getPackageJson();
            const jsonValidations = packageJson['contributes']['jsonValidation'];
            for (const validationObj of jsonValidations) {
                const fileSuffix = validationObj.fileMatch.replace('**/*', '');
                if (dataFilePath.endsWith(fileSuffix)) {
                    const path = resManager.getAppRootFolder().path + File.sep + validationObj.url;
                    return new File(NodePath.normalize(path));
                }
            }
            throw new Error(`not found model file for '${dataFilePath}'`)
        }

        const envList: any[] = [
            { name: '${TargetName}', desc: view_str$env_desc$project_name },
            { name: '${ProjectRoot}', desc: view_str$env_desc$project_root },
            { name: '${OutDir}', desc: view_str$env_desc$output_dir },
            { name: '${BuilderFolder}', desc: view_str$env_desc$builer_folder },
            { name: '${ToolchainRoot}', desc: view_str$env_desc$toolchain_root },
            { name: '${CompilerPrefix}', desc: view_str$env_desc$compiler_prefix },
            { name: '${CompilerFolder}', desc: view_str$env_desc$compiler_folder }
        ];

        const prjEnv = project.getProjectEnv() || {};
        for (const key in prjEnv) {
            envList.push({ name: `%${key}%`, desc: `${prjEnv[key]}` })
        }

        /* prepare page-init event data */
        const initMsg = {
            model: JSON.parse(getModelFile(optionsDataFile.path).Read()),
            data: JSON.parse(optionsDataFile.Read()),
            info: {
                lang: vscode.env.language,
                envList: envList
            }
        };

        panel.onDidDispose(() => {
            // TODO
        });

        panel.webview.onDidReceiveMessage((data) => {

            // it's a event from web view
            if (typeof data === 'string') {
                switch (data) {
                    // require open config file
                    case 'open-config':
                        vscode.window.showTextDocument(
                            vscode.Uri.parse(optionsDataFile.ToUri()),
                            { preview: true }
                        );
                        break;
                    /* post page-init event */
                    case 'eide.options_view.launched':
                        panel.webview.postMessage(initMsg);
                        break;
                    default:
                        break;
                }
            }

            // it's a status data from web view
            else {
                const status = {
                    success: false,
                    msg: 'Failed: unknown error'
                };

                try {
                    optionsDataFile.Write(JSON.stringify(data, undefined, 4))
                    status.success = true;
                    status.msg = view_str$operation$done;
                    project.NotifyBuilderConfigUpdate(optionsDataFile.name);
                } catch (error) {
                    status.success = false;
                    status.msg = (<Error>error).message;
                }

                panel.webview.postMessage({ status: status });
            }
        });

        /* set and display webview */

        panel.webview.html = htmlEntryFile.Read()
            .replace(/"[\w\-\.\/]+?\.(?:css|js)"/ig, (str) => {
                const fileName = str.substr(1, str.length - 2); // remove '"'
                const absPath = NodePath.normalize(htmlFolder.path + NodePath.sep + fileName);
                return `"${panel.webview.asWebviewUri(vscode.Uri.file(absPath)).toString()}"`;
            });

        panel.reveal();
    }

    showCmsisConfigWizard(uri: vscode.Uri): void {

        const srcFile = new File(uri.fsPath);
        const lines = srcFile.Read().split(/\r\n|\n/);

        let cmsisConfig: CmsisConfigParser.CmsisConfiguration | undefined;

        try {
            cmsisConfig = CmsisConfigParser.parse(lines);
        } catch (error) {
            throw error
        }

        if (cmsisConfig == undefined) { return; }

        const resManager = ResManager.GetInstance();
        const htmlFolder = File.fromArray([resManager.GetHTMLDir().path, 'cmsis_wizard_view']);
        const htmlEntryFile = File.fromArray([htmlFolder.path, 'index.html']);

        const panelOptions: vscode.WebviewPanelOptions & vscode.WebviewOptions = {
            enableScripts: true,
            retainContextWhenHidden: true
        };

        const panel = vscode.window.createWebviewPanel(
            'cmsis_wizard_view',
            srcFile.name,
            vscode.ViewColumn.One,
            panelOptions
        );

        // init panel data
        panel.iconPath = vscode.Uri.parse(resManager.GetIconByName('Property_16x.svg').ToUri());

        /* prepare page-init event data */
        const initMsg = {
            data: cmsisConfig,
            lines: lines,
        };

        panel.onDidDispose(() => {
            // TODO
        });

        panel.webview.onDidReceiveMessage((data) => {

            // it's a event from web view
            if (typeof data === 'string') {
                switch (data) {
                    // require open config file
                    case 'open-config':
                        vscode.window.showTextDocument(uri, { preview: true });
                        break;
                    /* post page-init event */
                    case 'eide.cmsis_config_wizard.launched':
                        panel.webview.postMessage(initMsg);
                        break;
                    default:
                        break;
                }
            }

            // command
            else if (data.type == 'cmd') {
                switch (data.cmd) {
                    case 'open-config':
                        {
                            const pos = new vscode.Position(data.arg, data.arg);
                            vscode.window.showTextDocument(uri, { preview: true, selection: new vscode.Range(pos, pos) });
                        }
                        break;
                    default:
                        break;
                }
            }

            // it's a status data from web view
            else {
                const status = {
                    success: false,
                    msg: 'Failed: unknown error'
                };

                try {
                    if (!Array.isArray(data)) throw Error(`Error response type: \'${typeof (data)}\'`);
                    srcFile.Write(data.join(os.EOL));
                    status.success = true;
                    status.msg = 'Save Done !';
                } catch (error) {
                    status.success = false;
                    status.msg = (<Error>error).message;
                }

                panel.webview.postMessage({ status: status });
            }
        });

        /* set and display webview */

        panel.webview.html = htmlEntryFile.Read()
            .replace(/"[\w\-\.\/]+?\.(?:css|js)"/ig, (str) => {
                const fileName = str.substr(1, str.length - 2); // remove '"'
                const absPath = NodePath.normalize(htmlFolder.path + NodePath.sep + fileName);
                return `"${panel.webview.asWebviewUri(vscode.Uri.file(absPath)).toString()}"`;
            });

        panel.reveal();
    }
}