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
import { Message, ExceptionToMessage, newMessage } from './Message';

let _globalEvent: GlobalEvent | undefined;

export class GlobalEvent {

    private _emitter: events.EventEmitter;

    private constructor() {
        this._emitter = new events.EventEmitter();
    }

    static GetInstance(): GlobalEvent {
        if (_globalEvent === undefined) {
            _globalEvent = new GlobalEvent();
        }
        return _globalEvent;
    }

    //event
    static on(event: 'extension_launch_done', listener: () => void): void;
    static on(event: 'project.opened', listener: (prj: any) => void): void;
    static on(event: 'project.closed', listener: (uid?: string) => void): void;
    static on(event: 'project.activeStatusChanged', listener: (uid: string) => void): void;

    //msg
    static on(event: 'error', listener: (error: Error) => void): void;
    static on(event: 'msg', listener: (msg: Message) => void): void;
    static on(event: 'globalLog', listener: (msg: Message) => void): void;
    static on(event: 'globalLog.append', listener: (log: string) => void): void;
    static on(event: 'globalLog.show', listener: () => void): void;
    static on(event: any, args?: any): void {
        GlobalEvent.GetInstance()._emitter.on(event, args);
    }

    static once(event: any, args?: any): void {
        GlobalEvent.GetInstance()._emitter.once(event, args);
    }

    static prepend(event: 'msg', listener: (msg: Message) => void): void;
    static prepend(event: any, args?: any): void {
        GlobalEvent.GetInstance()._emitter.prependListener(event, args);
    }

    //event
    static emit(event: 'extension_launch_done'): boolean;
    static emit(event: 'project.opened', prj: any): boolean;
    static emit(event: 'project.closed', uid?: string): boolean;
    static emit(event: 'project.activeStatusChanged', newuid: string): boolean;

    //msg
    static emit(event: 'error', error: Error): boolean;             // 错误弹框（vscode 右下角）
    static emit(event: 'msg', msg: Message): boolean;               // 消息弹框（vscode 右下角）
    static emit(event: 'globalLog', msg: Message): boolean;         // 打印日志+换行 -> 输出面板
    static emit(event: 'globalLog.append', log: string): boolean;   // 打印原始日志字串 -> 输出面板
    static emit(event: 'globalLog.show'): boolean;                  // 向用户显示eide输出面板日志
    static emit(event: any, args?: any): boolean {
        return GlobalEvent.GetInstance()._emitter.emit(event, args);
    }

    //log
    static log_info(msg: string) {
        GlobalEvent.GetInstance()._emitter.emit('globalLog', newMessage('Info', msg));
    }
    static log_warn(msg: string | Error) {
        if (typeof msg == 'string') {
            GlobalEvent.GetInstance()._emitter.emit('globalLog', newMessage('Warning', msg));
        } else {
            GlobalEvent.GetInstance()._emitter.emit('globalLog', ExceptionToMessage(msg, 'Warning'));
        }
    }
    static log_error(msg: string | Error) {
        if (typeof msg == 'string') {
            GlobalEvent.GetInstance()._emitter.emit('globalLog', newMessage('Error', msg));
        } else {
            GlobalEvent.GetInstance()._emitter.emit('globalLog', ExceptionToMessage(msg, 'Error'));
        }
    }
    // 向用户显示eide输出面板日志
    static log_show() {
        GlobalEvent.GetInstance()._emitter.emit('globalLog.show');
    }
}

GlobalEvent.on('error', (err) => {
    if (err) {
        GlobalEvent.emit('msg', ExceptionToMessage(err));
    } else {
        GlobalEvent.emit('msg', ExceptionToMessage(new Error('Empty Error received !')));
    }
});
