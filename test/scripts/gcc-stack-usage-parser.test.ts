/**
 * Smoke test for GccStackUsageParser — run with:
 *   npx ts-node test/scripts/gcc-stack-usage-parser.test.ts
 * Or compile: npx tsc -p test
 *   node out/tmp/test/scripts/gcc-stack-usage-parser.test.js
 *
 * Build output is under out/tmp only (never emits .js into src/).
 */

import {
    parseStackUsageLine,
    parseStackUsageText,
} from '../../src/GccStackUsageParser';

function assert(cond: boolean, msg: string): void {
    if (!cond) {
        console.error('FAIL:', msg);
        process.exit(1);
    }
    console.log('OK:', msg);
}

const TAB = '\t';

// --- user sample lines ---
const SAMPLE_ISR = `./source/ISR.c:127:6:ADC0_IRQHandler${TAB}56${TAB}static`;
const SAMPLE_DRV = `./source/modules/hal/gateDriverInterface/gateDriverLib/CUSTOM/source/drv8305.c:103:17:regRead.constprop${TAB}24${TAB}static`;
const SAMPLE_ZERO = `./source/ISR.c:279:6:HardFault_Handler${TAB}0${TAB}static`;
const SAMPLE_FOC = `./source/modules/algoLib/foc/source/foc.c:71:6:focRun${TAB}64${TAB}static`;
const SAMPLE_HAL = `./source/modules/hal/controllerInterface/source/focHALInterface.c:316:6:HAL_EnableLowSideBrake${TAB}0${TAB}static`;

// --- parseStackUsageLine: Unix relative ---
const isr = parseStackUsageLine(SAMPLE_ISR);
assert(isr !== null, 'parseStackUsageLine: parses ISR line');
assert(isr!.functionName === 'ADC0_IRQHandler', 'parseStackUsageLine: function name');
assert(isr!.stackBytes === 56, 'parseStackUsageLine: stack bytes');
assert(isr!.allocationType === 'static', 'parseStackUsageLine: allocation type');
assert(isr!.location.file === './source/ISR.c', 'parseStackUsageLine: relative file');
assert(isr!.location.line === 127 && isr!.location.column === 6, 'parseStackUsageLine: line/column');

// --- deep relative path + dotted function name ---
const drv = parseStackUsageLine(SAMPLE_DRV);
assert(drv !== null, 'parseStackUsageLine: deep path');
assert(drv!.functionName === 'regRead.constprop', 'parseStackUsageLine: dotted function');
assert(drv!.location.file.includes('drv8305.c'), 'parseStackUsageLine: deep path file');

// --- zero stack ---
const zero = parseStackUsageLine(SAMPLE_ZERO);
assert(zero !== null && zero!.stackBytes === 0, 'parseStackUsageLine: zero stack bytes');

// --- batch from user sample ---
const batch = parseStackUsageText(
    [SAMPLE_HAL, SAMPLE_FOC, SAMPLE_ISR, SAMPLE_DRV, SAMPLE_ZERO].join('\n')
);
assert(batch.entries.length === 5, 'parseStackUsageText: batch count');
assert(batch.entries[0].functionName === 'HAL_EnableLowSideBrake', 'parseStackUsageText: first entry');

// --- Windows backslash path ---
const winBack = parseStackUsageLine(`C:\\project\\source\\foc.c:71:6:focRun${TAB}64${TAB}static`);
assert(winBack !== null, 'parseStackUsageLine: Windows backslash');
assert(winBack!.location.file === 'C:\\project\\source\\foc.c', 'parseStackUsageLine: Windows backslash file');
assert(winBack!.location.line === 71 && winBack!.location.column === 6, 'parseStackUsageLine: Windows line/col');

// --- Windows forward-slash path ---
const winFwd = parseStackUsageLine(`C:/Users/dev/fw/source/main.c:50:5:main${TAB}64${TAB}static`);
assert(winFwd !== null, 'parseStackUsageLine: Windows forward slash');
assert(winFwd!.location.file === 'C:/Users/dev/fw/source/main.c', 'parseStackUsageLine: Windows forward slash file');

// --- Unix absolute path ---
const unixAbs = parseStackUsageLine(`/home/user/fw/source/ISR.c:127:6:ADC0_IRQHandler${TAB}56${TAB}static`);
assert(unixAbs !== null, 'parseStackUsageLine: Unix absolute');
assert(unixAbs!.location.file === '/home/user/fw/source/ISR.c', 'parseStackUsageLine: Unix absolute file');

// --- dynamic,bounded allocation type preserved ---
const dyn = parseStackUsageLine(`./foo.c:1:1:fn${TAB}128${TAB}dynamic,bounded`);
assert(dyn !== null && dyn!.allocationType === 'dynamic,bounded', 'parseStackUsageLine: dynamic,bounded');

// --- null allocation type ---
const nullType = parseStackUsageLine(`./foo.c:2:1:empty${TAB}0${TAB}null`);
assert(nullType !== null && nullType!.allocationType === 'null', 'parseStackUsageLine: null type');

// --- empty lines skipped ---
const withBlanks = parseStackUsageText(`\n\n${SAMPLE_ISR}\n   \n`);
assert(withBlanks.entries.length === 1, 'parseStackUsageText: skip empty lines');

// --- lenient mode warns on bad line ---
const lenient = parseStackUsageText(`${SAMPLE_ISR}\nnot a valid line\n`);
assert(lenient.entries.length === 1, 'parseStackUsageText: lenient keeps valid');
assert(lenient.warnings !== undefined && lenient.warnings.length === 1, 'parseStackUsageText: lenient warning');

// --- strict mode throws ---
let threw = false;
try {
    parseStackUsageText('garbage line\n', { strict: true });
} catch {
    threw = true;
}
assert(threw, 'parseStackUsageText: strict throws on bad line');

// --- space-separated trailing fields ---
const withSpaces = parseStackUsageLine('./source/ISR.c:127:6:ADC0_IRQHandler 56 static');
assert(withSpaces !== null && withSpaces!.stackBytes === 56, 'parseStackUsageLine: space separators');

// --- mixed tab/space separators ---
const mixed = parseStackUsageLine(`./foo.c:1:1:fn${TAB} 64 static`);
assert(mixed !== null && mixed!.stackBytes === 64, 'parseStackUsageLine: mixed tab/space separators');

// --- multiple spaces between fields ---
const multiSpace = parseStackUsageLine('./a.c:1:1:fn   128   dynamic,bounded');
assert(multiSpace !== null && multiSpace!.allocationType === 'dynamic,bounded', 'parseStackUsageLine: multiple spaces');

// --- malformed ---
assert(parseStackUsageLine('./a.c:1:1:fn') === null, 'parseStackUsageLine: rejects missing fields');
assert(parseStackUsageLine('./a.c:1:1:fn abc static') === null, 'parseStackUsageLine: rejects non-numeric stack bytes');

console.log('\nAll stack-usage parser tests passed.');
