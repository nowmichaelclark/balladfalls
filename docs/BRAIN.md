# Brain: the planning side

Read this first in a new brain session. It is the working memory of the
planning side: how the work is organized, what Mikey has heard, which
methods work, and where things stand now. `docs/DECISIONS.md` holds what
Mikey has decided. Keep "State" current as you work, not only at the end,
because a long session can stop without warning.

## How the work is organized

### The roles

- **Brain:** a claude.ai chat in the project (Mikey's nowmichaelclark
  account). It analyzes, checks, designs and writes the queue. It does not
  write code.
- **Hands:** Claude Code sessions. They write code, open PRs, measure, merge
  under the merge policy, and report.
- **Research:** a hands session type (`docs/briefs/research.md`). It writes
  what is known into the wiki, and it measures records that Mikey loves
  against Ballad Falls with `tools/ears/`. The brain turns its findings into
  items. The wiki page "What the ears found" has the findings so far.
- **Painter:** design sessions for the look and the screens
  (`docs/PAINTER.md`).
- **Mikey:** the ears. His listening is the acceptance test for anything that
  changes how the app sounds.

### The cycle

1. The brain writes the work into **`docs/QUEUE.md`**: numbered items, each
   with a why, a what and its checks, under the standing rules at the top.
2. Mikey tells the hands to go on with the queue. They do one PR for each
   item, and **merge their own PRs** when CI is green and every check passes
   (the queue's merge policy; Mikey said yes). Claude Code's safety check can
   flag a self-merge as "merge without review". The policy line in the queue
   is the answer.
3. The brain **checks each result itself** from GitHub: it fetches `main`,
   runs the tests and the balance lock, and renders loops before and after
   with its own measures. Reports from the hands have been wrong in useful
   ways (see "Methods").
4. The brain builds **listening albums** for what changed. Mikey listens when
   he has time, and his verdicts become new queue items.

Only Mikey can hear the music. Numbers check the ear; they do not replace it.

The session types and their order are in `docs/briefs/README.md`. The brain
is the "bird's-eye" type.

### Two tracks

The **core track** is the charter's phases (`docs/CORE.md`). The **app
track** is everything else: fixes, Painter redesigns, vibe tuning, new
buttons and menus. Both merge to `main`. These rules keep them apart:

- Each change is its own PR from the latest `main`. The second PR to merge
  takes the next `BUILD` and `CACHE` number. The two tracks do not share a
  branch.
- **Free at any time:** the look (`css/`, `design/`, icons, themes), menus
  and views that do not touch playback, the Library, covers and text.
- **Vibe tuning** (`data/vibes.txt`): the vibes are plain text that the core
  compiles in (`docs/VIBES.md`, "How to edit a vibe").
- **Generator changes** (profiles, moods, choices) are in the core
  (`core/src/generator/`, with its data in `data/*.txt`), held by the
  generation goldens. They are the hands' work, through the queue.
- **Audio bugs** in `core/` go through the brain into the queue.
- **New controls for a core feature:** a Painter session can design them
  first, and the hands connect them when the core feature exists.

Only one brain chat edits these files at a time. A long chat gets slow and
loses detail. So start a fresh brain chat for each large step, and a fresh
hands chat too: the queue carries everything that a session needs.

### The docs stay small

Each role reads only its own docs (`docs/README.md` is the map), so a doc
holds only what is live. Do not rewrite a decision.

- **End every brain session with a clean-up pass.** Take finished work out
  of the live docs: a finished item from `docs/QUEUE.md`, and an answered
  note from `docs/notes/`. The PR that takes it out says what it was, and git
  keeps the text. Put the session's own log in its PR's body. Put the long
  reasoning behind a decision in the PR too, and leave the decision as one
  dated line in `docs/DECISIONS.md`. Then run `node tools/check-docs.mjs`.
- **The bird's-eye pass:** sort `docs/inbox.md` (each line becomes an item,
  stays, or leaves). Give each new item a type from `docs/briefs/README.md`,
  a model and an effort, and write the queue's status table again. Each
  week, run `python3 tools/workflow-cost.py`. If a number climbs two weeks in
  a row, queue a Hygiene session.
- **The limits**, checked in CI: `AGENTS.md` 9 KB, `core/AGENTS.md` 10 KB,
  `docs/QUEUE.md` 80 KB, `docs/BRAIN.md` 50 KB, `docs/DECISIONS.md` 40 KB,
  and the queue's status 40 lines. If a doc goes over, CI fails with "take
  the finished parts out".
- **Write each new decision of Mikey's** as one dated line in
  `docs/DECISIONS.md`, under its topic, in his words, on the day he made it.

## Getting oriented

- **The repository** (public): <https://github.com/nowmichaelclark/balladfalls>.
  It is a copy of `nowmichaelclark/driftloom` (2026-11-25), with its history
  and tags. PR numbers #1 to #483 and the Actions runs before the copy
  belong to driftloom: read them there (it is archived). To read a PR
  locally, run `git fetch origin pull/N/head:prN`.
- **The live site:** <https://balladfalls.com/>, on Cloudflare Workers,
  assets only (`wrangler.jsonc`, the Worker `balladfalls`). A push to `main`
  deploys. The old address is the Worker in `old-address/`, which sends
  every path on to the new one.
- **Previews:** every PR gets preview deploys. The Cloudflare bot's comment
  on the PR has the branch and **commit** preview URLs. Use the commit one,
  because it never moves. If the bot does not comment, the Workers Builds
  check run carries the commit preview URL. An old commit's preview stays
  live, so you can make an A/B across merged PRs.
- **Diagnostics** in the app shows `build` (bump `BUILD` in `js/main.js` and
  `CACHE` in `sw.js` together on every app change), the service worker's
  state, and `choir`.
- **Read** `docs/README.md` (the map), `docs/DECISIONS.md`, `docs/QUEUE.md`,
  `docs/MOODS.md`, `docs/ALBUMS.md`, `ROADMAP.md` and `README.md`. The wiki's
  Ballad Falls pages explain how the parts work. `Mikey's Thoughts.md` is
  his.
- **Credentials:** Mikey pastes a GitHub token in the session's first
  message. With it, the brain commits and merges **docs-only** changes
  (`docs/*.md`, `ROADMAP.md`, `README.md`) through small PRs that it merges
  itself. It may also change **`data/vibes.txt`**: bump `BUILD` and `CACHE`
  with it, rewrite `core/golden/generation.hashes`, rebuild
  `js/dlplayer.wasm`, and merge only when CI is green (`docs/VIBES.md`). Code
  stays with the hands. **Never write the token** into a file, a commit,
  memory, Project knowledge or a brief. Commits are authored as
  `Mikey <162073748+nowmichaelclark@users.noreply.github.com>`.
- **In a claude.ai brain session,** the GitHub API answers 403 until the
  repository is attached to the session (`add_repo` with push access). After
  that, `gh api` (REST only, no GraphQL) and pushes work with the token. The
  shell cannot reach workers.dev, so check the live site with WebFetch.
- **What trips the hands:**
  - A Claude Code session may push only to its one branch. So an open draft
    PR on that branch blocks the next PR. Close it first.
  - The hands cannot retry a failed Cloudflare build. Mikey retries it from
    the check's Details link, or merges, because `main` deploys again.
  - Their sandbox cannot fetch workers.dev, so the brain checks previews.
  - Sessions hit usage limits in the middle of an item. The queue and the
    branch make it cheap to resume.
  - GitHub runs no `pull_request` workflow while a PR conflicts with `main`.
    Merge `main` in first.
  - A job's timeout can come from its install, not its check. Read the last
    lines of the log before you run it again.
- **The brain's container** has one core. `/tmp` does not survive between
  sessions. A background run must start with `setsid`, or it stops when the
  tool call returns. `measure.mjs` takes a second or two for each loop, so
  100 loops take a few minutes. Playwright is installed globally
  (`NODE_PATH=$(npm root -g)`). The container runs Node, the pinned Rust
  (`rustup` installs it from `core/rust-toolchain.toml`) and Chromium
  (`/opt/pw-browsers`).

## Listening albums

The app's **Paste a code** button takes an album code and imports every loop
in order.

- **Make the specs and the code in Node.** `js/share.js` exports
  `encodeAlbum(title, specs)` and `decodeAlbum`. Make the specs with
  `tools/gen-lib.mjs`'s `newSpec(seed, request)` and `render(spec)` (after
  `tools/build-core.sh --tools`; filter on `meta` and `choices`), or with
  `decodeSong(code)`. Encode, then round-trip to check the order. To render
  what the app plays, use `tools/play-lib.mjs` (`player`, `render`).
- **Never type a code by hand.** Print it in a tool's output and copy it from
  there, then decode what you are about to send. The first brain session
  made a plausible code from nothing, and the app's checksum refused it.
- **Blind tests:** shuffle with a fixed seed. Prefer albums whose key can be
  read back from the code itself (the loop's mood, voice, profile or
  development), so nothing needs to be stored. Put an album that is out for
  listening in `docs/ALBUMS.md`, with how to read its key. **Never write a
  key into a public file before Mikey answers.**
- **A/Bs:** play the same album on two commit previews, labeled X and Y at
  random. If the change touches only the synth, both previews render the same
  loops. Add a control track that did not change: it measures how much his
  ratings vary on their own.
- Use **labeled albums** (keep, tune or drop) for new sounds, and **blind
  A/Bs** only when a change alters sounds that he already likes.
- He rates each track in one word, and describes freely when asked.

## What he has heard

| Album | Verdict |
|---|---|
| Choir quiz (seed 4127) | 5/5 found, no false picks |
| Lead audition (blind, 12) | saw, moog, analoglead harsh; musicbox, kalimba, stab fine |
| Drums (blind, 12) | drums within a loop mostly right; two mild flags at the far end of drums-over-music |
| Coming in (14) | never reached up; every complaint a drum loop |
| Shrine bells (5) | melody bells fine; chord temple bell buried (then lifted) |
| Missing layers (6) | five "complete": fewer layers are variety |
| Six eight (A/B, 8) | new offbeat and stutter won; old won where chords entered on a weak eighth |
| Six eight, part two (A/B, 8) | rhythm section: keep the cross-rhythm; new hat accents won |
| Drum knob (3 levels x 14) | drum level not the cause; the pluck and saw leads were |
| Lead trims (A/B, 14) | volume reaches 5 -> 0 |
| Softer winds (A/B, 8) | trims kept; the ocarina over drums preferred louder (watch) |
| Fiddle and accordion, take one (6) | "a toy fiddle and accordion played badly by a child" -> rebuilt |
| Review album (19) | take two keep; nylon smeared and pan flute static (both fixed); cinder keep; wayfare drums wrong, then "pretty nice" |
| Depth (blind, 8) | development heard at 24 and 32 bars; weak at 16 (then a second pass) |
| Depth two (blind, 6 x 16 bars) | 4/4 developing "goes somewhere"; simple: 1 goes somewhere, 1 loops (and looping is welcome sometimes) |
| Rust, all voices (10, core on, phone) | "it sounded great!" |
| Phase 1 check (blind A/B, 9) | "everything sounds the same on both versions" |
| The sound batch (3 albums + clips) | every new sound and mixing idea kept; bass +3 dB with a kick, none without; the second arrival of lateFloor should vary; stereo against mono: "same" on 5 of 6 (and the null), stereo "just barely" nicer on the sixth |
| Lite Room (6 loops before and after, Lite) | "it sounded great for lite mode"; the change goes to full quality too |
| The Lite switch on his devices | the Moto stays on full (busiest 18-24%, no late notes); the tablet moved to Lite by itself; the switch "doesn't bother" him |
| Long Pieces (33 clips, 3 blind pairs, 2026-11-14) | all ten pieces Keep; composed chosen over before; a wander move and the control Same; arc "good enough for now"; joins welcome, wander right, endings real |
| Phase 2 Blind Album (11 pairs, 2026-11-07) | the null pair Same; no pair worse, apart from downward octave moves of the chords (old preferred 2 of 3); upward moves: new preferred 3 of 3; the stab chords "Fine" in all three |
| Batch 6 (15 labeled cards and 7 blind pairs, 2026-11-17) | every batch 6 sound Keep except twang: soft only (bright and slow "sounded off"); the nearer chords chosen 5 of 6, the control Same |

## Methods that work

- **Check every report from the hands,** with your own measure where you
  can. Past misses: a motif measure taken before its transforms; a claimed
  cause that was worth a third of what was said; a probe that "showed the
  budget coping" and was wrong.
- **Render, do not guess.** The brain's guesses were wrong often enough that
  they are labeled "unproven": the loud-and-squeezed theory, "drums too loud"
  (it was the melody voice), and all three suspects for the pan flute (it was
  grace notes shorter than the attack). A queue item names suspects and asks
  the hands to find the cause by rendering.
- **Group ratings by feature.** The drum complaints resolved when the flagged
  loops were grouped by melody voice.
- **Briefs are taken literally.** "Steady, the same shapes on every kit"
  made static drums. Say the intent, and give checks for what must not be
  lost (variety, dynamics), not only limits.
- **Targets come from something Mikey likes:** the flute's 2-5 kHz share for
  tone, tide's hand-kit jig for drum level and variety, the kalimba for
  loudness. Not a number that the brain guessed.
- **Measure what reaches the ear,** the events and the rendered audio, not
  internal state. Short notes (0.4 s, near the median melody note) calibrate
  level. Long notes flatter or hide ringing voices.
- **Controls and repeats.** The same audio on two links got different
  ratings. A control track, and patterns that hold across passes, separate
  the signal from the noise.
- **Span is the guard measure** for melodic changes. **Move the figure, never
  one note.**
- **A seeded decision uses a salted random stream** (`spec.seed ^ SALT`), so
  loops that do not take the feature render exactly as before. This keeps
  A/Bs clean.
- **Measure against the same moment before:** render a join, an arc's
  energy or a wander's move at the commit before the change and now, and
  compare them span by span. This separates what the change did from what
  the loop always did. The hands' checks (clicks, steps) once passed three
  holes that this found.
- A bisect of one stage misleads when stages interact. One fixed curve
  applied everywhere becomes a mannerism.

## Tools

The full toolbox is `tools/README.md`. The brain uses these most:

- `tools/stats.mjs`: corpus statistics. `--seed`, `--n`,
  `--lift-low/--lift-high`, `--choir-quiz [file]`, `--voice-codes <voice>`,
  `--check` and `--write-baseline` (the balance lock,
  `test/stats-baseline.json`, n=10000), `--drums <profiles>` (drum variety),
  `--depth` (composition depth).
- `tools/measure.mjs`: offline audio on the player, in Node: LUFS, LRA, peak,
  crest, the level of each layer, punch, and what the master chain did.
  `--voice all|names` (tone and level by layer; `--note` for note length),
  `--refusals` (`--quality lite`), `--profile <id>`, `--vibes`, `--request`,
  `--vibe-mix`, `--stereo`, `--endings` (notes cut off), `--json`, `--seed`.
  `node tools/meter.mjs --selftest` checks the meter.
- `tools/perf.mjs`: live performance in headless Chromium with the CPU
  throttled: audio health, main-thread cost, memory, time to first sound,
  page weight, a hidden tab. `--ab` compares before and after.
- `tools/listen.mjs`: an album in one command. Not built yet (roadmap 20).
- `tools/check-docs.mjs`: the size limits and the pointers. CI runs it.

## State: 2026-11-26

### Start here

- **1.0 is out** (2026-11-25). The history started fresh on 2026-11-26:
  `main` begins at one commit (108e4c5), and the old history is under
  `refs/archive/main-before-fresh-start` (`docs/archived.txt`). The `v1.0` tag
  is on 108e4c5, and its release "Ballad Falls 1.0" has `balladfalls-1.0.apk`, signed by the release
  workflow with the key in the repository's secrets. balladfalls.com serves
  `main`. The old address (`driftloom.nowmichaelclark.workers.dev`) answers
  every path with a 301 to the new one. The driftloom repository is archived,
  read-only, with its PRs.
- **F-Droid:** F-Droid closed the merge request
  [fdroid/fdroiddata!59136](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/59136)
  on 2026-11-26, because an app must be maintained for more than three months
  first. Mikey sends a new request at about the end of February 2027, with a
  recipe on a commit of the new history.
- **The order of work after 1.0** (`docs/QUEUE.md`, "Status"):
  1. K1, the known issue "The app drops a code's version", before any new
     sound;
  2. item 107's `APP_LINK`, once F-Droid lists the app;
  3. item 75 (the reverb, rate-true) is ready, at low priority; item 37 is on
     hold.
- **Phone checks** in `docs/notes/for-mikey.md` wait for Mikey. None of them
  holds any work, because each checks something that shipped and can be
  reverted.
- **No album waits on Mikey.** `docs/ALBUMS.md` started fresh at 1.0.
- **The ears are Research now** (Mikey, 2026-11-26). The ears measured piles
  1 to 6, and their batch 6 is built. Piles 7 to 18 have no deadline: a
  Research session takes them when the brain queues one.
- **The plain style** (Mikey, 2026-11-26): the docs and the code comments
  are being rewritten in the Broken Friends style (`AGENTS.md`, "Writing
  style"), one PR for each area.
- **Broken Friends** started again as a 3D game for PC in November 2026. Its
  2D version's core extension is in its `archive/2d/`. The wiki page "Ballad
  Falls/In Broken Friends" explains the calls that a game uses. There is
  nothing for the brain to answer until the game brings the core back.
- **Vibe edits** move the generation goldens and `js/dlplayer.wasm` too
  (`docs/VIBES.md`, "How to edit a vibe"). The brain can do both steps in a
  vibe PR.
- **Next Painter work:** the tempo, key and scale, style and voices pickers,
  the "can't do that" line, and how a long piece shows (`docs/PAINTER.md`,
  section 2). Mikey answered the design's two open questions on 2026-10-14
  (`design/next-picks.md`, "Decided").
- **Before phase 5:** the catalogue of block ideas for Mikey (the charter,
  promise 5).
- **Open, not urgent:** the Pixel 10a's main-thread stalls of 1.3-1.8 s were
  never reproduced, and no report has come since v92.

The earlier "Start here" bullets and the brain's log, up to 1.0, are in
`docs/archive/brain-log.md` (read it at the commit that `docs/archived.txt`
names).
