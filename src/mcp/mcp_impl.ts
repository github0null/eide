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

import { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { ProjectExplorer } from '../EIDEProjectExplorer';
import { AbstractProject } from '../EIDEProject';
import { BuilderOptions } from '../EIDETypeDefine';
import { FlashCommandResult } from '../HexUploader';
import { loadBuilderOptionsSchema, validateBuilderOptions } from './mcp_builder_opts_validate';

function resolveProject(
    explorer: ProjectExplorer,
    uid: string | null | undefined
): AbstractProject | undefined {
    if (uid) {
        return explorer.getProjectByUid(uid);
    }
    return undefined;
}

function projectNotFound(uid: string | null | undefined): CallToolResult {
    return {
        isError: true,
        content: [{
            type: 'text',
            text: uid ? `Error. Not such project (uid=${uid}).` : `Error. Params 'uid' cannot be empty.`
        }]
    };
}

function makeTextResult(success: boolean, message: string, err?: Error): CallToolResult {
    return {
        isError: !success,
        content: [{
            type: 'text',
            text: message + (err ? '\n\nError: ' + err.message : '')
        }]
    };
}

function makeJsonResult(data: unknown, isError = false): CallToolResult {
    return {
        isError,
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
    };
}

export async function executeTool(
    tool: string,
    args: Record<string, unknown>,
    explorer: ProjectExplorer
): Promise<CallToolResult> {
    const uid = args.uid as string | null | undefined;

    switch (tool) {
        case 'eide_build':
        case 'eide_rebuild':
        case 'eide_clean': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            let res: { success: boolean; message: string; };
            if (tool === 'eide_build') {
                res = await explorer.buildProject(prj, { notRebuild: true, otherArgs: ['--no-color'] }, true);
            } else if (tool === 'eide_rebuild') {
                res = await explorer.buildProject(prj, { otherArgs: ['--no-color'] }, true);
            } else {
                res = await explorer.cleanProject(prj, true);
            }
            return makeTextResult(res.success, res.message);
        }
        case 'eide_flash': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const eraseAll = Boolean(args.eraseAll);
            let res: FlashCommandResult | void;
            if (eraseAll) {
                res = await explorer.programFlashProject(prj, true, true);
                if (!res || !res.success)
                    return makeTextResult(false, res ? res.message : 'Failed to erase chip.');
            }
            res = await explorer.programFlashProject(prj, false, true);
            if (res) {
                return makeTextResult(res.success, res.message, res.error);
            } else {
                return makeTextResult(false, 'Unknown Error.');
            }
        }
        case 'eide_reload': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const ok = await explorer.reloadProject(prj.getUid(), false);
            const result = makeTextResult(ok, ok ? 'Succeed.' : 'Failed.');
            await new Promise(r => setTimeout(r, ok ? 3000 : 500)); // delay after reload project.
            return result;
        }
        case 'eide_switch_target': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const targetName = args.targetName as string;
            const targets = prj.getTargets();
            if (!targets.includes(targetName))
                return makeTextResult(false, `Project '${prj.getProjectName()}' (uid=${uid}) not have this target: '${targetName}'`);
            await prj.switchTarget(targetName);
            await new Promise(r => setTimeout(r, 1500));
            return makeTextResult(true, 'Succeed.');
        }
        case 'eide_add_src_dir': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const srcDir = args.path as string;
            const absSrcDir = prj.ToAbsolutePath(srcDir);
            const res = prj.getNormalSourceManager().verify(absSrcDir);
            if (!res.valid) {
                return makeTextResult(false, res.message);
            }
            prj.GetConfiguration().AddSrcDir(absSrcDir);
            return makeTextResult(true, 'Succeed.');
        }
        case 'eide_del_src_dir': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const absSrcDir = prj.ToAbsolutePath(args.path as string);
            const srcDirs = prj.GetConfiguration().config.srcDirs;
            if (!srcDirs.includes(absSrcDir)) {
                return makeTextResult(false, `Source directory not in project: ${args.path}`);
            }
            prj.GetConfiguration().RemoveSrcDir(absSrcDir);
            return makeTextResult(true, 'Succeed.');
        }
        case 'eide_get_src_dirs': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const srcList = prj.getNormalSourceManager()
                .getRootFolderList().map(info => prj.toRelativePath(info.fileWatcher.file.path));
            return makeJsonResult(srcList);
        }
        case 'eide_exclude_src_file': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const filePath = args.path as string;
            prj.excludeSourceFile(prj.ToAbsolutePath(filePath));
            return makeTextResult(true, 'Succeed.');
        }
        case 'eide_include_src_file': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const filePath = args.path as string;
            prj.unexcludeSourceFile(prj.ToAbsolutePath(filePath));
            return makeTextResult(true, 'Succeed.');
        }
        case 'eide_get_inc_dirs': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const depMerge = prj.GetConfiguration().GetAllMergeDep();
            const incList = depMerge.incList.map(p => {
                const rel = prj.toRelativePath(p);
                return rel !== undefined ? rel : p;
            });
            return makeJsonResult(incList);
        }
        case 'eide_set_inc_dirs': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const paths = args.paths as string[];
            if (!Array.isArray(paths)) {
                return makeTextResult(false, 'paths must be an array of strings.');
            }
            const dep = prj.GetConfiguration().CustomDep_getDependence();
            dep.incList = paths.map(p => prj.ToAbsolutePath(p));
            prj.GetConfiguration().CustomDep_NotifyChanged();
            return makeTextResult(true, 'Succeed.');
        }
        case 'eide_get_defines': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const depMerge = prj.GetConfiguration().GetAllMergeDep();
            return makeJsonResult(depMerge.defineList);
        }
        case 'eide_set_defines': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const defines = args.defines as string[];
            if (!Array.isArray(defines)) {
                return makeTextResult(false, 'defines must be an array of strings.');
            }
            const dep = prj.GetConfiguration().CustomDep_getDependence();
            dep.defineList = defines.map(d => d.trim()).filter(d => d.length > 0);
            prj.GetConfiguration().CustomDep_NotifyChanged();
            return makeTextResult(true, 'Succeed.');
        }
        case 'eide_get_builder_opts': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const builderOpts = prj.GetConfiguration().toolchainConfigModel.getOptions();
            return makeJsonResult(builderOpts);
        }
        case 'eide_get_builder_opts_schema': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            try {
                return makeJsonResult(loadBuilderOptionsSchema(prj));
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                return makeTextResult(false, 'Failed to load builder options schema.', error);
            }
        }
        case 'eide_get_targets': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            return makeJsonResult({
                actived: prj.getCurrentTarget(),
                targets: prj.getTargets()
            });
        }
        case 'eide_set_builder_opts': {
            const prj = resolveProject(explorer, uid);
            if (!prj)
                return projectNotFound(uid);
            const options = args.options;
            if (!options || typeof options !== 'object' || Array.isArray(options)) {
                return makeTextResult(false, 'options must be a BuilderOptions JSON object.');
            }
            const validateErr = validateBuilderOptions(prj, options);
            if (validateErr) {
                return makeTextResult(false, `Builder options validation failed:\n${validateErr}`);
            }
            try {
                prj.GetConfiguration().toolchainConfigModel.setOptions(options as BuilderOptions);
                prj.onBuilderConfigChanged();
                return makeTextResult(true, 'Succeed.');
            } catch (err) {
                const error = err instanceof Error ? err : new Error(String(err));
                return makeTextResult(false, 'Failed to set builder options.', error);
            }
        }
        default:
            return makeTextResult(false, `Unknown tool: ${tool}`);
    }
}
