import * as fs from 'fs';
import * as NodePath from 'path';
import * as os from 'os';
import * as xml2js from 'xml2js';
import { VirtualFolder } from './EIDETypeDefine';
import { VirtualSource, AbstractProject } from './EIDEProject';
import { isArray } from 'util';
import { ArrayDelRepetition } from '../lib/node-utility/Utility';
import { File } from '../lib/node-utility/File';

export type EclipseProjectType = 'arm' | 'sdcc' | 'riscv' | 'gcc';

export interface EclipseProjectInfo {
    name: string;
    type: EclipseProjectType;
    targets: EclipseProjectTarget[];
    virtualSource: VirtualFolder;
    sourceEntries: string[];
    envs: { [name: string]: string }; // only use to show for user, not use in program
}

export interface EclipseBuilderArgs {

    globalArgs: string[];

    cIncDirs: string[];
    cMacros: string[];
    cCompilerArgs: string[];

    sIncDirs: string[];
    sMacros: string[];
    assemblerArgs: string[];

    linkerArgs: string[];
    linkerLibArgs: string[];
}

export interface EclipseProjectTarget {
    name: string;
    excList: string[];
    globalArgs: EclipseBuilderArgs;
    incompatibleArgs: { [path: string]: EclipseBuilderArgs }; // only use to show for user, not use in program
}

function newEclipseBuilderArgs(): EclipseBuilderArgs {
    return {
        globalArgs: [],
        cIncDirs: [],
        cMacros: [],
        cCompilerArgs: [],
        sIncDirs: [],
        sMacros: [],
        assemblerArgs: [],
        linkerArgs: [],
        linkerLibArgs: []
    };
}

export function formatFilePath(path: string): string {

    // %7B..%7D/a.c
    // PARENT-2-PROJECT_LOC/nrf_demo/app/main.c
    // PARENT-3-PROJECT_LOC/nrf_demo/app/main.c
    // &quot;${workspace_loc:/${ProjName}/platform/emdrv/nvm3/inc}&quot;

    path = decodeURI(path);

    if (/-PROJECT_LOC/.test(path)) {
        const mRes = /PARENT-(\d+)-PROJECT_LOC/.exec(path);
        if (mRes && mRes.length > 1) {
            const pLi: string[] = [];
            const pCnt = parseInt(mRes[1]);
            for (let i = 0; i < pCnt; i++) pLi.push('..');
            const pTxt = pLi.join('/');
            path = path
                .replace('${' + mRes[0] + '}', pTxt)
                .replace(mRes[0], pTxt);
        }
    }

    path = path
        .replace('${.}', '.')
        .replace('${..}', '..')
        .replace('${ProjName}/', '')
        .replace('${ProjName}', '.')
        .replace('PROJECT_LOC/', '')
        .replace('${PROJECT_LOC}/', '')
        .replace(/^"+/, '')
        .replace('${workspace_loc:/', '')
        .replace(/"+$/, '')
        .replace(/\}$/, '')
        .replace(/\/+$/, '');

    if (path.startsWith('/'))
        path = '.' + path;

    return path;
}

export async function parseEclipseProject(cprojectPath: string): Promise<EclipseProjectInfo> {

    let _prjDom = (await xml2js.parseStringPromise(
        fs.readFileSync(NodePath.dirname(cprojectPath) + NodePath.sep + '.project').toString()))['projectDescription'];

    let cprjDom = (await xml2js.parseStringPromise(
        fs.readFileSync(cprojectPath).toString()))['cproject'];

    const cprojectDir = new File(NodePath.dirname(cprojectPath));

    const SRC_FILE_FILTER = AbstractProject.getSourceFileFilterWithoutObj().concat(AbstractProject.headerFilter);

    const PROJ_INFO: EclipseProjectInfo = {
        name: _prjDom.name[0].replace(/\s+/g, '_'),
        type: 'gcc',
        targets: [],
        virtualSource: {
            name: VirtualSource.rootName,
            files: [],
            folders: [],
        },
        sourceEntries: [],
        envs: {}
    };

    // goto: <storageModule moduleId="org.eclipse.cdt.core.settings">
    let node = getChild(toArray(cprjDom.storageModule), m => m.$['moduleId'] == "org.eclipse.cdt.core.settings");
    if (!node) throw new Error(`not found: '<storageModule moduleId="org.eclipse.cdt.core.settings">'`);
    cprjDom = node;

    // parse all project targets
    for (const ccfg of toArray(cprjDom['cconfiguration'])) {

        // parse all eclipse envs
        let eN = getChild(toArray(ccfg['storageModule']), m => m.$['moduleId'] == "org.eclipse.cdt.core.settings");
        if (eN && eN.macros) {
            toArray(eN.macros[0].stringMacro).forEach(m => {
                const key = m.$['name'];
                if (key) {
                    PROJ_INFO.envs[key] = m.$['value'];
                }
            });
        }

        // goto: <storageModule moduleId="cdtBuildSystem" version="4.0.0">
        let cTarget = getChild(toArray(ccfg['storageModule']), n => n.$['moduleId'] == "cdtBuildSystem");
        if (!cTarget || !cTarget['configuration']) continue;

        // check cdt version
        const cdtVer = (cTarget.$['version'] || 'null').trim();
        if (!/^([4-9]|[1-9]\d+)\./.test(cdtVer))
            throw new Error(`eclipse project cdt version must >= 4.x.x, but your project is '${cdtVer}' !`);

        cTarget = cTarget['configuration'][0];

        const tInfo: EclipseProjectTarget = {
            name: cTarget.$['name'].replace(/\s+/g, '_'),
            excList: [],
            globalArgs: newEclipseBuilderArgs(),
            incompatibleArgs: {}
        };

        PROJ_INFO.targets.push(tInfo);

        for (const resourceInfo of toArray(cTarget.folderInfo).concat(toArray(cTarget.fileInfo))) {

            let builderArgs = tInfo.globalArgs;
            let incompatibleArgs: EclipseBuilderArgs = newEclipseBuilderArgs();

            const folderPath = (resourceInfo.$['resourcePath'] || '').trim();
            const isRootResource = folderPath == '';
            if (folderPath != '') {
                tInfo.incompatibleArgs[folderPath] = incompatibleArgs;
                builderArgs = incompatibleArgs;
            } else {
                tInfo.incompatibleArgs['/'] = incompatibleArgs;
            }

            const toolchainInfo = resourceInfo.toolChain ? resourceInfo.toolChain[0] : resourceInfo;

            if (isRootResource && PROJ_INFO.type == 'gcc') {
                PROJ_INFO.type = detectProjectType(toolchainInfo) || 'gcc';
            }

            for (const globOpts of toArray(toolchainInfo['option'])) {
                const opVal = parseToolOption(globOpts);
                if (opVal) {
                    builderArgs.globalArgs = builderArgs.globalArgs.concat(opVal.val);
                } else {
                    incompatibleArgs.globalArgs.push(`<${globOpts.$['name']}> = ${globOpts.$['value']}`);
                }
            }

            for (const toolOpts of toArray(toolchainInfo['tool'])) {

                const toolOptName: string = toolOpts.$['name'] || '';

                // for c/c++
                if (toolOptName.includes('Compiler')) {
                    toArray(toolOpts.option).forEach(op => {
                        const opVal = parseToolOption(op);
                        if (opVal) {
                            if (opVal.type == 'definedSymbols') {
                                builderArgs.cMacros = builderArgs.cMacros.concat(opVal.val);
                            }
                            else if (opVal.type == 'includePath') {
                                builderArgs.cIncDirs = builderArgs.cIncDirs.concat(opVal.val);
                            }
                            else {
                                builderArgs.cCompilerArgs = builderArgs.cCompilerArgs.concat(opVal.val);
                            }
                        } else {
                            incompatibleArgs.cCompilerArgs.push(`<${op.$['name']}> = ${op.$['value']}`);
                        }
                    });
                }

                // for asm
                else if (toolOptName.includes('Assembler')) {
                    toArray(toolOpts.option).forEach(op => {
                        const opVal = parseToolOption(op);
                        if (opVal) {
                            if (opVal.type == 'definedSymbols') {
                                builderArgs.sMacros = builderArgs.sMacros.concat(opVal.val);
                            }
                            else if (opVal.type == 'includePath') {
                                builderArgs.sIncDirs = builderArgs.sIncDirs.concat(opVal.val);
                            }
                            else {
                                builderArgs.assemblerArgs = builderArgs.assemblerArgs.concat(opVal.val);
                            }
                        } else {
                            incompatibleArgs.assemblerArgs.push(`<${op.$['name']}> = ${op.$['value']}`);
                        }
                    });
                }

                // for linker
                else if (toolOptName.includes('Linker')) {
                    toArray(toolOpts.option).forEach(op => {
                        const opVal = parseToolOption(op);
                        if (opVal) {
                            if (opVal.type == 'libs' || opVal.type == 'userObjs') {
                                builderArgs.linkerLibArgs = builderArgs.linkerLibArgs.concat(opVal.val);
                            } else {
                                builderArgs.linkerArgs = builderArgs.linkerArgs.concat(opVal.val);
                            }
                        } else {
                            incompatibleArgs.linkerArgs.push(`<${op.$['name']}> = ${op.$['value']}`);
                        }
                    });
                }

                else {
                    // ignore
                }
            }
        }

        if (cTarget.sourceEntries) {
            toArray(cTarget.sourceEntries[0].entry).forEach(e => {

                //<entry flags="VALUE_WORKSPACE_PATH" kind="sourcePath" name="src" />
                if (<string>e.$['kind'] == 'sourcePath') {
                    const srcdir = formatFilePath(e.$['name']);
                    if (srcdir == '.' || srcdir == '') {
                        const srcs = cprojectDir.GetList(SRC_FILE_FILTER, [/^[^\.].+/]);
                        srcs.forEach(src => {
                            if (src.IsFile()) {
                                PROJ_INFO.virtualSource.files.push({ path: src.name });
                            } else {
                                PROJ_INFO.sourceEntries.push(src.name);
                            }
                        });
                    } else {
                        PROJ_INFO.sourceEntries.push(srcdir);
                    }
                }

                (<string>e.$['excluding'] || '')
                    .split('|').filter(s => s.trim() != '')
                    .forEach(p => {
                        tInfo.excList.push(formatFilePath(p));
                    });
            });
        }
    }

    const getVirtualFolder = (rePath: string) => {

        rePath = rePath.trim()
            .replace(/^\//, '')
            .replace(/\/+$/, '')
            .replace(/^\.\/?/, '');

        if (rePath == '' || rePath == '.')
            return PROJ_INFO.virtualSource;

        let curFolder = PROJ_INFO.virtualSource;
        let pathList = rePath.split(/\\|\//).reverse();

        while (pathList.length > 0) {
            let p = pathList.pop();
            if (!p) continue;
            const i = curFolder.folders.findIndex(d => d.name == p);
            if (i != -1) {
                curFolder = curFolder.folders[i];
            } else {
                const nDir: VirtualFolder = {
                    name: p,
                    files: [],
                    folders: [],
                };
                curFolder.folders.push(nDir);
                curFolder = nDir;
            }
        }

        return curFolder;
    };

    const virtualRootList: string[] = [];

    // parse external source
    if (_prjDom.linkedResources) {
        toArray(_prjDom.linkedResources[0].link).forEach(link => {
            if (link.type[0] == '1') { // virtual file
                const vPath = link.name[0].trim();
                if (vPath == '') return;
                const vFolder = getVirtualFolder(NodePath.dirname(vPath));
                const locations = link.locationURI || link.location;
                if (!Array.isArray(locations)) return;
                vFolder.files.push({ path: formatFilePath(locations[0]) });
            } else if (link.type[0] == '2') { // virtual folder
                const vpath = link.name[0].trim();
                const locations: string = link.locationURI || link.location;
                if (!Array.isArray(locations)) return;
                const location: string = locations[0];
                if (typeof location != 'string') return;
                virtualRootList.push(vpath);
                let rootdirpath = formatFilePath(location);
                if (!File.isAbsolute(rootdirpath)) rootdirpath = `${cprojectDir.path}/${rootdirpath}`;
                let vFolder = getVirtualFolder(vpath); // add this folder
                if (File.IsDir(rootdirpath)) {
                    const files = new File(rootdirpath).GetAll(SRC_FILE_FILTER, File.EXCLUDE_ALL_FILTER);
                    const srcRootDir = new File(rootdirpath);
                    files.forEach(f => {
                        let subvpath = vpath;
                        const dirname = srcRootDir.ToRelativePath(f.dir);
                        if (dirname && dirname != '.') subvpath += '/' + dirname;
                        vFolder = getVirtualFolder(subvpath);
                        vFolder.files.push({ path: cprojectDir.ToRelativePath(f.path) || f.path });
                    });
                }
            }
        });
    }

    // del repeat args for every targets
    for (const target of PROJ_INFO.targets) {

        target.excList = ArrayDelRepetition(target.excList);

        // rename virtual exclude paths
        const excli: string[] = [];
        target.excList.forEach(p => {
            if (virtualRootList.includes(p) || virtualRootList.some(e => p.startsWith(e + '/'))) {
                excli.push(`${VirtualSource.rootName}/${p}`);
            } else {
                excli.push(p);
            }
        });

        target.excList = excli;

        for (const key in target.globalArgs) {
            const obj: any = target.globalArgs;
            if (isArray(obj[key])) {
                obj[key] = ArrayDelRepetition(obj[key]);
            }
        }

        for (const pName in target.incompatibleArgs) {
            const obj = <any>target.incompatibleArgs[pName];
            for (const key in obj) {
                if (isArray(obj[key])) {
                    obj[key] = ArrayDelRepetition(obj[key]);
                }
            }
        }
    }

    return PROJ_INFO;
}

function parseToolOption(optionObj: any): { type: string, val: string[] } | undefined {

    if (optionObj.$['valueType'] == undefined)
        return;

    if (optionObj.$['id']) {
        // skip output args
        if (['.converthex', '.convertbin', '.convert']
            .some(s => optionObj.$['id'].includes(s))) {
            return;
        }
    }

    //--

    const VALUE_NAME: string = optionObj.$['name'] || '';
    const VALUE_VAL: string = optionObj.$['value'] || '';
    const VALUE_TYPE: string = optionObj.$['valueType'];

    let makeResult = (value: string | string[]): { type: string, val: string[] } | undefined => {
        if (value == '') return undefined;
        if (isArray(value) && value.length == 0) return undefined;
        return {
            type: VALUE_TYPE,
            val: isArray(value) ? value : [value]
        };
    };

    let formatArgs = (fmt: string, arg: string): string => {

        if (fmt.includes('[option]')) {
            return fmt.replace('[option]', arg);
        }

        return fmt + arg;
    }

    if (VALUE_TYPE == 'boolean') {
        if (VALUE_VAL == 'true') {
            const mRes = /\((\-.+)\)/.exec(VALUE_NAME);
            if (mRes && mRes.length > 1) {
                return makeResult(mRes[1]);
            }
        }
    }

    else if (VALUE_TYPE == 'definedSymbols') {
        const li: string[] = [];
        toArray(optionObj.listOptionValue).forEach(item => li.push(item.$['value']));
        return makeResult(li);
    }

    else if (VALUE_TYPE == 'includePath') {
        const li: string[] = [];
        toArray(optionObj.listOptionValue).forEach(item => {
            let p = formatFilePath(item.$['value']);
            if (p == '..') p = '.';
            if (p.startsWith('../')) p = p.substr(3); // for eclipse, include path is base 'Debug' folder
            li.push(p);
        });
        return makeResult(li);
    }

    else if (VALUE_TYPE == 'string') {
        const mRes = /\((\-.+)\)/.exec(VALUE_NAME);
        if (mRes && mRes.length > 1) {
            const fmt = mRes[1];
            const arg = formatArgs(fmt, formatFilePath(VALUE_VAL));
            return makeResult(arg);
        }
        else if (VALUE_VAL.startsWith('-')) {
            return makeResult(VALUE_VAL);
        }
    }

    else if (VALUE_TYPE == 'stringList') {
        const mRes = /\((\-.+)\)/.exec(VALUE_NAME);
        if (mRes && mRes.length > 1) {
            const fmt = mRes[1];
            const li: string[] = [];
            toArray(optionObj.listOptionValue).forEach(item => li.push(formatArgs(fmt, formatFilePath(item.$['value']))));
            return makeResult(li);
        } else {
            const li: string[] = [];
            toArray(optionObj.listOptionValue).forEach(item => li.push(formatFilePath(item.$['value'])));
            return makeResult(li);
        }
    }

    else if (VALUE_TYPE == 'libs') {
        const r: string[] = [];
        toArray(optionObj.listOptionValue).forEach(item => r.push(`-l${item.$['value']}`));
        return makeResult(r);
    }

    else if (VALUE_TYPE == 'userObjs') {
        const r: string[] = [];
        toArray(optionObj.listOptionValue).forEach(item => r.push(formatFilePath(item.$['value'])));
        return makeResult(r);
    }
}

function toArray(obj: any): any[] {
    if (obj == undefined || obj == null) return [];
    if (!isArray(obj)) return [obj];
    return obj;
}

function detectProjectType(toolChain: any): EclipseProjectType | undefined {

    const toolName = toolChain.$['name'];

    if (/\bARM\b/i.test(toolName)) {
        return 'arm';
    }

    if (/\b(RISCV|RISC-V)\b/i.test(toolName)) {
        return 'riscv';
    }

    if (/\bSDCC\b/i.test(toolName)) {
        return 'sdcc';
    }
}

function getChild(chLi: any[], filter: (node: any) => boolean): any {
    const i = chLi.findIndex(filter);
    if (i == -1) return undefined;
    return chLi[i];
}
