import * as path from 'path';
import * as http from 'http';
import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import WebSocket from 'ws';
import { ExeModule } from '../../lib/node-utility/Executable';
import { GlobalEvent } from '../GlobalEvents';
import { ProjectExplorer } from '../EIDEProjectExplorer';
import { collectProjectRegistry } from './project_registry';
import {
    HttpRequestMessage,
    RegisterMessage,
    RegistryUpdateMessage,
    parseWsMessage,
    ProxyToBackendMessage
} from './protocol';
import { mcpInstanceInit, mcpInstanceHandleRequest, mcpInstanceStop } from './mcp_instance_handler';

let wsClient: WebSocket | undefined;
let instanceId: string;
let proxyPort = 8940;
let registrySyncTimer: ReturnType<typeof setInterval> | undefined;
let projectExplorerRef: ProjectExplorer | undefined;

function healthCheck(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(2000, () => {
            req.destroy();
            resolve(false);
        });
    });
}

async function waitForHealth(port: number, maxWaitMs = 15000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        if (await healthCheck(port)) {
            return true;
        }
        await new Promise((r) => setTimeout(r, 200));
    }
    return false;
}

async function ensureProxyRunning(port: number, lockPath: string, scriptPath: string, idleTimeoutMs: number): Promise<void> {
    if (await healthCheck(port)) {
        return;
    }

    const proc = new ExeModule();
    proc.Run(scriptPath, [
        '--port', String(port),
        '--lock-file', lockPath,
        '--idle-timeout', String(idleTimeoutMs)
    ], { detached: true, stdio: 'ignore', windowsHide: true } as import('child_process').ForkOptions);

    proc.on('error', (err) => GlobalEvent.log_error(err));

    const ok = await waitForHealth(port);
    if (!ok) {
        GlobalEvent.log_error(`MCP proxy failed to start on port ${port}`);
    }
}

function sendRegistryUpdate() {
    if (!wsClient || wsClient.readyState !== WebSocket.OPEN || !projectExplorerRef) {
        return;
    }
    const msg: RegistryUpdateMessage = {
        type: 'registryUpdate',
        instanceId,
        projects: collectProjectRegistry(projectExplorerRef)
    };
    wsClient.send(JSON.stringify(msg));
}

function connectWebSocket(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const url = `ws://127.0.0.1:${port}/eide/backend?instanceId=${encodeURIComponent(instanceId)}`;
        wsClient = new WebSocket(url);

        wsClient.on('open', () => {
            isProxyConnected = true;
            const msg: RegisterMessage = {
                type: 'register',
                instanceId,
                projects: projectExplorerRef ? collectProjectRegistry(projectExplorerRef) : []
            };
            wsClient!.send(JSON.stringify(msg));
            GlobalEvent.log_info(`MCP proxy backend connected (instanceId=${instanceId})`);
            resolve();
        });

        wsClient.on('message', async (data) => {
            const raw = data.toString();
            const msg = parseWsMessage(raw) as ProxyToBackendMessage | undefined;
            if (!msg || msg.type !== 'httpRequest') {
                return;
            }

            await mcpInstanceHandleRequest(msg, (response) => {
                if (!wsClient || wsClient.readyState !== WebSocket.OPEN) {
                    return;
                }
                if (response.end) {
                    wsClient.send(JSON.stringify({
                        type: 'httpEnd',
                        requestId: msg.requestId
                    }));
                    return;
                }
                if (response.chunk !== undefined) {
                    wsClient.send(JSON.stringify({
                        type: 'httpChunk',
                        requestId: msg.requestId,
                        chunk: response.chunk
                    }));
                    return;
                }
                wsClient.send(JSON.stringify({
                    type: 'httpResponse',
                    requestId: msg.requestId,
                    statusCode: response.statusCode,
                    headers: response.headers,
                    body: response.body
                }));
            });
        });

        wsClient.on('error', (err) => {
            GlobalEvent.log_error(err);
            reject(err);
        });

        wsClient.on('close', () => {
            GlobalEvent.log_info('MCP proxy backend disconnected');
        });
    });
}

export async function mcpProxyConnect(
    port: number,
    prjExplorer: ProjectExplorer,
    context: vscode.ExtensionContext,
    idleTimeoutMs = 60000
): Promise<void> {
    proxyPort = port;
    instanceId = randomUUID();
    projectExplorerRef = prjExplorer;

    mcpInstanceInit(prjExplorer);

    const lockPath = path.join(context.globalStorageUri.fsPath, 'eide-mcp-proxy.lock');
    const scriptPath = path.join(context.extensionPath, 'dist', 'mcp_server.js');

    try {
        await ensureProxyRunning(port, lockPath, scriptPath, idleTimeoutMs);
        await connectWebSocket(port);

        registrySyncTimer = setInterval(() => sendRegistryUpdate(), 30000);

        GlobalEvent.on('project.opened', () => sendRegistryUpdate());
        GlobalEvent.on('project.closed', () => sendRegistryUpdate());
    } catch (error) {
        GlobalEvent.log_error(error);
    }
}

export function mcpProxySendRegistryUpdate() {
    sendRegistryUpdate();
}

export async function mcpProxyDisconnect(): Promise<void> {
    if (registrySyncTimer) {
        clearInterval(registrySyncTimer);
        registrySyncTimer = undefined;
    }
    if (wsClient) {
        wsClient.close();
        wsClient = undefined;
    }
    await mcpInstanceStop();
    projectExplorerRef = undefined;
}
