# Session 24c: the codes made ready to freeze (105e)

Written by brain B4 (2026-11-18), from its check of the version 2 format
against Mikey's line of 2026-11-17 ("I don't want code rot"): the format's
bytes are right and stay as they are; what is missing is how a code is read
once something it names is gone, a gap in what the version filter covers,
and the rule for when the version moves. Nothing here makes a code longer.
The format freezes at 1.0, so this runs before session 30.

- **Model:** Opus 5.5. **Effort:** high.
- **Start after:** session 30c (it may turn the album's `PACE` field into
  seconds, in the same file: `core/src/code.rs`). It may run alongside 30a,
  30b, 30d and 30e: it changes the core and `data/` only (the page reads
  the same calls), and the shared spots (`BUILD` and `CACHE`,
  `js/dlplayer.wasm`, the table, `for-mikey.md`).
- **Queue item:** item 105 ("105e").

Paste everything in the block as the session's first message.

````text
Hands session 24c on the road to Driftloom's 1.0 (Opus 5.5, high): the codes made ready to freeze (105e).

Read first: AGENTS.md; docs/sessions/README.md (the order, and "Rules for every session": they are part of this prompt); docs/QUEUE.md (status, standing rules, merge policy, item 105 and its "105e"); core/AGENTS.md; core/README.md ("Share codes"); data/codes.txt (its header: the rules); core/src/code.rs; core/src/generator/data.rs (`joined`, `there`); every caller of `data::there` (spec.rs, character.rs, render.rs); core/tests/codes.rs, core/tests/dummy.rs and core/tests/dummy/; data/choices.txt's batch 6 settings (tuningOffset, planingSevenths, lowBell, twang: drawn outside the list of choices); docs/DECISIONS.md ("Share codes, requests and exports" and "How the project runs": 2026-10-29, 2026-11-10 and 2026-11-17).

Check your place: in docs/sessions/README.md every row in session 24c's After should be ticked, and every hands session running now named in its Alongside. If not, stop and say so. If this file has a "Left" list at its top, start from that list.

Mikey, 2026-11-17: "It's okay for the song attached to a code to change; especially when it's an improvement ... I don't want code rot where we generate longer codes because we don't want to break what shorter codes made." And 2026-11-10: additions leave old codes as they sound (a version filter; it costs no characters). Brain B4 read the format against both and found four things to settle before the freeze. The bytes of a code do not change in any of them: every code written today reads the same after this session.

1. A removed member plays something close. Today a code naming an id the build no longer has is refused as "needs a newer version", and the codes test fails if a row in data/codes.txt names nothing, so nothing can ever be removed. Make removal a path: a removed member keeps its row (ids are never reused, so every id ever given stays in the file) marked gone, with a stand-in where one fits (`twang.kind`'s `slow` plays `soft`; a removed voice its layer's nearest; a removed option its choice's `today`), or dropped where nothing fits (a removed vibe or setting leaves the request without it; a removed journey leaves the length to the generator). Then the reader tells removed from newer without a longer code: an id with a row is this build's, gone or not; an id with no row is a newer build's (and a code whose version is not newer than this build's naming one is no code). A tag this build stopped writing is read and set aside, never refused. A number outside what a field takes today (a tempo past `TEMPO_LIMIT`, a setting past its range) plays the nearest it can, where a narrowed range would otherwise refuse an older code; a number no build ever wrote is still no code. Write the rule into data/codes.txt's header and core/README.md, beside the rule for additions.
   - First use, the case that exists: `twang.kind`'s `slow` and `bright`, which Mikey heard as "off" (2026-11-17) and which only a pin reaches now (data/choices.txt: "The code for slow and bright stays"). Take them out of the core, their rows gone with `soft` standing in; keep the `drawn` weights as they are (they choose which loops play twang, and the loops that play it keep playing soft). Every golden case and every corpus loop sounds the same (none pins them); say so in the PR with the counts.
2. The version filter covers every draw. Today the pools of profiles, moods, scales, voices, bass styles, choices and options are filtered by the code's version, but the words of a setting drawn per loop (`twang.kind`, `lowBell.kind`, `progression.kind`, and any other setting whose word a loop draws: `data/codes.txt`'s `[words ...]` lists; find which are drawn) are not, and nothing says a new drawn setting (a batch 6 kind of draw, counted against a loop's changes) must leave a loop drawn at an older version as it was. Filter the words of every drawn setting by version, and make a new drawn setting draw nothing below its version (the way the list of choices does). Write it into data/codes.txt's rules so the next sound added can't miss it.
3. The dummy build covers the rest. core/tests/dummy/ adds a profile, a melody voice, a vibe, a mood, an option and a choice drawn alone. Add, at version 3: a scale, a bass style, a voice in each other layer, a word of a drawn setting (a fourth `lowBell.kind`), a new drawn setting counted against changes, and a removed member of each kind (a vibe, a voice, an option, a word, a setting), with stand-ins and without. Then: every generation golden as a version 2 code still makes its hashes bit for bit (as today); a version 3 loop draws each addition; a version 2 code naming each removed member reads, and plays its stand-in or goes without, and loads with no lost notes; an id with no row is "needs a newer version"; the fuzzers never panic.
4. When the version moves. A code's head is one character while its version is 15 or under (`head = version * 2 + album`), two after. Today `newest` rises with every change that adds a member, so about fifteen such changes would make every code a character longer: code rot by the calendar. The rule becomes one version a release: members added since the last release share the next version (`released` beside `newest` in data/codes.txt; a new member takes `released + 1`; a release sets `released = newest`), so a code made on a build between releases can move when another addition joins the same version before the release. Mikey agreed (2026-11-18: "it's okay if those codes aren't exact"); make the rule and its check (the codes test fails if a member's `since` is past `released + 1`), nothing else.

Leave alone: the alphabet, the check, the field order, the tags' numbers, the pace (30c's), the name (#425), version 1's refusal.

Yardsticks: every code in core/golden/share-codes.txt and docs/ALBUMS.md reads as before, its bytes unchanged; `cargo test --test codes` and `cargo test --features dummy --test dummy` with the new cases; the generation goldens and the balance lock unmoved (`node tools/gen-golden.mjs --check`, `node tools/stats.mjs --check`; twang's removal moves neither, or the PR says which cases and why); the core baseline unmoved; a pinned `twang.kind=slow` code from main before this PR reads and plays soft; the gate.

When you finish: add the merged PR's line to docs/DONE.md, keep the queue's status line current, tick session 24c's row in docs/sessions/README.md (keep every cell's `|`), and end with a plain summary for Mikey: what merged (PR number), that codes read as before, and what waits in docs/notes/for-mikey.md. Do this session's work and stop.
````
