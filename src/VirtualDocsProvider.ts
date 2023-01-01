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
import { File } from '../lib/node-utility/File';

let _instance: VirtualDocument | undefined;

export type VirtualDocumentContentGetter = (uri: vscode.Uri, ...args: any[]) => Promise<string>;

export class VirtualDocument implements vscode.TextDocumentContentProvider {

    public static scheme = 'eide';

    private onDidChangeEmitter: vscode.EventEmitter<vscode.Uri>;

    private docsMap: Map<string, string | VirtualDocumentContentGetter>;
    private docsGetterArgs: Map<string, any[]>;

    onDidChange: vscode.Event<vscode.Uri>;

    private constructor() {
        this.docsMap = new Map();
        this.docsGetterArgs = new Map();
        this.onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
        this.onDidChange = this.onDidChangeEmitter.event;
    }

    public static instance(): VirtualDocument {
        if (!_instance) { _instance = new VirtualDocument(); }
        return _instance;
    }

    hasDocument(path: string): boolean {
        return this.docsMap.has(path);
    }

    registerDocumentGetter(path: string, getter: VirtualDocumentContentGetter, ...getterArgs: any[]) {
        this.docsMap.set(path, getter);
        this.docsGetterArgs.set(path, getterArgs);
    }

    updateDocument(path: string, content?: string | VirtualDocumentContentGetter, ...getterArgs: any[]) {

        if (content) {
            this.docsMap.set(path, content);
        } else {
            if (!this.docsMap.has(path)) {
                return; // not has this file and not file content, exit
            }
        }

        this.docsGetterArgs.set(path, getterArgs);

        this.onDidChangeEmitter.fire(vscode.Uri.parse(this.getUriByPath(path)));
    }

    removeDocument(path: string) {
        this.docsMap.delete(path);
        this.docsGetterArgs.delete(path);
        this.onDidChangeEmitter.fire(vscode.Uri.parse(this.getUriByPath(path)));
    }

    getLastGetterArgs(path: string): any[] {
        return this.docsGetterArgs.get(path) || [];
    }

    getUriByPath(path: string): string {
        return `${VirtualDocument.scheme}://${File.ToNoProtocolUri(path)}`;
    }

    provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
        const getter = this.docsMap.get(uri.fsPath);
        if (getter) {
            if (typeof getter == 'string') {
                return getter;
            } else {
                return vscode.window.withProgress<string>({
                    location: vscode.ProgressLocation.Notification,
                    title: `Provide Text Document`
                }, async (progress) => {
                    progress.report({ message: `${uri.fsPath}` });
                    return await getter(uri, this.docsGetterArgs.get(uri.fsPath) || []);
                });
            }
        }
    }
}
