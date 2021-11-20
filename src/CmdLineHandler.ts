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

export class CmdLineHandler {

    private constructor() { }

    /**
     * powershell:  & '@param callerFile' 'arg1' 'arg2'
     * 
     * cmd:         ""@param callerFile" "arg1" "arg2""
    */
    static getCommandLine(callerFile: string, args: string[], isPowershell?: boolean, noQuote: boolean = false): string {

        const quote = isPowershell ? "'" : '"';
        const callerHeader = isPowershell ? '& ' : '';
        const cmdPrefixSuffix = isPowershell ? '' : '"';

        const commandLine: string = cmdPrefixSuffix + callerHeader
            + this.quoteString(callerFile, quote) + ' '
            + args.map((arg) => {
                return noQuote ? arg : this.quoteString(arg, quote);
            }).join(' ')
            + cmdPrefixSuffix;

        return commandLine;
    }

    /**
     * input: ""a b.exe" -a -b -c"
     * 
     * output: "a b.exe" -a -b -c
    */
    static DeleteCmdPrefix(cmdLine: string): string {
        return cmdLine.replace(/^"|"$/g, '');
    }

    static quoteString(str: string, quote: string): string {
        return (str.includes(' ') && !str.includes(quote)) ? (quote + str + quote) : str;
    }
}