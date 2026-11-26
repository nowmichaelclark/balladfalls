// The request's pins: the named settings that a host may fix for the loops
// it asks for, beside the vibes and the tempo (`readRequest` in
// js/request.js). They are the levers for a game and for research:
// - any of the per-loop choices, set to one of its options;
// - the settings that each choice draws by (the arc, the tuned kick,
//   subDuck, lateFloor, padSweep);
// - the echo's time, and the loop's tuning (0 holds it at A440);
// - the progression's kind, lowBell's kind and twang's version;
// - the space recipe's 40 settings (core/src/space.rs).
// `core/src/generator/request.rs` reads the same table, in the same order.
//
// **A pin chooses within what the loop could draw.** Every setting is held
// to the range (or the list) that the data draws it from. So a pinned loop
// is one that the seed could have made. A value outside it is refused with a
// short plain line. To widen past the data, use the sketch build's `--set`,
// not a request.
//
// **A pin shapes, but does not draw.** The loop's own draws are all made as
// always, on their own streams. Then a pin overrules one value, so nothing
// else moves.
// - A choice pinned to the default option plays the default, even where the
//   loop drew a change. (`arc=today` also keeps a glacial loop's arc away.)
// - A choice pinned to a change plays it where its eligibility test allows,
//   and the default where not. Mikey's rules: subDuck needs a kick and a bass
//   line; lateFloor needs something else from the first second; padSweep's
//   fast also needs a kit. A request bends the music, but never breaks it.
// - A pinned setting shapes its choice when the loop plays it. It does not
//   turn the choice on.
// - Where a choice's options draw a setting from ranges of their own, the
//   pin takes any of them, and the loop holds it to the range of the option
//   that it plays.
//
// As text: `organ=on`, `tunedKick=long`, `arc.shape=deep`, `arc.period=240`,
// `echo.beats=1`, `tuning.cents=0`, `space.room=0.8` (numbers as JavaScript
// writes them).

import { ARC, CHOICES, ECHO, KICK, LATEFLOOR, LOWBELL, PADSWEEP, SUBDUCK, TUNING, TWANG } from './choices.js';

export class RequestError extends Error {}

// The space recipe's settings, by number (`SETTINGS` in core/src/space.rs):
// each name, and the range that a loop draws it from (one number where the
// two ends are equal). test/core-host.test.mjs holds this copy to the
// core's.
export const SPACE_SETTINGS = [
  ['room-weight', 0.64, 0.64], ['ensemble-weight', 0.5, 0.5], ['room', 0.7, 0.9],
  ['spread-chords', 0.3, 0.5], ['spread-texture', 0.35, 0.6], ['spread-light-texture', 0.15, 0.3],
  ['spread-melody', 0.0, 0.12], ['spread-scale', 1.6, 1.6], ['spread-max', 0.8, 0.8],
  ['spread-delay', 0.012, 0.012], ['spread-sway', 0.003, 0.003], ['spread-rate', 0.35, 0.35],
  ['spread-rate-step', 0.07, 0.07], ['kit', 0.08, 0.15], ['kit-soft', 0.7, 0.7],
  ['texture-place', 0.1, 0.25], ['room-cutoff', 180, 180], ['spread-cutoff', 200, 200],
  ['place-cutoff', 150, 150], ['busy-from', 0.5, 0.5], ['busy-span', 5, 5],
  ['width-least', 0.25, 0.25], ['wet-from', 0.7, 0.7], ['wet-scale', 0.75, 0.75],
  ['ceiling-busy', -7, -7], ['ceiling-sparse', -9, -9], ['ceiling-very-sparse', -12, -12],
  ['dense', 0.5, 0.5], ['sparse', 0.15, 0.15], ['wash', 1, 1],
  ['wash-follows-width', 1, 1], ['wash-cutoff', 200, 200],
  // widePad's settings: its kind, which its choice sets (0 the baseline,
  // 1 wide, 2 opening late; to have it, pin the choice, `widePad=late`), the
  // chords' spread and its most, the ceilings and the chords' cutoff, and
  // how long the late kind takes to open, in seconds.
  ['wide', 0, 0], ['wide-chords', 1.4, 1.4], ['wide-max', 2, 2],
  ['wide-ceiling-busy', -4, -4], ['wide-ceiling-sparse', -5, -5], ['wide-ceiling-very-sparse', -7, -7],
  ['wide-cutoff', 250, 250], ['wide-open', 60, 120],
];

const periods = Object.values(ARC.period);
const ids = (pool) => pool.map(([id]) => id);
// A setting that a choice's options each draw from their own range
// (subDuck's deep, lateFloor's slow, padSweep's wide and fast) takes any of
// them. Then the core holds it to the range of the option that the loop
// plays.
const span = (...ranges) => [Math.min(...ranges.map((r) => r[0])), Math.max(...ranges.map((r) => r[1]))];
const sweep = (key) => span(PADSWEEP[key], PADSWEEP.wide[key], PADSWEEP.fast[key]);

// Every pin, in its frozen order (append only). A share code writes them by
// name, and the core's hosts by number. The choices come first, in CHOICES'
// order, then the settings, then the space recipe's. Each pin is { name,
// number, words } (the words it takes, by number), { name, number, range,
// whole } or { name, number, values }. The numbers come in blocks, so that
// a choice or a setting added later moves none of the numbers already
// given: the choices from 0 (room for CHOICE_PINS), the settings from
// SETTING_PINS, and the space's from SPACE_PINS.
export const CHOICE_PINS = 16;
export const SETTING_PINS = 16;
export const SPACE_PINS = 48;
const SETTINGS = [
  { name: 'arc.shape', words: ids(ARC.shapes) },
  { name: 'arc.period', range: [Math.min(...periods.map((p) => p[0])), Math.max(...periods.map((p) => p[1]))] },
  { name: 'arc.from', range: [0, 1] },
  { name: 'arc.floor', range: ARC.floor },
  { name: 'kick.note', range: KICK.note, whole: true },
  { name: 'kick.short', range: KICK.short },
  { name: 'kick.long', range: KICK.long },
  { name: 'subDuck.depth', range: span(SUBDUCK.depth, SUBDUCK.deep.depth) },
  { name: 'subDuck.recover', range: span(SUBDUCK.recover, SUBDUCK.deep.recover) },
  { name: 'lateFloor.order', words: ids(LATEFLOOR.orders) },
  { name: 'lateFloor.seconds', range: span(LATEFLOOR.seconds, LATEFLOOR.slow.seconds) },
  { name: 'lateFloor.gap', range: [1, LATEFLOOR.maxGap], whole: true },
  { name: 'padSweep.lo', range: sweep('lo') },
  { name: 'padSweep.oct', range: sweep('oct') },
  { name: 'padSweep.period', range: sweep('period') },
  { name: 'padSweep.q', range: sweep('q') },
  { name: 'echo.beats', values: ECHO.beats.map(([b]) => b) },
  // slowOpening's fade, in seconds. It shapes only the slow kind.
  { name: 'lateFloor.fade', range: LATEFLOOR.slow.fade },
  // tuningOffset, in cents off A440 either way. 0 holds a loop at A440, as
  // a game's own sounds may need.
  { name: 'tuning.cents', range: [-TUNING.cents[1], TUNING.cents[1]] },
  // The progression's kind: the default, or planingSevenths' major sevenths
  // that slide a step or a minor third (core/src/generator/planing.rs).
  { name: 'progression.kind', words: ['today', 'planing'] },
  // lowBell's kind: none, struck or swelling, for a loop that plays a chord
  // (core/src/blocks/low_bell.rs).
  { name: 'lowBell.kind', words: ['today', ...ids(LOWBELL.kinds)] },
  // dropSpotlight: the bell on every chord (the default), or struck only in
  // the floor drops ('on'), for a loop that plays it.
  { name: 'lowBell.drops', words: ['today', 'on'] },
  // twang's version: none or soft (slow and bright were taken out), for a
  // loop that plays a chord and has no kit busier than a soft one
  // (core/src/blocks/twang.rs). The core numbers them by place. A loop saved
  // with a word that is gone now plays what a code that holds it plays
  // (data/codes.txt).
  { name: 'twang.kind', words: ['today', ...ids(TWANG.kinds)], gone: { slow: 'soft', bright: 'soft' } },
];
if (CHOICES.length > CHOICE_PINS || SETTING_PINS + SETTINGS.length > SPACE_PINS) throw new Error('js/pins.js: a block of pins is full');
export const PINS = [
  ...CHOICES.map((c, i) => ({ name: c.id, number: i, words: ids(c.options) })),
  ...SETTINGS.map((p, i) => ({ ...p, number: SETTING_PINS + i })),
  ...SPACE_SETTINGS.map(([name, lo, hi], i) => ({ name: `space.${name}`, number: SPACE_PINS + i, range: [lo, hi] })),
];

const BY_NAME = new Map(PINS.map((p, i) => [p.name, i]));

export const NO_SUCH_SETTING = 'no such setting';
export const BAD_SETTING = 'a bad setting';
export const SETTING_OUT = 'a setting outside its range';

// True if `name` is a pin's (a choice's id, or a dotted setting's), not a
// vibe's.
export function isPinName(name) {
  return BY_NAME.has(name) || name.includes('.');
}

const NUMBER_TEXT = /^-?\d+(\.\d+)?(e[-+]?\d+)?$/;

// The word that a pin plays for `value`: itself, or the stand-in for one
// that was taken out.
const standIn = (p, value) => (p.gone && Object.hasOwn(p.gone, value) ? p.gone[value] : value);

// The value that pin `name` takes from `value` (text, a number or a word),
// or a refusal.
export function pinValue(name, value) {
  const i = BY_NAME.get(name);
  if (i == null) throw new RequestError(NO_SUCH_SETTING);
  const p = PINS[i];
  if (p.words) {
    if (typeof value !== 'string') throw new RequestError(BAD_SETTING);
    const word = standIn(p, value);
    if (!p.words.includes(word)) throw new RequestError(BAD_SETTING);
    return word;
  }
  let x = value;
  if (typeof x === 'string') {
    if (!NUMBER_TEXT.test(x)) throw new RequestError(BAD_SETTING);
    x = Number(x);
  }
  if (typeof x !== 'number' || !Number.isFinite(x)) throw new RequestError(BAD_SETTING);
  if (p.values) {
    if (!p.values.includes(x)) throw new RequestError(SETTING_OUT);
    return x;
  }
  if (x < p.range[0] || x > p.range[1] || (p.whole && !Number.isInteger(x))) throw new RequestError(SETTING_OUT);
  return x;
}

// Pins read from an object ({ name: value }) into their canonical form: the
// same pins, in the table's order, with every value checked. Null for none.
export function readPins(input) {
  if (input == null) return null;
  if (typeof input !== 'object' || Array.isArray(input)) throw new RequestError(BAD_SETTING);
  const out = {};
  for (const [name, value] of Object.entries(input)) out[name] = pinValue(name, value);
  return framedPins(out);
}

// Pins in the table's order, or null for none.
export function framedPins(pins) {
  if (!pins) return null;
  const names = PINS.map((p) => p.name).filter((n) => n in pins);
  return names.length ? Object.fromEntries(names.map((n) => [n, pins[n]])) : null;
}

// The pins as text items ("organ=on", "arc.period=240"), in the table's order.
export function pinItems(pins) {
  const framed = framedPins(pins);
  return framed ? Object.entries(framed).map(([n, v]) => `${n}=${v}`) : [];
}

// A pin as the core's hosts send it (`dl_play_pin`): its number, and its
// value as a number (a word as its place in the pin's list).
export function pinNumbers(pins) {
  const framed = framedPins(pins);
  if (!framed) return [];
  return Object.entries(framed).map(([n, v]) => {
    const p = PINS[BY_NAME.get(n)];
    return [p.number, p.words ? p.words.indexOf(standIn(p, v)) : v];
  });
}
