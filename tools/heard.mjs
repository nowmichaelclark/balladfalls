// What the layers draw against what each layer sounds, note by note
// (session 30b, queue item 110).
//
//   node tools/heard.mjs [--quick] [--json <file>] [--model page|composed]
//                        [--module <dltools.wasm>]
//   node tools/heard.mjs --steps <seed> [--request <request>] [--jump]
//
// It plays loops on the player in Node (the tools' build: the module the app
// plays, with a log of every note that takes a voice), takes the player's
// events and grids as the page takes them, and asks the page's own drawing
// model what the layers show at the moment each step is heard. Against it,
// what each layer's channel actually sounds there: every note the core
// started on that step, at its velocity times its channel's gain as it began
// (the listener's mute and a long piece's plan, against the channel's own
// level) and what a fade left it (a crossfade, a jump, a note let go). A note
// the budget refused never starts, so it is not heard.
//
// For each case it counts, over every step and layer:
//
// - drawn, not heard: a dot where the layer sounds no note (or one too quiet
//   to hear, under HEARD_LEAST);
// - heard, not drawn: a note heard where the layer shows no dot;
// - the loudness drawn against the loudness heard, on the steps that have
//   both: how far apart, in dB, once each layer's own scale is taken out
//   (a chord's notes are softer than the chord, so the scale is the layer's
//   median through each loop); over every step and over the quiet ones
//   (where the layer's channel is under QUIET of its level).
//
// The cases: plain loops of the corpus (corpus seed 20261009) at full and
// lite, long pieces through their quiet and fading sections (an arc, a
// wander, Endless), a jump within a piece, and a track's close where the
// length slider stops a piece. `--model composed` draws as the page did
// before item 110 (the layers' grid of each pass, as composed), for the
// figures before, with `--module` a tools' build of main from before (its
// grid as composed: build main's with the note log, core/src/lib.rs's
// `begun`); the default is the page as it is, on this build.
//
// `--steps` plays one loop for a minute (a jump to its fourth section 20 s
// in with `--jump`) and prints each step where the drawing and the heard
// part: drawn or not against heard or not, or more than 3 dB apart (layer:
// drawn/heard/share), to find what a figure counts.
//
// Needs the tools' build (tools/build-core.sh --tools, made on first use).

import fs from 'node:fs';
import { Rng } from '../js/rng.js';
import { player, aboutOf, QUANTUM } from './play-lib.mjs';
import { DRAWN_LEAST, HEARD_LEAST, HeardSteps } from '../js/heard.js';

const args = process.argv.slice(2);
const has = (k) => args.includes(k);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
if (has('--help')) {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
  process.exit(0);
}
const QUICK = has('--quick');
const MODEL = opt('--model', 'page');
const MODULE = opt('--module', null);
const RATE = 44100;
const CORPUS = 20261009;

// A note under HEARD_LEAST, its velocity times its channel's share, is not
// heard; the page draws none under the same line once the loudness is rounded
// into its event (js/heard.js, DRAWN_LEAST).
// A step whose layer's channel is under this share of its own level is a
// quiet one (a long piece's plan has it down, or a fade).
const QUIET = 0.8;
// The channels' own gains, in the core's channel order (CHANNEL_GAIN in
// core/src/player/synth.rs), and each channel's layer (the generator's
// order: drums, bass, chords, melody, texture).
const CHANNEL_GAIN = (() => {
  const src = fs.readFileSync(new URL('../core/src/player/synth.rs', import.meta.url), 'utf8');
  const m = src.match(/pub const CHANNEL_GAIN: \[f64; 5\] = \[([^\]]+)\]/);
  return m[1].split(',').map(Number);
})();
const LAYER_OF_CHANNEL = [3, 2, 1, 4, 0];
const LAYERS = ['drums', 'bass', 'chords', 'melody', 'texture'];
const KIND = { step: 0, pass: 1, section: 2, phrase: 3, loop: 4, revised: 5, end: 6, own: 7, jump: 8, heard: 9 };

// The page before item 110: the grid of the pass heard, as composed, drawn a
// bar at a time when the playhead enters the bar (js/main.js's onStep).
class ComposedModel {
  constructor() {
    this.grids = [];
    this.live = null;
    this.current = 0;
  }

  event(e, grid) {
    if (grid) this.grids.push({ time: e.time, grid });
  }

  at(time) {
    while (this.grids.length && this.grids[0].time <= time) this.live = this.grids.shift().grid;
  }

  bar(bar, spb) {
    const g = this.live;
    return LAYERS.map((_, l) => {
      const row = g ? g[l] : [];
      return Array.from({ length: spb }, (_, c) => (row.length ? row[(bar * spb + c) % row.length] || 0 : 0));
    });
  }
}

// The page as it is: js/heard.js's HeardSteps, fed the same events and grids
// the page is fed, asked what the layers show as each step is heard.
class PageModel {
  constructor() {
    this.heard = new HeardSteps();
  }

  get current() {
    return this.heard.current;
  }

  event(e, grid) {
    this.heard.event(e.time, e.kind, e.number, e.step, grid);
  }

  at(time) {
    this.heard.at(time);
  }

  bar(bar, spb, from, run) {
    return this.heard.bar(bar, spb, from, run).loud;
  }
}

// How long after the core makes an event the page has it, at most: the
// worklet posts every EVENTS_EVERY (50 ms) of audio; the page's playhead
// is taken to hear a step at its time (no output latency, the worst case
// for the events to be in).
const POSTED = 0.05;

// One case: `seconds` of the loop of `seed` asked `request`, at full or lite;
// `script(x, t)` is called before each block (a jump, a track), and the
// steps counted are those heard from `from` seconds on.
function play({ seed, request = '', full = true, seconds, script = null, from = 0 }) {
  const x = player(seed, { tools: true, request, full, module: MODULE });
  const spb = Number((aboutOf(x).match(/steps_per_bar=(\d+)/) || [])[1]) || 16;
  const model = MODEL === 'composed' ? new ComposedModel() : new PageModel();
  const events = [];
  const steps = [];
  const notes = [];
  for (let f = 0; f < seconds * RATE; f += QUANTUM) {
    if (script) script(x, f / RATE);
    x.dl_play_process(f);
    const n = x.dl_play_events();
    const ev = new Float64Array(x.memory.buffer, x.dl_play_event_at(), 4 * n).slice();
    for (let i = 0; i < n; i++) {
      const e = { time: ev[4 * i], kind: ev[4 * i + 1], number: ev[4 * i + 2], step: ev[4 * i + 3], arrives: f / RATE + POSTED };
      // The grids the worklet reads with an event that begins a pass.
      if ([KIND.pass, KIND.section, KIND.loop, KIND.revised, KIND.jump].includes(e.kind)) {
        e.grid = LAYERS.map((_, l) => Array.from(new Float64Array(x.memory.buffer, x.dl_play_grid_at(), x.dl_play_grid(l))));
      }
      events.push(e);
      if (e.kind === KIND.step) steps.push({ time: e.time, number: e.number, abs: e.step, heard: [0, 0, 0, 0, 0], share: [1, 1, 1, 1, 1], drawn: null, first: null, e });
    }
    const m = x.dl_tools_begun();
    const b = new Float64Array(x.memory.buffer, x.dl_tools_begun_at(), 10 * m).slice();
    for (let i = 0; i < m; i++) {
      const r = b.subarray(10 * i, 10 * i + 10);
      if (r[0] > 4) continue;
      notes.push({ channel: r[0], step: r[3], ord: r[4], time: r[5] / RATE, vel: r[6], share: (r[7] / CHANNEL_GAIN[r[0]]) * r[8] });
    }
  }
  // Each note to the step it was decided on: its step in its pass, the
  // nearest in time (a swing, a strum, a roll's offset, a grace before).
  const byNumber = new Map();
  for (const s of steps) {
    if (!byNumber.has(s.number)) byNumber.set(s.number, []);
    byNumber.get(s.number).push(s);
  }
  let unplaced = 0;
  for (const n of notes) {
    const list = byNumber.get(n.step) || [];
    let best = null;
    for (const s of list) if (!best || Math.abs(s.time - n.time) < Math.abs(best.time - n.time)) best = s;
    if (!best || Math.abs(best.time - n.time) > 0.6) {
      unplaced++;
      continue;
    }
    const l = LAYER_OF_CHANNEL[n.channel];
    const loud = n.vel * n.share;
    if (loud > best.heard[l]) {
      best.heard[l] = loud;
      best.share[l] = n.share;
    }
  }
  // The page, as the music is heard: the events in as they arrive, a step's
  // run as its event arrives, and at each step's time what its bar shows
  // (the bar as first shown, when the playhead enters it, and as the step is
  // heard).
  const queue = [...steps].sort((a, b) => a.time - b.time);
  const arriving = [...events].sort((a, b) => a.arrives - b.arrives);
  let k = 0;
  let barShown = null;
  let barRow = null;
  for (const s of queue) {
    while (k < arriving.length && arriving[k].arrives <= s.time) {
      const e = arriving[k++];
      model.event(e, e.grid || null);
      if (e.kind === KIND.step) e.run = model.current;
    }
    model.at(s.time);
    const bar = Math.floor(s.number / spb);
    const col = s.number % spb;
    const from = s.abs - col;
    const key = `${s.e.run}:${from}`;
    const row = model.bar(bar, spb, from, s.e.run);
    if (key !== barShown) {
      barShown = key;
      barRow = row;
    }
    s.drawn = row.map((r) => r[col] || 0);
    s.first = barRow.map((r) => r[col] || 0);
  }
  const counted = steps.filter((s) => s.time >= from && s.time <= seconds - 0.5);
  return { steps: counted, unplaced, spb };
}

// The figures of a case's steps.
function figures(steps) {
  const f = { steps: steps.length, pops: 0, dots: 0, heard: 0, drawnNotHeard: 0, heardNotDrawn: 0, quietHeard: 0, quietDrawnNotHeard: 0, quietHeardNotDrawn: 0, db: [], quietDb: [] };
  // Each loop's own scale for each layer: the median of drawn against heard
  // on its steps with both (a chord's notes are softer than the chord by its
  // spread, the same through a loop).
  const scales = new Map();
  for (const s of steps) {
    for (let l = 0; l < 5; l++) {
      if (s.heard[l] < HEARD_LEAST || s.drawn[l] < DRAWN_LEAST) continue;
      const k = `${s.run}:${l}`;
      if (!scales.has(k)) scales.set(k, []);
      scales.get(k).push(20 * Math.log10(s.drawn[l] / s.heard[l]));
    }
  }
  const scaleOf = (run, l) => median(scales.get(`${run}:${l}`) || []);
  for (const s of steps) {
    for (let l = 0; l < 5; l++) {
      const heard = s.heard[l] >= HEARD_LEAST;
      const drawn = s.drawn[l] >= DRAWN_LEAST;
      const quiet = s.share[l] < QUIET;
      if (heard) f.heard++;
      if (drawn) f.dots++;
      if ((s.first[l] >= DRAWN_LEAST) !== drawn) f.pops++;
      if (heard && quiet) f.quietHeard++;
      if (drawn && !heard) {
        f.drawnNotHeard++;
        if (quiet) f.quietDrawnNotHeard++;
      }
      if (heard && !drawn) {
        f.heardNotDrawn++;
        if (quiet) f.quietHeardNotDrawn++;
      }
      if (heard && drawn) {
        const d = Math.abs(20 * Math.log10(s.drawn[l] / s.heard[l]) - scaleOf(s.run, l));
        f.db.push(d);
        if (quiet) f.quietDb.push(d);
      }
    }
  }
  return f;
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// The corpus's loops, in order.
function corpusSeeds(n) {
  const r = new Rng(CORPUS);
  return Array.from({ length: n }, () => r.seed32());
}

function cases() {
  const seeds = corpusSeeds(QUICK ? 3 : 8);
  const loopSeconds = QUICK ? 30 : 60;
  const pieceSeconds = QUICK ? 120 : 300;
  const out = [];
  for (const full of [true, false]) {
    out.push({ name: `plain loops, ${full ? 'full' : 'lite'}`, runs: seeds.map((seed) => ({ seed, full, seconds: loopSeconds })) });
  }
  const pieces = seeds.slice(0, QUICK ? 2 : 4);
  for (const request of ['bars=64,journey=arc', 'bars=128,journey=wander', 'bars=endless,journey=arc']) {
    out.push({ name: `long piece, ${request}`, runs: pieces.map((seed) => ({ seed, request, seconds: pieceSeconds })) });
  }
  out.push({ name: 'long piece, lite, bars=endless,journey=wander', runs: pieces.map((seed) => ({ seed, request: 'bars=endless,journey=wander', full: false, seconds: pieceSeconds })) });
  // A jump: to the piece's fourth section 20 s in, counted from the jump.
  out.push({
    name: 'a jump (section 4, 20 s in)',
    runs: pieces.map((seed) => ({
      seed, request: 'bars=128,journey=arc', seconds: 60, from: 19,
      script: (() => { let done = false; return (x, t) => { if (!done && t >= 20) { done = true; x.dl_play_jump(0, 4); } }; })(),
    })),
  });
  // A track's close: the length slider stops a piece at its 24th bar, the
  // close thinning to it, and a loop of the core's own after.
  out.push({
    name: "a track's close (24 bars, then the core's own loop)",
    runs: pieces.map((seed) => ({
      seed, request: 'bars=64,journey=arc', seconds: 90,
      script: (() => { let done = false; return (x) => { if (!done) { done = true; x.dl_play_draws(seed); x.dl_play_track(2, 24); } }; })(),
    })),
  });
  return out;
}

const rows = [];
let unplaced = 0;
for (const c of has('--steps') ? [] : cases()) {
  const all = [];
  c.runs.forEach((run, i) => {
    const r = play(run);
    unplaced += r.unplaced;
    for (const s of r.steps) s.run = i;
    all.push(...r.steps);
  });
  const f = figures(all);
  const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : '-');
  rows.push({
    case: c.name,
    heard: f.heard,
    drawnNotHeard: f.drawnNotHeard,
    heardNotDrawn: f.heardNotDrawn,
    drawnNotHeardShare: pct(f.drawnNotHeard, f.heard),
    heardNotDrawnShare: pct(f.heardNotDrawn, f.heard),
    loudnessDb: mean(f.db),
    quietHeard: f.quietHeard,
    quietDrawnNotHeard: f.quietDrawnNotHeard,
    quietHeardNotDrawn: f.quietHeardNotDrawn,
    quietLoudnessDb: mean(f.quietDb),
    quietLoudnessMedianDb: median(f.quietDb),
    dots: f.dots,
    pops: f.pops,
  });
  const last = rows[rows.length - 1];
  const db = (x) => (x == null ? '-' : x.toFixed(2));
  console.log(`${c.name}: ${f.heard} notes heard; drawn not heard ${f.drawnNotHeard} (${last.drawnNotHeardShare}), heard not drawn ${f.heardNotDrawn} (${last.heardNotDrawnShare}); loudness ${db(last.loudnessDb)} dB; quiet steps: ${f.quietHeard} heard, ${f.quietDrawnNotHeard} drawn not heard, ${f.quietHeardNotDrawn} heard not drawn, loudness ${db(last.quietLoudnessDb)} dB (median ${db(last.quietLoudnessMedianDb)}); dots that changed after their bar was shown ${f.pops} of ${f.dots}`);
}
if (!has('--steps')) console.log(`model: ${MODEL === 'composed' ? 'the grid as composed (before item 110)' : 'the page (js/heard.js)'}; notes not placed on a step: ${unplaced}`);
if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify({ model: MODEL, rows, unplaced }, null, 2));
// One loop's steps where the drawing and the heard part.
if (has('--steps')) {
  const seed = Number(opt('--steps'));
  const jump = has('--jump');
  const r = play({ seed, request: opt('--request', ''), seconds: 60, script: jump ? (() => { let done = false; return (x, t) => { if (!done && t >= 20) { done = true; x.dl_play_jump(0, 4); } }; })() : null });
  for (const s of r.steps) {
    const bad = LAYERS.map((n, l) => (((s.drawn[l] >= DRAWN_LEAST) !== (s.heard[l] >= HEARD_LEAST)) || (s.heard[l] >= HEARD_LEAST && Math.abs(20 * Math.log10(s.drawn[l] / s.heard[l])) > 3) ? `${n}:${s.drawn[l].toFixed(2)}/${s.heard[l].toFixed(2)}/${s.share[l].toFixed(2)}` : '')).filter(Boolean);
    if (bad.length) console.log(s.time.toFixed(2), s.number, s.abs, bad.join(' '));
  }
}
