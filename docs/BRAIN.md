# Brain session handoff

Read this first in any new "brain" session. It is the working memory of the
project's planning side: how the work is organized, what he has heard, which
methods proved themselves, and where things stand. What Mikey has decided is
`docs/DECISIONS.md`; the log and history are in `docs/archive/brain-log.md`.
Keep **State** current as you go, not only at the end; a long session can
stop without warning.

## How the work is organized

Three roles.

- **Brain** -- a claude.ai chat in the *Driftloom* project (Mikey's
  nowmichaelclark Claude account since 2026-10-08). Analyzes, verifies, designs, and writes the queue. Does not write code.
- **Hands** -- Claude Code sessions. Write code, open PRs, measure, merge
  under the merge policy, and report.
- **Mikey** -- the ears. His listening is the acceptance test for anything
  that changes how the app sounds. He relays between brain and hands.
- **Ears** (since 2026-10-09) -- separate claude.ai chats that measure
  records Mikey loves against Ballad Falls renders and write findings with
  yardsticks (`docs/EARS.md`, `tools/ears/`, and the reports, plan and
  album cards in `docs/ears/`; read `docs/ears/sessions.md` for their
  scope and for the rule that their outputs live in the repo).
  They don't touch the queue or app code; the brain turns their findings
  into items.

The loop, since 2026-09-25:

1. The brain writes work into **`docs/QUEUE.md`**: numbered items with a
   why, a what, and yardsticks, under standing rules at the top (every new
   sound measured for level, cost and tone; conservative taste calls
   written down "for Mikey's ears"; stop and leave a note rather than
   guess).
2. Mikey tells the hands to continue with the queue. They work down it,
   one PR per item, and **merge their own PRs** when CI is green and every
   check passes (the queue's merge policy, "yes, from Mikey"). Claude
   Code's own safety check may flag a self-merge as "merge without
   review"; the policy line in the queue is the answer to that.
3. The brain **verifies independently** from GitHub -- fetches main, runs
   the tests and the balance lock, renders loops before and after with
   its own metrics. Reports from the hands have been wrong in instructive
   ways (see Methods).
4. The brain builds **listening albums** for what changed; Mikey listens
   when he has time, and his verdicts become new queue items.

Mikey's point, and the reason for step 4: the one thing nobody in this loop
can do except him is hear it. Numbers check the ear; they do not replace
it.

**Two tracks while the core is built (Mikey, 2026-10-13: yes, the app
keeps changing alongside the phases).** The **core track** is the
charter's phases (`docs/CORE.md`), queue items 42 on. The **app track**
is everything else: bug fixes, Painter redesigns, vibe tuning, new
buttons and menus. Both merge to `main`; the rules that keep them from
colliding:
- Each change is its own PR from the latest `main`; the second to merge
  takes the next `BUILD` / `CACHE` number. Core-track and app-track
  sessions don't share a branch.
- **Free any time:** the look (`css/`, `design/`, icons, themes),
  menus and views that don't touch playback, Library, covers, text.
- **Vibe tuning** (`data/vibes.txt`): free since item 78 (v130): the vibes
  are plain text the core's generator compiles in (`docs/VIBES.md`, "How to
  edit a vibe").
- **Generator changes** (profiles, moods, choices): since item 97 there is
  one generator, the core's (`core/src/generator/`, its data in
  `data/*.txt`), held by the generation goldens. Hands' work, through the
  queue.
- **Audio bugs:** in `core/`, they go through the brain into the core
  track's queue (the hands there own those files); in the JavaScript
  synth, only if testers actually hear the fallback.
- **New controls for core features** (request pickers, export, stereo):
  a Painter session can design them now; they are wired up once the
  core feature exists (requests after phase 2, export in phase 7).
  Wiring the bars and tempo pickers to today's generator first is fine
  if cheap; phase 3 replaces the plumbing anyway.
- **Around phase 3** (the page stops scheduling notes and only sends
  commands), changes to playback controls wait for it, or go through
  the brain.

Only one brain chat edits these files at a time. Long chats get slow and
lose detail; start a fresh brain chat per phase (the words, the Rust port)
and a fresh hands chat per phase too, since the queue file carries
everything a session needs.

**The docs stay small (since 2026-10-26).** Each role loads only its own
live docs (`docs/README.md` is the map), so a doc holds what is live and
nothing else. Since the slim after 1.0 (2026-11-26) there is no archive
folder: the history before then is listed in `docs/archived.txt` (readable
at the commit it names, and in the driftloom repository). Don't rewrite
decisions.

- **Every brain session ends with a clean-up pass.** Take what is finished
  out of the live docs, as Broken Friends deletes a finished row: a
  finished item from `docs/QUEUE.md`, a note it has read and answered from
  `docs/notes/`. The PR that takes it out says what it was; git keeps the
  text. The session's own log goes in its PR's body. The long reasoning
  behind a decision goes in the PR too, leaving the decision itself as one
  dated line in `docs/DECISIONS.md`. Then run `node tools/check-docs.mjs`
  (it also fails on a pointer to a doc that is gone).
- **The bird's-eye pass** (the brain is Broken Friends' Bird's-eye lead):
  sort `docs/inbox.md` (each line becomes an item, stays, or leaves), give
  each new item a type from `docs/briefs/README.md` and a model and effort,
  and write the queue's status table again. Each week, run `python3
  tools/workflow-cost.py`; if a number climbs two weeks in a row, queue a
  Hygiene session.
- **The limits,** checked in CI by that script: `AGENTS.md` 9 KB,
  `core/AGENTS.md` 10 KB, `docs/QUEUE.md` 80 KB, `docs/BRAIN.md` 50 KB,
  `docs/DECISIONS.md` 40 KB, and the queue's status 40 lines. Over one, CI fails with "take the finished
  parts out".
- **Each new decision of Mikey's** is one dated line in `docs/DECISIONS.md`
  under its topic, written in his words, the day he made it.

## Getting oriented

- Repo (public): `https://github.com/nowmichaelclark/balladfalls`, a copy
  of `nowmichaelclark/driftloom` (2026-11-25) with its main, history and
  tags; PR numbers and Actions runs before the copy (#1 to #483) are
  driftloom's, read there (archived at 1.0). A PR: `git fetch origin
  pull/N/head:prN`. Driftloom moved from `Kruu-Mikey/driftloom` on
  2026-10-08 with its history, PR numbers and branches.
- Live: `https://balladfalls.com/` (session 31a; until 31 merges it, the
  testers' site is still the old address, built from the frozen driftloom).
  Cloudflare Workers, assets only (`wrangler.jsonc`, the Worker
  `balladfalls`). Push to `main` deploys. The old address's Worker is
  `old-address/` (deployed on launch day: `docs/notes/for-mikey.md`). Every PR gets preview deploys: the Cloudflare bot's PR
  comment has the branch and **commit** preview URLs (use the commit one;
  it never moves), and when the bot doesn't comment, the Workers Builds
  check run's output carries the commit preview URL. An old commit's
  preview stays live, which is what makes A/Bs across merged PRs possible.
  Since the move, PR branches build as Cloudflare **Previews**: the commit
  link is the Deployment URL, `<deployment-id>-balladfalls...` (`-driftloom...` before the copy); the
  branch's Preview URL moves (see Session 5 in State). Previews from the
  old account's links in the Done lists (`docs/DONE.md`,
  `docs/archive/done.md`) depend on that account.
- The app's Diagnostics panel reports `build` (bump `BUILD` in `js/main.js`
  and `CACHE` in `sw.js` together on every app change), `sw` state, and
  `choir`.
- Read `docs/README.md` (the map of the docs), `docs/DECISIONS.md`,
  `docs/QUEUE.md`, `docs/MOODS.md`, `docs/ALBUMS.md`, `ROADMAP.md` and
  `README.md` (a short front page since 2026-10-08). The engineering notes
  (`docs/archive/engineering-notes.md`, the README's old body) and the
  performance baseline (`docs/archive/perf-baseline.md`) are archived
  (`docs/archived.txt`; the wiki's Ballad Falls pages explain the same
  parts): open them when a question needs them. `Mikey's Thoughts.md` is
  his.
- Credentials: Mikey pastes a GitHub token in the session's opening
  message. With it the brain commits and merges **docs-only** changes --
  `docs/*.md`, `ROADMAP.md`, `README.md` -- through small PRs it merges
  itself. Once item 38a lands, also **`data/vibes.txt`** (the vibe recipes,
  data only, since item 78 in plain text; bump `BUILD` and `CACHE` with it, and merge only when CI is
  green: a test checks every recipe's names; since item 82 the same PR
  rewrites `core/golden/generation.hashes` and rebuilds `js/dlplayer.wasm`,
  `docs/VIBES.md`). Brain's call, Session 16,
  so tuning a vibe is an edit rather than a hands session. Code stays with the hands. Never write the token into a file, a
  commit, memory, Project knowledge, or a brief. Mikey manages his own
  tokens. Commits are authored as
  `Mikey <162073748+nowmichaelclark@users.noreply.github.com>` (Kruu
  Mikey before 2026-10-08).
- In a claude.ai brain session the GitHub API answers 403 for the repo
  until it is attached to the session (`add_repo` with push access);
  after that `gh api` (REST only, no GraphQL) and pushes work with the
  token. The shell can't reach workers.dev: check the live site with
  WebFetch.
- Things that tripped the hands before: a Claude Code session may push
  only to its one designated branch, so an open draft PR on that branch
  (like the never-to-merge drum knob, #42) blocks the next PR -- close it
  first. The hands can't retry a failed Cloudflare build (one failed with
  no log, #51); Mikey retries it from the check's Details link, or simply
  merges, since main redeploys. Their sandbox can't fetch workers.dev, so
  the brain checks previews. Sessions hit usage limits mid-item; the
  queue and the branch make resuming cheap.
- The brain's container: one core; `/tmp` does not survive between
  sessions; a background run must start with `setsid` or it dies when the
  tool call returns; `measure.mjs` takes a second or two per loop (in Node,
  on the player), so 100 loops is a few minutes. Playwright, for the tools
  that drive the app, is installed globally (`NODE_PATH=$(npm root -g)`).

## Listening albums

The app's **Paste a code** button takes an album code and
imports every loop in order.

- `js/share.js` exports `encodeAlbum(title, specs)` and `decodeAlbum`, and
  runs in Node. Since item 97 the specs come from the core: in Node,
  `tools/gen-lib.mjs`'s `newSpec(seed, request)` and `render(spec)` (the
  tools' build, `tools/build-core.sh --tools`; filter on `meta`, `choices`),
  or `decodeSong(code)`; encode, and round-trip-check the order. To render
  what the app plays: `tools/play-lib.mjs` (`player`, `render`), in Node.
  To render an old build's app, a worktree of it and its own page in
  Chromium (B1's scratch was a copy of that build's `tools/golden-export.mjs`
  writing the core node's stereo output).
- **Never type a code out.** Print it in tool output and copy it from
  there, then decode what you are about to send. The first brain session
  produced a plausible code from nothing; the app's checksum rejected it.
- **Blind tests:** shuffle with a fixed seed. Prefer albums whose key can
  be read back from the code itself (the loop's mood, voice, profile or
  `developmentOf`), so nothing needs storing. Albums out for listening go
  in `docs/ALBUMS.md` with how to read their key. **Never write a key into
  a public file before Mikey has answered** -- the brain slipped once
  (#35, taken back in #36).
- **A/Bs:** play the same album on two commit previews, labeled X and Y,
  randomly assigned. If the change is synth-only, both previews render the
  same loops. A control track that didn't change is worth including: it
  measures his test-retest noise.
- **Labeled albums** (keep / tune / drop) for new sounds; **blind A/Bs**
  only when a change alters sounds he already likes (the middle path).
- He rates in one word per track, and describes freely when asked.

## What Mikey has decided

Moved to `docs/DECISIONS.md` (2026-10-26): one dated line each, grouped by
topic. The long reasoning is in `docs/archive/decisions-reasoning.md`.

## What he has heard

| album | verdict |
|---|---|
| Choir quiz (seed 4127) | 5/5 found, no false picks |
| Lead audition (blind, 12) | saw, moog, analoglead harsh; musicbox, kalimba, stab fine |
| Drums (blind, 12) | drums within a loop mostly right; two mild flags at the far end of drums-over-music |
| Coming in (14) | never reached up; every complaint a drum loop |
| Shrine bells (5) | melody bells fine; chord temple bell buried (lifted in #106) |
| Missing layers (6) | five "complete": fewer layers are variety |
| Six eight (A/B, 8) | new offbeat and stutter won; old won where chords entered on a weak eighth |
| Six eight, part two (A/B, 8) | rhythm section: keep the cross-rhythm; new hat accents won |
| Drum knob (3 levels x 14) | drum level not the cause; the pluck and saw leads were |
| Lead trims (A/B, 14) | volume reaches 5 -> 0 |
| Softer winds (A/B, 8) | trims kept; the ocarina over drums preferred louder (watch) |
| Fiddle and accordion, take one (6) | "a toy fiddle and accordion played badly by a child" -> rebuilt |
| Review album (19) | take two keep; nylon smeared and pan flute static (both fixed, #74, #75); cinder keep; wayfare drums wrong (#79, then #82: "pretty nice") |
| Depth (blind, 8) | development heard at 24 and 32 bars; weak at 16 (second pass #108) |
| Depth two (blind, 6 x 16 bars) | 4/4 developing "goes somewhere"; simple: 1 goes somewhere, 1 loops (and looping is welcome sometimes) |
| Rust, all voices (10, core on, phone) | "it sounded great!" |
| Phase 1 check (blind A/B, 9, v92 vs v99) | "everything sounds the same on both versions"; no difference he could hear |
| Session 26 (the sound batch, 3 albums + clips, v123) | every new sound and mixing idea kept; bass +3 dB with a kick, today's without; lateFloor's second arrival should vary; stereo vs mono: "same" on 5 of 6 (and the null), stereo "just barely" nicer on the sixth |
| Lite Room Album (item 85c, 6 loops before and after, lite) | "it sounded great for lite mode"; the steal goes to full quality too (item 85e) |
| 87b on his devices (v142 preview) | Moto stays on full (busiest 18-24%, no late notes); tablet moved to lite by itself (75% at full; on lite 55%, 40% of real time); the switch "doesn't bother" him, a crossfade in phase 3; the tablet lost 10 notes at two new loops: folded into phase 3 (the queue's "For phase 3") |
| Long Pieces Album (v164, 33 clips, 3 blind pairs, 2026-11-14) | all ten pieces Keep; composed chosen over before (brum-yei's B); a wander move and the control Same; arc "good enough for now"; joins welcome, wander right, endings real |
| Phase 2 Blind Album (v128 against v149, 11 pairs, 2026-11-07) | the null pair Same; no pair worse for phase 2 apart from item 84's downward octave moves (old preferred 2 of 3); upward moves new preferred 3 of 3: 84b after phase 3; the stab chords "Fine" in all three |
| Batch 6 Album (v177, 15 labeled cards and 7 blind pairs, 2026-11-17) | every batch 6 sound Keep but twang: soft only (bright and slow "sounded off"); 84b's nearer chords chosen 5 of 6, the control Same |

## Methods that proved themselves

- **Verify every report from the hands**, with the brain's own measure where
  possible. Past misses: `figureRepeat` measured the motif before its
  transforms; a claimed cause was worth a third of what was said; a probe
  "showed the budget coping" and was wrong.
- **Render, don't guess.** The brain's hypotheses were wrong often enough
  to label them "unproven": the loud-and-squeezed theory (#24), "drums too
  loud" (it was the melody voice), all three pan-flute suspects (it was
  grace notes shorter than the attack). Queue items name suspects and ask
  the hands to find the cause by rendering.
- **Group ratings by feature.** The drum complaints resolved when the
  flagged loops were grouped by melody voice.
- **Briefs get taken literally.** "Steady, the same shapes on every kit"
  produced static drums (#79). Say the intent and give yardsticks for
  what must not be lost (variety, dynamics), not only constraints.
- **Targets come from something Mikey likes** -- the flute's 2-5 kHz share
  for tone, tide's hand-kit jig for drum level and variety, kalimba for
  loudness -- not a number the brain guessed.
- **Measure what reaches the ear** -- emitted events and rendered audio --
  not internal state. Short notes (0.4 s, near the app's median melody
  note) calibrate level; long ones flatter or hide ringing voices.
- **Controls and repeats.** Identical audio on two links drew different
  ratings; a control track and patterns consistent across passes separate
  signal from noise.
- **Span is the guard metric** for melodic changes; **move the figure,
  never a note**; **articulation lives in the synth** (drawn from
  `Math.random`), and the composer annotates with derived values only.
- **Seed-derived decisions use a salted RNG** (`spec.seed ^ SALT`) so loops
  that don't take the feature render exactly as before; it keeps A/Bs
  clean.
- **Measure against the same moment before** (brain B3): a join, an arc's
  energy, a wander's move, rendered at the commit before the change and now
  and compared span by span, separates what the plan did from what the loop
  always did; the hands' checks (clicks, steps) passed three holes.
- Single-stage bisects mislead when stages interact. One fixed curve
  applied everywhere becomes a mannerism.

## Tools

- `test/generator.test.mjs` -- the tests; run three times.
- `tools/stats.mjs` -- corpus statistics. `--seed`, `--n`,
  `--lift-low/--lift-high`, `--choir-quiz [file]`, `--voice-codes <voice>`,
  `--check` and `--write-baseline` (the balance lock,
  `test/stats-baseline.json`, n=10000), `--drums <profiles>` (drum
  variety), `--depth` (composition depth, developing vs simple).
- `tools/measure.mjs` -- offline audio on the player, in Node (no
  browser; queue item 96): LUFS, LRA, peak, crest, per-layer levels, punch
  figures, what the master chain did; `--voice all|names` (tone and level
  by layer, `--note` for note length), `--refusals` (`--quality lite`),
  `--profile <id>`, `--vibes`, `--request`, `--vibe-mix`, `--stereo`,
  `--endings` (cut-off notes), `--json`, `--seed`. Same options, same
  numbers, to the bit. `node tools/meter.mjs --selftest` checks the meter.
- `tools/perf.mjs` -- live performance in headless Chromium under CPU
  throttling: audio health, main-thread cost, graph churn, memory, time
  to first sound, page weight, hidden tab; `--ab` for before/after.
  Baseline in `docs/archive/perf-baseline.md`.
- `tools/listen.mjs` -- one-command albums; still not built (roadmap 20).
- `tools/check-docs.mjs` -- the size limits on the live docs (see "The docs
  stay small"); CI runs it.

## State -- 2026-11-26

### Start here (for the next brain)

- **1.0 is out (2026-11-26, a docs pass in a cloud thread at Mikey's word;
  no app change since v222).** The `v1.0` tag on d723b80 (made on the
  Releases page, since the session's push was refused) and its release,
  "Ballad Falls 1.0", with `balladfalls-1.0.apk` signed by GitHub from the
  repository's secrets (#4: apksigner 34, the certificate's SHA-256 checked
  against the release key's; a later tag signs itself). balladfalls.com
  serves `main`. The old address
  (`driftloom.nowmichaelclark.workers.dev`, the `driftloom` Worker built from
  `old-address/` on `main`, #5 and #6) answers every path with a 301 to the
  new one, a shared loop playing there (seen 2026-11-25). The driftloom
  repository is archived, read-only with its PRs. **F-Droid:** the merge
  request [fdroid/fdroiddata!59136](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/59136)
  ("New app: Ballad Falls", 2026-11-25, from Mikey's GitLab fork) waits for
  F-Droid's reviewers; its recipe names #7's merge, 8b9750c, as 1.0's commit
  (the listing's screenshots retaken there; the app the same bytes as
  d723b80's). **Open:** that review (questions are answered in the merge
  request; the recipe's comments hold the reasons), then `APP_LINK` once the
  listing is up; the phone checks in `docs/notes/for-mikey.md`, none holding
  anything; then the queue's first item after 1.0, the known issue "The app
  drops a code's version", before any new sound. 75 low, 37 on hold.

- **Brain B5, the release check (2026-11-25, run in B-parallel 5's thread
  at Mikey's word to carry the plan on): 1.0 is go at v218.** Read back:
  session 30's #479 to #482 (the weak checks fixed, each shown failing on
  its fault; reset counters in a browser, v217; the tone clamped, 5139
  goldens unchanged, v218; the docs cut), each head green; the ten rows
  45550491670 and the nightly 45550557717 green on v218 (19 jobs: six
  targets' golden renders, 24 hours of Endless, the long pieces' joins and
  table, the rates); the gate green on main 65ab842; item 115 closed by his
  ears ("There are no more crackles"); `data/codes.txt` has no member added
  since 24c's rule (its last change, 1541058, was the rule's words); the
  F-Droid recipe and lint green on 4ddf186, MIT, no network permission,
  the listing's words plain; his own key made (2026-11-25, its SHA-256 in
  `docs/DECISIONS.md`) and the release id confirmed. **Holds 31, not 31a:**
  the Moto's step 1 (ten minutes with the screen off and its Diagnostics:
  promise 1 on a phone; no figures from his phones yet) and the icon on his
  phone. Every other line in `docs/notes/for-mikey.md` is left for after
  1.0, safe because each is a check of something shipped, with a revert.
  **Next:** this repository frozen at this PR's merge (tag
  `driftloom-final`), Mikey creates the new repository (public, empty) and
  gives the Claude app access; the brain copies main, the tags and #465's
  branch into it; Mikey makes its Worker and attaches the domain; then 31a
  there (its prompt now says so), then 31. Views at 4x and 6x and
  `autolite.mjs` were not run by hand in 30: not for 1.0 (the nightly's
  checks and the ten rows cover the app's controls).
- **Brain B-parallel 5 (Opus 5.5, 2026-11-24, a cloud thread of the
  claude.ai Driftloom project on Mikey's other account; the next is session
  30, then B5).** Hands sessions ran as threads of the project (Mikey: "Start
  them as threads here"), from opening messages in its files
  (`brain/bpar5/`); Mikey saw only the icon, the brain the rest
  (`docs/DECISIONS.md`, 2026-11-24). GitHub through its MCP tools (read,
  logs, re-runs, dispatches, merges); the `gh` CLI's token there is invalid
  (read-only `gh run list` works), and CI's artifact host
  (`*.blob.core.windows.net`) is blocked, so an APK goes to Mikey as the
  run's artifact link. **Merged:** #467 (30m, v207, the album export; its
  `flac` job had timed out twice while apt fetched ffmpeg's recommends,
  fixed with `--no-install-recommends` and a cache), #468 (30k, v209, the
  look; ten rows 45363700558, 10 of 10), #472 (30n, v211, the keys; ten
  passes 45388776278; the switch kept out of the backup like Mono, the
  brain's call: the backup holds loops and albums only), #473 to #476 (30g's
  Left list, v213 to v215: every command timed natively, Init's compressors
  kept, 178% to 42% of a callback; the native renders clean; Lite by hand
  fades over; the lock screen's Play after two minutes paused fixed; Lite's
  50% line kept on the emulator's burn sweep; ten rows 45457406778), and
  the docs #470, #471. **Nightlies** green on v206 (45354665649), v211
  (45410614887) and v215 (45464909251). **Open:** 30l, draft #465 (v216, a
  placeholder): Mikey picked round 20's c (2026-11-25), built, all 28
  checks green on 81c8bd0; 31 merges it. **Session 30** started
  2026-11-24 as a project thread. **Waits on Mikey (not holding 30):** the
  icon on his phone (#465's APK); the new domain, attached at 31a's start;
  the phone checks in
  `docs/notes/for-mikey.md` (Chrome's scroll, the keys, the album export,
  item 115's v215 test). **Learned:** GitHub runs no pull_request workflow
  while a PR conflicts with main (30k's CI never started until main was
  merged in); a job's timeout can be its install, not its check (read the
  log's last lines before re-running); export dispatches and PR runs are
  separate concurrency groups, but a by-hand nightly is cancelled by a
  scheduled one on the same commit.
- Brains B4, B-parallel 3, B-parallel 4, B3 and B2's bullets, as they stood:
  `docs/archive/brain-log.md`, "Start here before 1.0's release"; B-parallel
  and B-parallel 2's (the chains, sessions 17 to 29, 30a and 30b): "Start
  here before B-parallel 3".
- Brain B1's "Start here" bullets (the road's kickoff, sessions 01 to 15 as checked): `docs/archive/brain-log.md`, "Start here before B2".
- Sessions 29 and 30's "Start here" bullets (phase 2's proof, phase 3's
  items, the road to 1.0 written): `docs/archive/brain-log.md`, "Start here
  before B1".
- **Waiting on Mikey, not urgent:** the Full Room Album (85e,
  <https://claude.ai/artifact/NmfNUM1hj6buNUHKZzG9of>, on his second
  account); the blind album's in-app checklist for bars and length (88b),
  which he left blank.
- **Ears:** Ears 10, 10b and 11 done (piles 4 and 5, #314, #316, #326),
  on Mikey's second account; Ears 12 done (#329, 2026-11-07: Synthesist,
  Animal Crossing and three Nonlocal Forecast cards); Ears 12b done (#332,
  2026-11-08: *Triangular Reformat*, *Pyramid*, six more K.K. songs, and
  `theory.py`'s colors reading past the seventh). Ears 13 (the second
  synthesis) done in a cloud session (#336, 2026-11-08): batch 6, twelve
  candidates; five sketched on the core (lowBell, padWow, colorTone,
  deepDuck, wideSweep), clips on the throwaway branch `ears13-clips`
  (deleted; Mikey approved all five and the sampler, 2026-11-08, both
  versions where there are two); seven wait on hooks, queued as item 99
  (the sketch build only), then an Ears 13b sketches them. The approved
  batch is built after phase 3, the second synthesis (Opus 5.5, high).
  Mikey asked (2026-11-07) whether the ears must finish by a phase: no; Ears
  12-13 by the end of phase 3, for the batch after it; piles 7-18 have no
  deadline (phase 5's block catalogue, long-form composing, phase 8).
- **Broken Friends:** the game restarted in 3D in November 2026, and its
  2D version's core extension is in its `archive/2d/`. The note for a game
  that hosts the core (`docs/notes/82-for-broken-friends.md`: the calls, the
  hashes) left the tree after 1.0 (`docs/archived.txt`); the wiki's
  "Ballad Falls/In Broken Friends" explains the same calls. Nothing for the
  brain to answer until the game brings the core back.
- **Vibe edits since item 82** move the generation goldens and
  `js/dlplayer.wasm` too: `docs/VIBES.md`, "How to edit a vibe". This
  container runs Node, the pinned Rust (`rustup` installs it from
  `core/rust-toolchain.toml`) and Chromium (`/opt/pw-browsers`), so the
  brain does both steps itself in a vibe PR.
- **Next picks:** the design's two open questions were answered by Mikey on
  2026-10-14 (`design/next-picks.md`, "Decided": leave an album to see the
  picks; an any key in each picker; the key reads "vibe"). Next Painter work:
  the tempo, key and scale, style and voices pickers and the "can't do that"
  line; long-piece display (`docs/PAINTER.md`, section 2) before item 53.
- **Ears:** the pause (until Session 26's album was heard) is over; it was
  heard 2026-10-29. Item 83 gives them sketches and clips on the core.
- **New profiles and sounds** go in with Ears 13's batch, after phase 3 and
  before phase 4 (one generator by then). **Before phase 5:** the block
  catalogue for Mikey (charter, promise 5).
- **Still open, not urgent:** the Pixel 10a's 1.3-1.8 s main-thread stalls
  (item 41) were never reproduced, and no report has come since v92; item
  75 (the reverb, rate-true) for a session with usage to spare; item 37 on
  hold.
- Older "Start here" bullets (Sessions 18-26 and the plan to phase 2), as
  they stood: `docs/archive/brain-log.md`, "Start here before Session 28";
  Session 28's own bullet is its log entry.

### The log

Moved to `docs/archive/brain-log.md` (2026-10-26), newest first. A brain
session's own entry goes there at its archive pass.

## History

Moved to `docs/archive/brain-log.md`, below the log.
