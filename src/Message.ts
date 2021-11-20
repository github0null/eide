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

export type MessageType = 'Info' | 'Warning' | 'Error' | 'Hidden';

export type ContentType = 'string' | 'object' | 'exception';

export interface ExceptionMessage {
    name?: string;
    message: string;
    stack?: string;
}

export interface Message {
    type: MessageType;
    title?: string;
    content: string;
    contentType: ContentType;
    //---------extra----------------
    appName?: string;
    className?: string;
    methodName?: string;
    timeStamp?: string;
    uid?: string;
}

export function ExceptionToMessage(err: Error, type?: MessageType): Message {
    return <Message>{
        type: type || 'Error',
        contentType: 'exception',
        content: JSON.stringify(<ExceptionMessage>{
            name: err.name,
            message: err.message,
            stack: err.stack
        })
    };
}

export function newMessage(type: MessageType, msg: string): Message {
    return {
        type: type,
        contentType: 'string',
        content: msg
    };
}