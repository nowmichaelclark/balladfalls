# What there is to paint

This page is for Painter sessions: Mikey's design work with other
chatbots, brought into the app afterward. It lists the rules that every
design keeps, what is built plain and waits for a design, and what is not
built yet. The look of the app today is in `design/README.md`.

## The rules any design keeps

- **One screen:** an info card on top, a switching viewport in the
  middle, and mostly icon buttons below. Previous, Play and Next are
  always fixed in place.
- **Scrolling happens in exactly two places,** both in the middle
  viewport: the Library's lists and the Advanced page. Nothing else
  scrolls. There are two exceptions:
  - **A computer zoomed to 400%** (Mikey, 2026-11-22: "let it scroll at
    400%, only those who have accessibility issues would zoom in that much
    I think"). Under 280 px high with no touch, the page scrolls down,
    never across.
  - **The browser's address bar** (Mikey, 2026-11-22: "I would thing the
    user could just be able to scroll down a bit"). In a touch browser's
    tab, the document scrolls that bit, and the app grows into the room.
    This is not so when installed, or in the Android app.
- **Bottom buttons have no lights or LEDs.** They only change icon. For
  now, only the bottom-right Sound / Layers switch does.
- **There are four settings:** the theme, "Lighter on processor", Mono,
  and the letter keys' switch in Advanced (item 122; Mikey, 2026-11-23,
  his exception to three). Anything new is a pick, a sheet or a message,
  not a setting.
- **The music is stereo** (since v116). The **Mono** switch is in
  Advanced, under Sound, as a plain switch (Mikey, 2026-10-15).
- **Calm and wholesome:** the music is cozy (a nice coffee shop, Animal
  Crossing, Ocarina of Time's whimsy), and the look feels the same.
- **Plain characters only** in anything the app shows as a code or a name:
  letters, digits, `-` and `_`. No emoji in codes.
- **It must run smoothly** on old Android phones and weak chips.

## What the final pass settled (item 114, v196 to v198)

- **Two layouts.** Upright: card, panel, keys. Under 520 px high and 480
  px or wider (a phone on its side; Mikey, 2026-11-22): the panel at the
  left, the card over the keys at the right, the two filling the safe
  area, up to 560 px a side. The reading order is the same both ways:
  card, panel, keys. Draw a design for both, and at 360x640 and 320x568.
- **The panel asks its own height** (the container `middle`: 340, 300 or
  240 px). A view closes its gaps to fit, and never scrolls to fit.
- **Targets are 44 px** where there is room, and never under 24.
- **Keys** (item 122, v211; Mikey, 2026-11-23: intuitive over accessible
  where the two pull apart) work as music players have them. Space and K
  play, the arrows go next and previous (Shift a bar), Up and Down set the
  volume, M mutes, R and 1 to 5 roll the dice, a letter opens a view, Esc
  goes back, and ? opens a popup that lists them. The letter keys' switch
  in Advanced turns every lone letter, digit and symbol off (WCAG 2.1.4).
  The map is at the top of `js/shortcuts.js`. A key's tooltip shows its
  key.
- **The bar is WCAG 2.2 AA** in every theme and in forced colors, held by
  `tools/a11y.mjs`: text 4.5:1 (3:1 large), marks and rings 3:1. A hue
  used for words has its own deeper token (`--mark-text`).
- **State is a shape as well as a color.** Pressed is a ring, muted notes
  are rings, and a soft note keeps its ring at full color. Off is one
  dimming, 0.55, never doubled.
- **Focus** is a 2 px ring on everything, whole. A view that opens puts
  the focus on its way out. A view that closes puts it on the key that
  opened it.
- **A popup is solid,** and so is a slider's knob (item 119). A screen
  that can do nothing shows no keys.
- **The card** (item 119; Mikey, 2026-11-23 and 24): the art on the right,
  the words on the left. The playhead's lit dot is a diffused LED, with no
  sparkle.
- **Text size is the root size** (rem, with the pixel caps holding), in
  the browser and in the Android app.
- **No baked spec is kept** (Mikey, 2026-11-26). If a session needs one,
  bake it with `design/test-kit/bake.mjs`, and do not commit it.

## Built plain: ready for a design

These work, in a plain look. A Painter session can restyle any of them.

- **The New loops panel and its picks.** Designed by Painter 5 (Mikey
  chose it, 2026-10-13; `design/next-picks.md`). Built plain in v205: the
  tempo, key and scale, style and voices pickers, the range control (two
  sliders) and Clear all. Every pick has three states: **pinned** (exactly
  this), a **range** (anywhere from 70 to 85 bpm) or **left to chance**.
  When picks can't be met together, the core's "can't do that" line shows
  under the pace line and in each picker.
- **A long piece on Now Playing** (v183, `js/piece.js`). The rail becomes
  the piece's line: ticks for the map, a bead for you. Under it are
  "bar 812/3,072 · peak" and the time played and left. A key each way
  jumps a section, and pressing the line jumps there. The journey (arc,
  wander) sits beside the Bars picker's ∞ and any. The Library's lists
  end in each loop's length.
- **The Export view** (behind Share's export audio). There is a key for
  each format: **flac** (lossless), **opus** (much smaller, for sharing)
  and **midi**. Its length is the track's: the Track length view's time
  and fades. A loop that plays on opens the Track length view first.
  - A message comes before anything starts if there is not enough space.
  - Progress is calm, with Cancel and one line: closing the app stops it.
  - When done, open or share the file. If it failed, a plain, kind message
    shows.
  - **An album whole** (item 121): keys **loop** and **album**, and for an
    album **zip** and **files**. One progress line for the album
    ("2/4 · 37%"). A track that plays on asks how long once, for all.
    Files are named "NN name.ext", and each is tagged with its name, the
    album, its place, the app, the day, its code and its cover.
- **An album from one seed,** with as many tracks as the slider says, and
  **save** to put it in the Library (item 121).
- **Share codes,** version 2: short codes, shared as a link, with a link
  preview image. A code from a newer build, or one that needs an
  instrument this device lacks, gets its own message.
- **The icon** (item 120, Mikey's pick). `icons/icon.svg` is the one
  source, and `node tools/icons.mjs` makes every size and checks the safe
  zones.
- **The F-Droid listing's screenshots** (`fastlane/metadata/android/`),
  made from the app on an emulator by CI.

## Not built yet

- **New instruments:** icons for each new voice, and a quiet mark in Layers
  and Sounds that an instrument is not one of Ballad Falls' own (a mod or a
  recipe).
- **Space controls,** if they are ever shown to listeners: how wide the
  mix is, and where each instrument sits from left to right.
- **The Advanced page:** it shows the app's version (`VERSION` in
  `js/main.js`). Not yet designed: health readouts for testers, such as
  "late notes: 0". Diagnostics reports them now, in text.
- **The Android app:** a splash screen, and designed artwork for the lock
  screen and the media notification. The controls there work now.
- **Other stores:** Google Play later, and an itch.io desktop release (a
  cover image, a page banner, screenshots, and window icons for Windows
  and Linux).
- **Games and developers:** an optional, small in-game "now playing"
  toast, a name and a logo for the engine itself, and simple diagrams for
  the developer guide. Broken Friends restarted as a 3D PC game in
  November 2026, and the way the engine goes into it is not decided yet
  (`docs/CORE.md`, promise 10).
