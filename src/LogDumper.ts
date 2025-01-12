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

import { LogAnalyzer } from "./LogAnalyzer";
import { File } from "../lib/node-utility/File";
import { ResManager } from "./ResManager";
import { Message, ExceptionMessage, MessageType } from "./Message";
import * as fs from 'fs';
import { EOL } from "os";
import { Time } from "../lib/node-utility/Time";
import { GlobalEvent } from "./GlobalEvents";
import * as utility from "./utility";

let _instance: LogDumper | undefined;

export class LogDumper {

    private logFile: File;
    private _console: Console;

    private constructor() {

        const logDir = ResManager.GetInstance().GetLogDir();

        logDir.CreateDir(false);

        this.logFile = File.fromArray([logDir.path, ResManager.GetInstance().getAppFullName() + '.log']);

        // limit max size
        try {
            if (this.logFile.IsFile() && this.logFile.getSize() > (1024 * 512)) {
                const p = [logDir.path, this.logFile.noSuffixName + `_${Date.now()}` + this.logFile.suffix].join(File.sep);
                fs.renameSync(this.logFile.path, p);
                this.logFile.Write('');
            }
        } catch (err) {
            // nothing todo
        }

        const outStream = fs.createWriteStream(this.logFile.path, { flags: 'a' });
        this._console = new console.Console(outStream, outStream);

        const time = Time.GetInstance().GetTimeInfo();
        this._console.log(
            `[${time.year}/${time.month}/${time.date} ${time.hour}:${time.minute}:${time.second} ${time.region}] : launched`
        );

        LogAnalyzer.on('Log', (logData) => {
            this.dump(logData);
        });
    }

    onDispose() {
        this.close();
    }

    static getInstance(): LogDumper {
        if (_instance === undefined) {
            _instance = new LogDumper();
        }
        return _instance;
    }

    static _toShortMsgType(t: MessageType): string {
        switch (t) {
            case 'Hidden':
                return 'Debug';
            case 'Warning':
                return 'Warn';
            default:
                return t;
        }
    }

    static Msg2String(log: Message): string {

        let res = `[${this._toShortMsgType(log.type)}] [${utility.timeStamp()}] `;

        switch (log.contentType) {
            case 'exception':
                {
                    const obj: ExceptionMessage = JSON.parse(log.content);
                    res += `${obj.message || ''}\r\n`;
                    res += obj.stack || '';
                }
                break;
            case 'object':
                res += JSON.stringify(log.content, undefined, 4);
                break;
            default:
                res += log.content;
                break;
        }

        return res;
    }

    dump(data: Message) {
        this._console.log(LogDumper.Msg2String(data));
    }

    close() {
        this._console.log(EOL);
    }

    clear() {
        if (this.logFile.IsFile()) {
            this.logFile.Write('');
        }
    }
}