// Share codes, version 2.
//
// A loop is not audio. It is a recipe: its seed, what was asked of it, and
// what a listener changed. A code writes down only that, in the 64
// link-safe characters. The core writes and reads it (core/src/code.rs; the
// format is core/docs/codes.md). js/gen.js gives the core the page's side.
// A loop with nothing asked is nine characters.
//
// The page keeps a loop as its record (js/request.js). A code is made from
// the loop that the record plays: the shortest request and edits that make
// it again.
// - A vibe that the listener asked is written as asked (its weight left for
//   the seed to draw) wherever that makes the same loop.
// - A layer's seed, a part of the tone, or the tempo is written only where
//   the listener changed it.
// - A name is written only where the loop was renamed.
//
// A loop's code does not carry its track length. That is the listener's,
// not the loop's: one loop sounds the same however long it plays. An
// album's code does carry it (Mikey, 2026-11-18: "an album's code should
// carry track lengths"). Each track plays as long as its maker's slider had
// it, then the next.
//
// Version 1 codes (DL1-, DLA1-) are gone (Mikey, 2026-10-29: no shims). If
// someone pastes one, the page says plainly that it is from an older app,
// and nothing else.

import { newSpec, playedSpec, loopCode, readLoopCode, albumCode, seedAlbumCode, albumTracks, codeKind as kindOf, nameRefusal, CodeError } from './gen.js';
import { LAYERS, readRequest, requestOf, askFor } from './request.js';
import { randomSeed } from './rng.js';
import { setTrack, trackOfCore, trackOfSpec } from './tracklen.js';

export { CodeError };

const TONE = ['warmth', 'space', 'wobble'];
// A name's room in a code, in UTF-8 bytes (core/src/code/name.rs).
export const NAME_BYTES = 60;
const utf8 = new TextEncoder();

// ------------------------------------------------------------------ names

// `text` as a name that the code can carry, or '' for none. The name is
// composed (NFC), with each run of spaces made one space, trimmed, and at
// most `most` characters and NAME_BYTES bytes (cut at a character, never
// inside one). It is also '' where the core refuses what is left (an
// invisible or a control character, a direction override, piled-up marks).
// The rename box keeps only what a code can carry, so a name that is kept
// always travels.
export function fitName(text, most = Infinity) {
  let chars = Array.from(String(text || '').normalize('NFC').replace(/\s+/g, ' ').trim());
  if (chars.length > most) chars = chars.slice(0, most);
  while (chars.length && utf8.encode(chars.join('')).length > NAME_BYTES) chars.pop();
  const name = chars.join('').trim();
  return name && !nameRefusal(name) ? name : '';
}

// True if a code can carry `text` as it is. The rename box asks this as
// the listener types.
export function carries(text) {
  return !nameRefusal(String(text || ''));
}

// ------------------------------------------------------------ a loop's code

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// What makes a loop the same loop: everything that the core says of it.
function heard(s) {
  return [s.name, s.mix, s.feelMix, s.feel, s.vibes || null, s.vibeStrength ?? null, s.bpm, s.root, s.scale, s.bars, s.stepsPerBar, s.swing, s.coherence, s.cycles || null, s.layerSeeds, s.tone, s.forceLayers || null];
}

// The edits that make `played` from `fresh` (the same seed and request,
// with nothing changed): each layer's seed that differs or was re-rolled (a
// re-rolled layer plays whatever its chances draw), and each part of the
// tone and the tempo that differs.
function editsOf(played, fresh) {
  const seeds = [];
  LAYERS.forEach((l, i) => {
    const rolled = !!(played.forceLayers && played.forceLayers[l]);
    if (rolled || played.layerSeeds[l] !== fresh.layerSeeds[l]) seeds.push([i, played.layerSeeds[l] >>> 0, rolled]);
  });
  const tone = TONE.map((k) => (played.tone[k] !== fresh.tone[k] ? played.tone[k] : null));
  const out = {};
  if (seeds.length) out.seeds = seeds;
  if (tone.some((v) => v != null)) out.tone = tone;
  if (played.bpm !== fresh.bpm) out.bpm = played.bpm;
  return out;
}

// The shortest request and edits that make the loop that `spec` plays. The
// vibes are written as asked where the seed then draws the weights that the
// record has, else with their weights. The result is checked by making the
// loop again.
function recipe(spec) {
  const played = playedSpec(spec);
  const asked = requestOf(spec);
  const tries = [];
  if (asked.vibes) tries.push({ ...asked, vibes: Object.keys(asked.vibes) });
  tries.push(asked);
  for (const request of tries) {
    const fresh = newSpec(spec.seed, request);
    const edits = editsOf(played, fresh);
    if (same(heard(newSpec(spec.seed, request, edits)), heard(played))) return { played, request, edits, plain: fresh };
  }
  // Never reached for a record that the core made. As a last resort, write
  // the whole record, with every edit.
  const fresh = newSpec(spec.seed, asked);
  return { played, request: asked, edits: editsOf(played, { ...fresh, layerSeeds: {}, tone: {}, bpm: NaN }), plain: fresh };
}

// The layers that the listener muted, a bit each. (A layer asked off is
// already muted by its request.)
function muteBits(spec) {
  let bits = 0;
  LAYERS.forEach((l, i) => {
    const off = spec.askLayers && spec.askLayers[l] === 'off';
    if (spec.mutes && spec.mutes[l] && !off) bits |= 1 << i;
  });
  return bits;
}

export function encodeSong(spec) {
  const { request, edits, plain } = recipe(spec);
  // The name, only where it is the listener's, and only as a code carries
  // it.
  const own = spec.name && spec.name !== plain.name ? fitName(spec.name) : '';
  const salt = Number.isInteger(spec.wanderSalt) && spec.wanderSalt > 0 ? spec.wanderSalt >>> 0 : 0;
  return loopCode(spec.seed, { ...askFor(readRequest(request)), ...edits }, { mutes: muteBits(spec), salt, name: own });
}

// A code's request as the core wrote it: its asks (js/request.js reads
// them) and its edits, with its version apart. A code's loop is drawn at
// its version; this build's version is the only one so far.
function split(text) {
  const asks = [];
  const edits = {};
  for (const item of text ? text.split(',') : []) {
    const eq = item.indexOf('=');
    const name = item.slice(0, eq < 0 ? item.length : eq);
    const value = eq < 0 ? '' : item.slice(eq + 1);
    if (name === 'version') continue;
    if (!name.startsWith('edit.')) { asks.push(item); continue; }
    const edit = name.slice(5);
    const [kind, layer] = edit.split('.');
    if (kind === 'seed' || kind === 'roll') {
      (edits.seeds = edits.seeds || []).push([LAYERS.indexOf(layer), Number(value) >>> 0, kind === 'roll']);
    } else if (TONE.includes(edit)) {
      edits.tone = edits.tone || [null, null, null];
      edits.tone[TONE.indexOf(edit)] = Number(value);
    } else if (edit === 'bpm') {
      edits.bpm = Number(value);
    }
  }
  return { asks: asks.join(','), edits };
}

export function decodeSong(code) {
  const c = readLoopCode(code);
  const { asks, edits } = split(c.request);
  const spec = newSpec(c.seed, asks, Object.keys(edits).length ? edits : null);
  LAYERS.forEach((l, i) => { if (c.mutes & (1 << i)) spec.mutes[l] = true; });
  if (c.salt) spec.wanderSalt = c.salt;
  if (c.name) spec.name = c.name;
  return spec;
}

// ---------------------------------------------------------------- albums

// How long `spec` plays before the next, as a code writes it after the
// track's code (`paced` in core/src/code.rs): `:t` and its seconds, with `i`
// and `o` after them for its fades (`:t5025o`); `:i` for on and on, fading
// in; or nothing, for on and on.
function paceOf(spec) {
  const t = trackOfSpec(spec);
  if (t.secs != null) return `:t${t.secs}${t.fadeIn ? 'i' : ''}${t.fadeOut ? 'o' : ''}`;
  return t.fadeIn ? ':i' : '';
}

export function encodeAlbum(title, specs) {
  return albumCode(specs.map((s) => encodeSong(s) + paceOf(s)), fitName(title));
}

export function decodeAlbum(code) {
  const { name, tracks, paces } = albumTracks(code);
  const specs = tracks.map((t, i) => {
    const spec = decodeSong(t);
    const [kind, n] = paces[i];
    const track = trackOfCore(kind, n);
    if (track) setTrack(spec, track);
    return spec;
  });
  return { title: name || 'Untitled', specs };
}

// The code of an album of `count` tracks drawn from one seed (a fresh one
// unless given). Each track is asked `request` (the picks now set:
// requestFor in js/picks.js). The code is a few characters, whatever the
// count (core/docs/codes.md).
export function encodeSeedAlbum(title, count, request, seed = randomSeed()) {
  return seedAlbumCode(seed, count, askFor(readRequest(request)), fitName(title));
}

// ------------------------------------------------------------------ links
//
// A link is the site's address with the code after "#c=".
// - The fragment is never sent to a server, so a code stays out of its logs
//   and out of a referrer.
// - A request for the page has no fragment, so the service worker's cached
//   page answers it offline, as it answers the plain address. A query would
//   be a different request, not in the cache.

const KEY = 'c=';

export function linkOf(base, code) {
  return `${String(base).split('#')[0].split('?')[0]}#${KEY}${code}`;
}

// The code in `text` if it is a link (any address with "#c=" in it), else
// `text` itself. So a pasted link opens as its code does.
export function codeOfLink(text) {
  const s = String(text || '').trim();
  const at = s.indexOf(`#${KEY}`);
  return at < 0 ? s : s.slice(at + 1 + KEY.length).trim();
}

// ------------------------------------------------------------ what it is

// A version 1 code, from an older build: "DL1-" or "DLA1-" before it.
const OLD = /^\s*DLA?1-/i;

// What `text` is: 'song', 'album', 'old' (a version 1 code, from an older
// build), 'newer' (from a newer build), 'instrument' (needs one that this
// device lacks) or null (no code). It is read whole, so that a word that
// happens to use the code's alphabet is not a code.
export function codeKind(text) {
  if (OLD.test(String(text || ''))) return 'old';
  const kind = kindOf(text);
  return kind === 'loop' ? 'song' : kind;
}
