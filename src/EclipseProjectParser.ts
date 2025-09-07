import * as fs from 'fs';
import * as NodePath from 'path';
import * as os from 'os';
import * as xml2js from 'xml2js';
import { VirtualFolder } from './EIDETypeDefine';
import { VirtualSource, AbstractProject } from './EIDEProject';
import { isArray } from 'util';
import { ArrayDelRepetition } from '../lib/node-utility/Utility';
import { File } from '../lib/node-utility/File';
import { GlobalEvent } from './GlobalEvents';

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

    // "level-0", "level-1", "level-2", "level-3", "level-size", "level-size-Oz", "level-fast", "level-debug"
    optimization: string;
    // "c89", "c90", "c99", "c11", "c17", "c23", "gnu89", "gnu90", "gnu99", "gnu11", "gnu17", "gnu23"
    cLanguageStd: string;
    // "c++98", "gnu++98", "c++11", "gnu++11", "c++14", "gnu++14", "c++17", "gnu++17", "c++20", "gnu++20", "c++23", "gnu++23"
    cppLanguageStd: string;
    // Signed Char (-fsigned-char)
    signedChar: boolean;

    globalArgs: string[];

    cIncDirs: string[];
    cMacros: string[];
    cCompilerArgs: string[];

    sIncDirs: string[];
    sMacros: string[];
    assemblerArgs: string[];

    linkerArgs: string[];
    linkerLibArgs: string[];
    linkerLibSearchDirs: string[];
}

export interface EclipseProjectTarget {
    name: string;
    excList: string[];
    builldArgs: EclipseBuilderArgs;
    sourceArgs: { [path: string]: EclipseBuilderArgs };
    archName?: string;
    linkerScriptPath?: string;
    objsOrder: string[];
}

function newEclipseBuilderArgs(): EclipseBuilderArgs {
    return {
        optimization: 'level-debug',
        cLanguageStd: 'c11',
        cppLanguageStd: 'c++11',
        signedChar: false,
        globalArgs: [],
        cIncDirs: [],
        cMacros: [],
        cCompilerArgs: [],
        sIncDirs: [],
        sMacros: [],
        assemblerArgs: [],
        linkerArgs: [],
        linkerLibArgs: [],
        linkerLibSearchDirs: []
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
        .replace('${PROJECT_LOC}/', '');

    // remove leading and tailing '"'
    if (path.charAt(0) == '"' && path.charAt(path.length - 1) == '"')
        path = path.substr(1, path.length - 2);
    // conv ${workspace_loc:/xxx} to xxx
    if (path.startsWith('${workspace_loc:/') && path.charAt(path.length - 1) == '}')
        path = path.substr(17, path.length - 18);
    // remove tailing '/'
    path = path.replace(/\/+$/, '');

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

    GlobalEvent.log_info(`[EclipseParser] start parsing ${cprojectPath} ...`);

    const root_virtualsrcs: string[] = [];
    const root_srcdirs: string[] = [];
    const eclipseTargetList: string[] = [];

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

        eclipseTargetList.push(cTarget.$['name']);

        const tInfo: EclipseProjectTarget = {
            name: cTarget.$['name'].replace(/\s+/g, '_'),
            excList: [],
            builldArgs: newEclipseBuilderArgs(),
            sourceArgs: {},
            objsOrder: []
        };

        PROJ_INFO.targets.push(tInfo);

        GlobalEvent.log_info(`[EclipseParser] target: "${cTarget.$['name']}"`);

        for (const resourceInfo of toArray(cTarget.folderInfo).concat(toArray(cTarget.fileInfo))) {

            const folderPath = formatFilePath(resourceInfo.$['resourcePath'] || '').trim();
            const isRootResource = folderPath == '';

            let builderArgs = tInfo.builldArgs;
            if (folderPath) {
                tInfo.sourceArgs[folderPath] = newEclipseBuilderArgs();
                builderArgs = tInfo.sourceArgs[folderPath];
            }

            const toolchainInfo = resourceInfo.toolChain ? resourceInfo.toolChain[0] : resourceInfo;

            if (isRootResource && PROJ_INFO.type == 'gcc') {
                PROJ_INFO.type = detectProjectType(toolchainInfo) || 'gcc';
            }

            for (const globOpts of toArray(toolchainInfo['option'])) {
                const opVal = parseToolOption(globOpts, PROJ_INFO.type);
                if (opVal) {
                    if (opVal.type == 'linkerScriptPath') {
                        if (isRootResource)
                            tInfo.linkerScriptPath = opVal.val.join(',');
                    } else if (opVal.type == 'archName') {
                        if (isRootResource)
                            tInfo.archName = opVal.val[0];
                    } else if (opVal.type == 'linkerLibSearchDirs') {
                        if (isRootResource)
                            builderArgs.linkerLibSearchDirs = opVal.val;
                    } else if (opVal.type == 'optimization') {
                        if (isRootResource)
                            builderArgs.optimization = opVal.val[0];
                    } else if (opVal.type == 'cLanguageStd') {
                        if (isRootResource)
                            builderArgs.cLanguageStd = opVal.val[0];
                    } else if (opVal.type == 'signedChar') {
                        if (isRootResource)
                            builderArgs.signedChar = opVal.val[0] == 'true';
                    } else if (opVal.type == '<ignored>') {
                        GlobalEvent.log_info(`[EclipseParser] skip option "${opVal.val[0]}" of path "${folderPath}"`);
                    } else {
                        builderArgs.globalArgs = builderArgs.globalArgs.concat(opVal.val);
                    }
                } else {
                    GlobalEvent.log_info(
                        `[EclipseParser] unknown option "${globOpts.$['name'] || globOpts.$['id']}" of path "${folderPath}"`);
                }
            }

            for (const toolOpts of toArray(toolchainInfo['tool'])) {

                const toolOptName: string = toolOpts.$['name'] || '';

                // for c/c++
                if (toolOptName.includes('C Compiler')) {
                    toArray(toolOpts.option).forEach(op => {
                        const opVal = parseToolOption(op, PROJ_INFO.type);
                        if (opVal) {
                            if (opVal.type == 'linkerScriptPath') {
                                if (isRootResource)
                                    tInfo.linkerScriptPath = opVal.val.join(',');
                            } else if (opVal.type == 'archName') {
                                if (isRootResource)
                                    tInfo.archName = opVal.val[0];
                            } else if (opVal.type == 'definedSymbols') {
                                builderArgs.cMacros = builderArgs.cMacros.concat(opVal.val);
                            } else if (opVal.type == 'includePath') {
                                builderArgs.cIncDirs = builderArgs.cIncDirs.concat(opVal.val);
                            } else if (opVal.type == 'optimization') {
                                builderArgs.optimization = opVal.val[0];
                            } else if (opVal.type == 'cLanguageStd') {
                                builderArgs.cLanguageStd = opVal.val[0];
                            } else if (opVal.type == 'signedChar') {
                                builderArgs.signedChar = opVal.val[0] == 'true';
                            } else if (opVal.type == '<ignored>') {
                                GlobalEvent.log_info(`[EclipseParser] skip option "${opVal.val[0]}" of path "${folderPath}"`);
                            } else {
                                builderArgs.cCompilerArgs = builderArgs.cCompilerArgs.concat(opVal.val);
                            }
                        } else {
                            GlobalEvent.log_info(
                                `[EclipseParser] unknown option "${op.$['name'] || op.$['id']}" of path "${folderPath}"`);
                        }
                    });
                }

                // for asm
                else if (toolOptName.includes('Assembler')) {
                    toArray(toolOpts.option).forEach(op => {
                        const opVal = parseToolOption(op, PROJ_INFO.type);
                        if (opVal) {
                            if (opVal.type == 'definedSymbols') {
                                builderArgs.sMacros = builderArgs.sMacros.concat(opVal.val);
                            } else if (opVal.type == 'includePath') {
                                builderArgs.sIncDirs = builderArgs.sIncDirs.concat(opVal.val);
                            } else if (opVal.type == '<ignored>') {
                                GlobalEvent.log_info(`[EclipseParser] skip option "${opVal.val[0]}" of path "${folderPath}"`);
                            } else {
                                builderArgs.assemblerArgs = builderArgs.assemblerArgs.concat(opVal.val);
                            }
                        } else {
                            GlobalEvent.log_info(
                                `[EclipseParser] unknown option "${op.$['name'] || op.$['id']}" of path "${folderPath}"`);
                        }
                    });
                }

                // for linker
                else if (toolOptName.includes('C Linker')) {
                    toArray(toolOpts.option).forEach(op => {
                        const opVal = parseToolOption(op, PROJ_INFO.type);
                        if (opVal) {
                            if (opVal.type == 'linkerScriptPath') {
                                if (isRootResource)
                                    tInfo.linkerScriptPath = opVal.val.join(',');
                            } else if (opVal.type == 'archName') {
                                if (isRootResource)
                                    tInfo.archName = opVal.val[0];
                            } else if (opVal.type == 'objsOrder') {
                                if (isRootResource)
                                    tInfo.objsOrder = tInfo.objsOrder.concat(opVal.val);
                            } else if (opVal.type == 'libs' || opVal.type == 'userObjs') {
                                builderArgs.linkerLibArgs = builderArgs.linkerLibArgs.concat(opVal.val);
                            } else if (opVal.type == 'linkerLibSearchDirs') {
                                builderArgs.linkerLibSearchDirs = builderArgs.linkerLibSearchDirs.concat(opVal.val);
                            } else if (opVal.type == '<ignored>') {
                                GlobalEvent.log_info(`[EclipseParser] skip option "${opVal.val[0]}" of path "${folderPath}"`);
                            } else {
                                builderArgs.linkerArgs = builderArgs.linkerArgs.concat(opVal.val);
                            }
                        } else {
                            GlobalEvent.log_info(
                                `[EclipseParser] unknown option "${op.$['name'] || op.$['id']}" of path "${folderPath}"`);
                        }
                    });
                }

                else {
                    // ignore
                }
            }
        }

        if (Array.isArray(cTarget.sourceEntries) && typeof cTarget.sourceEntries[0] == 'object') {

            toArray(cTarget.sourceEntries[0].entry).forEach(e => {

                //<entry flags="VALUE_WORKSPACE_PATH" kind="sourcePath" name="src" />
                if (<string>e.$['kind'] == 'sourcePath') {
                    const srcdir = formatFilePath(e.$['name']);
                    if (srcdir == '.' || srcdir == '') {
                        const srcs = cprojectDir.GetList(SRC_FILE_FILTER, [/^[^\.].+/]);
                        srcs.forEach(src => {
                            if (src.IsFile()) {
                                root_virtualsrcs.push(src.name);
                            } else {
                                root_srcdirs.push(src.name);
                            }
                        });
                    } else {
                        root_srcdirs.push(srcdir);
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

    // setup root sources
    ArrayDelRepetition(root_virtualsrcs).forEach(srcpath => {
        PROJ_INFO.virtualSource.files.push({ path: srcpath });
    });
    ArrayDelRepetition(root_srcdirs).forEach(srcdir => {
        if (eclipseTargetList.includes(srcdir)) return; // skip eclipse build dir
        PROJ_INFO.sourceEntries.push(srcdir);
    });

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
    const virtualRootMap: { [vpath: string]: string } = {};

    // parse external source
    if (_prjDom.linkedResources && typeof _prjDom.linkedResources[0] == 'object') {
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
                const rootdirpath_ = formatFilePath(location);
                let rootdirfullpath = rootdirpath_;
                if (!File.isAbsolute(rootdirpath_)) rootdirfullpath = `${cprojectDir.path}/${rootdirpath_}`;
                let vFolder = getVirtualFolder(vpath); // add this folder
                if (File.IsDir(rootdirfullpath)) {
                    virtualRootMap[vpath] = File.ToUnixPath(rootdirpath_);
                    const files = new File(rootdirfullpath).GetAll(SRC_FILE_FILTER, File.EXCLUDE_ALL_FILTER);
                    const srcRootDir = new File(rootdirfullpath);
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

    const completeVirtualPaths = (pathlist: string[]): string[] => {
        return pathlist.map(p => {
            if (virtualRootList.includes(p) || virtualRootList.some(e => p.startsWith(e + '/'))) {
                return `${VirtualSource.rootName}/${p}`;
            } else {
                return p;
            }
        });
    };

    const resolveVirtualPaths = (pathlist: string[]): string[] => {
        return pathlist.map(p => {
            for (const rootpath of virtualRootList) {
                if ((rootpath == p || p.startsWith(rootpath + '/')) && virtualRootMap[rootpath]) {
                    return p.replace(rootpath, virtualRootMap[rootpath]);
                }
            }
            return p;
        });
    };

    // del repeat args for every targets
    for (const target of PROJ_INFO.targets) {

        // add prefix for virtual exclude paths
        target.excList = completeVirtualPaths(ArrayDelRepetition(target.excList));

        // resolve virtual include paths
        target.builldArgs.cIncDirs = resolveVirtualPaths(target.builldArgs.cIncDirs);
        target.builldArgs.sIncDirs = resolveVirtualPaths(target.builldArgs.sIncDirs);

        for (const key in target.builldArgs) {
            const obj: any = target.builldArgs;
            if (isArray(obj[key])) {
                obj[key] = ArrayDelRepetition(obj[key]);
            }
        }
    }

    GlobalEvent.log_info(`[EclipseParser] parse done.`);
    return PROJ_INFO;
}

function parseToolOption(optionObj: any, prjtype: EclipseProjectType): { type: string, val: string[] } | undefined {

    if (!optionObj.$['id'])
        return { type: '<ignored>', val: [optionObj.$['name'] || 'noid'] };

    //--

    const VALUE_ID: string = optionObj.$['id'];
    const VALUE_NAME: string = optionObj.$['name'] || '';
    const VALUE_VALS: string[] = [];
    const VALUE_TYPE: string | undefined = optionObj.$['valueType'];
    const IGNORED_VAL = { type: '<ignored>', val: [VALUE_NAME || VALUE_ID] };

    const makeResult = (value: string | string[], typ?: string): { type: string, val: string[] } | undefined => {
        if (value == '') return undefined;
        if (isArray(value) && value.length == 0) return undefined;
        return {
            type: typ || VALUE_TYPE || '',
            val: isArray(value) ? value : [value]
        };
    };

    const formatArgs = (fmt: string, arg: string): string => {
        if (fmt.includes('[option]'))
            return fmt.replace('[option]', arg);
        return fmt + arg;
    }

    const cLangStds = [ "c89", "c90", "c99", "c11", "c17", "c23", "gnu89", "gnu90", "gnu99", "gnu11", "gnu17", "gnu23" ];

    // ----
    // parse special type values
    // ----

    if (VALUE_TYPE == 'definedSymbols') {
        toArray(optionObj.listOptionValue)
            .forEach(item => VALUE_VALS.push(item.$['value']));
        return makeResult(VALUE_VALS, 'definedSymbols');
    } else if (VALUE_TYPE == 'includePath') {
        toArray(optionObj.listOptionValue).forEach(item => {
            let p = formatFilePath(item.$['value']);
            if (p == '..') p = '.';
            if (p.startsWith('../')) p = p.substr(3); // for eclipse, include path is base 'Debug' folder
            VALUE_VALS.push(p);
        });
        return makeResult(VALUE_VALS, 'includePath');
    } else if (VALUE_TYPE == 'libPaths') {
        toArray(optionObj.listOptionValue).forEach(item => {
            let p = formatFilePath(item.$['value']);
            if (p == '..') p = '.';
            if (p.startsWith('../')) p = p.substr(3); // for eclipse, include path is base 'Debug' folder
            VALUE_VALS.push(p);
        });
        return makeResult(VALUE_VALS, 'linkerLibSearchDirs');
    } else if (VALUE_TYPE == 'libs') {
        toArray(optionObj.listOptionValue)
            .forEach(item => VALUE_VALS.push(`-l${item.$['value']}`));
        return makeResult(VALUE_VALS, 'libs');
    } else if (VALUE_TYPE == 'userObjs') {
        toArray(optionObj.listOptionValue)
            .forEach(item => VALUE_VALS.push(formatFilePath(item.$['value'])));
        return makeResult(VALUE_VALS, 'userObjs');
    }

    // ----
    // parse generic type values
    // ----

    if (VALUE_TYPE == 'boolean') {
        VALUE_VALS.push(optionObj.$['value'] || 'false');
    } else if (VALUE_TYPE == 'stringList') {
        toArray(optionObj.listOptionValue)
            .forEach(item => VALUE_VALS.push(formatFilePath(item.$['value'])));
    } else { // string or enums
        const val = optionObj.$['value']?.trim() || '';
        VALUE_VALS.push(formatFilePath(val));
    }

    if (VALUE_VALS.length == 0)
        return IGNORED_VAL;

    // ----
    // Eclipse Generic
    // ----

    if (VALUE_NAME.includes('(-D)') || /Defined symbols/i.test(VALUE_NAME)) {
        const li: string[] = [];
        toArray(optionObj.listOptionValue).forEach(item => li.push(item.$['value']));
        return makeResult(li, 'definedSymbols');
    }
    if (VALUE_NAME.includes('(-I)') || VALUE_ID.includes('include.paths')) {
        const li: string[] = [];
        toArray(optionObj.listOptionValue).forEach(item => {
            let p = formatFilePath(item.$['value']);
            if (p == '..') p = '.';
            if (p.startsWith('../')) p = p.substr(3); // for eclipse, include path is base 'Debug' folder
            li.push(p);
        });
        return makeResult(li, 'includePath');
    }
    // ilg.gnuarmeclipse.managedbuild.cross.option.c.linker.scriptfile
    if (VALUE_ID.includes('linker.script')) {
        return makeResult(VALUE_VALS, 'linkerScriptPath');
    }
    // ilg.gnuarmeclipse.managedbuild.cross.option.optimization.level = optimization.level.debug
    if (VALUE_ID.includes('optimization.level')) {
        if (/level\.none/.test(VALUE_VALS[0])) {
            return makeResult(`level-0`, 'optimization');
        } else if (/level\.debug/.test(VALUE_VALS[0])) {
            return makeResult(`level-debug`, 'optimization');
        } else if (/level\.optimize/.test(VALUE_VALS[0])) {
            return makeResult(`level-1`, 'optimization');
        } else if (/level\.more/.test(VALUE_VALS[0])) {
            return makeResult(`level-2`, 'optimization');
        } else if (/level\.most/.test(VALUE_VALS[0])) {
            return makeResult(`level-3`, 'optimization');
        } else if (/level\.size/.test(VALUE_VALS[0])) {
            return makeResult(`level-size`, 'optimization');
        } else {
            return IGNORED_VAL;
        }
    }
    // linker.nostdlibs = false
    if (VALUE_ID.includes('linker.nostdlibs')) {
        if (VALUE_VALS[0] === 'true')
            return makeResult(`-nostdlib`, 'string');
        return IGNORED_VAL;
    }
    // arm.target.family
    if (VALUE_ID.includes('arm.target.family')) {
        const m = /\.(cortex-m\w+)/.exec(VALUE_VALS[0]);
        if (m && m.length > 1)
            return makeResult(m[1], 'archName');
        return IGNORED_VAL;
    }
    // option.c.linker.paths
    if (VALUE_ID.includes('option.c.linker.paths')) {
        toArray(optionObj.listOptionValue).forEach(item => {
            let p = formatFilePath(item.$['value']);
            if (p == '..') p = '.';
            if (p.startsWith('../')) p = p.substr(3); // for eclipse, include path is base 'Debug' folder
            VALUE_VALS.push(p);
        });
        return makeResult(VALUE_VALS, 'linkerLibSearchDirs');
    }
    // optimization.signedchar
    if (VALUE_ID.includes('optimization.signedchar')) {
        if (VALUE_VALS[0] === 'true')
            return makeResult('true', 'signedChar');
        return IGNORED_VAL;
    }
    // option.warnings.extrawarn
    if (VALUE_ID.includes('option.warnings.extrawarn')) {
        if (VALUE_VALS[0] === 'true')
            return makeResult(`-Wextra`, 'string');
        return IGNORED_VAL;
    }
    // option.warnings.allwarn
    if (VALUE_ID.includes('option.warnings.allwarn')) {
        if (VALUE_VALS[0] === 'true')
            return makeResult(`-Wall`, 'string');
        return IGNORED_VAL;
    }
    // option.c.compiler.otherwarnings
    if (VALUE_ID.includes('option.c.compiler.otherwarnings')) {
        if (VALUE_VALS[0])
            return makeResult(VALUE_VALS[0], 'string');
        return IGNORED_VAL;
    }
    // option.c.linker.nostart
    if (VALUE_ID.includes('option.c.linker.nostart')) {
        if (VALUE_VALS[0] === 'true')
            return makeResult(`-nostartfiles`, 'string');
        return IGNORED_VAL;
    }
    // ignore these options
    if (VALUE_NAME.includes('-fno-rtti') || 
        VALUE_NAME.includes('-fno-use-cxa-atexit') || 
        VALUE_NAME.includes('-fno-threadsafe-statics') ||
        VALUE_NAME.includes('-ffunction-sections') ||
        VALUE_NAME.includes('-fdata-sections') ||
        VALUE_NAME.includes('--gc-sections')) {
        return IGNORED_VAL;
    }

    // ----
    // silabs
    // ----

    // <Short enums (-fshort-enums)> = false
    if (VALUE_ID.includes('optimization.shortenums')) {
        const v = VALUE_VALS[0];
        if (v === "true")
            return makeResult(`-fshort-enums`, 'string');
        return IGNORED_VAL;
    }
    // <Language Standard> = option.std.gnu99
    // compiler.misc.dialect = com.silabs.ide.si32.gcc.cdt.managedbuild.tool.gnu.c.compiler.misc.dialect.c99
    if (/Language (?:Standard|Dialect)/i.test(VALUE_NAME)) {
        let m = /std\.(\w+)/.exec(VALUE_VALS[0]);
        if (m && m.length > 1) {
            const langStd = m[1];
            if (cLangStds.includes(langStd))
                return makeResult(langStd, 'cLanguageStd');
        }
        m = /dialect\.(\w+)/.exec(VALUE_VALS[0]);
        if (m && m.length > 1) {
            const langStd = m[1];
            if (cLangStds.includes(langStd))
                return makeResult(langStd, 'cLanguageStd');
        }
        return IGNORED_VAL;
    }
    // <Linker input ordering> = ./platform/Device/SiliconLabs/EFR32BG22/Source/GCC/startup_efr32bg22.o;
    if (VALUE_NAME.trim() == 'Linker input ordering') {
        const paths = VALUE_VALS[0].split(';')
            .filter(p => p.trim() !== '')
            .map(p => '**/' + formatFilePath(p).replace(/^\.\//, ''));
        if (paths.length == 0)
            return IGNORED_VAL;
        return makeResult(paths.slice(0, Math.min(5, paths.length)), 'objsOrder');
    }
    if (prjtype == 'arm') {
        if (VALUE_NAME.includes('--specs=nano.specs') ||
            VALUE_NAME.includes('--specs=nosys.specs'))
            return IGNORED_VAL;
    }

    // ----
    // STM32CubeIDE
    // ----

    // value="STM32F407VGTx" valueType="string"
    if (VALUE_ID.includes('com.st.stm32cube.ide.mcu.gnu.managedbuild.option.target_mcu')) {
        const mcuName = VALUE_VALS[0].toLowerCase();
        if (/stm32f0/.test(mcuName))
            return makeResult('cortex-m0', 'archName');
        else if (/stm32(g0|c0|l0|u0)/.test(mcuName))
            return makeResult('cortex-m0+', 'archName');
        else if (/stm32(f1|f2|l1)/.test(mcuName))
            return makeResult('cortex-m3', 'archName');
        else if (/stm32(f4|g4|f3|l4|wb[0-9]|wl)/.test(mcuName))
            return makeResult('cortex-m4', 'archName');
        else if (/stm32(h5|u5|u3|l5|wba)/.test(mcuName))
            return makeResult('cortex-m33', 'archName');
        else if (/stm32(h7|f7)/.test(mcuName))
            return makeResult('cortex-m7', 'archName');
        return IGNORED_VAL;
    }

    // value="${workspace_loc:/${ProjName}/STM32F407VGTX_FLASH.ld}" valueType="string"
    if (VALUE_ID.includes('com.st.stm32cube.ide.mcu.gnu.managedbuild.tool.c.linker.option.script')) {
        if (VALUE_VALS[0])
            return makeResult(formatFilePath(VALUE_VALS[0]), 'linkerScriptPath');
    }

    // ----
    // match (-xxx) options by types
    // ----

    if (VALUE_TYPE == 'boolean') {
        if (VALUE_VALS[0] == 'true') {
            const mRes = /\((\-.+)\)/.exec(VALUE_NAME);
            if (mRes && mRes.length > 1) {
                return makeResult(mRes[1]);
            }
        }
    }
    if (VALUE_TYPE == 'string') {
        const mRes = /\((\-.+)\)/.exec(VALUE_NAME);
        if (mRes && mRes.length > 1) {
            const fmt = mRes[1];
            const arg = formatArgs(fmt, formatFilePath(VALUE_VALS[0]));
            return makeResult(arg);
        } else if (VALUE_VALS[0].startsWith('-')) {
            return makeResult(VALUE_VALS[0]);
        }
    }
    if (VALUE_TYPE == 'stringList') {
        const mRes = /\((\-.+)\)/.exec(VALUE_NAME);
        if (mRes && mRes.length > 1) {
            const fmt = mRes[1];
            const li: string[] = [];
            toArray(optionObj.listOptionValue)
                .forEach(item => li.push(formatArgs(fmt, formatFilePath(item.$['value']))));
            return makeResult(li);
        } else {
            const li: string[] = [];
            toArray(optionObj.listOptionValue)
                .forEach(item => li.push(formatFilePath(item.$['value'])));
            return makeResult(li);
        }
    }

    return IGNORED_VAL;
}

function toArray(obj: any): any[] {
    if (obj == undefined || obj == null) return [];
    if (!isArray(obj)) return [obj];
    return obj;
}

function detectProjectType(toolChain: any): EclipseProjectType | undefined {

    const toolId   = toolChain.$['id'];
    const toolName = toolChain.$['name'] || toolId;

    // <toolChain id="ilg.gnuarmeclipse.managedbuild.cross.toolchain.elf.debug.1201710416" name="ARM Cross GCC"
    if (/\bARM\b/.test(toolName) || /gnuarmeclipse/.test(toolId)) {
        return 'arm';
    }

    // <toolChain id="ilg.gnumcueclipse.managedbuild.cross.riscv.toolchain.elf.release.231146001" name="RISC-V Cross GCC…
    if (/\b(RISCV|RISC-V)\b/.test(toolName) || /\.riscv\./.test(toolId)) {
        return 'riscv';
    }

    // <toolChain errorParsers="" id="cdt.managedbuild.toolchain.sdcc.exe.release.1956586716" name="SDCC Tool Chain" 
    if (/\bSDCC\b/.test(toolName) || /\.sdcc\./.test(toolId)) {
        return 'sdcc';
    }
}

function getChild(chLi: any[], filter: (node: any) => boolean): any {
    const i = chLi.findIndex(filter);
    if (i == -1) return undefined;
    return chLi[i];
}
