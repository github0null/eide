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

import * as iconv from 'iconv-lite';
import { File } from '../lib/node-utility/File';
import * as fs from 'fs';

export enum CodeType {
    UTF8 = 'utf8',
    UNICODE = 'unicode',
    UTF16BE = 'utf16be',
    UTF32BE = 'utf32be',
    UTF32LE = 'utf32le',
    ASCII = 'ascii',
    NULL = 'null'
}

export class CodeConverter {

    private getCodeType(bomHead: Buffer): CodeType {

        let codeType: CodeType;

        if (bomHead && bomHead.length === 4) {

            switch (bomHead[0]) {
                case 0xfe:
                    if (bomHead[1] === 0xff) {
                        codeType = CodeType.UTF16BE;
                    }
                    else {
                        codeType = CodeType.NULL;
                    }
                    break;
                case 0xef:
                    if (bomHead[1] === 0xbb && bomHead[2] === 0xbf) {
                        codeType = CodeType.UTF8;
                    }
                    else {
                        codeType = CodeType.NULL;
                    }
                    break;
                case 0x00:
                    if (bomHead[1] === 0x00 && bomHead[2] === 0xfe && bomHead[3] === 0xff) {
                        codeType = CodeType.UTF32BE;
                    }
                    else {
                        codeType = CodeType.NULL;
                    }
                    break;
                case 0xff:
                    if (bomHead[1] === 0xfe && bomHead[2] === 0x00 && bomHead[3] === 0x00) {
                        codeType = CodeType.UTF32LE;
                    }
                    else if (bomHead[1] === 0xfe) {
                        codeType = CodeType.UNICODE;
                    }
                    else {
                        codeType = CodeType.NULL;
                    }
                    break;
                default:
                    codeType = CodeType.ASCII;
                    break;
            }
        } else {
            codeType = codeType = CodeType.NULL;
        }

        return codeType;
    }

    GetCodeType(file: File): Promise<CodeType> {
        return new Promise((resolve) => {
            const stream = fs.createReadStream(file.path);
            stream.on('readable', () => {
                let bomHead: Buffer = stream.read(4);
                stream.close();
                resolve(this.getCodeType(bomHead));
            });
        });
    }

    getCodeTypeSync(file: File): CodeType {
        const buf = fs.readFileSync(file.path);
        return this.getCodeType(buf);
    }

    ExistCode(encoding: string): boolean {
        return iconv.encodingExists(encoding);
    }

    ConvertToUTF8(file: File, originalEncoding: string, outPath: string) {
        fs.createReadStream(file.path)
            .pipe(iconv.decodeStream(originalEncoding))
            .pipe(iconv.encodeStream('utf8'))
            .pipe(fs.createWriteStream(outPath, {
                autoClose: true
            }));
    }

    toTargetCode(str: string, encoding: string): Buffer {
        return iconv.encode(iconv.decode(Buffer.from(str), 'utf8'), encoding);
    }
}