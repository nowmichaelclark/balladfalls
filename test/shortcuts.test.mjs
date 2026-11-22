// The keyboard's shortcuts (session 30f; Mikey, 2026-11-22), with no browser.
// Run with:  node test/shortcuts.test.mjs
//
// What it pins down: each chord does its one thing on any layout, and every
// other modifier with those keys, and every bare character, does nothing.

import { shortcutOf, keyNames, onMac } from '../js/shortcuts.js';

let failures = 0;
function check(label, got, want) {
  console.log(got === want ? `  pass  ${label}` : `  FAIL  ${label}: ${got}, not ${want}`);
  if (got !== want) failures++;
}

const ev = (code, key, mods = '', more = {}) => ({
  code, key, altKey: mods.includes('A'), shiftKey: mods.includes('S'), ctrlKey: mods.includes('C'), metaKey: mods.includes('M'), ...more,
});

const cases = [
  ['Next', ev('ArrowRight', 'ArrowRight', 'AS'), false, 'next'],
  ['Previous', ev('ArrowLeft', 'ArrowLeft', 'AS'), false, 'previous'],
  ['Next on a Mac (Option+Shift)', ev('ArrowRight', 'ArrowRight', 'AS'), true, 'next'],
  ['Save, Alt+Shift+S', ev('KeyS', 'S', 'AS'), false, 'save'],
  ['Save, Option+Shift+S, whose character Option changes', ev('KeyS', 'Í', 'AS'), true, 'save'],
  ['Save, Ctrl+S', ev('KeyS', 's', 'C'), false, 'save'],
  ['Save, Ctrl+S with caps lock', ev('KeyS', 'S', 'C'), false, 'save'],
  ['Save, Cmd+S', ev('KeyS', 's', 'M'), true, 'save'],
  ['Save, Ctrl+S on a Thai layout', ev('KeyS', 'ห', 'C'), false, 'save'],
  ['Save, Ctrl+S on Dvorak', ev('Semicolon', 's', 'C'), false, 'save'],
  ['Ctrl+O on Dvorak stays the browser\'s', ev('KeyS', 'o', 'C'), false, null],
  ['Ctrl+S on a Mac is not Save', ev('KeyS', 's', 'C'), true, null],
  ['Meta+S off a Mac is not Save', ev('KeyS', 's', 'M'), false, null],
  ['Ctrl+Shift+S stays Firefox\'s screenshot', ev('KeyS', 'S', 'CS'), false, null],
  ['Alt+Shift+B stays Edge\'s', ev('KeyB', 'B', 'AS'), false, null],
  ['Alt+Right stays the browser\'s Forward', ev('ArrowRight', 'ArrowRight', 'A'), false, null],
  ['Shift+Right stays a selection\'s', ev('ArrowRight', 'ArrowRight', 'S'), false, null],
  ['composing', ev('KeyS', 's', 'C', { isComposing: true }), false, null],
  ['Alt+Shift+6', ev('Digit6', '^', 'AS'), false, null],
  ['Alt+Shift with the number pad', ev('Numpad1', '1', 'AS'), false, null],
];
for (let n = 1; n <= 5; n++) {
  cases.push([`roll ${n}`, ev(`Digit${n}`, '!@#$%'[n - 1], 'AS'), false, `roll${n - 1}`]);
  cases.push([`roll ${n}, AZERTY`, ev(`Digit${n}`, String(n), 'AS'), false, `roll${n - 1}`]);
  cases.push([`Alt+${n} stays Firefox's tab`, ev(`Digit${n}`, String(n), 'A'), false, null]);
  cases.push([`Ctrl+${n} stays the browser's tab`, ev(`Digit${n}`, String(n), 'C'), false, null]);
}
// The old keys, alone, with Shift, as AltGr, and with all four modifiers.
const olds = [['KeyN', 'n'], ['KeyS', 's'], ...[1, 2, 3, 4, 5].map((n) => [`Digit${n}`, String(n)])];
for (const [code, key] of olds) {
  for (const mods of ['', 'S', 'CA', 'CAS', 'ACMS']) {
    for (const mac of [false, true]) cases.push([`${mods || 'bare'} ${key}${mac ? ', Mac' : ''}`, ev(code, key, mods), mac, null]);
  }
}
for (const [label, e, mac, want] of cases) check(label, shortcutOf(e, mac), want);

check('a Mac', onMac({ platform: 'MacIntel' }), true);
check('Windows', onMac({ platform: 'Win32' }), false);
check('Android', onMac({ platform: 'Linux armv8l' }), false);
check('a Mac\'s names', keyNames('Ctrl+S, or Alt+Shift+S', true), 'Cmd+S, or Option+Shift+S');
check('the others\' names', keyNames('Ctrl+S', false), 'Ctrl+S');

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nAll good.');
