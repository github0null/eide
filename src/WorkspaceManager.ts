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

import * as events from 'events';
import { File } from '../lib/node-utility/File';
import * as vscode from 'vscode';
import * as PathInfo from 'path';

let _wsManager: WorkspaceManager;

export class WorkspaceManager {

    private _event: events.EventEmitter;

    private constructor() {
        this._event = new events.EventEmitter();
        this.RegisterEvent();
    }

    private RegisterEvent() {
        /* vscode.workspace.onDidChangeWorkspaceFolders((e) => {
            this._event.emit('onWorkspaceChanged', e);
        }); */
    }

    //on(event: 'onWorkspaceChanged', listener: (e: vscode.WorkspaceFoldersChangeEvent) => void): void;
    on(event: any, listener: (argc?: any) => void): void {
        this._event.on(event, listener);
    }

    hasWorkspaces(): boolean {
        return vscode.workspace.workspaceFolders !== undefined && vscode.workspace.workspaceFolders.length > 0;
    }

    getWorkspaceRoot(): File | undefined {
        if (vscode.workspace.workspaceFile) {
            return new File(PathInfo.dirname(vscode.workspace.workspaceFile.fsPath));
        }
    }

    getWorkspaceFile(): File | undefined {
        return vscode.workspace.workspaceFile ? new File(vscode.workspace.workspaceFile.fsPath) : undefined;
    }

    getCurrentFolder(): File | undefined {

        let folder = this.getWorkspaceRoot();

        if (folder == undefined) {
            const li = this.getWorkspaceList();
            if (li.length > 0) {
                folder = li[0];
            }
        }

        return folder;
    }

    getWorkspaceList(): File[] {
        const resList: File[] = [];
        if (vscode.workspace.workspaceFolders) {
            for (const folder of vscode.workspace.workspaceFolders) {
                resList.push(new File(folder.uri.fsPath));
            }
        }
        return resList;
    }

    /**
     * @param workspaceFile '.code-workspace' file obj
    */
    openWorkspace(workspaceFile: File) {
        vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(workspaceFile.path));
    }

    static getInstance(): WorkspaceManager {
        if (!_wsManager) {
            _wsManager = new WorkspaceManager();
        }
        return _wsManager;
    }
}