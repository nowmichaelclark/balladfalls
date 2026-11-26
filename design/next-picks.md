# Next picks: the chosen design

Mikey chose this design on 2026-10-13, after four rounds and 70 options
(Painter session 5). It is built: the Vibe panel, the picks on Now
Playing, the Bars picker (v97 to v99), and the tempo, key, style and
voices pickers (v205, built plain). This page is the design brief, kept
for a Painter session that restyles them. The three renders that showed
it left the tree after 1.0 (`docs/archived.txt`). If this text and the
app differ, the app wins, and "Decided" below wins over the text above it.

Three places: **Now Playing** shows what new loops lean toward, the
**New loops** panel lists the picks, and the **Length** picker sets bars.
Built from option 67/69 (Now Playing), 63 (the panel) and 69 (the picker,
plus a cancel key).

## The picks and their colors

Five lines, like Layers. Tempo and length share line two.

| Line | Shows | Color (dark themes) | Color (Dawn, Ember, Tidal, Olive) |
|---|---|---|---|
| 1 | moods | `#ffb347` | `#c77a12` |
| 2 | tempo, then length | `#6fd6c8`, `#b8a2f2` | `#1f8f84`, `#7c5cd6` |
| 3 | key and scale | `#f39ac0` | `#c94c86` |
| 4 | style (profile) | `#9fd38a` | `#4f9a3a` |
| 5 | voices | `#8fc3f0` | `#3a7fc4` |

(Since v197 Ember and Tidal take `#5a38b8` for length: it fills the
slider, a graphic that needs 3:1 on those mid-tone panels.)

Colors are decoration only: they outline pills and color the length
slider; text stays `--text-primary` / `--text-secondary`. Define them as
theme tokens (for example `--pk-mood`), with the darker set in the four
light themes.

Values carry their own meaning, so lines have no labels: "merry,
tender", "70–85 bpm", "16 bars", "any key", "any style", "any voices".

**Moods past three end in an ellipsis:** two moods read "merry, tender";
four or more read "merry, tender, dreamy…" (the first three, then "…").
The same rule applies on Now Playing and in the panel.

## The pill

A picked value is an outline pill: 30px tall in the panel (26px on Now
Playing), radius half the height, 12px side padding (10px on Now
Playing), a 1.25px inset ring in the pick's color at 80%, text 600
weight, 0.8125rem (0.75rem on Now Playing), `--text-primary`, tabular
digits, never wrapping.

A value left to chance is either plain secondary text with the line's
**any** key lit (the whole line is "any"), or, on line two when only one
of tempo and length is picked, a dashed pill ("any tempo" / "any
length"): 1.5px dashed border in the pick's color at 60%, text 500
weight, `--text-secondary`.

## Now Playing (outside an album only)

- **In an album the picks are hidden.** The album is what comes next, so
  Now Playing stays as it is today: album row, "Next: …", "leave album".
- **Outside an album:** no album row and **no "Next: …" line** (Mikey,
  2026-10-13: "Next: something new" goes). Below the clock and bar sit
  the picked values as outline pills, centered, on up to two rows:
  moods on the first, tempo and length on the second. Only picked values
  show; nothing says "+3 any". A row with nothing picked is left out
  (with only length picked, one row: "4,096 bars").
- **Nothing picked at all:** one quiet dashed pill, "anything", in
  `--rule`, so there is still something to tap. (Painter's call; Mikey
  may change it.)
- The pills are **one button** (min 44px tall) that opens New loops.
  Its accessible name says what it does, for example "New loops: merry,
  tender, 70 to 85 bpm, 16 bars".
- The bottom key stays as the app has it: "back to Harbor" after
  leaving an album, hidden otherwise.
- The clock keeps its full size; there is room now the album row is
  gone.
- The Vibes key (top left today) stays for now; see the open questions.

## New loops panel

- **Head:** title "New loops" on the left, a **close** key on the right
  (not "‹ Now"). Same `page-head` as the app's other views.
- **Five lines**, each at least 48px tall with a `--rule` line under it.
  Each line is two controls:
  - the values, as one button that fills the line (left aligned; on line
    two, tempo and length are two buttons side by side). Tapping a value
    opens its picker: moods open the Vibes list (as today), length opens
    the Length picker below. Tempo, key, style and voices open their own
    pickers (session 30j, below).
  - an **any** key on the right: `vkey word`, at least 52 × 40px, text
    "any". **Lit** (`.vkey.armed`) when the whole line is left to chance;
    tapping a lit key does nothing, tapping an unlit one clears that line
    back to chance. On line two it clears both tempo and length.
- Nothing scrolls (the app's rule: only the Library and Advanced scroll).
- Clear all / reset is not on this panel in the chosen design.

## Length picker

**Renamed "Bars" (Mikey, 2026-11-03; queue item 88b):** its head reads
"Bars" and the panel's "any length" reads "any bars"; it sets how many bars
a loop is. Text only; the rest of this section stands.

**When a loop ends is the Track length view's** (session 30c, queue item
111; Mikey, 2026-11-18): its key is the pace line's third, after "any tempo
· any bars", saying the time set ("1:23:45") or "plays on"; the loop
playing's, not a pick, so the line's any key leaves it. The view is built
like Bars, plain until a Painter session restyles it: the time to the
second as the big number (h:mm:ss, or m:ss under an hour; typed, or digits
a timer's way), its words under it, a row of four keys (−1 min, −1 s, +1 s,
+1 min), a coarse slider of sixteen stops from a minute to a day (ticks 1m,
15m, 1h, 4h, 1d), then **on and on** on the left and **fade in**, **fade
out** on the right, each lit the app's way while on (the fade out dimmed
while it plays on); cancel and done in the head.

Opened from the length value in the panel. A view of its own in the
middle viewport.

- **Head:** **cancel** on the left, "Length" centered, **done** on the
  right (done in 700 weight).
  - **cancel** goes back to the panel and restores the length chosen
    before the picker opened, whether that was a number, Endless or
    "any".
  - **done** keeps what is shown and goes back to the panel.
- **The body is vertically centered** in the viewport (not top-heavy),
  three groups 22px apart:
  1. **−1 · number · +1.** The number is 3rem Space Grotesk, 600,
     `-0.03em`, tabular, with a 2px underline in the length color; tap
     it to type (numeric keyboard; no hint text says so). Under it, in
     small secondary text: "bars · ≈ 45–55 s" (the play time at the
     tempo range; "≈ 3–4 hours" for long lengths). −1 and +1 are `vkey`s,
     at least 48px. Range 1 to 32,768.
  2. **The doubling slider.** 16 stops, one per power of two from 1 to
     32,768 (1, 2, 4 … 16k, 32k); labels under 1, 16, 256, 4k and 32k,
     the current one in `--text-primary`. A 4px track, filled in the
     length color up to the thumb; the thumb is a 24px white circle with
     a 3px ring in the length color. Dragging snaps to the stops; a
     number between stops (say 24) puts the thumb between them.
  3. **Endless:** "∞ Endless" and a switch (on = length color). No
     subtitle. When on, the number shows "∞" with "endless" under it,
     and −1, +1 and the slider dim to 40% and don't respond.
- **No explainer text anywhere** ("tap the number to type", "plays until
  you skip" and similar are out).
- Opened while length is "any": it starts at the playing loop's length;
  cancel returns to "any".

## Decided (Mikey, 2026-10-14)

Both open questions are answered, and the panel is renamed. Built in
build v99, spec v20. Where this section and the text above differ, this
section wins.

- **The way in during an album:** the picks on Now Playing stay hidden
  in an album; to see them, leave the album first. The top-left key now
  reads **"vibe"** (no count) and opens the panel, in an album and out
  of one.
- **The panel is called Vibe** (it was "New loops"). No title on screen,
  only the close key on the right ("cleaner this way"); screen readers
  still hear "Vibe". Its mood line opens the vibe words, whose close
  comes back to the panel.
- **Only tempo, or only length, back to "any":** each gets its own
  **any** key inside its own picker. In the Length picker the Endless
  label and switch are replaced by one **∞ key** that lights while
  endless is on, which leaves room for an any key beside it. With any
  lit the number reads "any" (the slider's thumb hollow); −1, +1, the
  slider or typing a number pick one. Turning ∞ off goes to a number of
  bars, not back to any. Tempo's any key comes with the tempo picker. Line two's any
  key in the panel still clears both.

## Tempo, key, style and voices (session 30j, queue item 118)

Built plain by the hands on 2026-11-24 (Mikey, 2026-11-23: "We don't have
viewport menus for tempo, key, style or voices"), in the Bars view's parts,
for a Painter session (30k) to restyle. `js/pickers.js`.

- **Four views**, each opened from its value on the Vibe panel (every line
  is a key now, "any" or picked). Head: **cancel**, the title, **done**, as
  Bars: cancel keeps what was there, done keeps what is shown.
- **The three states, one way everywhere:** keys lit the app's way (a ring
  in the primary text color, the line's color inside it) are what is asked;
  one lit is pinned, several are a set; none lit, and the **any** key at
  the foot's right lit, is left to chance. Under the head, what is asked in
  the panel's words ("D or G dorian"); on a short panel (under 280 px) it
  takes the title's place.
- **Tempo:** the number as Bars' (typed: "80" or "70-85"), −1 and +1 move
  the whole pick, and the range control: two sliders, the slow end over the
  fast end (32 to 190 bpm, all the core takes), each pushing the other;
  together the tempo is pinned, apart a range, the fill between them.
- **Key:** two tabs, **note** (the twelve) and **scale** (the nineteen
  modes); the tab shown is underlined, a dot marks a tab that asks
  something; the any key clears the tab shown.
- **Style:** the sixteen profiles.
- **Voices:** a tab a layer (drums, bass, keys, melody, air, as Layers names
  them); each its own voices, and **on** (always plays) and **off** (never),
  pressed again back to chance; off rests while the other four are off (all
  five off is the one request the core refuses).
- **Long lists page, never scroll:** as many keys as the room holds at 44 px
  (40 or less only where it saves a page, never under 32), then ‹ › and
  where you are ("2/4").
- **Clear all:** a **clear** key at the left of the Vibe panel's head, dim
  when nothing is picked: every line back to any, the moods too. The Track
  length stays (the loop playing's, not a pick).

## Building notes

- The core takes the full ranges: 1 to 32,768 bars or Endless, and 32 to
  190 bpm. The vibes are the moods.
- Bump `BUILD` and `CACHE` together. If a Painter session needs the spec,
  bake it again (`design/test-kit/bake.mjs`) so that it shows the new
  views, and do not commit it.
