// Share codes, version 2 (queue item 105) through the tools' WebAssembly
// build (`dl_code_*`, tools/codes.mjs): every line of core/golden/codes.txt
// written and read back to the same characters, as the core's native test
// holds them, so the web and the native core speak one format. Needs
// `tools/build-core.sh --tools`.

import fs from 'node:fs';
import { albumCode, albumTracks, loopCode, readLoop, seedAlbumCode } from '../tools/codes.mjs';

let failures = 0;
function check(label, condition, detail = '') {
  console.log(condition ? `  pass  ${label}` : `  FAIL  ${label} ${detail}`);
  if (!condition) failures++;
}
const refusal = (fn) => {
  try {
    fn();
    return null;
  } catch (e) {
    return e.message;
  }
};

console.log('\ncore/golden/codes.txt, on the web build');
const lines = fs.readFileSync(new URL('../core/golden/codes.txt', import.meta.url), 'utf8').split('\n').filter((l) => l && !l.startsWith('#'));
for (const line of lines) {
  const f = line.split(' ');
  const req = (r) => (r === '-' ? '' : r);
  const title = (t) => (t === '-' ? '' : t);
  if (f[0] === 'loop') {
    const [, seed, request, mutes, salt, code] = f;
    const made = loopCode(Number(seed), req(request), Number(mutes), Number(salt));
    check(`loop ${seed} ${request}`, made === code, `${made} != ${code}`);
    const back = readLoop(code);
    check(`  reads back`, back.seed === Number(seed) && back.mutes === Number(mutes) && back.salt === Number(salt), JSON.stringify(back));
  } else if (f[0] === 'album') {
    const [, t, list, code] = f;
    const codes = list.split(',');
    check(`album of ${codes.length}`, albumCode(codes, title(t)) === code);
    const a = albumTracks(code);
    check('  its tracks and title', a.tracks.join(',') === list && a.title === title(t), JSON.stringify(a));
  } else if (f[0] === 'seed-album') {
    const [, seed, count, request, t, code] = f;
    check(`seed-album ${seed} x${count}`, seedAlbumCode(Number(seed), Number(count), req(request), title(t)) === code);
    const a = albumTracks(code);
    check('  its tracks', a.tracks.length === Number(count) && a.title === title(t));
  } else {
    check(`a line it knows: ${f[0]}`, false);
  }
}

console.log('\nRefusals');
{
  // A code from a newer build: version 3's head, sealed with its check.
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const chars = 'GRiSNBA';
  let h = 0;
  for (const c of chars) h = (h * 64 + A.indexOf(c) + 1) % 4093;
  const newer = chars + A[h & 63] + A[h >> 6];
  check('a newer version: "needs a newer version"', refusal(() => readLoop(newer)) === 'needs a newer version');
  check('a typo: "not a code"', refusal(() => readLoop('ERiSNBA2l')) === 'not a code');
  check('an old DL1- code: "not a code"', refusal(() => readLoop('DL1-0A1B2-C3D4E')) === 'not a code');
}

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall passed');
