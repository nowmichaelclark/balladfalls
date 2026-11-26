// The Rust core, on the main thread.
//
// The core is the Ballad Falls engine. Its player decides every note on the
// audio thread (core/src/player/, through js/dlplayer.wasm in
// js/worklet.js). It also plays, mixes and finishes the notes, so its node
// goes straight to the speakers. The page sends it commands and draws what
// it reports (js/player.js). There is no other engine. If a browser has no
// AudioWorklet or WebAssembly, or the core fails to load or traps while it
// plays, the page says so in one plain line. Diagnostics says which reason,
// as `none (...)`.
//
// In the Android app, the same player runs natively, on Android's own
// audio. CoreHost posts the same messages to it over the app's bridge in
// place of a worklet's port, and gets the same messages back
// (js/native.js). So there is one path, with two transports.

import { nativeBridge } from './native.js';

// Why this browser cannot run the core, or null. The core needs
// WebAssembly and an AudioWorklet (loadCore() checks the context's own).
export function coreUnsupported() {
  // The app plays the core natively, so it needs no worklet. The page's
  // record of a loop still needs WebAssembly (js/gen.js).
  if (nativeBridge() && typeof WebAssembly === 'object') return null;
  if (typeof WebAssembly !== 'object' || typeof WebAssembly.Module !== 'function') return 'no WebAssembly in this browser';
  if (typeof globalThis.AudioWorkletNode !== 'function') return 'no AudioWorklet in this browser';
  return null;
}

// The highest sample rate that the web core holds its delay lines and noise
// for (core/src/lib.rs, MAX_RATE without the `wide` feature). If a context
// comes up faster, the page asks for 48 kHz in its place, and the browser
// resamples to the device. Without this, a device whose default is 192 kHz
// plays nothing.
export const CORE_MAX_RATE = 96000;
export const CORE_FALLBACK_RATE = 48000;

// A new audio context from `Ctx` with `options`, at a rate the core can run
// at. If the browser's default is above CORE_MAX_RATE, the context is made
// again at CORE_FALLBACK_RATE, and the fast one closes. If the browser will
// not make the slower one, the first one stays. Then the core says that it
// cannot mix at that rate, and the page says that it cannot play.
export function newContext(Ctx, options = {}) {
  const ctx = new Ctx(options);
  if (!(ctx.sampleRate > CORE_MAX_RATE)) return ctx;
  try {
    const slower = new Ctx({ ...options, sampleRate: CORE_FALLBACK_RATE });
    try { ctx.close(); } catch { /* already gone */ }
    return slower;
  } catch {
    return ctx;
  }
}

// The mix parameters that the page still sets, by the numbers that the
// core uses for them (core/src/mix.rs, core/src/lib.rs):
// - `kill`: the kill gain, the transport's silence (js/output.js);
// - `pump` and `tails`: the kicks' duck and the tails' fades, whose events
//   a quality switch cancels.
// The player sets every other parameter itself.
export const MIX = { pump: 5, tails: 6, kill: 18 };
// The AudioParam calls that a parameter takes. HOLD is two calls:
// cancelScheduledValues at the time, then setValueAtTime there with the
// parameter's `value` attribute. So the parameter holds where it is.
export const SET = 0;
export const LINEAR = 1;
export const CANCEL = 3;
export const HOLD = 4;

// Why the core dropped a note, in Core::dropped_by's order.
export const DROP_CAUSES = ['queue full', 'voices busy', 'sung voices busy'];

// The core's module (js/dlplayer.wasm: the core with its generator and its
// player). The page fetches it once, and every context shares it.
const WASM_URL = new URL('./dlplayer.wasm', import.meta.url);
const WORKLET_URL = new URL('./worklet.js', import.meta.url);

let fetched = null;
export function fetchCore() {
  if (!fetched) {
    fetched = fetch(WASM_URL).then((res) => {
      if (!res.ok) throw new Error(`${WASM_URL.pathname.split('/').pop()}: HTTP ${res.status}`);
      return res.arrayBuffer();
    });
    // If the fetch fails, the next context tries again.
    fetched.catch(() => { fetched = null; });
  }
  return fetched;
}

// The contexts the worklet's module has been added to.
const modules = new WeakMap();

// What a context needs to build cores: the worklet's module added to it,
// and the core's bytes. Resolves with `{ bytes }` for CoreHost. Rejects
// with the reason that the core cannot run here.
export async function loadCore(ctx) {
  // The app's native core (js/native.js): its port, and no module to fetch.
  if (ctx.native) return { port: ctx.port };
  if (typeof WebAssembly !== 'object') throw new Error('no WebAssembly in this browser');
  if (!ctx.audioWorklet) throw new Error('no AudioWorklet in this browser');
  let added = modules.get(ctx);
  if (!added) {
    added = ctx.audioWorklet.addModule(WORKLET_URL);
    modules.set(ctx, added);
  }
  const [wasm] = await Promise.all([fetchCore(), added]);
  return { bytes: wasm };
}

// One core and its player in one AudioWorkletNode.
// - `layout` is 1 for the mono render or 2 for the stereo one. `setLayout`
//   switches it while it plays (the Mono switch). The node's output has two
//   channels either way, with the mono render in both, so the switch never
//   rebuilds the node.
// - The node takes the player's commands (`playLoad` and the rest) and
//   reports what the player decides as events (`onevents`).
// - In the app (`core.port`, js/native.js) there is no node. The same
//   messages go to the native player, starting with `init` (the worklet's
//   processorOptions), and the same messages come back.
export class CoreHost {
  constructor(ctx, core, { quality = 'full', layout = 1, burn = 0 } = {}) {
    this.ctx = ctx;
    this.layout = layout === 2 ? 2 : 1;
    // Called once if the core does not run (for example, too old a browser).
    this.onfail = null;
    // What the core reports about its own notes: the notes it took late,
    // the notes it left out for being too late, and the notes it dropped,
    // by cause.
    this.late = 0;
    this.missed = 0;
    this.dropped = 0;
    this.droppedBy = DROP_CAUSES.map(() => 0);
    // What the core last said, and what Diagnostics' "reset counters" took
    // away from it. The core's counts run on from load; the page's counts
    // start again.
    this._said = { late: 0, missed: 0, dropped: 0, droppedBy: DROP_CAUSES.map(() => 0) };
    this._base = { late: 0, missed: 0, dropped: 0, droppedBy: DROP_CAUSES.map(() => 0) };
    this.failed = null;
    // What the core's render costs, for each layout: the milliseconds its
    // blocks took, and the seconds of sound they made.
    this.cost = { ms: [0, 0], seconds: [0, 0] };
    // How busy the audio thread is. Called with each of the worklet's
    // reports.
    this.onbusy = null;
    this._pings = new Map();
    this._ping = 0;
    // Where the player is, as last reported ({ state, step, time }). Then
    // its events (`onevents`), its answer to the picks (`onpicks`), the
    // events it had no room for, and the parts of a request it refused.
    this.playerAt = null;
    this.onevents = null;
    this.onpicks = null;
    this.eventsLost = 0;
    this.refused = 0;
    this._probes = new Map();
    // Where the player is: a worklet's node in a browser, or the native
    // player behind its port in the app.
    this.native = !!core.port;
    if (this.native) {
      this.node = null;
      this.port = core.port;
      this.port.onmessage = (e) => this._receive(e.data);
      this.port.postMessage({ type: 'init', quality, layout: this.layout, burn });
      return;
    }
    this.node = new AudioWorkletNode(ctx, 'driftloom-core', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: { bytes: core.bytes, quality, layout: this.layout, burn },
    });
    this.port = this.node.port;
    this.port.onmessage = (e) => this._receive(e.data);
    // A throw inside the worklet: the module did not compile, or a trap.
    this.node.onprocessorerror = (e) => this._fail((e && e.message) || 'processor error');
  }

  // The render from now: mono (1) or stereo (2), faded by the core.
  setLayout(layout) {
    this.layout = layout === 2 ? 2 : 1;
    this.port.postMessage({ type: 'layout', channels: this.layout });
  }

  // For Diagnostics: what the render costs this device, for each layout.
  costReport() {
    const { ms, seconds } = this.cost;
    const time = (x) => (x < 10 ? x.toFixed(1) : Math.round(x));
    const one = (i) => (seconds[i] > 0 ? `${((ms[i] / 1000 / seconds[i]) * 100).toFixed(1)}% of real time over ${time(seconds[i])} s` : 'not played');
    return `mono ${one(0)}, stereo ${one(1)}`;
  }

  // One of the mix's parameters (`MIX`), by one of the AudioParam calls
  // (`SET` and the rest), at `time` on the context's clock.
  param(id, op, value, time, tau = 0) {
    this.port.postMessage({ type: 'param', id, op, value, time, tau });
  }

  // The core's player. `ask` is a loop's request and a code's edits, as
  // `askOf` in js/player.js builds them. `seed` is its seed.
  // - `playLoad` starts the loop afresh, its first step at `at` on the
  //   context's clock (0: as soon as it is made). `resumed` marks a loop
  //   that was playing on another core (the quality switch), so its
  //   lateFloor does not wait again.
  // - `playChange` changes to the loop at a moment (`MOMENT` in
  //   js/player.js). The old loop falls to nothing over `fade` seconds.
  // - `playRevise` makes the loop that plays again, in its place (a
  //   re-roll).
  playLoad(seed, ask, at = 0, resumed = false) {
    this.port.postMessage({ type: 'playLoad', seed, ask, at, resumed });
  }

  playChange(seed, ask, moment, fade) {
    this.port.postMessage({ type: 'playChange', seed, ask, moment, fade });
  }

  playRevise(seed, ask) {
    this.port.postMessage({ type: 'playRevise', seed, ask });
  }

  // How long the track plays, counted from what is heard now: `kind` 0 on
  // and on, 1 `count` passes, 2 `count` bars. `arm` ({ seed, ask, fade }) is
  // the loop that follows when it ends. It goes in the same message, so
  // that no block falls between the two.
  playTrack(kind, count, arm = null) {
    this.port.postMessage({ type: 'playTrack', kind, count, arm });
  }

  // The loop that follows when the track ends (`MOMENT.end`), alone.
  // `arm.track` ([kind, count]) is the track it plays. Null drops the loop
  // that waits, so the core's own loop follows.
  playArm(arm) {
    this.port.postMessage({ type: 'playArm', arm });
  }

  // The picks: the Vibe panel's request (`picksAsk` in js/player.js),
  // numbered `tag`. The core holds it for every loop it makes itself, and
  // answers (`onpicks`) if it can meet the picks.
  playPicks(ask, tag) {
    this.port.postMessage({ type: 'playPicks', ask, tag });
  }

  // The seed that the core draws its own loops' seeds from (0: none).
  playDraws(seed) {
    this.port.postMessage({ type: 'playDraws', seed });
  }

  // A new loop of the core's own at `moment`. The old one falls over `fade`.
  playNext(moment, fade) {
    this.port.postMessage({ type: 'playNext', moment, fade });
  }

  // Go on from another place in the loop that plays. `kind` is 0 for a
  // section, 1 for a bar, 2 for a time in seconds (`JUMP` in js/player.js).
  // `at` counts from the piece's start. The jump lands on the phrase line
  // at or before it, a few blocks later, and a `jump` event says where.
  playJump(kind, at) {
    this.port.postMessage({ type: 'playJump', kind, at });
  }

  // The Sound panel's tone, gliding there from now.
  playTone(tone) {
    this.port.postMessage({ type: 'playTone', warmth: tone.warmth, space: tone.space, wobble: tone.wobble });
  }

  playStop() {
    this.port.postMessage({ type: 'playStop' });
  }

  playResume(at) {
    this.port.postMessage({ type: 'playResume', at });
  }

  // `salt`: the salt for the wander's random stream (0: none).
  playWander(amount, salt = 0) {
    this.port.postMessage({ type: 'playWander', amount, salt });
  }

  playMute(layer, muted) {
    this.port.postMessage({ type: 'playMute', layer, muted });
  }

  playTempo(bpm) {
    this.port.postMessage({ type: 'playTempo', bpm });
  }

  playVolume(volume) {
    this.port.postMessage({ type: 'playVolume', volume });
  }

  // Resolves with what the player says about the loop now: its state, step,
  // track's end, events lost, lanes and description (`describe`'s lines as
  // an object). The checks use it; tools/rows.mjs reads the same from
  // outside.
  probe() {
    const id = ++this._ping;
    return new Promise((resolve) => {
      this._probes.set(id, resolve);
      this.port.postMessage({ type: 'probe', id });
    });
  }

  // Drop every note that was handed over and has not started yet. The notes
  // that sound carry on. With `from`, drop only the notes asked for at that
  // time or later.
  cancel(from = null) {
    this.port.postMessage(from == null ? { type: 'cancel' } : { type: 'cancel', from });
  }

  // Resolves once the worklet has taken every message sent before it.
  flush() {
    const id = ++this._ping;
    return new Promise((resolve) => {
      this._pings.set(id, resolve);
      this.port.postMessage({ type: 'ping', id });
    });
  }

  // Ignore everything that the node says after this. An error queued just
  // before a rebuild must not reach an output that is gone.
  dispose() {
    this.onfail = null;
    this.onevents = null;
    this.port.postMessage({ type: 'dispose' });
    if (this.node) {
      this.node.onprocessorerror = null;
      try { this.node.disconnect(); } catch { /* already detached */ }
    }
    // The app's port is the next player's too, so only this listener goes.
    if (this.port.onmessage && !this.native) this.port.onmessage = null;
  }

  // The counts as the page shows them: the core's, less what a reset took.
  _counts() {
    const said = this._said;
    const base = this._base;
    this.late = Math.max(0, said.late - base.late);
    this.missed = Math.max(0, said.missed - base.missed);
    this.dropped = Math.max(0, said.dropped - base.dropped);
    this.droppedBy = said.droppedBy.map((n, i) => Math.max(0, n - (base.droppedBy[i] || 0)));
  }

  // Diagnostics' "reset counters": the late, missed and dropped notes count
  // from here. The core keeps counting; the page keeps its own start.
  resetCounts() {
    const said = this._said;
    this._base = { late: said.late, missed: said.missed, dropped: said.dropped, droppedBy: said.droppedBy.slice() };
    this._counts();
  }

  _receive(m) {
    if (m.type === 'counts' || m.type === 'pong' || m.type === 'cost' || m.type === 'probe') {
      if (m.late != null) this._said.late = m.late;
      if (m.dropped != null) this._said.dropped = m.dropped;
      if (m.missed != null) this._said.missed = m.missed;
      if (m.droppedBy) this._said.droppedBy = m.droppedBy;
      this._counts();
      if (m.player) this.playerAt = m.player;
    }
    if (m.type === 'cost') {
      this.cost = { ms: m.ms, seconds: m.seconds };
      if (m.busy && this.onbusy) this.onbusy(m.busy);
    }
    if (m.type === 'pong') {
      const resolve = this._pings.get(m.id);
      this._pings.delete(m.id);
      if (resolve) resolve(m);
    }
    if (m.type === 'events') {
      if (m.lost != null) this.eventsLost = m.lost;
      if (m.refused != null) this.refused = m.refused;
      if (this.onevents) this.onevents(m);
    }
    if (m.type === 'picks' && this.onpicks) this.onpicks(m);
    if (m.type === 'probe') {
      const resolve = this._probes.get(m.id);
      this._probes.delete(m.id);
      if (resolve) resolve(m);
    }
    if (m.type === 'failed') this._fail(m.message);
  }

  // The core does not run, at load or while it plays. This runs once: the
  // output hears it, and the page says that it cannot play.
  _fail(message) {
    if (this.failed) return;
    this.failed = message;
    if (this.onfail) this.onfail();
  }
}
