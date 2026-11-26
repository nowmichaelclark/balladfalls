# The design spec

This folder holds the tools that make the **design spec** of the
one-screen app, and the brief for the next-loop picks. It is not part of
the app: `.assetsignore` keeps it off the live site. `docs/PAINTER.md`
says what there is to paint and the rules that every design keeps.

## What the spec is

- **The app is the spec.** The spec is one HTML page, baked from the app:
  one phone, exactly as the app draws it, at 340 x 780, with review
  controls beside it for the view, the text size, the insets, the touch
  targets and reduced motion.
- **No baked file is kept** (Mikey, 2026-11-26). If a Painter session
  needs one, bake it, and do not commit it.
- **How the bake works:** `test-kit/bake.mjs` runs the real app in
  headless Chromium. It seeds a library, plays an album, visits every view
  at each text size and copies what the app drew. The phone's stylesheet is
  `css/style.css` itself.

The spec was drawn by hand until v17, and the app followed it. Since v18
(Painter session 5) it is baked from the app. The wiki page "Ballad
Falls/History/The design spec" tells the story.

## Bake it

```
cd design/test-kit
npm install            # Playwright; if the sandbox has a Chromium, pin playwright to its version
node bake.mjs          # writes ../driftloom_v20.html (not committed)
node sheet18.mjs ../driftloom_v20.html out/sheet.png --places layers --themes all
node picks_shots.mjs out/picks --themes all --sizes 100,200   # the next picks, measured
```

The bake prints the sample loop and the zone heights that it measured.
It also checks that the Layers notes it read from the generator match
what the app drew. You can try a design idea by hand in a copy of the
baked file. When it is agreed, put it into the app and bake again.

| To change | Edit | Then |
|---|---|---|
| How the phone looks | the app: `css/style.css`, `index.html`, `js/ui.js`, `js/library.js` | bake |
| The page around the phone (review controls, notes, tables) | `test-kit/spec.template.html` | bake |
| What the bake visits or seeds | `test-kit/bake.mjs` | bake |

`test-kit/README.md` lists the other scripts (contrast, motion, focus
rings, zoom and others).

## What is live in the baked page

- **Live** (the page's own script, which follows `js/main.js` and
  `js/library.js`): moving between views, the Library's tabs and albums,
  More and Advanced, Save and Share, the theme swatches, Play and Pause,
  the playhead and halo column at the loop's tempo, the Layers rows bar by
  bar (the loop's first pass only), a layer on and off, picking vibes,
  ticking albums, the sliders and the Now Playing clock.
- **Not live:** anything that makes music or changes data (Previous, Next,
  roll, new album, rename, export). These show "Not in the spec: try it in
  the app".
- **Baked:** every view's markup and card at each text size. The app fits
  the Info card in script, so each text size is its own capture.
- **What the bake changes in the markup:** each canvas becomes a picture
  of what it drew, inputs keep their values as attributes, the moving
  marks (the lit cell, the halo column, the clock) are cleared for the
  page's script to put back, and scripts are left out.
- **What the bake changes in the stylesheet** (noted at the top of the
  file): the fonts are inlined; the short-screen rule
  (`max-height: 700px`) is off, because the spec phone is never that short;
  the reduced-motion rules are copied under `html.sim-reduced-motion` for
  the review switch.
- **For scripts:** `window.spec` has `show(place)`, `setTheme(cls)`,
  `setSize(pct)`, `setPlaying(bool)`, `audit()` and the lists of places,
  themes and sizes. The address takes the same:
  `driftloom_v20.html#view=library:loops&theme=t-dawn&size=150&paused&insets=android`.

## How Mikey likes to work

- **American English** in chat, docs and code comments.
- **One focused step a session.** Check it, write it down, and bump the
  version.
- **When you propose the next session, give four things:** a new or a
  continuing session, the model, the effort, and the session label (for
  example "Painter 6 · Measure the app").
- **Mikey judges the design by eye.** Show changes as screenshots or
  contact sheets, and measure every claim of compliance.
- **Use an independent reviewer.** An agent that has not seen the work
  catches claims that go too far.
- **Do not theme the design on the name** (2026-10-13). The name may
  change, as Driftloom's did, so the look uses no motifs from it.
- **No decorative art on Now Playing.** The cover lives on the Info card.
  Now Playing stays text and controls.
- **Plain over metaphor.** Of 20 directions for the next picks (a café
  menu, dice, a radio, magnets), Mikey chose the quietest: one small line
  on Now Playing that opens a plain list. Themed metaphors read as
  gimmicks.
- **Exact values, not only presets.** People want to pick exactly how
  many bars. Presets can sit beside an exact control.
- **Labels are optional** where the value says what it is ("16 bars",
  "70-85 bpm", "any key"). Colored backdrops behind values are liked;
  colored dots, "+3 any" and pencil marks are not needed.

## Open items

1. **Restyle the plain pickers:** tempo, key, style and voices (v205,
   `design/next-picks.md`, "Tempo, key, style and voices").
2. **The Info card drops lines when it is full.** v17's rule was that
   nothing in it is ever dropped (lines took turns, the WCAG 2.2.2 way).
   The app folds the lesser feelings and styles away. Mikey decides.
3. **The Info card can cut off its last lines** at 130% and up, even
   after folding. This was seen before item 119 changed the card
   [unverified since].
4. **After the design is locked:** test Safari, Firefox, VoiceOver and
   TalkBack.
