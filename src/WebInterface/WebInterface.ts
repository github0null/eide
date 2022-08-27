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

//////////////////////////////////////////////
// template interface
///////////////////////////////////////////////

export interface CategoryInfo {
	display_name: string;
	description: string;
}

export interface TemplateInfo {

	file_name: string;

	display_name: string;

	category: string[];

	version: string;

	author: string | undefined;

	download_url: string | undefined;

	size: number | undefined;

	disabled: boolean | undefined;

	upload_time: string | undefined;

	update_time: string | undefined;
}

export interface TemplateIndexDef {
	category_map: { [name: string]: CategoryInfo };
	template_list: TemplateInfo[];
}

/////////////////////////////////////////////
// util tools interface
/////////////////////////////////////////////

export interface ExternalUtilToolIndexDef {

	id: string; // tool id

	name: string; // readable name

	resources: {
		// resource nodejs platform, like: win32, linux ...
		[platform: string]: {

			url: string; // zip, 7z direct download link (https), like: 'https://test.com/gcc.zip'

			zip_type: string; // '7z' or 'zip'

			bin_dir?: string; // bin dir relative path

			detail?: string; // description

			post_install_cmd?: string; // shell command

			win_drv_path?: { // win32 driver exe path
				// arch: 'x86' or 'x64'
				[arch: string]: string;
			};
		}
	};
}
