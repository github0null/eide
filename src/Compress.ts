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

import { File } from "../lib/node-utility/File";
import { ExeFile } from "../lib/node-utility/Executable";
import * as events from 'events';
import * as child_process from 'child_process';

export interface CompressOption {
    zipType: string;
    fileName: string;
    excludeList?: string[];
}

export class Compress {

    static readonly MaxStep = 18;

    private _7za: File;
    private _event: events.EventEmitter;

    on(event: 'progress', listener: (currentProgress: number) => void): this;
    on(event: any, listener: (arg?: any) => void): this {
        this._event.on(event, listener);
        return this;
    }

    constructor(_7zFolder: File) {
        this._event = new events.EventEmitter();
        this._7za = File.fromArray([_7zFolder.path, '7za.exe']);
        if (!this._7za.IsFile()) {
            throw new Error('\'7za.exe\' is not exist');
        }
    }

    Unzip(zipFile: File, outDir?: File): Promise<Error | null> {

        if (!zipFile.IsFile()) {
            throw new Error('\'' + zipFile.path + '\' is not exist');
        }

        return new Promise((resolve) => {

            let paramList: string[] = [];
            paramList.push('x');
            paramList.push('-y');
            paramList.push('-r');
            paramList.push('-aoa');
            paramList.push(zipFile.path);
            const outPath = (outDir ? outDir.path : zipFile.dir);
            paramList.push('-o' + outPath);

            const process = new ExeFile();
            let err: Error | undefined;
            let outputCount = 0;

            process.on('error', (e) => {
                err = e;
            });

            process.on('close', (exitInfo) => {
                if (err) {
                    resolve(err);
                } else {
                    if (exitInfo.code === 0) {
                        resolve();
                    } else {
                        resolve(new Error('unzip error, code: ' + exitInfo.code.toString() + ' !'));
                    }
                }
            });

            process.on('errLine', (line) => {
                console.warn('[unzip] : ErrorLine : ' + line);
            });

            process.on('line', (line) => {
                outputCount++;
                console.debug('[unzip] : Output ' + outputCount.toString() + ' : ' + line);
                this._event.emit('progress', outputCount);
            });

            process.Run(this._7za.path, paramList, { windowsHide: true });
        });
    }

    UnzipSync(zipFile: File, outDir?: File): string {

        if (!zipFile.IsFile()) {
            throw new Error('\'' + zipFile.path + '\' is not exist');
        }

        let paramList: string[] = [];
        paramList.push('x');
        paramList.push('-y');
        paramList.push('-r');
        paramList.push('-aoa');
        paramList.push(zipFile.path);
        const outPath = (outDir ? outDir.path : zipFile.dir);
        paramList.push('-o' + outPath);

        return child_process.execFileSync(this._7za.path, paramList, { windowsHide: true }).toString();
    }

    Zip(dirOrFile: File, option: CompressOption, outDir?: File): Promise<Error | null> {

        if (!dirOrFile.IsExist()) {
            throw new Error('\'' + dirOrFile.path + '\' is not exist');
        }

        return new Promise((resolve) => {

            let paramList: string[] = [];

            paramList.push('a');
            paramList.push('-r');
            paramList.push('-y');
            paramList.push('-ssw');
            paramList.push('-t' + option.zipType);
            paramList.push('-mx');
            paramList.push('-myx');

            const outPath = ((outDir?.path + File.sep) || '.\\') + option.fileName;
            paramList.push(outPath);
            paramList.push(dirOrFile.path + '\\*');

            if (option.excludeList) {
                for (let excludeReg of option.excludeList) {
                    paramList.push('-xr!' + excludeReg.trim());
                }
            }

            const process = new ExeFile();
            let err: Error | undefined;
            let outputCount = 0;

            process.on('error', (e) => {
                err = e;
            });

            process.on('close', (exitInfo) => {
                if (err) {
                    resolve(err);
                } else {
                    if (exitInfo.code === 0) {
                        resolve();
                    } else {
                        resolve(new Error('zip error, code: ' + exitInfo.code.toString() + ' !'));
                    }
                }
            });

            process.on('errLine', (line) => {
                console.warn('[zip] : ErrorLine : ' + line);
            });

            process.on('line', (line) => {
                outputCount++;
                console.debug('[zip] : Output ' + outputCount.toString() + ' : ' + line);
                this._event.emit('progress', outputCount);
            });

            process.Run(this._7za.path, paramList, { windowsHide: true });
        });
    }

    sha256(zipFile: File): string | undefined {
        try {
            const args = ['h', '-scrcSHA256', zipFile.path];
            const resLi = child_process.execFileSync(this._7za.path, args).toString()
                .split(/\r\n|\n/).map((s) => s.trim());

            const header = 'SHA256 for data:';
            for (const line of resLi) {
                if (line.startsWith(header)) {
                    const hashStr = line.replace(header, '').trim();
                    if (hashStr.length == 64) return hashStr.toLowerCase();
                }
            }
        } catch (error) {
            // do nothing
        }
    }
}