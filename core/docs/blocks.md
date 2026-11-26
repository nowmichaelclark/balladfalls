# The blocks that the app plays

This page describes the larger blocks and settings that the app plays,
beyond the simple voices. Each one is a file in `core/src/blocks/` (or in
`core/src/` for the mix's parts) and one line in the registry. Read
`core/README.md`, "How the sound is built", first.

## The organ

`src/blocks/organ.rs` is a chapel organ, held on the chords channel. It is
the first channel block that the app plays. Its line in the `channel` list
is `organ::Organ = ORGAN (organ::REST)`.

- It is silent at rest.
- Its stops and other values are in `SETTINGS`. The host sets all 21 at the
  first step of a loop.
- It hears `RETUNE` at each chord, and `RELEASE` to let go.
- It sends part of its sound into the room, past the channel's own sends
  (`Channel::SENDS`, `render_sends`).

The organ shows two rules for a channel's own block. First, its `new()` must
be all zeros, because it lives in every channel in the core's static memory.
It sets its real starting values in `start`. Second, an idle organ returns
at once from `render`, so a channel that never plays it costs nothing and
renders bit for bit as before.

## The tuned kick and its choke

`src/blocks/kick.rs` is a tuned kick drum. The host sends a choke event with
each kick of a loop that plays it. A kick that still rings then falls away in
a few milliseconds, so only one kick sounds at a time. The new hit that came
with the choke is not affected.

## subDuck

`src/blocks/sub_duck.rs` is the duck that the app plays: a gain on the whole
bass channel, keyed by the drums routed into it. When the low band of its key
(under 150 Hz) rises, it hears a kick. It then dips the bass by its depth (a
setting, scaled by how loud the kick rose) in 8 ms, and brings it back over
its recovery time (a setting). At a depth of 0 it costs nothing.

## padSweep

`src/blocks/pad_sweep.rs` sweeps a filter on the whole chords channel. Its
own `Lfo` drives its own `Filter`'s frequency, so the cutoff swings from its
closed point up by some octaves and back, once a period. The closed point,
the octaves, the period and the Q are settings.

- A new sweep starts closed at its time.
- At a load, the cutoff glides to the new loop's curve over half a second.
- A loop without a sweep glides the filter open and then stands still, at
  no cost.

`Filter::retarget` changes a running filter's settings and keeps its
memory, so the change does not click.

## The wash

`src/blocks/wash.rs` is a source on the core's sixth channel
(`WASH_CHANNEL`). No host note plays into that channel. The wash's level
follows the other five layers through five routes into its `MODS`, one for
each channel. A setting weights each route by that channel's gain in the
mix (0 for a muted channel), because a route takes a channel's signal before
its gain. `MAX_MODS` is 6, so a block can follow every channel at once. Note
lists carry the routes (`route`) and hash the sixth channel (`wash=`).

## The width ceiling

`src/blocks/width.rs` is a stereo processor in the master chain, after the
ceiling. It measures the mid and the side above 200 Hz over the last
2 seconds. If the side rises above its target against the mid, it turns the
side down in about half a second, and back up over about three. It never
changes the mid, so the fold to mono stays the same. Its settings are named
in `width::SETTINGS` (`Core::param`, `WIDTH_TARGET` to `WIDTH_UP`). The kit
feeds a stereo processor two different sides (`width/ceiling:wide`), because
a block that works only on the side does nothing with the same signal on
both sides.

## The space

`src/space.rs` says where each part sits in the stereo render. It is data:
a recipe of named settings, each with the range that a loop draws it from
(`space::SETTINGS`). The draw uses the loop's seed, how busy and how wet the
loop is, and whether its texture is light (`Core::param`, `SPACE_SEED` to
`SPACE_START`). A host can narrow or pin any setting (`Core::space_range`).

The mix makes the side signal (`mix::Side`) from:

- the room (the reverb through four allpass filters);
- the spreads (a swaying copy of the chords, the texture and the melody);
- the placements (the light kit, a light texture, glass);
- the wash's own width (`Channel::render_side`).

All of the side is highpassed, so the low end stays in the center. It rides
the same gains, duck and tails as the mid, which is the mono mix bit for bit.
The master gets left = mid + side, and right = mid - side. With no space, or
in a mono render, none of this runs.

## The bass lift

The level of the bass layer is a setting of the loop: `Core::bass_lift(db)`.
The host sends it at each load (`dl_bass_lift`; `BASS_LIFT` in
`js/choices.js`): +3 dB in a loop that plays a kick, else 0. The core stamps
it on each bass note as the note arrives. So every bass voice except the FM
`rhodesbass` is lifted in the same way, and a loop that is handed over keeps
its own lift. A host that never sends one plays the default level.

## The arc

`src/blocks/arc.rs` is a processor in the master chain, not in a channel. It
is a lowpass filter between the tone and the highpass, one in each lane of
the master (`Pair`'s way). It breathes over minutes, and it lifts the echo's
feedback as it opens (the mix takes the lift, frame by frame). A host starts
it through `Core::param` (`ARC_FROM`, then `ARC_PERIOD` at the start of the
loop). With no arc, it is no filter at all.

## The low bell

`src/blocks/low_bell.rs` is a voice that follows its channel
(`Voice::FOLLOWS`). Its notes sound into the channel after the channel's own
blocks, so a sweep or a wow does not touch them. When a note starts, the core
stamps it with the channel's level so far (`block::HEARD`: its mean square
over `block::FOLLOW` seconds). So the bell's level follows the layer's, as a
block on the whole channel would. A channel with no such note renders bit
for bit as before.

## twang

`src/blocks/twang.rs` also follows its channel. It hears one kind of event
that only it hears, a let-go (`event::LET_GO`). The strings picked at or
before the event's value let go from its time. So the player can stop the
oldest of six strings when a seventh is picked, and damp them all at a full
stop. It plays soft only. A code that pins one of its old options (slow or
bright) plays soft (`core/docs/codes.md`, "What was taken out").
