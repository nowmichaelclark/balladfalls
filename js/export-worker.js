// The audio export's thread (queue item 104b; Mikey, 2026-10-13: an export
// must never crash or break anything, whatever the device).
//
// Its own instance of the core (js/dlplayer.wasm, never the one that plays,
// never on the audio thread) renders the loop or the piece a chunk at a time
// (js/export-render.js) through the core's FLAC writer, and each chunk's
// bytes go straight to the file, so memory stays the same for a minute or
// three hours. The file is one of:
//
//   handle   a file the listener chose (the File System Access API's save
//            picker, where the browser has it): written through a writable
//            stream, which the browser makes the file only when it closes.
//   private  the site's private file system (OPFS), through a synchronous
//            access handle (only a Worker has one); the page offers it as a
//            download at the end.
//   memory   neither: the bytes kept here, to a limit the page states before
//            it starts, and handed to the page as one Blob.
//   app      the Android app (session 28): a file made in Android's own
//            picker, which only the page can reach (the app's bridge is in
//            the page, not in a Worker). Each megabyte goes to the page as
//            base64, the page gives it to the app, which writes it to the
//            file as it comes, and the answer (`ack`) comes back before the
//            next is made: memory stays as it is for any length.
//
// Cancel, a failure or a full disk removes what was written: no partial file
// is left behind. A page closed mid-export takes this Worker with it; its
// private file is removed the next time an export starts.
//
// Speed ("lighter on processor"): `gentle` renders in short slices and rests
// three times as long as each took, a quarter of one core, so the music
// playing never stutters and the device stays cool; `fast` renders on,
// yielding between slices only to hear Cancel. The page can move a running
// export to gentle (the audio thread getting busy).
//
// Two formats (the job's `format`): 'flac', the core's own writer, and
// 'opus' (queue item 104c), the browser's AudioEncoder through js/ogg.js
// (js/export-opus.js), which also gets the Worker's say on whether this
// browser can encode Opus at all.
//
// Tags (item 121): every file says what it is (js/tags.js): FLAC's comments
// and cover as metadata blocks after STREAMINFO, Opus's in OpusTags. The
// samples are untouched.
//
// An album as one zip (item 121, js/zip.js): `zip` opens it on a sink, each
// `start` with an `entry` is a track inside it, `zip-end` writes its
// directory (or `zip-abort` removes it). Its tracks go one at a time, so its
// memory is one track's, as a single export's is. An album as a file a track
// is a `start` a track, each its own file.
//
// Messages in: { type: 'hello' }; { type: 'start', bytes, job, sink, name,
// title, pace, limit, tags, picture, entry, keep }; { type: 'zip', sink,
// handle, name, limit, date }; { type: 'zip-end' }; { type: 'zip-abort' };
// { type: 'pace', pace }; { type: 'cancel' }; { type: 'ack', id, ok, why }
// (the app sink's answer). Taken in order, one at a time (pace, cancel and
// ack at once).
// Out: { type: 'hello', private, opus } (whether the private file system
// works here, and whether Opus can be encoded); { type: 'progress', frames,
// expected, bytes }; { type: 'done', file (private and memory), bytes,
// frames, seconds, took, counts, format }; { type:
// 'cancelled' }; { type: 'failed', why ('space', 'write', 'render',
// 'memory', 'large'), message }; { type: 'relay', id, op ('write', 'header',
// 'close', 'abort'), data, at } (the app sink's, for the page to pass on);
// { type: 'zip-open' }, { type: 'zip-done', file, bytes }, { type:
// 'zip-gone' }.

import { Render } from './export-render.js';
import { OpusMaker, opusWorks } from './export-opus.js';
import { toBase64 } from './app.js';
import { flacBlocks, opusComments } from './tags.js';
import { ZipWriter } from './zip.js';

// One slice of rendering before a yield, in milliseconds.
const SLICE = 25;
// Gentle rests this many times as long as each slice took.
const REST = 3;
// The bytes gathered before each write (one buffer, reused).
const GATHER = 1 << 20;
// How often progress is posted, in milliseconds.
const PROGRESS_EVERY = 250;
// Where private exports live.
const DIR = 'exports';

let job = null;

// A yield to the Worker's queue with no delay (a message on a channel of its
// own: not throttled like a timer), so Cancel is heard between slices.
const channel = new MessageChannel();
const waiting = [];
channel.port1.onmessage = () => { const r = waiting.shift(); if (r) r(); };
const yieldNow = () => new Promise((r) => { waiting.push(r); channel.port2.postMessage(0); });
const rest = (ms) => new Promise((r) => setTimeout(r, ms));

const isSpace = (err) => err && (err.name === 'QuotaExceededError' || /quota|space|disk full/i.test(String(err.message || err)));

async function privateDir() {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(DIR, { create: true });
}

// Whether the private file system works here, with a synchronous handle
// (not in Firefox before 111, Safari before 15.2, or a private window that
// refuses it).
async function privateWorks() {
  try {
    if (!navigator.storage || !navigator.storage.getDirectory) return false;
    const dir = await privateDir();
    const probe = await dir.getFileHandle('.probe', { create: true });
    if (typeof probe.createSyncAccessHandle !== 'function') return false;
    const h = await probe.createSyncAccessHandle();
    h.close();
    await dir.removeEntry('.probe');
    return true;
  } catch {
    return false;
  }
}

// The sinks: open, write(bytes), header(bytes at 0), close() -> what the
// page is given, remove().
class PrivateSink {
  // `keep`: an album's later track (a file a track, each downloaded as it is
  // made): the tracks before it stay until they are taken.
  constructor(keep = false) {
    this.keep = keep;
  }

  async open(name) {
    const dir = await privateDir();
    // Nothing older stays: a page closed mid-export, or the last export,
    // already offered.
    if (!this.keep) {
      for await (const key of dir.keys()) {
        try { await dir.removeEntry(key); } catch { /* still open elsewhere */ }
      }
    }
    this.dir = dir;
    this.name = name;
    this.file = await dir.getFileHandle(name, { create: true });
    this.h = await this.file.createSyncAccessHandle();
    this.h.truncate(0);
    this.at = 0;
  }

  write(bytes) {
    const n = this.h.write(bytes, { at: this.at });
    if (n !== bytes.length) {
      const e = new Error('the disk took only part of a write');
      e.name = 'QuotaExceededError';
      throw e;
    }
    this.at += n;
  }

  header(bytes) {
    this.h.write(bytes, { at: 0 });
  }

  // Bytes written again where they were (the zip's headers, item 121).
  writeAt(at, bytes) {
    this.h.write(bytes, { at });
  }

  async close() {
    this.h.flush();
    this.h.close();
    this.h = null;
    return this.file.getFile();
  }

  async remove() {
    try { if (this.h) this.h.close(); } catch { /* closed already */ }
    this.h = null;
    try { await this.dir.removeEntry(this.name); } catch { /* never made */ }
  }
}

class HandleSink {
  constructor(handle) {
    this.handle = handle;
    // A stream may hold what it is given past the call: it gets a copy.
    this.keeps = true;
  }

  async open() {
    this.w = await this.handle.createWritable({ keepExistingData: false });
    this.at = 0;
  }

  async write(bytes) {
    await this.w.write(bytes);
    this.at += bytes.length;
  }

  async header(bytes) {
    await this.w.write({ type: 'write', position: 0, data: bytes });
  }

  // A write at a place moves the stream there: it goes back to the end.
  async writeAt(at, bytes) {
    await this.w.write({ type: 'write', position: at, data: bytes.slice() });
    await this.w.seek(this.at);
  }

  async close() {
    await this.w.close();
    this.w = null;
    return null;
  }

  async remove() {
    try { if (this.w) await this.w.abort(); } catch { /* closed already */ }
    this.w = null;
    // The picker made the file, empty, when it was chosen.
    try { if (typeof this.handle.remove === 'function') await this.handle.remove(); } catch { /* not allowed */ }
  }
}

// The app's file, through the page (see the top). Each call waits for the
// app's answer, so what the disk can take is what is made.
const acks = new Map();
let relayed = 0;

class RelaySink {
  open() {}

  write(bytes) {
    return this.relay('write', bytes);
  }

  header(bytes) {
    return this.relay('header', bytes);
  }

  writeAt(at, bytes) {
    return this.relay('header', bytes, at);
  }

  async close() {
    await this.relay('close');
    return null;
  }

  async remove() {
    try { await this.relay('abort'); } catch { /* nothing was open */ }
  }

  relay(op, bytes, at = 0) {
    const id = ++relayed;
    return new Promise((resolve, reject) => {
      acks.set(id, { resolve, reject });
      self.postMessage({ type: 'relay', id, op, data: bytes ? toBase64(bytes) : '', at });
    });
  }
}

class MemorySink {
  constructor(limit, type) {
    this.limit = limit;
    this.type = type;
  }

  open() {
    this.parts = [];
    this.starts = [];
    this.size = 0;
  }

  write(bytes) {
    if (this.size + bytes.length > this.limit) {
      const e = new Error('more than this browser can keep in memory');
      e.name = 'MemoryLimit';
      throw e;
    }
    this.parts.push(bytes.slice());
    this.starts.push(this.size);
    this.size += bytes.length;
  }

  header(bytes) {
    // The file's first part is its header alone (the first write), so the
    // finished one takes its place.
    this.parts[0] = bytes.slice();
  }

  // Bytes written again inside the one part that holds them (the zip's
  // headers: each was written whole, by one write).
  writeAt(at, bytes) {
    let lo = 0;
    let hi = this.starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.starts[mid] <= at) lo = mid;
      else hi = mid - 1;
    }
    const part = this.parts[lo];
    const off = at - this.starts[lo];
    if (!part || off + bytes.length > part.length) throw new Error('a write again across parts');
    part.set(bytes, off);
  }

  close() {
    const blob = new Blob(this.parts, { type: this.type });
    this.parts = null;
    return blob;
  }

  remove() {
    this.parts = null;
  }
}

// The bytes, gathered into one buffer and written a megabyte at a time.
class Gather {
  constructor(sink) {
    this.sink = sink;
    this.buf = new Uint8Array(GATHER);
    this.n = 0;
    this.total = 0;
  }

  async add(bytes) {
    this.total += bytes.length;
    if (this.n + bytes.length > this.buf.length) await this.flush();
    if (bytes.length > this.buf.length) {
      await this.sink.write(bytes.slice());
      return;
    }
    this.buf.set(bytes, this.n);
    this.n += bytes.length;
  }

  async flush() {
    if (!this.n) return;
    // A copy for a stream that may keep it past the call; the private file
    // and memory copy or keep their own.
    await this.sink.write(this.sink.keeps ? this.buf.slice(0, this.n) : this.buf.subarray(0, this.n));
    this.n = 0;
  }
}

// The sink a message names.
function sinkOf(m, type) {
  if (m.sink === 'handle') return new HandleSink(m.handle);
  if (m.sink === 'app') return new RelaySink();
  if (m.sink === 'private') return new PrivateSink(!!m.keep);
  return new MemorySink(m.limit, type);
}

// The album's zip, while one is open: { zip, sink }.
let album = null;

// A track inside the album's zip, as a sink: its entry opened, its bytes
// added, FLAC's finished header written again inside it, and the entry
// listed when it closes (left out if it is removed).
class EntrySink {
  constructor(open, name) {
    this.zip = open.zip;
    this.keeps = open.sink.keeps;
    this.name = name;
    this.first = null;
  }

  async open() {
    await this.zip.begin(this.name);
  }

  async write(bytes) {
    // The first 42 bytes are the core's header, which comes again at the end.
    if (!this.first) this.first = bytes.slice(0, 42);
    await this.zip.add(bytes);
  }

  async header(bytes) {
    await this.zip.patch(0, this.first, bytes);
  }

  async close() {
    await this.zip.end();
    return null;
  }

  remove() {
    this.zip.drop();
  }
}

// A failure, as the page is told it.
function failure(err) {
  if (isSpace(err)) return { type: 'failed', why: 'space', message: String(err.message || err) };
  if (err && err.name === 'MemoryLimit') return { type: 'failed', why: 'memory', message: err.message };
  if (err && err.name === 'ZipLimit') return { type: 'failed', why: 'large', message: err.message };
  return { type: 'failed', why: 'write', message: String((err && err.message) || err) };
}

// The album's zip opened on its sink.
async function openZip(m) {
  const sink = sinkOf(m, 'application/zip');
  try {
    await sink.open(m.name);
    album = { sink, zip: new ZipWriter(sink, { date: m.date ? new Date(m.date) : new Date() }) };
    self.postMessage({ type: 'zip-open' });
  } catch (err) {
    try { await sink.remove(); } catch { /* never made */ }
    album = null;
    self.postMessage(failure(err));
  }
}

// The album's last track is in: its directory, and the file whole.
async function endZip() {
  const a = album;
  album = null;
  if (!a) return;
  try {
    const bytes = await a.zip.finish();
    const file = await a.sink.close();
    self.postMessage({ type: 'zip-done', file, bytes });
  } catch (err) {
    try { await a.sink.remove(); } catch { /* gone */ }
    self.postMessage(failure(err));
  }
}

// Cancel, or a failure the album can't go on from: nothing of it is kept.
async function abortZip() {
  const a = album;
  album = null;
  if (a) {
    try { await a.sink.remove(); } catch { /* gone */ }
  }
  self.postMessage({ type: 'zip-gone' });
}

async function run(m) {
  const started = performance.now();
  const opus = m.job.format === 'opus';
  const sink = m.entry != null && album ? new EntrySink(album, m.entry) : sinkOf(m, opus ? 'audio/ogg' : 'audio/flac');
  const tags = m.tags || [];
  const picture = m.picture || null;
  job = { cancelled: false, pace: m.pace, sink };
  let render;
  let maker = null;
  try {
    const module = await WebAssembly.compile(m.bytes);
    const x = (await WebAssembly.instantiate(module, {})).exports;
    render = new Render(x, m.job);
    if (opus) {
      maker = new OpusMaker(render, { comments: tags.length ? opusComments(tags, picture) : null, title: m.title || '' });
      await maker.open();
    } else if (tags.length) {
      render.tag(flacBlocks(tags, picture));
    }
  } catch (err) {
    if (maker) maker.close();
    self.postMessage({ type: 'failed', why: 'render', message: String((err && err.message) || err) });
    job = null;
    return;
  }
  try {
    await sink.open(m.name);
    const out = new Gather(sink);
    // FLAC: the header first, its own write: the memory sink swaps it at the
    // end. Opus has no header to come back to: the file is written once,
    // front to back.
    if (render.first) {
      if (sink instanceof MemorySink) sink.write(render.first);
      if (!(sink instanceof MemorySink)) await out.add(render.first);
      else out.total = render.first.length;
      // The tags and the cover, after STREAMINFO (item 121).
      if (render.blocks) await out.add(render.blocks);
    }
    let posted = 0;
    let more = true;
    while (more) {
      const t0 = performance.now();
      while (performance.now() - t0 < SLICE) {
        const bytes = maker ? maker.step() : render.step();
        if (!bytes) {
          more = false;
          break;
        }
        if (bytes.length) await out.add(bytes);
      }
      if (job.cancelled) throw new Cancelled();
      const now = performance.now();
      if (now - posted >= PROGRESS_EVERY) {
        posted = now;
        self.postMessage({ type: 'progress', frames: render.frames, expected: render.expectedFrames, bytes: out.total });
      }
      // The encoder's outputs come between slices; it is not let to queue
      // more than a few chunks.
      if (maker) await maker.settle();
      if (more) {
        if (job.pace === 'gentle') await rest(REST * (performance.now() - t0));
        else await yieldNow();
        if (job.cancelled) throw new Cancelled();
      }
    }
    await out.add(maker ? await maker.last() : render.last());
    await out.flush();
    if (!maker) await sink.header(render.header().slice());
    const file = await sink.close();
    self.postMessage({
      type: 'done', file, format: render.format, bytes: out.total, frames: render.frames, seconds: render.frames / render.rate,
      took: (performance.now() - started) / 1000, counts: render.counts(), lateEnd: render.lateEnd,
      // Where the core was told to stop, and where the tail's fade began:
      // what a straight render needs to null the file (tools/export.mjs).
      stop: render.stopFrame == null ? null : { frame: render.stopFrame, time: render.endTime }, fade: render.fadeFrom,
    });
  } catch (err) {
    if (maker) maker.close();
    await sink.remove();
    if (err instanceof Cancelled) self.postMessage({ type: 'cancelled' });
    else self.postMessage(failure(err));
  } finally {
    if (maker) maker.close();
    job = null;
  }
}

class Cancelled extends Error {}

// What is taken in order: one thing at a time, each after the last is done
// (a track starts only once the zip is open, the zip ends after its last).
let queue = Promise.resolve();
const inOrder = (fn) => { queue = queue.then(fn, fn); };

self.onmessage = async (e) => {
  const m = e.data || {};
  if (m.type === 'hello') inOrder(async () => self.postMessage({ type: 'hello', private: await privateWorks(), opus: await opusWorks() }));
  else if (m.type === 'start') inOrder(() => (job ? null : run(m)));
  else if (m.type === 'zip') inOrder(() => openZip(m));
  else if (m.type === 'zip-end') inOrder(() => endZip());
  else if (m.type === 'zip-abort') inOrder(() => abortZip());
  else if (m.type === 'pace' && job) job.pace = m.pace;
  else if (m.type === 'cancel' && job) job.cancelled = true;
  else if (m.type === 'ack') {
    const a = acks.get(m.id);
    acks.delete(m.id);
    if (!a) return;
    if (m.ok) a.resolve();
    else {
      // The disk filling is the one failure the page says in its own words.
      const err = new Error(m.why || 'the app could not write the file');
      if (m.why === 'space') err.name = 'QuotaExceededError';
      a.reject(err);
    }
  }
};
