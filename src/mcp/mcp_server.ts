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

import * as fs from 'fs';
import * as net from 'net';
import { randomUUID } from 'node:crypto';
import { Request, Response, RequestHandler } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types';
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import * as FileLock from '../../lib/node-utility/FileLock';
import { File } from '../../lib/node-utility/File';
import { createMcpServer } from './mcp_proxy_tools';
import {
    appendMcpLog,
    attachFrameReader,
    getIpcPort,
    getLockPath,
    getLogPath,
    getMcpTmpDir,
    idleShutdownMs,
    IpcMessage,
    McpProjectInfo,
    sendMessage,
    toolCallTimeoutMs
} from './mcp_protocol';

const useOAuth = false;

interface ExtensionInstance {
    instanceId: string;
    socket: net.Socket;
    projects: McpProjectInfo[];
    registeredAt: number;
}

class InstanceRouter {
    private instances = new Map<string, ExtensionInstance>();
    private sessionToInstance = new Map<string, string>();
    private pendingToolCalls = new Map<string, {
        resolve: (r: CallToolResult) => void;
        reject: (e: Error) => void;
        timer: NodeJS.Timeout;
    }>();

    register(instance: ExtensionInstance): void {
        this.instances.set(instance.instanceId, instance);
    }

    unregister(instanceId: string): void {
        this.instances.delete(instanceId);
        for (const [sessionId, boundId] of this.sessionToInstance) {
            if (boundId === instanceId) {
                this.sessionToInstance.delete(sessionId);
            }
        }
    }

    updateProjects(instanceId: string, projects: McpProjectInfo[]): void {
        const inst = this.instances.get(instanceId);
        if (inst) {
            inst.projects = projects;
        }
    }

    pickEarliestInstanceId(): string | undefined {
        let earliest: ExtensionInstance | undefined;
        for (const inst of this.instances.values()) {
            if (!earliest || inst.registeredAt < earliest.registeredAt) {
                earliest = inst;
            }
        }
        return earliest?.instanceId;
    }

    pickInstanceForNewSession(): string | undefined {
        return this.pickEarliestInstanceId();
    }

    bindSession(sessionId: string, instanceId: string): void {
        this.sessionToInstance.set(sessionId, instanceId);
    }

    unbindSession(sessionId: string): void {
        this.sessionToInstance.delete(sessionId);
    }

    findInstanceByUid(uid: string): string | undefined {
        for (const inst of this.instances.values()) {
            if (inst.projects.some(p => p.uid === uid)) {
                return inst.instanceId;
            }
        }
        return undefined;
    }

    resolveInstance(defaultInstanceId: string, hintUid?: string | null): string | undefined {
        if (hintUid) {
            const owner = this.findInstanceByUid(hintUid);
            if (owner) {
                return owner;
            }
        } else {
            return this.pickEarliestInstanceId();
        }
        return this.instances.has(defaultInstanceId) ? defaultInstanceId : undefined;
    }

    handleToolResult(requestId: string, result: CallToolResult): void {
        const pending = this.pendingToolCalls.get(requestId);
        if (!pending) {
            return;
        }
        clearTimeout(pending.timer);
        this.pendingToolCalls.delete(requestId);
        pending.resolve(result);
    }

    delegateToolCall(
        tool: string,
        args: Record<string, unknown>,
        defaultInstanceId: string
    ): Promise<CallToolResult> {
        const hintUid = args.uid as string | null | undefined;
        const instanceId = this.resolveInstance(defaultInstanceId, hintUid);
        if (!instanceId) {
            return Promise.resolve({
                isError: true,
                content: [{ type: 'text', text: 'No EIDE extension instance available for this request.' }]
            });
        }
        const inst = this.instances.get(instanceId);
        if (!inst || inst.socket.destroyed) {
            return Promise.resolve({
                isError: true,
                content: [{ type: 'text', text: `EIDE extension instance disconnected (id=${instanceId}).` }]
            });
        }

        const requestId = randomUUID();
        return new Promise<CallToolResult>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingToolCalls.delete(requestId);
                reject(new Error(`Tool call timed out: ${tool}`));
            }, toolCallTimeoutMs);

            this.pendingToolCalls.set(requestId, { resolve, reject, timer });
            sendMessage(inst.socket, { type: 'toolCall', requestId, tool, args });
        }).catch(err => ({
            isError: true,
            content: [{ type: 'text', text: String(err) }]
        }));
    }
}

interface ProxyArgs {
    port: number;
    version: string;
    bundleId: string;
}

function parseArgs(argv: string[]): ProxyArgs {
    let port = 8940;
    let version = '';
    let bundleId = '';
    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === '--port' && argv[i + 1]) {
            port = parseInt(argv[++i], 10);
        } else if (argv[i] === '--version' && argv[i + 1]) {
            version = argv[++i];
        } else if (argv[i] === '--bundle-id' && argv[i + 1]) {
            bundleId = argv[++i];
        }
    }
    return { port, version, bundleId };
}

async function main(): Promise<void> {
    const { port: httpPort, version, bundleId } = parseArgs(process.argv);
    const ipcPort = getIpcPort(httpPort);
    const mcpDir = getMcpTmpDir();
    const lockPath = getLockPath(httpPort);
    const logPath = getLogPath(httpPort);

    if (!File.IsDir(mcpDir)) {
        fs.mkdirSync(mcpDir, { recursive: true });
    }

    const lockFd = FileLock.lock(lockPath);
    if (lockFd === undefined) {
        process.exit(1);
    }

    const logInfo = (msg: string) => appendMcpLog(logPath, msg);
    const logError = (msg: string, err?: unknown) => {
        appendMcpLog(logPath, err ? `${msg} ${err}` : msg);
    };

    const instanceRouter = new InstanceRouter();
    const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};
    let activeConnections = 0;
    let idleTimer: NodeJS.Timeout | undefined;
    let httpServer: ReturnType<ReturnType<typeof createMcpExpressApp>['listen']> | undefined;
    let ipcServer: net.Server | undefined;

    const cleanup = async () => {
        logInfo('Shutting down mcp proxy...');
        for (const sessionId in transports) {
            try {
                await transports[sessionId].close();
                delete transports[sessionId];
            } catch (e) {
                logError(`Error closing transport ${sessionId}`, e);
            }
        }
        ipcServer?.close();
        httpServer?.close();
        FileLock.unlock(lockFd);
    };

    try {

    const resetIdleTimer = () => {
        if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = undefined;
        }
        if (activeConnections === 0) {
            idleTimer = setTimeout(() => {
                logInfo('No active extension connections, exiting.');
                void cleanup().then(() => process.exit(0));
            }, idleShutdownMs);
        }
    };

    const onExtensionConnect = (socket: net.Socket) => {
        activeConnections++;
        if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = undefined;
        }

        let instanceId = '';

        attachFrameReader(socket, (msg: IpcMessage) => {
            if (msg.type === 'register') {
                instanceId = msg.instanceId;
                instanceRouter.register({
                    instanceId: msg.instanceId,
                    socket,
                    projects: msg.projects,
                    registeredAt: Date.now()
                });
                logInfo(`Extension registered: ${msg.instanceId} (${msg.projects.length} projects)`);
            } else if (msg.type === 'projects' && instanceId) {
                instanceRouter.updateProjects(instanceId, msg.projects);
                logInfo(`Extension projects changed: ${instanceId} (${msg.projects.length} projects)`);
            } else if (msg.type === 'toolResult') {
                instanceRouter.handleToolResult(msg.requestId, msg.result);
            } else if (msg.type === 'pong') {
                // keepalive
            }
        });

        socket.on('close', () => {
            activeConnections = Math.max(0, activeConnections - 1);
            if (instanceId) {
                instanceRouter.unregister(instanceId);
                logInfo(`Extension disconnected: ${instanceId}`);
            }
            resetIdleTimer();
        });

        socket.on('error', (err) => {
            logError('Extension socket error', err);
        });
    };

    const ipcListener = net.createServer(onExtensionConnect);
    ipcServer = ipcListener;

    await new Promise<void>((resolve, reject) => {
        ipcListener.listen(ipcPort, '127.0.0.1', () => resolve());
        ipcListener.on('error', reject);
    });

    const app = createMcpExpressApp();
    let authMiddleware: RequestHandler | null = null;

    app.get('/health', (_req: Request, res: Response) => {
        res.json({ ok: true, httpPort, ipcPort, pid: process.pid, version, bundleId });
    });

    const mcpPostHandler = async (req: Request, res: Response) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (sessionId) {
            logInfo(`MCP request session: ${sessionId}`);
        } else {
            logInfo('MCP init request');
        }

        try {
            let transport: StreamableHTTPServerTransport;
            if (sessionId && transports[sessionId]) {
                transport = transports[sessionId];
            } else if (!sessionId && isInitializeRequest(req.body)) {
                const boundInstanceId = instanceRouter.pickInstanceForNewSession();
                if (!boundInstanceId) {
                    res.status(503).json({
                        jsonrpc: '2.0',
                        error: {
                            code: -32000,
                            message: 'No EIDE extension instance connected. Open a VS Code window with EIDE enabled.'
                        },
                        id: null
                    });
                    return;
                }

                const eventStore = new InMemoryEventStore();
                transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: () => randomUUID(),
                    eventStore,
                    onsessioninitialized: sid => {
                        logInfo(`Session initialized: ${sid} -> instance ${boundInstanceId}`);
                        transports[sid] = transport;
                        instanceRouter.bindSession(sid, boundInstanceId);
                    }
                });

                transport.onclose = () => {
                    const sid = transport.sessionId;
                    if (sid) {
                        logInfo(`Transport closed: ${sid}`);
                        delete transports[sid];
                        instanceRouter.unbindSession(sid);
                    }
                };

                const server = createMcpServer(async (tool, args) => {
                    const started = performance.now();
                    const result = await instanceRouter.delegateToolCall(tool, args, boundInstanceId);
                    const sec = ((performance.now() - started) / 1000).toFixed(2);
                    logInfo(`call tool "${tool}" -> ${result.isError ? 'fail' : 'ok'}, ${sec}sec`);
                    return result;
                });
                await server.connect(transport);
                await transport.handleRequest(req, res, req.body);
                return;
            } else {
                res.status(400).json({
                    jsonrpc: '2.0',
                    error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
                    id: null
                });
                return;
            }

            await transport.handleRequest(req, res, req.body);
        } catch (error) {
            logError('Error handling MCP request', error);
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: '2.0',
                    error: { code: -32603, message: 'Internal server error' },
                    id: null
                });
            }
        }
    };

    if (useOAuth && authMiddleware) {
        app.post('/mcp', authMiddleware, mcpPostHandler);
    } else {
        app.post('/mcp', mcpPostHandler);
    }

    const mcpGetHandler = async (req: Request, res: Response) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !transports[sessionId]) {
            res.status(400).send('Invalid or missing session ID');
            return;
        }
        await transports[sessionId].handleRequest(req, res);
    };

    if (useOAuth && authMiddleware) {
        app.get('/mcp', authMiddleware, mcpGetHandler);
    } else {
        app.get('/mcp', mcpGetHandler);
    }

    const mcpDeleteHandler = async (req: Request, res: Response) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !transports[sessionId]) {
            res.status(400).send('Invalid or missing session ID');
            return;
        }
        await transports[sessionId].handleRequest(req, res);
    };

    if (useOAuth && authMiddleware) {
        app.delete('/mcp', authMiddleware, mcpDeleteHandler);
    } else {
        app.delete('/mcp', mcpDeleteHandler);
    }

    httpServer = app.listen(httpPort, () => {
        logInfo(`MCP proxy HTTP listening on ${httpPort}, IPC on ${ipcPort}`);
    });

    httpServer.on('error', (err) => {
        logError('HTTP server error', err);
        void cleanup().then(() => process.exit(1));
    });

    resetIdleTimer();

    process.on('SIGINT', () => void cleanup().then(() => process.exit(0)));
    process.on('SIGTERM', () => void cleanup().then(() => process.exit(0)));
    process.on('exit', () => FileLock.unlock(lockFd));
    } catch (err) {
        logError('MCP proxy startup failed', err);
        FileLock.unlock(lockFd);
        process.exit(1);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
