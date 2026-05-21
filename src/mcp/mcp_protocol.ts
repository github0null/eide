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
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { CallToolResult } from '@modelcontextprotocol/sdk/types';

export interface McpProjectInfo {
    uid: string;
    name: string;
}

export interface McpHealthResponse {
    ok: boolean;
    httpPort: number;
    ipcPort: number;
    pid: number;
    version?: string;
    bundleId?: string;
}

export function getMcpBundleId(serverJs: string): string {
    const content = fs.readFileSync(serverJs);
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
}

export function isMcpHealthCompatible(
    health: McpHealthResponse,
    expectedVersion: string,
    expectedBundleId: string
): boolean {
    return health.version === expectedVersion && health.bundleId === expectedBundleId;
}

export type IpcMessage =
    | { type: 'register'; instanceId: string; projects: McpProjectInfo[] }
    | { type: 'projects'; projects: McpProjectInfo[] }
    | { type: 'toolCall'; requestId: string; tool: string; args: Record<string, unknown> }
    | { type: 'toolResult'; requestId: string; result: CallToolResult }
    | { type: 'ping' }
    | { type: 'pong' };

export const idleShutdownMs = 30_000;
export const ipcConnectTimeoutMs = 5_000;
export const ipcPingIntervalMs = 10_000;
export const toolCallTimeoutMs = 300_000;
export const healthCheckTimeoutMs = 3_000;

const mcpTmpSubDir = 'eide-mcp';

export function getMcpTmpDir(): string {
    return path.join(os.tmpdir(), mcpTmpSubDir);
}

export function getIpcPort(httpPort: number): number {
    return httpPort + 1;
}

export function getHealthUrl(httpPort: number): string {
    return `http://127.0.0.1:${httpPort}/health`;
}

export function getLockPath(httpPort: number): string {
    return path.join(getMcpTmpDir(), `mcp_proxy_${httpPort}.lock`);
}

export function getLogPath(httpPort: number): string {
    return path.join(getMcpTmpDir(), `mcp_proxy_${httpPort}.log`);
}

export function encodeMessage(msg: IpcMessage): Buffer {
    const body = Buffer.from(JSON.stringify(msg), 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32BE(body.length, 0);
    return Buffer.concat([header, body]);
}

export function attachFrameReader(socket: net.Socket, onMessage: (msg: IpcMessage) => void): void {
    let buffer = Buffer.alloc(0);

    socket.on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        while (buffer.length >= 4) {
            const bodyLen = buffer.readUInt32BE(0);
            if (buffer.length < 4 + bodyLen) {
                break;
            }
            const body = buffer.subarray(4, 4 + bodyLen);
            buffer = buffer.subarray(4 + bodyLen);
            try {
                onMessage(JSON.parse(body.toString('utf8')) as IpcMessage);
            } catch {
                // ignore malformed frame
            }
        }
    });
}

export function sendMessage(socket: net.Socket, msg: IpcMessage): void {
    if (!socket.destroyed && socket.writable) {
        socket.write(encodeMessage(msg));
    }
}
