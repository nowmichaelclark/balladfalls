// What the layers draw: each layer's notes as they are heard, not as they
// were composed.
//
// The core reports two things that the layers read
// (core/src/player/events.rs):
// - With each pass, the layers' grid of that pass, as its plan will have it
//   heard (`Player::grid`): each step's loudest note, a long piece's levels
//   on it, and a resting layer left out.
// - With each step that it decides, what each layer actually sounded there,
//   as heard (`Kind::Heard`). That is none for a note that the budget
//   refused, a muted or resting layer, or a kit that waits to come in. A
//   layer under a long piece's level is as soft as it is heard.
// A step is decided a lookahead (a quarter-second) before it is heard. So
// when the playhead reaches a dot, the dot is what is heard there. The dots
// further on in the bar are the pass's grid until their steps are decided.
//
// There is no DOM here. js/main.js draws what `bar` returns (renderGrids in
// js/ui.js). tools/heard.mjs asks the same questions of it in Node, to
// measure the drawing against what each layer's channel sounds.

// The kinds of event this reads (`Kind::ALL`).
const KIND = { pass: 1, section: 2, loop: 4, revised: 5, jump: 8, heard: 9 };
// A Heard event's number: five layers, HEARD_BITS each, from the lowest.
// In each, the low LOUD_BITS are the loudness (1 at HEARD_ONE), and the
// rest is the share of its level that the layer was left at, in sevenths
// (`events::pack_heard`).
const HEARD_BITS = 10;
const LOUD_BITS = 7;
const HEARD_ONE = 64;
const SHARE_MOST = 7;
const LAYER_COUNT = 5;

// A note under this loudness is not drawn, because it is too quiet to be
// heard as a note (about 30 dB under a full one: two steps of a Heard
// event's loudness). HEARD_LEAST is the same line before a note's loudness
// is rounded into its event. tools/heard.mjs counts a note under it as not
// heard.
export const DRAWN_LEAST = 2 / HEARD_ONE;
export const HEARD_LEAST = 1.5 / HEARD_ONE;

// How many steps' sounds are kept: a few bars behind the playhead, and the
// lookahead in front, with room to spare.
const KEPT = 512;
const GRIDS_MOST = 16;

// A Heard event's number as the five layers' loudness and share.
export function unpackHeard(number) {
  const loud = new Array(LAYER_COUNT);
  const share = new Array(LAYER_COUNT);
  let n = number;
  const span = 2 ** HEARD_BITS;
  const low = 2 ** LOUD_BITS;
  for (let i = 0; i < LAYER_COUNT; i++) {
    const field = n % span;
    loud[i] = (field % low) / HEARD_ONE;
    share[i] = Math.floor(field / low) / SHARE_MOST;
    n = Math.floor(n / span);
  }
  return { loud, share };
}

// The layers' drawing. It is fed the core's events as they arrive, and
// asked as the music is heard.
export class HeardSteps {
  constructor() {
    this.clear();
  }

  // Forget everything (a new loop to show, a pause).
  clear() {
    // The grids that wait for their time, and the one heard now. What each
    // step sounded, by `place` (the run of steps it belongs to, and its step
    // from the load). And the run that the incoming events belong to.
    this.grids = [];
    this.live = null;
    this.sounds = new Map();
    this.order = [];
    this.run = 0;
    // Each layer's share of its level at the latest step decided. It sets
    // how bright the dots not yet decided are drawn. (A long piece's level
    // and a rising kit glide slowly.)
    this.share = new Array(LAYER_COUNT).fill(1);
    this.shareAt = -Infinity;
    // Bumped when what a bar shows may have moved (a step's sounds came in,
    // or a grid took over). The page draws again only then.
    this.version = 0;
  }

  // One of the core's events: its time on the core's clock, its kind, its
  // number, its step from the load, and the layers' grid read with it (an
  // array a layer, or null). A new loop or a jump starts a run of steps of
  // its own, whose steps from the load start again.
  event(time, kind, number, step, grid) {
    if (kind === KIND.loop || kind === KIND.jump) this.run++;
    if (grid) {
      this.grids.push({ time, grid, run: this.run });
      if (this.grids.length > GRIDS_MOST) this.grids.shift();
    }
    if (kind === KIND.heard) {
      const key = `${this.run}:${step}`;
      if (!this.sounds.has(key)) this.order.push(key);
      const heard = unpackHeard(number);
      this.sounds.set(key, heard);
      if (time >= this.shareAt) {
        this.shareAt = time;
        this.share = heard.share;
      }
      while (this.order.length > KEPT) this.sounds.delete(this.order.shift());
      this.version++;
    }
  }

  // Forget the grids still to come. On a jump, what was queued to draw from
  // the old place is dropped.
  dropGrids() {
    this.grids = [];
  }

  // The run that the next steps the page queues belong to. js/player.js
  // keeps it with each step, so that a step heard after a jump asks the
  // right run.
  get current() {
    return this.run;
  }

  // The music heard now is at `time`, so the grid of the pass heard takes
  // over.
  at(time) {
    while (this.grids.length && this.grids[0].time <= time) {
      this.live = this.grids.shift();
      this.version++;
    }
  }

  // What bar `bar` of the pass heard shows. It has `spb` steps a bar, and
  // its first step is `from` steps from the load, in run `run` (the current
  // one if left out). For each layer: each step's loudness (`loud`, 0 for
  // none), and the share of its level that it is heard at (`share`, how
  // bright it is drawn).
  // - A step decided shows what it sounded.
  // - A step not yet decided shows the pass's grid, as bright as the layer
  //   is now.
  // - A layer in `planned` (a muted one, which sounds nothing) shows the
  //   grid throughout.
  bar(bar, spb, from, run = this.run, planned = null) {
    const g = this.live && this.live.grid;
    const loud = [];
    const share = [];
    for (let l = 0; l < LAYER_COUNT; l++) {
      const lr = new Array(spb).fill(0);
      const sr = new Array(spb).fill(1);
      const cells = g ? g[l] || [] : [];
      const plan = !!(planned && planned[l]);
      for (let c = 0; c < spb; c++) {
        const heard = plan ? null : this.sounds.get(`${run}:${from + c}`);
        if (heard) {
          lr[c] = heard.loud[l] >= DRAWN_LEAST ? heard.loud[l] : 0;
          sr[c] = heard.share[l];
        } else if (cells.length) {
          const v = cells[(bar * spb + c) % cells.length] || 0;
          lr[c] = v >= DRAWN_LEAST ? v : 0;
          sr[c] = plan ? 1 : this.share[l];
        }
      }
      loud.push(lr);
      share.push(sr);
    }
    return { loud, share };
  }
}
