# The toolbox

A tool is a thing that a session runs to see, test, measure or make
something without Mikey. Each tool's own header says how to run it and
what it checks. `AGENTS.md`, "Build and test", names the ones that CI and
the gate run.

## What earlier sessions learned

These notes came from the sessions to 1.0 (`docs/sessions/README.md`,
removed in the slim after 1.0; see `docs/archived.txt`).

- A line added above shipped Rust code changes `js/dlplayer.wasm`'s bytes
  even when it is compiled out (`core/AGENTS.md` says how to avoid it).
- `tools/measure.mjs`, `tools/baseline.mjs`, `tools/stats.mjs`,
  `tools/gen-golden.mjs`, `tools/dials.mjs` and `tools/octave.mjs` run in
  Node on the core. Several need `tools/build-core.sh --tools` first
  (`tools/gen-lib.mjs` reads everything the generator decides).
- The generation goldens' file (`core/golden/generation.hashes`) is the
  list of cases: a new case is a line of its first three fields, and
  `node tools/gen-golden.mjs` writes the hashes.
- `tools/rows.mjs` checks every app control in about a minute, from a fixed
  first loop.
- The local gate takes about 35 minutes (the core's tests are slow in a
  debug build); CI runs the same parts side by side in about ten. Push
  early so both run at once.
- On Mikey's own machine (Fedora): Rust is in `~/.cargo` (add
  `$HOME/.cargo/bin` to `PATH` if `cargo` isn't found), and git has no
  identity there: set it on each commit (`git -c user.name=Mikey -c
  user.email=162073748+nowmichaelclark@users.noreply.github.com`), as
  main's commits are, and change no settings. Force-pushes are refused:
  plan one PR per branch from the start.
- Album codes: `js/share.js`'s `encodeAlbum(title, specs)` with specs from
  `js/gen.js`'s `newSpec(seed, request)` (in the page) or `decodeSong(code)`;
  in Node, `tools/gen-lib.mjs`'s `newSpec` and `render` read the tools'
  build. Round-trip with `decodeAlbum` before giving a code to anyone.
- Long pieces: `dlgen --map SEED REQUEST` prints a piece (`--movements`
  prints a line a movement; `dlgen --theme-cost` times a theme-B section).
  `node tools/longform.mjs` plays the corpus through `dlrender` and checks
  what is played (about an hour with its arcs; `--arcs 10` for a quicker
  look, `--plan` for the plan alone); `core/tests/longform.rs` is the
  gate's copy. `node tools/longform-themes.mjs` (about eight minutes)
  measures the themes on what is played.
- Joins and endings: `dlrender --track bars=N` plays a piece with the
  length slider set, the core's own next loop after, as the app does.
  `tools/longform-clips.mjs` makes the listening set again from the maps
  (`--before` a dlrender from an older commit for blind pairs).
  `tools/stalls.mjs --loops arc,arcs` is the stall test on an arc of 32,768
  bars and on Endless arcs.
- Holes at the joins: `node tools/voice-loudness.mjs --check` holds each
  voice's line in `[longform loudness]` (a new voice gets its line there).
  `node tools/longform-holes.mjs` is the wide run (200 pieces, about 90
  minutes on four cores; the nightly's `holes` job); `--endless 20 --long
  4` for a look. A sound change that moves what a loop plays can move which
  joins fall back: say so in the PR.
- A batch 6 draw pinned to today frees a change that the list then fills:
  to hear a loop without one of them, pin the filled one off too.
  `tools/gen-lib.mjs`'s `parts()` shows it (`choices`, and the `load`
  part's `tuning`, `lowBell`, `lowBellDrops`, `twang`).
- There is one generator and one engine, the core's (item 97). A change to
  what is generated is made once, in `core/src/generator/`, with its data
  in `data/*.txt`; the page only reads.
- In a cloud session GitHub's API may be closed to the session while a
  pasted token still pushes: then the PR is Mikey's to open.
