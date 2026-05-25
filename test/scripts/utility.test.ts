/**
 * Smoke test for GccStackUsageParser — run with:
 *   npx ts-node test/scripts/utility.test.ts
 * 
 * Build output is under out/tmp only (never emits .js into src/).
 */

import * as mock from 'mock-require';

mock.default('vscode', {
  window: { showInformationMessage: () => {} },
  workspace: {},
  languages: {},
  debug: {},
  commands: {},
  env: {
    language: 'en-us'
  }
});

// -----------------------------

export function checkGccFFlag(cmdline: string, fname: string): boolean {
    let idx = cmdline.indexOf(`-f${fname}`);
    if (idx !== -1) {
        let nidx = cmdline.indexOf(`-fno-${fname}`);
        if (nidx !== -1 && nidx > idx) {
            return false;
        } else {
            return true;
        }
    }
    return false;
};

// -----------------------------

function assert(cond: boolean, msg: string): void {
    if (!cond) {
        console.error('FAIL:', msg);
        process.exit(1);
    }
    console.log('OK:', msg);
}

assert(checkGccFFlag('-mthumb -Os -Wall -g -fno-lto', 'lto') == false,
    "checkGccFFlag 0");
assert(checkGccFFlag('-mthumb -Os -Wall -flto -g', 'lto') == true,
    "checkGccFFlag 1");
assert(checkGccFFlag('-mthumb -Os -flto -Wall -g -fno-lto', 'lto') == false,
    "checkGccFFlag 2");
assert(checkGccFFlag('-mthumb -fno-lto -Os -flto -Wall -g', 'lto') == true,
    "checkGccFFlag 3");
assert(checkGccFFlag('-mthumb -fcallgraph-info -Os -fno-callgraph-info -Wall -g', 'callgraph-info') == false, 
    "checkGccFFlag 4");
