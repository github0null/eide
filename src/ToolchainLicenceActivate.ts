import { ToolchainName, IToolchian, ToolchainManager } from "./ToolchainManager";
import { GlobalEvent } from "./GlobalEvents";
import { newMessage } from "./Message";
import { view_str$prompt$requestAndActivateLicence_warn_setupPath, getLocalLanguageType, LanguageIndexs } from "./StringTable";
import { SimpleUIConfig, SimpleUIConfigData_tag, SimpleUIConfigData_divider, SimpleUIConfigData_input, SimpleUIConfigData_button } from './SimpleUIDef';
import { WebPanelManager } from "./WebPanelManager";
import { runShellCommand, openUrl } from "./utility";
import { File } from "../lib/node-utility/File";

import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import * as vscode from "vscode";

export function requestAndActivateLicence(toolchainId: ToolchainName) {

    const toolchain_ = ToolchainManager.getInstance().getToolchainByName(toolchainId);
    if (!toolchain_) {
        GlobalEvent.emit('msg', newMessage('Error', `Not found this toolchain: '${toolchainId}' !`));
        return;
    }

    if (!ToolchainManager.getInstance().isToolchainPathReady(toolchainId)) {
        GlobalEvent.emit('msg', newMessage('Warning', view_str$prompt$requestAndActivateLicence_warn_setupPath));
        return;
    }

    switch (toolchainId) {
        case 'COSMIC_STM8':
            requestAndActivate_COSMIC_STM8(toolchain_);
            break;
        default:
            GlobalEvent.emit('msg', newMessage('Warning', `We not support this toolchain: '${toolchainId}' !`));
            break;
    }
}

function requestAndActivate_COSMIC_STM8(toolchain: IToolchian) {

    const toolchainRootDir = toolchain.getToolchainDir();
    const isChinese = getLocalLanguageType() == LanguageIndexs.Chinese;

    const ui_1: SimpleUIConfig = isChinese

        // chinese
        ? {
            title: '申请 COSMIC STM8 编译器许可证',
            viewColumn: vscode.ViewColumn.One,
            notTakeFocus: false,
            btns: {
                'submit': {
                    title: '发送申请',
                    hidden: false
                },
                'reset': {
                    title: '',
                    hidden: true
                }
            },
            items: {
                'userName': {
                    type: 'input',
                    name: '输入用户名（系统的当前账户名）',
                    attrs: { 'singleLine': true },
                    data: <SimpleUIConfigData_input>{
                        value: process.env.USERNAME || 'administrator'
                    }
                },
                'hostId': {
                    type: 'input',
                    name: '输入主机ID',
                    attrs: { 'singleLine': true },
                    data: <SimpleUIConfigData_input>{
                        value: ''
                    }
                },
                'hostId-1': {
                    type: 'button',
                    name: '查看当前的主机ID',
                    attrs: {},
                    data: <SimpleUIConfigData_button>{
                        clickEvent: 'btn.show-host-id'
                    }
                },
                'email': {
                    type: 'input',
                    name: '输入你的邮箱（用于接收许可证）',
                    attrs: { 'singleLine': true },
                    data: <SimpleUIConfigData_input>{
                        placeHolder: 'xxx@xxx.xx',
                        value: ''
                    }
                }
            }
        }
        // en-us
        : {

            title: 'Request Licence For COSMIC STM8 Compiler',
            viewColumn: vscode.ViewColumn.One,
            notTakeFocus: false,
            btns: {
                'submit': {
                    title: 'Send Request',
                    hidden: false
                },
                'reset': {
                    title: '',
                    hidden: true
                }
            },
            items: {
                'userName': {
                    type: 'input',
                    name: 'User Name For This PC',
                    attrs: { 'singleLine': true },
                    data: <SimpleUIConfigData_input>{
                        value: process.env.USERNAME || 'administrator'
                    }
                },
                'hostId': {
                    type: 'input',
                    name: 'Enter Your Host ID',
                    attrs: { 'singleLine': true },
                    data: <SimpleUIConfigData_input>{
                        value: ''
                    }
                },
                'hostId-1': {
                    type: 'button',
                    name: 'Show My Host ID',
                    attrs: {},
                    data: <SimpleUIConfigData_button>{
                        clickEvent: 'btn.show-host-id'
                    }
                },
                'email': {
                    type: 'input',
                    name: 'Enter Your Email (to receive licence file)',
                    attrs: { 'singleLine': true },
                    data: <SimpleUIConfigData_input>{
                        placeHolder: 'xxx@xxx.xx',
                        value: ''
                    }
                }
            }
        };

    WebPanelManager.instance().showSimpleConfigUI(ui_1,

        // on submited
        async (data) => {

            // https://license.cosmic.fr/registerAuto.php?name={1}&hostid={2}&mail={3}&product=LXSTM8FSE_2023
            // 其中：
            //  - {1} 填 用户名
            //  - {2} 填 主机ID
            //  - {3} 填 邮箱

            const usrNam = data.items['userName'].data.value.trim();
            const hostId = data.items['hostId'].data.value.replace(/"/g, '').trim();
            const email_ = data.items['email'].data.value.trim();

            const url = `https://license.cosmic.fr/registerAuto.php?name=${usrNam}&hostid=${hostId}&mail=${email_}&product=LXSTM8FSE_2023`;

            openUrl(url);
        },

        // on msg
        (msg) => {

            if (msg == 'btn.show-host-id') {

                runShellCommand('(COSMIC) show host id',
                    'LmregFSE', undefined, true, toolchainRootDir.path);
            }
        });

    setTimeout(() => {

        const ui_2: SimpleUIConfig = isChinese

            // chinese
            ? {
                title: '激活 COSMIC STM8 编译器许可证',
                viewColumn: vscode.ViewColumn.Two,
                notTakeFocus: true,
                btns: {
                    'submit': {
                        title: '激活',
                        hidden: false
                    },
                    'reset': {
                        title: '',
                        hidden: true
                    }
                },
                items: {
                    'licence': {
                        type: 'input',
                        name: `输入你收到的许可证（邮件附件 'licence.lic' 的完整内容）`,
                        attrs: { 'singleLine': false, 'rows': 15 },
                        data: <SimpleUIConfigData_input>{
                            placeHolder: [
                                `#`,
                                `# Please don't change or add any lines in this file`,
                                `# Generated automatically by Cosmic website on 2023-04-09 07:34:46`,
                                `#`,
                                `FEATURE LXSTM8FSE_202X cosmic 31.1 09-apr-2024 uncounted \\`,
                                `    HOSTID="xxxxxxxx xxxxxxxx" SIGN=xxxxxxxx`,
                                `FEATURE LXSTM8FSE_2020 cosmic 31.1 09-apr-2024 uncounted \\`,
                                `    HOSTID="xxxxxxxx xxxxxxxx" SIGN=xxxxxxxx`,
                                `FEATURE LXSTM8FSE_2019 cosmic 31.1 09-apr-2024 uncounted \\`,
                                `    HOSTID="xxxxxxxx xxxxxxxx" SIGN=xxxxxxxx`,
                                `FEATURE LXSTM8FSE_2018 cosmic 31.1 09-apr-2024 uncounted \\`,
                                `    HOSTID="xxxxxxxx xxxxxxxx" SIGN=xxxxxxxx`,
                                `FEATURE LXSTM8FSE_2017 cosmic 31.1 09-apr-2024 uncounted \\`,
                                `    HOSTID="xxxxxxxx xxxxxxxx" SIGN=xxxxxxxx`,
                            ].join(os.EOL),
                            value: ''
                        }
                    }
                }
            }
            // en-us
            : {
                title: 'Activate Licence For COSMIC STM8 Compiler',
                viewColumn: vscode.ViewColumn.Two,
                notTakeFocus: true,
                btns: {
                    'submit': {
                        title: 'Activate',
                        hidden: false
                    },
                    'reset': {
                        title: '',
                        hidden: true
                    }
                },
                items: {
                    'licence': {
                        type: 'input',
                        name: `Enter Your Licence (Content of 'licence.lic' file in your email)`,
                        attrs: { 'singleLine': false, 'rows': 15 },
                        data: <SimpleUIConfigData_input>{
                            placeHolder: [
                                `#`,
                                `# Please don't change or add any lines in this file`,
                                `# Generated automatically by Cosmic website on 2023-04-09 07:34:46`,
                                `#`,
                                `FEATURE LXSTM8FSE_202X cosmic 31.1 09-apr-2024 uncounted \\`,
                                `    HOSTID="xxxxxxxx xxxxxxxx" SIGN=xxxxxxxx`,
                                `FEATURE LXSTM8FSE_2020 cosmic 31.1 09-apr-2024 uncounted \\`,
                                `    HOSTID="xxxxxxxx xxxxxxxx" SIGN=xxxxxxxx`,
                                `FEATURE LXSTM8FSE_2019 cosmic 31.1 09-apr-2024 uncounted \\`,
                                `    HOSTID="xxxxxxxx xxxxxxxx" SIGN=xxxxxxxx`,
                                `FEATURE LXSTM8FSE_2018 cosmic 31.1 09-apr-2024 uncounted \\`,
                                `    HOSTID="xxxxxxxx xxxxxxxx" SIGN=xxxxxxxx`,
                                `FEATURE LXSTM8FSE_2017 cosmic 31.1 09-apr-2024 uncounted \\`,
                                `    HOSTID="xxxxxxxx xxxxxxxx" SIGN=xxxxxxxx`,
                            ].join(os.EOL),
                            value: ''
                        }
                    }
                }
            };

        WebPanelManager.instance().showSimpleConfigUI(ui_2,

            // on submited
            async (data) => {

                const licenceCont: string = data.items['licence'].data.value;

                if (!licenceCont.trim()) {
                    throw new Error('licence can not be empty !');
                }

                let outDir: File;

                const dirs = toolchainRootDir.GetList(File.EXCLUDE_ALL_FILTER, [/License/i]);
                if (dirs.length == 0) {
                    outDir = File.fromArray([toolchainRootDir.path, 'License']);
                    outDir.CreateDir(false);
                } else {
                    outDir = dirs[0];
                }

                fs.writeFileSync(outDir.path + File.sep + 'license.lic', licenceCont);
            });
    }, 600);
}
