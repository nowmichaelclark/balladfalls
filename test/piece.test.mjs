// A long piece on screen (session 18, queue item 106b): the journey pick as
// the request's journey and what the core does with it, the map the line
// draws (whole, for a finite piece; a window, for Endless), the markers on
// their pixels, the sections either side of a place, and the words the
// Library and Now Playing use. The core is the app's module, as the page
// reads it. Run with:  node test/piece.test.mjs

import { newSpec, pieceMarks, render } from '../js/gen.js';
import { askOf, parseRequest, readRequest, requestText, RequestError, journeyNumber } from '../js/request.js';
import { cleanPicks, journeyFor, requestFor, lengthText } from '../js/picks.js';
import { columns, isLong, joinCalls, markAt, modelNow, neighbor, placeWords, windowOf, barAt, xOf, clock, WINDOW } from '../js/piece.js';
import { lengthLine } from '../js/ui.js';

let failures = 0;
function check(label, condition, detail = '') {
  console.log(condition ? `  pass  ${label}` : `  FAIL  ${label} ${detail}`);
  if (!condition) failures++;
}
const SEED = 20261009;

console.log('\nThe journey in the request');
{
  const r = parseRequest('bars=512,journey=wander');
  check('text: journey=wander is read', r.journey === 'wander' && r.length === 512);
  check('text: written again, read the same', requestText(r) === 'bars=512,journey=wander' && readRequest(requestText(r)).journey === 'wander');
  check('an object carries it', readRequest({ length: 64, journey: 'arc' }).journey === 'arc');
  let refused = null;
  try { parseRequest('journey=symphony'); } catch (e) { refused = e; }
  check('a journey that is neither is refused with the core\'s line', refused instanceof RequestError && refused.message === 'no such journey');
  check('the numbers the core takes', journeyNumber('arc') === 1 && journeyNumber('wander') === 2 && journeyNumber(null) === 0);
  const spec = newSpec(SEED, 'bars=512,journey=wander');
  check('the spec keeps what was asked, and asks it again', spec.askJourney === 'wander' && askOf(spec).journey === 2 && requestText(readRequest({ length: spec.length, journey: spec.askJourney })) === 'bars=512,journey=wander');
}

console.log('\nWhat the core does with it');
{
  const roles = (req) => new Set(pieceMarks(newSpec(SEED, req)).map((m) => m.role));
  const arc = roles('bars=512,journey=arc');
  const wander = roles('bars=512,journey=wander');
  check('an arc has its peak and its return', arc.has('peak') && arc.has('return') && arc.has('close'), [...arc].join());
  check('a wander has holds and turns and no peak', wander.has('holding') && wander.has('turning') && !wander.has('peak'), [...wander].join());
  check('left to chance it draws one of its own', pieceMarks(newSpec(SEED, 'bars=512')) !== null);
  check('a loop of up to 32 bars has no map, whatever is asked', pieceMarks(newSpec(SEED, 'bars=24,journey=arc')) === null);
}

console.log('\nThe picks');
{
  check('cleaned: arc and wander kept, nothing else', cleanPicks({ journey: 'arc' }).journey === 'arc' && cleanPicks({ journey: 'wander' }).journey === 'wander'
    && cleanPicks({ journey: 'dance' }).journey === null && cleanPicks({}).journey === null);
  check('asked only of a long piece: 33 bars and more, or Endless', journeyFor({ length: 32, journey: 'arc' }) === null && journeyFor({ length: 33, journey: 'arc' }) === 'arc'
    && journeyFor({ length: 'endless', journey: 'wander' }) === 'wander' && journeyFor({ length: null, journey: 'arc' }) === null && journeyFor({ length: 4096, journey: null }) === null);
  const state = { vibes: [], picks: cleanPicks({ length: 1024, journey: 'wander' }) };
  check('sent as the request\'s journey', requestFor(state).journey === 'wander' && requestFor({ vibes: [], picks: cleanPicks({ length: 8, journey: 'wander' }) }).journey === null);
  check('the pill\'s words', lengthText(1024).replace(/\u00a0/g, ' ') === '1,024 bars');
}

console.log('\nThe map for the line');
for (const [req, whole] of [['bars=3072,journey=arc', 3072], ['bars=32768,journey=arc', 32768], ['bars=32768,journey=wander', 32768], ['bars=40,journey=arc', 40], ['bars=1000000,journey=arc', 1e6]]) {
  const spec = newSpec(SEED, req);
  const t = performance.now();
  const model = modelNow(spec);
  const took = performance.now() - t;
  const marks = model && model.marks;
  const ordered = marks && marks.every((m, i) => i === 0 || m.bar > marks[i - 1].bar);
  check(`${req}: whole, in order, from the first bar to the close`, model && !model.endless && model.last === whole && marks[0].bar === 0 && ordered && marks[marks.length - 1].bar < whole,
    `${marks && marks.length} marks, last at ${marks && marks[marks.length - 1].bar}`);
  // The picker's longest is 32,768 bars; a code may carry more, and its map is then asked in more calls, each its own task.
  check(`${req}: made in under 100 ms (${took.toFixed(0)} ms, ${marks && marks.length} marks)`, whole > 32768 || took < 100);
}
{
  // Past one call's 2,048 marks the calls join with nothing twice and nothing lost.
  const spec = newSpec(SEED, 'bars=32768,journey=arc');
  const model = modelNow(spec);
  const sections = Math.ceil(spec.length / spec.bars);
  const byOne = pieceMarks(spec, { from: 0, count: sections });
  check('a 32,768-bar arc is more than one call, and joined it reaches past the first call\'s end', model.marks.length > byOne.length && byOne.length === 2048 && model.marks[model.marks.length - 1].bar > byOne[byOne.length - 1].bar);
  const seen = new Set(model.marks.map((m) => m.bar));
  check('no bar twice', seen.size === model.marks.length);
  check('the joins add what one window of the same sections gives', (() => {
    const from = model.marks.find((m) => m.bar > 25000).section;
    const win = pieceMarks(spec, { from, count: 30 });
    const ours = model.marks.filter((m) => m.section >= from && m.section < from + 30).map((m) => m.bar);
    return win.slice(1).every((m) => ours.includes(m.bar)) && win.every((m) => ours.includes(m.bar) || m.bar === win[0].bar);
  })());
  check('the fixed unit of joining, on a stub', (() => {
    const calls = [];
    const stub = (from) => { calls.push(from); return from === 0 ? Array.from({ length: 2048 }, (_, i) => ({ bar: i, section: i >> 1 })) : [{ bar: 2047, section: 1023 }, { bar: 2048, section: 1024 }, { bar: 2049, section: 1024 }]; };
    const out = joinCalls(stub);
    return calls.join() === '0,1023' && out.length === 2050 && out[2049].bar === 2049;
  })());
}
{
  const spec = newSpec(SEED, 'bars=endless,journey=arc');
  check('Endless: a window of sections around the playhead, not the whole', (() => {
    const a = modelNow(spec, 3);
    const b = modelNow(spec, 200);
    return a.endless && a.window === 0 && a.first === 0 && a.last === WINDOW * spec.bars && b.window === 192 && b.first === 192 * spec.bars
      && b.marks[0].bar >= b.first && b.marks.every((m) => m.bar >= b.first && m.bar < b.last);
  })());
  check('the window moves seldom: half a window at a time', windowOf(spec, 40).start === 32 && windowOf(spec, 59).start === 32 && windowOf(spec, 71).start === 32 && windowOf(spec, 72).start === 64 && windowOf(spec, 0).start === 0 && windowOf(spec, 8).start === 0 && windowOf(spec, 40).start === 32);
}

console.log('\nWhere the playhead is');
{
  const spec = newSpec(SEED, 'bars=512,journey=arc');
  const model = modelNow(spec);
  const peak = model.marks.find((m) => m.role === 'peak');
  check('the unit at a place: the mark at or before it', markAt(model, peak.bar).role === 'peak' && markAt(model, peak.bar + 0.5).role === 'peak' && markAt(model, 0).role === 'opening');
  const next = neighbor(model, peak.bar, 1);
  const prev = neighbor(model, peak.bar + 3, -1);
  check('the section after, and before from more than a couple of bars in', next.bar > peak.bar && prev.bar === peak.bar);
  check('before, from near a mark\'s start, is the one before it', neighbor(model, peak.bar + 1, -1).bar < peak.bar && neighbor(model, peak.bar + 2, -1).bar < peak.bar);
  check('none before the first, none after the last', neighbor(model, 0, -1) === null && neighbor(model, model.marks[model.marks.length - 1].bar, 1) === null);
  const words = placeWords(model, { bar: 811.4, bars: 3072, played: 4323.2, left: 7800, section: 50 });
  check('the words: bar 812 of 3,072, time played and time left', words.bars === 'bar 812 of 3,072' && words.times === '1:12:03 played · 2:10:00 left', JSON.stringify(words));
  const endless = placeWords(modelNow(newSpec(SEED, 'bars=endless,journey=wander')), { bar: 811.4, bars: null, played: 4323.2, left: null, section: 50 });
  check('Endless: time played, no time left', endless.bars === 'bar 812' && endless.times === '1:12:03 played', JSON.stringify(endless));
  check('a clock past a day: 27:18:00', clock(27 * 3600 + 18 * 60) === '27:18:00' && clock(247) === '4:07');
}

console.log('\nThe markers on their pixels');
{
  const spec = newSpec(SEED, 'bars=32768,journey=arc');
  const model = modelNow(spec);
  const { heights, roles } = columns(model, 300);
  const drawn = [...roles].filter(Boolean);
  check('every drawn tick is one of the markers, one a pixel at most, none out of range', heights.length === 300 && drawn.every((r) => ['opening', 'second', 'peak', 'return', 'close', 'turning'].includes(r)));
  const { dense } = columns(model, 300);
  check('a crowded piece keeps the openings, the peaks and the close', dense && drawn.every((r) => ['opening', 'peak', 'close', 'turning'].includes(r)) && drawn.includes('peak') && drawn.includes('opening'));
  const small = modelNow(newSpec(SEED, 'bars=256,journey=arc'));
  const sc = columns(small, 300);
  const want = new Set(small.marks.filter((m) => ['peak', 'return', 'close', 'second', 'opening'].includes(m.role)).map((m) => Math.min(299, Math.floor(xOf(small, m.bar, 300)))));
  const got = new Set(sc.heights.map((h, i) => (h ? i : -1)).filter((i) => i >= 0));
  check('a short piece draws every marker: the pixels with ticks are the map\'s marks\' pixels', !sc.dense && want.size === got.size && [...want].every((x) => got.has(x)), `${want.size} / ${got.size}`);
  const wanderModel = modelNow(newSpec(SEED, 'bars=32768,journey=wander'));
  const wc = columns(wanderModel, 300);
  const turned = [...wc.roles].filter((r) => r === 'turning').length;
  check('a crowded wander shows some of its turns, thinned, and the close', wc.dense && turned > 20 && turned < 150 && wc.roles[299] === 'close', `${turned} turns`);
  check('the peak and the close are the tallest', Math.max(...heights) === 1 && heights[Math.min(299, Math.floor(xOf(model, model.marks[model.marks.length - 1].bar, 300)))] === 1);
  const t = performance.now();
  for (let i = 0; i < 200; i++) columns(model, 360);
  check(`drawn cheaply: ${((performance.now() - t) / 200).toFixed(2)} ms for the whole of a 32,768-bar piece`, (performance.now() - t) / 200 < 5);
  check('a pixel and its bar, both ways', Math.abs(barAt(model, xOf(model, 16384, 300), 300) - 16384) < 1e-6 && barAt(model, -5, 300) === 0 && barAt(model, 400, 300) === 32768);
  check('long from 33 bars or Endless; a loop is not', isLong(spec) && isLong({ length: 'endless' }) && !isLong({ length: 32 }) && !isLong({ length: null }) && !isLong(null));
}

console.log('\nThe Library\'s line');
{
  // (A space that does not break between the number and its unit.)
  const at = (length, bars = 16, bpm = 74) => lengthLine({ length, bars, bpm, stepsPerBar: 16 }).replace(/\u00a0/g, ' ');
  check('a loop with no length asked: its own bars', at(null) === '16 bars' && lengthLine({ bars: 1, bpm: 74 }).replace(/\u00a0/g, ' ') === '1 bar');
  check('4 bars, with its time', at(4) === '4 bars · 13s', at(4));
  check('a long one: bars and hours', at(3072) === '3,072 bars · 1h 3m' || /^3,072 bars · \d+h \d+m$/.test(at(3072)), at(3072));
  check('the longest: 32,768 bars, about a day, in hours', /^32,768 bars · \d+h( \d+m)?$/.test(at(32768, 16, 88)) && at(32768, 16, 70) === '32,768 bars · 31h', at(32768, 16, 88) + ' / ' + at(32768, 16, 70));
  check('Endless', at('endless') === 'endless');
}

console.log(failures ? `\n${failures} failed` : '\nAll good.');
process.exit(failures ? 1 : 0);
