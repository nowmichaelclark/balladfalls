// What never comes unasked: over the corpus's
// loops with nothing picked, every value the generator can draw and how
// often it came, against the list of everything it can draw, and the values
// that never came.
//
// Run with:  node tools/unasked.mjs [--n 10000] [--seed 20261009] [--all]
//            node tools/unasked.mjs --check      (exit 1 on a yardstick missed)
//
// Needs the tools' build first: tools/build-core.sh --tools
// (tools/gen-lib.mjs reads everything the generator decides). About ten
// milliseconds a loop.
//
// The corpus is the corpus seed's own stream, a loop a `seed32()`
// (tools/clips.mjs's `corpus: [20261009, i]`), each made with no request at
// all: no vibes, no tempo, no length, no style, nothing pinned, as the app's
// first loop and its die make one with every picker at "any".
//
// What it can draw is read from the data, never typed here: the lists of
// every name a code carries (`data/codes.txt`: the styles, the moods, the
// modes, the voices of each layer, the bass styles, the journeys, the batch
// 6 choices and their options, the settings' words), each style's gaits and
// bars (`data/characters.txt`), the melody's cells (`core/src/generator/
// melody.rs`'s tables), the twelve keys and the four metres. What was drawn
// is read from the core's parts (`parts`: the spec, the meta, the choices,
// what is drawn at load, the harmony and every note's voice) and, for a long
// piece, its map's form (`pieceMap`: the journey, the second theme, the
// small form, the grain). Planing (`progression.kind`) is read by playing
// the loop again with it pinned to today: a loop whose chords then move
// planes.
//
// A value that never came is listed under one of three heads: **asked
// only** (it is a pick's, never drawn: a vibe, a theme, Endless, a length
// the Bars picker sets), **rare** (drawn, but under about one loop in
// --n: shown with its expected share where the data says it), or
// **never** (a bug: the data lists it and nothing draws it).
//
// `--check` holds the yardsticks: with nothing asked, 9% to 11% of
// loops are long pieces, every one 64 to 512 bars with a journey, and no
// loop is Endless.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parts, pieceMap, metreOf, newSpec } from './gen-lib.mjs';
import { parseData } from '../js/data.js';
import { Rng } from '../js/rng.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LAYERS = ['drums', 'bass', 'chords', 'melody', 'texture'];

const opts = { n: 10000, seed: 20261009, all: false, check: false };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--n') opts.n = Number(process.argv[++i]);
  else if (a === '--seed') opts.seed = Number(process.argv[++i]);
  else if (a === '--all') opts.all = true;
  else if (a === '--check') opts.check = true;
  else if (a === '--help') {
    console.log('node tools/unasked.mjs [--n 10000] [--seed 20261009] [--all] [--check]');
    process.exit(0);
  } else throw new Error(`unasked: unknown option ${a}`);
}

// ------------------------------------------------------------ what it can draw

const read = (name) => parseData(fs.readFileSync(path.join(ROOT, 'data', `${name}.txt`), 'utf8'), `data/${name}.txt`);
// data/codes.txt's lists, read here: its blocks name settings with a dot
// ("[words arc.shape]"), which the data format's block names don't take.
const CODES = [];
for (const raw of fs.readFileSync(path.join(ROOT, 'data', 'codes.txt'), 'utf8').split('\n')) {
  const line = raw.replace(/#.*/, '').trimEnd();
  const head = /^\[(\S+) (\S+)\]$/.exec(line);
  if (head) CODES.push({ kind: head[1], name: head[2], entries: [] });
  else if (/^\S+\s*=/.test(line) && CODES.length) CODES[CODES.length - 1].entries.push([line.split('=')[0].trim(), line.slice(line.indexOf('=') + 1)]);
  else if (/^\s+\S/.test(line) && CODES.length) {
    const e = CODES[CODES.length - 1].entries;
    if (e.length) e[e.length - 1][1] += ` ${line}`;
  }
}
for (const b of CODES) b.entries = b.entries.map(([k, v]) => [k, v.split(',').map((row) => row.trim().split(/\s+/)).filter((r) => r[0])]);
const CHARACTERS = read('characters');
const entry = (block, key) => (block.entries.find((e) => e[0] === key) || [null, null])[1];
// A list of `data/codes.txt` by its block, the members not taken out.
const listOf = (kind, name) => {
  const b = CODES.find((x) => x.kind === kind && x.name === name);
  if (!b) throw new Error(`data/codes.txt has no [${kind} ${name}]`);
  return entry(b, 'ids').filter((row) => row[3] !== 'gone').map((row) => row[0]);
};

const styles = CHARACTERS.filter((b) => b.kind === 'character').map((b) => b.name);
const gaits = [];
const barsOf = {};
for (const b of CHARACTERS.filter((x) => x.kind === 'character')) {
  barsOf[b.name] = (entry(b, 'bars') || []).map((row) => Number(row[0]));
  for (const row of entry(b, 'gaits') || []) gaits.push(`${b.name} ${row[1]}`);
}
const cells = [...fs.readFileSync(path.join(ROOT, 'core', 'src', 'generator', 'melody.rs'), 'utf8')
  .matchAll(/^\s*c\("(\w+)",/gm)].map((m) => m[1]);
const choices = listOf('code', 'choices');

// Each measure: a name, the values it can take (null: open, as a tempo),
// and a head for a value that never came unasked by the data's own rule
// (`asked`: only a pick's; `none` for everything that should come).
const MEASURES = [];
const counts = new Map();
function measure(name, values, why = {}) {
  MEASURES.push({ name, values, why });
  counts.set(name, new Map());
}
const seen = (name, value) => {
  const m = counts.get(name);
  m.set(String(value), (m.get(String(value)) || 0) + 1);
};

const LONG = [64, 512];
measure('style (leading)', styles);
measure('style (in the mix)', styles);
measure('mood', listOf('code', 'moods'));
measure('vibe', listOf('code', 'vibes'), { all: 'asked' });
measure('mode', listOf('code', 'scales'));
measure('key', ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);
measure('metre', ['4/4', '6/8', '3/4', '5/4']);
measure('gait (style, metre)', gaits);
measure('tempo (bpm, by tens)', null);
measure('loop bars', [...new Set(Object.values(barsOf).flat())].sort((a, b) => a - b).map(String));
measure('loop bars (leading style, bars; a mix draws from its blend)', Object.entries(barsOf).flatMap(([s, list]) => list.map((n) => `${s} ${n}`)));
measure('length', ['loop', 'long', 'endless'], { endless: 'asked' });
measure('long length (bars)', null);
measure('journey', listOf('code', 'journeys'));
measure('long: second theme', ['yes', 'no']);
measure('long: form', ['small', 'full']);
measure('theme (a friend loop)', ['none', 'held'], { held: 'asked' });
for (const layer of LAYERS) measure(`voice ${layer}`, listOf('voices', layer));
measure('bass style', listOf('code', 'bassStyles'));
measure('melody cell', cells);
measure('choir', ['no', 'yes']);
measure('own cycles (drifting)', ['no', 'yes']);
measure('airy form', ['no', 'yes']);
for (const c of choices) measure(`choice ${c}`, listOf('options', c));
for (const w of ['arc.shape', 'lateFloor.order', 'progression.kind', 'lowBell.kind', 'lowBell.drops', 'twang.kind']) measure(`word ${w}`, listOf('words', w));
measure('tuning (cents)', ['0', 'off 0']);
measure('stab (dubStab) kind', null);

// ------------------------------------------------------------ the corpus

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const lead = (mix) => Object.entries(mix || {}).sort((a, b) => b[1] - a[1])[0][0];
const sameChords = (a, b) => JSON.stringify(a.harmony && a.harmony.slots) === JSON.stringify(b.harmony && b.harmony.slots);
const firsts = new Map(); // `measure value` -> the first corpus index that drew it
const longs = [];
const missed = [];
const rng = new Rng(opts.seed);
const t0 = Date.now();
for (let i = 0; i < opts.n; i++) {
  const seed = rng.seed32();
  const p = parts(seed, null);
  const s = p.spec;
  const mark = (name, value) => {
    seen(name, value);
    const k = `${name}\u0000${value}`;
    if (!firsts.has(k)) firsts.set(k, i);
  };
  const style = lead(s.mix);
  mark('style (leading)', style);
  for (const k of Object.keys(s.mix || {})) mark('style (in the mix)', k);
  for (const k of Object.keys(s.feelMix || {})) mark('mood', k);
  for (const k of Object.keys(s.vibes || {})) mark('vibe', k);
  mark('mode', s.scale);
  mark('key', KEYS[s.root]);
  const metre = metreOf(newSpec(seed, null));
  mark('metre', metre);
  if (gaits.some((g) => g.startsWith(`${style} `))) mark('gait (style, metre)', `${style} ${metre}`);
  mark('tempo (bpm, by tens)', `${Math.floor(s.bpm / 10) * 10}s`);
  mark('loop bars', s.bars);
  mark('loop bars (leading style, bars; a mix draws from its blend)', `${style} ${s.bars}`);
  const length = s.length == null ? 'loop' : s.length === 'endless' ? 'endless' : s.length > 32 ? 'long' : 'loop';
  mark('length', length);
  if (length === 'long' || length === 'endless') {
    const map = pieceMap(seed, null, 0, 1);
    const journey = map && map.form && map.form.journey;
    longs.push({ i, seed, name: s.name, bars: s.length, loopBars: s.bars, bpm: s.bpm, stepsPerBar: s.stepsPerBar, journey, style });
    mark('long length (bars)', s.length);
    if (journey) mark('journey', journey);
    if (map && map.form) {
      mark('long: second theme', map.form.second ? 'yes' : 'no');
      mark('long: form', map.form.small ? 'small' : 'full');
    }
    if (length === 'endless' || !(s.length >= LONG[0] && s.length <= LONG[1]) || !journey) missed.push(`#${i} ${s.name}: ${s.length} bars, journey ${journey}`);
  }
  mark('theme (a friend loop)', s.theme != null ? 'held' : 'none');
  if (p.drums.length) mark('voice drums', p.meta.kit || '(no kit named)');
  mark('voice bass', p.meta.bassVoice || 'none');
  const chordVoices = new Set(p.chords.map((e) => e.voice).filter(Boolean));
  for (const v of chordVoices) mark('voice chords', v);
  const melodyVoices = new Set(p.melody.map((e) => e.voice).filter(Boolean));
  if (p.meta.melodyVoice) melodyVoices.add(p.meta.melodyVoice);
  for (const v of melodyVoices) mark('voice melody', v);
  mark('voice texture', p.meta.textureKind || 'none');
  if (p.meta.bassStyle) mark('bass style', p.meta.bassStyle);
  if (p.meta.melodyCell) mark('melody cell', p.meta.melodyCell);
  mark('choir', chordVoices.has('vowel') || chordVoices.has('hum') ? (melodyVoices.has('vowel') || melodyVoices.has('hum') ? 'yes' : 'no') : 'no');
  mark('own cycles (drifting)', s.cycles ? 'yes' : 'no');
  mark('airy form', p.form && p.form.form ? 'yes' : 'no');
  for (const c of choices) mark(`choice ${c}`, p.choices[c]);
  const l = p.load;
  if (l.arc && l.arc.shape) mark('word arc.shape', l.arc.shape);
  if (l.late && l.late.order) mark('word lateFloor.order', l.late.order);
  mark('word lowBell.kind', l.lowBell || 'today');
  mark('word lowBell.drops', l.lowBellDrops ? 'on' : 'today');
  mark('word twang.kind', l.twang || 'today');
  if (l.stab && l.stab.kind) mark('stab (dubStab) kind', l.stab.kind);
  mark('tuning (cents)', l.tuning ? 'off 0' : '0');
  // Planing: the loop again with progression.kind pinned to today.
  const today = parts(seed, 'progression.kind=today');
  mark('word progression.kind', sameChords(p.form, today.form) ? 'today' : 'planing');
}
const seconds = (Date.now() - t0) / 1000;

// ------------------------------------------------------------ the report

const n = opts.n;
const pct = (k) => `${((100 * k) / n).toFixed(k && k < n / 1000 ? 3 : 2)}%`;
const out = [];
out.push(`What never comes unasked: ${n} loops of corpus seed ${opts.seed}, nothing asked (${seconds.toFixed(0)} s)`);
out.push('');
const never = { asked: [], never: [] };
for (const m of MEASURES) {
  const got = counts.get(m.name);
  const values = m.values || [...got.keys()].sort((a, b) => (Number.parseFloat(a) - Number.parseFloat(b)) || a.localeCompare(b));
  const missing = m.values ? m.values.filter((v) => !got.has(String(v))) : [];
  // The values drawn that the list doesn't hold: not a bug of this tool's
  // to hide (a name the core writes in Rust, as a texture's "none").
  const extra = m.values ? [...got.keys()].filter((v) => !m.values.map(String).includes(v)) : [];
  out.push(`${m.name}:`);
  if (m.why.all && !got.size) {
    out.push(`  none drawn, all ${values.length} a pick's`);
    never.asked.push(`${m.name}: all ${values.length}`);
    continue;
  }
  const shown = values.map((v) => `${v} ${got.has(String(v)) ? (opts.all || got.get(String(v)) < n / 100 ? `${got.get(String(v))}` : pct(got.get(String(v)))) : '-'}`);
  out.push(`  ${shown.join(', ')}`);
  if (extra.length) out.push(`  also drawn (not in its list): ${extra.map((v) => `${v} ${got.get(v)}`).join(', ')}`);
  const heads = { asked: [], never: [] };
  for (const v of missing) heads[(m.why.all || m.why[v]) === 'asked' ? 'asked' : 'never'].push(v);
  if (heads.asked.length) never.asked.push(`${m.name}: ${heads.asked.join(', ')}`);
  if (heads.never.length) never.never.push(`${m.name}: ${heads.never.join(', ')}`);
}
out.push('');
out.push(`Long pieces drawn: ${longs.length} of ${n} (${pct(longs.length)})`);
const arcs = longs.filter((x) => x.journey === 'arc').length;
out.push(`  journeys: arc ${arcs}, wander ${longs.filter((x) => x.journey === 'wander').length}, none ${longs.filter((x) => !x.journey).length}`);
if (longs.length) {
  const mins = longs.map((x) => (x.bars * x.stepsPerBar * 15) / x.bpm / 60).sort((a, b) => a - b);
  out.push(`  their play, once round: ${mins[0].toFixed(1)} to ${mins[mins.length - 1].toFixed(1)} minutes, median ${mins[mins.length >> 1].toFixed(1)}`);
  out.push(`  the first few: ${longs.slice(0, 6).map((x) => `#${x.i} ${x.name} (${x.seed}) ${x.bars} bars ${x.journey}`).join('; ')}`);
}
out.push('');
out.push('Never came, only asked (a pick\'s, never drawn):');
out.push(never.asked.length ? `  ${never.asked.join('; ')}` : '  none');
out.push('Never came, listed and drawn by nothing here (look at each):');
out.push(never.never.length ? `  ${never.never.join('; ')}` : '  none');
console.log(out.join('\n'));

if (opts.check) {
  const share = longs.length / n;
  const fails = [];
  if (!(share >= 0.09 && share <= 0.11)) fails.push(`long pieces ${pct(longs.length)}, not 9% to 11%`);
  if (missed.length) fails.push(`long pieces out of 64 to 512 bars or with no journey: ${missed.slice(0, 5).join('; ')}`);
  if (fails.length) {
    console.log(`\nunasked --check: FAIL\n  ${fails.join('\n  ')}`);
    process.exit(1);
  }
  console.log('\nunasked --check: pass');
}
