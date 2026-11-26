# Long pieces

A **long piece** is a loop past 32 bars, or Endless. A short loop repeats
as written. A long piece is composed: it has a journey (an arc or a
wander), a theme that returns, and joins that are written where something
changes. This page is the design as it is built (queue item 102). Every
number in `data/longform.txt` is a first pick, for Mikey's ears.

The story of how it was built, and the listening set, are in the wiki:
"Ballad Falls/Long pieces" and its subpages.

**Where it lives:**

- The plan: `core/src/generator/longform.rs`. Its numbers: `data/longform.txt`.
- What a section plays: `core/src/generator/heard.rs`.
- The checks: `core/tests/longform.rs`, `arc.rs`, `themes.rs`, `joins.rs`,
  `heard.rs` and `jump.rs` (in the gate), and `node tools/longform.mjs`,
  `tools/longform-themes.mjs` and `tools/longform-played.mjs` (on a corpus).
  CI's `longform` workflow runs the full check in shards. The nightly runs
  `tools/longform-holes.mjs`.

**Read a piece's map** with `dlgen --map SEED REQUEST [--from N] [--count N]`.
In `core/`: `cargo run --release --example dlgen -- --map 7 bars=256,journey=arc`.
Add `--movements` for one line a movement. In Node, use `pieceMap` in
`tools/gen-lib.mjs`.

## What a plan is

`Generator::form()` gives a piece's `Form`. It is a few numbers, made from
the spec, the request's edits and the layers the loop has.
`Form::at(section, phrase)` gives a `Span`: the journey, the role, the theme
and its variation, the key, the tempo, the energy (0 to 1), a wander's
state, and what changed from the unit before (`changed`, one bit a thing).

**Nothing is stored, and nothing walks.** A unit finds its arc or its epoch
by a division, and draws on random streams salted by that number. So a
section costs the same at section 1 and at section 10^9: about 0.7
microseconds for an arc's unit and 2.3 for a wander's, natively. A loop of
32 bars or less, or with no length, has no plan.

**Units are set in time.** Spans are drawn in minutes and seconds, and
turned into units at the loop's tempo. The unit is the section. If an arc
would have fewer than 12 sections, or a wander's mean hold fewer than 3,
the unit is the **phrase line** inside a section (4 bars, 2, or the
section). `Form::units_in(section)` gives 1 or the section's phrases. A
last section cut short has fewer units, and its last unit fewer bars.

**The plan never reads the wander slider.** It reads the spec alone. The
slider still sets how much a section breathes inside its role.

## The arc

An arc runs through nine roles in order. Each role takes a share of the arc
(`[longform arc]`): opening 7%, theme 15%, build 8%, second 15%,
development 15%, peak 7%, release 9%, return 16%, close 8%. Each arc draws
where its peak ends (0.60 to 0.72 of the way) and how high it is (0.85 to
1). Every role has at least one unit.

| Role | Theme | Key | Energy (peak = 1) |
|---|---|---|---|
| opening | A, outline | home | 0.25 to 0.4 |
| theme | A, plain | home | 0.45 to 0.5 |
| build | A, plain or register or voice | home | 0.5 to 0.65 |
| second | B (a one-theme piece: A in the related key) | the arc's related key | 0.65 |
| development | fragments: A, then its answer (B; in a finale, an earlier arc's B) | through the related keys, each at least 30 s | 0.65 to 0.9 |
| peak | A, register | the arc's related key | 1 |
| release | B (or A), outline; its last phrase may hold the bass on the home fifth | the same | 0.85 to 0.55 |
| return | A with one variation (register, voice, stretched, reharmonized, answered) | home | 0.55 to 0.5 |
| close / breath | A outline, closing on the tonic / A thinning to its thinnest | home | 0.4 to 0.15 / 0.3 to 0.2 |

- **Length:** an arc lasts 4 to 15 minutes, drawn for each piece. Glacial,
  droning and similar vibes lean it longer. A finite piece holds a whole
  number of arcs of about that length. Endless plays arcs of exactly that
  length in turn, each ending in a breath.
- **The small form** is for an arc under 4 minutes (most 64-bar pieces):
  opening, theme, lift, release, return, close. It has one theme, in the
  home key throughout.
- **Movements:** in a finite piece of several arcs, every arc but the last
  ends in a breath. Each arc has its own B (`Span::theme_seed`, from the
  seed and the arc's number). The last arc's development recalls the
  earlier movements' Bs (`Theme::Recall`, one a section), and only the last
  arc closes.
- **Movements of different kinds** (Mikey, 2026-11-12; `longform::Kind`):
  a piece of three arcs or more, and Endless, plays a repeating cycle drawn
  for each piece. It is a **full** arc, then in a drawn order a **gentle**
  one, a **light** one and, in pieces of four or more, an **interlude**.
  - Gentle: the full form, every role's energy between 0.32 and 0.6.
  - Light: the small form.
  - Interlude: a small wander. Up to three things go out one at a time, a
    hold apart, and come home in the same order, on theme A in the home key.
  - Each kind's length is a share of the full arc's (`kinds`: 1, 0.7, 0.4,
    0.5).
  - A finite piece is whole cycles and a last full arc. So the first and
    the last are full, only the last recalls and closes, and no two
    neighbors are alike. Three movements are full, gentle or light, full.
- **One theme or two:** 70% of arc pieces whose loop has a tune get a B.
  None does where a theme was asked: then the theme stays the tune. The
  rest play A in the related key in place of B. If the second theme's own
  loop rests its tune (about 1 loop in 12), that movement keeps theme A, as
  a one-theme piece does.
- **The close** takes the last units, at least 10 seconds. A last section
  cut short borrows the bars before it. The next round starts at the
  opening again, because a round's plan is the same every time.

### How an arc is heard

`heard::Lift` and `Heard::hear_arc` play each unit's energy as marks and
levels on the loop's own events and the mix. The energy is smoothed over
its neighbors (a quarter each side, never across a round's end). Each unit
glides from where the one before ended. Nothing new is made but the
landing's few notes, so a section costs one loop's making.

**The loop as composed is the arc's fullest, near its peak.** The rest of
the arc is the loop held back a little, so the loudness climbs the whole
way, gently (`[longform energy]`).

| What | Heard as |
|---|---|
| the kit, the bass, the texture | their level in the mix: 0.85 of their own (the texture 0.7) at an opening's energy, their own near the peak, gone only as a close thins |
| the chords, the tune | a swell of under a decibel: 0.85 of their level at the lowest energy (they never rest; the tune thins in a breath) |
| the kit's pieces | the shimmer (hats, shakers, jingles) comes in between 0.3 and 0.5; every hit up to a quarter softer below the loop's own |
| the tune's density | thinner under 0.45, up to 0.55 of its notes left out (the notes on the bar lines kept longest) |
| the chords' length | held longer under 0.42, where they have room (1.5 times) |
| the tune's register | doubled an octave up, from nothing at 0.6 to 0.3 of its velocity at 0.95, at note 96 or under |
| brightness | the arc's filter (`blocks::arc`, the loop's own slow swing) aims at the energy: its center lowered toward its darkest by up to 0.6 of its range under 0.7, its depth up to half shallower over it. A loop with no swing has the filter open, lowered the same way. One control, never a second filter |
| the space | opens with the brightness, up to 0.12 of the Sound panel's |
| a finite arc's close | thins to the chords and the tune. The tune's last phrase plays whole. Then the **landing**: the round's last bars (4 s and a bar at least) play the loop's tonic chord and the tune on the tonic, alone, held for half of them and ringing out. The voice budget gives the landing its whole ceiling |

- **The kick and the backbeat stay,** softer, and the shimmer comes in with
  the energy. An opening without the kick sat 6 to 8 LU under its peak.
- **Endless** plays arc after arc, with a breath between, and never lands.
  The tune never rests in a breath. It thins to its thinnest (0.55 of its
  notes left out) at the breath's lowest energy.
- **The landing's chord** is one the loop plays (else the chords' loudest
  velocity), so it never strikes a silent chord.
- The arc works **at any slider setting**.

### How an arc's themes are heard

`heard::Lift::themed` plays the themes on the unit that the energy made.

**Theme B is another seed's tune, bent into this loop** by the request's
theme machinery (85d). The generator takes that seed's spec, its figure and
its cell, and makes the loop's melody again around them, over the same
chords. Then it finishes the tune as it finishes the loop's own: spelled
over the chords, with its slides, ornaments and harmony line. It is an
octave away if its center would sit within five semitones of the chords'.

The generator keeps two such tunes: the playing section's and the next
one's. It makes one in three stages, a block each, before the next pass is
drawn (`Generator::prepare`). The worst block for this is 44 to 73
microseconds natively, under the loop's own worst audio block. **A section
plays one tune beside the loop's own.** If its units name more, the first
one stands in for the others.

| What the map says | Heard as |
|---|---|
| theme B, a recall | the second tune in the loop's tune's voice, whole |
| a fragment | each phrase's first half, then a rest |
| a call and response (35% of the development's pairs) | theme A's fragment, then the other theme's in A's rests: one voice |
| in the related key | a fifth away, the whole loop moved; or the relative or the parallel, every note moved along the mode (`key_map`). A layer that would leave its range moves an octave, so every pitched layer stays in the key together |
| register, in a return | the tune an octave up or down by the movement's number, kept in 48 to 91 and five semitones from the chords |
| register, where the energy rises (a build, the lift, the peak) | the tune doubled an octave up, softly |
| voice | the tune in another voice of its pool (a tune with no other voice moves an octave) |
| stretched | each phrase's first half at half speed, the chords held longer |
| reharmonized | the bass, the chords and the texture in the relative key, the tune where it was |
| answered | each phrase's first half kept, its second half the answer's: the loop's own figure through `answerFigure`, made as a second tune |
| outline | in a release, at least half the tune's notes left out, the bar-line notes kept longest |
| the return prepared (half the movements) | the bass on the home key's fifth for the release's last phrase |

- **A theme stated** (B at the second, A at the return) comes in whole on
  its line. Everything else glides.
- **The octave rule** (item 84) holds in every key. If a unit's moves would
  bring the tune's center within five semitones of the chords', the chords
  or the tune move an octave.
- **A second theme's notes** are as loud as the loop's own tune's (their
  mean velocity matched).
- **A unit that plays other notes** than the loop does there (a fragment,
  another key, another tune) may sit up to 3 LU from its neighbor. The
  loop's own notes are held to 2 LU.

## The wander

A wander cuts time into **epochs**. In each epoch, each thing that may move
takes one turn, in an order drawn from the epoch's number. A turn comes at
the end of a **hold** of drawn length (60 to 300 s, mean about 3 minutes).
So exactly one thing moves at each hold's end. A unit's state is read from
this epoch and the one before, and no further back. The holds are fitted
to the epoch around their mean, but each stays within 60 to 300 s.

- **The things that move:**
  - a layer rests and later returns (two turns);
  - a layer's voice (bass, chords or tune), if its pool has another voice
    and the layer does not sing;
  - the warmth, and the space;
  - the chords' register and their length (-1, 0, +1);
  - the tune's density;
  - rarely the key: 15% of epochs visit a key **a fifth away**, the whole
    loop moved;
  - rarely the theme: 20% of epochs hand the tune to the piece's second
    theme, and bring it home in the next.
- **Everything goes out in the even epochs and comes home in the odd.** The
  warmth and the space take the other side of the loop's own each epoch,
  at least `apart` (0.4) of the way out. The tune thins to 0.55 to 0.82 of
  its notes. So every turn is a step that is heard. A turn that would move
  nothing is not taken.
- **An epoch never starts on the thing the last one ended on.** A layer's
  rest lasts one hold or two, and is never an epoch's last turn. A layer
  whose voice is changed does not rest.
- The unit after a move is `turning` (room for the glide). The rest of a
  hold is `holding`. A piece starts with everything the loop's own.
- A finite wander's last two epochs bring the key and the theme home, and
  its last units are the close. Its energy is level (about 0.5), lower
  while a layer rests or the tune is thin.

### How the wander is heard

`heard::Heard` works on each pass (`wander::Pass::heard`), drawn a section
ahead with the pass. It plays each unit of the section as marks and levels
on the loop's own events and the mix. Nothing new is made, so a section
costs one loop's making (7 to 12 microseconds natively, the same at section
1 and 10^9).

| Thing | Heard as | When |
|---|---|---|
| a layer rests, returns | its channel's gain in the mix, beside the mute (`Synth::set_plan_level`); its notes left out once it is down | a glide |
| the warmth, the space | the lowpass and the room glide (`Synth::glide_tone`), `reach` 0.25 of the Sound panel's at most; the drive stays the loop's own | a glide |
| the tune's density | its highest-ranked notes left out (the bar-line notes kept longest) | a glide |
| a voice | the same notes, another voice of the layer's pool | the line |
| the chords' register | an octave, the other way where that leaves 36 to 96 | the line |
| the chords' length | 0.6 or 1.5 of their own (never longer into the next chord) | the line |
| the key | every pitched layer, the tune's harmony and graces, a tuned kick: a fourth up or down, an octave over where a layer would leave its range | the line |
| the theme | the tune's notes become the second theme's, in the same voice; a rest where that theme rests | the line |

- **A glide** takes `glide` (24 s) over the units after its move. A unit
  starts where the one before ended, so nothing jumps. **The line** is the
  unit's first step: a phrase line, or a section's.
- Inside a hold, the loop breathes as before, **at any slider setting**.
  At 0, the player still draws a wander's sections as passes.
- **A tone the listener sets** while it plays holds from then on.
- **A finite wander closes softly.** Over its close, every layer eases to
  0.7 and the tune thins. The next round starts as the loop's own.
- **A voice moved changes the voice budget's room,** so a layer that the
  budget held back may come in.

## Which journey

Each piece draws its journey on its own stream. Arc and wander are even by
default. In Endless the arc's weight is times 0.6. The vibes lean it
(`[longform journey]`):

- toward the wander: still, serene, meditative, glacial, droning,
  floating, hazy, misty, dreamy, restful;
- toward the arc: adventurous, triumphant, soaring, lively, playful,
  wondrous, joyful, bouncy.

Measured: 49% arcs at finite lengths, and about 37% in Endless. One vibe
moves it to 29% (still) or 68% (adventurous). A request pins it with
`journey=arc` or `journey=wander` (`Request::with_journey`).

**With no length asked** (item 117; Mikey, 2026-11-23: "Sometimes"), a loop
is a long piece a tenth of the time. The length is drawn from its seed, on
its own stream (`spec::unasked_length`, `[longform unasked]`): 64, 96, 128,
192, 256, 384 or 512 bars, weighted 6, 4, 4, 2, 2, 1, 1, and never Endless.
The journey is drawn as above. A code writes no length for such a loop,
because the seed draws it again. `node tools/unasked.mjs` measures it.

## Keys

The generator finds the related keys once, from the loop's key:

- the same mode a fifth above and a fifth below, if at least 60% of the
  home notes stay (wholeTone has none);
- the relative: the mode of the same notes with the other third (a third
  away where one exists, else the nearest in brightness);
- the parallel, only to brighten a minor home, from the loop's first
  profile's scales.

No related mode is darker than 0.2 (phrygian, harmonicMinor) unless home
is. Some loops have no related key, and stay home.

## What was asked holds

- A pinned key is the home key. The arc visits other keys and returns; the
  wander never leaves it.
- A pinned scale rules out the parallel.
- A layer asked on or off, or re-rolled, never rests.
- A layer's voice that was asked never changes, and the tune is never
  handed on.
- A tone that was edited (warmth, space) never moves. A code's warmth keeps
  the filter the loop's own, and its space keeps the room.
- An arc that was asked (`arc`, `arc.*`) keeps its swing as asked.
- A theme that was asked stays the tune, and the piece has no B.
- The tempo is the loop's own for the whole piece.
- The landing is in the home key.

`core/tests/longform.rs` checks each one.

## The joins

Where two units meet and something changes, the line is written, not left
to chance. The plan chooses each unit's join toward the unit after it
(`Span::join`, `Form::join_of`), from what changes and the energy on each
side. A section's last join is known a section ahead, so a section reached
by a jump joins as one reached by playing. `heard` plays the join over the
unit's last bar (`Heard::joins`). The map names it (`dlgen --map` writes
"then fill"). The numbers are `[longform joins]`.

| Join | When | Heard as |
|---|---|---|
| **pivot** | a key changes, and the loop has chords | a chord that both keys share (`longform::pivot`), struck at the join's first step in the voice of the loop's first chord, at that chord's velocity (else the chords' loudest), and held a beat past the line. The loop's chords are out under it, and the bass is on its root |
| **prepared** | the return, prepared (half the movements) | the bass on the home fifth for the release's last phrase |
| **fill** | a theme or how it is played changes, and the energy rises by `step` (0.04) or more, or a role changes alone and the energy rises by twice that (if a kit plays) | the kit's backbeat (else its shimmer) on each step of the last beat (every other step in 6/8) where the loop has no hit, at 0.35 to 0.65 of its loudest |
| **floor** | the same, with the energy falling from the peak or the lift (if a kit or a bass plays); a key change with no chords | the kit and the bass out for the join |
| **alone** | a theme changes, with the energy level or falling after the height | every layer but the tune out for the join, if the tune sounds there; else a breath |
| **breath** | a theme changes where nothing else can join it; every wander's theme; a wander's line move (a voice, the chords' register or length) | the join's last half left out: every layer, or in a wander only the layer that moves |
| **glide** | what changes glides (a layer, the tone, a wander's density, a small energy change) | nothing at the line: the unit after glides |

- **Length:** a join is a bar, and at most a sixteenth of its unit. A
  breath is half of that, and a fill is the last beat. The floor goes out
  only once, from the peak or the lift.
- **What a join takes out:** only notes that end by the line (a note that
  rings across it plays), and only a layer heard in the unit before the
  join (at least two notes struck there). A join with nothing to take out
  is a glide.
- **What the loop can't play** falls to the next kind: a fill with no kit
  is a glide, the tune alone where it is silent is a breath, a pivot with
  no shared chord or no chords is the floor out (or a breath).
- **No join after a close.** The landing ends the round.
- **The yardstick:** every line where a theme, a key or a line move
  changes has a join that is not a glide (`tools/longform.mjs`,
  `core/tests/joins.rs`).
- **Never a hole.** A join thins the mix, but never leaves it silent where
  the loop sounds. When a unit is made, `Heard::under` reads what a tune
  alone, a floor out or a breath would keep, from its notes: each note
  sounding over the join's second half, its voice's loudness
  (`[longform loudness]`, measured by `tools/voice-loudness.mjs`), its
  velocity and its layer's level, and their echoes. If the join would leave
  the mix `hole` (12) dB under, it falls back to a breath where that reads
  under half the line, else to a glide.
- **How a hole is measured:** `tools/longform.mjs` reads every arc's join as
  played (`dl_gen_played`) in 50 ms frames against the loop as itself. A
  hole is a window whose median frame is 25 dB under the loop and 12.5 dB or
  more under the beat before it.

## Endings that land

If the length slider will stop a long piece (or Endless) before its own
close, the phrases before the stop play a close in place of a fade
(`Heard::stop_at`):

- the energy thins from where it is to the close's (0.15), at home, on
  theme A;
- the line into it is a join like any other (a pivot home, the floor out);
- the tune's last phrase plays whole;
- the landing fills the last bars: the tonic chord and the tune on the
  tonic, alone, ringing out.

The close lasts at least `[longform arc] close` (10 s), in whole phrases.
The player hears the stop with each section it draws (`Player::hear_pass`)
and again when the slider moves (`set_track`). At the stop, the next loop
follows with the old one ringing out, never faded. If the landing would
begin in steps already played (the slider moved too late), the track ends
as before. With the slider off, nothing changes.
`dlrender --track bars=N` plays it, with the core's own next loop after.

## The jump and the map

`Player::jump` (`dl_play_jump`, `dl_player_jump`, the worklet's `playJump`)
goes to a section, a bar or a time, on the phrase line at or before it. It
starts straight from the seed and the number: the section's second tune,
its pass drawn and its pass heard, a block each. Then it lands, with the
old notes falling over 0.25 s (`JUMP_FADE`). It takes about 0.06 s, three
hours in or 10^9 sections in.

- **What plays there is what playing would have reached**
  (`Sequencer::jumped`), the notes bit for bit (`core/tests/jump.rs`).
- **The blocks that change with age are set to the loop's age** (an `AGE`
  setting each, `SPACE_AGE`): lateFloor, slowOpening, widePad's opening,
  the wash's swells, padSweep's and padWow's swings, the arc's breath and
  twang's tremolo. The organ holds the chord that playing would hold.
- **What a jump lets go**, as a new loop does: anything struck before the
  line (a long chord, a held bass, the bell, twang's strings).
- **What a jump does not restore:** the phases of twang's strings and the
  organ's pipes, which run on from every note before.
- `dlrender --jumps` measures a jump against playing.

`Player::place` (`dl_play_place`) says where it is as heard: the bar of how
many, and the time played and left (none for Endless). `Player::marks`
(`dl_play_marks`, `pieceMarks` in `js/gen.js`) is the map for the page: the
units where a role, a theme, a key or a movement begins, or, with `coarse`,
only where a movement starts. A finite piece gives its whole movements in
one call (477 for a 32,768-bar piece, about 10 ms in Node). A window of
roles around the playhead takes about 1 ms. Endless gives a window at a
time.

## The cost

The plan allocates nothing and adds no state to the player. A section costs
one loop's making. A theme-B section costs what a theme-A one does, and its
tune is spread across blocks, a section ahead. Reading the joins costs a
section a few microseconds natively, so the player draws a piece's next
pass in one block and hears its plan in the next.

## Open, for Mikey's ears

- **Tempo** holds through the piece. A slight easing into the close, or a
  slower middle movement, is an idea to offer, not built.
- **The arc's strength** is the conservative end: the peak about 1 to 2 LU
  over the opening.
- **The parallel key** clashes a little more than the loop (4.5% of the
  tune's time against 3.8 to 4.6%). One line of `related` rules it out.
- **A second, smaller peak** now and then is not drawn.
- **The tempo slider while playing:** the plan uses the tempo that the
  piece loaded with, so moving the slider changes how long the spans last.
- **A second theme that rests** keeps theme A. Should it get a tune?
- Every number in `data/longform.txt` is a first pick.

## Before you change it

- Read the plan where a section is drawn: `Generator::form()`, then
  `at(n, phrase)`. Keep `Form::of` free of the player's state.
- A change to the plan's draws moves the maps. Say so in the PR.
- Keep `core/tests/longform.rs` and `node tools/longform.mjs` passing.
  When you add something that is played, add it to the tool.
