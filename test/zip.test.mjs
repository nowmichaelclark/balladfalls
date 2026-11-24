// The album's zip (js/zip.js, item 121): CRC-32 against zlib's, a patch's
// checksum folded in against the patched bytes' own, and a zip of a few
// entries (one dropped, one patched, UTF-8 names) read back here from the
// spec and, where it is installed, by `unzip` (its test and its listing).
//
//   node test/zip.test.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { crc32, crcPatched, ZipWriter, entryName } from '../js/zip.js';

let failures = 0;
let checks = 0;
const check = (ok, what) => {
  checks++;
  if (!ok) {
    failures++;
    console.log(`  FAIL ${what}`);
  }
};

const bytes = (n, seed) => {
  const b = new Uint8Array(n);
  let x = seed >>> 0;
  for (let i = 0; i < n; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    b[i] = x >>> 24;
  }
  return b;
};

console.log('zip: the checksum');
for (const n of [0, 1, 7, 255, 4096, 100003]) {
  const b = bytes(n, n + 1);
  check(crc32(b) === zlib.crc32(b), `CRC-32 of ${n} bytes is zlib's`);
  const half = Math.floor(n / 2);
  check(crc32(b.subarray(half), crc32(b.subarray(0, half))) === zlib.crc32(b), `CRC-32 of ${n} bytes in two runs is zlib's of the whole`);
}

console.log('zip: a patch folded into the checksum');
for (const [n, at, k] of [[42, 0, 42], [100, 0, 42], [100003, 0, 42], [100003, 1000, 16], [5000, 4990, 10], [1 << 20, 4, 42]]) {
  const b = bytes(n, n ^ at);
  const before = b.slice(at, at + k);
  const after = bytes(k, n + at + 7);
  const crc = crc32(b);
  b.set(after, at);
  check(crcPatched(crc, n, at, before, after) === crc32(b), `${k} bytes at ${at} of ${n}: the folded checksum is the patched bytes' own`);
}

console.log('zip: an album of entries, read back');
function memorySink() {
  const parts = [];
  let size = 0;
  return {
    parts,
    write(b) { parts.push(Uint8Array.from(b)); size += b.length; },
    writeAt(at, b) {
      let off = 0;
      for (const p of parts) {
        if (at >= off && at < off + p.length) {
          if (at + b.length > off + p.length) throw new Error('a patch across writes');
          p.set(b, at - off);
          return;
        }
        off += p.length;
      }
      throw new Error(`no write at ${at}`);
    },
    bytes() {
      const out = new Uint8Array(size);
      let off = 0;
      for (const p of parts) { out.set(p, off); off += p.length; }
      return out;
    },
  };
}

const sink = memorySink();
const zip = new ZipWriter(sink, { date: new Date(2026, 10, 24, 9, 30, 12) });
const names = ['01 ham-nuir.flac', '02 ฝนตก 🎧.flac', '03 dropped.flac', '04 last.opus'];
const bodies = [bytes(70000, 1), bytes(1234, 2), bytes(5000, 3), bytes(300, 4)];
const finalBody = [];
for (let i = 0; i < names.length; i++) {
  await zip.begin(names[i]);
  const b = bodies[i];
  // As the export writes a FLAC: the first 42 bytes their own write, the rest in runs.
  await zip.add(b.subarray(0, 42));
  for (let at = 42; at < b.length; at += 4096) await zip.add(b.subarray(at, Math.min(b.length, at + 4096)));
  if (i === 2) { zip.drop(); continue; }
  const body = Uint8Array.from(b);
  if (i < 2) {
    const after = bytes(42, 99 + i);
    await zip.patch(0, b.subarray(0, 42), after);
    body.set(after, 0);
  }
  finalBody.push([names[i], body]);
  await zip.end();
}
const total = await zip.finish();
const file = sink.bytes();
check(total === file.length, `finish says the zip's size (${total} = ${file.length})`);

// The spec's way: the end record, the central directory, each local header.
const dv = new DataView(file.buffer);
const eocd = file.length - 22;
check(dv.getUint32(eocd, true) === 0x06054b50, 'the end of the central directory is last');
const count = dv.getUint16(eocd + 10, true);
check(count === 3, `three entries listed, the dropped one left out (${count})`);
let at = dv.getUint32(eocd + 16, true);
const dec = new TextDecoder();
const read = [];
for (let i = 0; i < count; i++) {
  check(dv.getUint32(at, true) === 0x02014b50, `entry ${i}: a central header`);
  const crc = dv.getUint32(at + 16, true);
  const size = dv.getUint32(at + 20, true);
  const nlen = dv.getUint16(at + 28, true);
  const flags = dv.getUint16(at + 8, true);
  const name = dec.decode(file.subarray(at + 46, at + 46 + nlen));
  const local = dv.getUint32(at + 42, true);
  check(dv.getUint32(local, true) === 0x04034b50 && dv.getUint32(local + 14, true) === crc && dv.getUint32(local + 18, true) === size && dv.getUint16(local + 8, true) === 0,
    `${name}: its local header stored, with the central header's checksum and size`);
  const data = file.subarray(local + 30 + dv.getUint16(local + 26, true), local + 30 + dv.getUint16(local + 26, true) + size);
  check((flags & 0x0800) === 0x0800, `${name}: marked UTF-8`);
  check(crc === zlib.crc32(data), `${name}: the checksum is its bytes'`);
  read.push([name, data]);
  at += 46 + nlen;
}
check(read.length === finalBody.length && read.every(([n, d], i) => n === finalBody[i][0] && Buffer.compare(Buffer.from(d), Buffer.from(finalBody[i][1])) === 0),
  'each entry holds its track\'s bytes as they ended (the patched header in them)');
check(entryName('a/b:c') === 'a-b-c', 'a name loses its slashes');

const has = (cmd) => spawnSync('sh', ['-c', `command -v ${cmd}`]).status === 0;
if (has('unzip')) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dlzip-'));
  const f = path.join(dir, 'album.zip');
  fs.writeFileSync(f, file);
  const t = spawnSync('unzip', ['-t', f], { encoding: 'utf8' });
  check(t.status === 0 && /No errors detected/.test(t.stdout), `unzip -t: no errors (${t.stdout.trim().split('\n').pop()} ${t.stderr.trim()})`);
  const out = path.join(dir, 'out');
  const x = spawnSync('unzip', ['-q', f, '-d', out], { encoding: 'utf8' });
  const got = x.status === 0 ? fs.readdirSync(out).sort() : [];
  check(x.status === 0 && got.length === 3 && finalBody.every(([n, d]) => got.includes(n) && Buffer.compare(fs.readFileSync(path.join(out, n)), Buffer.from(d)) === 0),
    `unzip takes out the three tracks by their UTF-8 names, each its bytes (${got.join(' | ')})`);
  fs.rmSync(dir, { recursive: true, force: true });
} else {
  console.log('zip: no unzip here: its checks are skipped');
}

console.log(failures ? `\nzip: ${failures} of ${checks} checks failed` : `\nzip: all ${checks} checks passed`);
process.exit(failures ? 1 : 0);
