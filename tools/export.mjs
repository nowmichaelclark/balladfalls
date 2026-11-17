// The audio export's yardsticks in Node (queue item 104b): the export's own
// render (js/export-render.js, what js/export-worker.js runs) on the app's
// module (js/dlplayer.wasm, with the FLAC writer since session 20).
//
//   node tools/export.mjs                  the null checks and the sizes
//   node tools/export.mjs --hours H        also H hours exported to a file,
//                                          its memory sampled through the run
//   node tools/export.mjs --file F --job J null an exported file (F, from the
//                                          app) against a straight render of
//                                          its job (J, a JSON file:
//                                          tools/export-long.mjs writes both)
//   node tools/export.mjs --sizes N        N corpus loops for the sizes (24)
//
// The null checks: loops and pieces of each kind the sheet exports (a loop
// to a length, mono and stereo; the wander and its salt; mutes and edits; a
// finite piece whole, an arc whole, Endless to a length), each exported to a
// FLAC file a chunk at a time as the Worker does, then
//
//   - decoded by the reference decoder (`flac -t` and `flac -d`, else
//     `ffmpeg`): every frame's CRC and the MD5 in its header checked;
//   - nulled sample for sample against a straight render of the same loop:
//     the core block by block (`dl_play_process`, as the worklet plays),
//     with the same commands in the same order and the track's end at the
//     same frame, made integers by the core's rule (tools/flac.mjs's
//     `quantize`): every sample equal;
//   - its length: the track's end where the core counts it, then a tail of
//     at most TAIL_MAX seconds; nothing late, missed or dropped.
//
// The sizes: the bytes a second of FLAC takes on corpus loops of a minute,
// mono and stereo; the most of them is what js/export.js plans with
// (BYTES_PER_SECOND), and the check fails if any loop takes more.
//
// Needs `flac` or `ffmpeg` (dev-only). Exits 1 on any failure.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Render, ask, RATE, BITS, TAIL_MAX, FADE } from '../js/export-render.js';
import { decodeSong } from '../js/share.js';
import { askOf, LAYERS } from '../js/request.js';
import { LOOPS } from './stalls.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : dflt;
};
const HOURS = Number(flag('--hours', 0));
const SIZES = Number(flag('--sizes', 24));
const FILE = flag('--file', null);
const JOB = flag('--job', null);
// What js/export.js plans a second with, by lanes (BYTES_PER_SECOND).
const PLANNED = (() => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'export.js'), 'utf8');
  const m = /BYTES_PER_SECOND = \{ 1: (\d+), 2: (\d+) \}/.exec(src);
  return m ? { 1: Number(m[1]), 2: Number(m[2]) } : null;
})();

const QUANTUM = 128;
const MODULE = new WebAssembly.Module(fs.readFileSync(path.join(ROOT, 'js', 'dlplayer.wasm')));
const instance = () => new WebAssembly.Instance(MODULE, {}).exports;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dlexport-'));
let failures = 0;
const fail = (what) => {
  failures++;
  console.log(`  FAIL ${what}`);
};
const has = (cmd) => spawnSync('sh', ['-c', `command -v ${cmd}`]).status === 0;
const DECODER = has('flac') ? 'flac' : has('ffmpeg') ? 'ffmpeg' : null;

// Export `job` to `file` as the Worker does: the header, each chunk's bytes,
// the last, the finished header over the first 42 bytes. `sample(frames)` is
// called now and then (the memory run).
function exportTo(job, file, sample = null) {
  const x = instance();
  const r = new Render(x, job);
  const fd = fs.openSync(file, 'w');
  let at = 0;
  const put = (b) => {
    fs.writeSync(fd, b, 0, b.length, at);
    at += b.length;
  };
  put(r.first);
  let b;
  let next = 0;
  while ((b = r.step())) {
    if (b.length) put(b);
    if (sample && r.frames >= next) {
      sample(r.frames, x);
      next = r.frames + 600 * RATE;
    }
  }
  put(r.last());
  fs.writeSync(fd, r.header(), 0, 42, 0);
  fs.closeSync(fd);
  return { render: r, bytes: at, stopFrame: r.stopFrame, fade: r.fadeFrom };
}

// The same loop, straight: the core block by block, as the worklet plays it,
// with the same commands, and the core told to stop where the export told
// it (after the chunk in which it heard the track's end). A function that
// gives the next block's lanes (views, valid until the next call).
function straight(job, stop) {
  const x = instance();
  x.dl_init(RATE);
  x.dl_quality(1);
  if (job.layout === 2) x.dl_layout(2);
  x.dl_play_attach(1);
  x.dl_play_wander(job.wander || 0);
  x.dl_play_wander_salt((job.salt || 0) >>> 0);
  ask(x, job.ask);
  x.dl_play_load(job.seed >>> 0, 0);
  (job.mutes || []).forEach((m, i) => x.dl_play_mute(i, m ? 1 : 0));
  x.dl_play_track(job.track[0], job.track[1]);
  x.dl_play_ready();
  const lanes = x.dl_outputs();
  const out = Array.from({ length: lanes }, (_, c) => new Float32Array(x.memory.buffer, x.dl_out() + c * QUANTUM * 4, QUANTUM));
  let done = 0;
  return () => {
    if (stop && done === stop.frame) {
      x.dl_cancel_from(stop.time);
      x.dl_play_stop();
    }
    x.dl_play_process(done);
    done += QUANTUM;
    return out;
  };
}

// The core's rule (dlcore::flac::quantize).
function quantize(v, bits) {
  const full = 2 ** (bits - 1);
  if (Number.isNaN(v)) return 0;
  const s = v * full;
  const r = s < 0 ? s - 0.5 : s + 0.5;
  return Math.trunc(Math.min(Math.max(r, -full), full - 1));
}

function streaminfo(file) {
  const fd = fs.openSync(file, 'r');
  const b = Buffer.alloc(42);
  fs.readSync(fd, b, 0, 42, 0);
  fs.closeSync(fd);
  if (b.toString('latin1', 0, 4) !== 'fLaC') throw new Error(`${file}: not FLAC`);
  const si = b.subarray(8);
  const rate = (si[10] << 12) | (si[11] << 4) | (si[12] >> 4);
  const channels = ((si[12] >> 1) & 7) + 1;
  const bits = (((si[12] & 1) << 4) | (si[13] >> 4)) + 1;
  const total = (si[13] & 0x0f) * 2 ** 32 + si.readUInt32BE(14);
  return { rate, channels, bits, total, md5: si.subarray(18, 34).toString('hex') };
}

// Decoded to a file of interleaved 16-bit samples (the decoder checks every
// frame's CRC; the MD5 is checked here).
function decode(file) {
  const raw = `${file}.raw`;
  if (DECODER === 'flac') {
    const t = spawnSync('flac', ['-s', '-t', file], { encoding: 'utf8' });
    if (t.status !== 0) throw new Error(`flac -t ${file}: ${t.stderr}`);
    const d = spawnSync('flac', ['-s', '-d', '-f', '--force-raw-format', '--endian=little', '--sign=signed', '-o', raw, file], { encoding: 'utf8' });
    if (d.status !== 0) throw new Error(`flac -d ${file}: ${d.stderr}`);
  } else {
    const d = spawnSync('ffmpeg', ['-v', 'error', '-err_detect', 'crccheck+explode', '-y', '-i', file, '-f', 's16le', raw], { encoding: 'utf8' });
    if (d.status !== 0) throw new Error(`ffmpeg ${file}: ${d.stderr}`);
  }
  return raw;
}

// Null `file` (from `job`) against the straight render, every sample, a
// block at a time (a three-hour file is never held whole).
function nullCheck(label, job, file, info) {
  const si = streaminfo(file);
  const raw = decode(file);
  const lanes = job.layout === 2 ? 2 : 1;
  if (si.rate !== RATE || si.channels !== lanes || si.bits !== BITS) fail(`${label}: STREAMINFO ${JSON.stringify(si)}`);
  const frames = fs.statSync(raw).size / 2 / lanes;
  if (frames !== si.total) fail(`${label}: ${frames} frames decoded, ${si.total} in the header`);
  const next = straight(job, info.stop);
  const md5 = crypto.createHash('md5');
  const fd = fs.openSync(raw, 'r');
  const buf = Buffer.alloc(QUANTUM * 2 * lanes * 256);
  let differ = 0;
  let first = null;
  const fadeFrom = info.fade;
  let block = null;
  let used = QUANTUM;
  for (let at = 0; at < frames;) {
    const n = fs.readSync(fd, buf, 0, Math.min(buf.length, (frames - at) * 2 * lanes), at * 2 * lanes);
    md5.update(buf.subarray(0, n));
    for (let k = 0; k < n / 2 / lanes; k++, at++) {
      if (used === QUANTUM) {
        block = next();
        used = 0;
      }
      const g = fadeFrom == null || at < fadeFrom ? 1 : Math.max(0, 1 - (at - fadeFrom) / (FADE * RATE));
      for (let c = 0; c < lanes; c++) {
        let v = block[c][used];
        if (g !== 1) v = Math.fround(v * g);
        const got = buf.readInt16LE(2 * (k * lanes + c));
        const want = quantize(v, BITS);
        if (got !== want) {
          differ++;
          if (first == null) first = { frame: at, lane: c, got, want };
        }
      }
      used++;
    }
  }
  fs.closeSync(fd);
  fs.unlinkSync(raw);
  const sum = md5.digest('hex');
  if (sum !== si.md5) fail(`${label}: MD5 ${si.md5} in the header, ${sum} decoded`);
  if (differ) fail(`${label}: ${differ} samples differ from the straight render, the first ${JSON.stringify(first)} (${(first.frame / RATE).toFixed(3)} s)`);
  return { frames, differ };
}

const specOf = (code) => decodeSong(code);
function jobOf(spec, { layout = 2, wander = 1, salt = 0, track, mutes = [] } = {}) {
  return { seed: spec.seed >>> 0, ask: askOf(spec), mutes: LAYERS.map((l) => mutes.includes(l) || !!(spec.mutes && spec.mutes[l])), wander, salt, layout, track };
}

function nulls() {
  console.log(`export: the null checks (the export's render against a straight one; decoder ${DECODER})`);
  const shatter = specOf(LOOPS.shatter.code);
  const edited = { ...specOf(LOOPS.cinder.code) };
  edited.tone = { warmth: 0.13, space: 0.77, wobble: 0.21 };
  edited.bpm = Math.round(edited.bpm * 1.1);
  const piece = { ...specOf(LOOPS.piece.code), length: 48 };
  const arc = { ...specOf(LOOPS.arc.code), length: 96 };
  const endless = specOf(LOOPS.endless.code);
  const cases = [
    ['a loop to 16 bars, stereo', jobOf(shatter, { track: [2, 16] })],
    ['a loop to 8 bars, mono, wandering far with a salt', jobOf(shatter, { layout: 1, wander: 2.4, salt: 777, track: [2, 8] })],
    ['a loop to two passes, its drums muted, its tone and tempo edited', jobOf(edited, { mutes: ['drums'], track: [1, 2] })],
    ['a finite piece of 48 bars whole (24 sections of 2)', jobOf(piece, { track: [1, 1] })],
    ['an arc of 96 bars whole', jobOf(arc, { track: [1, 1] })],
    ['Endless to 24 bars', jobOf(endless, { track: [2, 24] })],
  ];
  for (const [label, job] of cases) {
    const file = path.join(tmp, 'case.flac');
    const t0 = process.hrtime.bigint();
    const out = exportTo(job, file);
    const took = Number(process.hrtime.bigint() - t0) / 1e9;
    const r = out.render;
    const n = nullCheck(label, job, file, { stop: out.stopFrame == null ? null : { frame: out.stopFrame, time: r.endTime }, fade: out.fade });
    const tail = (r.frames - r.endFrame) / RATE;
    const counts = r.counts();
    if (r.endFrame == null) fail(`${label}: the track's end was never heard`);
    if (r.seconds != null && Math.abs(r.endFrame / RATE - r.seconds) > 1) fail(`${label}: it ends at ${(r.endFrame / RATE).toFixed(2)} s, the core counted ${r.seconds.toFixed(2)} s`);
    if (!(tail >= 0 && tail <= TAIL_MAX + 0.1)) fail(`${label}: a tail of ${tail.toFixed(2)} s`);
    if (r.lateEnd) fail(`${label}: the end was heard after it was rendered`);
    if (counts.late || counts.missed || counts.dropped) fail(`${label}: late ${counts.late}, missed ${counts.missed}, dropped ${counts.dropped}`);
    if (r.refused) fail(`${label}: the core refused ${r.refused} parts of the request`);
    console.log(`  ${n.differ ? 'FAIL' : 'pass'}  ${label}: ${(r.endFrame / RATE).toFixed(2)} s and a ${tail.toFixed(2)} s tail${out.fade != null ? ' (faded)' : ''}, ${out.bytes} bytes, nulls (${n.frames} frames), ${(r.frames / RATE / took).toFixed(1)}x real time`);
  }
}

// The tempo of the loop of `seed`, as the core draws it.
function bpmOf(seed) {
  const x = instance();
  x.dl_init(RATE);
  x.dl_quality(0);
  x.dl_play_attach(0);
  x.dl_play_load(seed >>> 0, 0);
  x.dl_play_ready();
  const about = String.fromCharCode(...new Uint8Array(x.memory.buffer, x.dl_play_about_at(), x.dl_play_describe()));
  return Number(/^bpm=(.*)$/m.exec(about)[1]);
}

// Corpus loops of a minute: bytes a second, mono and stereo.
function sizes() {
  console.log(`\nexport: the sizes, ${SIZES} corpus loops of a minute (44.1 kHz, 16-bit, full quality)`);
  let s = 20261009;
  const next = () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0;
    return s;
  };
  const most = { 1: 0, 2: 0 };
  const all = { 1: [], 2: [] };
  for (let i = 0; i < SIZES; i++) {
    const seed = next();
    for (const layout of [1, 2]) {
      // A minute of the loop, whatever its tempo: bars enough.
      const bars = Math.ceil(60 / bpmOf(seed) * 15);
      const file = path.join(tmp, 'size.flac');
      const out = exportTo({ seed, ask: null, mutes: [], wander: 1, salt: 0, layout, track: [2, bars] }, file);
      const bps = out.bytes / (out.render.frames / RATE);
      all[layout].push(bps);
      most[layout] = Math.max(most[layout], bps);
    }
  }
  const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  for (const layout of [1, 2]) {
    const name = layout === 2 ? 'stereo' : 'mono';
    console.log(`  ${name}: median ${Math.round(med(all[layout]))} bytes a second, the most ${Math.round(most[layout])} (js/export.js plans ${PLANNED ? PLANNED[layout] : '?'}; a WAV is ${RATE * 2 * layout})`);
    if (PLANNED && most[layout] > PLANNED[layout]) fail(`${name}: a loop took ${Math.round(most[layout])} bytes a second, more than the ${PLANNED[layout]} js/export.js plans`);
  }
}

// H hours to a file, memory sampled every ten minutes of audio.
function long() {
  console.log(`\nexport: ${HOURS} hours of Endless exported, stereo, memory sampled every ten minutes of audio`);
  const endless = specOf(LOOPS.endless.code);
  const job = jobOf(endless, { track: [2, Math.ceil((HOURS * 3600) / ((60 / endless.bpm / 4) * 16))] });
  const file = path.join(tmp, 'long.flac');
  const samples = [];
  const t0 = process.hrtime.bigint();
  const out = exportTo(job, file, (frames, x) => {
    if (global.gc) global.gc();
    const m = process.memoryUsage();
    samples.push({ minutes: frames / RATE / 60, rss: m.rss, heap: m.heapUsed, wasm: x.memory.buffer.byteLength });
  });
  const took = Number(process.hrtime.bigint() - t0) / 1e9;
  const mb = (b) => (b / 1e6).toFixed(1);
  for (const s of samples) console.log(`  ${s.minutes.toFixed(0).padStart(4)} min: rss ${mb(s.rss)} MB, heap ${mb(s.heap)} MB, the core ${mb(s.wasm)} MB`);
  const later = samples.slice(1);
  const first = samples[1] || samples[0];
  const rss = Math.max(...later.map((s) => s.rss));
  const wasm = new Set(samples.map((s) => s.wasm));
  console.log(`  ${(out.render.frames / RATE / 3600).toFixed(2)} hours, a ${mb(out.bytes)} MB file, in ${(took / 60).toFixed(1)} min (${(out.render.frames / RATE / took).toFixed(1)}x real time)`);
  if (wasm.size !== 1) fail(`the core's memory moved: ${[...wasm].join(', ')}`);
  if (rss > first.rss * 1.1 + 8e6) fail(`memory grew: ${mb(first.rss)} MB to ${mb(rss)} MB`);
  const si = streaminfo(file);
  if (si.total !== out.render.frames) fail(`the header says ${si.total} frames, ${out.render.frames} rendered`);
  if (DECODER === 'flac') {
    const t = spawnSync('flac', ['-s', '-t', file], { encoding: 'utf8' });
    if (t.status !== 0) fail(`the long file does not decode: ${t.stderr}`);
    else console.log('  it decodes (flac -t: every frame and the MD5)');
  }
}

// An exported file against a straight render of its job: the job as the
// page sent it to the export's Worker, with where the Worker stopped the
// core and where the tail's fade began (its `done` message), as
// tools/export-long.mjs writes them.
function fileCheck() {
  const { job, stop, fade } = JSON.parse(fs.readFileSync(JOB, 'utf8'));
  console.log(`export: ${FILE} against a straight render of its job`);
  const n = nullCheck(path.basename(FILE), job, FILE, { stop, fade });
  console.log(`  ${n.differ ? 'FAIL' : 'pass'}  ${n.frames} frames (${(n.frames / RATE / 60).toFixed(1)} min): it decodes and nulls`);
}

try {
  if (!DECODER) throw new Error('no reference decoder: install flac (or ffmpeg)');
  if (FILE && JOB) fileCheck();
  else {
    nulls();
    if (SIZES > 0) sizes();
    if (HOURS > 0) long();
  }
} catch (e) {
  console.error(e.stack || e.message);
  failures++;
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures ? `\nexport: ${failures} failures` : '\nexport: every check passed');
process.exit(failures ? 1 : 0);
