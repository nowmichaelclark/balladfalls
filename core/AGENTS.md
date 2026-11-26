# The core: rules for work in `core/`

Read this before you touch `core/`, the Rust engine that `js/dlplayer.wasm`
is built from. Read the root `AGENTS.md` first. The queue's standing rules
(`docs/QUEUE.md`) also apply; these rules come in addition.

- `docs/CORE.md` is the charter: ten promises, each with its measure.
- `core/README.md` says how a host drives the core and how to add a block.

## Commands

- **Build:** `tools/build-core.sh` rebuilds `js/dlplayer.wasm`. This is the
  app's one module: the core, its generator and its player. Commit it with
  the source. `--check` fails if the committed file is not exactly what the
  source builds.
- **The tools' build:** `tools/build-core.sh --tools` makes
  `core/target/dltools.wasm` with the `tools` feature. It adds the player
  with a request as text, the voice probe and the budget's counts. The app
  never ships it.
- **Tests:** `cd core && cargo test --locked`.
- **The baseline:** `node tools/baseline.mjs` renders the player's loops in
  Node and compares them with `test/core-baseline.json`. Its voices and
  refusals parts need the tools' build. Use `--update` only on purpose, and
  say what moved.
- **Golden renders:** `tools/golden.sh --strict wasm32-unknown-unknown`
  (also `--flush`, `--blocks`, `--rates`, `--stereo`), and
  `node tools/rates.mjs`. The nightly runs every target. Nothing waits on
  the nightly: `tools/gate.sh` is the gate.
- **The balance lock:** run `node tools/stats.mjs --check` when what is
  generated moves.
- **The generator:** `tools/gen-core.sh [TARGET]` checks the generator
  (`src/generator/`) against `golden/generation.hashes`, every case. The
  gate checks the same file in Node (`node tools/gen-golden.mjs --check`).
  `build.rs` compiles `data/*.txt` into the core, and the page reads the
  same files for its labels and ranges.
- **Seeds:** `tools/seeds.sh [TARGET]` has the player (`src/player/`) play
  the first 80 loops of the corpus from their seeds to WAV files, and
  compares them with `golden/seeds.hashes`. `--browser` checks the
  baseline's 40 loops against the baseline's `player` part. `--c` uses the
  C host (`include/dlcore.h`). The nightly runs them.
- **The sketch:** `cargo test --locked --features sketch` and
  `cargo clippy --all-targets --features sketch` check `core/sketch/`, the
  folder for sounds that are not in the app yet. CI runs both.
  `tools/clips.mjs` makes listening clips with it.

## Rules for every core PR

These rules come from the charter's promises 2 and 6.

- **No allocation after `Core::new`.** After `Core::new`, nothing
  allocates, locks or frees memory. Nothing that rendering can reach can
  panic. Say in the PR how you checked.
- **The player starts as zeros.** `Player::new()` is all zero bytes, so
  `js/dlplayer.wasm` keeps it in `.bss` (memory that starts empty), not in
  the file. Each type that a `List` or a `Maybe` holds says what its empty
  value is (`impl Empty`, in `generator/list.rs`). Where a player holds
  one, that value is all zero bytes. For other fields, use `Word` for a
  `&'static str`, `Biased` for a number that starts at a default, and an
  enum whose first variant is the empty state. Do not use `unsafe` for
  this. If a field is not zero, the test `a_new_player_is_all_zeros`
  (`tests/zeros.rs`) fails and names the offset.
- **Document the reason.** Document each public item that the PR touches.
  Say why, not only what. `cargo clippy --all-targets -- -W
  clippy::pedantic` must report zero in every file, and CI holds it there
  (`-D warnings`). Allow a lint, with a one-line reason, only where the
  lint makes the code worse.
- **A new line above shipped code moves the app's bytes.** Panic locations
  carry line numbers, so `js/dlplayer.wasm` changes even when the new line
  is compiled out. Put code for the `tools` or `sketch` builds at the end of
  a file, or on the same line as the code next to it (see
  `player/sequencer.rs` and `player/budget.rs`). `tools/build-core.sh
  --check` tells you if the bytes moved. This also applies to a comment
  line.
- **No dependencies** in `core/`. Tools that only CI uses are permitted.
- **Plain ASCII.** Everything the core emits (names, errors, logs) is
  ASCII.
- **Costs.** A render cost in the core baseline must not go up by more than
  5% on any loop, unless a note says why the cost is worth it.
- **Chromium.** The core started as a copy of Chromium's audio code, but it
  is not a copy now. If a doc comment says that a block "follows Chromium
  to the sample", keep it while it is true. Judge new work by the
  charter's measures, not by a match with Chromium.

## Rules for new sounds

Use these rules for each new voice, block or mixing choice.

- **Where it is decided, and where it sounds.** The generator
  (`src/generator/`, with its data in `data/*.txt`) or the player at load
  (`src/player/`) decides *when* a sound plays and *which loops* get it. A
  block or a voice in `core/src/blocks/` decides *what* plays: one file and
  one line, probed by the kit, with its stored render. The page builds
  nothing. If the page must offer a new choice or pin, add a line of data
  that the page reads.
- **Mikey's rules for each choice** (2026-10-18):
  - The behavior of today stays as one option in each choice. Never
    replace it.
  - Each loop draws each choice on its own random stream, seeded from the
    loop's code. So no other draw moves, and a loop always plays the same
    way.
  - Most loops get one or two of the changes.
  - The approved exceptions: `roundBass` is the bass of every loop;
    `longChords` keeps its own approved spread (the lengths of today in
    56% of loops); `floorDrop` replaces full stops. The stereo baseline
    applies to every loop.
- **Measure against the ears.** Measure each new sound the same way that
  its report measured the sketch, on the report's corpus loops (corpus seed
  20261009). Make renders with `tools/measure.mjs` or `tools/clips.mjs`,
  and read them with `tools/ears/` (`sketch_check.py`, `warmth.py`,
  `low_guard.py`, `kick_check.py`, `stereo_guard.py`). Compare the core
  build with the sketch:
  - The level of its loudest 3 seconds against the loop (K-weighted) is
    within 1.5 LU of the sketch's figure.
  - Its tone figures (centroid, attack, band shares) match, where the
    report gives them.
  - It refuses no more notes than the sketch (none, in every report so far).
  - `VOICE_COST` comes from render timing.
  - If it plays in the melody's register, its 2-5 kHz share at the tone
    probe is at or below the flute's.
  - Check refusals on full and on Lite.
  - If the core's version must differ from the sketch, say where and why.
- **Peaks.** No voice alone peaks over -1 dBFS at the kit's probe.
- **Baselines.** Each item that changes the sound updates the core baseline
  and says what moved. Re-baseline the balance lock once for each group of
  items, at the group's last item, on purpose: run `stats.mjs --check`, then
  `--n 10000`, and say what moved.
- **For the album.** Each line in `docs/DONE.md` names two corpus loops that
  play the item's sound, with a time. Then the brain can build a labeled
  album (keep, tune or drop) with no search.
- **Stop and leave a note.** If a recipe cannot be met in the core as Mikey
  heard it, write a note (`docs/notes/<item>-<name>.md`). Do not build
  something that Mikey did not hear.
