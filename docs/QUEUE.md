# The queue

The brain writes this queue for Claude Code (the hands). Work from the top
down. The queue holds only what is live: the status, the standing rules, the
open items, the known issues and the merge policy. A finished item leaves
this file: its PR keeps the text, and `docs/DONE.md` has its line.
`docs/README.md` is the map of all the docs. Mikey listens later, to albums
that the brain builds from `docs/DONE.md`.

## Status

Updated 2026-11-26. Write this section again each time; do not add to its
end. It holds one line for each open item, and `node tools/check-docs.mjs`
holds it to 40 lines (as Broken Friends holds `plan/STATE.md`). The full text
of each item is below. The order of the table is the order of the work.

**1.0 is out** (2026-11-25, the `v1.0` tag on d723b80): balladfalls.com, the
signed APK on the release, the old address forwarding, and driftloom
archived. F-Droid's review is open
([fdroid/fdroiddata!59136](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/59136),
with its recipe on commit 8b9750c). A new session starts here: read the
standing rules and the merge policy, then take the first ready line.

| # | Item | Type | Model, effort | Status |
|---|---|---|---|---|
| K1 | The app keeps a code's version (known issue "The app drops a code's version") | Fix | not yet written | **first** after 1.0, before any new sound |
| 107 | `APP_LINK` to the F-Droid listing | Build | any, low | waits for F-Droid's review |
| H1 | The history starts fresh at 1.0 | Hygiene | Opus 5.5, high | after F-Droid lists 1.0 (and 107's `APP_LINK`) |
| 75 | The reverb, rate-true for steady tones | Build | Opus 5.5, high | ready, low priority |
| 37 | Word albums on `/rank` | Build | not yet written | on hold |

The session types are in `docs/briefs/README.md`. Write ideas for later in
`docs/inbox.md`, one line each.

**Two tracks:** app work (fixes, redesigns, vibe tuning, new controls) goes
on next to the core track, in separate PRs. App-track sessions stay out of
`core/`, and core-track items do not wait for the app (`docs/BRAIN.md`, "Two
tracks").

## Standing rules, for every item

### The PR

- **One PR for each item.** If it is cleaner, split an item into a and b.
  Start each PR from the latest `main`, take the next version number, and
  bump `BUILD` and `CACHE` together.
- **Merge the latest `main` into your branch before you merge.** Never
  rebase: force-pushes are refused on Mikey's machine. If `js/dlplayer.wasm`
  or `BUILD` and `CACHE` conflict, take main's, rebuild with
  `tools/build-core.sh`, take the next version after main's, and let CI run
  again on that last commit.
- **Merging:** see "Merge policy" at the end.
- **When a PR is merged,** add one line to `docs/DONE.md`: the PR number,
  the commit preview URL, and what the ears should listen for.
- **A finished item leaves this file.** An old citation such as "item 46"
  names the text in `docs/archive/queue-items.md`. Read it at the commit
  that `docs/archived.txt` names.

### Before you start

- **Look at the nightly first.** Before an item, look at the latest
  `nightly.yml` run on `main`. If it is red for a reason in the code, fix
  that first, in its own PR.
- **An item that touches `core/`** also follows `core/AGENTS.md`: the
  core's rules, and the rules for new sounds.

### The sound

- **Measure, do not guess.** For each new voice, texture or kit:
  - calibrate its level to its layer's median, on notes of 0.4 s
    (`measure.mjs --voice`);
  - measure its `VOICE_COST` by render timing;
  - keep its share of 2-5 kHz at the tone probe at or below the flute's.

  The last one is the coffee-shop test: Mikey's aim is that nothing should
  bother people in a coffee shop. For each new profile, solve its `level` so
  that its loops land on the catalog median (`measure.mjs --profile <id>`).
- **Refusals,** on full and on Lite, for the loops that the item touches.
  At full quality, the melody's refusals stay near zero. On Lite, they are no
  worse than the catalog. For a requested loop, read the rule per profile: a
  request may not make any profile's Lite refusals worse than that profile's
  own (brain, 2026-10-31).
- **The core baseline:** run `node tools/baseline.mjs`. It plays a fixed set
  on the player in Node (40 loops, full and Lite, mono and stereo, every
  voice, the refusals, the costs), and fails on any difference from
  `test/core-baseline.json`. If a change must not change the sound, it must
  leave the baseline passing. If a change is meant to change the sound, run
  `node tools/baseline.mjs --update` in the same PR, and say in the body
  what moved and why. A PR that moves the core's sound also updates the
  stored render hashes that it moves.
- **The balance lock:** run `stats.mjs --check`. If a locked figure moves,
  report which figure and by how much, re-baseline at `--n 10000`, and say
  so.
- **The long pieces hold** (brain, 2026-11-14). If a sound change moves what
  a loop plays (a note, a hit, a velocity; not a width or a tone), it must
  pass the full `node tools/longform.mjs` and keep every check that it kept
  on `main`. Read the result from CI (`.github/workflows/longform.yml`, eight
  shards, against main's table), never locally. Say in the PR what moved.
- **Existing loops:** say exactly what changes for specs that exist. Anything
  that the item does not name must render the same.
- **The tablet's margin.** Mikey's Lenovo tablet, the weakest device that he
  supports, has about 1.8 times headroom on Lite (`js/quality.js`). If a
  change adds work on the audio thread, report the baseline's costs and keep
  them within 5%, unless the PR says why.
- **Sound items** name two corpus loops (corpus seed 20261009) that draw the
  new sound, with a time, in their line in `docs/DONE.md`. Then the brain can
  build the album without a search.

### Taste and decisions

- **Taste:** if the item leaves a musical choice open, take the more
  conservative option, and write it in the PR, marked "for Mikey's ears".
  Never guess in silence.
- **Do not stop for Mikey.** Write what needs his ears, phone, accounts or a
  decision as one line in `docs/notes/for-mikey.md`, and go on. Stop only for
  a decision that cannot be undone and could go either way.
- **Stop and leave a note** if a check cannot be met, or if the item needs a
  decision. Each note is its own file, `docs/notes/<item>-<short-name>.md`
  (the item number first, so notes sort with their items;
  `docs/notes/README.md` says what goes in one). Say so in the PR.

### Other rules

- **Run the tests three times.**
- **American English** in new comments, docs and PR text (Mikey,
  2026-09-28). Do not rename identifiers or spec fields for spelling: share
  codes and history depend on them.
- **The app's name comes from one place:** the page's name constant and the
  manifest, Android's one resource, and fastlane's title. It is never in the
  code format.

## K1. The app keeps a code's version

Not written yet. The known issue "The app drops a code's version" (below)
says what is wrong. The brain writes this item before any new sound joins.

## 107. The Android app, on F-Droid (submitted; the review is open)

The Android app is built (`android/README.md`,
`docs/notes/107-reproducible.md`). Mikey's key signs each release in GitHub
Actions.

**Open:** the merge request
[fdroid/fdroiddata!59136](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/59136)
("New app: Ballad Falls", 2026-11-25), with its recipe on 8b9750c (the same
app as d723b80). Reviewers answer there, usually within a few weeks. If they
ask for a change to the recipe, make a docs-and-recipe PR here and a new
commit in the merge request.

**Then:** when the merge request merges and the listing is up, point
`APP_LINK` in `js/main.js` at
<https://f-droid.org/packages/com.balladfalls.app/>, and bump `BUILD` and
`CACHE`. Item H1 comes after it.

**Also noted, not queued: the player's stack.** The player's calls use 45 to
47 KB of the caller's stack (Emscripten, measured), under its default of
64 KB. The header names `-sSTACK_SIZE`. This is fine for the browser (1 MB)
and native games. Before a port to a small device (the charter's handhelds
and consoles), an item must trim the generator's frames, with a measured
aim.

## H1. The history starts fresh at 1.0 (after F-Droid lists 1.0)

**Hands:** Opus 5.5, high, a Hygiene session. Mikey, 2026-11-26: rewrite the
history, as "Fresh start, after F-Droid lists it". A full clone is 79 MB
today, and one commit of today's tree is about 10 MB (both measured
2026-11-26). The history before 1.0 stays in the archived driftloom
repository.

**Wait for:** the listing at <https://f-droid.org/packages/com.balladfalls.app/>
shows 1.0, and item 107's `APP_LINK` is merged. F-Droid's recipe for 1.0
names commit 8b9750c, which this item removes from `main`.

1. Make a git bundle of the whole history (`git bundle create --all`).
   Attach it to the `v1.0` release, so that every commit stays readable.
2. Make the new history: a root commit with `v1.0`'s tree (d723b80), and
   each change since 1.0 played again on it, one commit for each PR.
3. Check that the new `main`'s tree is the same as the old one's (`git diff`
   is empty), and that `tools/build-core.sh --check` passes.
4. Ask Mikey to allow the force-push to `main` if a rule blocks it. Then push
   `main` and move the `v1.0` tag to the new root. The tree does not change,
   so the site deploys the same files.
5. Point `docs/archived.txt` and the queue's old-commit pointers (72b13f0,
   f040b5b) at the bundle, and give F-Droid's recipe the new commit for its
   next version. If his GitLab fork needs a change, say so in
   `docs/notes/for-mikey.md`.

**Checks:** a fresh `git clone` is under 15 MB; every gate part is green on
the new `main`; the `v1.0` release still has its APK and the bundle.

## 75. The reverb, rate-true for steady tones (low priority)

**Hands:** Opus 5.5, high (brain, 2026-10-20).

**Why:** the reverb's comb filters (feedback 0.8) catch a held tone in a
different way at each sample rate. A held sine into the chords channel
spreads 1.1 dB across rates, but the channel itself is the same at every
rate. Matching the comb loops' lengths in time alone did not fix it (the
loop's lowpass and the delay's interpolation matter too). The chapel organ,
a held instrument with a room send, is the first sound that shows it: golden
16-grove (5 s, the organ) reads +0.29 dB at 44.1 kHz and +0.34 dB at 96 kHz,
against 48 kHz. So `core/golden/rates.txt` marks it `steady`, and
`tools/rates.mjs` holds it to 0.4 dB, and every other list to 0.2.

**Aim:** 48 kHz stays bit-identical (goldens and baseline unchanged), and
every rate list comes back inside 0.2 dB, so that the 0.4 dB tolerance (and
the `steady` line) can go. If 48 kHz must move, stop and leave a note for a
decision.

## 37. Word albums on `/rank`: one word, "does it fit?"

**On hold: skip it unless the brain's State says otherwise.** The vibes may
do this job better: Mikey picks a vibe and tells the brain which loops fit.

Mikey's idea (2026-10-11): "Is this playlist heartwarming? Which songs are
not?" The brain sends a word album, and Mikey answers each track with one
tap. The pilots, "Heartwarming?" and "Joyful?", went out as plain albums
(their codes: `docs/ALBUMS.md` at commit f040b5b). **If the brain's State
says that the pilot did not work, skip this item.**

- **`rank.html?album=<album code>`** takes the word from the album's title
  ("Heartwarming?" gives heartwarming; `&word=` overrides it). It plays the
  album's loops in order, each as composed (`driftOn = false`), and loops each
  one until it is answered. It shows only the question ("Heartwarming?") and
  the track number of the total: no profile, mood or title for each track.
- **Buttons:** Fits, Doesn't fit, Not sure. Undo goes back one. A track can
  be answered while it plays, and the next one starts at once.
- **Record** each answer as a line in the same export, so that `ranks.mjs`
  reads it with the rest: `trial`, `build`, `code`, `album` (the start of the
  album code and the word, enough to tell albums apart), `track`,
  `words: [word]`, `taps: [word]` for fits and `[]` for doesn't fit,
  `answer: "fits" | "no" | "unsure"`, `seconds`, `quality`. Save, Export and
  Clear work as they do now.
- **`ranks.mjs`** counts album answers apart from the five-word trials (for
  each album: fits, doesn't fit, not sure), and `--fit` uses them. The
  five-word trial stays as it is without `?album=`.
- Add no hidden repeats (the albums are short). Change no generator, synth or
  share code, and the balance lock must not move. `/rank` already plays the
  core, like the app. Bump `BUILD` and `CACHE`.
- **Checks:** both pilot album codes open, play and record; an export with
  both kinds of line reads in `ranks.mjs`; the tests pass three times.

## Known issues

- **The app drops a code's version** (found in #450; Mikey, 2026-11-22:
  "Before first new sound"). This blocks the first addition after 1.0. No
  member joins `data/codes.txt` until the app keeps a code's version
  (`docs/notes/105e-page.md`, point 1). Until then, an addition would move
  every older code that the app plays.
- **CI's timings.** Two checks are timings, and they flake on a busy shared
  runner: "a section costs the same at one and at a billion" in
  `tests/longform.rs`, and "no section line's block over the loop's own worst
  audio block" in `tools/longform.mjs`. Run them again once. CI is slow in two
  places: the ten rows (export, repeat=10: about 130 minutes; the rows job's
  timeout is 180), and apt's mirror (the `flac` and `long` jobs install
  without recommends and cache the packages).

## Merge policy

Mikey decides this section.

- (yes, from Mikey) When CI is green and every check above passes, Claude
  Code merges its own PR and starts the next item.
- (Mikey, 2026-11-10; kept past 1.0 on 2026-11-25) "CI is green" means the
  fast gate: the `core` and `docs` workflows (locally `tools/gate.sh`). The
  nightly's slow renders (`nightly.yml`) never hold a merge. The next session
  that sees a red nightly fixes it.
- (Mikey, 2026-11-17) The gate is read from CI: green `core` and `docs`
  workflows on the PR's last commit are the gate. `tools/gate.sh` locally is
  not required (CI runs the same script, in parallel, in about five minutes).
  Run a part locally only to find a failure. The long pieces' full check is
  read from CI too: on a PR that moves what a loop plays, the `longform`
  workflow must be green on the last commit, with its table job saying that it
  kept every check that main kept. Never run heavy checks side by side on
  Mikey's machine (about 7 GB).
- (Mikey, 2026-11-18) The `export` workflow is not part of the gate, but the
  hands usually wait for it to pass before they merge. They can merge without
  it when the PR is docs-only or a minor change. Say so in the PR.
- (Mikey, 2026-11-18) The brain may merge any hands PR, not only a docs-only
  one, once CI is green on its last commit and it matches its prompt.
- (Mikey, 2026-11-18) Do not wait for the `export` workflow's `long` job:
  merge once every other check is green on the last commit (the export rows
  included).
- (Mikey, 2026-11-25, at 1.0) Save every long run for the nightly: "can we
  skip any long waits and save those for nightly checks?" Nothing that takes
  more than about 30 minutes holds a merge, now or after 1.0: not the
  nightly's renders, not the export workflow's `long` job, and not its ten
  rows. A merge waits for the gate (`core`, `docs`) and, on a PR that touches
  them, the `fdroid` and `android` workflows.
