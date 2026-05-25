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

const taskStore = new InMemoryTaskStore();

export type ToolDelegate = (tool: string, args: Record<string, unknown>) => Promise<CallToolResult>;

export function createMcpServer(delegateToolCall: ToolDelegate): McpServer {

    const server = new McpServer(
        {
            name: 'eide mcp server',
            version: '1.2.0',
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
        'eide_get_src_dirs',
        {
            title: 'Get all source directories',
            description: 'Get all source directory list of the project (JSON array).',
            inputSchema: { uid: uidSchema }
        },
        async (args) => delegateToolCall('eide_get_src_dirs', args)
    );

    server.registerTool(
        'eide_add_src_dir',
        {
            title: 'Add a source directory',
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
            title: 'Delete a source directory',
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
        'eide_get_builder_opts_schema',
        {
            title: 'Get builder options schema',
            description: 'Get JSON schema for builder options of the project toolchain.',
            inputSchema: { uid: uidSchema }
        },
        async (args) => delegateToolCall('eide_get_builder_opts_schema', args)
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
