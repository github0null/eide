import * as NodePath from "path";
import * as os from "os";
import * as fs from "fs";
import { File } from "../lib/node-utility/File";
import { EIDE_CONF_VERSION, ProjectConfiguration } from "./EIDETypeDefine";
import { compareVersion } from "./utility";

export function detectProject(dir: File): boolean {
    if (File.IsExist(NodePath.join(dir.path, '.eide', 'eide.yml')))
        return true;
    if (File.IsExist(NodePath.join(dir.path, '.eide', 'eide.json')))
        return true;
    return false;
}

export async function doMigration(projectRootDir: File) {

    // move eide.json to eide.yml
    const eideJsonFile = File.from(projectRootDir.path, '.eide', 'eide.json');
    const projCfgFile = File.from(projectRootDir.path, '.eide', 'eide.yml');
    if (eideJsonFile.IsExist()) {
        const obj = ProjectConfiguration.parseProjectFile(eideJsonFile.Read());
        projCfgFile.Write(ProjectConfiguration.dumpProjectFile(obj));
    }

    const prjCfg = ProjectConfiguration.parseProjectFile(projCfgFile.Read());

    // version < 4.0 ?
    if (compareVersion(prjCfg.version, '4.0') < 0) {
        for (const key in prjCfg.targets) {
            const target = prjCfg.targets[key];
            // compile config
            if (target.compileConfigMap == undefined)
                target.compileConfigMap = {};
            if (target.compileConfig) {
                target.compileConfigMap[target.toolchain] = target.compileConfig;
                target.compileConfig = undefined;
            }
            if (target.builderOptions) {
                for (const key in target.builderOptions) {
                    const opts = target.builderOptions[key];
                    if (target.compileConfigMap[key])
                        target.compileConfigMap[key].options = opts;
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
    }

    // save
    if (compareVersion(prjCfg.version, EIDE_CONF_VERSION) < 0) {
        prjCfg.version = EIDE_CONF_VERSION;
        projCfgFile.Write(ProjectConfiguration.dumpProjectFile(prjCfg));
    }

    // rm .eide.usr.ctx.json
    const p = NodePath.join(projectRootDir.path, '.eide.usr.ctx.json');
    if (File.IsFile(p))
        try { fs.unlinkSync(p); } catch (error) {}

    // rm old eide.json file
    if (eideJsonFile.IsExist())
        fs.unlinkSync(eideJsonFile.path);
}
