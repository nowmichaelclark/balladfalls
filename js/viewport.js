// The page in a phone's browser (Mikey, 2026-11-22, with the phone on its
// side): which of the safe area's insets are really inside the page, and
// the browser's bar put away by a small scroll.
//
// Insets. With viewport-fit=cover, some browsers report the whole window's
// insets (the status bar's 25, the navigation bar's 49) to a page that they
// have already laid out clear of those bars. Padding by them counts them
// twice, and the boxes end up off center and short. The screen tells the
// truth: the part of it that the page doesn't cover is already outside, so
// an inset that fits in that part is outside too. A page that covers the
// screen (a notch, edge to edge, the installed app) keeps every inset that
// it is given.
//
// The bar. A phone's browser hides its bar only when the document itself
// scrolls. So in a browser's tab on a touch screen, the document is a
// little taller than the screen, and the app sticks to its top at the
// screen's height (css/style.css, `.bar-scroll`). A scroll puts the bar
// away, and the app grows into the room. There is no Fullscreen API.
//
// 400% zoom. A computer's screen that short scrolls (css/style.css, the
// same query as ZOOMED). The keyboard's focus is scrolled into sight where
// the app moves it; a view that opens moves it with preventScroll.

const ZOOMED = '(max-height: 279.98px) and (pointer: fine), (max-height: 279.98px) and (pointer: none)';
const SIDES = ['top', 'right', 'bottom', 'left'];
const ROUNDING = 2;   // px: a screen's and a page's sizes are rounded apart

// `reported`: env(safe-area-inset-*) in px. `screen`: the screen's size as
// the phone is held. `page`: the page's. Returns the sides whose inset is
// already outside the page.
export function outsideInsets(reported, screen, page) {
  const { top, right, bottom, left } = reported;
  const across = screen.width - page.width + ROUNDING;
  const down = screen.height - page.height + ROUNDING;
  // Across, a browser has no bars of its own: the sum decides for both.
  const sides = left + right > 0 && left + right <= across;
  // Down, it has (its address bar), so only a top inset shows that the
  // window's insets are being reported; then the bottom's is judged with it.
  // A bottom one alone (edge to edge, under the gesture bar) is real.
  const above = top > 0 && top <= down;
  const below = above && bottom > 0 && top + bottom <= down;
  return { top: above, right: sides && right > 0, bottom: below, left: sides && left > 0 };
}

// True if a small scroll should put the browser's bar away: a tab on a
// touch screen. Never when installed, in the Android app, or in a browser
// without dvh (there the screen's height would cut the keys).
export function scrollsBarAway({ app, installed, touch, dvh }) {
  return !app && !installed && touch && dvh;
}

// A slider in a tab that scrolls the bar away (Mikey: "I can only scroll up
// and down by touching specific places"). A slider's track lets a finger's
// drag up or down scroll the page (css/style.css, `.bar-scroll`, pan-y), as
// anywhere else does. But the browser moves the value to where the finger
// lands before it knows that the drag is a scroll. So, under a finger, the
// app holds back what a slider says until the drag goes sideways (or is a
// tap), and then gives it to the app. If the browser took the drag for a
// scroll, the value goes back, unheard. A mouse, a pen and the keys are
// never held back.
export function holdSliders(doc) {
  let held = null;   // { input, from, x, y, id }
  const give = () => {
    const h = held;
    held = null;
    if (h && h.input.value !== h.from) h.input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  doc.addEventListener('pointerdown', (e) => {
    const t = e.target;
    if (e.pointerType !== 'touch' || !(t instanceof HTMLInputElement) || t.type !== 'range') return;
    held = { input: t, from: t.value, x: e.clientX, y: e.clientY, id: e.pointerId };
  }, true);
  doc.addEventListener('input', (e) => {
    if (held && e.target === held.input && e.isTrusted) e.stopImmediatePropagation();
  }, true);
  doc.addEventListener('pointermove', (e) => {
    if (!held || e.pointerId !== held.id) return;
    const dx = Math.abs(e.clientX - held.x);
    if (dx > 4 && dx >= Math.abs(e.clientY - held.y)) give();
  }, true);
  doc.addEventListener('pointerup', (e) => {
    if (held && e.pointerId === held.id) give();
  }, true);
  doc.addEventListener('pointercancel', (e) => {
    if (!held || e.pointerId !== held.id) return;
    held.input.value = held.from;
    held = null;
  }, true);
}

// The screen's size the way it is held. Some browsers always report it
// upright.
function screenAsHeld() {
  const long = Math.max(screen.width, screen.height);
  const short = Math.min(screen.width, screen.height);
  const type = screen.orientation && screen.orientation.type;
  const sideways = type ? type.startsWith('landscape') : innerWidth > innerHeight;
  return sideways ? { width: long, height: short } : { width: short, height: long };
}

export function watchViewport({ app }) {
  const root = document.documentElement;
  if (scrollsBarAway({
    app,
    installed: ['standalone', 'fullscreen', 'minimal-ui'].some((m) => matchMedia(`(display-mode: ${m})`).matches) || navigator.standalone === true,
    touch: matchMedia('(pointer: coarse)').matches,
    dvh: CSS.supports('height', '100dvh'),
  })) {
    root.classList.add('bar-scroll');
    holdSliders(document);
  }

  const probe = document.createElement('i');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = `position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;${
    SIDES.map((s) => `padding-${s}:env(safe-area-inset-${s},0px)`).join(';')}`;
  document.body.appendChild(probe);

  const set = () => {
    const css = getComputedStyle(probe);
    const reported = Object.fromEntries(SIDES.map((s) => [s, parseFloat(css.getPropertyValue(`padding-${s}`)) || 0]));
    const page = { width: root.clientWidth, height: innerHeight };
    const out = outsideInsets(reported, screenAsHeld(), page);
    for (const s of SIDES) {
      if (out[s]) root.style.setProperty(`--inset-${s}`, '0px');
      else root.style.removeProperty(`--inset-${s}`);
    }
  };
  set();
  // (Registered before the app's own resize: it measures with these.)
  addEventListener('resize', set);

  // Never while the mouse is down, because what it presses would move from
  // under it.
  const zoomed = matchMedia(ZOOMED);
  let down = false;
  addEventListener('pointerdown', () => { down = true; }, true);
  for (const type of ['pointerup', 'pointercancel']) addEventListener(type, () => { down = false; }, true);
  addEventListener('focusin', (e) => {
    if (zoomed.matches && !down) e.target.scrollIntoView({ block: 'nearest' });
  });
}
