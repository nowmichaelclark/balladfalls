// The core's generator, on the page.
//
// The core decides what a loop is: its name, key, tempo, mix, moods and
// notes. The core that plays is in an AudioWorklet, and it exists only after
// a tap. But the page shows a loop before that (the card it opens on) and
// beside it (a loop from the Library or a code, a re-roll's new grid, the
// MIDI export). So the page keeps one more instance of the same module
// (js/dlplayer.wasm), on the main thread, and asks it what a seed and a
// request make. This instance plays nothing. It makes a loop at once
// (`dl_play_ready`), reads it, and leaves it. A loop takes a millisecond or
// two to make.
//
// It is the same generator as the one that plays, byte for byte, so what
// the card says is what is heard.
//
//   newSpec(seed, request, edits)
//                            the loop a seed and a request make (and a
//                            code's edits, if any), as the page's record of
//                            it (js/request.js)
//   playedSpec(spec)         the record of the loop a record plays
//                            (`askOf`): what the Library and a code hear
//   loopCode, readLoopCode, albumCode, seedAlbumCode, albumTracks, codeKind,
//   nameRefusal
//                            share codes, version 2, written and read by the
//                            core (js/share.js is the page's side,
//                            core/docs/codes.md the format)
//   render(spec)             that record's notes, layer by layer, as the
//                            grid and the MIDI export read them
//   pieceMarks(spec, opts)   a long piece's marks: where its movements and
//                            its roles, themes and keys begin
//
// In Node the module is read from disk (the tests and the tools).

import { randomSeed } from './rng.js';
import { LAYERS, STEPS_PER_BAR, RequestError, readRequest, askOf, askFor, requestOf } from './request.js';

const IN_NODE = typeof window === 'undefined' && typeof process !== 'undefined' && !!(process.versions && process.versions.node);
const TONE = ['warmth', 'space', 'wobble'];
// Any rate will do: nothing is rendered.
const RATE = 48000;

async function bytes() {
  if (IN_NODE) {
    const { readFile } = await import('node:fs/promises');
    return readFile(new URL('./dlplayer.wasm', import.meta.url));
  }
  const { fetchCore, coreUnsupported } = await import('./core.js');
  if (typeof WebAssembly !== 'object' || typeof WebAssembly.Module !== 'function') throw new Error(coreUnsupported() || 'no WebAssembly in this browser');
  return fetchCore();
}

// The instance, or the reason that there is none (`unavailable`): a
// browser without WebAssembly, or a module that did not arrive. Then the
// page shows no loop and says so (js/main.js).
let x = null;
let why = null;
try {
  const module = await WebAssembly.compile(await bytes());
  x = (await WebAssembly.instantiate(module, {})).exports;
  x.dl_init(RATE);
  // Lite: the least there is to start. Nothing is mixed.
  x.dl_quality(0);
  x.dl_play_attach(0);
} catch (err) {
  x = null;
  why = String((err && err.message) || err);
}

// The reason that the page has no generator, or null.
export const unavailable = why;

const text = (at, length) => String.fromCharCode(...new Uint8Array(x.memory.buffer, at, length));
const utf8 = new TextEncoder();
const fromUtf8 = new TextDecoder();

// Give the core what is asked of the next loop, call by call. Use the same
// calls in the same order as `ask` in js/worklet.js makes for the core that
// plays. Returns true if the core took every part.
function ask(a) {
  let ok = true;
  const take = (taken) => { if (!taken) ok = false; };
  for (const [i, w] of a.vibes || []) take(w == null ? x.dl_play_vibe(i) : x.dl_play_weight(i, w));
  if (a.tempo) take(x.dl_play_ask_tempo(a.tempo[0], a.tempo[1]));
  for (const [i, v] of a.pins || []) take(x.dl_play_pin(i, v));
  if (a.theme != null) x.dl_play_theme(a.theme >>> 0);
  if (a.length != null) take(x.dl_play_length(a.length === 'endless' ? Infinity : a.length));
  if (a.journey) take(x.dl_play_journey(a.journey));
  if (a.keys) take(x.dl_play_keys(a.keys));
  if (a.scales) take(x.dl_play_scales(a.scales));
  if (a.styles) take(x.dl_play_styles(a.styles));
  (a.voices || []).forEach((mask, layer) => { if (mask) take(x.dl_play_voices(layer, mask)); });
  (a.layers || []).forEach((state, layer) => { if (state) take(x.dl_play_layer(layer, state)); });
  for (const [layer, seed, rolled] of a.seeds || []) take(x.dl_play_seed(layer, seed >>> 0, rolled ? 1 : 0));
  (a.tone || []).forEach((v, which) => { if (v != null) take(x.dl_play_edit_tone(which, v)); });
  if (a.bpm != null) take(x.dl_play_edit_bpm(a.bpm));
  return ok;
}

// Make the loop of `seed` as `a` asks, now. If the core refuses part of
// it, throw a RequestError with the core's own line.
function make(seed, a) {
  if (!x) throw new Error(`no generator: ${why}`);
  x.dl_play_stop();
  const ok = ask(a);
  const n = x.dl_play_refusal();
  const refusal = n ? text(x.dl_play_refusal_at(), n) : null;
  if (!ok || refusal) {
    // The load below drops the request asked so far, so none of it reaches
    // the next loop.
    x.dl_play_load(seed >>> 0, 0);
    x.dl_play_stop();
    throw new RequestError(refusal || "can't do that");
  }
  x.dl_play_load(seed >>> 0, 0);
  x.dl_play_ready();
}

// What the core says of the loop it made (`Player::describe`), by field.
function about() {
  const lines = text(x.dl_play_about_at(), x.dl_play_describe()).split('\n').filter(Boolean);
  return Object.fromEntries(lines.map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
}

const weights = (s) => Object.fromEntries((s || '').split('|').filter(Boolean).map((p) => [p.slice(0, p.indexOf(':')), Number(p.slice(p.indexOf(':') + 1))]));
const numbers = (s) => (s || '').split('|').map(Number);

// The page's record of the loop that `seed` and `request` make.
// `readRequest` in js/request.js says what a request is. A list of vibe
// names is a listener's selection. `edits` are a code's edits ({ seeds:
// [[layer, seed, rolled]], tone: [warmth, space, wobble] with null for a
// dial not edited, bpm }). They are made with the loop, as the core makes a
// code's loop. If the core cannot meet the request, this throws a
// RequestError with the core's line.
export function newSpec(seed = randomSeed(), request = null, edits = null) {
  const asked = readRequest(request);
  make(seed, edits ? { ...askFor(asked), ...edits } : askFor(asked));
  return record(asked);
}

// The record of the loop that a record plays. It is made from the record's
// seed, request and edits (`askOf`), as the Library, the player and a share
// code make it, and read back. The request stays as the record had it.
export function playedSpec(spec) {
  make(spec.seed, askOf(spec));
  return record(readRequest(requestOf(spec)));
}

// What the core said about the loop just made, with `asked`, as the
// page's record.
function record(asked) {
  const d = about();
  const [lift, energy, warmth] = numbers(d.feel);
  const tone = numbers(d.tone);
  const seeds = numbers(d.layer_seeds);
  const spec = {
    seed: Number(d.seed),
    name: d.name,
    mix: weights(d.mix),
    feel: { lift, energy, warmth },
    feelMix: weights(d.moods),
    coherence: Number(d.coherence),
    mood: lift, // kept so older saves still read something
    bpm: Number(d.bpm),
    root: Number(d.root),
    scale: d.scale,
    bars: Number(d.bars),
    stepsPerBar: Number(d.steps_per_bar),
    swing: Number(d.swing),
    layerSeeds: Object.fromEntries(LAYERS.map((l, i) => [l, seeds[i] >>> 0])),
    mutes: Object.fromEntries(LAYERS.map((l) => [l, false])),
    tone: Object.fromEntries(TONE.map((k, i) => [k, tone[i]])),
  };
  // The layers that a code's edits re-rolled. They play whatever their
  // chances draw.
  if (d.rolled) spec.forceLayers = Object.fromEntries(d.rolled.split('|').map((l) => [l, true]));
  // Each layer's own cycle in steps, for a loop whose layers drift apart.
  if (d.cycles) spec.cycles = Object.fromEntries(LAYERS.map((l, i) => [l, numbers(d.cycles)[i] || null]));
  // The vibes that steered it, with the weights the core drew.
  if (d.vibes) {
    spec.vibes = weights(d.vibes);
    spec.vibeStrength = Number(d.strength);
  }
  // What was asked, kept. The loop is made again from its record, and a
  // share code carries it.
  if (asked.tempo) spec.tempo = asked.tempo.slice();
  if (asked.pins) spec.pins = { ...asked.pins };
  if (asked.length != null) spec.length = asked.length;
  // If no length is asked, the core sometimes draws a long piece from the
  // seed. Then the length is the piece's, as an asked one is, for all that
  // shows or counts the piece. It is marked drawn, so that its request (and
  // so a share code) leaves the length to the seed (`requestOf`).
  else if (d.length) {
    spec.length = d.length === 'endless' ? 'endless' : Number(d.length);
    spec.lengthDrawn = true;
  }
  if (asked.theme != null) spec.theme = asked.theme;
  if (asked.journey) spec.askJourney = asked.journey;
  if (asked.style) spec.askStyle = asked.style.slice();
  if (asked.voices) spec.askVoices = Object.fromEntries(Object.entries(asked.voices).map(([l, v]) => [l, v.slice()]));
  if (asked.layers) {
    spec.askLayers = { ...asked.layers };
    // A layer asked off is a muted layer, as with the listener's mute
    // button, and it unmutes the same way.
    for (const [layer, state] of Object.entries(asked.layers)) if (state === 'off') spec.mutes[layer] = true;
  }
  if (asked.key) spec.askKey = asked.key.slice();
  if (asked.scale) spec.askScale = asked.scale.slice();
  return spec;
}

// A layer's notes in the loop as composed (`Player::note`), as the MIDI
// export and the grid read them: a drum hit { step, vel, inst, micro }, a
// bass or melody note { step, dur, midi, vel }, a chord or a texture's
// { step, dur, notes, vel }.
function track(layer) {
  const l = LAYERS.indexOf(layer);
  const out = [];
  const n = x.dl_play_notes(l);
  for (let i = 0; i < n; i++) {
    const name = x.dl_play_note(l, i);
    const f = new Float64Array(x.memory.buffer, x.dl_play_note_at(), 16);
    const [step, dur, vel, micro, count] = f;
    if (layer === 'drums') {
      const e = { step, vel, inst: text(x.dl_play_text(), name) };
      if (micro) e.micro = micro;
      out.push(e);
    } else if (layer === 'bass' || layer === 'melody') {
      out.push({ step, dur, midi: f[5], vel });
    } else {
      out.push({ step, dur, notes: Array.from(f.subarray(5, 5 + count)), vel });
    }
  }
  return out;
}

// The loop of a record, as composed: { spec, stepsPerBar, totalSteps,
// cycles, tracks, form, choir }. It is made from the record's seed, request
// and edits (`askOf`), exactly as the core that plays it is asked. `form`
// is true if its layers come and go (an airy loop). `choir` is true for one
// of the rare choir loops.
export function render(spec) {
  make(spec.seed, askOf(spec));
  const d = about();
  const stepsPerBar = Number(d.steps_per_bar) || STEPS_PER_BAR;
  const cycles = d.cycles ? Object.fromEntries(LAYERS.map((l, i) => [l, numbers(d.cycles)[i] || null])) : null;
  return {
    spec,
    stepsPerBar,
    totalSteps: Number(d.bars) * stepsPerBar,
    cycles,
    tracks: Object.fromEntries(LAYERS.map((l) => [l, track(l)])),
    form: d.airy === '1',
    choir: d.choir === '1',
  };
}

// A long piece's plan, by the numbers the core gives (core/src/generator/
// longform.rs, in its enums' order): a unit's role, its theme, its key's
// relation to home, and its movement's kind.
export const ROLES = ['opening', 'theme', 'build', 'second', 'development', 'peak', 'release', 'return', 'close', 'breath', 'lift', 'holding', 'turning'];
export const THEMES = ['rest', 'A', 'B', 'recall'];
export const RELATIONS = ['home', 'fifthAbove', 'fifthBelow', 'relative', 'parallel'];
export const MOVEMENTS = ['full', 'gentle', 'light', 'interlude'];
const MARK = 8;
// The most marks that one call gives (`dl_play_marks`). For more, ask
// again from the section after the last one.
export const MARKS_MOST = 2048;

// A long piece's marks for the page. The marks are the units, in `count`
// sections from section `from`, where something that a listener would see
// marked begins: the first unit, then each unit where the role, the theme,
// the key or the movement changes. They are read straight from the piece's
// plan, with nothing before them walked.
// - Each mark is { bar, section, role, theme, root, relation, energy,
//   movement }: `bar` from the piece's start, `root` 0 for C to 11,
//   `energy` 0 to 1.
// - With `coarse`, only a movement's start is marked. A 32,768-bar piece's
//   whole run of movements costs a few milliseconds. So the page can draw
//   all of the movements, and ask for a window of roles around the playhead.
// - Endless is asked a window at a time: `count` sections, 64 if not asked.
//   A finite piece gives its whole round if not asked.
// - Null for a loop that is not a long piece. At most MARKS_MOST a call.
export function pieceMarks(spec, { from = 0, count = null, coarse = false } = {}) {
  make(spec.seed, askOf(spec));
  // A piece's sections, one round (the core gives a round at most). For
  // Endless, a window: 64 sections if not asked.
  const sections = Number.isFinite(spec.length) && spec.bars > 0 ? Math.ceil(spec.length / spec.bars) : 64;
  const n = x.dl_play_marks(from, count == null ? sections : count, coarse ? 1 : 0);
  if (!n) return null;
  const f = new Float64Array(x.memory.buffer, x.dl_play_marks_at(), n * MARK);
  const marks = [];
  for (let i = 0; i < n; i++) {
    const [bar, section, role, theme, root, relation, energy, movement] = f.subarray(i * MARK, (i + 1) * MARK);
    marks.push({ bar, section, role: ROLES[role], theme: THEMES[theme], root, relation: RELATIONS[relation], energy, movement: MOVEMENTS[movement] });
  }
  return marks;
}

// ------------------------------------------------------------ share codes

// Share codes, version 2 (core/src/code.rs, core/docs/codes.md). The core
// writes and reads them. The page gives it a loop's seed, what was asked and
// changed, the mutes, the wander's salt and a name of its own, and reads the
// same back. Names are UTF-8 both ways. A refusal is a CodeError whose
// message is the core's plain line ("not a code", "needs a newer version",
// "a name a code can't carry").

export class CodeError extends Error {}

function input(bytes) {
  new Uint8Array(x.memory.buffer, x.dl_code_input(), bytes.length).set(bytes);
  return bytes.length;
}

const codeText = (n) => fromUtf8.decode(new Uint8Array(x.memory.buffer, x.dl_code_text(), n));

function refused() {
  const n = x.dl_code_refusal();
  return new CodeError(n ? codeText(n) : 'not a code');
}

// Drop the request asked so far, so that nothing of a code reaches the
// next loop made.
function dropAsked(seed) {
  x.dl_play_load(seed >>> 0, 0);
  x.dl_play_stop();
}

function need() {
  if (!x) throw new Error(`no generator: ${why}`);
}

// A loop's code: `seed`, `a` (the core's numbers: js/request.js's askFor,
// with a code's edits), the layers muted (a bit each, in LAYERS' order), the
// wander's salt (0 for none) and its own name ('' for none).
export function loopCode(seed, a, { mutes = 0, salt = 0, name = '' } = {}) {
  need();
  x.dl_play_stop();
  const ok = ask(a);
  const n = ok ? x.dl_code_write(seed >>> 0, mutes, salt >>> 0, input(utf8.encode(name))) : 0;
  const err = !ok ? new CodeError(text(x.dl_play_refusal_at(), x.dl_play_refusal()) || "can't do that") : n ? null : refused();
  const code = n ? codeText(n) : null;
  dropAsked(seed);
  if (err) throw err;
  return code;
}

// A loop's code read: { seed, mutes, salt, name, request }, the request as
// the text the core's `Request::parse` (and js/request.js's readRequest, for
// its asks) reads, its edits ("edit.seed.drums=1234") and its version
// ("version=2") among it.
export function readLoopCode(code) {
  need();
  if (!x.dl_code_read(input(utf8.encode(String(code))))) throw refused();
  const out = { seed: x.dl_code_seed() >>> 0, mutes: x.dl_code_mutes(), salt: x.dl_code_salt() >>> 0 };
  out.name = codeText(x.dl_code_name());
  out.request = codeText(x.dl_code_request());
  dropAsked(out.seed);
  return out;
}

// An album's code, named `name` ('' for none): the loops' codes in their
// order. A loop that has a pace says after it how long it plays before the
// next (`paced` in core/src/code.rs). For example, `CODE:t5025` is 1:23:45;
// `i` and `o` after the seconds are its fades; `CODE:i` is on and on,
// fading in.
export function albumCode(codes, name = '') {
  need();
  const head = utf8.encode(name);
  const body = utf8.encode(codes.join('.'));
  const all = new Uint8Array(head.length + body.length);
  all.set(head);
  all.set(body, head.length);
  const n = x.dl_code_album_write(input(all), head.length);
  if (!n) throw refused();
  return codeText(n);
}

// The code of an album of `count` tracks drawn from `seed`, named `name`
// ('' for none). Each track is asked what `a` asks (the core's numbers:
// askFor in js/request.js; edits have no place in it). The code is a few
// characters, whatever the count.
export function seedAlbumCode(seed, count, a, name = '') {
  need();
  x.dl_play_stop();
  const ok = ask(a);
  const n = ok ? x.dl_code_album_seed(seed >>> 0, count, input(utf8.encode(name))) : 0;
  const err = !ok ? new CodeError(text(x.dl_play_refusal_at(), x.dl_play_refusal()) || "can't do that") : n ? null : refused();
  const code = n ? codeText(n) : null;
  dropAsked(seed);
  if (err) throw err;
  return code;
}

// An album's { name, tracks, paces }. Each track is a loop's code. Its
// pace is how long it plays before the next, as [kind, count], in the form
// the player takes (coreTrack in js/tracklen.js: 0 on and on, 3 a time in
// seconds, with the fades' bits).
export function albumTracks(code) {
  need();
  const len = input(utf8.encode(String(code)));
  const count = x.dl_code_album(len);
  if (!count) throw refused();
  const mem = new Uint8Array(x.memory.buffer, x.dl_code_text(), 256);
  const name = fromUtf8.decode(mem.slice(0, mem.indexOf(0)));
  const tracks = [];
  const paces = [];
  for (let i = 0; i < count; i++) {
    const n = x.dl_code_track(len, i);
    if (!n) throw refused();
    tracks.push(codeText(n));
    const kind = x.dl_code_pace(len, i);
    if (!kind) throw refused();
    paces.push([kind - 1, x.dl_code_pace_count() >>> 0]);
  }
  return { name, tracks, paces };
}

// What `text` is, read whole: 'loop', 'album', 'newer' (a newer build's),
// 'instrument' (needs one this device lacks) or null (no code).
export function codeKind(text) {
  need();
  const len = input(utf8.encode(String(text || '')));
  if (x.dl_code_kind(len) === 2) {
    if (x.dl_code_album(len)) return 'album';
  } else if (x.dl_code_read(len)) {
    dropAsked(x.dl_code_seed());
    return 'loop';
  }
  // A code from a newer build says so in its head, loop or album. A code
  // that names an instrument this device does not have gets its own line.
  // The core says so in words with "instrument" in them, once it can.
  const why = refused().message;
  return why === NEWER ? 'newer' : /instrument/i.test(why) ? 'instrument' : null;
}

const NEWER = 'needs a newer version';

// The reason that a code can't carry `name` (the core's line), or null.
export function nameRefusal(name) {
  need();
  return x.dl_code_name_ok(input(utf8.encode(String(name)))) ? null : refused().message;
}
