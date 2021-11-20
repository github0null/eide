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

let _instance: StatusBarManager;

export class StatusBarManager {

    private barMap: Map<string, vscode.StatusBarItem>;

    private constructor() {
        this.barMap = new Map();
    }

    static getInstance(): StatusBarManager {
        if (!_instance) {
            _instance = new StatusBarManager();
        }
        return _instance;
    }

    create(name: string): vscode.StatusBarItem {
        if (this.barMap.has(name)) {
            return <vscode.StatusBarItem>this.barMap.get(name);
        } else {
            const bar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
            this.barMap.set(name, bar);
            return bar;
        }
    }
/* 
    get(name: string): vscode.StatusBarItem | undefined {
        return this.barMap.get(name);
    } */

    show(name: string) {
        if (this.barMap.has(name)) {
            (<vscode.StatusBarItem>this.barMap.get(name)).show();
        }
    }

    hide(name: string) {
        if (this.barMap.has(name)) {
            (<vscode.StatusBarItem>this.barMap.get(name)).hide();
        }
    }

    disposeAll() {
        for (const kV of this.barMap) {
            kV[1].dispose();
        }
        this.barMap.clear();
    }
}