import * as NodePath from "path";
import * as os from "os";
import * as fs from "fs";
import { File } from "../lib/node-utility/File";
import { EIDE_CONF_VERSION, ProjectConfiguration } from "./EIDETypeDefine";
import { compareVersion } from "./utility";
import { view_str$prompt$migrationFailed } from "./StringTable";
import { GlobalEvent } from "./GlobalEvents";

export function detectProject(dir: File): boolean {
    if (File.IsExist(NodePath.join(dir.path, '.eide', 'eide.yml')))
        return true;
    if (File.IsExist(NodePath.join(dir.path, '.eide', 'eide.json')))
        return true;
    return false;
}

async function _doMigration(projectRootDir: File) {

    // move eide.json to eide.yml
    const eideJsonFile = File.from(projectRootDir.path, '.eide', 'eide.json');
    const projCfgFile = File.from(projectRootDir.path, '.eide', 'eide.yml');
    if (eideJsonFile.IsExist()) {
        const obj = ProjectConfiguration.parseProjectFile(eideJsonFile.Read());
        projCfgFile.Write(ProjectConfiguration.dumpProjectFile(obj));
    }

    const prjCfg = ProjectConfiguration.parseProjectFile(projCfgFile.Read());

    if (compareVersion(prjCfg.version, '4.0') < 0) {
        GlobalEvent.log_info(`migration ${projCfgFile.path} from ${prjCfg.version} to 4.0`);
        for (const key in prjCfg.targets) {
            const target = prjCfg.targets[key];
            // rename compileConfig to toolchainConfig
            if ((<any>target).compileConfig) {
                (<any>target).toolchainConfig = (<any>target).compileConfig;
                (<any>target).compileConfig = undefined;
            }
            if ((<any>target).compileConfigMap) {
                (<any>target).toolchainConfigMap = (<any>target).compileConfigMap;
                (<any>target).compileConfigMap = undefined;
            }
            // toolchain config
            if (target.toolchainConfigMap == undefined)
                target.toolchainConfigMap = {};
            if (target.toolchainConfig) {
                target.toolchainConfigMap[target.toolchain] = target.toolchainConfig;
                target.toolchainConfig = undefined;
            }
            if (target.builderOptions) {
                for (const key in target.builderOptions) {
                    const opts = target.builderOptions[key];
                    if (target.toolchainConfigMap[key])
                        target.toolchainConfigMap[key].options = opts;
                }
                target.builderOptions = <any>undefined;
            }
            // uploader config
            if (target.uploadConfigMap == undefined)
                target.uploadConfigMap = {};
            if (target.uploadConfig) {
                target.uploadConfigMap[target.uploader] = target.uploadConfig;
                target.uploadConfig = undefined;
            }
            // custom_dep -> cppPreprocessAttrs
            if ((<any>target)['custom_dep']) {
                target.cppPreprocessAttrs = (<any>target)['custom_dep'];
                (<any>target)['custom_dep'] = undefined;
            }
        }
        projCfgFile.Write(ProjectConfiguration.dumpProjectFile(prjCfg));
    }

    // rm .eide.usr.ctx.json
    const p = NodePath.join(projectRootDir.path, '.eide.usr.ctx.json');
    if (File.IsFile(p))
        try { fs.unlinkSync(p); } catch (error) {}
}

export async function doMigration(projectRootDir: File) {
    try {
        await _doMigration(projectRootDir);
    } catch (error) {
        GlobalEvent.log_error(view_str$prompt$migrationFailed.replace('{}', projectRootDir.path));
        GlobalEvent.log_error(error);
        GlobalEvent.log_show();
        throw error;
    }
}
