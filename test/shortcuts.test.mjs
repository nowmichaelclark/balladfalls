// The keyboard (Mikey, 2026-11-23), with no browser.
// Run with:  node test/shortcuts.test.mjs
//
// What it pins down: every key of a keyboard, alone and with Shift, on
// QWERTY, Dvorak, AZERTY and Thai (a layout with no Latin letters), on a
// Mac and off it, with the letter keys on and off, does what the map at the
// top of js/shortcuts.js says and nothing else; every key with Ctrl, Alt,
// Meta or AltGr does nothing but Save; and a control keeps its own keys.

import { shortcutOf, keeps, keyList, keyNames, onMac, VIEW_KEYS, REPEATS } from '../js/shortcuts.js';

let failures = 0;
let passes = 0;
function check(label, got, want) {
  if (got === want) {
    passes++;
    return;
  }
  console.log(`  FAIL  ${label}: ${got}, not ${want}`);
  failures++;
}

// Every key a computer's keyboard has, by its place (QWERTY's names).
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => `Key${c}`);
const DIGITS = '1234567890'.split('').map((d) => `Digit${d}`);
const PUNCT = ['Backquote', 'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Backslash', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash', 'IntlBackslash'];
const OTHERS = ['Space', 'Escape', 'Enter', 'Tab', 'Backspace', 'Delete', 'Insert', 'Home', 'End', 'PageUp', 'PageDown',
  'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'CapsLock', 'ContextMenu', 'PrintScreen', 'ScrollLock', 'Pause',
  ...Array.from({ length: 12 }, (_, i) => `F${i + 1}`),
  ...'0123456789'.split('').map((d) => `Numpad${d}`), 'NumpadAdd', 'NumpadSubtract', 'NumpadMultiply', 'NumpadDivide', 'NumpadDecimal', 'NumpadEnter',
  'MediaPlayPause', 'MediaTrackNext', 'MediaTrackPrevious', 'AudioVolumeUp', 'AudioVolumeDown', 'AudioVolumeMute'];
const CODES = [...LETTERS, ...DIGITS, ...PUNCT, ...OTHERS];

// What a key types: [bare, with Shift], by layout. The keys whose name
// isn't a character are the same on all of them.
const QWERTY_PUNCT = {
  Backquote: '`~', Minus: '-_', Equal: '=+', BracketLeft: '[{', BracketRight: ']}', Backslash: '\\|', Semicolon: ';:', Quote: '\'"',
  Comma: ',<', Period: '.>', Slash: '/?', IntlBackslash: '\\|',
};
const SHIFTED_DIGITS = '!@#$%^&*()';
const NAMED = {
  Space: ' ', Escape: 'Escape', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert', Home: 'Home',
  End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', ArrowRight: 'ArrowRight', ArrowLeft: 'ArrowLeft', ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown',
  CapsLock: 'CapsLock', ContextMenu: 'ContextMenu', PrintScreen: 'PrintScreen', ScrollLock: 'ScrollLock', Pause: 'Pause',
  NumpadAdd: '+', NumpadSubtract: '-', NumpadMultiply: '*', NumpadDivide: '/', NumpadDecimal: '.', NumpadEnter: 'Enter',
  MediaPlayPause: 'MediaPlayPause', MediaTrackNext: 'MediaTrackNext', MediaTrackPrevious: 'MediaTrackPrevious',
  AudioVolumeUp: 'AudioVolumeUp', AudioVolumeDown: 'AudioVolumeDown', AudioVolumeMute: 'AudioVolumeMute',
};
function named(code, shift) {
  if (NAMED[code]) return NAMED[code];
  if (/^F\d+$/.test(code)) return code;
  const pad = /^Numpad(\d)$/.exec(code);
  // The number pad's digits, with Num Lock on; Shift turns them into its
  // other keys (End, the arrows), as Num Lock off does.
  if (pad) return shift ? ['Insert', 'End', 'ArrowDown', 'PageDown', 'ArrowLeft', 'Clear', 'ArrowRight', 'Home', 'ArrowUp', 'PageUp'][pad[1]] : pad[1];
  return null;
}
const qwerty = (code, shift) => {
  const n = named(code, shift);
  if (n) return n;
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return shift ? letter[1] : letter[1].toLowerCase();
  const digit = /^Digit(\d)$/.exec(code);
  if (digit) return shift ? SHIFTED_DIGITS['1234567890'.indexOf(digit[1])] : digit[1];
  return QWERTY_PUNCT[code][shift ? 1 : 0];
};
// Dvorak: the letters and the punctuation moved; QWERTY's place -> Dvorak's
// character (bare; Shift is its capital, or the pair's other).
const DVORAK = {
  KeyQ: '\'"', KeyW: ',<', KeyE: '.>', KeyR: 'pP', KeyT: 'yY', KeyY: 'fF', KeyU: 'gG', KeyI: 'cC', KeyO: 'rR', KeyP: 'lL',
  BracketLeft: '/?', BracketRight: '=+', KeyA: 'aA', KeyS: 'oO', KeyD: 'eE', KeyF: 'uU', KeyG: 'iI', KeyH: 'dD', KeyJ: 'hH',
  KeyK: 'tT', KeyL: 'nN', Semicolon: 'sS', Quote: '-_', KeyZ: ';:', KeyX: 'qQ', KeyC: 'jJ', KeyV: 'kK', KeyB: 'xX', KeyN: 'bB',
  KeyM: 'mM', Comma: 'wW', Period: 'vV', Slash: 'zZ', Minus: '[{', Equal: ']}',
};
const dvorak = (code, shift) => (DVORAK[code] ? DVORAK[code][shift ? 1 : 0] : qwerty(code, shift));
// AZERTY (French): A and Q, Z and W swapped, M where QWERTY has ;, the
// digits the shifted ones, ? on Shift with QWERTY's M.
const AZERTY = {
  KeyQ: 'aA', KeyA: 'qQ', KeyW: 'zZ', KeyZ: 'wW', Semicolon: 'mM', KeyM: ',?', Comma: ';.', Period: ':/', Slash: '!§',
  Digit1: '&1', Digit2: 'é2', Digit3: '"3', Digit4: '\'4', Digit5: '(5', Digit6: '-6', Digit7: 'è7', Digit8: '_8', Digit9: 'ç9', Digit0: 'à0',
};
const azerty = (code, shift) => (AZERTY[code] ? AZERTY[code][shift ? 1 : 0] : qwerty(code, shift));
// Thai (Kedmanee): no Latin letter anywhere; the digits' row types Thai and
// a few marks, Shift with / types ฦ.
const THAI_LETTERS = {
  Q: 'ๆ', W: 'ไ', E: 'ำ', R: 'พ', T: 'ะ', Y: 'ั', U: 'ี', I: 'ร', O: 'น', P: 'ย', A: 'ฟ', S: 'ห', D: 'ก', F: 'ด', G: 'เ',
  H: '้', J: '่', K: 'า', L: 'ส', Z: 'ผ', X: 'ป', C: 'แ', V: 'อ', B: 'ิ', N: 'ื', M: 'ท',
};
const THAI_SHIFT = {
  Q: '๐', W: '"', E: 'ฎ', R: 'ฑ', T: 'ธ', Y: 'ํ', U: '๊', I: 'ณ', O: 'ฯ', P: 'ญ', A: 'ฤ', S: 'ฆ', D: 'ฏ', F: 'โ', G: 'ฌ',
  H: '็', J: '๋', K: 'ษ', L: 'ศ', Z: '(', X: ')', C: 'ฉ', V: 'ฮ', B: 'ฺ', N: '์', M: '?',
};
const THAI_DIGITS = ['ๅ+', '/๑', '-๒', 'ภ๓', 'ถ๔', 'ุู', 'ึ฿', 'ค๕', 'ต๖', 'จ๗'];
const THAI_PUNCT = { Backquote: '_%', Minus: 'ข๘', Equal: 'ช๙', BracketLeft: 'บฐ', BracketRight: 'ล,', Backslash: 'ฃฅ', Semicolon: 'วซ', Quote: 'ง.', Comma: 'มฒ', Period: 'ใฬ', Slash: 'ฝฦ', IntlBackslash: 'ฃฅ' };
const thai = (code, shift) => {
  const n = named(code, shift);
  if (n) return n;
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return (shift ? THAI_SHIFT : THAI_LETTERS)[letter[1]];
  const digit = /^Digit(\d)$/.exec(code);
  if (digit) return THAI_DIGITS['1234567890'.indexOf(digit[1])][shift ? 1 : 0];
  return THAI_PUNCT[code][shift ? 1 : 0];
};
const LAYOUTS = { qwerty, dvorak, azerty, thai };

// What the map says, written from the characters each layout types (not
// from js/shortcuts.js's own code): the oracle.
const BY_LETTER = Object.fromEntries([...VIEW_KEYS.map(([k, v]) => [k, `view:${v}`]), ['k', 'play'], ['m', 'mute'], ['r', 'rollAll']]);
function expected(layout, code, shift, letters) {
  const key = LAYOUTS[layout](code, shift);
  const plain = {
    Space: 'play', Escape: 'close', ArrowRight: 'next', ArrowLeft: 'previous', ArrowUp: 'louder', ArrowDown: 'quieter',
    MediaPlayPause: 'play', MediaTrackNext: 'next', MediaTrackPrevious: 'previous',
  };
  if (!shift && plain[code]) return plain[code];
  if (shift && code === 'ArrowRight') return 'seekAhead';
  if (shift && code === 'ArrowLeft') return 'seekBack';
  if (!letters) return null;
  if (key === '?') return 'keys';
  // Thai types no ?: the place of QWERTY's.
  if (layout === 'thai' && shift && code === 'Slash') return 'keys';
  const digit = /^Digit([1-5])$/.exec(code);
  if (digit) return `${shift ? 'layer' : 'roll'}${digit[1] - 1}`;
  const pad = /^Numpad([1-5])$/.exec(code);
  if (pad && !shift) return `roll${pad[1] - 1}`;
  if (shift) return null;
  if (layout === 'thai') {
    const place = /^Key([A-Z])$/.exec(code);
    return place ? BY_LETTER[place[1].toLowerCase()] || null : null;
  }
  return /^[a-z]$/.test(key) ? BY_LETTER[key] || null : null;
}

const ev = (code, key, mods = '', more = {}) => ({
  code, key, altKey: mods.includes('A'), shiftKey: mods.includes('S'), ctrlKey: mods.includes('C'), metaKey: mods.includes('M'), ...more,
});

// 1. Every key, alone and with Shift, on every layout, a Mac and not, the
// switch on and off.
let acted = 0;
for (const layout of Object.keys(LAYOUTS)) {
  for (const code of CODES) {
    for (const shift of [false, true]) {
      for (const mac of [false, true]) {
        for (const letters of [true, false]) {
          const key = LAYOUTS[layout](code, shift);
          const got = shortcutOf(ev(code, key, shift ? 'S' : ''), mac, letters);
          const want = expected(layout, code, shift, letters);
          if (got) acted++;
          check(`${layout} ${shift ? 'Shift+' : ''}${code} (${key})${mac ? ', Mac' : ''}${letters ? '' : ', letter keys off'}`, got, want);
        }
      }
    }
  }
}

// 2. With any of Ctrl, Alt (Option), Meta (Cmd), or AltGr (Ctrl+Alt): only
// Save, Ctrl+S off a Mac and Cmd+S on one, whichever key types s.
for (const layout of Object.keys(LAYOUTS)) {
  for (const code of CODES) {
    for (const mods of ['C', 'A', 'M', 'CA', 'CS', 'AS', 'MS', 'CAS', 'CAMS']) {
      for (const mac of [false, true]) {
        const key = LAYOUTS[layout](code, mods.includes('S'));
        const s = layout === 'thai' ? code === 'KeyS' : key === 's';
        const want = s && ((mods === 'C' && !mac) || (mods === 'M' && mac)) ? 'save' : null;
        check(`${layout} ${mods}+${code}${mac ? ', Mac' : ''}`, shortcutOf(ev(code, key, mods), mac, true), want);
      }
    }
  }
}

// 3. The points the map makes, by hand.
const cases = [
  ['Right is Next', ev('ArrowRight', 'ArrowRight'), false, true, 'next'],
  ['Left is Previous', ev('ArrowLeft', 'ArrowLeft'), false, true, 'previous'],
  ['Shift+Right moves the playhead on', ev('ArrowRight', 'ArrowRight', 'S'), false, true, 'seekAhead'],
  ['the arrows with the letter keys off', ev('ArrowRight', 'ArrowRight'), false, false, 'next'],
  ['Space with the letter keys off', ev('Space', ' '), false, false, 'play'],
  ['Esc with the letter keys off', ev('Escape', 'Escape'), false, false, 'close'],
  ['Ctrl+S with the letter keys off', ev('KeyS', 's', 'C'), false, false, 'save'],
  ['K is Play (YouTube)', ev('KeyK', 'k'), false, true, 'play'],
  ['K with the letter keys off', ev('KeyK', 'k'), false, false, null],
  ['L is Layers on QWERTY', ev('KeyL', 'l'), false, true, 'view:layers'],
  ['L is Layers on Dvorak, where QWERTY has P', ev('KeyP', 'l'), false, true, 'view:layers'],
  ['QWERTY\'s L place on Dvorak types n: Now playing', ev('KeyL', 'n'), false, true, 'view:now'],
  ['L is Layers on Thai, at QWERTY\'s place', ev('KeyL', 'ส'), false, true, 'view:layers'],
  ['L with caps lock', ev('KeyL', 'L'), false, true, 'view:layers'],
  ['Shift+L does nothing', ev('KeyL', 'L', 'S'), false, true, null],
  ['L on a Mac', ev('KeyL', 'l'), true, true, 'view:layers'],
  ['Option+L on a Mac (¬) does nothing', ev('KeyL', '¬', 'A'), true, true, null],
  ['1 rolls the drums', ev('Digit1', '1'), false, true, 'roll0'],
  ['1 on AZERTY (&) rolls the drums', ev('Digit1', '&'), false, true, 'roll0'],
  ['1 on Thai (ๅ) rolls the drums', ev('Digit1', 'ๅ'), false, true, 'roll0'],
  ['Shift+5 (%) turns air on or off', ev('Digit5', '%', 'S'), false, true, 'layer4'],
  ['the number pad\'s 3 rolls keys', ev('Numpad3', '3'), false, true, 'roll2'],
  ['6 does nothing', ev('Digit6', '6'), false, true, null],
  ['? on QWERTY', ev('Slash', '?', 'S'), false, true, 'keys'],
  ['? on AZERTY, Shift with QWERTY\'s M', ev('KeyM', '?', 'S'), false, true, 'keys'],
  ['? on Thai, Shift with QWERTY\'s /', ev('Slash', 'ฦ', 'S'), false, true, 'keys'],
  ['/ alone does nothing', ev('Slash', '/'), false, true, null],
  ['Ctrl+S', ev('KeyS', 's', 'C'), false, true, 'save'],
  ['Cmd+S on a Mac', ev('KeyS', 's', 'M'), true, true, 'save'],
  ['Ctrl+S on a Mac is the Mac\'s', ev('KeyS', 's', 'C'), true, true, null],
  ['Ctrl+S on Thai', ev('KeyS', 'ห', 'C'), false, true, 'save'],
  ['Ctrl+S on Dvorak', ev('Semicolon', 's', 'C'), false, true, 'save'],
  ['Ctrl+O on Dvorak stays the browser\'s', ev('KeyS', 'o', 'C'), false, true, null],
  ['Ctrl+Shift+S stays Firefox\'s screenshot', ev('KeyS', 'S', 'CS'), false, true, null],
  ['Alt+Shift+Right (the old Next) is the system\'s now', ev('ArrowRight', 'ArrowRight', 'AS'), false, true, null],
  ['Alt+Right stays the browser\'s Forward', ev('ArrowRight', 'ArrowRight', 'A'), false, true, null],
  ['Ctrl+Right stays the system\'s', ev('ArrowRight', 'ArrowRight', 'C'), false, true, null],
  ['the media key Play', ev('MediaPlayPause', 'MediaPlayPause'), false, false, 'play'],
  ['the media key Next', ev('MediaTrackNext', 'MediaTrackNext'), false, false, 'next'],
  ['the media key Previous', ev('MediaTrackPrevious', 'MediaTrackPrevious'), false, false, 'previous'],
  ['composing', ev('KeyL', 'l', '', { isComposing: true }), false, true, null],
  ['an input method\'s key', ev('KeyL', 'Process'), false, true, null],
  ['a dead key', ev('BracketLeft', 'Dead'), false, true, null],
];
for (const [label, e, mac, letters, want] of cases) check(label, shortcutOf(e, mac, letters), want);

// 4. Every view in the map has its own letter, none of K, M, R.
const letters = VIEW_KEYS.map(([k]) => k);
check('a letter a view, each its own', new Set([...letters, 'k', 'm', 'r']).size, letters.length + 3);
check('fifteen views', letters.length, 15);

// 5. What a control keeps (`keeps`, given what `ownKeys` found).
const kept = [
  ['a box to type in keeps L', 'all', ev('KeyL', 'l'), true],
  ['a box to type in keeps Esc (its own clears it)', 'all', ev('Escape', 'Escape'), true],
  ['a slider keeps its arrows', 'arrows', ev('ArrowRight', 'ArrowRight'), true],
  ['a slider keeps Shift with them', 'arrows', ev('ArrowLeft', 'ArrowLeft', 'S'), true],
  ['a slider keeps Home', 'arrows', ev('Home', 'Home'), true],
  ['a slider leaves Space', 'arrows', ev('Space', ' '), false],
  ['a slider leaves L', 'arrows', ev('KeyL', 'l'), false],
  ['a key the keyboard is on keeps Space', 'press', ev('Space', ' '), true],
  ['and Enter', 'press', ev('Enter', 'Enter'), true],
  ['and leaves the arrows', 'press', ev('ArrowRight', 'ArrowRight'), false],
  ['nothing with the focus keeps nothing', null, ev('Space', ' '), false],
];
for (const [label, kind, e, want] of kept) check(label, keeps(kind, e), want);

// 6. Held: only the volume and the playhead go on.
check('what repeats', [...REPEATS].sort().join(), 'louder,quieter,seekAhead,seekBack');

// 7. The list: every row a key and its words, the letter ones marked; a
// Mac's Save named Cmd+S.
const list = keyList(false);
check('the list has every view', list.filter((r) => r.view).length, 15);
check('the list says every key in words', list.every((r) => r.keys && r.said && r.what), true);
check('the list: with the letter keys off, Space, the arrows, Esc, Save', list.filter((r) => !r.letter).map((r) => r.keys).join(' | '), 'Space | → ← | Shift+→ ← | ↑ ↓ | Ctrl+S | Esc');
check('the list on a Mac', keyList(true).some((r) => r.keys === 'Cmd+S'), true);

check('a Mac', onMac({ platform: 'MacIntel' }), true);
check('Windows', onMac({ platform: 'Win32' }), false);
check('Android', onMac({ platform: 'Linux armv8l' }), false);
check('a Mac\'s names', keyNames('Ctrl+S', true), 'Cmd+S');
check('the others\' names', keyNames('Ctrl+S', false), 'Ctrl+S');

console.log(`  ${passes} pass (${acted} key presses acted on)`);
if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nAll good.');
