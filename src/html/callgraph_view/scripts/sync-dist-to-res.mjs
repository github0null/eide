import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import child_process from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(root, 'dist');
const resDir = resolve(root, '../../../res/html/callgraph_view');

if (!existsSync(distDir)) {
  console.error('[sync-dist-to-res] dist/ 不存在，请先执行 vite build');
  process.exit(1);
}

// clean resDir
if (existsSync(resDir)) {
  if (os.platform() === 'win32') {
    child_process.execSync('powershell Remove-Item \'' + resDir + '\\*\' -Recurse -Force -ErrorAction:Continue', { encoding: 'utf8' });
  } else {
    child_process.execSync(`rm -rf "${resDir}/*"`, { encoding: 'utf8' });
  }
}

mkdirSync(resDir, { recursive: true });

const failures = [];

function copyTree(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
    const srcPath = join(src, name);
    const destPath = join(dest, name);
    if (statSync(srcPath).isDirectory()) {
      copyTree(srcPath, destPath);
      continue;
    }
    try {
      cpSync(srcPath, destPath, { force: true });
    } catch (err) {
      failures.push({ file: destPath, err });
    }
  }
}

copyTree(distDir, resDir);

if (failures.length === 0) {
  console.log(`[sync-dist-to-res] 已同步到 ${resDir}`);
  process.exit(0);
}

console.warn(
  `[sync-dist-to-res] ${failures.length} 个文件无法写入（目录可能被 serve 占用）：`,
);
for (const f of failures) {
  console.warn(`  - ${f.file}`);
}
console.warn(
  '构建产物已在 src/html/callgraph_view/dist/。请停止 res 上的静态服务后重新 npm run build，或使用 npm run preview 预览 dist。',
);

const critical = failures.some((f) =>
  /index\.html$/i.test(f.file) || /js[/\\]app\.js$/i.test(f.file),
);
process.exit(critical ? 1 : 0);
