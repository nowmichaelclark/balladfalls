#!/usr/bin/env node
// The live docs stay small (docs/BRAIN.md, "The docs stay small"): each role
// loads only its own docs, and the claude.ai Project syncs a few of them, so
// every one has a size limit. Over a limit, the fix is to take what is
// finished out of the live docs, not to raise the limit. It also checks that
// every pointer into docs/ and design/ resolves (docs/archived.txt).
//
//   node tools/check-docs.mjs          check the limits (CI runs this)
//   node tools/check-docs.mjs --list   print the size of every live doc too
//
// A KB is 1024 bytes. Exits 1 if a file is over its limit or missing, or a
// pointer is broken.

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KB = 1024;
// File -> limit in KB. docs/README.md is the map of who reads what.
const LIMITS = {
  'AGENTS.md': 9, // 6 until the voice rules shared with Broken Friends (2026-11-26)
  'core/AGENTS.md': 10,
  'docs/QUEUE.md': 80,
  'docs/BRAIN.md': 50,
  'docs/DECISIONS.md': 40,
};
const LIVE = ['CLAUDE.md', 'README.md', 'ROADMAP.md', 'docs/README.md', 'docs/DONE.md', 'docs/CORE.md',
  'docs/EARS.md', 'docs/MOODS.md', 'docs/VIBES.md', 'docs/ALBUMS.md', 'docs/PAINTER.md'];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const size = (file) => readFileSync(join(root, file)).length;
const kb = (bytes) => (bytes / KB).toFixed(1).padStart(6) + ' KB';

let failed = false;
for (const [file, limit] of Object.entries(LIMITS)) {
  if (!existsSync(join(root, file))) {
    console.log(`MISSING  ${file}`);
    failed = true;
    continue;
  }
  const bytes = size(file);
  const over = bytes > limit * KB;
  if (over) failed = true;
  console.log(`${over ? 'OVER   ' : 'ok     '} ${file.padEnd(20)} ${kb(bytes)}  (limit ${limit} KB)${over ? '  over by ' + kb(bytes - limit * KB).trim() : ''}`);
}
// The queue's status (from "## Status" to the next "## ") is the short page a
// session reads first, as Broken Friends' plan/STATE.md is: 40 lines at most.
const STATUS_LINES = 40;
{
  const queue = readFileSync(join(root, 'docs/QUEUE.md'), 'utf8').split('\n');
  const start = queue.findIndex((line) => line.startsWith('## Status'));
  const end = queue.findIndex((line, i) => i > start && line.startsWith('## '));
  const lines = start < 0 ? 0 : (end < 0 ? queue.length : end) - start;
  const over = start < 0 || lines > STATUS_LINES;
  if (over) failed = true;
  console.log(`${over ? 'OVER   ' : 'ok     '} ${'docs/QUEUE.md status'.padEnd(20)} ${String(lines).padStart(6)} lines (limit ${STATUS_LINES})${start < 0 ? '  no "## Status" section' : ''}`);
}
if (process.argv.includes('--list')) {
  console.log('');
  for (const file of LIVE) if (existsSync(join(root, file))) console.log(`         ${file.padEnd(20)} ${kb(size(file))}`);
}
if (failed) {
  console.error('\nA live doc is over its limit: take the finished parts out (docs/BRAIN.md, "The docs stay small").');
}

// Pointers into docs/ and design/ resolve (the slim after 1.0): every such
// path named in a tracked text file is a file or folder here now, or is on
// docs/archived.txt (a path removed from the tree, still readable at the
// commit that file names).
const tracked = execSync('git ls-files', { cwd: root, encoding: 'utf8' }).trim().split('\n');
const here = new Set(tracked);
for (const f of tracked) {
  const parts = f.split('/');
  for (let i = 1; i < parts.length; i++) here.add(parts.slice(0, i).join('/'));
}
const archived = readFileSync(join(root, 'docs/archived.txt'), 'utf8').split('\n')
  .map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
const isArchived = (p) => archived.some((a) => (a.endsWith('/') ? p === a.slice(0, -1) || p.startsWith(a) : p === a));
const TEXT = /\.(md|mjs|js|rs|kt|kts|yml|yaml|sh|py|html|toml|jsonc|in|txt)$/;
const POINTER = /(?<![\w./-])((?:docs|design)\/[A-Za-z0-9_.\/-]*[A-Za-z0-9_\/])([-<*{]?)/g;
const broken = [];
for (const file of tracked) {
  if (!TEXT.test(file) || file === 'docs/archived.txt' || !existsSync(join(root, file))) continue;
  const text = readFileSync(join(root, file));
  if (text.length > 512 * KB) continue; // baked pages (design/*.html) quote old paths as they were
  for (const m of text.toString('utf8').matchAll(POINTER)) {
    if (m[2] || /-[A-Z]\./.test(m[1])) continue; // a pattern: docs/notes/<item>-<name>.md, batch-N.md
    const p = m[1].replace(/[./]+$/, '');
    if (!here.has(p) && !isArchived(p)) broken.push(`${file}: ${p}`);
  }
}
if (broken.length) {
  console.log(`\nBROKEN  ${broken.length} pointer(s) into docs/ or design/:`);
  for (const line of broken) console.log(`  ${line}`);
  console.error('\nFix each pointer, or add a path removed on purpose to docs/archived.txt.');
  failed = true;
} else {
  console.log('ok      every pointer into docs/ and design/ resolves (or is on docs/archived.txt)');
}
if (failed) process.exit(1);
