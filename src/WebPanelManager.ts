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
import { ArmBaseCompileConfigModel } from "./EIDEProjectModules";
import { GlobalEvent } from "./GlobalEvents";
import { view_str$compile$options, view_str$compile$storageLayout, view_str$env_desc$builer_folder, view_str$env_desc$compiler_folder, view_str$env_desc$compiler_prefix, view_str$env_desc$output_dir, view_str$env_desc$project_name, view_str$env_desc$project_root, view_str$env_desc$toolchain_root, view_str$operation$done, view_str$project$cmsis_config_wizard } from "./StringTable";
import * as NodePath from 'path';
import * as CmsisConfigParser from './CmsisConfigParser'
import * as os from 'os'
import * as platform from './Platform';
import * as fs from 'fs';
import { EncodingConverter } from "./EncodingConverter";
import { SimpleUIConfig } from "./SimpleUIDef";
import { newMessage, ExceptionToMessage } from "./Message";
import * as jsonc_parser from 'jsonc-parser';

let _instance: WebPanelManager;

export class WebPanelManager {

    private constructor() {
    }

    static instance(): WebPanelManager {
        if (_instance === undefined) {
            _instance = new WebPanelManager();
        }
        return _instance;
    }

    showSimpleConfigUI(cfg: SimpleUIConfig,
        onSubmit: (newCfg: SimpleUIConfig, thisPanel: vscode.WebviewPanel) => Promise<void | 'canceled'>,
        onMsg?: (msg: string, thisPanel: vscode.WebviewPanel) => void): vscode.WebviewPanel {

        const resManager = ResManager.GetInstance();

        let ViewCol = cfg.viewColumn;

        if (ViewCol == undefined || ViewCol == null) {
            ViewCol = vscode.ViewColumn.One;
        }

        const panel = vscode.window.createWebviewPanel('eide.simple-cfg-ui',
            cfg.title, 
            { viewColumn: ViewCol, preserveFocus: cfg.notTakeFocus }, 
            { enableScripts: true, retainContextWhenHidden: true });

        panel.iconPath = vscode.Uri.file(resManager.GetIconByName(cfg.iconName || 'Property_16x.svg').path);

        panel.webview.onDidReceiveMessage(async (_data: any) => {
            /* it's a message */
            if (typeof _data == 'string') {
                switch (_data) {
                    case 'eide.simple-cfg-ui.launched': /* webview launched */
                        panel.webview.postMessage(cfg);
                        break;
                    default:
                        if (onMsg) onMsg(_data, panel);
                        break;
                }
            }

            /* it's obj data */
            else {
                try {
                    const ret = await onSubmit(_data, panel);
                    if (ret != 'canceled')
                        panel.webview.postMessage('eide.simple-cfg-ui.status.done');
                } catch (error) {
                    GlobalEvent.emit('error', error);
                    panel.webview.postMessage('eide.simple-cfg-ui.status.fail');
                }
            }
        });

        const htmlFolder = File.fromArray([resManager.GetHTMLDir().path, 'simple_config_ui']);
        const htmlFile = File.fromArray([htmlFolder.path, 'index.html']);

        panel.webview.html = htmlFile.Read()
            .replace(/"[\w\-\.\/]+?\.(?:css|js)"/ig, (str) => {
                const fileName = str.substr(1, str.length - 2); // remove '"'
                const absPath = File.normalize(htmlFolder.path + NodePath.sep + fileName);
                return `"${panel.webview.asWebviewUri(vscode.Uri.file(absPath)).toString()}"`;
            });

        panel.reveal();

        return panel;
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
                const absPath = File.normalize(htmlFolder.path + NodePath.sep + fileName);
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

        const getModelFile = (verifyFileName: string): File => {
            const packageJson = resManager.getPackageJson();
            const jsonValidations = packageJson['contributes']['jsonValidation'];
            for (const validationObj of jsonValidations) {
                const fname = NodePath.basename(validationObj.url);
                if (fname == verifyFileName) {
                    const path = resManager.getAppRootFolder().path + File.sep + validationObj.url;
                    return new File(File.normalize(path));
                }
            }
            throw new Error(`not found model file for '${verifyFileName}'`)
        }

        const envList: any[] = [
            // unify_builder specific variables
            { name: '${BuilderFolder}', desc: view_str$env_desc$builer_folder },
            { name: '${CompilerPrefix}', desc: view_str$env_desc$compiler_prefix },
            { name: '${CompilerFolder}', desc: view_str$env_desc$compiler_folder }
        ];

        const prjEnv = project.getProjectVariables();
        for (const key in prjEnv) {
            envList.push({
                name: `\$\{${key}\}`,
                desc: `${prjEnv[key]}`
            })
        }

        /* prepare page-init event data */
        const initMsg = <any>{
            model: JSON.parse(getModelFile(project.getToolchain().verifyFileName).Read()),
            data: projectConfig.compileConfigModel.getOptions(),
            info: {
                lang: vscode.env.language,
                envList: envList,
                contextData: {}
            }
        };

        const toolchain = project.getToolchain();

        if (toolchain.getGccCompilerTargetInfo) {
            const inf = toolchain.getGccCompilerTargetInfo();
            if (inf) {
                initMsg.info.contextData['gcc.compiler.archs'] = inf.archs;
                initMsg.info.contextData['gcc.compiler.abis'] = inf.abis;
                initMsg.info.contextData['gcc.compiler.riscv.code-models'] = inf.rv_codeModels;
            }
        }

        panel.onDidDispose(() => {
            // TODO
        });

        panel.webview.onDidReceiveMessage(async (data) => {

            // it's a event from web view
            if (typeof data === 'string') {
                switch (data) {
                    // require open config file
                    case 'open-config': {
                        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(project.getEideProjectFile().path));
                        // get builder options location in file
                        let docSelection: vscode.Range | undefined;
                        const rootNode = jsonc_parser.parseTree(project.getEideProjectFile().Read());
                        if (rootNode) {
                            const targetName = project.getCurrentTarget();
                            const toolchainName = project.getToolchain().name;
                            const node = jsonc_parser.findNodeAtLocation(rootNode, 
                                ['targets', targetName, 'builderOptions', toolchainName]);
                            if (node) {
                                let s = doc.positionAt(node.offset);
                                let e = doc.positionAt(node.offset + node.length);
                                docSelection = new vscode.Range(s, e);
                            }
                        }
                        // open document
                        vscode.window.showTextDocument(doc, { preview: true, selection: docSelection });
                        break;
                    }
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
                    projectConfig.compileConfigModel.setOptions(data);
                    status.success = true;
                    status.msg = view_str$operation$done;
                    project.NotifyBuilderConfigUpdate();
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
                const absPath = File.normalize(htmlFolder.path + NodePath.sep + fileName);
                return `"${panel.webview.asWebviewUri(vscode.Uri.file(absPath)).toString()}"`;
            });

        panel.reveal();
    }

    showCmsisConfigWizard(uri: vscode.Uri): void {

        // get current encoding for this file
        const fencoding = vscode.workspace.getConfiguration(undefined, uri).get<string>('files.encoding') || 'utf8';
        const inputFile = new File(uri.fsPath);

        let fileContUtf8Buf = fs.readFileSync(inputFile.path);

        if (fencoding != 'utf8') {
            fileContUtf8Buf = EncodingConverter.toUtf8Code(fileContUtf8Buf, fencoding);
        }

        const lines = fileContUtf8Buf.toString().split(/\r\n|\n/);

        let cmsisConfig: CmsisConfigParser.CmsisConfiguration | undefined;

        try {
            cmsisConfig = CmsisConfigParser.parse(lines);
        } catch (error) {
            GlobalEvent.emit('globalLog', ExceptionToMessage(error, 'Error'));
            return; // parse error
        }

        if (cmsisConfig == undefined ||
            cmsisConfig.items.length == 0) {
            GlobalEvent.emit('msg', newMessage('Info', 'Not found any CMSIS Configurations in this header !'));
            return; // no data
        }

        const resManager = ResManager.GetInstance();
        const htmlFolder = File.fromArray([resManager.GetHTMLDir().path, 'cmsis_wizard_view']);
        const htmlEntryFile = File.fromArray([htmlFolder.path, 'index.html']);

        const panelOptions: vscode.WebviewPanelOptions & vscode.WebviewOptions = {
            enableScripts: true,
            retainContextWhenHidden: true
        };

        const panel = vscode.window.createWebviewPanel(
            'cmsis_wizard_view',
            inputFile.name,
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
                            const pos_s = new vscode.Position(data.arg, 0);
                            const pos_e = new vscode.Position(data.arg, 300);
                            vscode.window.showTextDocument(uri, { preview: true, selection: new vscode.Range(pos_s, pos_e) });
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
                    if (!Array.isArray(data)) {
                        throw Error(`Error response type: \'${typeof (data)}\'`);
                    }

                    const fileContent = data.join(os.EOL);

                    if (fencoding != 'utf8') {
                        fs.writeFileSync(inputFile.path, EncodingConverter.toTargetCode(fileContent, fencoding));
                    } else {
                        inputFile.Write(fileContent);
                    }

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
                const absPath = File.normalize(htmlFolder.path + NodePath.sep + fileName);
                return `"${panel.webview.asWebviewUri(vscode.Uri.file(absPath)).toString()}"`;
            });

        panel.reveal();
    }
}