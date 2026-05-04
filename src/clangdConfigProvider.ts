import * as vscode from 'vscode';
import * as yaml from 'yaml';
import type { ClangdExtension, ASTParams, ASTNode } from '@clangd/vscode-clangd/vscode-clangd';
import {
    BaseLanguageClient,
    DynamicFeature, FeatureClient, TextDocumentSendFeature, InitializeParams,
    StaticFeature, TextDocumentProviderFeature, WorkspaceProviderFeature, 
    ClientCapabilities, ServerCapabilities, RegistrationType, RegistrationData,
    DocumentSelector, FeatureState
} from 'vscode-languageclient';
import { AbstractProject } from './EIDEProject';
import { SettingManager } from './SettingManager';
import { GlobalEvent } from './GlobalEvents';
import { File } from '../lib/node-utility/File';
import { isGccFamilyToolchain, getGccSystemSearchList } from './utility';
import { ArrayDelRepetition } from '../lib/node-utility/Utility';

const CLANGD_EXTENSION = 'llvm-vs-code-extensions.vscode-clangd';
const CLANGD_API_VERSION = 1;

// const ASTRequestMethod = 'textDocument/ast';

// const provideHover = async (document: vscode.TextDocument, position: vscode.Position, _token: vscode.CancellationToken): Promise<vscode.Hover | undefined> => {

//     const clangdExtension = vscode.extensions.getExtension<ClangdExtension>(CLANGD_EXTENSION);

//     if (clangdExtension) {
//         const api = (await clangdExtension.activate()).getApi(CLANGD_API_VERSION);

//         // Extension may be disabled or have failed to initialize
//         if (!api.languageClient) {
//           return undefined;
//         }
 
//         const textDocument = api.languageClient.code2ProtocolConverter.asTextDocumentIdentifier(document);
//         const range = api.languageClient.code2ProtocolConverter.asRange(new vscode.Range(position, position));
//         const params: ASTParams = { textDocument, range };
 
//         const ast: ASTNode | undefined = await api.languageClient.sendRequest(ASTRequestMethod, params);

//         if (!ast) {
//             return undefined;
//         }

//         return {
//             contents: [ast.kind]
//         };
//     }
// };

// interface _Options {
// }

// class _ConfigProvider implements DynamicFeature<_Options> {

//     registrationType: RegistrationType<_Options> = new RegistrationType<_Options>("workspace/didChangeConfiguration");
//     prj: AbstractProject;
//     client: BaseLanguageClient;

//     constructor(prj: AbstractProject, client: BaseLanguageClient) {
//         this.prj = prj;
//         this.client = client;
//     }

//     fillInitializeParams(params: InitializeParams) {
//         params.initializationOptions = {
//             compilationDatabasePath: File.from(this.prj.getOutputFolder().path, 'compile_commands.json').path,
//         };
//     }

//     preInitialize(capabilities: ServerCapabilities<any>, documentSelector: DocumentSelector | undefined) {
//     }

//     fillClientCapabilities(capabilities: ClientCapabilities): void {
//         capabilities.workspace = {
//             didChangeConfiguration: {
//                 dynamicRegistration: true
//             }
//         };
//     }

//     initialize(capabilities: ServerCapabilities<any>, documentSelector: DocumentSelector | undefined): void {
        
//     }

//     getState(): FeatureState {
//         return {
//             kind: "workspace",
//             id: "workspace/didChangeConfiguration",
//             registrations: true
//         };
//     }

//     register(data: RegistrationData<_Options>): void {
//         this.prj.on('cppConfigChanged', () => {

//         });
//     }

//     unregister(id: string): void {
//     }

//     dispose(): void {
//     }
// }

export async function onRegisterClangdProvider(prj: AbstractProject) {

    // const clangdExtension = vscode.extensions.getExtension<ClangdExtension>(CLANGD_EXTENSION);

    // if (clangdExtension) {
    //     const api = (await clangdExtension.activate()).getApi(CLANGD_API_VERSION);
    //     // Extension may be disabled or have failed to initialize
    //     if (!api.languageClient) {
    //         return undefined;
    //     }
    //     api.languageClient.registerFeature(new _ConfigProvider(prj, api.languageClient));
    // }

    prj.on('cppConfigChanged', () => {

        if (!SettingManager.instance().isEnableClangdConfigGenerator()) {
            GlobalEvent.log_info(`ignore update .clangd, because "EIDE.Option.EnableClangdConfigGenerator" is not set`);
            return;
        }

        // ----------------------
        // setup clangd config
        // ----------------------
        try {
            let cfg: any = {};
            const fclangd = File.fromArray([prj.getProjectRoot().path, '.clangd']);
            if (fclangd.IsFile()) {
                cfg = yaml.parse(fclangd.Read());
            }
            if (!cfg['CompileFlags']) cfg['CompileFlags'] = {};
            if (!cfg['CompileFlags']['Add']) cfg['CompileFlags']['Add'] = []
            if (!cfg['CompileFlags']['Remove']) cfg['CompileFlags']['Remove'] = [];
            //
            cfg['CompileFlags']['CompilationDatabase'] = './' + File.ToUnixPath(prj.getOutputDir());
            const toolchain = prj.getToolchain();
            const gccLikePath = toolchain.getGccFamilyCompilerPathForCpptools('c');
            const sysIncPrefix = '-isystem'; // 用 -isystem 引入系统头文件
            if (gccLikePath) { // clangd 仅兼容gcc的编译器
                cfg['CompileFlags']['Compiler'] = gccLikePath;
                let clangdCompileFlags = <string[]>(cfg['CompileFlags']['Add']);
                let compilerArgs = prj.getCpptoolsConfig().cppCompilerArgs;
                // 用 -isystem 引入系统头文件，避免 clangd 对系统头进行诊断；
                // 兼容历史遗留的 -I 入口，便于切换工具链时清理旧路径。
                const stripIncludePrefix = (s: string): string | undefined => {
                    if (s.startsWith(sysIncPrefix)) return s.substring(sysIncPrefix.length);
                    if (s.startsWith('-I')) return s.substring(2);
                    return undefined;
                };
                if (isGccFamilyToolchain(toolchain.name)) {
                    const tRoot = toolchain.getToolchainDir().path;
                    // 移除旧的系统头路径
                    clangdCompileFlags = clangdCompileFlags.filter(p => {
                        const incPath = stripIncludePrefix(p);
                        // 保留非 include 路径相关的 flag
                        if (incPath === undefined) return true;
                        // 移除工具链目录下的 include 路径（系统头路径）
                        return !File.isSubPathOf(tRoot, incPath);
                    });
                    let li = getGccSystemSearchList(File.ToLocalPath(gccLikePath), ['-xc++'].concat(compilerArgs || []));
                    if (li) {
                        // 重新添加系统头路径。使用 -isystem 前缀，避免 clangd 对系统头进行诊断
                        li.forEach(p => { clangdCompileFlags.push(sysIncPrefix + File.normalize(p)); });
                    }
                } else if (toolchain.name == 'LLVM_ARM') {
                    // nothing todo. This is llvm.
                } else {
                    clangdCompileFlags.push(`${sysIncPrefix}${toolchain.getToolchainDir().path}/include`);
                    clangdCompileFlags.push(`${sysIncPrefix}${toolchain.getToolchainDir().path}/include/libcxx`);
                }
                // // add flags
                // if (compilerArgs)
                //     compilerArgs.forEach(arg => clangdCompileFlags.push(arg));
                // // add user includes
                // prj.getCpptoolsConfig().includePath
                //     .forEach(path => clangdCompileFlags.push(`-I${path}`));
                // // add user defines
                // prj.getCpptoolsConfig().defines
                //     .forEach(d => clangdCompileFlags.push(`-D${d}`));
                // del repeat
                cfg['CompileFlags']['Add'] = ArrayDelRepetition(clangdCompileFlags);
            }
            // 其他不受 clangd 支持的编译器要自行设置 -I -D
            else if (toolchain.name == 'AC5' || toolchain.name == 'SDCC' || toolchain.name == 'GNU_SDCC_MCS51') {
                const builderOpts = prj.getBuilderOptions();
                const prjConfig = prj.GetConfiguration();
                const compilerFlags: string[] = cfg['CompileFlags']['Add'] || [];
                toolchain.getSystemIncludeList(builderOpts)
                    .forEach(p => compilerFlags.push(`${sysIncPrefix}"${p}"`));
                toolchain.getInternalDefines(<any>prjConfig.config.toolchainConfig, builderOpts)
                    .forEach(d => compilerFlags.push(`-D"${d.name}=${d.value}"`));
                cfg['CompileFlags']['Add'] = ArrayDelRepetition(compilerFlags);
                // 禁用所有诊断错误，因为 clangd 不支持这些编译器
                cfg['Diagnostics'] = { 'Suppress': '*' }
            }
            fclangd.Write(yaml.stringify(cfg));
        } catch (error) {
            GlobalEvent.log_error(error);
        }
    });
}
