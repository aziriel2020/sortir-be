import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, 'public');
const out = path.join(root, 'dist');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

function copyDir(from, to, rel = '') {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    // /api is provided by Vercel Functions / rewrites, not static output.
    if (!rel && (entry.name === 'api' || entry.name === '_snapshot')) continue;
    const srcPath = path.join(from, entry.name);
    const dstPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(dstPath, { recursive: true });
      copyDir(srcPath, dstPath, path.join(rel, entry.name));
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

copyDir(src, out);
console.log(`SORTIR.BE Vercel build ready: ${out}`);
