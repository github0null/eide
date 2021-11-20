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

export interface GitFileInfo {
	name: string;
	path: string;
	type: string;
	sha: string;
	size: number;
	url: string;
	git_url: string;
	html_url?: string;
	download_url?: string;
}

/*
{
    "sha": "2469cf4398562399df11fa6bf93af27c3cd6b92d",
    "node_id": "MDQ6QmxvYjIzNjkxMDIwMToyNDY5Y2Y0Mzk4NTYyMzk5ZGYxMWZhNmJmOTNhZjI3YzNjZDZiOTJk",
    "size": 461949,
    "url": "https://api.github.com/repos/github0null/eide-doc/git/blobs/2469cf4398562399df11fa6bf93af27c3cd6b92d",
    "content": ".........."
}
*/

export interface GitFileContent {
	sha: string;
	size: number;
	node_id: string;
	url: string;
	content: string;
}