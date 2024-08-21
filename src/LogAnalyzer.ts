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

import { EventEmitter } from "events";
import { Message, MessageType, ExceptionMessage } from './Message';
import { GlobalEvent } from "./GlobalEvents";
let _analyzer: LogAnalyzer;

export interface DisplayableMessage {
    title?: string;
    text: string;
}

interface AnalyzeResult {
    displayable?: DisplayableMessage;
    isLog: boolean;
    msg: Message;
}

type MessageCategory = MessageType | 'Log';

export class LogAnalyzer {

    private _event: EventEmitter;

    private constructor() {
        this._event = new EventEmitter();
        this._event.on('msg', (msg) => this.DispatchMessage(msg));
        GlobalEvent.on('msg', (msg) => LogAnalyzer.emit('msg', msg));
    }

    static GetInstance(): LogAnalyzer {
        if (_analyzer === undefined) {
            _analyzer = new LogAnalyzer();
        }
        return _analyzer;
    }

    getLogListenerCount(): number {
        return this._event.listenerCount('Log');
    }

    private DispatchMessage(msg: Message) {

        const res = this.Analyze(msg);

        if (res.isLog) {
            this._event.emit('Log', res.msg);
        }

        switch (res.msg.type) {
            case 'Warning':
                if (res.displayable) {
                    this._event.emit('Warning', res.displayable);
                }
                break;
            case 'Error':
                if (res.displayable) {
                    this._event.emit('Error', res.displayable);
                }
                break;
            case 'Info':
                if (res.displayable) {
                    this._event.emit('Info', res.displayable);
                }
                break;
            case 'Hidden':
                // do nothing
                break;
            default:
                console.log('Analyzed unknown categroy message \'' + res.msg.type + '\' !');
                break;
        }
    }

    private Analyze(msg: Message): AnalyzeResult {

        const res: AnalyzeResult = {
            msg: msg,
            isLog: true
        };

        switch (msg.type) {
            case 'Error':
                this.AnalyzeError(res);
                break;
            case 'Warning':
                this.AnalyzeWarning(res);
                break;
            case 'Info':
                this.AnalyzeInfo(res);
                break;
            case 'Hidden':
                // do nothing
                break;
            default:
                break;
        }

        return res;
    }

    private AnalyzeError(result: AnalyzeResult) {

        if (result.msg.contentType === 'exception') {
            try {
                let eMsg: ExceptionMessage = JSON.parse(result.msg.content);
                result.displayable = {
                    title: eMsg.name,
                    text: eMsg.message
                };
            } catch (error) {
                GlobalEvent.emit('error', error);
            }
        }

        if (result.msg.contentType === 'string') {
            result.displayable = {
                title: result.msg.className,
                text: result.msg.content
            };
        }
    }

    private AnalyzeWarning(result: AnalyzeResult) {

        if (result.msg.contentType === 'exception') {
            let eMsg: ExceptionMessage = JSON.parse(result.msg.content);
            result.displayable = {
                title: eMsg.name,
                text: eMsg.message
            };
        }

        if (result.msg.contentType === 'string') {
            result.isLog = false;
            result.displayable = {
                title: result.msg.className,
                text: result.msg.content
            };
        }
    }

    private AnalyzeInfo(result: AnalyzeResult) {
        if (result.msg.contentType === 'string') {
            result.isLog = false;
            result.displayable = {
                title: result.msg.title,
                text: result.msg.content
            };
        }
    }

    static on(event: 'Warning', listener: (msg: DisplayableMessage) => void): void;
    static on(event: 'Error', listener: (msg: DisplayableMessage) => void): void;
    static on(event: 'Info', listener: (msg: DisplayableMessage) => void): void;
    static on(event: 'Log', listener: (msg: Message) => void): void;
    static on(event: MessageCategory, args?: any): void {
        LogAnalyzer.GetInstance()._event.on(event, args);
    }

    static emit(event: 'msg', msg: Message): boolean;
    static emit(event: any, args?: any): boolean {
        return LogAnalyzer.GetInstance()._event.emit(event, args);
    }
}