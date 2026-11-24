// Exporting audio (queue item 104b; docs/PAINTER.md, "Exporting audio"): the
// Export view (from Save's Share tab: export audio), and the Worker that makes the file
// (js/export-worker.js, its own instance of the core).
//
// Safety first (Mikey, 2026-10-13): an export must never crash or break
// anything, whatever the device. So the file is written as it is made (the
// save picker where the browser has it, else the site's private file
// system and a download at the end), the free space is checked before
// anything starts, a browser that can do neither is told the most it can
// keep in memory before it starts, Cancel and every failure leave no file
// behind, and the music playing is never touched: the export's core is
// another instance on another thread, and "lighter on processor" makes it
// gentle (a quarter of one core). While it runs, the audio thread's busy
// reports are the export's to read (`watchBusy`): a busy audio thread moves
// it to gentle, and they never move the app to lite (the export's load is
// not the device's).
//
// The format is chosen each time, by the key that starts it (session 30e:
// "export flac", "export opus"): Lossless (FLAC, the core's own writer) or
// Small (queue item 104c: Opus through the browser's own encoder, written
// into an Ogg file by js/ogg.js, in the Worker). Small shows only where the
// Worker says the browser can encode Opus (never a fallback that could fail
// on a weak phone); a browser with AAC and not Opus has it hidden too.
//
// Every file is tagged (item 121, js/tags.js): its name, the album's and its
// place in it, the app, the day, its code, and its cover as the picture.
//
// An album exported whole (item 121; Mikey, 2026-11-23: "On the share
// screen, there should be a way to export an album"): when an album plays,
// or is open in the Library, the view offers loop or album, and for the
// album one zip or a file a track ("let the user choose"). Its tracks are
// made one at a time, each as long as its track length (a track that plays
// on asks how long once, for all of them), in one calm progress with Cancel.
// The space for the whole album is checked first. One zip goes where a
// single file goes (the save picker, Android's picker, the private file and
// a download at the end, memory); a file a track goes into a folder chosen
// once (the browser's folder picker, Android's own), or downloads as each
// is made (the browser asks once whether the site may download several
// files). A track that fails is said, and the rest kept; Cancel or a full
// disk keeps no zip, and keeps the tracks already saved as files.

import { askOf } from './player.js';
import { coreTrack, trackOfSpec, setTrack } from './tracklen.js';
import { LAYERS, pieceOf, loopBars } from './request.js';
import { fetchCore } from './core.js';
import { newSpec } from './gen.js';
import * as ui from './ui.js';
import { TAIL_MAX } from './export-render.js';
import { appLink } from './app.js';
import { moduleWorkerUrl } from './worker-blob.js';
import { tagsOf, pictureOf } from './tags.js';
import { ZIP_MOST } from './zip.js';

// The most a browser with no file to write to may keep in memory
// (`MEMORY_SECONDS`, with the bytes it takes stated as `MEMORY_BYTES`, its
// hard stop).
const MEMORY_SECONDS = 600;
const MEMORY_BYTES = 160 * 1024 * 1024;
// The bytes a second of FLAC takes, for the size shown and the space
// checked, by lanes: the most any of 24 corpus loops of a minute took
// (tools/export.mjs --sizes, 44.1 kHz 16-bit at full quality: 27,688 mono
// and 47,662 stereo, the medians 18,212 and 32,505; session 20), with a
// third more. And the margin the free space must hold beyond it.
const BYTES_PER_SECOND = { 1: 36000, 2: 64000 };
// And of Small's Opus, by lanes: its bit rates (js/export-opus.js: 64 and 96
// kbit/s, constant) and the Ogg pages' 0.8%, rounded up.
const SMALL_BYTES_PER_SECOND = { 1: 8100, 2: 12100 };
const MARGIN = 1.25;
// What an album's track adds beyond its audio: its cover and tags, and the
// zip's headers, with room to spare (a 600 px cover is about 100 KB).
const TRACK_EXTRA = 400 * 1024;
// An exported file's cover: as wide as players show one.
const COVER = 600;
// A busy audio thread while exporting (its busiest quarter-second, as a
// share of its own time; js/quality.js's reports): past this the export goes
// gently for the rest of its run.
const BUSY_LINE = 0.5;

// The sheet's words (for Mikey to approve: docs/notes/for-mikey.md).
export const WORDS = {
  sized: (format, s) => `${format} ~${s}`,
  memoryLong: (t) => `${t} max`,
  progress: (pct, left) => `${pct}%${left ? ` · ${left} left` : ''}`,
  cancelling: 'Canceling...',
  background: 'Closing app stops it.',
  saved: (name, size, t) => `Saved ${name} · ${size} · ${t}`,
  cancelled: 'Canceled.',
  space: (need, free) => `Not enough space: needs ${need}, ${free} free.`,
  space_app: (need, free) => `Not enough space there: needs ${need}, ${free} free.`,
  seek: "Can't save there. Try Downloads or Documents.",
  spaceLate: 'Out of space. Nothing saved.',
  memoryFull: 'Too long. Nothing saved.',
  failed: 'Export failed. Nothing saved.',
  cant: "Can't export audio here.",
  // An album's (item 121).
  albumSized: (n, t, sizes) => `${n} tracks · ${t} · ${sizes}`,
  albumProgress: (i, n, pct, left) => `${i}/${n} · ${pct}%${left ? ` · ${left} left` : ''}`,
  savedFiles: (k, size, t) => `Saved ${k} files · ${size} · ${t}`,
  trackFailed: (list) => `Track ${list.join(', ')} failed; the rest saved.`,
  kept: (why, k, n) => `${why} ${k} of ${n} saved.`,
  zipLarge: 'Too big for one zip. Try files.',
};

// What the format keys' description says to a screen reader (session 30e:
// fewer words on screen, never fewer for a listener who can't see it).
const SPOKEN = {
  whole: (t) => `The whole piece, ${t}.`,
  track: (t) => `As long as the track: ${t}.`,
  ask: 'This plays on and on, so you set how long first.',
  memoryLong: (t) => `This browser can keep ${t} at most: set a shorter track length.`,
  memory: (t) => `This browser can't write a file as it goes, so it keeps the export in memory: ${t} at most.`,
  gentle: 'Lite is on, so it goes gently: slower, and the music never stutters.',
  fast: 'It goes as fast as this device safely can.',
  picker: 'You choose where it goes.',
  private: 'It downloads when it is done.',
  cant: "This browser can't export audio. A recent Chrome, Firefox or Safari can.",
  album: (n, title, t) => `The album ${title}, ${n} tracks, ${t}.`,
  albumAsk: (n, title) => `The album ${title}, ${n} tracks. A track plays on and on, so you set how long first, for every track that does.`,
  zip: 'As one zip file of its tracks.',
  files: 'A file a track.',
  folder: 'You choose a folder, and each track is saved there as it is made.',
  downloads: 'Each track downloads as it is made; the browser may ask whether this site can download several files.',
  zipPicker: 'You choose where the zip goes.',
};

const el = (id) => document.getElementById(id);

// A duration in words: "45 s", "12 min", "2 h 5 min".
export function words(secs) {
  if (!(secs >= 0) || !Number.isFinite(secs)) return '';
  if (secs < 60) return `${Math.max(1, Math.round(secs))} s`;
  if (secs < 3600) return `${Math.round(secs / 60)} min`;
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs - h * 3600) / 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

// A size in words: "38 MB", "1.2 GB".
export function size(bytes) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1e6))} MB`;
}

const bar = (spec) => (spec.stepsPerBar || 16) * (60 / spec.bpm / 4);

// What an export of `spec` is (session 30c: the export is the track
// length; Mikey, 2026-11-18): { key, seconds, track }, the track as the core
// takes it ([kind, count]). The time the Track length view set, with its
// fades; with none, a finite piece whole (its fade in, if set); else null:
// a loop that plays on and on, or Endless, asks how long first (the export
// key opens the Track length view).
export function planOf(spec) {
  const t = trackOfSpec(spec);
  if (t.secs != null) return { key: 'track', seconds: t.secs, track: coreTrack(spec) };
  const piece = pieceOf(spec);
  if (piece && Number.isFinite(piece.sections)) {
    return { key: 'whole', seconds: loopBars(spec) * bar(spec), track: [1 | (t.fadeIn ? 4 : 0), 1] };
  }
  return null;
}

// The loop's name: its own, or (a loop with none of its own) the name the
// core makes for it. As a file's tag it is whole; `loopName` makes it safe
// for a file's name (as ui.download makes it).
function shownName(spec) {
  let name = String(spec.name || '').trim();
  if (!name) {
    try { name = newSpec(spec.seed >>> 0, null).name || ''; } catch { name = ''; }
  }
  return name;
}

const safeName = (name, dflt) => String(name).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').replace(/^[.\s]+/, '').slice(0, 100) || dflt;

function loopName(spec) {
  return safeName(shownName(spec), 'loop');
}

// An album's track's file: "NN name.ext" (item 121), numbered to sort.
export function trackFileName(i, n, spec, ext) {
  return `${String(i + 1).padStart(n >= 100 ? 3 : 2, '0')} ${loopName(spec)}.${ext}`;
}

// A file of that name in the folder `dir` not yet there: "name (2).ext" and
// on where one is (the folder may hold an earlier export).
async function freeHandle(dir, name) {
  const dot = name.lastIndexOf('.');
  for (let k = 1; k < 100; k++) {
    const n = k === 1 ? name : `${name.slice(0, dot)} (${k})${name.slice(dot)}`;
    try {
      await dir.getFileHandle(n);
    } catch (err) {
      if (err && err.name === 'NotFoundError') return dir.getFileHandle(n, { create: true });
      throw err;
    }
  }
  throw new Error('no free name in the folder');
}

// What each format is called in a file: its extension and media type.
export const FORMATS = {
  lossless: { ext: 'flac', type: 'audio/flac', description: 'FLAC', bytes: BYTES_PER_SECOND },
  small: { ext: 'opus', type: 'audio/ogg', description: 'Opus', bytes: SMALL_BYTES_PER_SECOND },
  // An album as one file (item 121).
  zip: { ext: 'zip', type: 'application/zip', description: 'Zip' },
};

export function fileName(spec, format = 'lossless') {
  return `${loopName(spec)}.${FORMATS[format].ext}`;
}

// The sheet's states: 'choose', 'run', 'done', 'failed'.
export class AudioExport {
  // `host`: { spec(), engine(), mono(), lite(), openTrack(from, spec),
  // album() ({ id, title, ids } or null), specs(ids), code(spec),
  // cover(spec, size) (a Blob), appName } from the app.
  constructor(host) {
    this.host = host;
    this.worker = null;
    // How the file is written here: 'app' (the Android app's own picker, its
    // bytes handed to the app as they are made: session 28), 'picker',
    // 'private' or 'memory'; null until the Worker has said, false if it
    // can't export at all.
    this.mode = null;
    // The format chosen ('lossless' or 'small'), and whether this browser can
    // make Small (the Worker says: false until it has).
    this.format = 'lossless';
    this.opus = false;
    // What is exported (item 121): 'loop' or 'album', and an album as one
    // 'zip' or 'files'; the time asked for an album's tracks that play on
    // ({ id, track }); the album's specs, kept by its tracks' ids.
    this.scope = 'loop';
    this.box = 'zip';
    this.albumTrack = null;
    this.albumKept = null;
    this.waiter = null;
    this.running = null;
    this.result = null;
    this.timer = null;
    // The Android app's end (js/app.js), or null in a browser.
    this.app = appLink();
    this.wire();
  }

  wire() {
    for (const b of document.querySelectorAll('[data-format]')) {
      b.addEventListener('click', () => {
        if (b.hidden || this.running) return;
        this.format = b.dataset.format;
        this.start();
      });
    }
    for (const b of document.querySelectorAll('[data-scope]')) {
      b.addEventListener('click', () => {
        if (this.running) return;
        this.scope = b.dataset.scope;
        this.refresh();
      });
    }
    for (const b of document.querySelectorAll('[data-box]')) {
      b.addEventListener('click', () => {
        if (this.running) return;
        this.box = b.dataset.box;
        this.refresh();
      });
    }
    el('exportCancel').addEventListener('click', () => this.cancel());
    el('exportOk').addEventListener('click', () => this.show('choose'));
    el('exportDoneBtn').addEventListener('click', () => this.show('choose'));
    el('exportSave').addEventListener('click', () => this.save());
    el('exportOpen').addEventListener('click', () => this.open());
    el('exportShare').addEventListener('click', () => this.share());
    for (const b of document.querySelectorAll('[data-stab="share"], #goExport')) b.addEventListener('click', () => this.refresh());
    // While the sheet's choice shows, it follows the loop playing (a track
    // that ended, a loop picked elsewhere): a look every second and a half,
    // and none while it is out of sight.
    this.timer = setInterval(() => {
      const sheet = el('exportChoose');
      if (sheet && !sheet.hidden && sheet.offsetParent !== null) this.refresh();
    }, 1500);
    this.show('choose');
  }

  // The Worker, started once; it says whether the private file system works.
  // In the Android app its imports are loaded by the page (js/worker-blob.js).
  boot() {
    if (this.worker || this.booting || this.mode === false) return;
    this.booting = true;
    const address = new URL('./export-worker.js', import.meta.url).href;
    Promise.resolve(this.app ? moduleWorkerUrl(address) : address).then((url) => {
      this.booting = false;
      this.worker = new Worker(url, { type: 'module' });
      this.worker.onmessage = (e) => this.receive(e.data);
      this.worker.onerror = (e) => {
        // A Worker that won't start (no module workers) or that died.
        e.preventDefault?.();
        console.error(`export worker: ${e.message || 'would not start'} ${e.filename || ''}:${e.lineno || 0}`);
        if (this.running) this.fail('write', String(e.message || 'the export stopped'));
        else {
          this.mode = false;
          this.worker = null;
          this.refresh();
        }
      };
      this.worker.postMessage({ type: 'hello' });
    }).catch((err) => {
      this.booting = false;
      console.error(`export worker: ${err && err.message}`);
      this.mode = false;
      this.refresh();
    });
  }

  receive(m) {
    // An album's run (item 121): its progress here, its tracks' ends to the
    // run waiting for them.
    if (this.running && this.running.album && m.type !== 'hello') {
      if (m.type === 'relay') this.relay(m);
      else if (m.type === 'progress') this.albumProgress(m);
      else if (this.waiter && this.waiter.types.includes(m.type)) {
        const w = this.waiter;
        this.waiter = null;
        w.resolve(m);
      }
      return;
    }
    if (m.type === 'hello') {
      this.mode = this.app ? 'app' : typeof window.showSaveFilePicker === 'function' ? 'picker' : m.private ? 'private' : 'memory';
      this.opus = !!m.opus;
      this.refresh();
    } else if (m.type === 'relay' && this.running) {
      this.relay(m);
    } else if (m.type === 'progress' && this.running) {
      this.progress(m);
    } else if (m.type === 'done' && this.running) {
      this.done(m);
    } else if (m.type === 'cancelled' && this.running) {
      this.running = null;
      if (this.app) this.app.exporting(false);
      el('exportWhy').textContent = WORDS.cancelled;
      this.show('failed');
    } else if (m.type === 'failed' && this.running) {
      this.fail(m.why, m.message);
    }
  }

  // The app's file (session 28): the Worker's bytes go to the app, which
  // writes them where the listener chose, and the answer goes back.
  relay(m) {
    this.app.request({ type: `save-${m.op}`, data: m.data, at: m.at || 0 }).then((r) => {
      if (this.worker) this.worker.postMessage({ type: 'ack', id: m.id, ok: !!(r && r.ok), why: r && r.why });
    });
  }

  // Which states show.
  show(which) {
    for (const [id, state] of [['exportChoose', 'choose'], ['exportRun', 'run'], ['exportDone', 'done'], ['exportFailed', 'failed']]) el(id).hidden = which !== state;
    if (which === 'choose') this.refresh();
  }

  // The choice, for the loop playing now: its length and each format's size
  // on screen, the rest in the keys' description.
  refresh() {
    this.boot();
    const spec = this.host.spec();
    const keys = [...document.querySelectorAll('[data-format]')];
    if (this.mode === false || !spec) {
      const cant = this.mode === false;
      this.about(cant ? WORDS.cant : '', cant ? SPOKEN.cant : '');
      for (const b of keys) b.disabled = true;
      return;
    }
    // Small shows only where it works.
    document.querySelector('[data-format="small"]').hidden = !this.opus;
    // Loop or album (item 121): offered while there is an album.
    const album = this.albumNow();
    if (!album) this.scope = 'loop';
    el('exportScope').hidden = !album;
    // Pressed is a ring (.armed), as the Track length view's keys are.
    const press = (b, on) => {
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('armed', on);
    };
    for (const b of document.querySelectorAll('[data-scope]')) press(b, b.dataset.scope === this.scope);
    for (const b of document.querySelectorAll('[data-box]')) {
      b.hidden = this.scope !== 'album';
      press(b, b.dataset.box === this.box);
    }
    el('exportMidi').hidden = this.scope === 'album';
    if (this.scope === 'album') {
      this.refreshAlbum(album, keys);
      return;
    }
    const plan = planOf(spec);
    const memory = this.mode === 'memory';
    const tooLong = memory && !!plan && plan.seconds > MEMORY_SECONDS;
    const lanes = this.host.mono() ? 1 : 2;
    const most = words(MEMORY_SECONDS);
    const shown = [];
    const said = [];
    if (plan) {
      const key = plan.key === 'whole' ? 'whole' : 'track';
      shown.push(words(plan.seconds));
      said.push(SPOKEN[key](words(plan.seconds)));
    } else {
      said.push(SPOKEN.ask);
    }
    if (tooLong) {
      shown.push(WORDS.memoryLong(most));
      said.push(SPOKEN.memoryLong(most));
    } else if (plan) {
      const sizes = (this.opus ? ['lossless', 'small'] : ['lossless'])
        .map((f) => [FORMATS[f].ext, size((plan.seconds + TAIL_MAX) * FORMATS[f].bytes[lanes])]);
      shown.push(sizes.map(([f, n]) => WORDS.sized(f, n)).join(', '));
      said.push(sizes.map(([f, n]) => `${f.toUpperCase()}: about ${n}.`).join(' '));
    }
    if (this.mode === 'picker' || this.mode === 'app') said.push(SPOKEN.picker);
    else if (this.mode === 'private') said.push(SPOKEN.private);
    else if (memory && !tooLong) said.push(SPOKEN.memory(most));
    said.push(this.pace() === 'gentle' ? SPOKEN.gentle : SPOKEN.fast);
    this.about(shown.join(' · '), said.join(' '));
    // With no end, or too long to keep, a key opens the Track length view.
    for (const b of keys) {
      b.disabled = this.mode == null || !!this.running;
      b.dataset.asks = !plan || tooLong ? 'length' : '';
    }
  }

  // The line under the format keys, and their description.
  about(shown, said) {
    const line = el('exportAbout');
    line.textContent = shown;
    line.hidden = !shown;
    el('exportHint').textContent = said;
  }

  // "Lighter on processor" on: gentle. Off: as fast as is safe, which on a
  // device of two cores or fewer is gentle too.
  pace() {
    if (this.host.lite()) return 'gentle';
    const cores = navigator.hardwareConcurrency || 2;
    return cores <= 2 ? 'gentle' : 'fast';
  }

  // The switch moved while an export runs.
  setPace() {
    if (this.running && !this.running.slowed) this.worker.postMessage({ type: 'pace', pace: this.pace() });
    if (!this.running) this.refresh();
  }

  // A report from the audio thread (js/main.js's onBusy) while an export
  // runs: true if the export took it (the app's own rule leaves it alone).
  watchBusy(report) {
    if (!this.running) return false;
    if (report && report.max > BUSY_LINE && !this.running.slowed && this.worker) {
      this.running.slowed = true;
      this.worker.postMessage({ type: 'pace', pace: 'gentle' });
    }
    return true;
  }

  async start() {
    if (this.running || !this.mode) return;
    if (this.scope === 'album' && this.albumNow()) {
      await this.startAlbum();
      return;
    }
    const spec = this.host.spec();
    const engine = this.host.engine();
    if (!spec) return;
    const chosen = planOf(spec);
    // Nothing would end it, or it is longer than this browser can keep: how
    // long, first (the Track length view, which exports on done).
    if (!chosen || (this.mode === 'memory' && chosen.seconds > MEMORY_SECONDS)) {
      this.host.openTrack();
      return;
    }
    const lanes = this.host.mono() ? 1 : 2;
    const format = this.format === 'small' && this.opus ? 'small' : 'lossless';
    const need = (chosen.seconds + TAIL_MAX) * FORMATS[format].bytes[lanes] * MARGIN;
    let name = fileName(spec, format);
    // Free space first (the origin's share of the disk, as the browser
    // counts it; the picker's file lands outside it, but on the same disk).
    if (this.mode !== 'memory' && this.mode !== 'app') {
      try {
        const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
        const free = est && Number.isFinite(est.quota) && Number.isFinite(est.usage) ? est.quota - est.usage : null;
        if (free != null && free < need) {
          el('exportWhy').textContent = WORDS.space(size(need), size(Math.max(0, free)));
          this.show('failed');
          return;
        }
      } catch { /* no estimate here: the write itself says if the disk fills */ }
    } else if (need / MARGIN > MEMORY_BYTES) {
      el('exportWhy').textContent = WORDS.memoryFull;
      this.show('failed');
      return;
    }
    let handle = null;
    if (this.mode === 'picker') {
      try {
        handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: FORMATS[format].description, accept: { [FORMATS[format].type]: [`.${FORMATS[format].ext}`] } }] });
      } catch (err) {
        // Closed without choosing: nothing to do. Anything else: the
        // private file system instead.
        if (err && err.name === 'AbortError') return;
        handle = null;
      }
    }
    let saved = null;
    if (this.mode === 'app') {
      // Android's own picker, then the platform's free space for the place
      // chosen; FLAC's header is written again at the end, which a place
      // that only streams can't do (the app says so, and removes the file).
      const r = await this.app.request({ type: 'save', name, mime: FORMATS[format].type, need: Math.ceil(need), seek: format === 'lossless' });
      if (!r || !r.ok) {
        if (r && r.cancelled) return;
        el('exportWhy').textContent = r && r.why === 'space' ? WORDS.space_app(size(need), size(Math.max(0, r.free))) : r && r.why === 'seek' ? WORDS.seek : WORDS.failed;
        this.show('failed');
        return;
      }
      saved = r;
    }
    let bytes;
    try {
      bytes = await fetchCore();
    } catch {
      if (saved) this.app.send({ type: 'save-abort' });
      this.fail('render', 'no core');
      return;
    }
    // Its tags and its cover (item 121).
    const tags = tagsOf({ loop: { name: shownName(spec), code: this.host.code ? this.host.code(spec) : '' }, artist: this.host.appName || '', date: new Date() });
    const picture = await this.picture(spec);
    const job = {
      seed: spec.seed >>> 0,
      ask: askOf(spec),
      mutes: LAYERS.map((l) => !!(spec.mutes && spec.mutes[l])),
      wander: engine && engine.driftOn ? engine.driftAmount : 0,
      salt: engine ? engine.wanderSalt : 0,
      layout: lanes,
      track: chosen.track,
      format: format === 'small' ? 'opus' : 'flac',
    };
    const sink = saved ? 'app' : handle ? 'handle' : this.mode === 'memory' ? 'memory' : 'private';
    // The picker may have changed the name (a file of that name was there).
    if (saved && saved.name) name = saved.name;
    this.running = { name, sink, handle, chosen, format, began: performance.now(), slowed: false, spec };
    if (saved) this.app.exporting(true, name, 0);
    this.result = null;
    this.fill(0);
    el('exportProgress').textContent = WORDS.progress(0, null);
    el('exportNote').textContent = WORDS.background;
    this.show('run');
    this.worker.postMessage({ type: 'start', bytes, job, sink, handle, name, title: loopName(spec), pace: this.pace(), limit: MEMORY_BYTES, tags, picture });
  }

  // The loop's cover as an exported file's picture (a JPEG, drawn as the
  // Library draws it), or null: a file is still made without one.
  async picture(spec) {
    try {
      const blob = this.host.cover ? await this.host.cover(spec, COVER) : null;
      return blob ? pictureOf(new Uint8Array(await blob.arrayBuffer())) : null;
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------------ albums

  // The album there is to export: the one playing, else the one open in the
  // Library ({ id, title, specs }), or null. Its loops are read again only
  // when its tracks change.
  albumNow() {
    const a = this.host.album ? this.host.album() : null;
    if (!a || !a.ids || !a.ids.length) return null;
    const key = `${a.id}|${a.ids.join(',')}`;
    if (!this.albumKept || this.albumKept.key !== key) {
      const specs = this.host.specs(a.ids);
      this.albumKept = { key, specs };
    }
    if (!this.albumKept.specs.length) return null;
    return { id: a.id, title: a.title, specs: this.albumKept.specs };
  }

  // Each track as it exports: its spec (with the time asked, where it plays
  // on and a time was asked) and its plan; the album's seconds, its longest
  // track's, and the first track that still asks how long.
  albumPlan(album) {
    const asked = this.albumTrack && this.albumTrack.id === album.id ? this.albumTrack.track : null;
    let asks = null;
    const tracks = album.specs.map((original) => {
      let spec = original;
      let plan = planOf(spec);
      if (!plan && asked) {
        spec = setTrack({ ...original }, asked);
        plan = planOf(spec);
      }
      if (!plan && !asks) asks = original;
      return { spec, original, plan };
    });
    const secs = tracks.map((t) => (t.plan ? t.plan.seconds : 0));
    return { tracks, asks, seconds: secs.reduce((a, b) => a + b, 0), longest: Math.max(...secs) };
  }

  refreshAlbum(album, keys) {
    const plan = this.albumPlan(album);
    const n = plan.tracks.length;
    const memory = this.mode === 'memory';
    const zip = this.box === 'zip';
    const tooLong = memory && !plan.asks && (zip ? plan.seconds : plan.longest) > MEMORY_SECONDS;
    const lanes = this.host.mono() ? 1 : 2;
    const shown = [];
    const said = [];
    if (plan.asks) {
      shown.push(`${n} tracks`);
      said.push(SPOKEN.albumAsk(n, album.title));
    } else {
      const sizes = (this.opus ? ['lossless', 'small'] : ['lossless'])
        .map((f) => [FORMATS[f].ext, size(this.albumBytes(plan, f, lanes) / MARGIN)]);
      shown.push(WORDS.albumSized(n, words(plan.seconds), sizes.map(([f, b]) => WORDS.sized(f, b)).join(', ')));
      said.push(SPOKEN.album(n, album.title, words(plan.seconds)));
      said.push(sizes.map(([f, b]) => `${f.toUpperCase()}: about ${b}.`).join(' '));
    }
    if (tooLong) {
      shown.push(WORDS.memoryLong(words(MEMORY_SECONDS)));
      said.push(SPOKEN.memoryLong(words(MEMORY_SECONDS)));
    }
    said.push(zip ? SPOKEN.zip : SPOKEN.files);
    if (zip) said.push(this.mode === 'picker' || this.mode === 'app' ? SPOKEN.zipPicker : this.mode === 'private' ? SPOKEN.private : memory && !tooLong ? SPOKEN.memory(words(MEMORY_SECONDS)) : '');
    else said.push((this.mode === 'picker' && typeof window.showDirectoryPicker === 'function') || this.mode === 'app' ? SPOKEN.folder : SPOKEN.downloads);
    said.push(this.pace() === 'gentle' ? SPOKEN.gentle : SPOKEN.fast);
    this.about(shown.join(' · '), said.filter(Boolean).join(' '));
    for (const b of keys) {
      b.disabled = this.mode == null || !!this.running;
      b.dataset.asks = plan.asks ? 'length' : '';
    }
  }

  // The bytes the album takes, with the margin the space check holds.
  albumBytes(plan, format, lanes) {
    return plan.tracks.reduce((sum, t) => sum + ((t.plan ? t.plan.seconds : 0) + TAIL_MAX) * FORMATS[format].bytes[lanes] * MARGIN + TRACK_EXTRA, 0);
  }

  // The album exported, `track` the time the Track length view gave for its
  // tracks that play on (item 121).
  async startAlbum(track = null) {
    if (this.running || !this.mode) return;
    const album = this.albumNow();
    if (!album) return;
    if (track) this.albumTrack = { id: album.id, track };
    const plan = this.albumPlan(album);
    // A track plays on: how long, first, for every one that does.
    if (plan.asks) {
      this.host.openTrack('album', plan.asks);
      return;
    }
    const zip = this.box === 'zip';
    const memory = this.mode === 'memory';
    const lanes = this.host.mono() ? 1 : 2;
    const format = this.format === 'small' && this.opus ? 'small' : 'lossless';
    const need = this.albumBytes(plan, format, lanes);
    const failNow = (why) => {
      el('exportWhy').textContent = why;
      this.show('failed');
    };
    if (memory && (zip ? plan.seconds : plan.longest) > MEMORY_SECONDS) return failNow(WORDS.memoryFull);
    if (zip && need / MARGIN > ZIP_MOST) return failNow(WORDS.zipLarge);
    if (!memory && this.mode !== 'app') {
      try {
        const est = navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null;
        const free = est && Number.isFinite(est.quota) && Number.isFinite(est.usage) ? est.quota - est.usage : null;
        if (free != null && free < need) return failNow(WORDS.space(size(need), size(Math.max(0, free))));
      } catch { /* no estimate here: the writes say if the disk fills */ }
    } else if (memory && zip && need / MARGIN > MEMORY_BYTES) {
      return failNow(WORDS.memoryFull);
    }
    const name = `${safeName(album.title, 'album')}.zip`;
    let handle = null;
    let dir = null;
    let app = null;
    if (zip && this.mode === 'picker') {
      try {
        handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: FORMATS.zip.description, accept: { [FORMATS.zip.type]: ['.zip'] } }] });
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        handle = null;
      }
    } else if (!zip && this.mode === 'picker' && typeof window.showDirectoryPicker === 'function') {
      try {
        dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'export' });
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        dir = null;
      }
    } else if (this.mode === 'app') {
      // Android's own picker: a new file for the zip (its headers written
      // again at their places, so a place that only streams can't take it),
      // or a folder for the tracks, its space checked with the first.
      const r = zip
        ? await this.app.request({ type: 'save', name, mime: FORMATS.zip.type, need: Math.ceil(need), seek: true })
        : await this.app.request({ type: 'save-folder' });
      if (!r || !r.ok) {
        if (r && r.cancelled) return;
        return failNow(r && r.why === 'space' ? WORDS.space_app(size(need), size(Math.max(0, r.free))) : r && r.why === 'seek' ? WORDS.seek : WORDS.failed);
      }
      app = r;
    }
    let core;
    try {
      core = await fetchCore();
    } catch {
      if (app && zip) this.app.send({ type: 'save-abort' });
      return failNow(WORDS.failed);
    }
    const sink = app ? 'app' : handle ? 'handle' : memory ? 'memory' : 'private';
    const kind = FORMATS[format];
    this.running = {
      album: true, title: album.title, tracks: plan.tracks, n: plan.tracks.length, index: 0, zip, sink, handle, dir,
      name: zip && app && app.name ? app.name : name, format, ext: kind.ext, mime: kind.type, need, lanes,
      date: new Date(), began: performance.now(), slowed: false, cancelled: false,
      expected: plan.tracks.map((t) => t.plan.seconds + TAIL_MAX), doneShare: 0, saved: [], failed: [], bytes: 0, seconds: 0,
    };
    if (app) this.app.exporting(true, album.title, 0);
    this.result = null;
    this.fill(0);
    el('exportProgress').textContent = WORDS.albumProgress(1, this.running.n, 0, null);
    el('exportNote').textContent = WORDS.background;
    this.show('run');
    this.runAlbum(core).catch((err) => {
      console.warn('album export:', err);
      this.albumEnd({ stop: 'write' });
    });
  }

  // The Worker's next word of `types`.
  next(types) {
    return new Promise((resolve) => { this.waiter = { types, resolve }; });
  }

  async runAlbum(core) {
    const r = this.running;
    if (r.zip) {
      this.worker.postMessage({ type: 'zip', sink: r.sink, handle: r.handle, name: r.name, limit: MEMORY_BYTES, date: r.date.getTime() });
      const m = await this.next(['zip-open', 'failed']);
      if (m.type === 'failed') return this.albumEnd({ stop: m.why });
    }
    const total = r.expected.reduce((a, b) => a + b, 0);
    let stop = null;
    for (let i = 0; i < r.n && !r.cancelled; i++) {
      r.index = i;
      const t = r.tracks[i];
      let fileName = trackFileName(i, r.n, t.spec, r.ext);
      el('exportProgress').textContent = WORDS.albumProgress(i + 1, r.n, Math.floor(r.doneShare * 100), null);
      const picture = await this.picture(t.original);
      if (r.cancelled) break;
      const tags = tagsOf({
        loop: { name: shownName(t.spec), code: this.host.code ? this.host.code(t.original) : '' },
        album: { title: r.title, track: i + 1, total: r.n }, artist: this.host.appName || '', date: r.date,
      });
      let sink = r.sink;
      let handle = null;
      if (!r.zip && r.dir) {
        try {
          handle = await freeHandle(r.dir, fileName);
          fileName = handle.name;
          sink = 'handle';
        } catch (err) {
          console.warn('album export: the folder', err);
          stop = 'write';
          break;
        }
      } else if (!r.zip && sink === 'app') {
        const a = await this.app.request({ type: 'save-in', name: fileName, mime: r.mime, need: i === 0 ? Math.ceil(r.need) : 0, seek: r.format === 'lossless' });
        if (!a || !a.ok) {
          stop = a && a.why === 'space' ? 'space-app' : a && a.why === 'seek' ? 'seek' : 'write';
          r.free = a && a.free;
          break;
        }
        if (a.name) fileName = a.name;
      }
      if (r.cancelled) break;
      this.worker.postMessage({
        type: 'start', bytes: core, job: this.jobOf(t, r), sink, handle, name: fileName, title: loopName(t.spec), pace: r.slowed ? 'gentle' : this.pace(),
        limit: MEMORY_BYTES, tags, picture, entry: r.zip ? fileName : null, keep: i > 0,
      });
      const m = await this.next(['done', 'failed', 'cancelled']);
      r.doneShare += r.expected[i] / total;
      if (m.type === 'done') {
        r.saved.push(fileName);
        r.bytes += m.bytes;
        r.seconds += m.seconds;
        // A file a track with nowhere chosen: each downloads as it is made.
        if (!r.zip && m.file) ui.download(m.file, fileName);
      } else if (m.type === 'cancelled') {
        r.cancelled = true;
      } else if (m.why === 'render') {
        // One track the core could not make: said, and the rest go on.
        console.warn('album export: track', i + 1, m.message);
        r.failed.push(i + 1);
      } else {
        stop = m.why;
        break;
      }
    }
    if (r.cancelled || stop || !r.saved.length) return this.albumEnd({ stop: r.cancelled ? 'cancelled' : stop || 'render' });
    if (r.zip) {
      this.worker.postMessage({ type: 'zip-end' });
      const m = await this.next(['zip-done', 'failed']);
      if (m.type === 'failed') return this.albumEnd({ stop: m.why });
      return this.albumEnd({ file: m.file, bytes: m.bytes });
    }
    return this.albumEnd({});
  }

  // The job for an album's track: as the single export's, the wander the
  // app's now, and the track's own salt (the playing track's, as it plays).
  jobOf(t, r) {
    const engine = this.host.engine();
    const playing = t.original === this.host.spec();
    return {
      seed: t.spec.seed >>> 0,
      ask: askOf(t.spec),
      mutes: LAYERS.map((l) => !!(t.spec.mutes && t.spec.mutes[l])),
      wander: engine && engine.driftOn ? engine.driftAmount : 0,
      salt: playing && engine ? engine.wanderSalt : (t.spec.wanderSalt || 0) >>> 0,
      layout: r.lanes,
      track: t.plan.track,
      format: r.format === 'small' ? 'opus' : 'flac',
    };
  }

  albumProgress(m) {
    const r = this.running;
    // Cancel pressed as a track was handed over: said again, now it runs.
    if (r.cancelled) this.worker.postMessage({ type: 'cancel' });
    const total = r.expected.reduce((a, b) => a + b, 0);
    const here = m.expected ? Math.min(1, m.frames / m.expected) : 0;
    const share = Math.min(0.99, r.doneShare + here * (r.expected[r.index] / total));
    const pct = Math.floor(share * 100);
    const took = (performance.now() - r.began) / 1000;
    const left = share > 0.02 ? (took / share) * (1 - share) : null;
    if (r.sink === 'app') this.app.exporting(true, r.title, pct);
    this.fill(pct);
    el('exportProgress').textContent = WORDS.albumProgress(r.index + 1, r.n, pct, left != null ? words(left) : null);
  }

  // The album's end: done (`file` and `bytes` for a zip), or `stop` ('cancelled',
  // or why it stopped). A zip stopped is removed; a file a track keeps the
  // tracks saved.
  async albumEnd({ stop = null, file = null, bytes = 0 }) {
    const r = this.running;
    if (!r) return;
    if (stop && r.zip) {
      this.worker.postMessage({ type: 'zip-abort' });
      await this.next(['zip-gone']);
    }
    this.running = null;
    this.waiter = null;
    if (this.app) this.app.exporting(false);
    if (stop) {
      const k = r.zip ? 0 : r.saved.length;
      const why = stop === 'cancelled' ? WORDS.cancelled
        : stop === 'space' ? WORDS.spaceLate
        : stop === 'space-app' ? WORDS.space_app(size(r.need), size(Math.max(0, r.free || 0)))
        : stop === 'seek' ? WORDS.seek
        : stop === 'memory' ? WORDS.memoryFull
        : stop === 'large' ? WORDS.zipLarge : WORDS.failed;
      // What was kept, said with the reason (its "Nothing saved." goes).
      el('exportWhy').textContent = k ? WORDS.kept(why.replace(/ Nothing saved\.$/, ''), k, r.n) : why;
      ui.announce(el('exportWhy').textContent);
      this.show('failed');
      return;
    }
    const t = words(r.seconds);
    const failed = r.failed.length ? ` ${WORDS.trackFailed(r.failed)}` : '';
    if (r.zip) {
      const placed = r.sink === 'handle' || r.sink === 'app';
      this.result = { file, name: r.name, sink: r.sink, handle: r.handle, format: 'zip', url: null };
      el('exportSaved').textContent = WORDS.saved(r.name, size(bytes), t) + failed;
      el('exportSave').hidden = placed;
      el('exportOpen').hidden = false;
      this.show('done');
      el('exportShare').hidden = !this.canShare();
      if (!placed) this.save();
    } else {
      this.result = null;
      el('exportSaved').textContent = WORDS.savedFiles(r.saved.length, size(r.bytes), t) + failed;
      // Each file is where it went: nothing more to save, open or share.
      el('exportSave').hidden = true;
      el('exportOpen').hidden = true;
      el('exportShare').hidden = true;
      this.show('done');
    }
    ui.announce(el('exportSaved').textContent);
  }

  progress(m) {
    const r = this.running;
    const share = m.expected ? Math.min(0.99, m.frames / m.expected) : 0;
    const pct = Math.floor(share * 100);
    const took = (performance.now() - r.began) / 1000;
    const left = share > 0.02 ? (took / share) * (1 - share) : null;
    if (r.sink === 'app') this.app.exporting(true, r.name, pct);
    this.fill(pct);
    el('exportProgress').textContent = WORDS.progress(pct, left != null ? words(left) : null);
    r.progress = m;
  }

  fill(pct) {
    el('exportFill').style.width = `${pct}%`;
    el('exportFill').parentElement.setAttribute('aria-valuenow', String(pct));
  }

  cancel() {
    if (!this.running) return;
    if (this.running.album) this.running.cancelled = true;
    this.worker.postMessage({ type: 'cancel' });
    el('exportProgress').textContent = WORDS.cancelling;
  }

  done(m) {
    const r = this.running;
    this.running = null;
    if (this.app) this.app.exporting(false);
    this.result = { ...m, name: r.name, sink: r.sink, handle: r.handle, format: r.format, url: null };
    const t = words(m.seconds);
    const placed = r.sink === 'handle' || r.sink === 'app';
    el('exportSaved').textContent = WORDS.saved(r.name, size(m.bytes), t);
    ui.announce(el('exportSaved').textContent);
    el('exportSave').hidden = placed;
    el('exportOpen').hidden = false;
    this.show('done');
    el('exportShare').hidden = !this.canShare();
    // The private file and the memory's are offered as a download now.
    if (!placed) this.save();
  }

  fail(why, message) {
    this.running = null;
    if (this.app) this.app.exporting(false);
    el('exportWhy').textContent = why === 'space' ? WORDS.spaceLate : why === 'memory' ? WORDS.memoryFull : WORDS.failed;
    if (message) console.warn('export:', why, message);
    ui.announce(el('exportWhy').textContent);
    this.show('failed');
  }

  // The finished file, as a File or Blob.
  async file() {
    const r = this.result;
    if (!r) return null;
    if (r.file) return r.file;
    if (r.handle) return r.handle.getFile();
    return null;
  }

  async save() {
    const f = await this.file();
    if (f) ui.download(f, this.result.name);
  }

  async open() {
    if (this.result && this.result.sink === 'app') {
      this.app.send({ type: 'save-view' });
      return;
    }
    const f = await this.file();
    if (!f) return;
    if (this.result.url) URL.revokeObjectURL(this.result.url);
    this.result.url = URL.createObjectURL(f instanceof File ? f : new File([f], this.result.name, { type: FORMATS[this.result.format || 'lossless'].type }));
    window.open(this.result.url, '_blank', 'noopener');
  }

  canShare() {
    if (this.result && this.result.sink === 'app') return true;
    try {
      const kind = FORMATS[(this.result && this.result.format) || 'lossless'];
      const probe = new File([new Uint8Array(4)], `x.${kind.ext}`, { type: kind.type });
      return !!(navigator.canShare && navigator.canShare({ files: [probe] }));
    } catch {
      return false;
    }
  }

  async share() {
    if (this.result && this.result.sink === 'app') {
      this.app.send({ type: 'save-share' });
      return;
    }
    const f = await this.file();
    if (!f) return;
    const file = f instanceof File && f.name === this.result.name ? f : new File([f], this.result.name, { type: FORMATS[this.result.format || 'lossless'].type });
    try {
      await navigator.share({ files: [file], title: this.result.name });
    } catch { /* closed, or not allowed: the file is still saved */ }
  }
}
