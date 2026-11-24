# Session 30k: the look: the card, the playhead, the sliders, the die, the speakers, the scroll (119)

**Left** (2026-11-24, stopped by brain B-parallel 4 at Mikey's word, his
usage low; the next session with this prompt starts here):

- Draft #468, branch `claude/s30k-the-look`, head ea26eb2, all pushed. It
  has v209 set: re-check it against main and take the next after main's.
- Mikey's picks: B, the bead, then its LED take "B3 diffused" (recorded in
  the PR body; the sketches are on the branch `s30k-shots`).
- Built and pushed:
  - the B3 playhead in all nine themes
  - the card mirrored
  - solid knobs
  - the die
  - the speakers
  - Chrome's scroll: the sliders are `pan-y`, and `holdSliders` is in
    `js/viewport.js`
  - `tools/rows.mjs`'s `--only scroll` group: 52 pass on the branch, and
    12 fail on main's code, so the group catches the bug
  - `tools/names.mjs`'s switch check (green)
- Left:
  - `tools/a11y.mjs`: its contrast run stopped unfinished, so the light
    themes' LED middles and the knobs are unverified.
  - `tools/views.mjs`.
  - The before and after screenshots.
  - The yardsticks in the PR body.
  - CI and ten rows, dispatched alone.
  - Then the merge, the Done line, the queue's status line and the row's
    tick.

Written by brain B-parallel 4 (2026-11-23) from Mikey's list that day
(his items 10, 12, 13, 14, 16 and 17).

- **Model:** Opus 5.5. **Effort:** high.
- **Start after:** session 30h (Now Playing's line, which this restyles
  around). It may run alongside 30i, 30l, 30m and 30g's Left list; never
  beside 30j (both change `css/style.css` and `index.html` widely), and 30n
  waits for it.
- **Queue item:** item 119. **Holds 1.0.**

Paste everything in the block as the session's first message.

````text
Hands session 30k on the road to Driftloom's 1.0 (Opus 5.5, high): the look: the info card's art to the right, a new playhead, solid slider knobs, a die that looks like one, speakers for the layers' on and off, and the touch scroll in Chrome (item 119).

Read first: AGENTS.md; docs/sessions/README.md (the order, and "Rules for every session": they are part of this prompt); docs/QUEUE.md (status, standing rules, merge policy, item 119); docs/PAINTER.md (every rule, and what the final pass settled: a change to the look keeps them or records Mikey's exception); docs/DECISIONS.md (2026-11-22 and 2026-11-23); docs/notes/for-mikey.md (the design checks); index.html (the card, the Sound view's sliders, the Layers view); css/style.css (.info-inner, .playhead and its ::after, the range inputs, html.bar-scroll and the touch rules from 30f); js/ui.js (the icons: the die, on and off); js/main.js (the card's drawing and the layers' keys; the address bar's scroll from #457); tools/a11y.mjs, tools/views.mjs, tools/names.mjs, tools/rows.mjs.

Check your place: in docs/sessions/README.md every row in session 30k's After column should be ticked, and every hands session running now named in its Alongside. If not, stop and say so. If this file has a "Left" list at its top, an earlier session with this prompt stopped partway: start from that list.

Mikey (2026-11-23):
- "It feels a bit unresponsive when on the website in google chrome and the user wants to scroll down to hide the url and also scroll up to show the url again. I can only scroll up and down by touching specific places on the screen and it feels inconsistent."
- "The sliders on the sliders viewport that show things like tempo, warmth, room, etc. those slider circles don't need to be semi-transparent. That would look better opaque."
- "The die icon that is meant to be the 'roll' icon on the layers viewport doesn't look very much like a die. Maybe try doing a die that is 3d like a dice emoji or something like that."
- "Also on the layers viewport, the 'on'/'off' button can also be replaced with an icon that shows an unmuted speaker and a muted speaker."
- "The circular playhead in the infocard viewport could use a redesign. I like that it's circular, but I don't like the little sparkle on it. I still want it to pop and stand out, but not in a cheesy way like that. I'm not sure what direction to take with that one either, so we could try a few different designs."
- "I feel like the loop art should now go on the right side of the info card instead of the left side. The info card feels very left leaning and I think having the art on the right side and the other stuff like the percentages, track title, etc. on the left side would help balance things out."

The work, in this order:

1. The playhead's designs first, for Mikey to choose: three or four, each round, none with the sparkle, each standing out without glitter (a solid ring, a filled dot a size up with a soft shadow, a dot with a short trail, a pulse on the beat only: yours to draw), each in light and dark at 360 px, on the card as it will be after step 2. Send them to the brain as one image or a page of screenshots in the draft PR, and end your turn saying you wait for his pick. Build only the one he picks.
2. The card mirrored: the art on the right, the title, the details and the percentages on the left, upright and on its side, every detail line still whole at any width and text size (item 112's rule: what doesn't fit is left off in its fixed order and a tap away).
3. The sliders' knobs solid (opaque) in every theme and in forced colors, still 3:1 against the track.
4. The roll key's die drawn as a die: three faces, pips, a little depth, like the dice emoji in spirit but the app's own line and colors (no emoji character: plain characters only in what the app shows as a code or name, and the icon is an SVG like the others).
5. The layers' on and off as a speaker and a muted speaker, the state still a shape as well as a color, and a screen reader still told "on" or "off" (tools/names.mjs).
6. Chrome's address bar (a touch browser's tab, not installed, not the Android app): a drag anywhere on the screen, on a key, a slider's track, the card or the panel, scrolls the document the bit that hides or shows the bar, except where the drag is the control's own (a slider's knob, the piece's line, a list that scrolls). Find why only some places scroll today (touch-action, overscroll, a handler eating the move) and fix it there. Nothing else scrolls (PAINTER.md's two exceptions stand).

Yardsticks: Mikey's pick of the playhead recorded in the PR; tools/a11y.mjs green (every theme and forced colors); tools/views.mjs on every view; tools/names.mjs; tools/rows.mjs ten passes in a row in CI (the export workflow with repeat=10); screenshots before and after of the card, the Sound view and the Layers view at 360x640, 320x568, on its side and a tablet, light and dark; for the scroll, a test that drags from each kind of place in an emulated touch tab and reads that the document scrolled (and that it really moved: a check that never scrolled passed once in 30f); the gate. In for-mikey.md: the scroll to try on his phone in Chrome, and the card, the die and the speakers to look at.

When you finish: add the merged PRs' lines to docs/DONE.md, keep the queue's status line current, tick session 30k's row in docs/sessions/README.md, and end with a plain summary for Mikey: what merged (PR numbers), what to look at, and what you added to docs/notes/for-mikey.md. Do this session's work and stop: the next session has its own prompt.
````
