// The tempo, key, style and voices pickers (session 30j, queue item 118;
// Mikey, 2026-11-23: "We don't have viewport menus for tempo, key, style or
// voices. Those need to be built."). Each is a view of its own in the middle
// viewport, opened from its value on the Vibe panel and built as the Bars
// view is: cancel in the head keeps what was there, done keeps what is shown,
// and both go back to the panel. They shape only loops still to come.
//
// Every pick has the three states the Painter asks (docs/PAINTER.md,
// section 1), shown and switched one way everywhere: keys lit the app's way
// (a ring) are what is asked, one lit is pinned, several are a set, and
// none lit is left to chance, which is the any key, lit. Tempo is a number:
// one is pinned, two ends a range (two sliders, the slow end and the fast
// end, each pushing the other), any left to chance.
//
// What each can ask is what the core takes (js/request.js): a tempo of 32 to
// 190 bpm, the twelve home notes and the modes, the profiles, each layer's
// own voices, and a layer on or off, never all five off (the one request the
// core can't meet: its off key rests while the other four are off).
//
// Long lists page rather than scroll (the Painter's rule: only the Library
// and Advanced scroll): as many keys as the panel's room holds at 44 px,
// then ‹ and › and where you are.

import { el } from './ui.js';
import { NOTE_NAMES, SCALES, SCALE_ORDER } from './theory.js';
import { PROFILE_ORDER, VOICE_ORDER } from './characters.js';
import { LAYERS, LAYER_LABELS, TEMPO_LIMIT, readRequest, RequestError } from './request.js';
import { tempoText, keyText, styleText, requestFor } from './picks.js';

export const PICKERS = ['tempo', 'key', 'style', 'voices'];

const NB = ' ';
const [LO, HI] = TEMPO_LIMIT;
const GAP = 6;
// Keys are 44 px tall where there is room (the Painter's targets), and
// never taller than this.
const ROW = 44;
const SHORT = 32;

// Each picker's ids: cancel, done, the value line and the rest.
const IDS = { tempo: 'tmp', key: 'key', style: 'sty', voices: 'vox' };

let api = null;
// The picker open: { kind, draft, tab, page, before }.
let open = null;

// ---------------------------------------------------------------- words

// A note's name for a screen reader: "C sharp", "E flat".
function spokenNote(name) {
  return name.replace('#', ' sharp').replace(/^([A-G])b$/, '$1 flat');
}

function scaleWord(id) {
  return SCALES[id].label.toLowerCase();
}

// A layer's words, as the Layers view names it ("keys", "air").
function layerWord(layer) {
  return String(LAYER_LABELS[layer] || layer).toLowerCase();
}

// The voices line for one layer: "kalimba or marimba · on", "off", or ''.
function layerText(draft, layer) {
  const v = draft.voices[layer] || [];
  const st = draft.layers[layer];
  if (st === 'off') return 'off';
  const parts = [];
  if (v.length) parts.push(v.join(' or '));
  if (st === 'on') parts.push('on');
  return parts.join(' · ');
}

// ------------------------------------------------------------ the lists

// What a list picker offers, for the picker and its tab: each option's
// value, its words on the key and, where they differ, for a screen reader.
function optionsOf(kind, tab) {
  // A black key's name with its sign (C♯, E♭), said as a word.
  if (kind === 'key' && tab === 'note') {
    return NOTE_NAMES.map((n, i) => (n.length > 1 ? { value: i, text: n.replace('#', '\u266f').replace('b', '\u266d'), spoken: spokenNote(n) } : { value: i, text: n }));
  }
  if (kind === 'key') return SCALE_ORDER.map((id) => ({ value: id, text: scaleWord(id) }));
  if (kind === 'style') return PROFILE_ORDER.map((id) => ({ value: id, text: id }));
  return VOICE_ORDER[tab].map((id) => ({ value: id, text: id }));
}

// The narrowest a key may be before its words are tried (the fit then
// takes columns away while any word is cut).
const MIN_W = { note: 36, scale: 88, style: 80, voices: 80 };

// The set the open picker's current list picks from.
function chosen() {
  const { kind, draft, tab } = open;
  if (kind === 'key') return tab === 'note' ? draft.key : draft.scale;
  if (kind === 'style') return draft.style;
  return draft.voices[tab] || (draft.voices[tab] = []);
}

// ---------------------------------------------------------- open, close

// Opened from the panel: a draft of what is picked now.
export function openPicker(kind) {
  const p = api.state.picks;
  const spec = api.state.spec;
  if (kind === 'tempo') {
    const bpm = Math.round(Math.max(LO, Math.min(HI, spec && spec.bpm ? spec.bpm : 80)));
    open = { kind, draft: { tempo: p.tempo ? p.tempo.slice() : null, from: bpm } };
  } else if (kind === 'key') {
    open = { kind, tab: p.key || !p.scale ? 'note' : 'scale', draft: { key: (p.key || []).slice(), scale: (p.scale || []).slice() } };
  } else if (kind === 'style') {
    open = { kind, tab: 'style', draft: { style: (p.style || []).slice() } };
  } else {
    const voices = {};
    for (const l of LAYERS) voices[l] = p.voices && p.voices[l] ? p.voices[l].slice() : [];
    const first = LAYERS.find((l) => voices[l].length || (p.layers && p.layers[l])) || 'melody';
    open = { kind, tab: first, draft: { voices, layers: { ...(p.layers || {}) } } };
  }
  open.page = -1;
  return kind;
}

// The picks the draft would set.
function draftPicks() {
  const { kind, draft } = open;
  if (kind === 'tempo') return { tempo: draft.tempo };
  if (kind === 'key') return { key: draft.key.length ? draft.key.slice() : null, scale: draft.scale.length ? draft.scale.slice() : null };
  if (kind === 'style') return { style: draft.style.length ? draft.style.slice() : null };
  // A layer that never plays asks no voices.
  const voices = {};
  for (const l of LAYERS) if (draft.layers[l] !== 'off' && draft.voices[l].length) voices[l] = draft.voices[l].slice();
  const layers = {};
  for (const l of LAYERS) if (draft.layers[l]) layers[l] = draft.layers[l];
  return { voices: Object.keys(voices).length ? voices : null, layers: Object.keys(layers).length ? layers : null };
}

// "Can't do that" with the draft, in the core's own words, or null.
function cantWith() {
  const state = api.state;
  try {
    readRequest(requestFor({ ...state, picks: { ...state.picks, ...draftPicks() } }));
    return null;
  } catch (e) {
    if (e instanceof RequestError) return e.message;
    throw e;
  }
}

// --------------------------------------------------------------- render

export function renderPicker(kind) {
  if (!open || open.kind !== kind) openPicker(kind);
  if (kind === 'tempo') renderTempo();
  else renderList();
  const cant = el(`${IDS[kind]}Cant`);
  const why = cantWith();
  cant.hidden = !why;
  cant.textContent = '';
  if (why) {
    const lead = document.createElement('span');
    lead.className = 'vh';
    lead.textContent = "can't do that: ";
    cant.append(lead, why);
  }
}

// A turned phone or a resized window: the pages measured again.
export function refitPicker(kind) {
  if (!open || open.kind !== kind) return;
  if (kind === 'tempo') renderTempo();
  else { open.fit = null; renderList(); }
}

// ------------------------------------------------------------ the tempo

function sliderPx(input, v) {
  const w = input.clientWidth || 280;
  return 12 + (w - 24) * ((v - LO) / (HI - LO));
}

function renderTempo() {
  const { draft } = open;
  const any = !draft.tempo;
  const [lo, hi] = draft.tempo || [draft.from, draft.from];
  const view = el('viewTempo');
  view.classList.toggle('any', any);
  const num = el('tmpNum');
  if (document.activeElement !== num) num.value = any ? 'any' : lo === hi ? String(lo) : `${lo}–${hi}`;
  num.setAttribute('aria-label', any ? 'Tempo: any' : `Tempo: ${lo === hi ? lo : `${lo} to ${hi}`} bpm`);
  el('tmpWords').textContent = any ? NB : 'bpm';
  el('tmpDown').disabled = lo <= LO;
  el('tmpUp').disabled = hi >= HI;
  for (const [id, v] of [['tmpLo', lo], ['tmpHi', hi]]) {
    const s = el(id);
    if (document.activeElement !== s || Number(s.value) !== v) s.value = String(v);
    s.setAttribute('aria-valuetext', any ? 'any' : `${v} bpm`);
    s.style.setProperty('--from', any ? '0px' : `${sliderPx(s, lo).toFixed(2)}px`);
    s.style.setProperty('--to', any ? '0px' : `${sliderPx(s, hi).toFixed(2)}px`);
  }
  const anyKey = el('tmpAny');
  anyKey.classList.toggle('armed', any);
  anyKey.setAttribute('aria-pressed', any ? 'true' : 'false');
  // The number keeps its size until it would not fit between −1 and +1
  // (a range at large text), then steps down, as Bars' does.
  num.style.fontSize = '';
  for (let i = 0; i < 10 && num.scrollWidth > num.clientWidth + 1; i++) {
    num.style.fontSize = `${parseFloat(getComputedStyle(num).fontSize) * 0.9}px`;
  }
}

function setTempo(lo, hi) {
  const a = Math.max(LO, Math.min(HI, Math.round(lo)));
  const b = Math.max(LO, Math.min(HI, Math.round(hi)));
  open.draft.tempo = [Math.min(a, b), Math.max(a, b)];
  renderPicker('tempo');
}

function tempoNow() {
  const d = open.draft;
  return d.tempo || [d.from, d.from];
}

// Typed: a bpm ("80") or a range ("70-85", "70–85", "70 85").
function commitTempo() {
  if (!open || open.kind !== 'tempo') return;
  const num = el('tmpNum');
  const n = (num.value.match(/\d+/g) || []).map(Number);
  if (n.length === 1) setTempo(n[0], n[0]);
  else if (n.length >= 2) setTempo(n[0], n[1]);
  else renderPicker('tempo');
}

// ------------------------------------------------------------ the lists

// Lays the list out in the room the grid has: as many columns as the
// words allow and as many rows as fit at 44 px, then pages of that many.
function measure(grid, opts) {
  const w = grid.clientWidth;
  const h = grid.clientHeight;
  const minW = MIN_W[open.kind === 'key' ? open.tab : open.kind];
  const cols = Math.max(1, Math.floor((w + GAP) / (minW + GAP)));
  const fit = (row) => Math.max(1, Math.floor((h + GAP) / (row + GAP)));
  const pages = (r) => Math.ceil(opts.length / (cols * r));
  let rows = fit(ROW);
  // Rows a little shorter where that saves a page (40 px), or puts the
  // whole list on one, or the room holds under two rows of 44 (down to
  // 32 px, never under 24).
  if (pages(fit(40)) < pages(rows)) rows = fit(40);
  const one = [36, SHORT].find((r) => pages(fit(r)) === 1);
  if (pages(rows) > 1 && one) rows = fit(one);
  if (rows < 2) rows = fit(SHORT);
  // All on one page: no more rows than they take.
  if (opts.length <= cols * rows) rows = Math.ceil(opts.length / cols);
  return { cols, rows, w, h };
}

function renderList() {
  const { kind } = open;
  const p = IDS[kind];
  const view = el(`view${kind[0].toUpperCase()}${kind.slice(1)}`);
  const grid = el(`${p}Grid`);
  const opts = optionsOf(kind, open.tab);
  const set = chosen();

  // The value line: what is asked, in the panel's words.
  const value = el(`${p}Value`);
  const words = kind === 'key' ? keyText(open.draft.key, open.draft.scale)
    : kind === 'style' ? styleText(open.draft.style)
      : layerText(open.draft, open.tab);
  value.textContent = words || 'any';
  value.classList.toggle('any', !words);

  // The tabs: note or scale; the five layers, each marked where it asks
  // anything.
  for (const t of view.querySelectorAll('.pv-tab')) {
    const on = t.dataset.tab === open.tab;
    t.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (kind === 'voices') {
      const l = t.dataset.tab;
      const asks = open.draft.voices[l].length > 0 || !!open.draft.layers[l];
      t.classList.toggle('asks', asks);
      t.setAttribute('aria-label', `${layerWord(l)}${asks ? `: ${layerText(open.draft, l)}` : ''}`);
    }
    if (kind === 'key') {
      const asks = (t.dataset.tab === 'note' ? open.draft.key : open.draft.scale).length > 0;
      t.classList.toggle('asks', asks);
    }
  }

  // The five layers' names keep their size until one would be cut (a
  // narrow panel, large text), then step down together, not under 10 px.
  const tabs = [...view.querySelectorAll('.pv-tab')];
  for (const t of tabs) t.style.fontSize = '';
  for (let i = 0; i < 10 && tabs.some((t) => t.scrollWidth > t.clientWidth + 1); i++) {
    const px = Math.max(10, parseFloat(getComputedStyle(tabs[0]).fontSize) * 0.92);
    for (const t of tabs) t.style.fontSize = `${px}px`;
    if (px <= 10) break;
  }

  // A layer on or off (voices only): each lit while asked, pressed again
  // back to chance; off rests while the other four are off.
  if (kind === 'voices') {
    const st = open.draft.layers[open.tab];
    const othersOff = LAYERS.filter((l) => l !== open.tab).every((l) => open.draft.layers[l] === 'off');
    const on = el('voxOn');
    const off = el('voxOff');
    on.setAttribute('aria-pressed', st === 'on' ? 'true' : 'false');
    off.setAttribute('aria-pressed', st === 'off' ? 'true' : 'false');
    on.setAttribute('aria-label', `${layerWord(open.tab)} always on`);
    off.setAttribute('aria-label', `${layerWord(open.tab)} off`);
    off.disabled = othersOff && st !== 'off';
    grid.classList.toggle('off', st === 'off');
    grid.setAttribute('aria-label', `${layerWord(open.tab)} voices`);
  }
  if (kind === 'key') grid.setAttribute('aria-label', open.tab === 'note' ? 'Notes' : 'Scales');

  // Pages: laid out again where the room or the list changed.
  const key = `${kind}:${open.tab}:${grid.clientWidth}x${grid.clientHeight}:${document.documentElement.style.fontSize}`;
  if (!open.fit || open.fit.key !== key) {
    open.fit = { key, ...measure(grid, opts) };
    open.built = null;
  }
  let { cols, rows } = open.fit;
  // Words cut: a column fewer (or a row fewer), and again.
  for (let tries = 0; tries < 12; tries++) {
    const per = cols * rows;
    const pages = Math.max(1, Math.ceil(opts.length / per));
    if (open.page < 0) {
      const first = opts.findIndex((o) => set.includes(o.value));
      open.page = first < 0 ? 0 : Math.floor(first / per);
    }
    open.page = Math.max(0, Math.min(pages - 1, open.page));
    buildPage(grid, opts, cols, rows, per, pages);
    const cut = [...grid.children].some((b) => b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1);
    if (!cut) break;
    if (cols > 1) cols--;
    else if (rows > 1) rows--;
    else break;
    open.fit.cols = cols;
    open.fit.rows = rows;
  }
  const off = kind === 'voices' && open.draft.layers[open.tab] === 'off';
  for (const b of grid.children) {
    const on = set.includes(b._value);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.disabled = off;
  }

  // The any key: lit while this list asks nothing.
  const anyKey = el(`${p}Any`);
  const any = kind === 'voices' ? !set.length && !open.draft.layers[open.tab] : !set.length;
  anyKey.classList.toggle('armed', any);
  anyKey.setAttribute('aria-pressed', any ? 'true' : 'false');
  anyKey.setAttribute('aria-label', kind === 'key' ? `Any ${open.tab}` : kind === 'style' ? 'Any style' : `Any ${layerWord(open.tab)}`);
}

function buildPage(grid, opts, cols, rows, per, pages) {
  const sig = `${open.tab}:${open.page}:${cols}x${rows}`;
  const p = IDS[open.kind];
  if (open.built !== sig) {
    const had = document.activeElement && grid.contains(document.activeElement)
      ? [...grid.children].indexOf(document.activeElement) : -1;
    grid.textContent = '';
    grid.style.setProperty('--cols', String(cols));
    grid.style.setProperty('--rows', String(rows));
    for (const o of opts.slice(open.page * per, open.page * per + per)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'vkey word pv-opt';
      b.textContent = o.text;
      if (o.spoken) b.setAttribute('aria-label', o.spoken);
      b._value = o.value;
      b.addEventListener('click', () => toggle(o.value));
      grid.append(b);
    }
    open.built = sig;
    if (had >= 0 && grid.children.length) grid.children[Math.min(had, grid.children.length - 1)].focus({ preventScroll: true });
  }
  const pager = el(`${p}Pager`);
  pager.hidden = pages < 2;
  el(`${p}Page`).textContent = `${open.page + 1}/${pages}`;
  const prev = el(`${p}Prev`);
  const next = el(`${p}Next`);
  const wasPrev = document.activeElement === prev;
  const wasNext = document.activeElement === next;
  prev.disabled = open.page <= 0;
  next.disabled = open.page >= pages - 1;
  // A key gone dim under the focus hands it to the other one.
  if (wasNext && next.disabled && !prev.disabled) prev.focus({ preventScroll: true });
  if (wasPrev && prev.disabled && !next.disabled) next.focus({ preventScroll: true });
  el(`${p}PageSpoken`).textContent = pages > 1 ? `page ${open.page + 1} of ${pages}` : '';
}

function toggle(value) {
  const set = chosen();
  const i = set.indexOf(value);
  if (i >= 0) set.splice(i, 1);
  else set.push(value);
  // In the list's own order, as the request reads it.
  const order = optionsOf(open.kind, open.tab).map((o) => o.value);
  set.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  renderPicker(open.kind);
}

function turnPage(by) {
  open.page += by;
  renderPicker(open.kind);
}

function setTab(tab) {
  if (open.tab === tab) return;
  open.tab = tab;
  open.page = -1;
  open.built = null;
  open.fit = null;
  renderPicker(open.kind);
}

// ----------------------------------------------------------------- wire

export function wirePickers(handlers) {
  api = handlers;
  const back = () => { open = null; api.setView('vibe'); };
  for (const kind of PICKERS) {
    const p = IDS[kind];
    el(`${p}Cancel`).addEventListener('click', back);
    el(`${p}Done`).addEventListener('click', () => {
      if (kind === 'tempo' && document.activeElement === el('tmpNum')) commitTempo();
      const picks = draftPicks();
      open = null;
      api.setPicks(picks);
      api.setView('vibe');
    });
    if (kind !== 'tempo') {
      el(`${p}Prev`).addEventListener('click', () => turnPage(-1));
      el(`${p}Next`).addEventListener('click', () => turnPage(1));
      el(`${p}Any`).addEventListener('click', () => {
        if (el(`${p}Any`).getAttribute('aria-pressed') === 'true') return;
        chosen().length = 0;
        if (kind === 'voices') delete open.draft.layers[open.tab];
        renderPicker(kind);
      });
      for (const t of el(`view${kind[0].toUpperCase()}${kind.slice(1)}`).querySelectorAll('.pv-tab')) {
        t.addEventListener('click', () => setTab(t.dataset.tab));
      }
    }
  }

  // The voices: a layer on or off, pressed again back to chance.
  for (const [id, st] of [['voxOn', 'on'], ['voxOff', 'off']]) {
    el(id).addEventListener('click', () => {
      const l = open.tab;
      if (open.draft.layers[l] === st) delete open.draft.layers[l];
      else open.draft.layers[l] = st;
      renderPicker('voices');
    });
  }

  // The tempo: −1 and +1 move the whole pick, a range keeping its width.
  el('tmpDown').addEventListener('click', () => { const [a, b] = tempoNow(); if (a > LO) setTempo(a - 1, b - 1); });
  el('tmpUp').addEventListener('click', () => { const [a, b] = tempoNow(); if (b < HI) setTempo(a + 1, b + 1); });
  // The slow end and the fast end, each pushing the other: together the
  // tempo is pinned, apart a range.
  el('tmpLo').addEventListener('input', () => {
    const v = Number(el('tmpLo').value);
    const [, b] = tempoNow();
    setTempo(v, open.draft.tempo ? Math.max(v, b) : v);
  });
  el('tmpHi').addEventListener('input', () => {
    const v = Number(el('tmpHi').value);
    const [a] = tempoNow();
    setTempo(open.draft.tempo ? Math.min(v, a) : v, v);
  });
  el('tmpAny').addEventListener('click', () => {
    if (!open.draft.tempo) return;
    open.draft.from = tempoNow()[0];
    open.draft.tempo = null;
    renderPicker('tempo');
  });
  const num = el('tmpNum');
  num.addEventListener('focus', () => {
    const t = open.draft.tempo;
    num.value = !t ? '' : t[0] === t[1] ? String(t[0]) : `${t[0]}-${t[1]}`;
    num.select();
  });
  num.addEventListener('input', () => {
    const v = num.value.replace(/[^0-9\-– ]/g, '').slice(0, 7);
    if (v !== num.value) num.value = v;
  });
  num.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); num.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); num.value = ''; num.blur(); }
  });
  num.addEventListener('blur', commitTempo);
}

// What the open picker's draft is (for tests): null when none is open.
export function pickerDraft() {
  return open ? JSON.parse(JSON.stringify({ kind: open.kind, tab: open.tab || null, page: open.page, ...draftPicks() })) : null;
}
