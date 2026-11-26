// The core's node, into the speakers.
//
// The core plays everything: its player decides the notes, its voices make
// them, and its mix and master chain finish them (core/, through
// js/dlplayer.wasm in js/worklet.js). The page decides only where that
// sound goes, and the few things that a listener's device decides: the
// volume, the transport's silence, mono or stereo, and the quality that the
// core mixes at. This module is that: one core's node on one context, and
// no other Web Audio. If a browser cannot run the core, nothing plays, and
// the page says so in a plain line.
//
// In the Android app, the core's player is native, and the context is a
// stand-in on its clock (js/native.js). There is no node to connect, and
// the WebView plays nothing. The same commands reach the core.

import { CoreHost, MIX, CANCEL, HOLD, LINEAR, SET, DROP_CAUSES } from './core.js';

export class Output {
  // `core` is what loadCore() gave for this context, if it has arrived. A
  // core that arrives later comes in with attachCore(). `onCoreError` hears
  // once if the core does not run, at any time.
  constructor(ctx, quality = 'full', { core = null, coreError = null, onCoreError = null, layout = 2, burn = 0 } = {}) {
    this.ctx = ctx;
    this.quality = quality;
    // The core's render: 1 mono, 2 stereo (`setLayout`).
    this.layout = layout === 2 ? 2 : 1;
    this.onCoreError = onCoreError;
    // How busy the core's audio thread is: called with each of its reports
    // ({ max, behind, windows, seconds }). And a test's slow device: the
    // microseconds added to each of its blocks (`?burn=`).
    this.onBusy = null;
    this._burn = burn;
    this.core = null;
    // The reason that the core is not coming, if it is not. Diagnostics
    // shows it.
    this.coreError = coreError;
    // What reaches the speakers: the core's node, once there is one.
    this.output = null;
    // The listener's volume, and whether the transport silenced the output.
    this.userVolume = null;
    this._killed = false;
    if (core) this.attachCore(core);
  }

  attachCore(core) {
    if (this.core || this.coreError) return;
    try {
      this.core = new CoreHost(this.ctx, core, { quality: this.quality, layout: this.layout, burn: this._burn });
    } catch (err) {
      this.coreFailed(err);
      return;
    }
    this.core.onbusy = (busy) => { if (this.onBusy) this.onBusy(busy); };
    this.core.onfail = () => {
      // The app keeps this answer for the session. A later output (the
      // quality toggle) does not build a core that has failed.
      this.coreError = this.core.failed;
      if (this.onCoreError) this.onCoreError(this.coreError);
    };
    if (this.core.node) this.core.node.connect(this.ctx.destination, 0);
    this.output = this.core.node;
    if (this._killed) this.core.param(MIX.kill, SET, 0, 0);
    if (this.userVolume != null) this.core.playVolume(this.userVolume);
  }

  // The core will not come: it did not load, or its node could not be
  // built. Nothing plays, and the page says why.
  coreFailed(err) {
    if (this.core) return;
    this.coreError = String((err && err.message) || err);
    if (this.onCoreError) this.onCoreError(this.coreError);
  }

  // The core, when it is running.
  _core() {
    return this.core && !this.core.failed ? this.core : null;
  }

  // The listener's Mono switch: the core's render from now, mono (1) or
  // stereo (2), faded, so that a loop that plays goes on. A core that is
  // still on its way starts in it.
  setLayout(layout) {
    this.layout = layout === 2 ? 2 : 1;
    const core = this._core();
    if (core) core.setLayout(this.layout);
  }

  // The core's player sets the master gain itself, at each loop it starts
  // and when it is told the listener's volume.
  setVolume(v) {
    this.userVolume = v;
    const core = this._core();
    if (core) core.playVolume(v);
  }

  // A quality switch hands over at `from`. Drop what the player handed the
  // core for `from` or later, and the mix's own events from then on (the
  // tails' fades and the ducks).
  cancelFrom(from) {
    const core = this._core();
    if (!core) return;
    core.cancel(from);
    core.param(MIX.tails, CANCEL, 0, from);
    core.param(MIX.pump, CANCEL, 0, from);
  }

  // Silence everything already in flight. Not a mute: the transport stopped.
  silence(when = this.ctx.currentTime) {
    this._killed = true;
    const core = this._core();
    if (!core) return;
    core.param(MIX.kill, HOLD, 0, when);
    core.param(MIX.kill, LINEAR, 0, when + 0.06);
  }

  // The whole output falls to nothing from `from` to `to`, and stays there.
  // The quality switch uses it to hand over at a boundary, with the old core
  // fading out before it. Like `silence`, but over a fade of its own.
  fadeOut(from, to) {
    this._killed = true;
    const core = this._core();
    if (!core) return;
    core.param(MIX.kill, HOLD, 0, from);
    core.param(MIX.kill, LINEAR, 0, to);
  }

  unsilence(when = this.ctx.currentTime) {
    this._killed = false;
    const core = this._core();
    if (!core) return;
    core.param(MIX.kill, HOLD, 0, when);
    core.param(MIX.kill, LINEAR, 1, when + 0.02);
  }

  // Let the core's node go: its notes stop with it.
  dispose() {
    if (this.core) this.core.dispose();
    this.output = null;
  }

  // For Diagnostics: the core's player, with the notes it took late, left
  // out or dropped; or the reason that there is none.
  engineReport() {
    const c = this.core;
    if (!c) return this.coreError ? `none (${this.coreError})` : 'rust (loading)';
    if (c.failed) return `none (${c.failed})`;
    const p = c.playerAt;
    const at = p ? `  player: ${['idle', 'making a loop', 'its first pass', 'playing'][p.state] || p.state}, step ${p.step}` : '';
    const dropped = c.dropped ? ` (${DROP_CAUSES.map((cause, i) => `${cause} ${c.droppedBy[i] || 0}`).join(', ')})` : '';
    // The app's native core, with the stream's underruns.
    if (c.native) {
      const s = this.ctx.stream;
      return `native (the core's player)  late: ${c.late}  missed: ${c.missed}  dropped: ${c.dropped}${dropped}  underruns: ${s ? s.underruns : '-'}${at}`;
    }
    return `rust (the core's player)  late: ${c.late}  missed: ${c.missed}  dropped: ${c.dropped}${dropped}${at}`;
  }
}
