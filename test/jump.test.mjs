// A jump within a long piece in the app's module:
// js/dlplayer.wasm played block by block as the worklet plays it.
// Run with:  node test/jump.test.mjs   (the tools' build first, for the map:
// tools/build-core.sh --tools)
//
// What it holds: a jump to three hours into a 32,768-bar piece, and into
// Endless, is heard within a second, on a phrase line, with no late note,
// and its busiest block leaves room for the slow case's burn
// (tools/autolite.mjs: 1,700 us more on every block of 2,902 us); where it
// is (`dl_play_place`) reads three hours in, and no end for Endless; twenty
// jumps back and forth leave the core no busier than the loop alone; and
// the page's map (js/gen.js's `pieceMarks`) is the plan's (`dl_gen_map`,
// tools/gen-lib.mjs's `pieceMap`), unit for unit.

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { newSpec, pieceMarks } from '../js/gen.js';
import { KIND, JUMP } from '../js/player.js';
import * as G from '../tools/gen-lib.mjs';

const QUANTUM = 128;
const RATE = 44100;
const DEADLINE_US = (QUANTUM / RATE) * 1e6;
const BURN_US = 1700;
const wasm = fs.readFileSync(fileURLToPath(new URL('../js/dlplayer.wasm', import.meta.url)));
const module = new WebAssembly.Module(wasm);

let failures = 0;
function check(label, condition, detail = '') {
  console.log(condition ? `  pass  ${label}` : `  FAIL  ${label} ${detail}`);
  if (!condition) failures++;
}

// The ears' corpus loops `core/tests/jump.rs` plays (corpus seed 20261009).
const LOOPS = [176315227, 2679763182, 694704631];

// A core with the player on it, playing `seed` as a piece of `bars`
// (Infinity: Endless; null: the loop's own, a short loop), lite or full; the
// blocks rendered as the worklet renders them, each one's time kept.
function playing(seed, bars, full) {
  const x = new WebAssembly.Instance(module, {}).exports;
  x.dl_init(RATE);
  x.dl_quality(full ? 1 : 0);
  x.dl_play_attach(full ? 1 : 0);
  if (bars != null) x.dl_play_length(bars);
  x.dl_play_load(seed >>> 0, 0);
  let block = 0;
  const events = new Float64Array(x.memory.buffer, x.dl_play_event_at(), 4 * 256);
  const render = () => {
    const t0 = performance.now();
    x.dl_play_process(block);
    const us = (performance.now() - t0) * 1000;
    block += QUANTUM;
    const out = [];
    const n = x.dl_play_events();
    for (let i = 0; i < n; i++) out.push({ time: events[4 * i], kind: events[4 * i + 1], number: events[4 * i + 2], step: events[4 * i + 3] });
    return { us, out };
  };
  const now = () => block / RATE;
  return { x, render, now };
}

// The slowest of `runs` renders of the same blocks is the machine's noise:
// each block's least time over the runs.
function jumpCosts(seed, bars, full, to, runs = 3) {
  let least = null;
  let own = null;
  let heard = null;
  let landed = null;
  for (let r = 0; r < runs; r++) {
    const p = playing(seed, bars, full);
    const before = [];
    for (let i = 0; i < 2000; i++) before.push(p.render().us);
    const asked = p.now();
    if (!p.x.dl_play_jump(to.kind, to.at)) throw new Error('the jump was refused');
    const during = [];
    let jump = null;
    for (let i = 0; i < 400 && !jump; i++) {
      const { us, out } = p.render();
      during.push(us);
      jump = out.find((e) => e.kind === KIND.jump) || null;
    }
    const after = [];
    for (let i = 0; i < 2000; i++) after.push(p.render().us);
    least = least ? least.map((v, i) => Math.min(v, during[i] ?? Infinity)) : during;
    own = own ? own.map((v, i) => Math.min(v, before[i])) : before;
    heard = jump ? jump.time - asked : Infinity;
    landed = { jump, x: p.x };
  }
  return { jumpWorst: Math.max(...least), ownWorst: Math.max(...own.slice(100)), heard, ...landed };
}

console.log('A jump three hours in, as the worklet plays it');
for (const seed of LOOPS) {
  for (const [bars, name] of [[32768, '32,768 bars'], [Infinity, 'Endless']]) {
    for (const full of [false, true]) {
      const r = jumpCosts(seed, bars, full, { kind: JUMP.time, at: 3 * 3600 });
      const x = r.x;
      const label = `${seed} ${name} ${full ? 'full' : 'lite'}`;
      check(`${label}: heard within a second (${r.heard.toFixed(3)} s)`, r.heard < 1);
      check(`${label}: no late note, none missed`, x.dl_late() === 0 && x.dl_missed() === 0, `late ${x.dl_late()} missed ${x.dl_missed()}`);
      check(
        `${label}: its busiest block ${Math.round(r.jumpWorst)} us, room for the slow case's ${BURN_US} us in ${Math.round(DEADLINE_US)} (the loop's own ${Math.round(r.ownWorst)} us)`,
        r.jumpWorst + BURN_US < DEADLINE_US,
      );
      x.dl_play_place();
      const [bar, piece, played, left, section] = new Float64Array(x.memory.buffer, x.dl_play_place_at(), 5);
      check(`${label}: where it is, three hours in (bar ${Math.round(bar)} of ${piece}, ${Math.round(played)} s played, ${Math.round(left)} s left, section ${section})`,
        Math.abs(played - 3 * 3600) < 60 && (bars === Infinity ? piece === -1 && left === -1 : piece === 32768 && left > 0));
    }
  }
}

// A short loop's rail asks for a step
// (`JUMP.step`), playing or paused; it lands on that step, heard within the
// jump's 0.06 s (of the ask, or of Play after a pause), nothing late, its
// busiest block room for the slow case as a long piece's is.
console.log("A short loop's rail: a step, playing and paused");
for (const seed of LOOPS) {
  for (const full of [false, true]) {
    const label = `${seed} ${full ? 'full' : 'lite'}`;
    const p = playing(seed, null, full);
    for (let i = 0; i < 2000; i++) p.render();
    // Back to a step no phrase line is on: 2 bars, 1 beat and a step in.
    const target = 2 * 16 + 5;
    const asked = p.now();
    check(`${label}: the step asked is taken`, p.x.dl_play_jump(JUMP.step, target) === 1);
    let jump = null;
    let worst = 0;
    for (let i = 0; i < 400 && !jump; i++) {
      const { us, out } = p.render();
      worst = Math.max(worst, us);
      jump = out.find((e) => e.kind === KIND.jump) || null;
    }
    const heard = jump ? jump.time - asked : Infinity;
    check(`${label}: playing, it lands on step ${target} (${jump && jump.step}), heard within 0.06 s (${heard.toFixed(4)} s)`, jump && jump.step === target && heard < 0.06);
    for (let i = 0; i < 1000; i++) worst = Math.max(worst, p.render().us);
    check(`${label}: no late note, none missed; its busiest block ${Math.round(worst)} us, room for the slow case`, p.x.dl_late() === 0 && p.x.dl_missed() === 0 && worst + BURN_US < DEADLINE_US, `late ${p.x.dl_late()} missed ${p.x.dl_missed()}`);
    // Paused: held, the place says it, nothing lands until Play.
    p.x.dl_play_stop();
    for (let i = 0; i < 100; i++) p.render();
    const held = 5 * 16 + 3;
    check(`${label}: paused, the step asked is taken`, p.x.dl_play_jump(JUMP.step, held) === 1);
    const placed = p.x.dl_play_place() === 1;
    const [bar] = new Float64Array(p.x.memory.buffer, p.x.dl_play_place_at(), 5);
    let early = false;
    for (let i = 0; i < 200; i++) early = early || p.render().out.some((e) => e.kind === KIND.jump);
    const resumed = p.now();
    p.x.dl_play_resume(0);
    jump = null;
    for (let i = 0; i < 400 && !jump; i++) jump = p.render().out.find((e) => e.kind === KIND.jump) || null;
    const after = jump ? jump.time - resumed : Infinity;
    check(`${label}: paused, the place says where Play goes on from (bar ${bar.toFixed(2)}), nothing lands before Play`, placed && bar > 0 && !early);
    check(`${label}: Play goes on from step ${held} (${jump && jump.step}), heard within 0.06 s (${after.toFixed(4)} s)`, jump && jump.step === held && after < 0.06);
  }
}

console.log('Twenty jumps back and forth');
{
  const p = playing(LOOPS[2], 32768, true);
  for (let i = 0; i < 1000; i++) p.render();
  let worst = 0;
  let jumps = 0;
  for (let j = 0; j < 20; j++) {
    const to = j % 2 ? { kind: JUMP.section, at: 40 + 7 * j } : { kind: JUMP.bar, at: 3 * j };
    p.x.dl_play_jump(to.kind, to.at);
    for (let i = 0; i < 300; i++) {
      const { out } = p.render();
      jumps += out.filter((e) => e.kind === KIND.jump).length;
    }
  }
  // Then the loop alone: the core's notes no more than playing holds.
  for (let i = 0; i < 2000; i++) {
    p.render();
    worst = Math.max(worst, p.x.dl_busy());
  }
  check(`twenty jumps, twenty landed (${jumps})`, jumps === 20);
  check('no late note, none missed', p.x.dl_late() === 0 && p.x.dl_missed() === 0);
  const alone = playing(LOOPS[2], 32768, true);
  let own = 0;
  for (let i = 0; i < 9000; i++) {
    alone.render();
    if (i > 7000) own = Math.max(own, alone.x.dl_busy());
  }
  check(`nothing left ringing: the core's busiest after them (${worst} voices) no more than the loop alone (${own}) and a few`, worst <= own + 4);
}

console.log('The piece\'s map for the page, against the plan');
{
  G.open();
  for (const seed of LOOPS) {
    const request = 'bars=32768';
    const spec = newSpec(seed, request);
    const t0 = performance.now();
    const movements = pieceMarks(spec, { coarse: true });
    const ms = performance.now() - t0;
    check(`${seed}: the whole piece's movements (${movements.length}) in ${ms.toFixed(1)} ms`, movements.length > 0 && movements.length < 2048 && ms < 200);
    const from = 300;
    const marks = pieceMarks(spec, { from, count: 24 });
    // The plan of the loop the page's record asks for: its request and a
    // code's edits (each layer's seed, the tone, the tempo), which the plan
    // reads as the core that plays does.
    const map = G.pieceMap(seed, G.askText(spec), from, 24);
    // Each mark is a unit of the map, at its bar, as the plan says it is; and
    // every unit the marks pass over is the mark's role, theme and key.
    let bar = from * map.form.sectionBars;
    let i = -1;
    let ok = true;
    for (const u of map.units) {
      if (i + 1 < marks.length && marks[i + 1].section === u.section && marks[i + 1].bar === bar) i++;
      const m = marks[i];
      const theme = typeof u.theme === 'string' ? u.theme : u.theme && u.theme.recall != null ? 'recall' : String(u.theme);
      // A wander's units have no movement (a wander is one: the core's `full`).
      if (!m || m.role !== u.role || m.relation !== u.key.relation || m.movement !== (u.movement || 'full') || (theme !== 'recall' && m.theme !== theme)) {
        ok = false;
        console.log('   ', JSON.stringify(m), JSON.stringify({ section: u.section, bar, role: u.role, theme: u.theme, key: u.key, movement: u.movement }));
        break;
      }
      bar += u.bars;
    }
    check(`${seed}: ${marks.length} marks over 24 sections, each the plan's unit`, ok && marks.length > 0 && marks[0].bar === from * map.form.sectionBars);
  }
}

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall passed');
