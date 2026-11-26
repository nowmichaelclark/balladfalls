// The speed test: how fast a device plays, and renders ahead, the busiest
// loops on the core's player (js/dlplayer.wasm). These are the figures that
// the charter's promise 1 asks of a phone. One module serves every host: the
// page speed.html runs it in a worker on Mikey's phone, and tools/ahead.mjs
// runs it in Node and, through the page, in headless Chromium.
//
// A loop plays as the worklet plays it. The core starts at the device's
// rate, with the player on it. The loop is asked for and made at once. Then
// it plays one block of 128 frames at a time (`dl_play_process`), and each
// block is timed.
// - Over `runs` runs, each block's least time is kept (as
//   tools/player-wasm.mjs --costs does). So a pause that the device took for
//   something else is not read as the core's. The worst of those is the
//   worst block, against its deadline (128 frames at the rate).
// - Rendering ahead is timed apart, as a host with no audio thread does it:
//   the same loop rendered in chunks (`dl_play_render`). The audio's length
//   over the time it took is the speed in times real time (the best of
//   `aheadRuns`).

export const QUANTUM = 128;

// The busiest loops of the core baseline's 40 (corpus seed 1), by their
// worst block at full quality in WebAssembly (tools/player-wasm.mjs
// --costs): vei-koan (#37, the busiest), koth-loar (#35), theith-yaing (#3)
// and taing-doan (#33).
export const LOOPS = [
  { seed: 3251295801, name: 'vei-koan' },
  { seed: 4271491011, name: 'koth-loar' },
  { seed: 4213581821, name: 'theith-yaing' },
  { seed: 1950499338, name: 'taing-doan' },
];

// The four ways, the yardstick's first: full quality, mono and stereo.
export const WAYS = [
  { full: true, stereo: false },
  { full: true, stereo: true },
  { full: false, stereo: false },
  { full: false, stereo: true },
];

export const wayName = (w) => `${w.full ? 'full' : 'lite'} ${w.stereo ? 'stereo' : 'mono'}`;

// A core and the player on it, with the loop made, as the worklet starts
// them. `x` is one instance, started afresh for every run (`dl_init` clears
// the core, and `dl_play_attach` the player). So the runs make no garbage
// for the browser to collect in the middle of a timed block.
function start(x, seed, way, rate) {
  x.dl_init(rate);
  x.dl_quality(way.full ? 1 : 0);
  if (way.stereo) x.dl_layout(2);
  x.dl_play_wander(1);
  x.dl_play_attach(way.full ? 1 : 0);
  x.dl_play_load(seed >>> 0, 0);
  x.dl_play_ready();
  return x;
}

// One loop one way: `seconds` of it, `runs` times block by block and
// `runs` times ahead in chunks. `now` is the host's clock in milliseconds.
// Returns the worst block (microseconds and % of the deadline), when in the
// loop it fell, the share of the time played the blocks took, and the
// render-ahead speed (times real time).
export function measure(module, { seed, way, rate = 48000, seconds = 30, runs = 3, aheadRuns = 1, chunk = 2048, now }) {
  const blocks = Math.ceil((seconds * rate) / QUANTUM);
  const best = new Float64Array(blocks).fill(Infinity);
  let played = Infinity;
  const instance = new WebAssembly.Instance(module, {}).exports;
  for (let run = 0; run < runs; run++) {
    const x = start(instance, seed, way, rate);
    let sum = 0;
    for (let b = 0; b < blocks; b++) {
      const t0 = now();
      x.dl_play_process(b * QUANTUM);
      const t = now() - t0;
      sum += t;
      if (t < best[b]) best[b] = t;
    }
    if (sum < played) played = sum;
  }
  let worst = 0; let at = 0;
  for (let b = 0; b < blocks; b++) if (best[b] > worst) { worst = best[b]; at = b; }
  const frames = blocks * QUANTUM;
  let ahead = Infinity;
  for (let run = 0; run < aheadRuns; run++) {
    const x = start(instance, seed, way, rate);
    const t0 = now();
    for (let done = 0; done < frames; done += chunk) x.dl_play_render(Math.min(chunk, frames - done));
    const t = now() - t0;
    if (t < ahead) ahead = t;
  }
  const deadline = (QUANTUM / rate) * 1000;
  return {
    worstUs: worst * 1000,
    pct: (100 * worst) / deadline,
    at: (at * QUANTUM) / rate,
    share: (100 * played) / (seconds * 1000),
    speed: (frames / rate) / (ahead / 1000),
  };
}

// Warm the engine up before anything is timed. The browser compiles the
// module's code again, faster, once it has run a while, and a block that ran
// on the slow first compile would read as the core's worst. So play a few
// seconds of the first loop, untimed, in every way.
export function warm(module, { rate = 48000, seconds = 4, now }) {
  for (const way of WAYS) measure(module, { seed: LOOPS[0].seed, way, rate, seconds, runs: 1, aheadRuns: 1, now });
}

// One result as a line of the report.
export function line(loop, way, r) {
  return `${loop.name.padEnd(13)} ${wayName(way).padEnd(11)} worst block ${r.pct.toFixed(1).padStart(5)}% (${Math.round(r.worstUs)} us at ${r.at.toFixed(1)} s)  blocks ${r.share.toFixed(1)}% of real time  ahead ${r.speed.toFixed(1)}x real time`;
}

// The smallest step the host's clock takes, in microseconds (a browser
// coarsens it: 100 us in Chrome unless the page is cross-origin isolated,
// then 5 us).
export function tick(now) {
  let least = Infinity;
  for (let i = 0; i < 50; i++) {
    const a = now(); let b = now();
    while (b === a) b = now();
    least = Math.min(least, b - a);
  }
  return least * 1000;
}
