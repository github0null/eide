/**
 * Smoke test for GccCallgraphParser — run with:
 *   npx tsc -p test
 *   node out/tmp/test/scripts/verify-callgraph-parser.js
 *
 * Build output is under out/tmp only (never emits .js into src/).
 */

import {
    parseCallgraphVcg,
    parseNodeLabel,
    parseLocationLine,
    parseNodeTitle,
    parseAttributes,
    resolveSymbolName,
    buildNodeIndex,
} from '../../src/GccCallgraphParser';

const SAMPLE = `
graph: { title: "./startup_mspm0g350x_gcc.c"
node: { title: "Default_Handler" label: "Default_Handler\n./startup_mspm0g350x_gcc.c:215:6" }
node: { title: "./startup_mspm0g350x_gcc.c:DMA_IRQHandler" label: "DMA_IRQHandler\n./startup_mspm0g350x_gcc.c:91:13" shape : triangle }
edge: { sourcename: "./startup_mspm0g350x_gcc.c:DMA_IRQHandler" targetname: "Default_Handler" label: "./startup_mspm0g350x_gcc.c:91:13" }
node: { title: "./startup_mspm0g350x_gcc.c:RTC_IRQHandler" label: "RTC_IRQHandler\n./startup_mspm0g350x_gcc.c:90:13" shape : triangle }
edge: { sourcename: "./startup_mspm0g350x_gcc.c:RTC_IRQHandler" targetname: "Default_Handler" label: "./startup_mspm0g350x_gcc.c:90:13" }
node: { title: "./startup_mspm0g350x_gcc.c:AES_IRQHandler" label: "AES_IRQHandler\n./startup_mspm0g350x_gcc.c:89:13" shape : triangle }
edge: { sourcename: "./startup_mspm0g350x_gcc.c:AES_IRQHandler" targetname: "Default_Handler" label: "./startup_mspm0g350x_gcc.c:89:13" }
node: { title: "./startup_mspm0g350x_gcc.c:I2C1_IRQHandler" label: "I2C1_IRQHandler\n./startup_mspm0g350x_gcc.c:88:13" shape : triangle }
edge: { sourcename: "./startup_mspm0g350x_gcc.c:I2C1_IRQHandler" targetname: "Default_Handler" label: "./startup_mspm0g350x_gcc.c:88:13" }
node: { title: "./startup_mspm0g350x_gcc.c:I2C0_IRQHandler" label: "I2C0_IRQHandler\n./startup_mspm0g350x_gcc.c:87:13" shape : triangle }
edge: { sourcename: "./startup_mspm0g350x_gcc.c:I2C0_IRQHandler" targetname: "Default_Handler" label: "./startup_mspm0g350x_gcc.c:87:13" }
node: { title: "./startup_mspm0g350x_gcc.c:TIMG12_IRQHandler" label: "TIMG12_IRQHandler\n./startup_mspm0g350x_gcc.c:86:13" shape : triangle }
edge: { sourcename: "./startup_mspm0g350x_gcc.c:TIMG12_IRQHandler" targetname: "Default_Handler" label: "./startup_mspm0g350x_gcc.c:86:13" }
}
`;

function assert(cond: boolean, msg: string): void {
    if (!cond) {
        console.error('FAIL:', msg);
        process.exit(1);
    }
    console.log('OK:', msg);
}

// --- parseAttributes ---
const attrs = parseAttributes('title: "a\\nb" sourcename: "x" shape : triangle');
assert(attrs['title'] === 'a\nb', 'parseAttributes: \\n escape');
assert(attrs['shape'] === 'triangle', 'parseAttributes: unquoted shape');

const winAttrs = parseAttributes('title: "C:\\Users\\ADMINI~1\\AppData\\Local\\Temp\\foo.o"');
assert(
    winAttrs['title'] === 'C:\\Users\\ADMINI~1\\AppData\\Local\\Temp\\foo.o',
    'parseAttributes: Windows path in quotes'
);

// --- parseNodeTitle ---
const winTitle = parseNodeTitle('C:\\Users\\ADMINI~1\\AppData\\Local\\Temp\\cclcIuHl.ltrans0.o:focRun');
assert(winTitle.symbol === 'focRun', 'parseNodeTitle: Windows path symbol');
assert(winTitle.objectFile!.endsWith('.o'), 'parseNodeTitle: Windows path object');
assert(winTitle.objectFile!.includes('\\'), 'parseNodeTitle: Windows path separator');

const unixTitle = parseNodeTitle('/tmp/ccAbCd12.ltrans0.o:ADC0_IRQHandler');
assert(unixTitle.symbol === 'ADC0_IRQHandler', 'parseNodeTitle: Unix path symbol');
assert(unixTitle.objectFile === '/tmp/ccAbCd12.ltrans0.o', 'parseNodeTitle: Unix path object');
assert(unixTitle.objectFile!.startsWith('/'), 'parseNodeTitle: Unix absolute path');

const unixRelTitle = parseNodeTitle('./build/out.o:main');
assert(unixRelTitle.symbol === 'main' && unixRelTitle.objectFile === './build/out.o', 'parseNodeTitle: Unix relative .o path');

const winFwdTitle = parseNodeTitle('C:/Users/dev/project/build/firmware.o:Reset_Handler');
assert(winFwdTitle.symbol === 'Reset_Handler', 'parseNodeTitle: Windows forward-slash path');
assert(winFwdTitle.objectFile === 'C:/Users/dev/project/build/firmware.o', 'parseNodeTitle: Windows forward-slash object');

const bare = parseNodeTitle('HardFault_Handler');
assert(bare.symbol === 'HardFault_Handler' && !bare.objectFile, 'parseNodeTitle: bare symbol');

// --- parseLocationLine / parseNodeLabel ---
const locHdr = parseLocationLine('libraries/ti/iqmath/include/IQmathLib.h:581:14')!;
assert(locHdr.file === 'libraries/ti/iqmath/include/IQmathLib.h', 'parseLocationLine: TI header path');
assert(locHdr.line === 581 && locHdr.column === 14, 'parseLocationLine: TI header line/col');

const lbl = parseNodeLabel('Default_Handler\n./startup_mspm0g350x_gcc.c:215:6');
assert(lbl.label === 'Default_Handler', 'parseNodeLabel: label');
assert(lbl.location?.line === 215 && lbl.location.column === 6, 'parseNodeLabel: location');

const unixLbl = parseNodeLabel('ADC0_IRQHandler\n/home/user/project/source/ISR.c:127:6');
assert(unixLbl.location?.file === '/home/user/project/source/ISR.c', 'parseNodeLabel: Unix absolute file');
assert(unixLbl.location?.line === 127 && unixLbl.location.column === 6, 'parseNodeLabel: Unix location numbers');

const winLbl = parseNodeLabel('focRun\nC:\\project\\source\\foc.c:71:6');
assert(winLbl.location?.file === 'C:\\project\\source\\foc.c', 'parseNodeLabel: Windows file in label');
assert(winLbl.location?.line === 71 && winLbl.location.column === 6, 'parseNodeLabel: Windows file line/col');

const tiLbl = parseNodeLabel('_IQ24sin\nlibraries/ti/iqmath/include/IQmathLib.h:581:14');
assert(tiLbl.label === '_IQ24sin', 'parseNodeLabel: TI iqmath label');
assert(tiLbl.location?.file === 'libraries/ti/iqmath/include/IQmathLib.h', 'parseNodeLabel: TI iqmath file');

const builtin = parseNodeLabel('__aeabi_fmul\n<built-in>');
assert(builtin.location?.file === '<built-in>', 'parseNodeLabel: builtin file');
assert(builtin.location?.line === undefined && builtin.location?.column === undefined, 'parseNodeLabel: builtin no line/col');

// --- parseCallgraphVcg (nested per-source .ci) ---
const graph = parseCallgraphVcg(SAMPLE);
assert(graph.nodes.length >= 7, `parseCallgraphVcg: nodes count (${graph.nodes.length})`);
assert(graph.graph.title === './startup_mspm0g350x_gcc.c', 'parseCallgraphVcg: nested graph title');

const triangle = graph.nodes.find((n) => resolveSymbolName(n.title) === 'DMA_IRQHandler');
assert(triangle?.shape === 'triangle', 'parseCallgraphVcg: triangle node');
assert(triangle?.label === 'DMA_IRQHandler' && !triangle.label.includes('\n'), 'parseCallgraphVcg: label without location line');
assert(
    triangle?.location?.file === './startup_mspm0g350x_gcc.c' &&
        triangle.location.line === 91 &&
        triangle.location.column === 13,
    'parseCallgraphVcg: node location from label'
);
assert(!('attrs' in (triangle ?? {})), 'parseCallgraphVcg: node has no attrs');

const index = buildNodeIndex(graph);
assert(index.size === graph.nodes.length, 'buildNodeIndex: size');

const dmaEdge = graph.edges.some(
    (e) =>
        resolveSymbolName(e.sourcename) === 'DMA_IRQHandler' &&
        e.targetname === 'Default_Handler'
);
assert(dmaEdge, 'parseCallgraphVcg: DMA_IRQHandler -> Default_Handler');

// --- strict mode ---
let threw = false;
try {
    parseCallgraphVcg('not a vcg line\n', { strict: true });
} catch (e) {
    threw = true;
}
assert(threw, 'strict mode throws on bad line');

// --- multiline statement (brace matching, not line splitting) ---
const MULTILINE = `
node: {
  title: "multiline_node"
  label: "fn\\n./a.c:10:20"
  shape : ellipse
}
edge: {
  sourcename: "multiline_node"
  targetname: "other"
}
`;
const multi = parseCallgraphVcg(MULTILINE);
assert(multi.nodes.length === 1 && multi.nodes[0].title === 'multiline_node', 'multiline node');
assert(multi.nodes[0].label === 'fn' && multi.nodes[0].location?.line === 10, 'multiline: split label/location');
assert(multi.nodes[0].shape === 'ellipse', 'multiline shape');
assert(multi.edges.length === 1 && multi.edges[0].targetname === 'other', 'multiline edge');
assert(!('attrs' in multi.edges[0]), 'parseCallgraphVcg: edge has no attrs');

// --- nested LTO .ltrans.ci (Windows temp paths with backslashes in quotes) ---
const LTO_SAMPLE = `
graph: { title: "C:\\Users\\ADMINI~1\\AppData\\Local\\Temp\\ccaHWIQW.ltrans0.o"
node: { title: "C:\\Users\\ADMINI~1\\AppData\\Local\\Temp\\ccaHWIQW.ltrans0.o:focRun" label: "focRun\\n./source/modules/algoLib/foc/source/foc.c:71:6" }
node: { title: "__aeabi_fmul" label: "__aeabi_fmul\\n<built-in>" shape : ellipse }
edge: { sourcename: "C:\\Users\\ADMINI~1\\AppData\\Local\\Temp\\ccaHWIQW.ltrans0.o:focRun" targetname: "__aeabi_fmul" }
}
`;
const ltoGraph = parseCallgraphVcg(LTO_SAMPLE);
assert(
    ltoGraph.graph.title === 'C:\\Users\\ADMINI~1\\AppData\\Local\\Temp\\ccaHWIQW.ltrans0.o',
    'LTO nested: graph title preserves backslashes'
);
assert(ltoGraph.nodes.length === 2, `LTO nested: node count (${ltoGraph.nodes.length})`);
assert(ltoGraph.edges.length === 1, `LTO nested: edge count (${ltoGraph.edges.length})`);
assert(
    ltoGraph.nodes.some((n) => n.title.includes('\\') && resolveSymbolName(n.title) === 'focRun'),
    'LTO nested: node title preserves backslashes'
);
const ltoBuiltin = ltoGraph.nodes.find((n) => n.title === '__aeabi_fmul');
assert(ltoBuiltin?.location?.file === '<built-in>', 'LTO nested: builtin location');

// --- nested graph with Unix paths ---
const UNIX_SAMPLE = `
graph: { title: "/tmp/ccXyZ789.ltrans0.o"
node: { title: "/tmp/ccXyZ789.ltrans0.o:focRun" label: "focRun\\n/home/user/fw/source/modules/algoLib/foc/source/foc.c:71:6" }
node: { title: "/tmp/ccXyZ789.ltrans0.o:ADC0_IRQHandler" label: "ADC0_IRQHandler\\n/home/user/fw/source/ISR.c:127:6" shape : triangle }
edge: { sourcename: "/tmp/ccXyZ789.ltrans0.o:ADC0_IRQHandler" targetname: "/tmp/ccXyZ789.ltrans0.o:focRun" label: "/home/user/fw/source/application.c:443:9" }
}
`;
const unixGraph = parseCallgraphVcg(UNIX_SAMPLE);
assert(unixGraph.graph.title === '/tmp/ccXyZ789.ltrans0.o', 'Unix nested: graph title');
assert(
    unixGraph.edges.some(
        (e) =>
            resolveSymbolName(e.sourcename) === 'ADC0_IRQHandler' &&
            resolveSymbolName(e.targetname) === 'focRun'
    ),
    'Unix nested: ADC0_IRQHandler -> focRun'
);

// --- nested graph (per-source GCC .ci, e.g. startup_mspm0g350x_gcc.ci) ---
const NESTED_SAMPLE = `
graph: { title: "./startup_mspm0g350x_gcc.c"
node: { title: "Default_Handler" label: "Default_Handler\\n./startup_mspm0g350x_gcc.c:215:6" }
node: { title: "./startup_mspm0g350x_gcc.c:DMA_IRQHandler" label: "DMA_IRQHandler\\n./startup_mspm0g350x_gcc.c:91:13" shape : triangle }
edge: { sourcename: "./startup_mspm0g350x_gcc.c:DMA_IRQHandler" targetname: "Default_Handler" label: "./startup_mspm0g350x_gcc.c:91:13" }
node: { title: "./startup_mspm0g350x_gcc.c:Reset_Handler" label: "Reset_Handler\\n./startup_mspm0g350x_gcc.c:156:6" }
edge: { sourcename: "./startup_mspm0g350x_gcc.c:Reset_Handler" targetname: "main" label: "./startup_mspm0g350x_gcc.c:203:5" }
}
`;
const nested = parseCallgraphVcg(NESTED_SAMPLE);
assert(nested.graph.title === './startup_mspm0g350x_gcc.c', 'nested graph: title');
assert(nested.nodes.length === 3, `nested graph: node count (${nested.nodes.length})`);
assert(nested.edges.length === 2, `nested graph: edge count (${nested.edges.length})`);
assert(
    nested.edges.some(
        (e) =>
            resolveSymbolName(e.sourcename) === 'DMA_IRQHandler' &&
            e.targetname === 'Default_Handler'
    ),
    'nested graph: DMA -> Default_Handler'
);
assert(
    nested.nodes.some((n) => resolveSymbolName(n.title) === 'DMA_IRQHandler' && n.shape === 'triangle'),
    'nested graph: triangle IRQ node'
);

console.log('\nAll smoke tests passed.');
