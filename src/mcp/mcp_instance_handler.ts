import { randomUUID } from 'node:crypto';
import * as z from 'zod/v4';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types';
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore';
import { InMemoryTaskStore, InMemoryTaskMessageQueue } from '@modelcontextprotocol/sdk/experimental/tasks/stores/in-memory';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { GlobalEvent } from '../GlobalEvents';
import { ProjectExplorer } from '../EIDEProjectExplorer';
import { AbstractProject } from '../EIDEProject';
import { HttpRequestMessage } from './protocol';

const useOAuth = false;
const taskStore = new InMemoryTaskStore();

let projectExplorer: ProjectExplorer;

const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

function logInfo(msg: string) {
    GlobalEvent.log_info(msg);
}

function logError(msg: string, err?: Error) {
    GlobalEvent.log_error(msg);
    if (err) {
        GlobalEvent.log_error(err);
    }
}

function getServer() {
    const server = new McpServer(
        {
            name: 'eide mcp server',
            version: '1.0.0',
            icons: [{ src: './mcp.svg', sizes: ['512x512'], mimeType: 'image/svg+xml' }],
            websiteUrl: 'https://github.com/modelcontextprotocol/typescript-sdk'
        },
        {
            capabilities: { logging: {}, tasks: { requests: { tools: { call: {} } } } },
            taskStore,
            taskMessageQueue: new InMemoryTaskMessageQueue()
        }
    );

    const resolveProject = (uid: string | null | undefined): AbstractProject | undefined => {
        if (uid) {
            return projectExplorer.getProjectByUid(uid);
        }
        return projectExplorer.getActiveProject();
    };

    const projectError = (uid: string | null | undefined): CallToolResult => ({
        isError: true,
        content: [{ type: 'text', text: uid ? `Error. Not such project (uid=${uid}).` : `Error. No any active project.` }]
    });

    server.registerTool('build', {
        title: 'Build Project',
        description: 'Build your eide project.',
        inputSchema: { uid: z.string().nullable().describe('Project UID. If not provide, use the current actived project.') }
    }, async ({ uid }) => {
        const prj = resolveProject(uid);
        if (!prj) return projectError(uid);
        const res = await projectExplorer.buildProject(prj, { notRebuild: true, otherArgs: ['--no-color'] }, true);
        return { isError: !res.success, content: [{ type: 'text', text: res.message }] };
    });

    server.registerTool('rebuild', {
        title: 'Rebuild Project',
        description: 'Rebuild your eide project.',
        inputSchema: { uid: z.string().nullable().describe('Project UID. If not provide, use the current actived project.') }
    }, async ({ uid }) => {
        const prj = resolveProject(uid);
        if (!prj) return projectError(uid);
        const res = await projectExplorer.buildProject(prj, { otherArgs: ['--no-color'] }, true);
        return { isError: !res.success, content: [{ type: 'text', text: res.message }] };
    });

    server.registerTool('clean', {
        title: 'Clean Project',
        description: `Clean up the generated products in the "build" directory.`,
        inputSchema: { uid: z.string().nullable().describe('Project UID. If not provide, use the current actived project.') }
    }, async ({ uid }) => {
        const prj = resolveProject(uid);
        if (!prj) return projectError(uid);
        const res = await projectExplorer.cleanProject(prj, true);
        return { isError: !res.success, content: [{ type: 'text', text: res.message }] };
    });

    server.registerTool('flash', {
        title: 'Program Flash',
        description: 'Perform flash memory programming on your MCU',
        inputSchema: {
            uid: z.string().nullable().describe('Project UID. If not provide, use the current actived project.'),
            eraseAll: z.boolean().describe('Determine whether to perform a chip erase of the mcu.')
        }
    }, async ({ uid, eraseAll }) => {
        const prj = resolveProject(uid);
        if (!prj) return projectError(uid);
        if (eraseAll) {
            await projectExplorer.programFlashProject(prj, true, true);
        }
        const res = await projectExplorer.programFlashProject(prj, false, true);
        if (res) {
            return {
                isError: !res.success,
                content: [{ type: 'text', text: res.message + (res.error ? '\n\nError: ' + res.error?.message : '') }]
            };
        }
        return { isError: true, content: [{ type: 'text', text: 'Unknown Error.' }] };
    });

    server.registerTool('reload', {
        title: 'Reload Project',
        description: `Reload the project. After you manually modify the project file, you should call this method to reload the project.`,
        inputSchema: { uid: z.string().nullable().describe('Project UID. If not provide, use the current actived project.') }
    }, async ({ uid }) => {
        const prj = resolveProject(uid);
        if (!prj) return projectError(uid);
        const ok = await projectExplorer.reloadProject(prj.getUid(), false);
        const result: CallToolResult = {
            isError: !ok,
            content: [{ type: 'text', text: ok ? 'Succeed.' : 'Failed.' }]
        };
        return new Promise((resolve) => {
            setTimeout(() => resolve(result), ok ? 3000 : 500);
        });
    });

    server.registerTool('switchTarget', {
        title: 'Switch Target',
        description: `Select active build target for eide project.`,
        inputSchema: {
            uid: z.string().nullable().describe('Project UID. If not provide, use the current actived project.'),
            targetName: z.string().describe('Target Name.')
        }
    }, async ({ uid, targetName }) => {
        const prj = resolveProject(uid);
        if (!prj) return projectError(uid);
        const targets = prj.getTargets();
        if (!targets.includes(targetName)) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Project '${prj.getProjectName()}' (uid=${uid}) not have this target: '${targetName}'` }]
            };
        }
        await prj.switchTarget(targetName);
        return new Promise((resolve) => {
            setTimeout(() => resolve({
                isError: false,
                content: [{ type: 'text', text: 'Succeed.' }]
            }), 1500);
        });
    });

    return server;
}

export type HttpResponseCallback = (msg: {
    statusCode: number;
    headers: Record<string, string | string[] | undefined>;
    body?: string;
    chunk?: string;
    end?: boolean;
}) => void;

export function mcpInstanceInit(prjExplorer: ProjectExplorer) {
    projectExplorer = prjExplorer;
    logInfo('Init mcp instance handler.');
}

export async function mcpInstanceHandleRequest(
    msg: HttpRequestMessage,
    onResponse: HttpResponseCallback
): Promise<void> {
    const headers = msg.headers || {};
    const sessionId = headers['mcp-session-id'] as string | undefined;

    const mockReq = {
        method: msg.method,
        path: msg.path,
        headers,
        body: msg.body
    } as import('express').Request;

    let statusCode = 200;
    const outHeaders: Record<string, string | string[]> = {};
    let bodyParts: string[] = [];
    let isStreaming = false;
    let ended = false;

    const mockRes = {
        statusCode: 200,
        headersSent: false,
        getHeader(name: string) {
            return outHeaders[name.toLowerCase()];
        },
        setHeader(name: string, value: string | string[]) {
            outHeaders[name.toLowerCase()] = value;
        },
        writeHead(code: number, hdrs?: Record<string, string | string[]>) {
            statusCode = code;
            this.headersSent = true;
            if (hdrs) {
                for (const [k, v] of Object.entries(hdrs)) {
                    outHeaders[k.toLowerCase()] = v;
                }
            }
        },
        write(chunk: string | Buffer) {
            const s = typeof chunk === 'string' ? chunk : chunk.toString();
            if (msg.method === 'GET') {
                isStreaming = true;
                onResponse({ statusCode, headers: outHeaders, chunk: s });
            } else {
                bodyParts.push(s);
            }
        },
        end(data?: string | Buffer) {
            if (ended) return;
            ended = true;
            if (data) {
                const s = typeof data === 'string' ? data : data.toString();
                if (isStreaming) {
                    onResponse({ statusCode, headers: outHeaders, chunk: s, end: true });
                } else {
                    bodyParts.push(s);
                }
            }
            if (isStreaming) {
                onResponse({ statusCode, headers: outHeaders, end: true });
            } else {
                onResponse({
                    statusCode,
                    headers: outHeaders,
                    body: bodyParts.join('')
                });
            }
        },
        status(code: number) {
            statusCode = code;
            return this;
        },
        json(obj: unknown) {
            this.setHeader('content-type', 'application/json');
            this.end(JSON.stringify(obj));
        },
        send(data: string) {
            this.end(data);
        }
    } as unknown as import('express').Response;

    try {
        let transport: StreamableHTTPServerTransport;
        if (sessionId && transports[sessionId]) {
            transport = transports[sessionId];
        } else if (!sessionId && msg.method === 'POST' && isInitializeRequest(msg.body)) {
            const eventStore = new InMemoryEventStore();
            transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                eventStore,
                onsessioninitialized: (sid) => {
                    logInfo(`Session initialized with ID: ${sid}`);
                    transports[sid] = transport;
                }
            });
            transport.onclose = () => {
                const sid = transport.sessionId;
                if (sid && transports[sid]) {
                    delete transports[sid];
                }
            };
            const server = getServer();
            await server.connect(transport);
            await transport.handleRequest(mockReq, mockRes, msg.body);
            return;
        } else if (!sessionId || !transports[sessionId]) {
            mockRes.status(400).json({
                jsonrpc: '2.0',
                error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
                id: null
            });
            return;
        } else {
            transport = transports[sessionId];
        }

        await transport.handleRequest(mockReq, mockRes, msg.body);
    } catch (error) {
        logError('Error handling MCP request:', error as Error);
        if (!mockRes.headersSent) {
            onResponse({
                statusCode: 500,
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    error: { code: -32603, message: 'Internal server error' },
                    id: null
                })
            });
        }
    }
}

export async function mcpInstanceStop() {
    for (const sessionId in transports) {
        try {
            await transports[sessionId].close();
            delete transports[sessionId];
        } catch (error) {
            logError(`Error closing transport for session ${sessionId}:`, error as Error);
        }
    }
}
