// The safe area's insets and the bar that scrolls away (session 30f;
// Mikey, 2026-11-22), with no browser.
// Run with:  node test/viewport.test.mjs
//
// What it pins down: insets a browser already laid the page clear of are
// not counted twice, and real ones (a notch, edge to edge, the installed
// app) are never lost; the bar scrolls away in a touch browser's tab alone.

import { outsideInsets, scrollsBarAway } from '../js/viewport.js';

let failures = 0;
function check(label, condition, detail = '') {
  console.log(condition ? `  pass  ${label}` : `  FAIL  ${label} ${detail}`);
  if (!condition) failures++;
}

// [top, right, bottom, left]; the sides taken back.
const gone = (insets, screen, page) => {
  const [top, right, bottom, left] = insets;
  const out = outsideInsets({ top, right, bottom, left }, { width: screen[0], height: screen[1] }, { width: page[0], height: page[1] });
  return ['top', 'right', 'bottom', 'left'].filter((s) => out[s]).join(',');
};
const cases = [
  ['no insets', [0, 0, 0, 0], [895, 393], [804, 303], ''],
  ['Mikey\'s phone sideways: the status bar\'s and the navigation bar\'s, both outside', [25, 49, 0, 0], [895, 393], [804, 303], 'top,right'],
  ['the same with the address bar away', [25, 49, 0, 0], [895, 393], [804, 368], 'top,right'],
  ['the same turned the other way', [25, 0, 0, 49], [895, 393], [804, 303], 'top,left'],
  ['upright, the window\'s top and bottom reported, both outside', [42, 0, 48, 0], [393, 895], [393, 749], 'top,bottom'],
  ['an iPhone sideways: the notch both sides and the home bar are inside', [0, 59, 21, 59], [852, 393], [852, 343], ''],
  ['an iPhone\'s installed app upright: the page covers the screen', [59, 0, 34, 0], [393, 852], [393, 852], ''],
  ['edge to edge upright: the gesture bar is inside, the address bar is not', [0, 0, 24, 0], [393, 873], [393, 785], ''],
  ['edge to edge sideways: the bar at the side is inside', [0, 49, 0, 0], [895, 393], [895, 337], ''],
  ['a cutout outside and the bar inside: the bar stays', [0, 49, 0, 0], [895, 393], [853, 337], ''],
  ['a cutout reported and already outside', [0, 0, 0, 42], [895, 393], [853, 337], 'left'],
  ['the installed app, edge to edge: everything inside', [25, 49, 0, 42], [895, 393], [895, 393], ''],
  ['a rounded pixel apart is still outside', [25, 49, 0, 0], [894, 392], [846, 368], 'top,right'],
];
for (const [name, insets, screen, page, want] of cases) {
  const got = gone(insets, screen, page);
  check(name, got === want, `(took back "${got}", wanted "${want}")`);
}

const tab = { app: false, installed: false, touch: true, dvh: true };
check('a phone browser\'s tab: a scroll puts the bar away', scrollsBarAway(tab));
check('the Android app: no scroll', !scrollsBarAway({ ...tab, app: true }));
check('installed: no scroll', !scrollsBarAway({ ...tab, installed: true }));
check('a mouse: no scroll', !scrollsBarAway({ ...tab, touch: false }));
check('a browser without dvh: no scroll', !scrollsBarAway({ ...tab, dvh: false }));

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nAll good.');
