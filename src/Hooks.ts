import { File } from '../lib/node-utility/File';
import { CompilerCommandsDatabaseItem } from './CodeBuilder';
import { AbstractProject } from "./EIDEProject";
import { CallgraphVcg, parseCallgraphVcgFile } from './GccCallgraphParser';
import { parseStackUsageFile, StackUsageDocument } from './GccStackUsageParser';
import { GlobalEvent } from './GlobalEvents';
import { reverseStringMap } from './utility';
import * as NodePath from 'node:path';

interface BuildFlags {
    fcallgraphInfo: boolean;
    fstackUsage: boolean;
    flto: boolean;
}

function checkflags(cli: string): BuildFlags {
    // -fcallgraph-info -fstack-usage
    const flags: BuildFlags = {
        fcallgraphInfo: false,
        fstackUsage: false,
        flto: false
    };

    if (cli.includes('-fcallgraph-info'))
        flags.fcallgraphInfo = true;
    if (cli.includes('-fstack-usage'))
        flags.fstackUsage = true;

    let idx = cli.indexOf('-flto');
    if (idx !== -1) {
        let nidx = cli.indexOf('-fno-lto');
        if (nidx !== -1 && nidx > idx) {
            flags.flto = false;
        } else {
            flags.flto = true;
        }
    }

    return flags;
}

export function onProjectBuildFinished(prj: AbstractProject, succeed: boolean) {
    try {
        if (succeed) {
            const buildOutDir = prj.getOutputFolder();
            // const src2objMap = new Map<string, string>(Object.entries(
            //     JSON.parse(File.from(buildOutDir.path, 'ref.json').Read())));
            // const obj2srcMap = reverseStringMap(src2objMap);
            const cmdsDb: CompilerCommandsDatabaseItem[] = 
                JSON.parse(File.from(buildOutDir.path, '.obj', 'objs.db.json').Read());
            // collect all .ci su files
            let ciFiles: string[] = [];
            let suFiles: string[] = [];
            let hasLto = false;
            let hasCallgraphInfo = false;
            let hasStackUsage = false;
            cmdsDb.forEach((item) => {
                const pathNoSuffix = NodePath.join(
                    NodePath.dirname(item.file), NodePath.basename(item.file, '.o'));
                const flags = checkflags(item.command);
                if (flags.fcallgraphInfo)
                    hasCallgraphInfo = true;
                if (flags.fstackUsage)
                    hasStackUsage = true;
                if (flags.flto) {
                    hasLto = true;
                    // if used lto, we only care about .ltrans.ci .ltrans.su
                    // the compiler will not generate .ci .su file for each object file, 
                    // but generate .ltrans.ci .ltrans.su for the whole program after link stage
                } else {
                    if (flags.fcallgraphInfo)
                        ciFiles.push(pathNoSuffix + '.ci');
                    if (flags.fstackUsage)
                        suFiles.push(pathNoSuffix + '.su');
                }
            });
            if (hasLto) {
                const filter: RegExp[] = [];
                if (hasCallgraphInfo)
                    filter.push(/\.ltrans\.ci$/);
                if (hasStackUsage)
                    filter.push(/\.ltrans\.su$/);
                buildOutDir
                    .GetList(filter, File.EXCLUDE_ALL_FILTER)
                    .forEach(file => {
                        if (file.suffix === '.su')
                            suFiles.push(file.path);
                        else if (file.suffix === '.ci')
                            ciFiles.push(file.path);
                    });
            }
            // filter existed file
            ciFiles = ciFiles.filter(p => File.IsFile(p));
            suFiles = suFiles.filter(p => File.IsFile(p));
            // parse all .ci .su files
            const callgraph: CallgraphVcg[] = [];
            const stackusage: StackUsageDocument[] = [];
            ciFiles.forEach(path => {
                let r = parseCallgraphVcgFile(path);
                callgraph.push(r);
            });
            suFiles.forEach(path => {
                let r = parseStackUsageFile(path);
                stackusage.push(r);
            });
            // dump
            File.from(buildOutDir.path, 'statistic.json')
                .Write(JSON.stringify({
                    callgraph,
                    stackusage
                }));
        }
    } catch (error) {
        GlobalEvent.log_error(error);
        GlobalEvent.log_show();
    }
}
