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

export class VirtualDocument implements vscode.TextDocumentContentProvider {

    public static scheme = 'eide';

    private onDidChangeEmitter: vscode.EventEmitter<vscode.Uri>;
    private docsMap: Map<string, string>;

    onDidChange: vscode.Event<vscode.Uri>;

    private constructor() {
        this.docsMap = new Map();
        this.onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
        this.onDidChange = this.onDidChangeEmitter.event;
    }

    public static instance(): VirtualDocument {
        if (!_instance) { _instance = new VirtualDocument(); }
        return _instance;
    }

    updateDocument(path: string, content: string) {
        this.docsMap.set(path, content);
        this.onDidChangeEmitter.fire(vscode.Uri.parse(this.getUriByPath(path)));
    }

    getUriByPath(path: string): string {
        return `${VirtualDocument.scheme}://${File.ToNoProtocolUri(path)}`;
    }

    provideTextDocumentContent(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<string> {
        if (this.docsMap.has(uri.fsPath)) {
            return this.docsMap.get(uri.fsPath);
        }
    }
}
