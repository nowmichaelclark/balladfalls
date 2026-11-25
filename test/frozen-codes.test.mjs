// The codes frozen at 1.0 (queue item 108, session 31): version 2 codes made
// on 1.0's build, each with what it decodes to, so a code made today plays
// the same loop on every build after it. core/golden/frozen-codes.txt is the
// list; this test reads every code there and fails on any difference:
//
//   - a loop: its seed, mutes, salt, name and its request as text (with its
//     version), the code written again from those, and a hash of everything
//     the generator draws from it (tools/gen-lib.mjs: the spec, the plan, the
//     form, each layer, the meta, the choices, the load and eight wandered
//     passes, the same parts the generation goldens hash);
//   - an album: its name and its tracks with their paces (each track is a
//     loop line of its own).
//
// The file was written once, at 1.0, by `node test/frozen-codes.test.mjs
// --write`, from the loops of core/golden/share-codes.txt and its albums, and
// one case in ten of each set of core/golden/generation.hashes, made into a
// code. **It is never written again:** a change that moves a line moves what
// an older code plays, which codes can't have (Mikey, 2026-11-17: no code rot).
// A new line may be added for a later version's codes; the old ones stay.
// Needs `tools/build-core.sh --tools`.
//
// Line formats (a NAME is "-" for none, `%20` a space, `%25` a percent sign):
//
//   loop CODE SEED MUTES SALT NAME REQUEST HASH
//   album CODE NAME TRACK,TRACK,...            (a track's pace as in
//                                              share-codes.txt: CODE:t120o)

import fs from 'node:fs';
import { albumTracks, loopCode, readLoop } from '../tools/codes.mjs';
import { casesOf, fnv1a64 } from '../tools/gen-golden-lib.mjs';
import * as gen from '../tools/gen-lib.mjs';

const FILE = new URL('../core/golden/frozen-codes.txt', import.meta.url);
const SHARE = new URL('../core/golden/share-codes.txt', import.meta.url);
const GENERATION = new URL('../core/golden/generation.hashes', import.meta.url);

const named = (t) => (t === '-' ? '' : t.replace(/%20/g, ' ').replace(/%25/g, '%'));
const naming = (t) => (t === '' ? '-' : t.replace(/%/g, '%25').replace(/ /g, '%20'));

// Everything the generator draws from a loop, as one hash.
function loopHash(seed, request) {
  const { hashes } = gen.hashes(seed, request || null);
  const parts = Object.keys(hashes).filter((k) => k !== 'passes').sort().map((k) => `${k}=${hashes[k]}`);
  return fnv1a64([...parts, `passes=${hashes.passes.join(',')}`].join(' '));
}

function loopLine(code) {
  const d = readLoop(code);
  return ['loop', code, d.seed >>> 0, d.mutes, d.salt, naming(d.name), d.request || '-', loopHash(d.seed, d.request)].join(' ');
}

function albumLine(code) {
  const a = albumTracks(code);
  return { line: ['album', code, naming(a.name), a.paced.join(',')].join(' '), tracks: a.tracks };
}

if (process.argv.includes('--write')) {
  if (fs.existsSync(FILE)) {
    console.error('frozen-codes: the file exists and is never written again (see the header)');
    process.exit(2);
  }
  const loops = [];
  const albums = [];
  const seen = new Set();
  const addLoop = (code) => {
    if (seen.has(code)) return;
    seen.add(code);
    loops.push(loopLine(code));
  };
  for (const l of fs.readFileSync(SHARE, 'utf8').split('\n')) {
    if (!l || l.startsWith('#')) continue;
    const f = l.split(' ');
    if (f[0] === 'loop') addLoop(f[6]);
    else {
      const a = albumLine(f[f.length - 1]);
      albums.push(a.line);
      a.tracks.forEach(addLoop);
    }
  }
  let refused = 0;
  const bySet = new Map();
  for (const c of casesOf(fs.readFileSync(GENERATION, 'utf8'))) {
    const n = bySet.get(c.set) || 0;
    bySet.set(c.set, n + 1);
    if (n % 10) continue;
    let code;
    try {
      code = loopCode(c.seed, c.request || '');
    } catch {
      refused++;
      continue;
    }
    addLoop(code);
  }
  const head = fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => `#${l.slice(2)}`);
  fs.writeFileSync(FILE, `${head.join('\n')}\n${loops.join('\n')}\n${albums.join('\n')}\n`);
  console.log(`frozen-codes: wrote ${loops.length} loops and ${albums.length} albums (${refused} cases no code carries, left out)`);
  process.exit(0);
}

let failures = 0;
let loops = 0;
let albums = 0;
const fail = (label, detail) => {
  failures++;
  if (failures <= 40) console.log(`  FAIL  ${label} ${detail}`);
};
console.log('\ncore/golden/frozen-codes.txt: the codes of 1.0, decoded');
for (const l of fs.readFileSync(FILE, 'utf8').split('\n')) {
  if (!l || l.startsWith('#')) continue;
  const f = l.split(' ');
  try {
    if (f[0] === 'loop') {
      loops++;
      const [, code, seed, mutes, salt, name, request] = f;
      const now = loopLine(code);
      if (now !== l) fail(code, `decodes as\n          ${now}\n     was  ${l}`);
      const again = loopCode(Number(seed), request === '-' ? '' : request, Number(mutes), Number(salt), named(name));
      if (again !== code) fail(code, `written again as ${again}`);
    } else if (f[0] === 'album') {
      albums++;
      const now = albumLine(f[1]).line;
      if (now !== l) fail(f[1], `decodes as\n          ${now}\n     was  ${l}`);
    } else {
      fail('a line it knows', f[0]);
    }
  } catch (err) {
    fail(f[1], `refused: ${err.message}`);
  }
}
if (failures > 40) console.log(`  ... and ${failures - 40} more`);
if (failures || !loops) {
  console.log(`\n${failures} failed of ${loops} loops and ${albums} albums`);
  process.exit(1);
}
console.log(`  pass  ${loops} loops and ${albums} albums decode as at 1.0\n\nall passed`);
