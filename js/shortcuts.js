// The keyboard's shortcuts (session 30f; Mikey, 2026-11-22: "Make the
// keyboard keys closer in alignment with what a DAS or Music Player like
// Spotify would choose; align with the industry standards and the accessible
// ones"). Space and the media keys are js/main.js's own.
//
//   Alt+Shift+Right, Left   Next, Previous (Spotify's modifier)
//   Ctrl+S, Cmd+S on a Mac  save to Favorite Loops (a DAW's Save)
//   Alt+Shift+S             the same (Spotify's Alt+Shift+B is Edge's own)
//   Alt+Shift+1 to 5        roll that layer
//
// Exactly those modifiers: AltGr (Ctrl+Alt) is none of them, and no
// character key alone or with Shift does anything (WCAG 2.1.4).
//
// Keys are matched by their place (`code`): Option changes a Mac's
// character, and Shift a number's. S is the one letter, so it is the letter
// where the layout has Latin ones (on Dvorak the key in S's place is O, and
// Ctrl+O is the browser's) and its place where it doesn't (Thai, Option).

export function onMac(nav = globalThis.navigator) {
  return !!nav && /Mac|iP(hone|ad|od)/.test(nav.platform || '');
}

// The action of a keydown: 'next', 'previous', 'save', 'roll0' to 'roll4',
// or null.
export function shortcutOf(e, mac) {
  if (e.isComposing) return null;
  const { code = '', key = '', altKey, shiftKey, ctrlKey, metaKey } = e;
  const s = /^[a-z]$/i.test(key) ? key.toLowerCase() === 's' : code === 'KeyS';
  if (altKey && shiftKey && !ctrlKey && !metaKey) {
    if (code === 'ArrowRight') return 'next';
    if (code === 'ArrowLeft') return 'previous';
    if (s) return 'save';
    const digit = /^Digit([1-5])$/.exec(code);
    return digit ? `roll${digit[1] - 1}` : null;
  }
  if (s && !altKey && !shiftKey && !!ctrlKey === !mac && !!metaKey === !!mac) return 'save';
  return null;
}

// The modifiers by the names on this keyboard.
export function keyNames(text, mac) {
  return mac ? text.replaceAll('Alt+', 'Option+').replaceAll('Ctrl+', 'Cmd+') : text;
}
