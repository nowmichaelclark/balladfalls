// The Android app's transport to the native core (session 27, queue item
// 107c).
//
// In a browser the core's player runs in an AudioWorklet (js/worklet.js) and
// js/core.js's CoreHost talks to it over the node's message port. In the
// Android app the same player runs natively, on Android's own audio, at high
// priority (android/native): the app puts an object in the page,
// `DriftloomNative`, and CoreHost posts the very same messages to it and
// hears the very same messages back (events with their grids, the counts,
// the cost and busy reports, the probes, the picks' answers), batched a few
// times a second as the worklet batches them. One path, two transports: the
// page's player, its screens and its checks don't know which carries them.
// The WebView plays no audio of its own.
//
// What a browser's AudioContext gives the page and the app's has no context
// to give, NativeContext stands in for: the clock (`currentTime`, the core's
// own clock, as a context's is its worklet's), the sample rate, the latency
// to the speaker, the state, and an alarm on that clock (js/quality.js). The
// native side sends it a `native` message with each batch: the clock, and
// the stream's figures (its underruns, its burst, the thread's priority) for
// Diagnostics.

// The app's bridge, or null in a browser (and in an app whose WebView is too
// old to carry it, which plays the page as a browser does).
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
    // The stream's rate once the core says (48 kHz until then: what
    // nearly every phone runs at).
    this.sampleRate = 48000;
    this.baseLatency = 0;
    this.outputLatency = 0;
    this.state = 'suspended';
    this.destination = null;
    // The stream's figures as last said (`native`), and when.
    this.stream = null;
    this._clock = { time: 0, at: 0, running: false };
    this._last = 0;
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

  // The core's clock, in seconds, as a context's `currentTime` is: where it
  // last said it was, carried on by the page's own clock since, while the
  // stream runs; never backward.
  get currentTime() {
    const c = this._clock;
    let t = c.time;
    if (c.running) t += Math.max(0, Math.min(0.5, (performance.now() - c.at) / 1000));
    if (t < this._last) t = this._last;
    this._last = t;
    return t;
  }

  // The stream starts with the first player (`init`); nothing to resume.
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
    const now = this.currentTime;
    const due = this._alarms.filter((a) => a.at <= now);
    this._alarms = this._alarms.filter((a) => a.at > now);
    for (const a of due) a.fn();
    if (this._alarms.length) {
      const next = Math.min(...this._alarms.map((a) => a.at));
      this._timer = setTimeout(() => this._ring(), Math.max(5, Math.min(250, (next - now) * 1000)));
    }
  }

  // A batch from the core: the clock and the stream's figures kept here,
  // every message handed to CoreHost as its port would hand it.
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
    this.outputLatency = m.latency || 0;
    this._clock = { time: m.time, at: performance.now(), running: !!m.running };
    const state = m.running ? 'running' : 'suspended';
    if (state !== this.state) {
      this.state = state;
      this.dispatchEvent(new Event('statechange'));
    }
    if (this._alarms.length) this._ring();
  }

  // For Diagnostics: the stream, as the core's side says it.
  streamReport() {
    const s = this.stream;
    if (!s) return 'not started';
    const thread = { 0: 'normal', 1: 'SCHED_FIFO', 2: 'SCHED_RR' }[s.policy] || (s.policy < 0 ? 'not yet' : `policy ${s.policy}`);
    const perf = { 10: 'none', 11: 'power saving', 12: 'low latency' }[s.performance] || s.performance;
    return `${s.running ? 'running' : 'stopped'}, ${s.rate} Hz, ${s.channels} channels, burst ${s.burst}, buffer ${s.buffer} of ${s.capacity}, ${perf}, ${s.sharing === 0 ? 'exclusive' : 'shared'}, thread ${thread}/${s.priority}, reopens ${s.reopens}, busiest callback ${(s.busiest * 100).toFixed(1)}% of its deadline, mean ${(s.mean * 100).toFixed(2)}%, sound ${(s.sounding || 0).toFixed(1)} s`;
  }
}
