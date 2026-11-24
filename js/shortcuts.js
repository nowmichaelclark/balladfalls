// The keyboard, as music players have it (session 30n, item 122; Mikey,
// 2026-11-23: "I should be able to press the right arrow key for instance
// and it goes to the next track. Just do industry standards for this", and
// letter keys with a switch in Advanced that turns them off). It replaces
// session 30f's Alt+Shift chords (Alt+Shift is Windows' own key for the
// next input language, so each chord also changed the keyboard's).
//
// The map. Where each key comes from: YT YouTube, SP Spotify (its app and
// the web player), SC SoundCloud, AM Apple Music (the app and the web).
//
//   Space, K        play / pause                  all four; K is YT's
//   Right, Left     next / previous track         Mikey's ask; SP Ctrl+Right,
//                                                 AM Cmd+Right, SC Shift+Right
//   Shift+Right,    the playhead a step on / back SP Shift+Right; YT's arrows
//     Shift+Left    (a bar; a long piece's        and J, L (L is Layers here)
//                   section, as its line's keys)
//   Up, Down        volume up / down, 5%          YT; SP Ctrl+Up, SC Shift+Up
//   M               mute / unmute                 YT, SC
//   R               roll the dice: every layer    (this app's own: its die)
//   1 to 5          roll that layer (its die)     YT's digits seek; these are
//   Shift+1 to 5    that layer on / off           the layers', in their order
//   Esc             back, or close                every player's popups
//   ?               the list of keys, a popup     YT, SC (Shift+/)
//   Ctrl+S, Cmd+S   save to Favorite Loops        a DAW's Save (kept from 30f)
//   the media keys  play / pause, next, previous  every player
//
//   A letter for each view a listener opens: its first letter, or the next
//   of its word that is free (the list shows the word with its letter).
//   N now playing, S sound, L layers, V vibe, D moods, B bars, T track
//   length, P tempo, E key, Y style, O voices, I library, H share,
//   X export, A advanced. A view's letter again goes back, as its key does.
//
// The letter keys switch (Advanced, on by default; WCAG 2.1.4): off, no
// letter, digit or symbol does anything alone (K, M, R, 1 to 5, ?, the
// views'); Space, the arrows, Esc, Ctrl+S and the media keys work either way.
//
// Never while typing (`ownKeys`): a box to type in (a name, a picker's
// typed number) keeps every key; a slider keeps its arrows, Home, End and
// the page keys (they move it); tabs and a radio group keep their arrows;
// a key the keyboard is on keeps Space and Enter (they press it; after a tap
// Space is Play, as a player's is). What a control acted on itself
// (`defaultPrevented`) is never acted on again. Nothing with Ctrl, Alt
// (Option) or Meta (Cmd) but Save: those are the browser's and the system's,
// and AltGr (Ctrl+Alt) is none of the app's.
//
// Layouts. A letter is matched by its character where the layout types
// Latin ones (Dvorak's L is where QWERTY has P, and acts as L), and by its
// place (`code`, QWERTY's) where the key types another script's letter:
// Thai, so the key where QWERTY has L is Layers there. Caps lock is no
// Shift. A digit is matched by its place (Shift changes its character, on
// AZERTY the digits are the shifted ones, on Thai none is a digit); ? by its
// character, else, on such a script, by QWERTY's place (Shift+/). On a Mac
// Option changes a letter's character, and is the system's anyway; Save is
// Cmd+S there, Ctrl+S elsewhere.

export function onMac(nav = globalThis.navigator) {
  return !!nav && /Mac|iP(hone|ad|od)/.test(nav.platform || '');
}

// The views a letter opens, in the list's order: [letter, view, word].
export const VIEW_KEYS = [
  ['n', 'now', 'Now playing'],
  ['s', 'sounds', 'Sound'],
  ['l', 'layers', 'Layers'],
  ['v', 'vibe', 'Vibe'],
  ['d', 'vibes', 'Moods'],
  ['b', 'length', 'Bars'],
  ['t', 'track', 'Track length'],
  ['p', 'tempo', 'Tempo'],
  ['e', 'key', 'Key'],
  ['y', 'style', 'Style'],
  ['o', 'voices', 'Voices'],
  ['i', 'library', 'Library'],
  ['h', 'share', 'Share'],
  ['x', 'export', 'Export'],
  ['a', 'advanced', 'Advanced'],
];
const BY_LETTER = new Map(VIEW_KEYS.map(([k, v]) => [k, `view:${v}`]));
BY_LETTER.set('k', 'play');
BY_LETTER.set('m', 'mute');
BY_LETTER.set('r', 'rollAll');

// The actions that go on while a key is held: the rest act once a press.
export const REPEATS = new Set(['louder', 'quieter', 'seekAhead', 'seekBack']);

const ARROWS = { ArrowRight: 'next', ArrowLeft: 'previous', ArrowUp: 'louder', ArrowDown: 'quieter' };
// The media keys by their names in UI Events (MediaTrackNext), and the
// names 30f's handler matched (MediaNextTrack), which no keyboard sends.
const MEDIA = { MediaPlayPause: 'play', MediaTrackNext: 'next', MediaTrackPrevious: 'previous', MediaNextTrack: 'next', MediaPreviousTrack: 'previous' };
const ascii = (k) => k.length === 1 && k >= ' ' && k <= '~';
// A letter (or a vowel mark) of a script that isn't Latin: Thai's, say.
const foreign = (k) => [...k].length === 1 && /[\p{L}\p{M}]/u.test(k) && !/\p{Script=Latin}/u.test(k);

// The letter a key types, as above: a-z, or null.
function letterOf(code, key) {
  if (ascii(key)) return /^[a-z]$/i.test(key) ? key.toLowerCase() : null;
  const place = /^Key([A-Z])$/.exec(code);
  return place && foreign(key) ? place[1].toLowerCase() : null;
}

// The action of a keydown, or null: 'play', 'next', 'previous',
// 'seekAhead', 'seekBack', 'louder', 'quieter', 'mute', 'rollAll',
// 'roll0' to 'roll4', 'layer0' to 'layer4' (on / off), 'view:<view>',
// 'close', 'keys', 'save'. `letters`: the switch.
export function shortcutOf(e, mac, letters = true) {
  if (e.isComposing || e.key === 'Process' || e.key === 'Dead') return null;
  const { code = '', key = '', altKey, shiftKey, ctrlKey, metaKey } = e;
  if (ctrlKey || altKey || metaKey) {
    const s = letterOf(code, key) === 's';
    return s && !altKey && !shiftKey && !!ctrlKey === !mac && !!metaKey === !!mac ? 'save' : null;
  }
  const media = MEDIA[code] || MEDIA[key];
  if (media) return shiftKey ? null : media;
  if (code === 'Space' || key === ' ') return shiftKey ? null : 'play';
  if (key === 'Escape' || code === 'Escape') return shiftKey ? null : 'close';
  if (ARROWS[code]) {
    if (!shiftKey) return ARROWS[code];
    return code === 'ArrowRight' ? 'seekAhead' : code === 'ArrowLeft' ? 'seekBack' : null;
  }
  if (!letters) return null;
  if (key === '?' || (shiftKey && code === 'Slash' && foreign(key))) return 'keys';
  const digit = /^Digit([1-5])$/.exec(code) || (/^[1-5]$/.test(key) && /^Numpad([1-5])$/.exec(code));
  if (digit) return `${shiftKey ? 'layer' : 'roll'}${digit[1] - 1}`;
  if (shiftKey) return null;
  return BY_LETTER.get(letterOf(code, key)) || null;
}

// Which keys the control with the focus keeps for itself: 'all' (a box to
// type in), 'arrows' (a slider, tabs, a radio group), 'press' (a key:
// Space and Enter, when the keyboard put the focus there), or null.
// `el` is an element (or anything with its `matches` and `closest`).
export function ownKeys(el, byKeys) {
  if (!el || !el.matches) return null;
  if (el.closest('dialog[open]')) return 'all';
  if (el.isContentEditable || el.matches('textarea, input:not([type="range"], [type="button"], [type="checkbox"], [type="radio"], [type="file"])')) return 'all';
  if (el.matches('input[type="range"], [role="slider"], [role="tab"], [role="radio"], pre[tabindex]')) return 'arrows';
  if (byKeys && el.matches('button, [role="button"], [role="switch"], a[href], input')) return 'press';
  return null;
}

// Whether the control keeps this key (`kind` from `ownKeys`).
export function keeps(kind, e) {
  if (kind === 'all') return true;
  if (kind === 'arrows') return /^(Arrow(Up|Down|Left|Right)|Home|End|PageUp|PageDown)$/.test(e.key);
  if (kind === 'press') return e.code === 'Space' || e.key === ' ' || e.key === 'Enter';
  return false;
}

// The modifiers by the names on this keyboard.
export function keyNames(text, mac) {
  return mac ? text.replaceAll('Alt+', 'Option+').replaceAll('Ctrl+', 'Cmd+') : text;
}

// The list of keys, as the popup shows it: `keys` as shown, `said` as a
// screen reader says them, `what` they do; `letter` true for a row the
// switch turns off.
export function keyList(mac) {
  const save = keyNames('Ctrl+S', mac);
  const rows = [
    ['Space', 'Space', 'play / pause'],
    ['K', 'K', 'play / pause', true],
    ['→ ←', 'Right arrow, left arrow', 'next / previous'],
    ['Shift+→ ←', 'Shift with the right or left arrow', 'forward / back'],
    ['↑ ↓', 'Up arrow, down arrow', 'volume'],
    ['M', 'M', 'mute', true],
    ['R', 'R', 'roll every layer', true],
    ['1–5', '1 to 5', 'roll a layer', true],
    ['Shift+1–5', 'Shift with 1 to 5', 'a layer on / off', true],
    [save, save, 'save'],
    ['Esc', 'Escape', 'back'],
    ['?', 'Question mark', 'these keys', true],
  ];
  const out = rows.map(([keys, said, what, letter]) => ({ keys, said, what, letter: !!letter }));
  for (const [k, , word] of VIEW_KEYS) out.push({ keys: k.toUpperCase(), said: k.toUpperCase(), what: word, letter: true, view: true });
  return out;
}
