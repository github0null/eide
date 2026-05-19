#!/usr/bin/env node

import * as http from 'http';
import * as FileLock from '../../lib/node-utility/FileLock';
import { WebSocketServer, WebSocket } from 'ws';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express';
import { Request, Response } from 'express';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types';
import {
    BackendToProxyMessage,
    HttpRequestMessage,
    ProjectInfo,
    parseWsMessage
} from './protocol';
import { normalizePath } from './project_registry';

interface ProxyOptions {
    port: number;
    lockFile: string;
    idleTimeoutMs: number;
}

interface BackendConnection {
    ws: WebSocket;
    instanceId: string;
    projects: ProjectInfo[];
}

interface PendingHttpRequest {
    res: Response;
    chunks: string[];
    ended: boolean;
}

let lockHandle: number | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let activeBackends = 0;
let httpServer: http.Server | undefined;

const backends = new Map<string, BackendConnection>();
const sessionToInstance = new Map<string, string>();
const uidToInstance = new Map<string, string>();
const pathToInstance = new Map<string, string>();
const pendingRequests = new Map<string, PendingHttpRequest>();

function parseArgs(): ProxyOptions {
    const args = process.argv.slice(2);
    let port = 8940;
    let lockFile = '';
    let idleTimeoutMs = 60000;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' && args[i + 1]) {
            port = parseInt(args[i + 1], 10);
            i++;
        } else if (args[i] === '--lock-file' && args[i + 1]) {
            lockFile = args[i + 1];
            i++;
        } else if (args[i] === '--idle-timeout' && args[i + 1]) {
            idleTimeoutMs = parseInt(args[i + 1], 10);
            i++;
        }
    }

    if (!lockFile) {
        console.error('Missing --lock-file');
        process.exit(1);
    }

    return { port, lockFile, idleTimeoutMs };
}

function shutdown(exitCode = 0) {
    if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = undefined;
    }
    if (httpServer) {
        httpServer.close();
        httpServer = undefined;
    }
    for (const [, pending] of pendingRequests) {
        if (!pending.res.headersSent) {
            pending.res.status(502).send('Proxy shutting down');
        }
    }
    pendingRequests.clear();
    backends.clear();
    if (lockHandle !== undefined) {
        FileLock.unlock(lockHandle);
        lockHandle = undefined;
    }
    process.exit(exitCode);
}

function scheduleIdleShutdown(idleTimeoutMs: number) {
    if (idleTimer) {
        clearTimeout(idleTimer);
    }
    if (activeBackends > 0) {
        return;
    }
    idleTimer = setTimeout(() => {
        if (activeBackends === 0) {
            shutdown(0);
        }
    }, idleTimeoutMs);
}

function rebuildRoutingTables() {
    uidToInstance.clear();
    pathToInstance.clear();
    for (const [instanceId, conn] of backends) {
        for (const prj of conn.projects) {
            const existingUid = uidToInstance.get(prj.uid);
            if (existingUid && existingUid !== instanceId) {
                continue;
            }
            uidToInstance.set(prj.uid, instanceId);
            pathToInstance.set(normalizePath(prj.rootPath), instanceId);
            pathToInstance.set(normalizePath(prj.wsPath), instanceId);
        }
    }
}

function findUidInBody(obj: unknown): string | undefined {
    if (!obj || typeof obj !== 'object') {
        return undefined;
    }
    const rec = obj as Record<string, unknown>;
    if (typeof rec.uid === 'string') {
        return rec.uid;
    }
    for (const key of Object.keys(rec)) {
        const found = findUidInBody(rec[key]);
        if (found) {
            return found;
        }
    }
    return undefined;
}

function listAllInstances(): { instanceId: string; projects: ProjectInfo[] }[] {
    const list: { instanceId: string; projects: ProjectInfo[] }[] = [];
    for (const [instanceId, conn] of backends) {
        list.push({ instanceId, projects: conn.projects });
    }
    return list;
}

function resolveInstance(req: Request): { instanceId: string } | { error: number; message: string; instances?: ReturnType<typeof listAllInstances> } {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (sessionId) {
        const inst = sessionToInstance.get(sessionId);
        if (inst && backends.has(inst)) {
            return { instanceId: inst };
        }
    }

    const uidHeader = req.headers['x-eide-project-uid'] as string | undefined;
    if (uidHeader) {
        const inst = uidToInstance.get(uidHeader);
        if (inst) {
            return { instanceId: inst };
        }
    }

    const wsHeader = req.headers['x-eide-workspace-path'] as string | undefined;
    if (wsHeader) {
        const inst = pathToInstance.get(normalizePath(wsHeader));
        if (inst) {
            return { instanceId: inst };
        }
    }

    const bodyUid = findUidInBody(req.body);
    if (bodyUid) {
        const inst = uidToInstance.get(bodyUid);
        if (inst) {
            return { instanceId: inst };
        }
    }

    if (backends.size === 1) {
        return { instanceId: backends.keys().next().value as string };
    }

    if (backends.size === 0) {
        return { error: 503, message: 'No EIDE extension instance connected to MCP proxy' };
    }

    return {
        error: 400,
        message: 'Cannot route request: provide X-EIDE-Project-Uid, X-EIDE-Workspace-Path, or uid in request body',
        instances: listAllInstances()
    };
}

function forwardToBackend(instanceId: string, req: Request, res: Response): void {
    const conn = backends.get(instanceId);
    if (!conn || conn.ws.readyState !== WebSocket.OPEN) {
        res.status(502).json({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Target EIDE instance not available' },
            id: null
        });
        return;
    }

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    pendingRequests.set(requestId, { res, chunks: [], ended: false });

    const headers: Record<string, string | string[] | undefined> = {};
    for (const [key, val] of Object.entries(req.headers)) {
        headers[key] = val;
    }

    const msg: HttpRequestMessage = {
        type: 'httpRequest',
        requestId,
        method: req.method,
        path: req.path,
        headers,
        body: req.body
    };

    conn.ws.send(JSON.stringify(msg));
}

function handleBackendMessage(instanceId: string, raw: string) {
    const msg = parseWsMessage(raw) as BackendToProxyMessage | undefined;
    if (!msg || !msg.type) {
        return;
    }

    if (msg.type === 'register' || msg.type === 'registryUpdate') {
        const conn = backends.get(instanceId);
        if (conn) {
            conn.projects = msg.projects;
            rebuildRoutingTables();
        }
        return;
    }

    if (msg.type === 'httpResponse') {
        const pending = pendingRequests.get(msg.requestId);
        if (!pending) {
            return;
        }
        if (!pending.res.headersSent) {
            const headers = msg.headers || {};
            pending.res.writeHead(msg.statusCode, headers);
        }
        if (msg.body) {
            pending.res.write(msg.body);
        }
        pending.res.end();
        pendingRequests.delete(msg.requestId);

        const sessionHeader = msg.headers['mcp-session-id'] || msg.headers['Mcp-Session-Id'];
        if (sessionHeader) {
            const sessionId = Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader;
            if (sessionId) {
                sessionToInstance.set(sessionId, instanceId);
            }
        }
        return;
    }

    if (msg.type === 'httpChunk') {
        const pending = pendingRequests.get(msg.requestId);
        if (!pending) {
            return;
        }
        if (!pending.res.headersSent) {
            pending.res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        }
        pending.res.write(msg.chunk);
        return;
    }

    if (msg.type === 'httpEnd') {
        const pending = pendingRequests.get(msg.requestId);
        if (!pending) {
            return;
        }
        pending.res.end();
        pendingRequests.delete(msg.requestId);
    }
}

function setupMcpRoutes(app: ReturnType<typeof createMcpExpressApp>, options: ProxyOptions) {
    const mcpHandler = (req: Request, res: Response) => {
        const resolved = resolveInstance(req);
        if ('error' in resolved) {
            res.status(resolved.error).json({
                error: resolved.message,
                instances: resolved.instances
            });
            return;
        }

        forwardToBackend(resolved.instanceId, req, res);
    };

    app.post('/mcp', mcpHandler);
    app.get('/mcp', mcpHandler);
    app.delete('/mcp', mcpHandler);

    app.get('/health', (_req, res) => {
        res.json({
            pid: process.pid,
            port: options.port,
            backendCount: activeBackends
        });
    });
}

async function main() {
    const options = parseArgs();

    lockHandle = FileLock.lock(options.lockFile);
    if (lockHandle === undefined) {
        process.exit(0);
    }

    process.on('SIGINT', () => shutdown(0));
    process.on('SIGTERM', () => shutdown(0));
    process.on('uncaughtException', (err) => {
        console.error('Uncaught exception:', err);
        shutdown(1);
    });

    const app = createMcpExpressApp();
    setupMcpRoutes(app, options);

    httpServer = app.listen(options.port, () => {
        console.error(`EIDE MCP proxy listening on port ${options.port}`);
    });

    const wss = new WebSocketServer({ server: httpServer, path: '/eide/backend' });

    wss.on('connection', (ws, req) => {
        const url = new URL(req.url || '', `http://127.0.0.1:${options.port}`);
        const instanceId = url.searchParams.get('instanceId') || `inst-${Date.now()}`;

        activeBackends++;
        if (idleTimer) {
            clearTimeout(idleTimer);
            idleTimer = undefined;
        }

        backends.set(instanceId, { ws, instanceId, projects: [] });

        ws.on('message', (data) => {
            handleBackendMessage(instanceId, data.toString());
        });

        ws.on('close', () => {
            backends.delete(instanceId);
            for (const [sid, inst] of sessionToInstance) {
                if (inst === instanceId) {
                    sessionToInstance.delete(sid);
                }
            }
            rebuildRoutingTables();
            activeBackends--;
            scheduleIdleShutdown(options.idleTimeoutMs);
        });
    });

    scheduleIdleShutdown(options.idleTimeoutMs);
}

main().catch((err) => {
    console.error(err);
    shutdown(1);
});
