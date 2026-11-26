# dlcore: the Ballad Falls audio core

The core is the engine under Ballad Falls: the code that decides the notes
and makes the sound. The same code runs in the website (as WebAssembly), in
the Android app (natively), and in any other host, such as a game.

- It is plain Rust with `no_std`, with no dependencies and no threads.
- It allocates no memory after `Core::new`.
- The same notes make the same samples, bit for bit, on every target.

`docs/CORE.md` lists the core's promises and how each one is measured. The
rules for a change to the core are in `AGENTS.md`, next to this file. This
guide is for developers and AI agents. It says how a host drives the core,
how the sound is built, and how to add to it.

## The parts

| Part | Where | What it does |
|---|---|---|
| The core | `src/lib.rs`, `src/mix.rs`, `src/master.rs` | Plays notes through voices and blocks, mixes the layers, and renders samples. |
| The blocks | `src/blocks/` | Each sound source or sound shaper is one file. |
| The generator | `src/generator/` | Makes a loop from its seed and its request: the plan, the layers and every choice. |
| The player | `src/player/` | Plays a loop step by step, pass after pass, and sends each note to the core. |
| Share codes | `src/code.rs`, `src/code/` | Writes and reads the short codes that carry a loop or an album. |
| FLAC | `src/flac/` | The encoder for the lossless export. |
| Hosts | `src/wasm.rs`, `src/capi.rs`, `include/dlcore.h`, `examples/` | The web exports, the C interface, and two command-line hosts (`dlrender`, `dlgen`). |
| The data | `../data/*.txt` | The generation tables. `build.rs` compiles them in. |
| Tests | `tests/`, `golden/` | The tests, and the stored results that they compare with. |

More detail is in `core/docs/`:

- `core/docs/blocks.md`: the blocks that the app plays, one paragraph each.
- `core/docs/player.md`: the player, the generator and the request, in full.
- `core/docs/codes.md`: the share code format, byte by byte.

## Host the core

A host owns one `Core` and makes a few calls:

```rust
use dlcore::{Core, Key, MELODY, KALIMBA, EXTRA};

let mut core = Box::new(Core::new());          // megabytes of zeros: keep it off the stack
core.start(48_000.0, 1)?;                      // any rate from 22,050 to 192,000 Hz; mono (2: stereo)
core.key(Key { seed: 7, pass: 0, step: 0, ord: 0 });      // where the next notes sit in their loop
core.note(KALIMBA, MELODY, 0.5, 69.0, 0.4, 0.8, 3, [f64::NAN; EXTRA]);
let mut out = vec![0.0f32; 441];               // any number of frames a call
core.render(&mut [&mut out])?;
```

- **`start(rate, channels)`** sets the sample rate and the output: mono (1)
  or stereo (2). Any other value returns a plain error.
- **`note(voice, channel, time, midi, dur, vel, parts, extra)`** queues a
  note. It returns whether the note is on time, late, missed or refused
  (`Taken`).
- **`key(key)`** says where the next notes sit in their loop. The core draws
  every random detail of a note from this key, so the same loop sounds the
  same everywhere.
- **`render(out)`** fills the host's buffers with the next frames: one
  buffer for each channel of the output.
- **`event(channel, event)`** sends an event to a channel: a damp, a
  release, a bend, a retune or a choke (`Event::new`, `Event::retune`).
  - A damp or a release reaches each note at most once.
  - A bend, a retune or a choke reaches every note that is held when its
    time comes.
  - The channel's own blocks hear every event. Each voice or block decides
    what to do with an event. For example, a nylon string listens to a
    damp, and the tuned kick listens to a choke.
- **`set(channel, block, setting, value, time)`** sets a setting of one of a
  channel's own blocks, such as a sweep's period or an organ's stops.
- **`route(channel, block, setting, from, time)`** sends the signal of
  another channel (`Tap`) into a setting of a channel's own block, such as
  the kick into the bass's duck. `None` removes the route.
- **Other calls:** `param` (the mix and the master chain), `damp`, `cancel`
  and `cancel_from` (when the music jumps), `quality`, and the counts `late`,
  `missed` and `dropped`.

### Mono and stereo

The mono render and the stereo render are two separate renders. The mono
render costs nothing for stereo. In the stereo render, the mid (left plus
right) is the mono mix. The master chain runs on each side, and the width
ceiling (`blocks::width`) turns the side down if it gets wider than its
target. If nothing is placed or widened, each side is the mono render, bit
for bit.

`set_layout` switches between the two. While the core plays, the switch
fades over `LAYOUT_FADE` (0.25 s), so there is no click. `lanes()` says how
many lanes the last block rendered.

### The hosts

- `examples/dlrender` is a full native host in a few hundred lines. It
  reads a note list or a seed and writes a WAV file:

  ```sh
  cargo run --release --example dlrender -- --wav out.wav golden/03-tide.dlnotes
  ```

- The web host is `js/worklet.js`, through the exports in `src/wasm.rs`.
- The Android host is `android/native`, a crate that links this one. An
  AAudio stream's callback renders the player, and commands come through a
  lock-free queue (`android/native/src/engine.rs`).
- The C host is `examples/c/seed.c`, through `include/dlcore.h`.

## How the sound is built: blocks

Everything that makes or shapes sound is a **block**: one file in
`src/blocks/`, behind one small interface in `src/block.rs`. You need to
know three things.

1. **`Block`**, the interface:
   - `start(settings, cx)` sets the block once, from its `Settings`.
   - `render(block, cx, signal)` renders 128 frames at a time into one
     `Signal`, in place. A *source* (an oscillator, a voice) adds its sound
     to the signal. A *processor* (`INPUT = true`, such as a filter) replaces
     the signal with its output.
   - `span()` gives the frames that the block sounds in.
   - `PROBES` says how the test kit plays the block.
2. **`Context`** is everything that a block can read in addition to its own
   state: the sample rate, the wavetables and the noise.
3. **The registry** is the `registry!` list in `src/blocks/mod.rs`, one line
   for each block. The core finds every voice through it, with no `dyn`, and
   the test kit finds every block through it.

A **voice** is a block whose settings are a `Note`. A host plays a voice by
its number. A voice can also:

- settle the random details of its note (`settle`);
- say that it uses the noise source (`uses_noise`);
- play through one of its channel's own blocks (`THROUGH`);
- send part of its sound straight to the reverb and the echo (`SENDS`,
  `render_sends`);
- hear channel events (`event`);
- follow its channel (`FOLLOWS`): its notes sound after the channel's own
  blocks, and each note starts with the channel's level so far.

A block can also use four optional parts of `Block`. Each part has a
default, so a block that does not use it writes nothing for it.

- **Modulation:** `MODS` names the settings that a signal can drive, and
  `render_mod` renders with them driven. At each frame, a driven setting is
  its own value plus the signal, as in Web Audio. For example, a vibrato is
  an `Lfo` into an `Oscillator`'s `DETUNE`.
- **Stereo:** `render_stereo(block, cx, &mut [left, right])`. The mono
  render never calls it. By default, a mono source plays in the center, and
  a mono processor hears the two sides folded to one. `Pair` runs one copy
  of a processor on each side. A block with its own stereo render says
  `STEREO = true`.
- **Channel events:** `HEARS` lists the kinds of event that a block listens
  to, and `event(&Event)` receives them.
- **Settings for the loop:** `SETTINGS` names the numbers that a host sets
  on a channel's own block, and `set(setting, value, time, cx)` takes each
  one at its time.

**A channel's own blocks** are in the registry's `channel` list. Each
channel keeps them for as long as the core runs, outside the voice pool. A
channel block can work on a bus that the channel's voices sum into (the
fiddle's body), on the whole channel (`Channel::WHOLE`: a sweep, a duck), or
add its own sound (a held organ, the wash).

Each block keeps all of its state inline, in a plain struct whose
`const fn new()` is all zeros. Nothing in a block allocates or panics. Inside
a voice, a setting that moves over time is a `param::Param`, the core's
version of an AudioParam. The voices are built from the parts in the same
folder (`osc`, `lfo`, `filter`, `noise_source`) and call them directly.

**A caution on modulation:** an oscillator's start follows Chromium's rule.
If you connect any signal to its frequency, even a signal of zero, the pitch
counts as "moving", and the note's first block starts in a different way.
The goldens depend on this. So do not connect a modulator "just in case":
it changes the sound.

`core/docs/blocks.md` describes each block that the app plays.

## Add a block

`src/blocks/tremolo.rs` is a demonstration: a tremolo that only the tests
use. It shows the whole recipe.

1. Add **one new file**, `src/blocks/NAME.rs`, with:
   - a struct that holds the block's state;
   - a `const fn new()` (all zeros) and `Default`;
   - its `Settings`;
   - `impl Block`, with at least one probe.
2. Add **one line** to the registry's `parts` list in `src/blocks/mod.rs`,
   for example `tremolo::Tremolo;`. The tremolo's line also has
   `#[cfg(test)]`, which keeps it out of the app.
3. **Store its renders** for the kit: run `KIT=update cargo test --lib kit`.
   This adds lines to `golden/blocks.txt`. Commit them.

The kit's test `each_demonstration_block_is_one_file_and_one_line` checks
that the tremolo is named nowhere else.

Five more demonstrations show the optional parts, each with one file and
one line:

- `src/blocks/amp.rs`: an amplifier whose gain a signal can drive (`MODS`,
  `render_mod`).
- `src/blocks/pan.rs`: a stereo panner (`STEREO = true`, `render_stereo`).
- `src/blocks/swell.rs`: settings for the loop. A host calls
  `core.set(MELODY, own::SWELL, 0, 1.5, time)`.
- `src/blocks/chorale.rs`: a held instrument that is retuned at each chord.
  A host calls `core.event(CHORDS, Event::retune(time, &[60.0, 64.0, 67.0]))`.
  A note that two chords share sounds on; only the changed notes stop and
  start again (`blocks::retune`).
- `src/blocks/duck.rs`: the signal of one channel into the block of
  another. A routed signal is its source's previous block (one block late),
  so the channels can render in any order, with the same result everywhere.

The last three are in the registry's `channel` list, each with
`#[cfg(test)]`.

**To add a voice,** follow the same steps, with three differences:

- The voice implements `Voice` as well as `Block`.
- Its line goes in the `voices` list, with the number that a host plays it
  by: `kalimba::Kalimba = KALIMBA 0;`. The numbers are fixed for good, so
  take the next free one.
- The page needs the number too (`CORE_VOICES` in `js/core.js`).

If a voice is too big for a slot of the pool, put it in `pooled`, with the
size of its own pool.

**To add a channel's own block,** remember that it lives in the core's
static memory in every channel. So its `new()` must be all zeros: a NaN or a
non-zero default puts the whole core into the `.wasm` file (14 MB). Set the
real starting values in `start`. An idle block must return at once from
`render`, so that a channel that never plays it costs nothing.

## The test kit

`cargo test` plays each block in the registry alone, at 48 kHz, through each
of its probes. For each probe it checks:

- **level:** the samples are finite, the block is not silent, and it does
  not run away;
- **tone:** the share of 2-5 kHz in the A-weighted energy (the coffee-shop
  test);
- **determinism:** two renders are the same;
- **cost:** a release build checks it against a ceiling;
- **a null test:** a hash against the stored render in `golden/blocks.txt`;
- **modulation:** each setting in `MODS`, driven by a slow sine on every
  probe. If a setting changes nothing on any probe, the test fails: the
  setting is not connected;
- **stereo:** a mono block in a stereo signal puts its mono render on each
  side, bit for bit. A `STEREO` block's two sides are stored, and must differ
  on at least one probe;
- **events:** each kind in `HEARS`, sent on every probe. A kind that changes
  nothing on any probe fails;
- **settings:** each of `SETTINGS`, set to its probe value at the start. A
  setting that changes nothing on any probe fails.

An equal hash proves that a change is identical. Any other hash is a change
in the sound. The test fails and shows the stored and the new level and
tone. To store a change that you made on purpose, use `KIT=update`, and say
in the PR what moved and why.

To hear a probe from two versions:

```sh
cargo run --release --example dlrender -- --block fiddle/long --wav new.wav   # or osc/sine~freq, pan/left:stereo, nylon/strum@damp
# (the same on the old version, to old.wav)
cargo run --release --example dlrender -- --compare old.wav new.wav
```

`KIT=report cargo test --release --lib every_block -- --nocapture` prints
the whole table.

## The generator and the player

The **generator** (`src/generator/`) makes a loop from its seed and its
request: the spec, the plan, the layers, every choice, the settings that the
player sends at load, and each pass as it wanders. It reads the data in
`data/*.txt`, which `build.rs` compiles in as read-only tables. A host keeps
one `generator::Generator` and calls `load(seed, vibes)`. A load takes about
0.5 ms on a laptop, and 11 ms at most.

The **player** (`src/player/`) plays a loop from its seed. The generator
makes the loop, the sequencer (`sequencer.rs`) walks it step by step and
pass after pass, and the synth (`synth.rs`) gives each note to the core.

```rust
use dlcore::Core;
use dlcore::generator::Layer;
use dlcore::player::{Player, Request};

let mut core = Box::new(Core::new());           // 17.4 MB, and the player 1.5 MB:
let mut player = Box::new(Player::new());       // keep both off the stack
player.start(&mut core, 48_000.0, 2, true)?;    // rate, channels, full mix (false: lite's)
player.load(1234, &Request::new().with_vibe("peaceful").unwrap_or_default());
player.render(&mut core, &mut [&mut left, &mut right])?;  // again and again, any frames a call
player.set_mute(&mut *core, Layer::Drums, true);          // and set_wander, set_tempo, set_volume
```

The player does everything that the app does, so a host needs no generator
of its own: loads and changes at a musical moment, re-rolls, the edits from
a code, the track length, the core's own next loops, events and reports.
The request asks for vibes, a tempo, a length, keys, modes, styles, voices
and layers. `core/docs/player.md` describes all of it.

On the web, the `player` feature builds `js/dlplayer.wasm` with the
`dl_play_*` exports. `js/player.js` sends the commands and draws the
events. The module is about 1.1 MB (about 380 KB with gzip). A new player is all
zero bytes, so its 1.5 MB is in `.bss` (memory that starts empty), not in
the file.

## FLAC export

`src/flac/` is the core's own FLAC encoder, for the lossless export. It has
no dependencies, allocates nothing, and makes the same bytes on every
target.

1. Start one with `Flac::start(rate, channels, bits)`: mono or stereo, 16 or
   24 bits.
2. Give it what the player rendered, up to `flac::BLOCK` (4,096) frames for
   each call (`write`), and append the bytes that each call returns.
3. Call `finish` for the last frame. Then `header()` gives the finished
   header, to write over the file's first 42 bytes if the host can seek.

Its state is a fixed 122,576 bytes, so a three-hour export uses the memory
of a minute. The first header leaves the length and the MD5 unknown, which
FLAC permits, so the file plays at every moment. Floats become integers by
one rule (`flac::quantize`: rounded, halves away from zero, held to full
scale, no dither). A file is about a fifth of a WAV's size at 16 bits, and a
third at 24.

- The C header has `dl_flac_*`.
- The web's `dl_flac_*` (`src/wasm.rs`) are behind the `flac` feature.
- `dlrender --flac OUT [--bits 16|24]` writes one from a seed or a note list.
- `node tools/flac.mjs` (CI's `flac` job) checks real renders with the
  reference decoder.

## Share codes

A share code is a loop or an album as a short run of 64 characters that are
safe in a link. `src/code.rs` writes and reads it, natively, through the C
header (`dl_code_*`, `dl_album_*`) and in `js/dlplayer.wasm`. From the
command line, use `node tools/codes.mjs`.

**The format is frozen from 1.0.** `golden/share-codes.txt` holds it to its
bytes, and `golden/frozen-codes.txt` holds what 1.0's codes play: 561 loops
and 11 albums, each with what it decodes to. `test/frozen-codes.test.mjs`
reads them back in the gate. Nobody writes that file again.

A plain loop is 9 characters. A new vibe, profile, voice or option takes the
next free id in `data/codes.txt`, at a new version, so an old code never
draws it. `core/docs/codes.md` is the full format: the characters, the
numbers, the fields, names, albums and paces, and how to add to it or take
from it.

## Sketches

`core/sketch/` is where a session puts a new sound before it is in the app:
one block file and one line of data (`core/sketch/README.md`). The `sketch`
feature builds it in as a channel's own block (`src/blocks/sketch.rs`), and
the kit probes it with no test written.

The same feature carries the levers for listening clips: a forced choice
(`Generator::force`), a moved constant (`src/tuning.rs`), and a pinned
setting. `dlrender --seed|--corpus` takes them (`--sketch`, `--force`,
`--set`, `--pin`, `--from`, `--pick`, `--choices`), and `tools/clips.mjs`
makes WAV and Opus clips from a job list. The app, the player and the C
library never include the feature. With the feature on and no sketch, every
loop renders bit for bit as before.

## The other checks

- **`golden/`:** whole loops as the app plays them. Each must hash the same
  on wasm32, x86-64, aarch64, 32-bit ARM and big-endian PowerPC, at every
  block size and at other rates (`golden/README.md`).
- **`tools/gen-core.sh [TARGET]`:** the generator against the generation
  goldens (`golden/generation.hashes`): every case and every part, on every
  target that CI renders.
- **`tools/seeds.sh [TARGET]`:** the first 80 loops of the corpus from their
  seeds, each to a WAV, against `golden/seeds.hashes`. `--browser` checks
  the baseline's 40 loops against the browser's renders. `--c` builds the C
  host against the header alone.
- **`tools/baseline.mjs`:** the core in the app: every voice, 40 loops, the
  refusals, and 40 loops played from their seeds.
- **`tools/build-core.sh --check`:** the committed `js/dlplayer.wasm` is
  exactly what this source builds. Run `tools/build-core.sh` after each
  change here.
- **Clippy, pedantic:** `cargo clippy --all-targets -- -W clippy::pedantic`
  reports zero, and CI fails on any warning. Each public item has a doc
  comment that gives the reason, not only the what.
