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

import * as vscode from 'vscode';
import { ProjectExplorer } from './EIDEProjectExplorer';
import { GlobalEvent } from './GlobalEvents';
import { mcpClientConnect, mcpClientDisconnect, mcpClientInit } from './mcp/mcp_client';

let started = false;

export function mcpServerInit(_mcpPort: number, prjExplorer: ProjectExplorer): void {
    mcpClientInit(prjExplorer, vscode.env.sessionId);
    GlobalEvent.log_info('Init mcp client.');
}

export async function mcpServerStart(mcpPort: number, extensionPath: string, extensionVersion: string): Promise<void> {
    if (started) {
        return;
    }
    GlobalEvent.log_info('Connect to mcp proxy.');
    await mcpClientConnect(mcpPort, extensionPath, extensionVersion);
    started = true;
}

export async function mcpServerStop(): Promise<void> {
    if (!started) {
        return;
    }
    GlobalEvent.log_info('Disconnect from mcp proxy.');
    await mcpClientDisconnect();
    started = false;
}
