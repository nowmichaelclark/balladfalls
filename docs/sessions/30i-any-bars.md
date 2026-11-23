# Session 30i: "any bars" is sometimes a long piece; what never comes unasked (117)

Written by brain B-parallel 4 (2026-11-23) from Mikey's list that day
(his item 2) and his answer: "Sometimes".

- **Model:** Opus 5.5. **Effort:** high.
- **Start after:** session 30g's #458 (in). It changes the core's generator
  and its data alone, so it may run alongside any of 30h, 30j, 30k, 30l,
  30m, 30n and 30g's Left list.
- **Queue item:** item 117. **Holds 1.0** (codes freeze at 1.0, and this
  moves what a code with no length plays).

Paste everything in the block as the session's first message.

````text
Hands session 30i on the road to Driftloom's 1.0 (Opus 5.5, high): with nothing picked, a new loop is sometimes a long piece, and a measure of what never comes unasked (item 117).

Read first: AGENTS.md; core/AGENTS.md; docs/sessions/README.md (the order, and "Rules for every session": they are part of this prompt, the long pieces' rule above all); docs/QUEUE.md (status, standing rules, merge policy, items 102, 105 and 117); docs/LONGFORM.md; docs/DECISIONS.md (2026-11-14 the long pieces kept; 2026-11-22 and 2026-11-23); core/src/generator/ (spec.rs's bars draw, piece.rs, request.rs's length and journey, the long pieces' plan); data/characters.txt (each style's bars), data/longform.txt, data/codes.txt and core/src/code.rs (what a code carries; one version a release, item 105e); js/picks.js (journeyFor, LONG_FROM) and js/piece.js (what the page shows for a long piece); tools/gen-lib.mjs, tools/stats.mjs, tools/gen-golden.mjs.

Check your place: in docs/sessions/README.md every row in session 30i's After column should be ticked, and every hands session running now named in its Alongside. If not, stop and say so. If this file has a "Left" list at its top, an earlier session with this prompt stopped partway: start from that list.

Mikey (2026-11-23): "Longer bar lengths don't seem to show up when generating new tracks when I don't have any variables selected. It seems like the highest bar length that will be generated is 24 bars. I think this is a bug. Are there other things that aren't showing up in newly generated songs when nothing is selected in the various vibes options?" The brain's answer: by design a loop with no length asked is its style's own (2 to 24 bars; 32 in vapor and undertow, rarely), and a long piece comes only from the Bars picker. Asked whether "any bars" should sometimes be a long piece, he chose "Sometimes": about 1 new loop in 10 a long piece of 64 to 512 bars, with an arc or a wander drawn for it, every other loop keeping its sound.

The work, one PR (core, data, js/dlplayer.wasm rebuilt, BUILD and CACHE if the page changes):

1. The measure first, as a tool (tools/unasked.mjs or a mode of tools/stats.mjs): over 10,000 loops of the corpus seed with nothing asked, every value the generator can draw (each style, voice by layer, scale, key, meter and gait, length, journey, theme, each batch 6 sound and its kinds, each data choice) and how often it came, against the list of everything it can draw; whatever never comes unasked is listed. Read it before step 2 and put its list in the PR: for each, whether it is reachable only by a pick on purpose (a length past 32, a journey) or not at all (a bug: say so, fix it if small, or write it in the PR for the brain).
2. With no length asked, about 1 loop in 10 is a long piece: 64 to 512 bars, weighted toward the short end (yours to choose, conservative, written in the PR and marked "for Mikey's ears"), its journey an arc or a wander drawn with it. The draw is from its own stream, so every loop that stays short plays exactly as it does on main (the goldens of short loops unchanged: say which cases moved and why). The loop's own length stays its style's; the piece is sections of it, as a picked long length is. Endless is never drawn: it is only ever asked.
3. What the page shows follows the spec, not the picks: a drawn long piece gets the piece's line, "bar N/M", its journey on the card and its length in the Library, as a picked one does; the Vibe panel still reads "any bars" (nothing was picked). Check js/picks.js's journeyFor and js/piece.js's isLong, and say what you changed.
4. Codes: a loop with no length asked still writes no length (the draw is the seed's); an older code played in the app plays as the version it carries says, under item 105e's version filter. Say in the PR how the draw sits with the code's version; a drawn long piece's code round-trips to the same piece.

Yardsticks: the measure's list in the PR; over 10,000 loops with nothing asked, 9% to 11% long, every one between 64 and 512 bars with a journey; the goldens of short loops bit for bit as main, the moved cases named; the balance lock (node tools/stats.mjs --check) re-baselined only for the length and journey figures, said so; the longform workflow green on the last commit, its table keeping every check main kept; the core baseline; codes round-trip (the codes test); the gate. In for-mikey.md: two corpus seeds that draw a long piece with nothing asked, to hear (a time in each), and the measure's list in one line.

When you finish: add the merged PR's line to docs/DONE.md, keep the queue's status line current, tick session 30i's row in docs/sessions/README.md, and end with a plain summary for Mikey: what merged (PR numbers), what to listen for, and what you added to docs/notes/for-mikey.md. Do this session's work and stop: the next session has its own prompt.
````
