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
import { AbstractProject, SymbolInfo } from "./EIDEProject";
import { ArmBaseCompileConfigModel } from "./EIDEProjectModules";
import { GlobalEvent } from "./GlobalEvents";
import { view_str$compile$options, view_str$compile$storageLayout, 
    view_str$env_desc$builer_folder, view_str$env_desc$compiler_folder, 
    view_str$env_desc$compiler_prefix, view_str$env_desc$output_dir, 
    view_str$env_desc$project_name, view_str$env_desc$project_root, 
    view_str$env_desc$toolchain_root, view_str$operation$done, 
    view_str$project$cmsis_config_wizard, view_str$env_desc$py3_cmd, 
    view_str$env_desc$cc_base_args, view_str$env_desc$cxx_base_args, 
    view_str$env_desc$asm_base_args, view_str$env_desc$compiler_ver,
    view_str$env_desc$compiler_full_name, view_str$callgraph_data_file_missed,
    view_str$callgraph_data_file_fmt_err
} from "./StringTable";
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

    private builderOptionViewRef: Map<string, vscode.WebviewPanel> = new Map();
    private memoryLayoutViewRef: Map<string, vscode.WebviewPanel> = new Map();
    private cmsisHeaderViewRef: Map<string, vscode.WebviewPanel> = new Map();
    private simpleConfigViewRef: Map<string, vscode.WebviewPanel> = new Map();

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

        const oldpanel = cfg.ref_id ? this.simpleConfigViewRef.get(cfg.ref_id) : undefined;
        if (oldpanel) {
            oldpanel.reveal();
            return oldpanel;
        }

        const resManager = ResManager.GetInstance();

        let ViewCol = cfg.viewColumn;

        if (ViewCol == undefined || ViewCol == null) {
            ViewCol = vscode.ViewColumn.One;
        }

        const panel = vscode.window.createWebviewPanel('eide.simple-cfg-ui',
            cfg.title, 
            { viewColumn: ViewCol, preserveFocus: cfg.notTakeFocus }, 
            { enableScripts: true, retainContextWhenHidden: true });

        if (cfg.ref_id) {
            const uid = cfg.ref_id;
            this.simpleConfigViewRef.set(uid, panel);
            panel.onDidDispose(() => {
                console.log(`[eide] onDidDispose simpleConfigView for ${uid}`);
                this.simpleConfigViewRef.delete(uid);
            });
        }

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

        const oldpanel = this.memoryLayoutViewRef.get(project.getUid());
        if (oldpanel) {
            oldpanel.reveal();
            return;
        }

        const resManager = ResManager.GetInstance();
        const panel = vscode.window.createWebviewPanel('MemoryLayoutView',
            view_str$compile$storageLayout, vscode.ViewColumn.One,
            { enableScripts: true, retainContextWhenHidden: true });

        this.memoryLayoutViewRef.set(project.getUid(), panel);

        // set web icon
        panel.iconPath = vscode.Uri.parse(resManager.GetIconByName('Memory_16x.svg').ToUri());

        panel.onDidDispose(() => {
            console.log(`[eide] onDidDispose memoryLayoutView for ${project.getRootDir().path}`);
            this.memoryLayoutViewRef.delete(project.getUid());
        });

        const compileModel = <ArmBaseCompileConfigModel>project.GetConfiguration().toolchainConfigModel;
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

        const oldpanel = this.builderOptionViewRef.get(project.getUid());
        if (oldpanel) {
            oldpanel.reveal();
            return;
        }

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

        this.builderOptionViewRef.set(project.getUid(), panel);

        // init panel data
        panel.iconPath = vscode.Uri.parse(resManager.GetIconByName('Property_16x.svg').ToUri());

        const envList: any[] = [
            // unify_builder specific variables
            { name: '${CompilerPrefix}', desc: view_str$env_desc$compiler_prefix },
            { name: '${CompilerFullName}', desc: view_str$env_desc$compiler_full_name },
            { name: '${CompilerVersion}', desc: view_str$env_desc$compiler_ver }
        ];
        const prjEnv = project.getProjectVariables();
        for (const key in prjEnv) {
            envList.push({
                name: `\$\{${key}\}`,
                desc: `${prjEnv[key]}`
            })
        }
        // other EIDE_xx variables
        [
            { name: '${EIDE_CUR_COMPILER_CC_BASE_ARGS}', desc: view_str$env_desc$cc_base_args },
            { name: '${EIDE_CUR_COMPILER_CXX_BASE_ARGS}', desc: view_str$env_desc$cxx_base_args },
            { name: '${EIDE_CUR_COMPILER_AS_BASE_ARGS}', desc: view_str$env_desc$asm_base_args }
        ].forEach(item => envList.push(item))

        const toolchain = project.getToolchain();

        /* prepare page-init event data */
        const initMsg = <any>{
            model: JSON.parse(File.from(resManager.getAppRootFolder().path, 'lang', toolchain.verifyFileName).Read()),
            data: projectConfig.toolchainConfigModel.getOptions(),
            info: {
                lang: vscode.env.language,
                envList: envList,
                contextData: {}
            }
        };

        if (toolchain.getGccCompilerTargetInfo) {
            const inf = toolchain.getGccCompilerTargetInfo();
            if (inf) {
                initMsg.info.contextData['gcc.compiler.archs'] = inf.archs;
                initMsg.info.contextData['gcc.compiler.abis'] = inf.abis;
                initMsg.info.contextData['gcc.compiler.riscv.code-models'] = inf.rv_codeModels;
            }
        }

        panel.onDidDispose(() => {
            console.log(`[eide] onDidDispose builderOptionView for ${project.getRootDir().path}`);
            this.builderOptionViewRef.delete(project.getUid());
        });

        panel.webview.onDidReceiveMessage(async (data) => {

            // it's a event from web view
            if (typeof data === 'string') {
                switch (data) {
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
                    projectConfig.toolchainConfigModel.setOptions(data);
                    status.success = true;
                    status.msg = view_str$operation$done;
                    project.onBuilderConfigChanged();
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

        const oldpanel = this.cmsisHeaderViewRef.get(uri.fsPath);
        if (oldpanel) {
            oldpanel.reveal();
            return;
        }

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
            GlobalEvent.log_error(error);
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

        this.cmsisHeaderViewRef.set(uri.fsPath, panel);

        // init panel data
        panel.iconPath = vscode.Uri.parse(resManager.GetIconByName('Property_16x.svg').ToUri());

        /* prepare page-init event data */
        const initMsg = {
            data: cmsisConfig,
            lines: lines,
        };

        panel.onDidDispose(() => {
            console.log(`[eide] onDidDispose CmsisConfigWizard for ${uri.fsPath}`);
            this.cmsisHeaderViewRef.delete(uri.fsPath);
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

    async showSymbolTable(project: AbstractProject) {

        const panelOptions: vscode.WebviewPanelOptions & vscode.WebviewOptions = {
            enableScripts: true,
            retainContextWhenHidden: true
        };

        const webviewPanel = vscode.window.createWebviewPanel(
            'symbol_table',
            `Symbol Table (${NodePath.basename(project.getExecutablePath())})`,
            vscode.ViewColumn.Active,
            panelOptions
        );

        const symbols = await vscode.window.withProgress<SymbolInfo[]>({
            location: vscode.ProgressLocation.Notification,
            title: `Parse Symbol Table`
        }, (progress) => project.parseElfSymbolTable());

        const resManager = ResManager.GetInstance();
        const htmlTemplate = File.from(resManager.GetHTMLDir().path, 'symbol_table', 'index.html');

        const showTextDocumentAtLine = (filepath: string, lineNumber?: number) => {
            let range: vscode.Range | undefined;
            if (lineNumber !== undefined) {
                range = new vscode.Range(
                    new vscode.Position(lineNumber - 1, 0),
                    new vscode.Position(lineNumber - 1, 0));
            }
            vscode.window.showTextDocument(vscode.Uri.file(filepath), {
                preview: true,
                selection: range
            });
        };

        webviewPanel.iconPath = vscode.Uri.file(ResManager.GetInstance().GetIconByName('Table_16x.svg').path);
        webviewPanel.webview.html = htmlTemplate.Read().replace('$SYMBOL_TABLE', JSON.stringify(symbols));
        webviewPanel.webview.onDidReceiveMessage(async (_message: any) => {
            const msg: {id: string, data: any} = <any>_message;
            if (msg.id === 'symbol.gotoDefinition') {
                const inf = <{abspath: string, line?: number}>msg.data;
                showTextDocumentAtLine(inf.abspath, inf.line);
            }
        });

        webviewPanel.reveal();
    }

    async showCallgraphView(project: AbstractProject) {

        const dataJsonFile = File.from(project.getOutputFolder().path, 'statistic.json');
        if (!dataJsonFile.IsFile()) {
            vscode.window.showErrorMessage(view_str$callgraph_data_file_missed);
            return;
        }
        let dataJson: any = {};
        try {
            dataJson = JSON.parse(dataJsonFile.Read());
        } catch (error) {
            vscode.window.showErrorMessage(
                view_str$callgraph_data_file_fmt_err.replace('{}', dataJsonFile.path));
            return;
        }

        const panelOptions: vscode.WebviewPanelOptions & vscode.WebviewOptions = {
            enableScripts: true,
            retainContextWhenHidden: true
        };

        const webviewPanel = vscode.window.createWebviewPanel(
            'callgraph_view',
            `Callgraph View (${NodePath.basename(project.getExecutablePath())})`,
            vscode.ViewColumn.Active,
            panelOptions
        );

        const resManager = ResManager.GetInstance();
        const htmlFolder = File.from(resManager.getHTMLDir().path, 'callgraph_view');
        const htmlTemplate = File.from(htmlFolder.path, 'index.html');

        const gotoDefinition = (filepath: string, line: number, column?: number) => {
            let range: vscode.Range | undefined;
            if (line !== undefined) {
                range = new vscode.Range(
                    new vscode.Position(line - 1, column ? column : 0),
                    new vscode.Position(line - 1, column ? column : 0));
            }
            vscode.window.showTextDocument(vscode.Uri.file(filepath), {
                preview: true,
                selection: range
            });
        };

        webviewPanel.iconPath = vscode.Uri.file(ResManager.GetInstance().GetIconByName('ShowCallGraph_16x.svg').path);
        webviewPanel.webview.html = htmlTemplate.Read()
            .replace(/"[\w\-\.\/]+?\.(?:css|js)"/ig, (str) => {
                const fileName = str.substring(1, str.length - 1); // remove '"'
                const absPath = File.normalize(htmlFolder.path + NodePath.sep + fileName);
                return `"${webviewPanel.webview.asWebviewUri(vscode.Uri.file(absPath)).toString()}"`;
            });
        webviewPanel.webview.onDidReceiveMessage(async (_message: any) => {
            const msg: {id: string, data: any} = <any>_message;
            if (msg.id === 'callgraph.gotoDefinition') {
                const inf = <{file: string; line?: number; column?: number;}>msg.data;
                const fspath = project.toAbsolutePath(inf.file);
                if (File.IsFile(fspath))
                    gotoDefinition(fspath, inf.line ?? 0, inf.column ?? 0);
            }
            else if (msg.id === 'eide.callgraph_view.launched') {
                webviewPanel.webview.postMessage({ id: 'eide.callgraph_view.init', data: dataJson });
            }
        });

        webviewPanel.reveal();
    }
}