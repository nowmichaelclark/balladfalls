// The Android app's transport to the native core.
//
// In a browser, the core's player runs in an AudioWorklet (js/worklet.js),
// and CoreHost in js/core.js talks to it over the node's message port. In
// the Android app, the same player runs natively, on Android's own audio,
// on the path that a music player takes (android/native).
// - The app puts an object in the page, `DriftloomNative`. CoreHost posts
//   the same messages to it, and gets the same messages back: events with
//   their grids, the counts, the cost and busy reports, the probes and the
//   picks' answers. They come in batches a few times a second, as the
//   worklet's do.
// - So there is one path, with two transports. The page's player, its
//   screens and its checks don't know which one carries them. The WebView
//   plays no audio of its own.
//
// The app has no AudioContext, so NativeContext stands in for what a
// context gives the page: the clock (`currentTime`, the core's own clock),
// the sample rate, the latency to the speaker, the state, and an alarm on
// that clock (js/quality.js). The native side sends a `native` message with
// each batch: the clock, and the stream's figures for Diagnostics (its
// underruns, its burst, the thread's priority).

// The app's bridge, or null in a browser. It is also null in an app whose
// WebView is too old to carry it; that app plays the page as a browser does.
export function nativeBridge() {
  const b = globalThis.DriftloomNative;
  return b && typeof b.postMessage === 'function' ? b : null;
}

// A stand-in for the AudioContext, on the native core's clock.
export class NativeContext extends EventTarget {
  constructor(bridge) {
    super();
    this.native = true;
    this.bridge = bridge;
    // The stream's rate, once the core says it. Until then, 48 kHz, which
    // nearly every phone runs at.
    this.sampleRate = 48000;
    this.baseLatency = 0;
    this.outputLatency = 0;
    this.state = 'suspended';
    this.destination = null;
    // The stream's figures as last said (`native`), and when.
    this.stream = null;
    this._clock = { time: 0, at: 0, running: false };
    this._last = 0;
    // The core's clock as it said it (what is rendered, never carried on),
    // and the latencies of the last two seconds (`_native`).
    this._served = 0;
    this._latencies = [];
    this._alarms = [];
    // The port CoreHost posts to and hears from: the worklet's port's shape.
    this.port = {
      onmessage: null,
      postMessage: (m) => bridge.postMessage(JSON.stringify(m)),
    };
    const hear = (e) => this._hear(e && e.data !== undefined ? e.data : e);
    if (typeof bridge.addEventListener === 'function') bridge.addEventListener('message', hear);
    else bridge.onmessage = hear;
  }

  // The core's clock in seconds, as a context's `currentTime` is: where the
  // core last said it was, carried on by the page's own clock while the
  // stream runs. It never goes backward.
  get currentTime() {
    const c = this._clock;
    let t = c.time;
    if (c.running) t += Math.max(0, Math.min(0.5, (performance.now() - c.at) / 1000));
    if (t < this._last) t = this._last;
    this._last = t;
    return t;
  }

  // The stream starts with the first player (`init`), so there is nothing to
  // resume.
  resume() { return Promise.resolve(); }
  suspend() { return Promise.resolve(); }
  close() { return Promise.resolve(); }

  // Call `fn` once the core's clock reaches `at` (js/quality.js's alarm).
  alarm(at, fn) {
    const a = { at, fn };
    this._alarms.push(a);
    this._ring();
    return { stop: () => { this._alarms = this._alarms.filter((x) => x !== a); } };
  }

  _ring() {
    clearTimeout(this._timer);
    if (!this._alarms.length) return;
    // While the stream runs, an alarm waits until the core itself has
    // rendered to it. The clock reads up to a run of callbacks ahead of
    // that, and a quality switch's fade must end before its core is let go.
    const now = this._clock.running ? this._served : this.currentTime;
    const due = this._alarms.filter((a) => a.at <= now);
    this._alarms = this._alarms.filter((a) => a.at > now);
    for (const a of due) a.fn();
    if (this._alarms.length) {
      const next = Math.min(...this._alarms.map((a) => a.at));
      this._timer = setTimeout(() => this._ring(), Math.max(5, Math.min(250, (next - now) * 1000)));
    }
  }

  // A batch from the core. Keep the clock and the stream's figures here, and
  // give every message to CoreHost as its port would.
  _hear(text) {
    let batch;
    try {
      batch = typeof text === 'string' ? JSON.parse(text) : text;
    } catch {
      return;
    }
    if (!Array.isArray(batch)) batch = [batch];
    for (const m of batch) {
      if (m && m.type === 'native') this._native(m);
      else if (m && this.port.onmessage) this.port.onmessage({ data: m });
    }
  }

  _native(m) {
    this.stream = m;
    if (m.rate > 0) this.sampleRate = m.rate;
    const at = performance.now();
    let time = m.time;
    let latency = m.latency || 0;
    // On the music path the core renders in runs of callbacks. So its clock
    // moves in steps, and the measured latency rises and falls with them.
    // Their difference, what the speaker plays, moves evenly. So the clock is
    // that, plus the most latency of the last two seconds (at most a buffer
    // ahead of the core), and the latency is that most. Then the clock is
    // even, and the layers stay with what is heard.
    if (m.running && m.measured) {
      this._latencies = this._latencies.filter((x) => at - x.at < 2000);
      this._latencies.push({ at, latency });
      const buffer = m.rate > 0 ? (m.buffer || 0) / m.rate : 0;
      const ahead = Math.min(buffer, Math.max(...this._latencies.map((x) => x.latency)) - latency);
      time += ahead;
      latency += ahead;
    } else {
      this._latencies = [];
    }
    this.outputLatency = latency;
    this._served = m.time;
    this._clock = { time, at, running: !!m.running };
    const state = m.running ? 'running' : 'suspended';
    if (state !== this.state) {
      this.state = state;
      this.dispatchEvent(new Event('statechange'));
    }
    if (this._alarms.length) this._ring();
  }

  // Diagnostics' "reset counters": the stream's underruns, the watch's
  // figures, the busiest callback and the time played with the screen off
  // start again from nothing.
  resetCounts() {
    this.bridge.postMessage(JSON.stringify({ type: 'resetCounts' }));
  }

  // For Diagnostics: the stream, as the core's side says it.
  streamReport() {
    const s = this.stream;
    if (!s) return 'not started';
    // Without reset-on-fork's bit, which Android sets on its audio threads.
    const thread = s.policy < 0 ? 'not yet' : { 0: 'normal', 1: 'SCHED_FIFO', 2: 'SCHED_RR' }[s.policy & ~0x40000000] || `policy ${s.policy}`;
    const perf = { 10: 'none', 11: 'power saving', 12: 'low latency' }[s.performance] || s.performance;
    return `${s.running ? 'running' : 'stopped'}, ${s.rate} Hz, ${s.channels} channels, burst ${s.burst}, callbacks of ${s.callback || 'any'}, buffer ${s.buffer} of ${s.capacity}, ${perf}, ${s.sharing === 0 ? 'exclusive' : 'shared'}, thread ${thread}/${s.priority}, reopens ${s.reopens}, latency ${Math.round((s.latency || 0) * 1000)} ms (${s.measured ? 'measured' : 'from the buffer'}), busiest callback ${(s.busiest * 100).toFixed(1)}% of its deadline, mean ${(s.mean * 100).toFixed(2)}%, sound ${(s.sounding || 0).toFixed(1)} s${this._watchReport()}`;
  }

  // What a crackle leaves (android/native/src/watch.rs), since the app
  // started or since "reset counters": lines of their own, under the
  // stream's.
  _watchReport() {
    const s = this.stream;
    const w = s.watch;
    if (!w) return '';
    const ago = (x) => `${Math.round(x)} s ago`;
    const behind = w.behind ? ` (${w.behindMs.toFixed(0)} ms in all, the last ${ago(w.behindAgo)})` : '';
    const gap = w.gapMs ? `${w.gapMs.toFixed(0)} ms, ${ago(w.gapAgo)}` : 'not yet';
    const lines = [
      `glitches: ${s.underruns} underruns, ${w.behind} times playback fell behind${behind}`,
      `callbacks: ${w.over} over their deadline, longest gap ${gap}`,
      `screen off: ${Math.round(w.offSeconds || 0)} s played with the screen off`,
      ...(w.worst || []).map((c, i) => `callback, worst ${i + 1}: ${(c.share * 100).toFixed(0)}% (${c.ms.toFixed(1)} ms, ${c.frames} frames, ${c.did}), ${ago(c.ago)}`),
    ];
    return `\n${lines.join('\n')}`;
  }
}
