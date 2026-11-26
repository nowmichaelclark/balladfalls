// The engine: the page's link to the core's player.
//
// The core (core/src/player/, built into js/dlplayer.wasm) runs in an
// AudioWorklet (js/worklet.js). An AudioWorklet is code that the browser
// runs on its audio thread. The core decides every note there and makes
// every sound. This file decides no notes and keeps no notes in advance.
//
// This file does two jobs:
// 1. It sends commands to the core: a loop to play (its seed, its request
//    and the edits from a code), a change, a re-roll, the controls and the
//    picks.
// 2. It reads the events that the core sends back, and keeps them for the
//    page to draw: the step that plays, the grid of each pass, the start of
//    each pass and the end of the track.
//
// The core does not need the page while it plays. If the page stalls, hides
// or freezes, the music goes on.
//
// The picks are the Vibe panel's choices (mood, tempo, key and the rest).
// The page sends them once (`setPicks`), and the core keeps them. When the
// core makes a new loop itself, it uses the picks. That happens at Next past
// the newest loop (`next`), and when the track ends with no loop of the
// page's waiting. The core then reports the new loop's seed (`onOwn`), and
// the page catches up.
//
// The page can show a loop before the core starts to play it (the info card,
// the first grid). For that, it asks js/gen.js, which uses the same core
// module, so it gets the same loop. The spec is the page's record of a loop
// (js/request.js). The history, the saves and the share codes keep specs.
// The core plays only the spec's seed, request and edits.
//
// js/main.js uses this engine. It calls load, start, stop and next; the
// controls (setMute, setTempo, setTone, setWander, trackChanged); the
// playhead (visualStep); the Now playing clock (audibleSteps, endStep,
// roundSteps); and Diagnostics (report).

import { render } from './gen.js';
import { HeardSteps } from './heard.js';
import { coreTrack } from './tracklen.js';
import { LAYERS, askOf, picksAsk, pieceOf, loopBars } from './request.js';

// Other modules import these two from here.
export { askOf, picksAsk };

// The "Let the loop wander" slider goes from 0 to 2.4. Below this value, a
// code wanders the same way each time it plays. At this value and above,
// each play gets a new salt (a random number added to the wander's seed),
// so the same code wanders a new way each time. Mikey asked for the top of
// the slider to feel experimental, not repeatable (DECISIONS.md, 2026-10-18).
// This value is the conservative start: only the top sixth of the slider.
// For Mikey's ears.
export const UNREPEATABLE_FROM = 2.0;

// Make a new salt for a play. The salt is never 0, because 0 means "no salt".
export function freshSalt() {
  try {
    const x = new Uint32Array(1);
    globalThis.crypto.getRandomValues(x);
    if (x[0]) return x[0];
  } catch { /* no crypto here */ }
  return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
}

// The moment that a change waits for. The numbers are the core's
// (`Moment::ALL` in core/src/player/).
export const MOMENT = { now: 0, beat: 1, bar: 2, phrase: 3, pass: 4, end: 5 };
// The kinds of event that the core reports (`Kind::ALL`).
export const KIND = { step: 0, pass: 1, section: 2, phrase: 3, loop: 4, revised: 5, end: 6, own: 7, jump: 8, heard: 9 };
// Where a jump goes (`Player::jump`). A section, a bar or a time in seconds
// counts from the start of the piece. A step counts from the load, and the
// jump lands on that exact step (the rail of a short loop uses it).
export const JUMP = { section: 0, bar: 1, time: 2, step: 3 };
// At Next, Previous, or a loop picked while one plays, the old loop fades
// out over this many seconds. It is the core's crossfade for a change
// (`player::change::CROSSFADE`). For Mikey's ears.
export const CHANGE_FADE = 1.0;
// The fade, in seconds, when a count of passes or bars ends the track in the
// middle of a pass. The core ends it at a phrase line. If the track ends at
// the end of a pass, the old loop rings out. If a time ends it, the loop
// rings out on its last second, or fades by the track's fade out.
export const END_FADE = 1.0;

// The most entries that the playhead queue and the grid queue keep.
const QUEUE_MOST = 512;
const GRIDS_MOST = 16;

// The track length as the core takes it (`Player::set_track_with`):
// [kind, count], from the length and fades in the Vibe panel
// (js/tracklen.js).
export const trackOf = coreTrack;

export class PlayerEngine {
  constructor(ctx, output) {
    this.ctx = ctx;
    this.output = output;
    this.spec = null;
    // `base` is the loop as js/gen.js renders it, for the card and the first
    // grid. `live` is the grid on the screen: the pass that the listener
    // hears, as the core reports it.
    this.base = null;
    this.live = null;
    this.playing = false;
    this.driftOn = true;
    this.driftAmount = 1;
    // The wander salt of this play (see UNREPEATABLE_FROM).
    this.salt = 0;
    this.onStep = null;
    this.onLoop = null;
    this.onTrackEnd = null;
    // onOwn(seed, tag): a loop that the core made itself has started. `tag`
    // is the number of the picks that it used.
    this.onOwn = null;
    // onPlace(place): the core reported a place while paused (a jump), for
    // the page to draw.
    this.onPlace = null;
    // onPicks({ tag, met, why }): the core's answer to the picks.
    this.onPicks = null;
    // The state of the picks:
    // - `picks`: the picks sent ({ ask, tag }).
    // - `picksFor`: the core that has them.
    // - `drawsFor`: the core that has a seed for its own loops.
    // - `wantOwn`: Next asked for a loop of the core's own, and no core could
    //   take the request yet.
    // - `ownTag`: the tag of the core's own loop whose Loop event comes next.
    this.picks = null;
    this.picksFor = null;
    this.drawsFor = null;
    this.wantOwn = false;
    this.ownTag = null;
    this.visualQueue = [];
    // The playhead trim in seconds (Diagnostics, "Playhead trim"; main.js
    // sets it).
    this.visualOffset = 0;
    this.latency = null;
    // What Play must ask the core for:
    // - 'load': a loop that the core does not have yet.
    // - 'resumed': the same loop again on a new core (after a switch to or
    //   from Lite).
    // - null: the loop that the core stopped, to go on from where it stood.
    this.needs = 'load';
    // What the core reported:
    // - `decided`: the last step decided ({ time, number, step }).
    // - `heard`: the last step heard ({ time, step, abs }).
    // - `gridQueue`: the grids that wait for their time.
    // - `loopCount`: the passes heard.
    // - `trackEnd`: the step where the track ends (from the load), or null.
    // - `countFrom`: the step that the page counts the track from.
    this.decided = null;
    this.heard = null;
    this.gridQueue = [];
    // What the Layers view draws (js/heard.js): each step as the listener
    // heard it, and the pass ahead as its plan says it will sound.
    this.heardSteps = new HeardSteps();
    this.loopCount = 0;
    this.trackEnd = null;
    this.countFrom = 0;
    // The track length:
    // - `track`: the last one sent ([kind, count]).
    // - `armed`: the spec of the loop that plays when the track ends. The
    //   core holds it as a change at the end.
    // - `taken`: the seed that the core started there, until the page
    //   catches up.
    this.track = null;
    this.armed = null;
    this.taken = null;
    // The count of loops that the core started, for Diagnostics.
    this.loops = 0;
    this._hooked = null;
    this._hook();
  }

  // Return the core's node if it is the one that plays, else null.
  _core() {
    const c = this.output.core;
    return c && !c.failed ? c : null;
  }

  // Listen to the core's events. Each node is hooked once. If a core
  // arrives later, it is hooked when it arrives.
  _hook() {
    const c = this._core();
    if (!c || this._hooked === c) return;
    this._hooked = c;
    c.onevents = (m) => this._receive(m);
    c.onpicks = (m) => { if (this.onPicks) this.onPicks(m); };
  }

  // Send the picks (`picksAsk(request).ask`) with the number `tag`. The core
  // keeps them for the loops that it makes itself. If the core is new (a
  // reload, or a switch to or from Lite), the picks are sent again.
  setPicks(ask, tag) {
    this.picks = { ask, tag };
    this.picksFor = null;
    this._sendPicks();
  }

  _sendPicks() {
    const core = this._core();
    if (!core || !this.picks || this.picksFor === core) return;
    if (this.drawsFor !== core) {
      // Give each new core a new seed to draw from. The core's own loops
      // come only from this seed and the picks.
      core.playDraws(freshSalt());
      this.drawsFor = core;
    }
    core.playPicks(this.picks.ask, this.picks.tag);
    this.picksFor = core;
  }

  // Next past the newest loop: ask the core for a new loop of its own, made
  // with the picks. It crossfades like any change. The page learns which
  // loop it is from `onOwn`. If paused, Next starts to play. If the core is
  // not loaded yet, the request waits for it.
  next() {
    this.salt = freshSalt();
    this.wantOwn = true;
    if (!this.playing) {
      this.playing = true;
      this.output.unsilence();
      this._begin();
      return;
    }
    this._askOwn();
  }

  _askOwn() {
    const core = this._core();
    if (!core || !this.wantOwn) return;
    this._sendPicks();
    this.wantOwn = false;
    this.taken = null;
    core.playWander(this.driftOn ? this.driftAmount : 0, this.wanderSalt);
    core.playNext(MOMENT.now, CHANGE_FADE);
    this.visualQueue = [];
    this.gridQueue = [];
    this.countFrom = 0;
  }

  // The core has loaded (after Play, on a slow first visit). Give it the
  // loop now.
  coreArrived() {
    this._hook();
    if (this.playing) this._begin();
  }

  // The length of one step in seconds (a step is a sixteenth note).
  get stepDur() {
    return 60 / this.spec.bpm / 4;
  }

  // The salt that the wander uses now: the salt of this play at the top of
  // the slider (UNREPEATABLE_FROM and up), else 0.
  get wanderSalt() {
    return this.driftOn && this.driftAmount >= UNREPEATABLE_FROM ? this.salt : 0;
  }

  // The next step to decide (its number in the pass) and its time.
  // js/quality.js uses them to find the next boundary for a switch to or
  // from Lite.
  get step() {
    return this.decided ? this.decided.number + 1 : 0;
  }

  get nextStepTime() {
    return this.decided ? this.decided.time + this.stepDur : this.ctx.currentTime + 0.3;
  }

  // Give the engine a loop to play, and return its render.
  // - `keepPosition`: a re-roll. The core makes the loop again and keeps
  //   its place.
  // - `resume`: the same loop again on a new core (a switch to or from
  //   Lite). It starts from its top. The lateFloor (the drums and the bass
  //   wait a while after a load, then come in) does not wait again.
  load(spec, { keepPosition = false, resume = false } = {}) {
    this.spec = spec;
    this.base = render(spec);
    this.live = this.base;
    // A new play gets a new salt. If the core already started this loop
    // (at the end of the track, or as its own), the loop keeps the salt
    // that it started with.
    const caught = !keepPosition && this.taken != null && this.taken === spec.seed >>> 0;
    if (!keepPosition && !resume && !caught) this.salt = freshSalt();
    if (!keepPosition) {
      this.gridQueue = [];
      this.countFrom = 0;
      // The place of the last loop does not apply to this one.
      this.placeHeard = null;
    }
    const core = this._core();
    if (!this.playing || !core) {
      this.needs = resume ? 'resumed' : 'load';
      return this.base;
    }
    const seed = spec.seed >>> 0;
    if (keepPosition) {
      core.playRevise(seed, askOf(spec));
    } else if (this.taken === seed) {
      // The core started this loop at the end of the track. The page only
      // catches up.
      this.taken = null;
    } else {
      this.taken = null;
      core.playChange(seed, askOf(spec), MOMENT.now, CHANGE_FADE);
      this.visualQueue = [];
    }
    this._controls();
    return this.base;
  }

  // Send the controls that stay the same from loop to loop: the mute of each
  // layer, the wander and its salt, and the track length.
  _controls() {
    const core = this._core();
    if (!core || !this.spec || this.wantOwn) return;
    const mutes = this.spec.mutes || {};
    LAYERS.forEach((layer, i) => core.playMute(i, !!mutes[layer]));
    core.playWander(this.driftOn ? this.driftAmount : 0, this.wanderSalt);
    const t = trackOf(this.spec);
    if (!this.track || t[0] !== this.track[0] || t[1] !== this.track[1]) this._sendTrack(t);
  }

  _sendTrack(t = trackOf(this.spec)) {
    const core = this._core();
    if (!core) return;
    this.track = t;
    core.playTrack(t[0], t[1], this._arm());
  }

  // The armed loop in the form that the core takes, with its own track
  // length and fades. Null if no loop is armed.
  _arm() {
    const s = this.armed;
    return s ? { seed: s.seed >>> 0, ask: askOf(s), fade: END_FADE, track: trackOf(s) } : null;
  }

  // Arm the loop that plays when the track ends (`spec`). The core holds it,
  // so it starts on time even if the page sleeps. If `spec` is null, the
  // armed loop is dropped, and the core makes a loop of its own with the
  // picks.
  arm(spec) {
    this.armed = spec || null;
    const core = this._core();
    if (!core || !this.playing) return;
    core.playArm(this._arm());
  }

  start() {
    if (this.playing || !this.spec) return;
    this.playing = true;
    this.output.unsilence();
    this._begin();
  }

  // Play. Send the core the loop (or tell it to go on from where it
  // stopped), the controls, the track length and the armed loop. If the
  // core is not loaded yet, wait for it (`coreArrived`).
  _begin() {
    this._hook();
    const core = this._core();
    if (!core || !this.playing) return;
    if (this.output.userVolume != null) core.playVolume(this.output.userVolume);
    // Send the picks, for the loops that this core makes itself.
    this._sendPicks();
    // Send the wander and its salt before the loop: the first pass uses them.
    core.playWander(this.driftOn ? this.driftAmount : 0, this.wanderSalt);
    if (this.wantOwn) {
      // Next came while paused, or before the core loaded. The core plays a
      // loop of its own, and the page catches up at its Loop event.
      this._askOwn();
      this.track = null;
      this.needs = null;
      this._controls();
      return;
    }
    if (this.needs) {
      core.playLoad(this.spec.seed >>> 0, askOf(this.spec), 0, this.needs === 'resumed');
      this.taken = null;
      this.visualQueue = [];
      // The track of a new loop counts from its first step. A load drops the
      // armed loop, so send the track and the armed loop again.
      this.track = null;
      this.needs = null;
      this._controls();
      return;
    }
    // Go on from where it stopped. The track count goes on too. Pause
    // dropped the armed loop, so send only that again.
    core.playResume(0);
    this._controls();
    if (this.armed) core.playArm(this._arm());
  }

  // Pause. The core stops deciding, drops the sound that it made but did
  // not play yet, and the output goes silent. Play goes on from here.
  stop() {
    if (!this.playing) return;
    this.playing = false;
    const core = this._core();
    if (core) {
      core.playStop();
      core.cancel();
    }
    this.output.silence();
    this.visualQueue = [];
    this.gridQueue = [];
    this.heardSteps.clear();
    this.heard = null;
  }

  setMute(layer, muted) {
    const core = this._core();
    const i = LAYERS.indexOf(layer);
    if (core && i >= 0) core.playMute(i, !!muted);
  }

  // The tempo slider. The core uses the new tempo from the next step that it
  // decides. The spec holds the tempo already, and a change or a re-roll
  // sends it as an edit.
  setTempo(bpm) {
    const core = this._core();
    if (core) core.playTempo(bpm);
  }

  setTone(tone) {
    const core = this._core();
    if (core) core.playTone(tone);
  }

  // "Let the loop wander": 0 is off, more is further. It starts at the next
  // pass.
  setWander(amount) {
    this.driftOn = amount > 0;
    if (this.driftOn) this.driftAmount = amount;
    const core = this._core();
    if (core) core.playWander(this.driftOn ? this.driftAmount : 0, this.wanderSalt);
  }

  // The listener set a new track length (the spec holds it already). The
  // core counts from now, and the armed loop goes with it.
  trackChanged(next = this.armed) {
    this.armed = next || null;
    this.countFrom = this.heard ? this.heard.abs : 0;
    this.trackEnd = null;
    if (this.playing) this._sendTrack();
  }

  // Nothing calls this now. It is from the time when there were two engines.
  // The core hears a change at once.
  redecide() {
    return false;
  }

  // Diagnostics' Reset. The page keeps no counts of its own, so there is
  // nothing to clear. The core keeps its own counts.
  clearMetrics() {}

  // Read a message from the core (CoreHost.onevents). Each event is four
  // numbers: time, kind, number, step. A grid can come with an event.
  _receive(m) {
    const ev = m.events || [];
    const grids = new Map((m.grids || []).map((g) => [g.at, g.grid]));
    for (let i = 0; i < ev.length / 4; i++) {
      const time = ev[4 * i];
      const kind = ev[4 * i + 1];
      const number = ev[4 * i + 2];
      const step = ev[4 * i + 3];
      this.heardSteps.event(time, kind, number, step, grids.get(i) || null);
      if (kind === KIND.step) {
        this.decided = { time, number, step };
        this.visualQueue.push({ time, step: number, abs: step, run: this.heardSteps.current });
        if (this.visualQueue.length > QUEUE_MOST) this.visualQueue.shift();
      } else if (kind === KIND.pass || kind === KIND.section) {
        this.loopCount = number;
        if (kind === KIND.pass && this.onLoop) this.onLoop(number);
      } else if (kind === KIND.jump) {
        // A jump landed. `step` is the step it goes on from, counted from the
        // load. The place says its section.
        this.jumped = { time, step };
        if (m.place) this.loopCount = m.place.section;
      } else if (kind === KIND.own) {
        // The next Loop event is a loop that the core made itself.
        this.ownTag = number;
      } else if (kind === KIND.loop) {
        this.loops++;
        this.countFrom = 0;
        this.loopCount = 0;
        if (this.ownTag != null) {
          // The core made this loop with the picks numbered `ownTag`. The
          // page catches up: main.js's onOwn makes the same spec for the
          // card and the history, and loads it. `load` then sees that the
          // core has it already.
          const tag = this.ownTag;
          this.ownTag = null;
          this.taken = number >>> 0;
          if (this.onOwn) this.onOwn(number >>> 0, tag);
        }
      } else if (kind === KIND.end) {
        // The track ended. If a loop was armed, the core started it, and the
        // page catches up: main.js's onTrackEnd loads that loop, and `load`
        // sees that the core took it. If no loop was armed, the core makes
        // one of its own (KIND.own).
        if (this.armed) {
          this.taken = this.armed.seed >>> 0;
          if (this.onTrackEnd) this.onTrackEnd();
        }
      }
      const grid = grids.get(i);
      if (grid && this.spec) {
        this.gridQueue.push({ time, pattern: this._gridPattern(grid) });
        if (this.gridQueue.length > GRIDS_MOST) this.gridQueue.shift();
      }
    }
    if (m.trackEnd != null) this.trackEnd = m.trackEnd >= 0 ? m.trackEnd : null;
    if (m.place !== undefined) this.placeHeard = m.place;
    // While paused, the page draws no frames. So draw a place that the core
    // reports (a jump held for Play) when it comes.
    if (!this.playing && m.place && this.onPlace) this.onPlace(m.place);
  }

  // Jump to another place in the loop. `kind` is a JUMP. `at` counts from
  // the start of the piece (a step counts from the load). The core lands on
  // the phrase line at or before `at` (a step: on it exactly), and the
  // listener hears it a few blocks later. The queued steps and grids of the
  // old place are dropped, and the core's events give the new ones.
  // While paused, the core holds the jump, and Play goes on from there. The
  // new place comes through `onPlace`.
  // Returns false if the core has no loop to move in: no loop yet, a loop
  // that waits for Play (a load while paused), or no core yet.
  jumpTo(kind, at) {
    const core = this._core();
    if (!core || !this.spec || this.needs || this.wantOwn || !Number.isFinite(at) || at < 0) return false;
    core.playJump(kind, at);
    this.visualQueue = [];
    this.gridQueue = [];
    this.heardSteps.dropGrids();
    // The old place is wrong now. Wait for the core's next report.
    if (!this.playing) this.placeHeard = null;
    return true;
  }

  // Where the listener is in the piece, as the core last reported it
  // (`Player::place`): { bar, bars, played, left, section }. `bars` and
  // `left` are null for Endless. Null before the first report. While paused,
  // it is where the loop stopped, or where a held jump goes on from.
  place() {
    return this.placeHeard || null;
  }

  // Turn the core's grid into the pattern that js/ui.js draws
  // (`renderGrids`): the loudest note of each layer on each step of its
  // cycle.
  _gridPattern(grid) {
    const base = this.base;
    const tracks = {};
    const cycles = {};
    LAYERS.forEach((layer, i) => {
      const row = grid[i] || [];
      cycles[layer] = row.length || base.totalSteps;
      tracks[layer] = [];
      row.forEach((vel, step) => { if (vel) tracks[layer].push({ step, vel }); });
    });
    return { stepsPerBar: base.stepsPerBar, totalSteps: base.totalSteps, cycles, tracks };
  }

  // The time on the audio clock that the listener hears now. It uses the
  // browser's output timestamp if there is one, else the latency that the
  // browser declares. The latency is smoothed so the playhead does not jump.
  heardTime() {
    const ctx = this.ctx;
    let heard = null;
    if (typeof ctx.getOutputTimestamp === 'function') {
      const ts = ctx.getOutputTimestamp();
      if (ts && ts.contextTime > 0 && ts.performanceTime > 0) {
        const since = (performance.now() - ts.performanceTime) / 1000;
        heard = ts.contextTime + Math.max(0, Math.min(0.5, since));
      }
    }
    if (heard === null) heard = ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
    const raw = Math.max(0, Math.min(0.6, ctx.currentTime - heard));
    this.latency = this.latency === null ? raw : this.latency * 0.92 + raw * 0.08;
    return ctx.currentTime - this.latency;
  }

  // Return the step to light now, or null if it did not change. Also move
  // `live` to the grid of the pass that the listener hears.
  visualStep() {
    const now = this.heardTime() + this.visualOffset;
    let found = null;
    while (this.visualQueue.length && this.visualQueue[0].time <= now) {
      const v = this.visualQueue.shift();
      this.heard = v;
      found = v.step;
    }
    while (this.gridQueue.length && this.gridQueue[0].time <= now) this.live = this.gridQueue.shift().pattern;
    this.heardSteps.at(now);
    return found;
  }

  // What the Layers view shows for bar `bar` now (HeardSteps.bar in
  // js/heard.js): the loudness and share of each layer on each step of the
  // bar that holds the last step heard. A muted layer shows its plan.
  // Returns null before the first step is heard, or for another bar.
  barRows(bar) {
    const h = this.heard;
    const spb = this.base && this.base.stepsPerBar;
    if (!h || !spb || Math.floor(h.step / spb) !== bar) return null;
    const mutes = (this.spec && this.spec.mutes) || {};
    return this.heardSteps.bar(bar, spb, h.abs - (h.step % spb), h.run, LAYERS.map((l) => !!mutes[l]));
  }

  // A number that changes when the result of `barRows` can change.
  get rowsVersion() {
    return this.heardSteps.version;
  }

  // Where the listener is in this loop, in steps from its load.
  audibleSteps() {
    if (!this.playing || !this.heard || !this.spec) return null;
    const into = (this.heardTime() - this.heard.time) / this.stepDur;
    return this.heard.abs + Math.max(0, Math.min(1, into));
  }

  // The step where the track ends, from the load, as the core reports it.
  // Null while the loop plays on with no end.
  endStep() {
    return this.trackEnd;
  }

  // The number of steps in one pass of the whole loop.
  roundSteps() {
    const spb = this.base.stepsPerBar || 16;
    return pieceOf(this.spec) ? loopBars(this.spec) * spb : this.base.totalSteps;
  }

  // The engine's lines for Diagnostics.
  report() {
    const c = this._core();
    const p = c && c.playerAt;
    const states = ['idle', 'making a loop', 'its first pass', 'playing'];
    return {
      hidden: typeof document !== 'undefined' && document.hidden,
      player: p ? `${states[p.state] || p.state}, step ${p.step}` : c ? 'starting' : 'waiting for the core',
      playerLoops: this.loops,
      playerEventsLost: c ? c.eventsLost : '-',
      playerRefused: c ? c.refused : '-',
      trackEndStep: this.trackEnd == null ? 'none' : this.trackEnd,
      armed: this.armed ? this.armed.name : 'none',
      picksSent: this.picks ? this.picks.tag : 'none',
      ctxState: this.ctx.state,
      sampleRate: this.ctx.sampleRate,
      baseLatency: this.ctx.baseLatency ? +this.ctx.baseLatency.toFixed(4) : '-',
      outputLatency: this.ctx.outputLatency ? +this.ctx.outputLatency.toFixed(4) : '-',
      measuredLatencyMs: this.latency === null ? '-' : Math.round(this.latency * 1000),
      timestampApi: typeof this.ctx.getOutputTimestamp === 'function' ? 'yes' : 'no',
    };
  }
}
