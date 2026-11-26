// A long piece on Now Playing. It shows:
// - where you are in it: bar 812 of 3,072, and the time played and left;
// - its line of sections, with the markers of its map: a theme entering,
//   the peak, the return, the close, a wander's turns;
// - the ways to move in it: the line itself (press a point, drag, let go),
//   and a key each way to the section before or after.
// A jump is the core's command (`Engine.jumpTo`), and the place and the map
// are the core's (`Player::place`, `Player::marks`). The page decides
// nothing about the piece: it draws what it is told.
//
// It is cheap to draw at any length.
// - The map is asked once a piece, in calls of a few milliseconds at most,
//   with a breath between (a 32,768-bar arc is about 2,800 marks). It is
//   kept as numbers, and painted once into a canvas as one-pixel ticks, with
//   a column of the line at most one tick tall.
// - The playhead is an element moved by a transform, so a frame's work is
//   one style change.
// - Endless is a window of 64 sections around the playhead, asked again
//   when the playhead moves out of it.
// Nothing here scrolls.

import { MARKS_MOST, pieceMarks } from './gen.js';
import { JUMP } from './player.js';
import { pieceOf, requestOf } from './request.js';
import { setIcon } from './ui.js';

// A piece is long from a section past the longest loop that any profile
// draws (`core/src/generator/piece.rs`). A shorter length is the loop's own.
export const LONG_FROM = 33;
// Endless is asked a window at a time: this many sections.
export const WINDOW = 64;
// Most calls for a finite piece's marks (a call gives MARKS_MOST at most).
const CALLS_MOST = 16;

// What the listener hears the unit at the playhead as: the plan's roles
// (`ROLES` in js/gen.js) in plain words. For Mikey to approve.
export const ROLE_WORDS = {
  opening: 'opening',
  theme: 'theme',
  build: 'building',
  second: 'second theme',
  development: 'developing',
  peak: 'peak',
  release: 'easing',
  return: 'return',
  close: 'close',
  breath: 'breath',
  lift: 'lift',
  holding: 'holding',
  turning: 'turning',
};

// The marks that the line draws, and how tall (0 to 1). An opening starts a
// movement (a long faint line). A second theme enters. The peak, the return
// and the close stand tallest. A wander's turns are short. The words show
// the rest of the plan's roles (the theme's own entry with the opening, a
// build, a release), not the line.
const TICKS = { opening: 1, second: 0.5, peak: 0.8, return: 0.62, close: 1, turning: 0.36 };

export const isLong = (spec) => !!spec && (spec.length === 'endless' || (Number.isFinite(spec.length) && spec.length >= LONG_FROM));

const group = (n) => Math.round(n).toLocaleString('en-US');

// A time as a clock: 4:07, 1:12:03, 27:00:00.
export function clock(secs) {
  const s = Math.max(0, Math.round(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

// ----------------------------------------------------------- the model

// A piece's map for the line, from the core: { endless, spec, first, last,
// marks }. `marks` are in order of their bar (`pieceMarks` in js/gen.js).
// `first` to `last` are the bars that the line spans (the whole piece, or
// Endless's window). Null for a loop that is not a long piece. This one is
// synchronous; the page uses `modelAsync`, in calls with a breath between.
export function windowOf(spec, section) {
  const p = pieceOf(spec);
  if (!p) return null;
  const from = Math.max(0, section - 8);
  // A window starts at a multiple of half its width, so it moves seldom.
  const start = Math.floor(from / (WINDOW / 2)) * (WINDOW / 2);
  return { start, bar: start * p.bars, end: (start + WINDOW) * p.bars };
}

// The marks of a finite piece, a call at a time (`next` gives the next
// call's marks, or null when done). The calls join at the section that the
// last one ended in, and the marks of units already given are dropped.
export function joinCalls(call) {
  const marks = [];
  let from = 0;
  for (let i = 0; i < CALLS_MOST; i++) {
    const got = call(from);
    if (!got || !got.length) return i === 0 ? null : marks;
    let last = marks.length ? marks[marks.length - 1].bar : -1;
    for (const m of got) if (m.bar > last) { marks.push(m); last = m.bar; }
    if (got.length < MARKS_MOST) break;
    from = got[got.length - 1].section;
  }
  return marks;
}

export function modelNow(spec, section = 0) {
  if (!isLong(spec)) return null;
  const p = pieceOf(spec);
  if (!p) return null;
  if (p.sections === Infinity) {
    const w = windowOf(spec, section);
    const marks = pieceMarks(spec, { from: w.start, count: WINDOW });
    return marks ? { endless: true, spec, first: w.bar, last: w.end, window: w.start, marks } : null;
  }
  const marks = joinCalls((from) => pieceMarks(spec, { from, count: p.sections - from }));
  if (!marks) return null;
  const bars = (p.sections - 1) * p.bars + p.last;
  return { endless: false, spec, first: 0, last: bars, window: 0, marks };
}

// The same, with one call a task, so that no task of the page is long. A
// 32,768-bar arc's marks are two calls of about ten milliseconds. A phone
// slowed six times is still under a hundred each. Resolves with the model,
// or null.
export function modelAsync(spec, section = 0) {
  return new Promise((resolve) => {
    if (!isLong(spec)) { resolve(null); return; }
    const p = pieceOf(spec);
    if (!p) { resolve(null); return; }
    if (p.sections === Infinity) {
      setTimeout(() => { try { resolve(modelNow(spec, section)); } catch (e) { resolve(null); } }, 0);
      return;
    }
    const marks = [];
    let from = 0;
    let n = 0;
    let last = -1;
    const step = () => {
      let got = null;
      try { got = pieceMarks(spec, { from, count: p.sections - from }); } catch (e) { got = null; }
      if (!got || !got.length) { resolve(n === 0 ? null : done()); return; }
      n++;
      for (const m of got) if (m.bar > last) { marks.push(m); last = m.bar; }
      if (got.length < MARKS_MOST || n >= CALLS_MOST) { resolve(done()); return; }
      from = got[got.length - 1].section;
      setTimeout(step, 0);
    };
    const done = () => ({ endless: false, spec, first: 0, last: (p.sections - 1) * p.bars + p.last, window: 0, marks });
    setTimeout(step, 0);
  });
}

// The mark at or before `bar` (the unit that plays), or null.
export function markAt(model, bar) {
  const marks = model.marks;
  let lo = 0;
  let hi = marks.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (marks[mid].bar <= bar) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return found < 0 ? null : marks[found];
}

// A section for the keys: a mark where the role changes. A key change
// inside a role (a development moving to its next key) is not a new
// section.
export function sectionsOf(model) {
  if (!model.sections) {
    model.sections = model.marks.filter((m, i) => i === 0 || m.role !== model.marks[i - 1].role);
  }
  return model.sections;
}

// The section before or after `bar`: the nearest one either way. "Before",
// from more than a couple of bars into a section, goes to its own start, as
// a player's previous key does. Null where there is none (the first one, or
// the last one of a finite piece).
export function neighbor(model, bar, dir, slack = 2) {
  const marks = sectionsOf(model);
  if (dir > 0) {
    for (const m of marks) if (m.bar > bar + 0.5) return m;
    return null;
  }
  for (let i = marks.length - 1; i >= 0; i--) if (marks[i].bar < bar - slack) return marks[i];
  return null;
}

// What the line says in words about a place: "bar 812 of 3,072" (Endless:
// "bar 812"), the unit's word, and the time.
export function placeWords(model, place) {
  if (!place) return { bars: model.endless ? 'bar 1' : `bar 1/${group(model.last)}`, times: '', word: '', said: model.endless ? 'bar 1' : `bar 1 of ${group(model.last)}` };
  const bar = Math.floor(place.bar) + 1;
  const mark = markAt(model, place.bar);
  const word = mark && ROLE_WORDS[mark.role] ? ROLE_WORDS[mark.role] : '';
  const total = place.bars != null ? place.bars : model.endless ? null : model.last;
  // Symbols on screen (Mikey, 2026-11-22), the words for a screen reader.
  const played = clock(place.played);
  const times = place.left != null ? `${played} · \u2212${clock(place.left)}` : played;
  const said = [total == null ? `bar ${group(bar)}` : `bar ${group(bar)} of ${group(total)}`, word,
    `${played} played`, place.left != null ? `${clock(place.left)} left` : ''].filter(Boolean).join(', ');
  return {
    bars: total == null ? `bar ${group(bar)}` : `bar ${group(bar)}/${group(total)}`,
    said,
    times,
    word,
  };
}

// ------------------------------------------------------------ the line

// Where `bar` falls on a line of `width` pixels.
export function xOf(model, bar, width) {
  const span = model.last - model.first;
  return span > 0 ? Math.max(0, Math.min(width, ((bar - model.first) / span) * width)) : 0;
}

// The bar at a pixel: the other way.
export function barAt(model, x, width) {
  const span = model.last - model.first;
  return width > 0 ? model.first + Math.max(0, Math.min(1, x / width)) * span : model.first;
}

// The ticks as columns: for each pixel, the tallest mark that falls in it
// (and its role), as a `Float32Array` of heights and an array of roles.
// It is cheap: one pass over the marks (two for a crowded piece), whatever
// the length. A piece with more marks than a third of the line's pixels (a
// 32,768-bar arc has 2,700) would look like a comb. So the line keeps the
// markers that matter most to a listener: where a movement opens, the peak
// and the close (for a wander, every few of its turns).
export const DENSE = 0.33;
const KEPT_WHEN_DENSE = ['opening', 'peak', 'close'];
export function columns(model, width) {
  const heights = new Float32Array(width);
  const roles = new Array(width).fill(null);
  let drawn = 0;
  for (const m of model.marks) if (TICKS[m.role]) drawn++;
  const dense = drawn > width * DENSE;
  // A crowded wander's turns are thinned to about a third of the pixels.
  const every = Math.max(1, Math.ceil(drawn / (width * DENSE)));
  let turns = 0;
  for (const m of model.marks) {
    const h = TICKS[m.role];
    if (!h || m.bar < model.first || m.bar > model.last) continue;
    if (dense && !KEPT_WHEN_DENSE.includes(m.role) && !(m.role === 'turning' && turns++ % every === 0)) continue;
    const x = Math.min(width - 1, Math.floor(xOf(model, m.bar, width)));
    if (h > heights[x]) { heights[x] = h; roles[x] = m.role; }
  }
  return { heights, roles, dense };
}

// Paint the line's ticks into `canvas` at its CSS size and the screen's
// density: a quiet baseline, then the ticks. The colors are the theme's own.
export function paintLine(canvas, model) {
  const css = getComputedStyle(canvas);
  const w = Math.max(1, Math.round(canvas.clientWidth));
  const h = Math.max(1, Math.round(canvas.clientHeight));
  const dpr = Math.min(3, Math.max(1, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const quiet = css.getPropertyValue('--piece-tick').trim() || css.color;
  const loud = css.getPropertyValue('--piece-mark').trim() || css.color;
  // The rail the ticks stand on.
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = quiet;
  ctx.fillRect(0, h - 3, w, 2);
  const { heights, roles } = columns(model, w);
  for (let x = 0; x < w; x++) {
    const hh = heights[x];
    if (!hh) continue;
    const role = roles[x];
    const mark = role === 'peak' || role === 'close' || role === 'return';
    ctx.globalAlpha = mark ? 1 : 0.9;
    ctx.fillStyle = mark ? loud : quiet;
    const th = Math.max(3, Math.round((h - 4) * hh));
    ctx.fillRect(x, h - 3 - th, 1.5, th);
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------- on the screen

let host = null;
let view = null; // { model, drawnWidth, place, shown }
let pending = null; // the model being asked, for what spec
let dragging = null; // { id, bar } while a finger is down on the line

// The page's few connections: `jump(kind, at)` (false if nothing plays),
// `spec()` (the loop on the card), `place()` (the core's last word),
// `playing()`, and `barSeconds()` (a bar at the tempo, before there is a
// place).
export function wirePiece(handlers) {
  host = handlers;
  const line = document.getElementById('pieceLine');
  const bounds = () => line.getBoundingClientRect();
  const barOf = (e) => {
    const r = bounds();
    return barAt(view.model, e.clientX - r.left, r.width);
  };
  // Playing or paused. When paused, the playhead goes there, and Play
  // starts from it.
  line.addEventListener('pointerdown', (e) => {
    if (!view || !view.model || e.button > 0) return;
    try { line.setPointerCapture(e.pointerId); } catch (err) { /* a pointer that is gone: the move events still come */ }
    dragging = { id: e.pointerId, bar: barOf(e) };
    showGhost();
    e.preventDefault();
  });
  line.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== dragging.id) return;
    dragging.bar = barOf(e);
    showGhost();
  });
  const finish = (e, go) => {
    if (!dragging || e.pointerId !== dragging.id) return;
    const bar = dragging.bar;
    dragging = null;
    hideGhost();
    if (go) jumpToBar(bar);
  };
  line.addEventListener('pointerup', (e) => finish(e, true));
  line.addEventListener('pointercancel', (e) => finish(e, false));
  line.addEventListener('keydown', (e) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    toSection(dir);
  });
  setIcon(document.getElementById('piecePrev'), 'prev');
  setIcon(document.getElementById('pieceNext'), 'next');
  document.getElementById('piecePrev').addEventListener('click', () => toSection(-1));
  document.getElementById('pieceNext').addEventListener('click', () => toSection(1));
}

function jumpToBar(bar) {
  const to = Math.max(0, Math.floor(bar));
  if (!host.jump(JUMP.bar, to)) return;
  // The words come from the core's next word, where it landed. When paused,
  // the playhead goes to the bar asked at once, until the core says where
  // Play goes on from (its phrase line).
  if (view && !host.playing() && view.model) view.place = askedPlace(view.model, to);
  if (view) view.shown = null;
  if (!host.playing()) updatePiece();
}

// What a jump asked while paused shows, until the core's word: the bar
// asked, the time to it at the tempo, and what is left of the piece.
function askedPlace(model, bar) {
  const last = view.place;
  const per = last && last.bar > 1 ? last.played / last.bar : host.barSeconds();
  const p = pieceOf(model.spec);
  return {
    bar,
    bars: model.endless ? null : model.last,
    played: bar * per,
    left: model.endless ? null : Math.max(0, model.last - bar) * per,
    section: p ? Math.floor(bar / p.bars) : 0,
  };
}

// Move the playhead a section on or back (the keyboard's Shift with an
// arrow, js/shortcuts.js), from any view. True if the loop is a long piece.
export function stepPiece(dir) {
  if (!updatePiece()) return false;
  toSection(dir);
  return true;
}

function toSection(dir) {
  if (!view || !view.model) return;
  const place = host.place() || view.place;
  const at = place ? place.bar : 0;
  const mark = neighbor(view.model, at, dir);
  if (!mark) return;
  jumpToBar(mark.bar);
}

function showGhost() {
  const line = document.getElementById('pieceLine');
  const ghost = document.getElementById('pieceGhost');
  const w = line.clientWidth;
  ghost.hidden = false;
  ghost.style.transform = `translateX(${xOf(view.model, dragging.bar, w).toFixed(1)}px)`;
  const place = host.place();
  const per = place && place.bar > 1 ? place.played / place.bar : host.barSeconds();
  const bar = Math.floor(dragging.bar);
  const mark = markAt(view.model, dragging.bar);
  const words = mark && ROLE_WORDS[mark.role] ? ` · ${ROLE_WORDS[mark.role]}` : '';
  document.getElementById('pieceBars').textContent = `\u2192 bar ${group(bar + 1)}${words}`;
  document.getElementById('pieceTimes').textContent = clock(bar * per);
}

function hideGhost() {
  document.getElementById('pieceGhost').hidden = true;
  view.shown = null; // the words come back from the place
}

// Called as Now Playing is drawn, and on every frame while it is up. It
// shows the piece's line and words for a long piece, and the plain rail for
// any other loop. It is cheap when nothing moved (the place is the core's
// last post, a new object each time).
export function updatePiece() {
  const spec = host.spec();
  const root = document.getElementById('nowPiece');
  const rail = document.getElementById('nowRail');
  const long = isLong(spec);
  if (!long) {
    if (!root.hidden) { root.hidden = true; rail.hidden = false; view = null; pending = null; }
    return false;
  }
  if (view && view.spec !== spec && view.key === mapKey(spec)) {
    // The same piece edited (the tempo, the tone, a layer): the same map.
    view.spec = spec;
    if (view.model) view.model.spec = spec;
  }
  if (!view || view.spec !== spec) {
    // A new piece: ask for the map; the words wait for it.
    view = { spec, key: mapKey(spec), model: null, drawnWidth: 0, place: null, shown: null, window: -1 };
    root.hidden = false;
    rail.hidden = true;
    host.fit();
    const ask = modelAsync(spec, 0);
    pending = ask;
    ask.then((model) => {
      if (pending !== ask || !view || view.spec !== spec) return;
      if (!model) { root.hidden = true; rail.hidden = false; view.broken = true; return; }
      view.model = model;
      view.drawnWidth = 0;
      updatePiece();
      host.fit();
    });
  }
  if (view.broken) return false;
  if (!view.model) return true;
  const place = host.place();
  const playing = host.playing();
  const line = document.getElementById('pieceLine');
  // When paused, the bead looks paused, but the line still moves it.
  root.classList.toggle('idle', !playing);
  // Endless: a window, asked again when the playhead leaves it.
  if (view.model.endless && place) {
    const w = windowOf(spec, place.section);
    if (w.start !== view.model.window && view.window !== w.start) {
      view.window = w.start;
      modelAsync(spec, place.section).then((model) => {
        if (model && view && view.spec === spec) { view.model = model; view.drawnWidth = 0; updatePiece(); }
      });
    }
  }
  const width = Math.round(line.clientWidth);
  // Paint again when the line's width or the theme (a class of the app)
  // changes.
  const theme = document.getElementById('app').className;
  if (width && (width !== view.drawnWidth || theme !== view.theme)) {
    paintLine(document.getElementById('pieceCanvas'), view.model);
    view.drawnWidth = width;
    view.theme = theme;
  }
  if (place) view.place = place;
  const at = place || view.place;
  if (at && !dragging) {
    const head = document.getElementById('pieceHead');
    head.style.transform = `translateX(${xOf(view.model, at.bar, width).toFixed(1)}px)`;
    if (view.shown !== at) {
      view.shown = at;
      const words = placeWords(view.model, at);
      const bars = words.word ? `${words.bars} · ${words.word}` : words.bars;
      setText('pieceBars', bars);
      setText('pieceTimes', words.times);
      line.setAttribute('aria-valuemin', String(Math.round(view.model.first)));
      line.setAttribute('aria-valuemax', String(Math.round(view.model.last)));
      line.setAttribute('aria-valuenow', String(Math.floor(at.bar) + 1));
      line.setAttribute('aria-valuetext', words.said);
      const prev = neighbor(view.model, at.bar, -1);
      const next = neighbor(view.model, at.bar, 1);
      document.getElementById('piecePrev').disabled = !prev;
      document.getElementById('pieceNext').disabled = !next;
    }
  } else if (!at && !dragging) {
    setText('pieceBars', view.model.endless ? 'bar 1' : `bar 1/${group(view.model.last)}`);
    setText('pieceTimes', '');
    // A slider says its value, even before the core has said where it is,
    // because the line takes a press while nothing plays.
    const said = placeWords(view.model, null).said;
    if (line.getAttribute('aria-valuetext') !== said) {
      line.setAttribute('aria-valuemin', String(Math.round(view.model.first)));
      line.setAttribute('aria-valuemax', String(Math.round(view.model.last)));
      line.setAttribute('aria-valuenow', '1');
      line.setAttribute('aria-valuetext', said);
    }
  }
  return true;
}

function setText(id, text) {
  const node = document.getElementById(id);
  if (node.textContent !== text) node.textContent = text;
}

// What the plan depends on: the seed and the request. The edits (the tempo,
// the tone, a layer re-rolled) leave a piece's map as it is.
const keys = new WeakMap();
function mapKey(spec) {
  let k = keys.get(spec);
  if (k === undefined) {
    k = `${spec.seed}|${JSON.stringify(requestOf(spec))}`;
    keys.set(spec, k);
  }
  return k;
}

// What a test or a row may read: if the line is up, and its map.
export function pieceState() {
  return view ? { model: view.model, place: view.place, dragging: !!dragging } : null;
}
