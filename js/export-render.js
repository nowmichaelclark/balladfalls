// The audio export's render (queue item 104b): a loop or a piece made into
// a FLAC file by its own instance of the core, a chunk at a time.
//
// Shared by the export's Worker (js/export-worker.js), which writes each
// chunk's bytes straight to the file, and by tools/export.mjs, which checks
// in Node that the file is the core's render (it decodes and nulls against
// a straight render of the same loop) and that memory stays flat. It touches
// nothing but the instance it is given: no DOM, no file, no timer.
//
// What is exported is what plays: the record's seed, request and edits as
// the page asks the core that plays them (`askOf`, the same calls in the
// same order as js/worklet.js's `ask`), its mutes, the wander and the play's
// salt, and the length slider's track (or, for Endless and a loop that plays
// on and on, the bars the sheet asked for, ended on a phrase line). The track
// is played to its end as the app plays it, then the core stops deciding and
// what it has started rings out (the tail) before the file ends.
//
// Always at full quality (the six-comb mix), whatever "lighter on processor"
// says: the export is not in real time, so it can afford the better mix (for
// Mikey's ears). Stereo unless the Mono switch is on; 44.1 kHz, 16-bit.

// The file's format: CD's rate and depth, which every player reads.
export const RATE = 44100;
export const BITS = 16;
// Frames a chunk: the most `dl_play_render` makes in stereo in one call.
// Well under the player's lookahead (a quarter of a second), so the track's
// end is always heard of before a chunk renders past it.
export const CHUNK = 2048;
// The tail: what was started rings out until it has been quiet (under QUIET,
// about -72 dBFS) for QUIET_FOR seconds, and for at least TAIL_MIN; a tail
// still sounding at TAIL_MAX - FADE fades to nothing over FADE (a drone held
// past the end). For Mikey's ears.
export const TAIL_MIN = 1;
export const TAIL_MAX = 12;
export const FADE = 2;
export const QUIET = 10 ** (-72 / 20);
export const QUIET_FOR = 0.5;
// A track that somehow never ends is ended anyway this far past what was
// expected (with the tail's fade): a file never grows without bound.
const OVERRUN = 1.25;
const OVERRUN_MIN = 60;

// The player's event kinds (`Kind::ALL`): the track's end is 6.
const END = 6;
const EVENTS_MAX = 256;

const text = (x, at, length) => String.fromCharCode(...new Uint8Array(x.memory.buffer, at, length));

// Hand the core what a loop asks for (js/worklet.js's `ask`, call for call).
// Returns how many parts it refused.
export function ask(x, a) {
  let refused = 0;
  const take = (ok) => { if (!ok) refused++; };
  if (!a) return 0;
  for (const [i, w] of a.vibes || []) take(w == null ? x.dl_play_vibe(i) : x.dl_play_weight(i, w));
  if (a.tempo) take(x.dl_play_ask_tempo(a.tempo[0], a.tempo[1]));
  for (const [i, v] of a.pins || []) take(x.dl_play_pin(i, v));
  if (a.theme != null) x.dl_play_theme(a.theme >>> 0);
  if (a.length != null) take(x.dl_play_length(a.length === 'endless' ? Infinity : a.length));
  if (a.keys) take(x.dl_play_keys(a.keys));
  if (a.scales) take(x.dl_play_scales(a.scales));
  if (a.styles) take(x.dl_play_styles(a.styles));
  (a.voices || []).forEach((mask, layer) => { if (mask) take(x.dl_play_voices(layer, mask)); });
  (a.layers || []).forEach((state, layer) => { if (state) take(x.dl_play_layer(layer, state)); });
  for (const [layer, seed, rolled] of a.seeds || []) take(x.dl_play_seed(layer, seed >>> 0, rolled ? 1 : 0));
  (a.tone || []).forEach((v, which) => take(x.dl_play_edit_tone(which, v)));
  if (a.bpm != null) take(x.dl_play_edit_bpm(a.bpm));
  return refused;
}

// Start an instance as the export plays: `job` is
//   { seed, ask, mutes: [5 booleans], wander, salt, layout: 1 | 2,
//     track: [kind, count] }   (kind 1 whole passes, 2 bars; never 0)
// in the order the page starts the core that plays (js/player.js's
// `_begin`: the wander and its salt, the loop, then the mutes and the
// track), and the loop made at once (`dl_play_ready`: an export has no
// deadline). Returns { refused, seconds }: the parts of the request the core
// refused, and how long the track plays, as the core counts it.
export function begin(x, job) {
  x.dl_init(RATE);
  if (!x.dl_quality(1)) throw new Error(`no mix at ${RATE} Hz`);
  if (job.layout === 2 && !x.dl_layout(2)) throw new Error('no stereo render');
  x.dl_play_attach(1);
  x.dl_play_wander(job.wander || 0);
  x.dl_play_wander_salt((job.salt || 0) >>> 0);
  const refused = ask(x, job.ask);
  x.dl_play_load(job.seed >>> 0, 0);
  (job.mutes || []).forEach((m, i) => x.dl_play_mute(i, m ? 1 : 0));
  const [kind, count] = job.track;
  if (!(kind === 1 || kind === 2) || !x.dl_play_track(kind, count >>> 0)) throw new Error(`no such track: ${job.track}`);
  x.dl_play_ready();
  const end = x.dl_play_track_end();
  const about = text(x, x.dl_play_about_at(), x.dl_play_describe());
  const bpm = Number((/^bpm=(.*)$/m.exec(about) || [])[1]);
  const seconds = end >= 0 && bpm > 0 ? end * (60 / bpm / 4) : null;
  return { refused, seconds };
}

// The export's render, a chunk at a time, into the core's FLAC encoder: the
// bytes each step gives are the file's next bytes, written by the caller
// before the next step (they sit in the instance's memory). Memory is the
// instance's own and a few views: the same for a minute or three hours.
export class Render {
  constructor(x, job) {
    this.x = x;
    const { refused, seconds } = begin(x, job);
    this.refused = refused;
    // How long the track plays, as the core counts it; the file is that and
    // its tail.
    this.seconds = seconds;
    this.lanes = x.dl_outputs();
    const head = x.dl_flac_start(RATE, this.lanes, BITS);
    if (head < 0) throw new Error('the FLAC writer refused the format');
    this.first = this.bytes(head);
    this.frames = 0;
    // The frame the track ends at (from its End event), when the core
    // stopped deciding, and how long the output has been quiet since.
    this.endFrame = null;
    this.endTime = null;
    this.stopFrame = null;
    this.quietFrames = 0;
    this.fadeFrom = null;
    this.finished = false;
    this.lateEnd = 0;
    const most = Math.max(this.seconds == null ? 0 : this.seconds * OVERRUN, (this.seconds || 0) + OVERRUN_MIN);
    this.limit = Math.ceil(most * RATE);
    this.views = null;
  }

  // The bytes the encoder's last call gave, as a view (valid until the next
  // call).
  bytes(n) {
    if (n < 0) throw new Error('the FLAC writer refused a chunk');
    return new Uint8Array(this.x.memory.buffer, this.x.dl_flac_out(), n);
  }

  // The frames the file will hold, as far as is known: the track and the
  // longest tail. For progress.
  get expectedFrames() {
    if (this.endFrame != null) return this.endFrame + TAIL_MAX * RATE;
    return this.seconds == null ? null : Math.ceil((this.seconds + TAIL_MAX) * RATE);
  }

  // The track's end, heard as the core decides it (an End event, up to the
  // player's lookahead before it sounds): notes from there on are dropped,
  // the core stops deciding, and what was started rings out.
  watch() {
    const x = this.x;
    const n = x.dl_play_events();
    if (!n || this.endFrame != null) return;
    const f = new Float64Array(x.memory.buffer, x.dl_play_event_at(), 4 * Math.min(n, EVENTS_MAX));
    for (let i = 0; i < Math.min(n, EVENTS_MAX); i++) {
      if (f[4 * i + 1] !== END) continue;
      this.stopAt(f[4 * i]);
      return;
    }
  }

  stopAt(time) {
    const x = this.x;
    x.dl_cancel_from(time);
    x.dl_play_stop();
    // The time as the core gave it (a straight render stops the same way),
    // and the frame it falls on.
    this.endTime = time;
    this.endFrame = Math.round(time * RATE);
    // The frames rendered when it stopped (before the next chunk).
    this.stopFrame = this.frames;
    // Should never be: the end heard after it was rendered.
    if (this.endFrame < this.frames) this.lateEnd++;
  }

  // Render the next chunk and encode it. Returns the bytes to append (a view,
  // possibly empty), or null once the file is finished (then `last` holds
  // the final bytes and `header()` the finished header).
  step() {
    if (this.finished) return null;
    const x = this.x;
    // Past the limit with no end heard: end it here, with the tail's fade.
    if (this.endFrame == null && this.frames >= this.limit) this.stopAt(this.frames / RATE);
    const at = x.dl_play_render(CHUNK);
    if (!at) throw new Error('the core would not render');
    const lanes = this.lanes;
    // Views made once: nothing allocates after the core starts, so its
    // memory never grows and the buffers never move.
    if (!this.views || this.views.at !== at) {
      const buffer = x.memory.buffer;
      const input = x.dl_flac_input();
      this.views = {
        at,
        input: [0, 1].map((c) => new Float32Array(buffer, input + c * 4096 * 4, 4096)),
        runs: [0, 1].map((c) => new Float32Array(buffer, at + c * CHUNK * 4, CHUNK)),
      };
    }
    const input = this.views.input;
    let peak = 0;
    for (let c = 0; c < lanes; c++) {
      const run = this.views.runs[c];
      const to = input[c];
      for (let i = 0; i < CHUNK; i++) {
        const v = run[i];
        to[i] = v;
        const a = v < 0 ? -v : v;
        if (a > peak) peak = a;
      }
    }
    let frames = CHUNK;
    // The tail.
    if (this.endFrame != null) {
      const from = this.frames;
      const since = from - this.endFrame;
      if (since >= 0) this.quietFrames = peak < QUIET ? this.quietFrames + CHUNK : 0;
      if (this.fadeFrom == null && since >= (TAIL_MAX - FADE) * RATE) this.fadeFrom = from;
      const span = FADE * RATE;
      if (this.fadeFrom != null) {
        for (let i = 0; i < CHUNK; i++) {
          const g = Math.max(0, 1 - (from + i - this.fadeFrom) / span);
          for (let c = 0; c < lanes; c++) input[c][i] *= g;
        }
        frames = Math.min(CHUNK, Math.max(0, this.fadeFrom + span - from));
      }
      const quietLongEnough = since + CHUNK >= TAIL_MIN * RATE && this.quietFrames >= QUIET_FOR * RATE;
      if (quietLongEnough || (this.fadeFrom != null && from + CHUNK >= this.fadeFrom + span)) this.finished = true;
    }
    const out = this.bytes(x.dl_flac_write(frames));
    this.frames += frames;
    // After the bytes are taken: the events a chunk made say where the
    // track ends before the next chunk is rendered.
    if (!this.finished) this.watch();
    return out;
  }

  // The last frame's bytes, once `step` has returned its last.
  last() {
    return this.bytes(this.x.dl_flac_finish());
  }

  // The finished header (42 bytes: the length and the MD5), to write over
  // the file's first bytes.
  header() {
    return new Uint8Array(this.x.memory.buffer, this.x.dl_flac_header(), 42);
  }

  // The late, missed and dropped notes the core counted while rendering.
  counts() {
    const x = this.x;
    return { late: x.dl_late(), missed: x.dl_missed(), dropped: x.dl_dropped() };
  }
}
