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

import * as z from 'zod/v4';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { InMemoryTaskStore, InMemoryTaskMessageQueue } from '@modelcontextprotocol/sdk/experimental/tasks/stores/in-memory';
import { ProjectExplorer } from '../EIDEProjectExplorer';
import { AbstractProject } from '../EIDEProject';
import { BuilderOptions } from '../EIDETypeDefine';
import { FlashCommandResult } from '../HexUploader';
import { loadBuilderOptionsSchema, validateBuilderOptions } from './mcp_builder_opts_validate';

const taskStore = new InMemoryTaskStore();

export type ToolDelegate = (tool: string, args: Record<string, unknown>) => Promise<CallToolResult>;

function resolveProject(
    explorer: ProjectExplorer,
    uid: string | null | undefined
): AbstractProject | undefined {
    if (uid) {
        return explorer.getProjectByUid(uid);
    }
    return undefined;
}

function projectNotFound(uid: string | null | undefined): CallToolResult {
    return {
        isError: true,
        content: [
            {
                type: 'text',
                text: uid ? `Error. Not such project (uid=${uid}).` : `Error. No any active project.`
            }
        ]
    };
}

function makeTextResult(success: boolean, message: string, err?: Error): CallToolResult {
    return {
        isError: !success,
        content: [{
            type: 'text',
            text: message + (err ? '\n\nError: ' + err.message : '')
        }]
    };
}

function makeJsonResult(data: unknown, isError = false): CallToolResult {
    return {
        isError,
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
    };
}

export async function executeTool(
    tool: string,
    args: Record<string, unknown>,
    explorer: ProjectExplorer
): Promise<CallToolResult> {
    const uid = args.uid as string | null | undefined;

    switch (tool) {
        case 'eide_build':
        case 'eide_rebuild':
        case 'eide_clean': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            let res: { success: boolean; message: string; };
            if (tool === 'eide_build') {
                res = await explorer.buildProject(prj, { notRebuild: true, otherArgs: ['--no-color'] }, true);
            } else if (tool === 'eide_rebuild') {
                res = await explorer.buildProject(prj, { otherArgs: ['--no-color'] }, true);
            } else {
                res = await explorer.cleanProject(prj, true);
            }
            return makeTextResult(res.success, res.message);
        }
        case 'eide_flash': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const eraseAll = Boolean(args.eraseAll);
            let res: FlashCommandResult | void;
            if (eraseAll) {
                res = await explorer.programFlashProject(prj, true, true);
                if (!res || !res.success)
                    return makeTextResult(false, res ? res.message : 'Failed to erase chip.');
            }
            res = await explorer.programFlashProject(prj, false, true);
            if (res) {
                return makeTextResult(res.success, res.message, res.error);
            } else {
                return makeTextResult(false, 'Unknown Error.');
            }
        }
        case 'eide_reload': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const ok = await explorer.reloadProject(prj.getUid(), false);
            const result = makeTextResult(ok, ok ? 'Succeed.' : 'Failed.');
            await new Promise(r => setTimeout(r, ok ? 3000 : 500)); // delay after reload project.
            return result;
        }
        case 'eide_switch_target': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const targetName = args.targetName as string;
            const targets = prj.getTargets();
            if (!targets.includes(targetName))
                return makeTextResult(false, `Project '${prj.getProjectName()}' (uid=${uid}) not have this target: '${targetName}'`);
            await prj.switchTarget(targetName);
            await new Promise(r => setTimeout(r, 1500));
            return makeTextResult(true, 'Succeed.');
        }
        case 'eide_add_src_dir': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const srcDir = args.path as string;
            const absSrcDir = prj.ToAbsolutePath(srcDir);
            const res = prj.getNormalSourceManager().verify(absSrcDir);
            if (!res.valid) {
                return makeTextResult(false, res.message);
            }
            prj.GetConfiguration().AddSrcDir(absSrcDir);
            return makeTextResult(true, 'Succeed.');
        }
        case 'eide_del_src_dir': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const absSrcDir = prj.ToAbsolutePath(args.path as string);
            const srcDirs = prj.GetConfiguration().config.srcDirs;
            if (!srcDirs.includes(absSrcDir)) {
                return makeTextResult(false, `Source directory not in project: ${args.path}`);
            }
            prj.GetConfiguration().RemoveSrcDir(absSrcDir);
            return makeTextResult(true, 'Succeed.');
        }
        case 'eide_exclude_src_file': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const filePath = args.path as string;
            prj.excludeSourceFile(prj.ToAbsolutePath(filePath));
            return makeTextResult(true, 'Succeed.');
        }
        case 'eide_include_src_file': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const filePath = args.path as string;
            prj.unexcludeSourceFile(prj.ToAbsolutePath(filePath));
            return makeTextResult(true, 'Succeed.');
        }
        case 'eide_get_inc_dirs': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const depMerge = prj.GetConfiguration().GetAllMergeDep();
            const incList = depMerge.incList.map(p => {
                const rel = prj.toRelativePath(p);
                return rel !== undefined ? rel : p;
            });
            return makeJsonResult(incList);
        }
        case 'eide_set_inc_dirs': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const paths = args.paths as string[];
            if (!Array.isArray(paths)) {
                return makeTextResult(false, 'paths must be an array of strings.');
            }
            const dep = prj.GetConfiguration().CustomDep_getDependence();
            dep.incList = paths.map(p => prj.ToAbsolutePath(p));
            prj.GetConfiguration().CustomDep_NotifyChanged();
            return makeTextResult(true, 'Succeed.');
        }
        case 'eide_get_defines': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const depMerge = prj.GetConfiguration().GetAllMergeDep();
            return makeJsonResult(depMerge.defineList);
        }
        case 'eide_set_defines': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const defines = args.defines as string[];
            if (!Array.isArray(defines)) {
                return makeTextResult(false, 'defines must be an array of strings.');
            }
            const dep = prj.GetConfiguration().CustomDep_getDependence();
            dep.defineList = defines.map(d => d.trim()).filter(d => d.length > 0);
            prj.GetConfiguration().CustomDep_NotifyChanged();
            return makeTextResult(true, 'Succeed.');
        }
        case 'eide_get_builder_opts': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const builderOpts = prj.GetConfiguration().toolchainConfigModel.getOptions();
            return makeJsonResult(builderOpts);
        }
        case 'eide_get_builder_opts_schema': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            try {
                return makeJsonResult(loadBuilderOptionsSchema(prj));
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                return makeTextResult(false, 'Failed to load builder options schema.', error);
            }
        }
        case 'eide_get_targets': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            return makeJsonResult({
                actived: prj.getCurrentTarget(),
                targets: prj.getTargets()
            });
        }
        case 'eide_set_builder_opts': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const options = args.options;
            if (!options || typeof options !== 'object' || Array.isArray(options)) {
                return makeTextResult(false, 'options must be a BuilderOptions JSON object.');
            }
            const validateErr = validateBuilderOptions(prj, options);
            if (validateErr) {
                return makeTextResult(false, `Builder options validation failed:\n${validateErr}`);
            }
            try {
                prj.GetConfiguration().toolchainConfigModel.setOptions(options as BuilderOptions);
                prj.onBuilderConfigChanged();
                return makeTextResult(true, 'Succeed.');
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                return makeTextResult(false, 'Failed to set builder options.', error);
            }
        }
        default:
            return makeTextResult(false, `Unknown tool: ${tool}`);
    }
}

export function createMcpServer(delegateToolCall: ToolDelegate): McpServer {
    const server = new McpServer(
        {
            name: 'eide mcp server',
            version: '1.1.0',
            icons: [{ src: './mcp.svg', sizes: ['512x512'], mimeType: 'image/svg+xml' }],
            websiteUrl: 'https://github.com/modelcontextprotocol/typescript-sdk'
        },
        {
            capabilities: { logging: {}, tasks: { requests: { tools: { call: {} } } } },
            taskStore,
            taskMessageQueue: new InMemoryTaskMessageQueue()
        }
    );

    const uidSchema = z.string().describe('Project UID (cannot be empty). You can get it from "<Your workspace>/.eide/eide.yml", property name is "miscInfo.uid"');

    server.registerTool(
        'eide_build',
        {
            title: 'Build Project',
            description: 'Build your eide project.',
            inputSchema: { uid: uidSchema }
        },
        async (args) => delegateToolCall('eide_build', args)
    );

    server.registerTool(
        'eide_rebuild',
        {
            title: 'Rebuild Project',
            description: 'Rebuild your eide project.',
            inputSchema: { uid: uidSchema }
        },
        async (args) => delegateToolCall('eide_rebuild', args)
    );

    server.registerTool(
        'eide_clean',
        {
            title: 'Clean Project',
            description: `Clean up the generated products in the "build" directory.`,
            inputSchema: { uid: uidSchema }
        },
        async (args) => delegateToolCall('eide_clean', args)
    );

    server.registerTool(
        'eide_flash',
        {
            title: 'Program Flash',
            description: 'Perform flash memory programming on your MCU',
            inputSchema: {
                uid: uidSchema,
                eraseAll: z.boolean().describe('Determine whether to perform a chip erase of the mcu.')
            }
        },
        async (args) => delegateToolCall('eide_flash', args)
    );

    server.registerTool(
        'eide_reload',
        {
            title: 'Reload Project',
            description: `Reload the project. After you manually modify the project file, you should call this method to reload the project.`,
            inputSchema: { uid: uidSchema }
        },
        async (args) => delegateToolCall('eide_reload', args)
    );

    server.registerTool(
        'eide_get_targets',
        {
            title: 'Get build targets',
            description: 'Get active target name and all known target names for the project.',
            inputSchema: { uid: uidSchema }
        },
        async (args) => delegateToolCall('eide_get_targets', args)
    );

    server.registerTool(
        'eide_switch_target',
        {
            title: 'Switch Target',
            description: `Select active build target for eide project.`,
            inputSchema: {
                uid: uidSchema,
                targetName: z.string().describe('Target Name.')
            }
        },
        async (args) => delegateToolCall('eide_switch_target', args)
    );

    server.registerTool(
        'eide_add_src_dir',
        {
            title: 'Add a source dir',
            description: `Select a source directory from filesystem and add to project. Then eide will collect c/c++ source file from this directory.`,
            inputSchema: {
                uid: uidSchema,
                path: z.string().describe('A filesystem path for this directory.')
            }
        },
        async (args) => delegateToolCall('eide_add_src_dir', args)
    );

    server.registerTool(
        'eide_del_src_dir',
        {
            title: 'Delete a source dir',
            description: 'Remove a source directory from the project (not delete files on disk).',
            inputSchema: {
                uid: uidSchema,
                path: z.string().describe('Source directory path to remove.')
            }
        },
        async (args) => delegateToolCall('eide_del_src_dir', args)
    );

    server.registerTool(
        'eide_exclude_src_file',
        {
            title: 'Exclude source file',
            description: 'Exclude a source file from build (add to exclude list).',
            inputSchema: {
                uid: uidSchema,
                path: z.string().describe('Source file path to exclude.')
            }
        },
        async (args) => delegateToolCall('eide_exclude_src_file', args)
    );

    server.registerTool(
        'eide_include_src_file',
        {
            title: 'Include source file',
            description: 'Remove a source file from exclude list so it will be built again.',
            inputSchema: {
                uid: uidSchema,
                path: z.string().describe('Source file path to include.')
            }
        },
        async (args) => delegateToolCall('eide_include_src_file', args)
    );

    server.registerTool(
        'eide_get_inc_dirs',
        {
            title: 'Get include directories',
            description: 'Get all include directory list used for build (JSON array).',
            inputSchema: { uid: uidSchema }
        },
        async (args) => delegateToolCall('eide_get_inc_dirs', args)
    );

    server.registerTool(
        'eide_set_inc_dirs',
        {
            title: 'Set include directories',
            description: 'Set include directories.',
            inputSchema: {
                uid: uidSchema,
                paths: z.array(z.string()).describe('Include directory paths.')
            }
        },
        async (args) => delegateToolCall('eide_set_inc_dirs', args)
    );

    server.registerTool(
        'eide_get_defines',
        {
            title: 'Get preprocessor defines',
            description: 'Get all preprocessor macro defines used for build (JSON array).',
            inputSchema: { uid: uidSchema }
        },
        async (args) => delegateToolCall('eide_get_defines', args)
    );

    server.registerTool(
        'eide_set_defines',
        {
            title: 'Set preprocessor defines',
            description: 'Set user preprocessor defines.',
            inputSchema: {
                uid: uidSchema,
                defines: z.array(z.string()).describe('Preprocessor macro defines, e.g. ["DEBUG=1", "USE_HAL"]')
            }
        },
        async (args) => delegateToolCall('eide_set_defines', args)
    );

    server.registerTool(
        'eide_get_builder_opts',
        {
            title: 'Get builder options',
            description: 'Get builder options (JSON object).',
            inputSchema: { uid: uidSchema }
        },
        async (args) => delegateToolCall('eide_get_builder_opts', args)
    );

    server.registerTool(
        'eide_get_builder_opts_schema',
        {
            title: 'Get builder options schema',
            description: 'Get JSON schema for builder options of the project toolchain.',
            inputSchema: { uid: uidSchema }
        },
        async (args) => delegateToolCall('eide_get_builder_opts_schema', args)
    );

    server.registerTool(
        'eide_set_builder_opts',
        {
            title: 'Set builder options',
            description: 'Set builder options. You can use tool: "eide_get_builder_opts_schema" to get the schema of builder options.',
            inputSchema: {
                uid: uidSchema,
                options: z.record(z.string(), z.unknown()).describe(
                    'Builder options object. Use eide_get_builder_opts to read the current structure.'
                )
            }
        },
        async (args) => delegateToolCall('eide_set_builder_opts', args)
    );

    return server;
}
