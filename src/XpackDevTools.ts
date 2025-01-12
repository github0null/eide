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

import { jsonc } from "jsonc";
import { File } from "../lib/node-utility/File";

/*
{
  "xpack": {
    "minimumXpmRequired": "0.20.5",
    "dependencies": {},
    "devDependencies": {
      "@xpack-dev-tools/arm-none-eabi-gcc": {
        "specifier": "14.2.1-1.1.1",
        "local": "link",
        "platforms": "all"
      }
    },
    "properties": {},
    "actions": {},
    "buildConfigurations": {}
  },
  "keywords": [
    "xpack"
  ]
}

{
  "name": "@xpack-dev-tools/arm-none-eabi-gcc",
  "version": "14.2.1-1.1.1",
  "description": "A binary xpm package with the GNU Arm Embedded GCC toolchain executables",
  "main": "",
  "scripts": {
    "postversion": "git push origin --all && git push origin --tags",
    "test": "echo \"Error: no test specified\" && exit 1",
    "liquidjs": "liquidjs"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/xpack-dev-tools/arm-none-eabi-gcc-xpack.git"
  },
  "bugs": {
    "url": "https://github.com/xpack-dev-tools/arm-none-eabi-gcc-xpack/issues"
  },
  "homepage": "https://xpack-dev-tools.github.io/arm-none-eabi-gcc-xpack/",
  "keywords": [
    "xpack",
    "gcc",
    "arm",
    "toolchain",
    "embedded"
  ],
  "author": {
    "name": "Liviu Ionescu",
    "email": "ilg@livius.net",
    "url": "https://github.com/ilg-ul"
  },
  "license": "MIT",
  "xpack": {
    "minimumXpmRequired": "0.16.3",
    "binaries": {
      "destination": "./.content",
      "baseUrl": "https://github.com/xpack-dev-tools/arm-none-eabi-gcc-xpack/releases/download/v14.2.1-1.1",
      "skip": 1,
      "platforms": {
        "darwin-arm64": {
          "fileName": "xpack-arm-none-eabi-gcc-14.2.1-1.1-darwin-arm64.tar.gz",
          "sha256": "f52ea3760c53b25d726a7345be60a210736293db85f92daa39d1d22d34e2c995"
        },
        "darwin-x64": {
          "fileName": "xpack-arm-none-eabi-gcc-14.2.1-1.1-darwin-x64.tar.gz",
          "sha256": "b5bf8d5af099fd464d1543e5b8901308fb64116fa7a244426cacf4ff1b882fc7"
        },
        "linux-arm64": {
          "fileName": "xpack-arm-none-eabi-gcc-14.2.1-1.1-linux-arm64.tar.gz",
          "sha256": "a1ac95c8d9347020d61e387e644a2c1806556b77162958a494d2f5f3d5fe7053"
        },
        "linux-arm": {
          "fileName": "xpack-arm-none-eabi-gcc-14.2.1-1.1-linux-arm.tar.gz",
          "sha256": "7a0beb722c4a290e35d041d942612a38336d76a60c78286d116e79e82d82f285"
        },
        "linux-x64": {
          "fileName": "xpack-arm-none-eabi-gcc-14.2.1-1.1-linux-x64.tar.gz",
          "sha256": "ed8c7d207a85d00da22b90cf80ab3b0b2c7600509afadf6b7149644e9d4790a6"
        },
        "win32-x64": {
          "fileName": "xpack-arm-none-eabi-gcc-14.2.1-1.1-win32-x64.zip",
          "sha256": "0b2d496b383ba578182eb57b3f7d35ff510e36eda56257883b902fa07c3bba55"
        }
      }
    },
    "bin": {
      "arm-none-eabi-addr2line": "./.content/bin/arm-none-eabi-addr2line",
      "arm-none-eabi-ar": "./.content/bin/arm-none-eabi-ar",
      "arm-none-eabi-as": "./.content/bin/arm-none-eabi-as",
      "arm-none-eabi-c++": "./.content/bin/arm-none-eabi-c++",
      "arm-none-eabi-c++filt": "./.content/bin/arm-none-eabi-c++filt",
      "arm-none-eabi-cpp": "./.content/bin/arm-none-eabi-cpp",
      "arm-none-eabi-dwp": "./.content/bin/arm-none-eabi-dwp",
      "arm-none-eabi-elfedit": "./.content/bin/arm-none-eabi-elfedit",
      "arm-none-eabi-g++": "./.content/bin/arm-none-eabi-g++",
      "arm-none-eabi-gcc": "./.content/bin/arm-none-eabi-gcc",
      "arm-none-eabi-gcc-ar": "./.content/bin/arm-none-eabi-gcc-ar",
      "arm-none-eabi-gcc-nm": "./.content/bin/arm-none-eabi-gcc-nm",
      "arm-none-eabi-gcc-ranlib": "./.content/bin/arm-none-eabi-gcc-ranlib",
      "arm-none-eabi-gcov": "./.content/bin/arm-none-eabi-gcov",
      "arm-none-eabi-gcov-dump": "./.content/bin/arm-none-eabi-gcov-dump",
      "arm-none-eabi-gcov-tool": "./.content/bin/arm-none-eabi-gcov-tool",
      "arm-none-eabi-gdb": "./.content/bin/arm-none-eabi-gdb",
      "arm-none-eabi-gdb-add-index": "./.content/bin/arm-none-eabi-gdb-add-index",
      "arm-none-eabi-gdb-add-index-py3": "./.content/bin/arm-none-eabi-gdb-add-index-py3",
      "arm-none-eabi-gdb-py3": "./.content/bin/arm-none-eabi-gdb-py3",
      "arm-none-eabi-gfortran": "./.content/bin/arm-none-eabi-gfortran",
      "arm-none-eabi-gprof": "./.content/bin/arm-none-eabi-gprof",
      "arm-none-eabi-ld": "./.content/bin/arm-none-eabi-ld",
      "arm-none-eabi-ld.bfd": "./.content/bin/arm-none-eabi-ld.bfd",
      "arm-none-eabi-ld.gold": "./.content/bin/arm-none-eabi-ld.gold",
      "arm-none-eabi-lto-dump": "./.content/bin/arm-none-eabi-lto-dump",
      "arm-none-eabi-nm": "./.content/bin/arm-none-eabi-nm",
      "arm-none-eabi-objcopy": "./.content/bin/arm-none-eabi-objcopy",
      "arm-none-eabi-objdump": "./.content/bin/arm-none-eabi-objdump",
      "arm-none-eabi-ranlib": "./.content/bin/arm-none-eabi-ranlib",
      "arm-none-eabi-readelf": "./.content/bin/arm-none-eabi-readelf",
      "arm-none-eabi-size": "./.content/bin/arm-none-eabi-size",
      "arm-none-eabi-strings": "./.content/bin/arm-none-eabi-strings",
      "arm-none-eabi-strip": "./.content/bin/arm-none-eabi-strip"
    }
  }
}
*/

export interface XpackJson {
    xpack: {
        devDependencies: {
            //@xpack-dev-tools/arm-none-eabi-gcc
            [tool: string]: {
                specifier?: string;
                [key: string]: any;
            }
        };
        [key: string]: any;
    };
    [key: string]: any;
}

export interface XpackToolsJson {
    name: string;
    version: string;
    xpack: {
        binaries: {
            destination: string;
            [key: string]: any;
        };
        [key: string]: any;
    };
    [key: string]: any;
}

/**
 * @description 如果检测到要求的 toolchain, 则返回toolchain的路径
 * 如果未检测到 toolchain 则返回 undefined.
 * 
 * @note 如果解析出错 或者 检测到toolchain不存在，则抛出异常。
 * 
 * @example 
 * xpackRequireDevTools(dir, 'arm-none-eabi-gcc')
 * xpackRequireDevTools(dir, 'riscv-none-elf-gcc')
 * xpackRequireDevTools(dir, 'openocd')
 * 
*/
export function xpackRequireDevTools(searchDir: File, toolname: string): File | undefined {

    const jobj = xpackProbe(searchDir);
    if (!jobj)
        return undefined;

    const tool = jobj.xpack.devDependencies[`@xpack-dev-tools/${toolname}`];
    if (!tool)
        return undefined;

    const pkgfile = File.from(searchDir.path,
        'xpacks', '@xpack-dev-tools', toolname, 'package.json');
    if (!pkgfile.IsFile())
        throw Error(`[xpack-dev-tools] Not found ${pkgfile.path}`);

    let toolJson: XpackToolsJson;
    try {
        toolJson = jsonc.parse(pkgfile.Read());
    } catch (error) {
        throw Error(`[xpack-dev-tools] Parse ${pkgfile.path} error: ${(<Error>error).message}`);
    }

    // check version
    if (tool.specifier) {
        if (!versionMatch(tool.specifier, toolJson.version))
            throw Error(`[xpack-dev-tools] Version not match. want ${tool.specifier} but we have ${toolJson.version}`);
    }

    if (!toolJson.xpack.binaries.destination)
        throw Error(`[xpack-dev-tools] Cannot parse tool 'destination' in ${pkgfile.path} !`);

    return File.from(pkgfile.dir, File.normalize(toolJson.xpack.binaries.destination));
}

function versionMatch(wanted: string, current: string): boolean {
    try {
        // match 1.0.x
        if (wanted.charAt(0) == '~') {
            const ver_want = wanted.substring(1).split('.');
            if (ver_want.length < 2)
                return false;
            const ver_cur = current.split('.');
            if (ver_cur.length < 2)
                return false;
            return ver_want[0] == ver_cur[0] && 
                   ver_want[1] == ver_cur[1];
        }
        // match 1.x.x 
        else if (wanted.charAt(0) == '^') {
            const ver_want = wanted.substring(1).split('.');
            if (ver_want.length < 1)
                return false;
            const ver_cur = current.split('.');
            if (ver_cur.length < 1)
                return false;
            return ver_want[0] == ver_cur[0];
        }
        // match == 
        else {
            return wanted == current;
        }
    } catch (error) {
        return false;
    }
}

function xpackProbe(dir: File): XpackJson | undefined {

    const file = File.from(dir.path, 'package.json');
    if (!file.IsFile())
        return undefined;

    let jobj: XpackJson | undefined;
    try {
        jobj = jsonc.parse(file.Read());
    } catch (error) {
        throw Error(`[xpack-dev-tools] Parse ${file.path} error: ${(<Error>error).message}`);
    }

    if (jobj?.xpack == undefined)
        return undefined;

    if (jobj?.xpack.devDependencies == undefined)
        return undefined;

    return jobj;
}
