# The toolbox

A tool is a thing that a session runs to see, test, measure or make
something without Mikey. Each tool's own header says how to run it and
what it checks. `AGENTS.md`, "Build and test", names the ones that CI and
the gate run.

## The tools

The "Limits" column says what a tool cannot do, or what it needs.

### The gate and the docs

| Use it to | Run | Limits |
|---|---|---|
| Run what CI holds a merge to | `tools/gate.sh [core|sketch|node|baseline|docs]` | about 35 minutes locally for all; CI runs it in about ten. Never two heavy runs at once (about 7 GB) |
| Check the docs' sizes, the queue's status lines and every pointer into `docs/` and `design/` | `node tools/check-docs.mjs [--list]` | checks only pointers that start with `docs/` or `design/`, not relative links |
| See what the workflow costs a session, week by week | `python3 tools/workflow-cost.py [--weeks N]` | reads git history only; the read-before-work count is today's files |

### The core and its builds

| Use it to | Run | Limits |
|---|---|---|
| Build the core to `js/dlplayer.wasm`, or prove it matches the source | `tools/build-core.sh [--check|--tools]` | a line added above shipped code can change the bytes (`core/AGENTS.md`) |
| Hold the core's sound to the stored baseline | `node tools/baseline.mjs [--update]` | 40 loops; a change meant to move the sound runs `--update` and says what moved |
| Check the golden renders on one target | `tools/golden.sh --strict <target>`, `node tools/golden-wasm.mjs` | six targets; each needs its toolchain |
| Check the generator against the generation goldens | `node tools/gen-golden.mjs [--check]`, `tools/gen-core.sh` | needs `tools/build-core.sh --tools` first |
| Render loops from their seeds on one target | `tools/seeds.sh`, `node tools/player-wasm.mjs` | the corpus's first 80 loops |
| Play the core at other sample rates | `node tools/rates.mjs` | promise 4 only |

### What is generated

| Use it to | Run | Limits |
|---|---|---|
| Read everything the generator decides, in Node | `tools/gen-lib.mjs` (a library) | needs `tools/build-core.sh --tools` first |
| Hold the corpus's balance | `node tools/stats.mjs [--check] [--n 10000]` | needs `tools/build-core.sh --tools` first |
| See what a loop with nothing picked draws, and what never comes | `node tools/unasked.mjs [--check]` | needs `tools/build-core.sh --tools` first |
| Measure the ten dials, and fit the words to them | `node tools/dials.mjs`, `node tools/fit.mjs`, `node tools/fitreport.mjs` | needs `tools/build-core.sh --tools` first (dials) |
| Check the chords' octave | `node tools/octave.mjs` | needs `tools/build-core.sh --tools` first |
| Make and read share codes from the command line | `node tools/codes.mjs`, `node tools/name-table.mjs` | round-trip a code before you give it to anyone |
| Sum up the word-ranking answers, and build a word album | `node tools/ranks.mjs`, `node tools/wordalbum.mjs` | reads exports from `/rank` |

### The sound, measured

| Use it to | Run | Limits |
|---|---|---|
| Measure loudness, a voice, refusals and endings on the player | `node tools/measure.mjs` (`--voice`, `--profile <id>`) | the player in Node, not a browser |
| Hold each voice's loudness over a note's life | `node tools/voice-loudness.mjs [--check]` | a new voice needs its line in `[longform loudness]` |
| Compare what the layers draw with what each layer sounds | `node tools/heard.mjs` | note by note |
| Make listening clips with a sketch's levers | `node tools/clips.mjs` | clips are for Mikey's ears; the tool does not judge them |
| Check the FLAC writer and the Ogg files | `node tools/flac.mjs`, `tools/ogg-read.mjs` (a library) | – |
| Measure track length's fades and ends | `node tools/track-fades.mjs` | on renders, not the live app |

### Long pieces

| Use it to | Run | Limits |
|---|---|---|
| Play the corpus's long pieces and check what is played | `node tools/longform.mjs [--arcs 10] [--plan] [--shard]` | about an hour with its arcs; read the full run from CI, never locally |
| Measure the themes as they are played | `node tools/longform-themes.mjs` | about eight minutes |
| Read the wander as it is played | `node tools/longform-played.mjs` | needs `tools/build-core.sh --tools` first |
| Find holes at the joins, wide | `node tools/longform-holes.mjs [--endless 20 --long 4]` | about 90 minutes on four cores (the nightly's `holes` job) |
| Make the long pieces' listening set again | `node tools/longform-clips.mjs [--before <dlrender>]` | needs `tools/build-core.sh --tools` first |

### The app, in a browser

| Use it to | Run | Limits |
|---|---|---|
| Check every app control on the player | `node tools/rows.mjs [--long] [--app]` | about a minute, from a fixed first loop |
| Measure the live app's speed, rendering ahead and the lite rule | `node tools/perf.mjs`, `node tools/ahead.mjs`, `node tools/autolite.mjs` | Chromium (Playwright); a container's timings are not a phone's |
| Find glitches and stalls with the screen on or hidden | `node tools/views.mjs`, `node tools/stalls.mjs [--loops arc,arcs]` | Chromium (Playwright); a container's timings are not a phone's |
| Measure how soon the core is ready | `node tools/core-start.mjs` | Chromium (Playwright); a container's timings are not a phone's |
| Measure the info card in every view | `node tools/card.mjs` | Chromium (Playwright) |
| Check accessibility and every control's name | `node tools/a11y.mjs`, `node tools/names.mjs` | Chromium (Playwright); takes minutes; not the gate |
| Check the audio export, short and long | `node tools/export.mjs`, `node tools/export-long.mjs` | the long one is export's `long` job; it holds no merge |
| Check the move from the old address | `node tools/old-address.mjs` | Chromium (Playwright) |

### Records (Research sessions, the ears' work)

| Use it to | Run | Limits |
|---|---|---|
| Measure a record and a render the same way, and draft an album card | `python3 -P tools/ears/album.py ALBUM_DIR WORKDIR` (every script: `tools/ears/README.md`) | Python with librosa, Demucs and ffmpeg; about 40 minutes an album on two cores; each measure's limits are on the wiki's "Measuring a record" |

### Files the app ships

| Use it to | Run | Limits |
|---|---|---|
| Make every icon from `icons/icon.svg` | `node tools/icons.mjs [--check]` | ImageMagick 7 with librsvg |
| Make the media session's keepalive audio | `python3 -P tools/keepalive.py [OUT_DIR]` | numpy and soundfile |

## Rules

- Look here first, before you check a thing by hand.
- If you do a check the second time, make it a tool, and add its row here.
- If a tool was wrong or weak, write that in its "Limits" cell. Fix it if
  the fix is small.
- If you want a tool that does not exist, write it under "Wishes".

## Wishes

- A tool that lists the libraries in `tools/` (`gen-lib.mjs`,
  `play-lib.mjs`, `meter.mjs`, `golden-lib.mjs`, `gen-golden-lib.mjs`,
  `ogg-read.mjs`) with what each gives, so a new tool reuses them.

## What earlier sessions learned

The sessions before 1.0 learned these things. They still hold.

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
- There is one generator and one engine, the core's. A change to
  what is generated is made once, in `core/src/generator/`, with its data
  in `data/*.txt`; the page only reads.
- In a cloud session GitHub's API may be closed to the session while a
  pasted token still pushes: then the PR is Mikey's to open.
