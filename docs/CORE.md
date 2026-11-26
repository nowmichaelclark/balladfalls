# The core: charter

**Status:** Mikey approved this charter on 2026-10-13. Only Mikey changes
it. The brain proposes a change, with the reason.

The core is the Ballad Falls engine. Listeners never see it, but developers
do. It decides the notes and makes the sound, and it is the same code in the
website, the Android app, a desktop build, or someone's game. It is the
first priority of the project (Mikey, 2026-10-12): aim high, and take the
time that it needs.

This charter lists the core's eleven promises. Each promise has a measure,
so "done" is a number or a listening verdict, never a feeling. A number
marked *proposed* came from the brain, and Mikey can move it. The story of
how the core came to be is on the wiki page "Ballad Falls/The core".

## The promises

### 1. It never glitches, whatever the screen does

The page only sends commands (play, next, vibes, mute) and draws what the
core reports. The core decides and plays the notes on the audio side, so
work on the screen cannot reach them.

- *Measure:* `tools/perf.mjs` with a stall on the main thread (5 s of busy
  work while the app plays, visible and hidden): **zero late or dropped
  notes, and zero underruns.** On the testers' phones, Diagnostics shows zero
  late notes across a session in the Library and Save.
- *Measure:* the core's worst block, not its average. No block's work goes
  above **25% of its deadline** on the slowest tester phone (*proposed*).
  The work of making a new loop is spread across blocks, so it never makes a
  spike.
- *Measure,* **Moto G Power (2022)** (brain, 2026-11-02): the worst block is
  **under 30% at full quality and under 25% on Lite** (*proposed*; measured
  27.9% and 17.1% with `speed.html`, on the four busiest loops).

### 2. Light: battery and speed

The core allocates everything once, at the start. Nothing is allocated,
locked or freed while it plays. This holds for the synth, the generator and
the player.

- *Measure:* the audio thread's time for each second of the heaviest loops.
  The target is **under half of the first core's time** (*proposed*; the old
  JavaScript synth took 54-95 ms for each second).
- *Measure:* the memory of the whole engine, fixed and reported in bytes, and
  the size of the `.wasm` file, kept under a stated budget.
- *Measure:* rendering ahead, for a host with no audio thread: Lite stereo
  at **4 times real time or faster on the Moto G Power (2022)** (measured
  10.5-16.4x), and **2 times or faster on the weakest device we support**
  (Mikey's Lenovo tablet: measured 2.0-3.1x) (*proposed*; `speed.html`, the
  four busiest loops).

### 3. Deterministic: a code is a recipe

The same core version and the same code give **the same notes and the same
samples, bit for bit.** All randomness comes from seeded generators inside
the core.

- *Measure:* golden tests. A fixed set of codes renders to stored hashes of
  their notes and their audio. Each change to a hash is made on purpose, and
  its PR says so.
- **On every device too** (Mikey, 2026-10-13): the hashes match on every
  target (wasm, x86-64, ARM phones, and a 32-bit big-endian build that
  stands in for a console port). For this, the core has its own math
  functions (sine, exp, tanh and the others) instead of each platform's.
  This is also what lets it run with no standard library.

### 4. Embeddable anywhere

Developers can put the core in any game engine, mod, operating system or
device, and iOS and macOS stay easy.

- `no_std`, no heap after the start, no dependencies, no threads, and no
  floating-point surprises. It runs on a microcontroller or a console as
  well as in a browser.
- Any sample rate (22,050 to 192,000 Hz) and any block size. The 128-frame
  block of Web Audio is the web host's business, not the core's.
- A small, documented host interface (start, command, render, read events)
  in Rust and as a plain C header. Godot, Unity, Unreal, Bevy, a Swift app or
  a homebrew port can each wrap it in an afternoon.
- *Measure:* CI builds and runs the golden tests on wasm32, x86-64, aarch64,
  a 32-bit ARM target and a big-endian target. A small C program renders a
  loop to a WAV file through the header alone.

### 5. Easy to change

Mikey keeps adding vibes, sounds and profiles, so a change to the core must
be cheap.

- **Instruments are building blocks plus recipes** (2026-10-12):
  hand-written Rust blocks (oscillators, filters, envelopes, noise,
  formants, the reed, the bell), and small data recipes that connect and set
  them, like a synth's presets.
- **The building blocks are open to change** (Mikey, 2026-10-13). A
  developer, an AI agent or Mikey can add a block, or make a large change to
  one, without knowing the whole core. Each block is one file behind one
  small shared interface, listed in one registry, with its own test kit:
  level, cost, tone, determinism, and a null test against its last version.
  So a change is either proven identical or marked as a change in the sound,
  for an A/B. Nothing else in the core knows a block's insides.
- **A catalogue of block ideas** comes before phase 5: which blocks could
  exist (granular, modal resonators for bells and wood, waveguides for
  strings and winds, wavefolding, a tape model, a spring or plate reverb, a
  vocal tract), which blocks of today are worth a change, and what each would
  open up in the music. It is written for Mikey to pick from, with short
  clips where a sound can be shown.
- Vibes, profiles, moods and voices are data too, in plain ASCII text that
  people can read and edit (`data/*.txt`).
- *Measure:* a new instrument or vibe ships as a recipe file with **no Rust
  change**, and CI checks every recipe: it parses, and it stays within its
  limits for level, cost and tone.
- *Measure:* a new building block is **one new file plus one line** in the
  registry, and its test kit runs with no test written by hand.

### 6. Beautifully written

This is the part that developers see: clear names, a reason in every doc
comment, small files, and one way to do each thing.

- Documentation on every public item (`missing_docs` denied), Clippy's
  pedantic lints clean, `unsafe` only at the C boundary, and no panic that
  rendering can reach.
- A short guide (`core/README.md`): what the core is, how to host it, how to
  write a recipe, and how to add a building block.
- *Measure:* a fresh Claude session, given only the guide, adds a new
  instrument recipe and a new building block correctly on the first try.

### 7. It still sounds like Ballad Falls

The core is free of Chromium so that it can be better, not different by
accident.

- The balance lock holds (`stats.mjs --check`), the refusal and level checks
  hold, and the mono render keeps the approved balance (promise 9).
- A change to a sound that Mikey already likes goes to a **blind A/B**. A new
  sound goes to a labeled album. His ears are the acceptance test.
- Each improvement beyond Chromium (a warm reverb made for this music, better
  oversampling, a true-peak ceiling, smooth changes of settings) is its own
  item, judged by measurement and by ear.

### 8. Short, plain codes

- A loop's code is the core version, its seed, and only what the listener
  changed (vibes, mutes, edits): about **10-16 characters**. An album drawn
  from one seed is a single seed. A hand-picked album is a list of seeds
  (about 60 characters for eight loops).
- **Plain ASCII only:** the 64 characters that are safe in a link (`A-Z a-z
  0-9 - _`), shared as a link so that Discord shows a tidy preview. There is
  no server: a code carries everything. The same rule holds for everything
  that the core emits (names, errors, logs).
- A code says what it needs. If something is missing, the code says so in
  plain words, and never plays the wrong thing.
- **Codes are frozen from 1.0** (2026-11-25). Version 2 is 1.0's, and a code
  made with 1.0 plays the same loop from then on
  (`core/golden/frozen-codes.txt`). Before 1.0, old codes were not protected.

### 9. Stereo across the board, with a mono switch

**Ballad Falls is stereo** everywhere (Mikey, 2026-10-15), with an optional
switch that makes everything mono for the listeners and developers who want
it. Stereo has very many variables, and each must be easy for developers and
listeners to change.

- **Two renders, both first-class.** The core renders stereo by default, and
  mono when asked. Mono is not a stereo mix folded down. It is its own render,
  with the balance that Mikey approved. Both renders are deterministic and
  golden-tested.
- **Space is data, like instruments.** Where a sound sits and how it moves
  is a "space recipe", separate from the instrument: the width of the mix,
  the pan of each instrument, whether a part moves in this track and not the
  next, how far, how fast and in what shape it moves, stereo echoes and
  reverb. A recipe gives ranges, and the core draws within them from the
  loop's seed. So the variation is part of the music, and the code makes it
  again.
- **Every variable is a named setting** that a developer or a listener can
  turn, in layers: the core's defaults, the lean of a profile or vibe, the
  request's picks (promise 11), the host's (a game), and the listener's.
- **In the app,** a **Mono** switch is one of the settings.
- **Guards:** the stereo render, folded to mono, must sound like the mono
  render (level and tone within stated limits). So stereo never hurts a
  phone speaker, a Bluetooth speaker or a mono venue. Nothing essential
  lives on one side only. Low notes (bass, kick) stay in the center. Stereo
  must not double the cost on a phone.
- **Judged by ear first:** a stereo treatment is first a set of offline
  clips (stereo against mono). Mikey's verdicts decide which space recipes
  exist.

### 10. One real game proves it: Broken Friends

Broken Friends, Mikey's own game, is the one game that proves the core
(Mikey, 2026-10-24). It replaced the three games picked on 2026-10-13
(Luanti, OpenRCT2, Stardew Valley).

- *Measure:* in Broken Friends, the music follows the game with no
  glitches and no measurable cost in frame time. The golden lists render
  inside the game with exactly the golden hashes. The integration stays
  small and readable, and Mikey judges it "seamless". What was hard goes
  back into the core and the guide, so the next developer never meets it.

**Note (2026-11-26):** this promise was written for the first, 2D version of
Broken Friends (Godot 4, mobile first, with a Rust GDExtension and a web
build). In November 2026 Broken Friends started again as a 3D game for PC
(Godot 4 and Rust). How the core goes into the new game is not decided yet.

### 11. Ask for the music you want

Listeners choose more than vibes for the next loop (Mikey, 2026-10-13): how
many bars, the tempo, the rhythm (meter and feel), the scale and more.
Developers ask in the same way: "a peaceful, zany loop at 77 bpm, 16 bars,
when the sun rises."

- **One request, for everyone.** The generator takes a request. Each musical
  choice (bars, tempo, meter, rhythm feel, scale and key, profile,
  instruments, layers, vibes) is **pinned** to a value, given a **range**, or
  **left to chance**. The app's pickers, a developer's code and a game's
  events all build the same request. What is left to chance is drawn from the
  seed.
- **A request bends the music and never breaks it.** A pin that pulls
  against a profile's character finds its in-between (as vibes do: "no pair
  is forbidden"). A request that truly cannot be met says so in plain words,
  and does not play something else.
- **Events:** a host can attach a request to a moment ("when the sun rises",
  "entering the cave"). The core changes over at the next musical boundary,
  not in the middle of a phrase.
- **Any length, up to endless.** The generator works one section at a time,
  never the whole piece first. So the memory and the cost are the same for 4
  bars or for Endless, and any point of a long piece can be reached straight
  from the seed and the section number. **The core has no cap.** The app's
  picker goes up to 32,768 bars (about 27 hours at 80 bpm), plus **Endless**
  (Mikey, 2026-10-13).
- **A code carries only what was pinned,** in addition to the seed, so a
  pinned loop's code stays short (promise 8).
- **The balance lock** still guards what plays when nothing is pinned. What
  plays when the listener pins is theirs.
- **In the app, these are picks for the next loop,** like the vibes, not
  settings.
- *Measure:* every musical choice of the generator can be pinned or ranged
  through the request (a test walks the list). A pinned value is honored in
  the render (measured: tempo, bar count, meter, scale). The same request and
  seed give the same loop on every target.

## The phases

The core is built one phase at a time. Each phase is proven before the next
starts. Promises 2 and 6 are not a phase: every PR in every phase must keep
them.

| # | Phase | Status |
|---|---|---|
| 1 | **Foundations:** seeded randomness in the core, the core's own math, any rate and block size, golden hashes, CI on all targets, a command-line renderer | done (2026-10-19) |
| 2 | **The generator and the sequencer in Rust,** proven note for note against the old JavaScript | done (2026-11-04; proven 2026-11-07) |
| 3 | **Off the page:** the core runs on the audio side, the page sends commands and draws events, and the JavaScript synth and generator retire | done (2026-11-11) |
| 4 | **The game: Broken Friends** (promise 10) | waits: after 1.0 (Mikey, 2026-11-10) |
| 5 | **Instruments as recipes:** first the catalogue of block ideas (promise 5), then the recipe format, and today's voices as recipes where it fits | not started |
| 6 | **Codes, version 2:** short codes, album seeds, plain links | done (frozen at 1.0, 2026-11-25) |
| 7 | **The host kit:** the finished C header, the audio export, and the guide, with what Broken Friends taught | partly done: the C header and the export exist; the fresh-session test (promise 6) and Broken Friends wait |
| 8 | **Better than Chromium:** the sound improvements, one item each, with blind A/Bs where they touch what Mikey likes | open |

**Exports, safe first** (Mikey, 2026-10-13). An export must never crash or
break anything on the listener's device, old Android phones and weak chips
included. So the export renders in small chunks straight to the file (the
same memory for one minute or three hours), checks free space before it
starts, shows progress, can be cancelled, and survives the app going to the
background. **Lossless** (FLAC) is the format that the core writes itself. A
**small** format (Opus) uses the encoder that the phone or browser has.

**The platforms,** each its own phase: Android (in 1.0; on F-Droid when its
review is done), then itch.io for the desktop, and later Google Play. iOS and
macOS stay a recompile away.

## Targets

Mikey agreed the numbers in promises 1 and 2 as starting targets
(2026-10-13). They move as the work teaches. If a target looks wrong, or if
a higher aim looks possible, the brain tells Mikey, with the measurement
that says so. Mikey's answers on this charter are in `docs/DECISIONS.md`.
