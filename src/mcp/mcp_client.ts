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
import * as path from 'path';
import { ExeModule } from '../../lib/node-utility/Executable';
import { ProjectExplorer } from '../EIDEProjectExplorer';
import { GlobalEvent } from '../GlobalEvents';
import { executeTool } from './mcp_core';
import {
    attachFrameReader,
    getHealthUrl,
    healthCheckTimeoutMs,
    IpcMessage,
    ipcConnectTimeoutMs,
    ipcPingIntervalMs,
    McpHealthResponse,
    McpProjectInfo,
    sendMessage
} from './mcp_protocol';

let socket: net.Socket | undefined;
let pingTimer: NodeJS.Timeout | undefined;
let projectExplorer: ProjectExplorer | undefined;
let instanceId: string | undefined;

function logInfo(msg: string): void {
    GlobalEvent.log_info(msg);
}

function logError(msg: string, err?: unknown): void {
    GlobalEvent.log_error(msg);
    if (err instanceof Error) {
        GlobalEvent.log_error(err);
    } else if (err !== undefined) {
        GlobalEvent.log_error(String(err));
    }
}

function collectProjects(explorer: ProjectExplorer): McpProjectInfo[] {
    const projects: McpProjectInfo[] = [];
    explorer.foreachProjects((prj) => {
        projects.push({ uid: prj.getUid(), name: prj.getProjectName() });
        return undefined;
    });
    return projects;
}

async function checkProxyHealth(httpPort: number): Promise<McpHealthResponse | undefined> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), healthCheckTimeoutMs);
    try {
        const res = await fetch(getHealthUrl(httpPort), { signal: controller.signal });
        if (!res.ok) {
            return undefined;
        }
        const body = await res.json() as McpHealthResponse;
        if (!body.ok || body.httpPort !== httpPort) {
            return undefined;
        }
        return body;
    } catch {
        return undefined;
    } finally {
        clearTimeout(timer);
    }
}

function waitForProxyHealth(httpPort: number, timeoutMs: number): Promise<McpHealthResponse | undefined> {
    const deadline = Date.now() + timeoutMs;
    return new Promise(resolve => {
        const tick = async () => {
            const health = await checkProxyHealth(httpPort);
            if (health) {
                resolve(health);
                return;
            }
            if (Date.now() >= deadline) {
                resolve(undefined);
                return;
            }
            setTimeout(tick, 200);
        };
        void tick();
    });
}

function spawnProxy(serverJs: string, httpPort: number): void {
    const exe = new ExeModule();
    exe.Run(serverJs, ['--port', String(httpPort)], {
        detached: true,
        stdio: 'ignore',
        env: process.env
    });
    exe.remove('error', () => { /* noop */ });
}

async function connectIpc(ipcPort: number): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
        const s = net.connect({ host: '127.0.0.1', port: ipcPort });
        const timer = setTimeout(() => {
            s.destroy();
            reject(new Error('IPC connect timeout'));
        }, ipcConnectTimeoutMs);

        s.once('connect', () => {
            clearTimeout(timer);
            resolve(s);
        });
        s.once('error', err => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

function sendRegister(sock: net.Socket, explorer: ProjectExplorer): void {
    sendMessage(sock, {
        type: 'register',
        instanceId: instanceId!,
        projects: collectProjects(explorer)
    });
}

function startPing(sock: net.Socket): void {
    if (pingTimer) {
        clearInterval(pingTimer);
    }
    pingTimer = setInterval(() => {
        sendMessage(sock, { type: 'ping' });
    }, ipcPingIntervalMs);
}

function setupMessageHandler(sock: net.Socket, explorer: ProjectExplorer): void {
    attachFrameReader(sock, async (msg: IpcMessage) => {
        if (msg.type === 'toolCall') {
            try {
                const result = await executeTool(msg.tool, msg.args, explorer);
                sendMessage(sock, { type: 'toolResult', requestId: msg.requestId, result });
            } catch (err) {
                sendMessage(sock, {
                    type: 'toolResult',
                    requestId: msg.requestId,
                    result: {
                        isError: true,
                        content: [{ type: 'text', text: `Tool error: ${err}` }]
                    }
                });
            }
        } else if (msg.type === 'ping') {
            sendMessage(sock, { type: 'pong' });
        }
    });
}

function setupProjectSync(sock: net.Socket, explorer: ProjectExplorer): void {
    const pushProjects = () => {
        if (sock.destroyed) {
            return;
        }
        sendMessage(sock, { type: 'projects', projects: collectProjects(explorer) });
    };
    GlobalEvent.on('project.opened', pushProjects);
    GlobalEvent.on('project.closed', pushProjects);
    GlobalEvent.on('project.activeStatusChanged', pushProjects);
}

export function mcpClientInit(explorer: ProjectExplorer, sessionId: string): void {
    projectExplorer = explorer;
    instanceId = sessionId;
}

export async function mcpClientConnect(httpPort: number, extensionPath: string): Promise<void> {
    if (!projectExplorer || !instanceId) {
        throw new Error('mcp client not inited');
    }

    let health = await checkProxyHealth(httpPort);

    if (!health) {
        const serverJs = path.join(extensionPath, 'dist', 'mcp_server.js');
        if (!fs.existsSync(serverJs)) {
            throw new Error(`MCP proxy not found: ${serverJs}`);
        }
        spawnProxy(serverJs, httpPort);
        health = await waitForProxyHealth(httpPort, ipcConnectTimeoutMs);
        if (!health) {
            throw new Error('MCP proxy failed to start');
        }
    }

    socket = await connectIpc(health.ipcPort);
    setupMessageHandler(socket, projectExplorer);
    sendRegister(socket, projectExplorer);
    setupProjectSync(socket, projectExplorer);
    startPing(socket);

    socket.on('close', () => {
        logInfo('Disconnected from MCP proxy');
    });
    socket.on('error', (err) => {
        logError('MCP proxy connection error', err);
    });

    logInfo(`Connected to MCP proxy (ipc=${health.ipcPort})`);
}

export async function mcpClientDisconnect(): Promise<void> {
    if (pingTimer) {
        clearInterval(pingTimer);
        pingTimer = undefined;
    }
    if (socket) {
        const s = socket;
        socket = undefined;
        return new Promise(resolve => {
            s.once('close', resolve);
            s.destroy();
            setTimeout(resolve, 500);
        });
    }
}
