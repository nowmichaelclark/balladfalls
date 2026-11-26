# The queue

Written by the brain for Claude Code (the hands). Work top to bottom. Only
what is live is here: the status, the standing rules, the open items, the
known issues and the merge policy. A finished item leaves this file (its PR
keeps the text; `docs/DONE.md` has its line); the history before 1.0 is on
`docs/archived.txt`; `docs/README.md` is the map of all the docs. Mikey's ears come later, in listening albums the brain
builds from the Done list.

## Status

Updated 2026-11-26. Write this section again each time; do not add to its
end. It holds one line for each open item, and `node tools/check-docs.mjs`
holds it to 40 lines (as Broken Friends holds `plan/STATE.md`). The full
text of each item is below; the order of the table is the order of work.

**1.0 is out** (2026-11-25, the `v1.0` tag on d723b80): balladfalls.com,
the signed APK on the release, the old address forwarding, driftloom
archived. F-Droid's review is open
([fdroid/fdroiddata!59136](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/59136),
its recipe on #7's merge). A new session starts here: read the standing
rules and the merge policy, then take the first ready line.

| # | Item | Type | Model, effort | Status |
|---|---|---|---|---|
| K1 | The app keeps a code's version (known issue "The app drops a code's version") | Fix | not yet written | **first** after 1.0, before any new sound |
| 107 | `APP_LINK` to the F-Droid listing | Build | any, low | waiting on F-Droid's review |
| 75 | The reverb, rate-true for steady tones | Build | Opus 5.5, high | ready, low priority |
| 37 | Word albums on `/rank` | Build | not yet written | on hold |

The types are in `docs/briefs/README.md`. Ideas for later go in
`docs/inbox.md`, one line each.

**Two tracks:** app work (fixes, redesigns, vibe tuning, new controls) goes
on alongside the core track, as separate PRs; app-track sessions stay out of
`core/`, and core-track items don't wait for the app (`docs/BRAIN.md`, "Two
tracks").

## Standing rules, for every item

- **One PR per item** (split an item into a/b if that is cleaner). Start
  each from the latest `main`, take the next version number, and bump
  `BUILD` and `CACHE` together.
- **Merging:** see "Merge policy" at the end.
- **Measured, not guessed.** Every new voice, texture or kit: level
  calibrated to its layer's median at 0.4 s notes (`measure.mjs --voice`),
  `VOICE_COST` measured by render timing, and the tone probe's 2-5 kHz
  share at or below the flute's. That last one is the coffee-shop test:
  Mikey's north star is that nothing should bother people in a coffee
  shop. Every new profile: its `level` solved so its loops land on the
  catalog median (`measure.mjs --profile <id>`).
- **Refusals** on full and lite for the loops the item touches: melody at
  full quality stays near zero, and lite no worse than the catalog. For a
  requested loop the rule is read per profile: a request may not make any
  profile's lite refusals worse than that profile's own (brain, 2026-10-31;
  `docs/archive/notes/85-fast-pins-lite.md`).
- **The core baseline (items 32 and 96):** run `node tools/baseline.mjs`.
  It plays a fixed set on the player in Node (40 loops full and lite, mono
  and stereo, every voice, the refusals, the costs) and fails on any
  difference from `test/core-baseline.json`. A change that is not meant to
  change the sound must leave it passing; one that is runs `node
  tools/baseline.mjs --update` in the same PR and says in the body what
  moved and why.
- **The balance lock:** run `stats.mjs --check`. If a locked figure moves,
  report which and by how much, re-baseline at `--n 10000`, and say so.
- **Existing loops:** say exactly what changes for specs that already
  exist. Anything not named in the item must render identically.
- **Tests** three times.
- **Taste:** where the item leaves a musical choice open, take the more
  conservative option and write it down in the PR, marked "for Mikey's
  ears". Never guess silently.
- **American English** in new comments, docs and PR text (Mikey,
  2026-09-28). Don't rename identifiers or spec fields for spelling:
  share codes and history depend on them.
- **Stop and leave a note**, rather than push on, if a check can't be met
  or the item turns out to need a decision. Each note is its own file,
  `docs/notes/<item>-<short-name>.md` (the item number leads, so notes
  sort with their items; `docs/notes/README.md` says what goes in one).
  Say so in the PR. Notes before 2026-10-26 are in
  `docs/archive/notes.md`.
- **When a PR is merged,** add one line to `docs/DONE.md`: the PR number,
  the commit preview URL, and what the ears should listen for. (The file started fresh at 1.0; the
  lines before read at commit f040b5b.)
- **Items that touch `core/`** also follow `core/AGENTS.md` (the core's
  standing rules, and the rules for sound items).
- **Finished items** leave this file. An item cited as "item 46" from
  before 1.0 is the text in `docs/archive/queue-items.md` (on
  `docs/archived.txt`: read it at the commit that file names).

The rules the sessions to 1.0 kept, still in force (from
`docs/sessions/README.md`, removed in the slim after 1.0):

- **Merge the latest `main` into your branch before merging** (never
  rebase; force-pushes are refused on Mikey's machine). Where
  `js/dlplayer.wasm` or `BUILD` / `CACHE` conflict, take main's, rebuild
  with `tools/build-core.sh`, take the next version after main's, and let
  CI run again on that last commit.
- **The nightly first.** Before an item, look at the latest
  `nightly.yml` run on `main`; if it is red for a reason in the code, fix
  that first, as its own PR. A PR that moves the core's sound updates the
  stored render hashes it moves, in the same PR.
- **Don't stop for Mikey.** What needs his ears, phone, accounts or a
  decision is one line in `docs/notes/for-mikey.md`, and the work moves on.
  Stop only for a decision that can't be undone and could go either way.
- **The tablet's margin.** Mikey's Lenovo tablet, the weakest device he
  supports, has about 1.8 times headroom on lite (`js/quality.js`).
  Anything that adds work on the audio thread reports the baseline's costs
  and keeps them within 5% unless the PR says why.
- **The app's name from one place:** the page's name constant and the
  manifest, Android's one resource, fastlane's title; never in the code
  format.
- **The long pieces hold** (brain B3, 2026-11-14). A sound change that
  moves what a loop plays (a note, a hit, a velocity: not a width or a
  tone) passes the full `node tools/longform.mjs` and keeps every check it
  kept on `main`. Read it from CI (`.github/workflows/longform.yml`, eight
  shards, against main's table), never locally. Say in the PR what moved.
- **Sound items** name, in their Done line, two corpus loops (corpus seed
  20261009) that draw the new sound, with a time, so the brain can build
  the album without searching.

## 75. The reverb, rate-true for steady tones (low priority, after the batch)

**Hands:** Opus 5.5, high. From item 62 (brain, 2026-10-20).

**Why:** the reverb's combs (feedback 0.8) catch a held tone differently at
each sample rate: a held sine into the chords channel spreads 1.1 dB across
rates, while the channel itself is the same at every rate. Matching the comb
loops' lengths in time alone didn't fix it (the loop's lowpass and the delay's
interpolation matter too). The chapel organ, a held instrument with a room
send, is the first sound it shows in: golden 16-grove (5 s, the organ) reads
+0.29 dB at 44.1 kHz and +0.34 at 96 kHz against 48 kHz, so
`core/golden/rates.txt` marks it `steady` and `tools/rates.mjs` holds it to
0.4 dB, every other list to 0.2.

**Aim:** 48 kHz bit-identical (goldens and baseline unchanged), and every rate
list back inside 0.2 dB, so the 0.4 dB tolerance (and the `steady` line) can be
removed. If 48 kHz must move, stop and leave a note for a decision.

## After 1.0

Done and archived (`docs/archive/queue-items.md`, by number): phase 3 (93 to
100), 101 to 106, 107 but for its listing, 108 (1.0, balladfalls #3, with
#4 to #7 after it) and 109 to 122. The games (Broken Friends and the others)
waited for the music app's 1.0, the Android app on F-Droid included (Mikey,
2026-11-10). What needs Mikey's ears, phone or accounts is in
`docs/notes/for-mikey.md`, and the work moves on.

## 107. The Android app, on F-Droid (submitted; the review is open)

Sessions 25 to 29 built it (the brief and what came of it are archived with
item 107): the core native on Android's audio, the page's screens in a
WebView, the screen off, F-Droid's listing and recipe, reproducible builds
(`android/README.md`, `docs/notes/107-reproducible.md`). Mikey's key signs
each release in GitHub Actions (#4). **Open:** the merge request
[fdroid/fdroiddata!59136](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/59136)
("New app: Ballad Falls", 2026-11-25), its recipe on 8b9750c (#7's merge, the
same app as d723b80). Reviewers answer there, usually within a few weeks; a
change they ask of the recipe is a docs-and-recipe PR here and a new commit in
the merge request. Once it merges and the listing is up, `APP_LINK` in
`js/main.js` points at <https://f-droid.org/packages/com.balladfalls.app/>
(item 100's link), with `BUILD` and `CACHE`.

**Also noted, not queued:**

- **The player's stack** (item 94a, PR #337; the generator's stages apart
  since 101a's frame passed it): its calls take 45 to 47 KB of the caller's
  stack (Emscripten, measured), under its 64 KB default; the header says
  `-sSTACK_SIZE`. Fine for the
  browser (1 MB) and native games. Before a port to a small device (the
  charter's handhelds and consoles), an item trims the generator's frames
  with a measured aim; for Broken Friends' web build, the header's line is
  enough.

## 37. Word albums on `/rank`: one word, "does it fit?"

**On hold (Session 16): skip it unless the brain's State says otherwise.**
Vibes in the app (item 38) may do this job better: Mikey picks a vibe and
tells the brain which loops fit.

Mikey's idea (2026-10-11): "Is this playlist heartwarming? Which songs are
not?" The brain sends a word album (item 35b); Mikey answers each track
with one tap. The pilots, "Heartwarming?" and "Joyful?", went out as
plain albums (their codes: `docs/ALBUMS.md at commit f040b5b`); **if the brain's State says the pilot
didn't work, skip this item.**

- **`rank.html?album=<DLA1 code>`** (the word from the album's title,
  "Heartwarming?" -> heartwarming; `&word=` overrides): plays the album's
  loops in order, each as composed (`driftOn = false`, as now), looping
  until answered. Shows only the question, "Heartwarming?", and the track
  number of the total; no profile, mood or title per track.
- **Buttons:** Fits, Doesn't fit, Not sure; Undo goes back one. A track
  can be answered while it plays; the next starts at once.
- **Record** each answer as a line in the same export, so `ranks.mjs`
  reads it with the rest: `trial`, `build`, `code`, `album` (the album
  code's first block and the word, enough to tell albums apart), `track`,
  `words: [word]`, `taps: [word]` for fits and `[]` for doesn't fit,
  `answer: "fits" | "no" | "unsure"`, `seconds`, `quality`. Saved as
  `/rank` saves now; Export and Clear as they are.
- **`ranks.mjs`** counts album answers apart from the five-word trials
  (per album: fits, doesn't fit, not sure), and `--fit` uses them (item
  35a). The five-word trial stays as it is without `?album=`.
- No hidden repeats in albums (they are short); no generator, synth or
  share-code change; the balance lock doesn't move. The page plays the
  core like the app (item 32's note: `/rank` still builds the JavaScript
  `Synth`; wire it to the core here, with `?engine=js` as the fallback,
  and say what changed). Bump `BUILD` and `CACHE`.
- **Checks:** both pilot album codes (`docs/ALBUMS.md at commit f040b5b`) open, play and
  record on the core and `?engine=js`; an export holding both kinds of
  line reads in `ranks.mjs`; tests three times.

## Later, not queued

Ideas for later are in `docs/inbox.md`, one line each; the brain sorts them.

## Known issues

Session 30 (2026-11-24) went through every entry: each is done (and in the
archive), or says in a line why it is not for 1.0.

- **The app drops a code's version** (found by 105e, #450; Mikey,
  2026-11-22: "Before first new sound"). **Blocks the first addition after
  1.0, not 1.0: session 30 doesn't build it.** No member joins
  `data/codes.txt` until the app keeps a code's version
  (`docs/notes/105e-page.md`, 1): until then an addition would move every
  older code played in the app.
- **CI's timings (not for 1.0).** Two checks are timings and flake on a busy
  shared runner: `tests/longform.rs`'s "a section costs the same at one and at
  a billion", and `tools/longform.mjs`'s "no section line's block over the
  loop's own worst audio block": re-run once. CI is slow in two places, the
  ten rows (export, repeat=10: about 130 minutes, the rows job's timeout 180)
  and apt's mirror (the `flac` and `long` jobs install without recommends and
  cache the packages).
- **Checks that passed having checked nothing** (session 30c found them; fixed
  in session 30, each shown to fail on its fault first): `tools/views.mjs` now
  exits 1 when a view fails, and CI runs it on Endless too;
  `tools/export-long.mjs` counts the audio device's fill-ins, and says "not
  checked" in the check's name where the browser can't count them; `tools/track-fades.mjs` fails if the fade in does nothing; the
  Android smoke check plays a fixed busy loop; the F-Droid check fails with no
  build of F-Droid's to compare with; the F-Droid emulator check counts only
  the app's own crash; the Gradle build retries a refused download.

## Merge policy

Mikey decides this line:

- (yes, from Mikey) When CI is green and every check above passes, Claude
  Code merges its own PR and starts the next item.
- (Mikey, 2026-11-10; kept past 1.0 on 2026-11-25) "CI is green"
  means the fast gate (item 103: the `core` and `docs` workflows, locally
  `tools/gate.sh`); the nightly's slow renders (`nightly.yml`) never hold a
  merge, and a red nightly is fixed by the next session that sees it.
- (Mikey, 2026-11-17, session 10) The gate is read from CI: green `core`
  and `docs` workflows on the PR's last commit are the gate, and
  `tools/gate.sh` locally is not required (CI runs the same script, side
  by side, in about five minutes); a session runs a part of it locally only
  to find a failure. The long pieces' full check is read from CI too: on a
  PR that moves what a loop plays, the `longform` workflow
  (`.github/workflows/longform.yml`, `tools/longform.mjs` in shards) green
  on the last commit, its table job saying it kept every check main kept.
  Heavy checks never run side by side on Mikey's machine (about 7 GB).
- (Mikey, 2026-11-18) The `export` workflow is not part of the gate, but the
  hands usually wait for it to pass before they merge. They can merge
  without it when the PR is docs-only or a minor change. Say in the PR
  when you do.
- (Mikey, 2026-11-18) The brain may merge any hands PR, not only a
  docs-only one, once CI is green on its last commit and it checks out
  against its prompt.
- (Mikey, 2026-11-18) Don't wait on the `export` workflow's `long` job:
  merge once every other check is green on the last commit (the export
  rows included).
- (Mikey, 2026-11-25, at 1.0) Save every long run for the nightly: "can we
  skip any long waits and save those for nightly checks?" Nothing that takes
  over about 30 minutes holds a merge, now or after 1.0: not the nightly's
  renders (they stay nightly and do not come back as merge gates, as the
  2026-11-10 line had it), not the export workflow's `long` job or its ten
  rows. A merge waits on the gate (`core`, `docs`) and, on a PR that touches
  them, the `fdroid` and `android` workflows; a red nightly is fixed by the
  next session that sees it.
