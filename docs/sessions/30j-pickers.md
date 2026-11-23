# Session 30j: the tempo, key, style and voices pickers (118)

Written by brain B-parallel 4 (2026-11-23) from Mikey's list that day
(his item 5).

- **Model:** Opus 5.5. **Effort:** high.
- **Start after:** session 30g's #458 (in). It may run alongside 30h, 30i,
  30l, 30m and 30g's Left list; never beside 30k (both change
  `css/style.css` and `index.html` widely), and 30n waits for it.
- **Queue item:** item 118. **Holds 1.0.**

Paste everything in the block as the session's first message.

````text
Hands session 30j on the road to Driftloom's 1.0 (Opus 5.5, high): the tempo, key and scale, style, and voices pickers (item 118).

Read first: AGENTS.md; docs/sessions/README.md (the order, and "Rules for every session": they are part of this prompt); docs/QUEUE.md (status, standing rules, merge policy, items 95 and 118); docs/PAINTER.md (the rules any design keeps, what the final pass settled, and section 1, next-loop picks: the three states, the range control, clear all, "can't do that"); design/next-picks.md (the Vibe panel, the Bars picker and how pickers look and behave: it wins over the renders); docs/DECISIONS.md (2026-10-13 next picks; 2026-11-22 the fewer words and 2026-11-23); js/picks.js (the Vibe panel's lines; "has no picker yet" marks the four), js/request.js (what a request can ask: a tempo or its range, keys, modes, styles, voices by layer), js/pins.js, js/main.js (how a view opens and closes, and the api picks.js gets), index.html (the Bars and Track length views as the models), css/style.css (the pickers' rules); tools/rows.mjs, tools/views.mjs, tools/a11y.mjs, tools/names.mjs.

Check your place: in docs/sessions/README.md every row in session 30j's After column should be ticked, and every hands session running now named in its Alongside. If not, stop and say so. If this file has a "Left" list at its top, an earlier session with this prompt stopped partway: start from that list.

Mikey (2026-11-23): "We don't have viewport menus for tempo, key, style or voices. Those need to be built." Today the Vibe panel shows a tempo, a key and mode, a style and the voices when they are set (by a link or a code) but none can be tapped: "has no picker yet".

The work, one PR (BUILD and CACHE), or one a picker if that is cleaner:

1. Four views, each opened from its place on the Vibe panel's lines, built as the Bars view is (cancel keeps what was there, done keeps what is shown; the focus rules of the final pass): Tempo (a bpm or a range, with any); Key (a home note, a mode, or a set of either, with any); Style (the styles, one or a set, with any); Voices (a voice for each layer, any for each, and which layers play, with any). Every pick has the three states PAINTER.md asks (pinned, a range or a set, left to chance), shown and switched one way on every picker. What each can ask is what the core takes (js/request.js): offer nothing it refuses, and the "can't do that" line when picks can't be met together, as the pace line has it.
2. The Vibe panel's lines tap through to them, their any keys as today; clear all clears them too. They shape only loops still to come, never the one playing.
3. Plain, in the app's style and the Painter's rules (one word or a symbol where it will do, Mikey's rule of 2026-11-22; targets 44 px where there is room; WCAG 2.2 AA in every theme, held by tools/a11y.mjs; both layouts, upright and on its side; nothing scrolls but the Library and Advanced, so a long list (the voices, the styles) pages or folds rather than scrolls, or say in the PR why it must scroll and mark it for Mikey's eyes).
4. A pick travels as the picks do today: saved with the panel's state, carried by a loop's code where a code carries picks (core/src/code.rs: say what does).

Yardsticks: tools/rows.mjs rows for each picker (open, pick, a range or set, any, cancel, done, clear all, the line it fills, a new loop drawn under the pick and read back from its spec), ten passes in a row in CI (the export workflow with repeat=10); tools/views.mjs, tools/a11y.mjs and tools/names.mjs on the four views; screenshots of each at 360x640, 320x568, on its side and a tablet, light and dark; the gate. In for-mikey.md: the four views to look at, and any choice you made for him to confirm.

When you finish: add the merged PRs' lines to docs/DONE.md, keep the queue's status line current, tick session 30j's row in docs/sessions/README.md, and end with a plain summary for Mikey: what merged (PR numbers), what to look at, and what you added to docs/notes/for-mikey.md. Do this session's work and stop: the next session has its own prompt.
````
