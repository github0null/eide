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
import { File } from '../../lib/node-utility/File';
import { FlashCommandResult } from '../HexUploader';

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

function makeCallToolResult(success: boolean, message: string, err?: Error): CallToolResult {
    return {
        isError: !success,
        content: [{
            type: 'text',
            text: message + (err ? '\n\nError: ' + err.message : '')
        }]
    };
}

export async function executeTool(
    tool: string,
    args: Record<string, unknown>,
    explorer: ProjectExplorer
): Promise<CallToolResult> {
    const uid = args.uid as string | null | undefined;

    switch (tool) {
        case 'build':
        case 'rebuild':
        case 'clean': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            let res: { success: boolean; message: string; };
            if (tool === 'build') {
                res = await explorer.buildProject(prj, { notRebuild: true, otherArgs: ['--no-color'] }, true);
            } else if (tool === 'rebuild') {
                res = await explorer.buildProject(prj, { otherArgs: ['--no-color'] }, true);
            } else {
                res = await explorer.cleanProject(prj, true);
            }
            return makeCallToolResult(res.success, res.message);
        }
        case 'flash': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const eraseAll = Boolean(args.eraseAll);
            let res: FlashCommandResult | void;
            if (eraseAll) {
                res = await explorer.programFlashProject(prj, true, true);
                if (!res || !res.success)
                    return makeCallToolResult(false, res ? res.message : 'Failed to erase chip.');
            }
            res = await explorer.programFlashProject(prj, false, true);
            if (res) {
                return makeCallToolResult(res.success, res.message, res.error);
            } else {
                return makeCallToolResult(false, 'Unknown Error.');
            }
        }
        case 'reload': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const ok = await explorer.reloadProject(prj.getUid(), false);
            const result = makeCallToolResult(ok, ok ? 'Succeed.' : 'Failed.');
            await new Promise(r => setTimeout(r, ok ? 3000 : 500)); // delay after reload project.
            return result;
        }
        case 'switch_target': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const targetName = args.targetName as string;
            const targets = prj.getTargets();
            if (!targets.includes(targetName))
                return makeCallToolResult(false, `Project '${prj.getProjectName()}' (uid=${uid}) not have this target: '${targetName}'`);
            await prj.switchTarget(targetName);
            await new Promise(r => setTimeout(r, 1500));
            return makeCallToolResult(true, 'Succeed.');
        }
        case 'add_src_dir': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const srcDir = args.path as string;
            const absSrcDir = prj.ToAbsolutePath(srcDir);
            const res = prj.getNormalSourceManager().verify(absSrcDir);
            if (res.valid) {
                const ok = prj.getNormalSourceManager().add(absSrcDir);
                return makeCallToolResult(ok, ok ? 'Succeed' : 'Unknown error');
            } else {
                return makeCallToolResult(false, res.message);
            }
        }
        default:
            return makeCallToolResult(false, `Unknown tool: ${tool}`);
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
        'build',
        {
            title: 'Build Project',
            description: 'Build your eide project.',
            inputSchema: { uid: uidSchema }
        },
        async (args) => delegateToolCall('build', args)
    );

    server.registerTool(
        'rebuild',
        {
            title: 'Rebuild Project',
            description: 'Rebuild your eide project.',
            inputSchema: { uid: uidSchema }
        },
        async (args) => delegateToolCall('rebuild', args)
    );

    server.registerTool(
        'clean',
        {
            title: 'Clean Project',
            description: `Clean up the generated products in the "build" directory.`,
            inputSchema: { uid: uidSchema }
        },
        async (args) => delegateToolCall('clean', args)
    );

    server.registerTool(
        'flash',
        {
            title: 'Program Flash',
            description: 'Perform flash memory programming on your MCU',
            inputSchema: {
                uid: uidSchema,
                eraseAll: z.boolean().describe('Determine whether to perform a chip erase of the mcu.')
            }
        },
        async (args) => delegateToolCall('flash', args)
    );

    server.registerTool(
        'reload',
        {
            title: 'Reload Project',
            description: `Reload the project. After you manually modify the project file, you should call this method to reload the project.`,
            inputSchema: { uid: uidSchema }
        },
        async (args) => delegateToolCall('reload', args)
    );

    server.registerTool(
        'switch_target',
        {
            title: 'Switch Target',
            description: `Select active build target for eide project.`,
            inputSchema: {
                uid: uidSchema,
                targetName: z.string().describe('Target Name.')
            }
        },
        async (args) => delegateToolCall('switch_target', args)
    );

    server.registerTool(
        'add_src_dir',
        {
            title: 'Add a source dir',
            description: `Select a source directory from filesystem and add to project. Then eide will collect c/c++ source file from this directory.`,
            inputSchema: {
                uid: uidSchema,
                path: z.string().describe('A filesystem path for this directory.')
            }
        },
        async (args) => delegateToolCall('add_src_dir', args)
    );

    return server;
}
