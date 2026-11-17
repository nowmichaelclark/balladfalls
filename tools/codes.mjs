#!/usr/bin/env node
// Share codes, version 2 (queue item 105), from the command line, on the
// core's own reader and writer (`core/src/code.rs`, the tools' build:
// `tools/build-core.sh --tools`). For the brain's albums and for looking
// inside a code; core/README.md, "Share codes", is the format.
//
//   node tools/codes.mjs loop SEED [REQUEST] [--mutes N] [--salt N]
//                                   a loop's code (REQUEST as `dlrender
//                                   --request` reads it: "glacial,bars=64")
//   node tools/codes.mjs read CODE  a loop's seed, mutes and salt (and
//                                   whether it reads), or an album's tracks
//   node tools/codes.mjs album [--title T] CODE...
//                                   an album of loops' codes, in order
//   node tools/codes.mjs seed-album SEED COUNT [REQUEST] [--title T]
//                                   an album of COUNT tracks drawn from SEED,
//                                   sharing REQUEST's picks
//
// As a module: `loopCode`, `readLoop`, `albumCode`, `seedAlbumCode`,
// `albumTracks` (test/codes.test.mjs holds them to core/golden/share-codes.txt).

import { open } from './gen-lib.mjs';

let x = null;
const enc = new TextEncoder();
const dec = new TextDecoder();

function core() {
  if (!x) x = open();
  return x;
}

function put(bytes) {
  const c = core();
  new Uint8Array(c.memory.buffer, c.dl_code_input(), bytes.length).set(bytes);
  return bytes.length;
}

function text(len) {
  const c = core();
  return dec.decode(new Uint8Array(c.memory.buffer, c.dl_code_text(), len));
}

function refused() {
  const n = core().dl_code_refusal();
  return new Error(n ? text(n) : 'refused');
}

function ask(request) {
  const c = core();
  const t = enc.encode(request || '');
  new Uint8Array(c.memory.buffer, c.dl_tools_input(), t.length).set(t);
  if (!c.dl_tools_ask(t.length)) throw new Error(`the request is refused: ${request}`);
}

/** A loop's code: `seed`, `request` as text, `mutes` (a bit a layer) and `salt`. */
export function loopCode(seed, request = '', mutes = 0, salt = 0) {
  ask(request);
  const n = core().dl_code_write(seed >>> 0, mutes, salt >>> 0);
  if (!n) throw refused();
  return text(n);
}

/** A loop's code read: { seed, mutes, salt }, or a refusal thrown. */
export function readLoop(code) {
  const c = core();
  if (!c.dl_code_read(put(enc.encode(code)))) throw refused();
  return { seed: c.dl_code_seed() >>> 0, mutes: c.dl_code_mutes(), salt: c.dl_code_salt() >>> 0 };
}

/** The album of loops' `codes`, titled `title` (or none). */
export function albumCode(codes, title = '') {
  const t = enc.encode(title);
  const n = core().dl_code_album_write(put(new Uint8Array([...t, ...enc.encode(codes.join('.'))])), t.length);
  if (!n) throw refused();
  return text(n);
}

/** The album of `count` tracks drawn from `seed`, sharing `request`'s picks. */
export function seedAlbumCode(seed, count, request = '', title = '') {
  ask(request);
  const n = core().dl_code_album_seed(seed >>> 0, count, put(enc.encode(title)));
  if (!n) throw refused();
  return text(n);
}

/** An album's { title, tracks } (each track a loop's code). */
export function albumTracks(code) {
  const c = core();
  const len = put(enc.encode(code));
  const count = c.dl_code_album(len);
  if (!count) throw refused();
  const mem = new Uint8Array(c.memory.buffer, c.dl_code_text(), 64);
  const title = dec.decode(mem.slice(0, mem.indexOf(0)));
  const tracks = [];
  for (let i = 0; i < count; i++) {
    const n = c.dl_code_track(len, i);
    if (!n) throw refused();
    tracks.push(text(n));
  }
  return { title, tracks };
}

function main(argv) {
  const flag = (name) => {
    const i = argv.indexOf(name);
    if (i < 0) return null;
    const v = argv[i + 1];
    argv.splice(i, 2);
    return v;
  };
  const title = flag('--title') || '';
  const mutes = Number(flag('--mutes') || 0);
  const salt = Number(flag('--salt') || 0);
  const [what, ...rest] = argv;
  if (what === 'loop' && rest.length >= 1) {
    console.log(loopCode(Number(rest[0]), rest[1] || '', mutes, salt));
  } else if (what === 'read' && rest.length === 1) {
    const kind = (() => {
      put(enc.encode(rest[0]));
      return core().dl_code_kind(rest[0].length);
    })();
    if (kind === 2) {
      const a = albumTracks(rest[0]);
      if (a.title) console.log(`title: ${a.title}`);
      for (const t of a.tracks) {
        const l = readLoop(t);
        console.log(`${t}  seed ${l.seed}`);
      }
    } else {
      console.log(JSON.stringify(readLoop(rest[0])));
    }
  } else if (what === 'album' && rest.length >= 1) {
    console.log(albumCode(rest, title));
  } else if (what === 'seed-album' && rest.length >= 2) {
    console.log(seedAlbumCode(Number(rest[0]), Number(rest[1]), rest[2] || '', title));
  } else {
    console.error('usage: node tools/codes.mjs loop SEED [REQUEST] | read CODE | album [--title T] CODE... | seed-album SEED COUNT [REQUEST]');
    process.exit(2);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`codes: ${e.message}`);
    process.exit(1);
  }
}
