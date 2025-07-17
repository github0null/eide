import * as fs from 'fs';
import * as NodePath from 'path';
import * as os from 'os';
import * as xml2js from 'xml2js';
import * as ini from 'ini';
import { VirtualFolder } from './EIDETypeDefine';
import { VirtualSource, AbstractProject } from './EIDEProject';
import { isArray } from 'util';
import { ArrayDelRepetition } from '../lib/node-utility/Utility';
import { File } from '../lib/node-utility/File';
import { GlobalEvent } from './GlobalEvents';
import { ExceptionToMessage } from './Message';
import * as utility from './utility';

export interface IarProjectTarget {

    name: string;

    core?: string;

    chipname?: string;

    chipi79db?: any;

    settings: { [name: string]: string | string[] };

    icfPath: string; // if have multi files, use ',' as sep char

    builderActions: {
        prebuild?: string;
        postbuild?: string;
    };

    excludeList: string[];
}

export interface IarProjectInfo {

    name: string;

    envs: { [name: string]: string };

    targets: { [name: string]: IarProjectTarget };

    fileGroups: VirtualFolder;
}

export interface IarWorkbenchInfo {

    name: string;

    rootPath: string;

    envs: { [name: string]: string };

    projects: { [path: string]: IarProjectInfo };
}

export async function parseIarWorkbench(ewwFile: File, iarToolchainRoot: File): Promise<IarWorkbenchInfo> {

    const result: IarWorkbenchInfo = {
        name: ewwFile.noSuffixName,
        rootPath: ewwFile.dir,
        envs: {},
        projects: {}
    };

    const resolveEnv = (str: string, envs?: { [name: string]: string }): string => {

        let _env: { [name: string]: string } = {
            'PROJ_DIR': '.',
            'CUR_DIR': '.',
            'EW_DIR': ewwFile.dir,
            'WS_DIR': ewwFile.dir,
            'USER_NAME': os.userInfo().username,
            'ToolchainRoot': iarToolchainRoot.path
        };

        for (const key in envs || result.envs) {
            _env[key] = result.envs[key];
        }

        for (let index = 0; index < 5; index++) {
            for (const key in _env) {
                if (!isValidEnvName(key)) continue;
                const pattern = new RegExp('\\$' + key + '\\$', 'g');
                str = str.replace(pattern, _env[key]);
            }
        }

        return str;
    };

    //
    // parse envs
    //
    const cusEnvFile = File.fromArray([ewwFile.dir, ewwFile.noSuffixName + '.custom_argvars']);
    if (cusEnvFile.IsFile()) {
        const envDom = (await xml2js.parseStringPromise(fs.readFileSync(cusEnvFile.path).toString()))['iarUserArgVars'];
        toArray(envDom['group']).forEach(groupNode => {
            if (groupNode.$['active'] == 'true') {
                toArray(groupNode['variable']).forEach(var_ => {
                    const name = var_.name[0].trim();
                    const valu = var_.value[0].trim();
                    if (isValidEnvName(name)) {
                        result.envs[name] = formatEnvNameAndPathSep(valu); // do not resolve nested vars
                    }
                });
            }
        });
    }

    //
    // parse workspace
    //

    const ewwDom = (await xml2js.parseStringPromise(
        fs.readFileSync(ewwFile.path).toString()))['workspace'];

    const ewpFiles: string[] = toArray(ewwDom.project)
        .map(n => resolveEnv(n.path[0] || ''))
        .filter(p => p != '');

    //
    // parse each projects
    //

    for (const prjpath of ewpFiles) {

        const prjdom = (await xml2js.parseStringPromise(
            fs.readFileSync(prjpath).toString()))['project'];

        const project: IarProjectInfo = {
            name: new File(prjpath).noSuffixName,
            envs: utility.copyObject(result.envs),
            targets: {},
            fileGroups: {
                name: VirtualSource.rootName,
                folders: [],
                files: []
            }
        };

        result.projects[prjpath] = project;

        project.envs['PROJ_NAME'] = project.name;
        project.envs['PROJ_PATH'] = prjpath;
        project.envs['PROJ_DIR'] = NodePath.dirname(prjpath);
        project.envs['PROJ_FNAME'] = NodePath.basename(prjpath);

        toArray(prjdom['configuration']).forEach(tnode => parseTarget(project, tnode));

        parseFileGroup(project, prjdom, project.fileGroups, project.fileGroups.name);

        // try get chip info from devices database
        for (const tname in project.targets) {
            const target = project.targets[tname];
            if (typeof target.settings['General.GFPUDeviceSlave'] == 'string') {
                const rawName = target.settings['General.GFPUDeviceSlave'];
                const chipInf = tryGetIarChipInfo(iarToolchainRoot, rawName);
                if (chipInf) {
                    target.chipi79db = chipInf;
                    target.chipname = chipInf['CHIP'].name;
                    target.core = chipInf['CORE'].name;
                }
            }
        }

        // fill other project attrs
        for (const tname in project.targets) {
            const target = project.targets[tname];
            // icf path
            if (target.settings['ILINK.IlinkIcfOverride'] == '1') {
                target.icfPath = toArray(target.settings['ILINK.IlinkIcfFile'])
                    .map(p => formatEnvNameAndPathSep(p))
                    .join(',');
            } else if (target.chipi79db) { // use sys def
                target.icfPath = formatEnvNameAndPathSep(target.chipi79db['LINKER FILE'].name);
            }
            // dev name
            if (target.chipname) {
                project.envs['DEVICE'] = target.chipname;
            }
        }
    }

    return result;
}

function parseTarget(proj: IarProjectInfo, configNodes: any) {

    const nTarget: IarProjectTarget = {
        name: configNodes.name[0].trim(),
        settings: {},
        excludeList: [],
        icfPath: 'unknown',
        builderActions: {}
    };

    proj.targets[nTarget.name] = nTarget;

    if (configNodes.toolchain == undefined ||
        configNodes.toolchain[0].name[0] != 'ARM') {
        const t = configNodes.toolchain[0].name[0];
        throw new Error(`We only support 'ARM' project for IAR, but your project type is '${t}'`);
    }

    toArray(configNodes['settings']).forEach(settingRoot => {
        const settingName = settingRoot.name[0].trim();
        if (settingRoot.data) {
            const dataNode = settingRoot.data[0];
            // options
            toArray(dataNode.option).forEach(optItem => {
                const name = optItem.name[0].trim();
                const vaLi = toArray(optItem.state)
                    .map(v => formatEnvNameAndPathSep(v.trim()))
                    .filter(v => v != '');
                if (vaLi.length == 1) {
                    nTarget.settings[`${settingName}.${name}`] = vaLi[0];
                } else if (vaLi.length > 1) {
                    nTarget.settings[`${settingName}.${name}`] = vaLi;
                }
            });
            // builder action
            if (settingName == 'BUILDACTION') {
                if (isArray(dataNode.prebuild)) {
                    nTarget.builderActions.prebuild =
                        formatEnvNameAndPathSep(dataNode.prebuild[0]);
                }
                if (isArray(dataNode.postbuild)) {
                    nTarget.builderActions.postbuild =
                        formatEnvNameAndPathSep(dataNode.postbuild[0]);
                }
            }
        }
    });
};

function parseFileGroup(proj: IarProjectInfo, curGroup: any,
    curFolder: VirtualFolder, curPath: string) {

    toArray(curGroup['file']).forEach(fnode => {
        const srcpath = formatEnvNameAndPathSep(fnode.name[0].trim());
        curFolder.files.push({ path: srcpath });
        if (fnode.excluded) {
            const exclCfgs = toArray(fnode.excluded[0].configuration);
            exclCfgs.forEach((tname) => {
                if (typeof tname == 'string') {
                    if (proj.targets[tname]) {
                        const vpath = `${curPath}/${NodePath.basename(srcpath)}`;
                        if (AbstractProject.getSourceFileFilter().some(r => r.test(vpath))) {
                            proj.targets[tname].excludeList.push(vpath);
                        }
                    }
                }
            });
        }
    });

    toArray(curGroup['group']).forEach(gnode => {

        const dirname = gnode.name[0].trim();

        const subFolder: VirtualFolder = {
            name: dirname,
            files: [],
            folders: []
        };

        curFolder.folders.push(subFolder);

        parseFileGroup(proj, gnode, subFolder, `${curPath}/${dirname}`);
    });
}

/**
 * @return iar .i79 ini format data
*/
function tryGetIarChipInfo(iarToolRoot: File, rawChipNameStr: string): { [key: string]: any } | undefined {

    if (!iarToolRoot.IsDir())
        return;

    const m = /^(?<name>\w+)\s+(?<clas>\w+)/.exec(rawChipNameStr);
    if (m && m.groups) {
        const chip = m.groups['name'];
        const clas = m.groups['clas'];
        const devDir = File.fromArray([iarToolRoot.path, 'config', 'devices', clas]);
        if (devDir.IsDir()) {
            const fli = devDir.GetAll([/\.i79$/i], File.EXCLUDE_ALL_FILTER);
            const idx = fli.findIndex(f => f.noSuffixName.toLowerCase() == chip.toLowerCase());
            if (idx != -1) {
                try {
                    return ini.parse(fli[idx].Read());
                } catch (error) {
                    GlobalEvent.log_warn(error);
                }
            }
        }
    }
}

export function formatEnvNameAndPathSep(str: string): string {
    return str.replace(/\\/g, '/')
        .replace(/\/$/, '')
        .replace(/\$TOOLKIT_DIR\$/g, () => '${ToolchainRoot}')
        .replace(/\$(\w+)\$/g, '$${$1}');
}

function isValidEnvName(name: string): boolean {
    return /^\w+$/.test(name);
}

function toArray(obj: any): any[] {
    if (obj == undefined || obj == null) return [];
    if (isArray(obj)) return obj;
    return [obj];
}

export const IAR2EIDE_OPTS_MAP: any = {

    'global': {
        'General.GEndianMode': {
            'endian-mode': {
                '0': 'little',
                '1': 'big'
            }
        },
        'General.GRuntimeLibSelect': {
            'runtime-lib': {
                '0': 'none',
                '1': 'normal',
                '2': 'full',
                '3': 'none'
            }
        },
        'ILINK.IlinkDebugInfoEnable': {
            'output-debug-info': {
                '0': 'disable',
                '1': 'enable',
            }
        }
    },

    'c/cpp-compiler': {
        'ICCARM.IccCDialect': {
            'language-c': {
                '0': 'c89',
                '1': 'c99'
            }
        },
        'ICCARM.IccCppDialect': {
            'language-cpp': {
                '0': 'Embedded-C++',
                '1': 'Extended-EC++',
                '2': 'C++'
            }
        },
        'ICCARM.CCOptLevel': {
            'optimization': {
                '0': 'none',
                '1': 'low',
                '2': 'medium',
                '3': 'high'
            }
        },
        'ICCARM.CCOptStrategy': {
            'optimization': {
                '1': 'size',
                '2': 'speed'
            }
        },
        'ICCARM.CCOptimizationNoSizeConstraints': {
            'optimization': {
                '1': 'speed-no-size-constraints'
            }
        },
        'ICCARM.CCLangConformance': {
            'language-conformance': {
                '2': "strict",
                '1': "standard",
                '0': "IAR-extensions"
            }
        },
        'ICCARM.CCRequirePrototypes': {
            'require-prototypes': {
                '0': false,
                '1': true
            }
        },
        'ICCARM.IccStaticDestr': {
            'destroy-cpp-static-object': {
                '0': false,
                '1': true
            }
        },
        'ICCARM.IccAllowVLA': {
            'allow-VLA': {
                '0': false,
                '1': true
            }
        },
        'ICCARM.IccCppInlineSemantics': {
            'use-cpp-inline-semantics': {
                '0': false,
                '1': true
            }
        },
        'ICCARM.CCSignedPlainChar': {
            'plain-char-is-signed': {
                '1': false, // in iar UI, 'unsigned' is '1'
                '0': true
            }
        },
        'ICCARM.IccFloatSemantics': {
            'floating-point-semantics': {
                '0': 'strict',
                '1': 'relaxed'
            }
        },
        'ICCARM.CCMultibyteSupport': {
            'multibyte-support': {
                '0': false,
                '1': true
            }
        },
        'ICCARM.CCDiagWarnAreErr': {
            'turn-Warning-into-errors': {
                '0': false,
                '1': true
            }
        }
    },

    'asm-compiler': {
        'AARM.ACaseSensitivity': {
            'case-sensitive-user-symbols': {
                '0': false,
                '1': true
            }
        },
        'AARM.AMultibyteSupport': {
            'multibyte-support': {
                '0': false,
                '1': true
            }
        }
    },

    'linker': {
        'General.GOutputBinary': {
            'output-format': {
                '0': 'elf',
                '1': 'lib'
            }
        },
        'ILINK.IlinkOptUseVfe': {
            'perform-cpp-virtual-func-elimination': {
                '0': "disable",
                '1': "enable"
            }
        },
        'ILINK.IlinkOptForceVfe': {
            'perform-cpp-virtual-func-elimination': {
                '1': "enable-forced"
            }
        },
        'ILINK.IlinkAutoLibEnable': {
            'auto-search-runtime-lib': {
                '0': false,
                '1': true
            }
        },
        'ILINK.IlinkOptMergeDuplSections': {
            'merge-duplicate-sections': {
                '0': false,
                '1': true
            }
        }
    }
};
