# The generator, the player and the request

This page describes the generator (`core/src/generator/`) and the player
(`core/src/player/`) in full. Read `core/README.md`, "The generator and the
player", first.

## The generator

The generator makes everything about a loop from its seed, its vibes and the
generation data:

- the loop's spec;
- the plan that is drawn before the layers;
- the layers, and every choice with its own draws;
- the settings that the player sends to the core at load;
- each pass as it wanders (`drift`).

The data, `data/*.txt`, is compiled in by `build.rs` as read-only tables. A
host gives the generator nothing, and an edit to a data file rebuilds the
core.

A host keeps one `generator::Generator`. Its lists are fixed: 1,406,840
bytes on 64-bit targets, 1,090,016 on 32-bit, and nothing allocates.

1. Call `load(seed, vibes)`.
2. Call `settings()` for the load's decisions.
3. Call `wander(pass)` for a pass as it wanders. Any pass works, without the
   passes before it. A pass is the loop's own events, with what the pass
   changed marked on them.

`hash` and `write` give the canonical text of each part
(`tools/gen-golden.mjs` documents it).

A load takes about 0.5 ms on a laptop, and 11 ms at most. Nearly all of the
11 ms is one step: a loop with a tuned kick sets the kick's level by ear
(the fit in `kickOf`, about 10 ms). The player spreads a load across blocks
(`Generator::begin`, then `step`, one stage at a time), and the fit itself
runs in slices (`choices::KickFit`). The `generator` feature builds the
generator's exports (`dl_gen_load`, `dl_spec` and others) for the checks.

## The player

The player plays a loop from its seed:

- the generator makes the loop;
- the sequencer (`sequencer.rs`) walks it step by step, pass after pass,
  and wanders as the app does;
- the synth (`synth.rs`, with the voice budget in `budget.rs` and the sung
  voices' trims in `formant.rs`) gives each note to the core.

The baseline's 40 loops (full and Lite, mono and stereo, 45 s with the
wander on) make the same samples here as in the app in Chromium, bit for
bit.

### Load and change

- **`load(seed, request)`** asks for a loop. The player makes it one stage
  at a time over the next blocks (a few, up to about a hundred: the spec, the
  plan, the render in five parts, the load's decisions, the kick's fit in
  slices, the first pass). Then the loop starts, with its first step `START`
  (0.05 s) later. A loop that plays stops being decided at once, and the
  notes that it already gave the core play out.
  - `load_at` starts the loop at a time on the core's clock. The page's
    playhead keeps in step this way.
  - `ready` makes the loop at once, for a host with no deadline (an offline
    render, `dlrender --seed`).
- **`change(seed, request, moment, handover)`** (`player/change.rs`)
  changes loops at a musical moment of the loop that plays:
  - `Moment::Now`: as soon as the new loop is made (the moment of `load`);
  - the next `Beat` (six steps in 6/8, else four), `Bar`, `Phrase` (a line of
    four bars from the pass's start, or two if four does not divide the loop)
    or `Pass`.

  The old loop hands over by `Handover::Crossfade(seconds)` (its notes fall
  to nothing from the boundary, through `Core::fade_all`; the default is
  `CROSSFADE`, 1 s) or by `RingOut`. There is no reset and no second core.
  How it works:
  1. A change waits until its boundary is `lead()` away (the lookahead plus
     160 blocks, the longest load with room to spare).
  2. The old loop then decides its steps up to the boundary.
  3. The new loop is made in the blocks before the boundary, and takes its
     first step on it. Its tone, level and echo glide in there.

  If a boundary is too near, the change waits for the next one of its kind.
  A `Now` change (or a load while a loop plays) starts on the old loop's
  next step. If the new loop took longer to make than the old loop had
  decided ahead, it starts on the first of its own steps still to come.
  One change waits for each kind of moment: a later change replaces an
  earlier one of the same kind. `next_change()` says when the next one
  starts. A change's loop plays its own first pass.
  `dlrender --changes N` makes N changes across the corpus and measures
  each join, and `tools/player-wasm.mjs --changes N` times them.

### Everything the app does

The player does everything that the app does, so a host needs no generator
of its own.

- **A code's edits** (`Request::with_layer_seed`, `with_tone`, `with_bpm`;
  as text `edit.roll.drums=N`, `edit.seed.bass=N`, `edit.warmth=0.6`,
  `edit.space`, `edit.wobble`, `edit.bpm=88`) are what a listener changed
  after the loop was made. They are written over the spec after every draw.
  A re-rolled layer always plays. The generation goldens' `edit` cases check
  them against the page.
- **`revise(seed, request)`** makes the loop that plays again in its place
  (a re-roll). It takes the old loop's next step and goes on from that step
  and pass. It sends the setups again only where they differ.
- **`set_tone`** and **`set_track(Track)`**: the track length, in whole
  passes, or in bars to the next phrase line, counted from the step heard.
  `Moment::End` is a change that waits for the track's end. It rings out at
  the end of a pass, or crossfades inside one. `change_with_track` also says
  how long that loop's own track plays, and `drop_change(moment)` drops a
  change.
- **The picks and the core's own loops:** `set_picks(request, tag)` keeps the
  host's picks, and `set_draws(seed)` gives the core a seed to draw its own
  loops' seeds from. `next(moment, handover)` changes to a loop of the core's
  own. If a track ends with nothing waiting, the core hands over to one of
  its own by itself (with `END_FADE` inside a pass), so the page can sleep
  through it. Each of these loops plays on until the host sets its track. A
  pick never changes the loop that plays. The loop's `Loop` event comes
  after an `Own` event that carries the picks' tag, so the host knows which
  loop it is.
- **Events** (`player/events.rs`, `event()`): a loop's first step, a pass, a
  piece's section, a phrase line, each step, a re-roll, the track's end, and
  a loop of the core's own. Each event carries the time when it is heard. The
  player decides them up to a lookahead before that time.
- **Reports** (`player/about.rs`):
  - `grid(layer)`: the layers' grid of the pass that is being decided;
  - `notes` and `note`: the loop as composed, note by note (for the MIDI
    export);
  - `describe`: plain ASCII lines of what a card, a cover and a share code
    show.

  `test/player.test.mjs` checks them against the page's generator in
  `js/dlplayer.wasm`, and `examples/c/report.c` calls them through the C
  header.
- **The controls** are the app's: `set_wander` (0 plays the loop as
  composed), `set_mute`, `set_tempo`, `set_volume`, `stop` and `resume`.
- **`set_wander_salt(salt)`** (`dl_player_wander_salt`,
  `dl_play_wander_salt`, `dlrender --salt`) salts the wander's random stream
  from the next pass. A host that sends a new salt each play hears a loop
  wander in a new way each time. The app does this at the top of its wander
  slider (`UNREPEATABLE_FROM` in `js/player.js`). The default, 0, is the
  wander that every code has always had. The same seed, request and salt
  make the same samples.

### Timing

- **Before each block,** the player decides every step that is due within
  `LOOKAHEAD` (0.25 s), and gives its notes to the core (`decide`; `render`
  calls it, through `Core::render_with`). The wander of each pass is drawn
  one pass ahead, in a block where no step is decided.
- **Rendering ahead** (`player/ahead.rs`) is for a host with no audio
  thread, such as Godot's web build. `render` takes any number of frames for
  each call, and each call goes on exactly where the last one stopped. The
  samples are the same as a render straight through.
  - `pass_frames(&core)` is the chunk to the end of the pass that plays (the
    first chunk includes the lead-in). `Core::served` is where the host
    stands.
  - `estimate(&core, frames)` says how long a chunk will take, in
    microseconds on the reference host (wasm in Node on the hands' machine).
    It uses the cost units that the loop's voices held over the last pass. A
    host scales it by what its last chunk took against its estimate.
  - `tools/ahead.mjs` sweeps chunk sizes (`--sweep`), checks the estimate
    (`--estimate`), and times the render speed for each loop in Node and in
    Chromium. `speed.html` does it on a phone.
  - The C header has `dl_player_pass_frames` and `dl_player_estimate`, and
    `seed.c --ahead` renders one pass for each call.

**Why the render depends on when notes are given to the core:** the core
keeps its waiting notes in no fixed order (a note that starts takes the last
one's place). So which voice a note takes, and the order in which the voices
are summed, depend on what waits. The player always gives notes in the same
way (one block at a time, `LOOKAHEAD` ahead), so its renders are the same
everywhere. If a host gives a whole render to the core before it starts, the
same notes are summed in another order. The difference is about 88 dB under
the render, so nobody can hear it, but the hashes differ.

### Costs

Nothing allocates: the generator's lists, two passes and the budget are
fixed. At 44.1 kHz a block's deadline is 2.9 ms (`dlrender --seed N
--costs`; `tools/player-wasm.mjs --costs` for the wasm).

- Natively, the worst block is 0.45 ms (16%), all of it the core's audio.
- The worst stage of a load is 0.14 ms (5%), a slice of the tuned kick's fit.
- Making loops is 0.4% of a minute's render.
- In wasm (Node), the worst block while a loop is made is 0.28 ms (10%),
  with its audio.

On every target, QEMU included, the worst stage of a load costs less than
the same loop's worst audio block. So making a loop never makes the worst
block.

## The request

The request (`Request`) is what a load asks for in addition to the seed.
What the request leaves out is drawn from the seed, so a request of nothing
is the seed's own loop. If a request cannot be met, it is refused when it is
built, with a short plain line (`request::TEMPO_OUT` and others). It is never
played as something else.

`Request::parse("glacial=0.7,misty=0.3,bpm=70-85")` reads a request as text,
as `dlrender --request` and `dl_player_ask` do.

In most parts of the request, every draw is made as usual, and then the
request overrules one value. So nothing else moves.

- **Vibes,** by name or number, each with a weight (`with_weight`: the share
  of the loop that it steers) or without one (`with`, as a listener picks
  them).
- **The tempo:** `with_tempo(lo, hi)`, from 32 to 190 bpm. Equal values pin
  it.
- **The theme** (`Request::with_theme`; `theme=1234` as text,
  `dl_player_theme`) bends the loop of another seed. The new loop keeps that
  loop's profile mix, key, mode, meter and tune (the melody's figure and
  rhythm). The vibes, the tempo, the pins and the load's own seed bend the
  rest. A friend's theme is its seed, loaded with itself as the theme and the
  day's vibes: the same tune in the same key, with a new mood.
- **The pins** (`request::Pins`; `with_pin`, `dl_player_pin`) fix named
  settings:
  - a choice to one of its options (`organ=on`, `tunedKick=long`,
    `arc=today`);
  - the settings that each choice draws (`arc.period=240`, `kick.note=33`,
    `lateFloor.order=kitFirst`, `padSweep.q=0.9`);
  - the echo's time (`echo.beats=1`) and the 32 settings of the space
    recipe (`space.room=0.8`).

  Each pin must be a value that the loop could draw (`request::SETTING_OUT`
  past it). A choice pinned on plays where its eligibility test allows it,
  and the default plays where not. A setting pinned shapes its choice when
  the loop plays it, but does not turn the choice on. `js/pins.js` is the
  table, and says why.
- **The length** (`Request::with_length`; `bars=1024` or `bars=endless` as
  text, `dl_player_length`; `generator/piece.rs`): any whole number of bars
  from 1 up, or `Length::Endless`.
  - Up to 32 bars (the longest that any profile draws), it is the loop's own
    length.
  - Past 32 bars, and for Endless, the loop keeps the length that it drew,
    and the piece is that loop played section after section. Section `n` is
    its pass `n` as the wander draws it, from the seed and the number alone
    (`Generator::section`). So the memory and the cost of a section are the
    same at 4 bars, 32,768 or Endless, and the player can reach any section
    straight from its number.
  - If the loop's length does not divide the piece, the last section of a
    round is cut short at a bar line (`Piece::bars_of`). At its end, a piece
    comes round again, and its sections are numbered on.
  - A piece's first section is section 0. `player.piece()` says how a round
    ends, and the pass in `position()` is the section.
  - `piece::time` is the play time that the app's Bars picker shows
    (`pieceTime` in `js/request.js`).
  - The length says how many bars the loop is, never when it ends. The player
    plays round after round. The app's track length decides when a track
    hands over. If it ends inside a pass, the core lets its notes go at a
    phrase line (`dl_fade_all`, `Core::fade_all`).
  - `dlrender --endless 24` renders a day of Endless at speed (CI's
    `endless` job checks that nothing drifts or grows). `tests/length.rs`
    checks the rest.
- **The key and the mode** (`Request::with_keys`, `Request::with_scales`;
  `key=D`, `key=D|G`, `scale=dorian` and `scale=dorian|aeolian` as text;
  `dl_player_keys` and `dl_player_scales`, with a bit for each home note, C
  the lowest, and for each mode by its place in `theory::SCALES`). One note
  or mode is a pin, and a set is a choice ("D or G"). If the key or mode that
  the seed drew is in the set, it stays. Else one of the set is drawn from a
  stream of the seed's own. The modes are weighted by how far this profile
  mix and these vibes lean toward each one, with a floor of 0.25, so no pair
  is forbidden. A key and a mode overrule a theme's. The generator works in
  any mode, so a progression written for another mode falls back to the
  seven-note shapes.
- **The style** (`Request::with_styles`; `style=tide` or `style=tide|shrine`
  as text; `dl_player_styles`, with a bit for each profile by its place in
  `request::PROFILE_ORDER`): one profile or a set. If every profile of the
  loop's mix is in the set, the mix stays. Else each profile outside the set
  is replaced by one in the set, drawn as the mix's own draw weighs the
  profiles. A pinned style is that profile alone (weight 1). A set keeps the
  loop's blend across its members. A style overrules a theme's mix, but the
  theme's key, mode, meter and tune stay (`generator::spec::ask_mix`).
- **The voices and the layers** (`Request::with_voices`,
  `Request::with_layer`; `voice.melody=kalimba|marimba` and
  `layer.drums=off` as text; `dl_player_voices` and `dl_player_layer`, the
  layer 0 to 4 in the core's order: drums, bass, chords, melody, texture).
  - For each layer, a voice or a set of voices (`request::VOICE_ORDER`). The
    choir is rare and is not offered. The drums' voice is the kit, and the
    texture's is its kind. If the voice that the loop drew is in the set, it
    stays. Else one of the set is drawn from the layer's own seed, weighted
    by the profiles' pool, with a floor of 0.25 (`generator::asked`).
  - A voice asked of the melody or the chords is the voice that they play.
  - A layer asked **on** is never left out by its own chances, and plays
    throughout.
  - A layer asked **off** is muted, as the listener's mute would mute it
    (`Spec::layers_off`). The same unmute brings it back.
  - All five layers off is the one request that cannot be met
    (`request::ALL_LAYERS_OFF`).

## The C interface

`include/dlcore.h` has the same calls as the player: `dl_player_start`,
`dl_player_load`, `dl_player_change`, `dl_player_next_change`,
`dl_player_render` and others. The request has `dl_player_vibe`,
`dl_player_weight`, `dl_player_ask_tempo`, `dl_player_theme`,
`dl_player_pin`, `dl_player_length`, `dl_player_keys`, `dl_player_scales`,
`dl_player_styles`, `dl_player_voices`, `dl_player_layer` and
`dl_player_ask`, each with its refusal line.

To build the library, run `cargo rustc --release --lib --features capi
--crate-type staticlib`. The host gives each player its memory.
`examples/c/seed.c` is a full C host that turns a seed into a WAV file.
