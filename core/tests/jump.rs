//! A jump within a piece (session 17, queue item 106a): `Player::jump`. The
//! place a jump lands on plays what playing would have reached there: the
//! notes the player hands over from the jump's first step are the notes
//! playing hands over at the same steps, bit for bit (their pitches, lengths,
//! velocities, voices and keys; their times to the microsecond, counted from
//! that first step), on loops that draw slowOpening, widePad's late kind,
//! padWow, wideSweep, twang and lowBell; it lands on a phrase line, heard a
//! few blocks after it is asked; jumping back and forth leaves nothing
//! ringing; where it is (`place`) reads the bar and the time; and nothing
//! allocates. The audio, rendered both ways, is `dlrender --jumps`'s.

// Steps, blocks and seconds of a few minutes' play, as floats and back; a
// time the player hands over is compared as it handed it over.
#![allow(clippy::cast_possible_truncation, clippy::cast_sign_loss, clippy::cast_precision_loss, clippy::float_cmp)]

use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::Cell;

use dlcore::Core;
use dlcore::block::Event;
use dlcore::player::host::Host;
use dlcore::player::{Fades, GAIN_DIP, JUMP_FADE, Jump, Kind, Player, Request, START, State, Track};
use dlcore::{EXTRA, Key, QUANTUM, Tap};

const RATE: f64 = 44_100.0;

struct Counting;

thread_local! {
    static ALLOCATIONS: Cell<usize> = const { Cell::new(0) };
}

fn allocations() -> usize {
    ALLOCATIONS.with(Cell::get)
}

unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        ALLOCATIONS.with(|n| n.set(n.get() + 1));
        unsafe { System.alloc(layout) }
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        unsafe { System.dealloc(ptr, layout) }
    }
}

#[global_allocator]
static COUNTING: Counting = Counting;

fn roomy(f: impl FnOnce() + Send + 'static) {
    let stack = (std::mem::size_of::<Core>() + std::mem::size_of::<Player>()) * 4 + (16 << 20);
    std::thread::Builder::new().stack_size(stack).spawn(f).expect("a thread").join().expect("the test");
}

/// A note as the player hands it over: its key, and what it is.
#[derive(Clone, Copy, Debug, PartialEq)]
struct Note {
    key: (u32, u32, u32),
    voice: u32,
    channel: u32,
    time: f64,
    midi: f64,
    dur: f64,
    vel: f64,
    parts: u32,
}

/// A host with no audio: the clock a block at a time, and the notes written
/// down. Deciding is all a jump is held to here; the audio is
/// `dlrender --jumps`'s.
struct Decide {
    frame: u64,
    key: Key,
    notes: Vec<Note>,
    fades: Vec<(f64, f64)>,
    sets: Vec<(u32, usize, usize, f64, f64)>,
    params: Vec<(u32, u32, f64, f64)>,
}

impl Decide {
    fn new() -> Self {
        Decide { frame: 0, key: Key { seed: 0, pass: 0, step: 0, ord: 0 }, notes: Vec::new(), fades: Vec::new(), sets: Vec::new(), params: Vec::new() }
    }
}

impl Host for Decide {
    fn frame(&self) -> u64 {
        self.frame
    }
    fn key(&mut self, key: Key) {
        self.key = key;
    }
    fn note(&mut self, voice: u32, channel: u32, time: f64, midi: f64, dur: f64, vel: f64, parts: u32, _: [f64; EXTRA]) {
        let k = self.key;
        self.notes.push(Note { key: (k.pass, k.step, k.ord), voice, channel, time, midi, dur, vel, parts });
    }
    fn event(&mut self, _: u32, _: Event) {}
    fn damp(&mut self, _: u32, _: f64) {}
    fn set(&mut self, channel: u32, block: usize, setting: usize, value: f64, time: f64) {
        self.sets.push((channel, block, setting, value, time));
    }
    fn route(&mut self, _: u32, _: usize, _: usize, _: Option<Tap>, _: f64) {}
    fn param(&mut self, id: u32, op: u32, value: f64, time: f64, _: f64) {
        self.params.push((id, op, value, time));
    }
    fn steal(&mut self, _: u32, _: Key, _: f64, _: f64) {}
    fn fade_all(&mut self, from: f64, to: f64) {
        self.fades.push((from, to));
    }
    fn bass_lift(&mut self, _: f64) {}
    fn space_range(&mut self, _: usize, _: f64, _: f64) {}
}

/// The ears' corpus loops (corpus seed 20261009) that draw what batch 6 gave
/// time and memory, each as a 32,768-bar piece: #2 slowOpening (an arc), #56
/// widePad's late kind and lowBell (an arc), #25 padWow and twang (a wander),
/// #46 wideSweep (a wander), #33 he-rosk, padWow and twang (a wander), #6
/// lowBell (a wander).
const LOOPS: [u32; 6] = [176_315_227, 550_269_749, 2_679_763_182, 431_335_035, 694_704_631, 3_372_926_893];
const PIECE: &str = "bars=32768";

/// A player playing `seed` as `request`, decided block by block from the
/// clock's start (the step `START` after the first block).
fn playing(h: &mut Decide, seed: u32, request: &str) -> Box<Player> {
    let mut p = Box::new(Player::new());
    p.attach(h, RATE, true);
    p.load(seed, &Request::parse(request).expect("a request"));
    p.ready(h);
    block(&mut p, h);
    assert_eq!(p.state(), State::Playing);
    p
}

/// One block: decided, the clock on, the events taken.
fn block(p: &mut Player, h: &mut Decide) -> Vec<dlcore::player::Event> {
    p.decide(h);
    h.frame += QUANTUM as u64;
    let mut out = Vec::new();
    while let Some(e) = p.event() {
        out.push(e);
    }
    out
}

/// The notes of steps `from` to `to` (from the load) of a piece whose
/// sections are `section` steps (none cut short), their times counted from
/// step `from`'s, which fell at `at`.
fn window(notes: &[Note], section: u64, [from, to]: [u64; 2], at: f64) -> Vec<Note> {
    let mut out: Vec<Note> = notes
        .iter()
        .filter(|n| {
            let abs = u64::from(n.key.0) * section + u64::from(n.key.1);
            abs >= from && abs < to
        })
        .map(|n| Note { time: ((n.time - at) * 1e6).round() / 1e6, ..*n })
        .collect();
    out.sort_by(|a, b| a.key.cmp(&b.key).then(a.voice.cmp(&b.voice)).then(a.time.total_cmp(&b.time)));
    out
}

/// Play `seed` from its top to step `to` (from the load), and the time step
/// `from` fell at.
fn played(seed: u32, [from, to]: [u64; 2]) -> (Vec<Note>, f64) {
    let mut h = Decide::new();
    let mut p = playing(&mut h, seed, PIECE);
    let mut at = f64::NAN;
    while p.steps() < to {
        for e in block(&mut p, &mut h) {
            if e.kind == Kind::Step && e.step == from {
                at = e.time;
            }
        }
    }
    (h.notes, at)
}

/// Play `seed` for `before` seconds, jump to `to`, and play to step `until`:
/// the notes, the jump's event and when it was asked.
fn jumped(seed: u32, before: f64, to: Jump, until: u64) -> (Vec<Note>, dlcore::player::Event, f64, Box<Player>, Decide) {
    let mut h = Decide::new();
    let mut p = playing(&mut h, seed, PIECE);
    while (h.frame as f64) < before * RATE {
        block(&mut p, &mut h);
    }
    let asked = h.frame as f64 / RATE;
    assert!(p.jump(to));
    let mut landed = None;
    while landed.is_none() || p.steps() < until {
        for e in block(&mut p, &mut h) {
            if e.kind == Kind::Jump {
                landed = Some(e);
            }
        }
        assert!(h.frame as f64 / RATE < asked + 600.0, "never landed");
    }
    let e = landed.expect("a jump");
    (h.notes.clone(), e, asked, p, h)
}

fn section_steps(seed: u32) -> u64 {
    let mut h = Decide::new();
    let p = playing(&mut h, seed, PIECE);
    let s = p.generator().spec();
    (s.bars * s.steps_per_bar) as u64
}

#[test]
fn what_a_jump_plays_is_what_playing_reached_note_for_note() {
    roomy(|| {
        for seed in LOOPS {
            let section = section_steps(seed);
            // About four minutes in: past slowOpening's wait and fade and
            // widePad's late opening, some sections into the piece.
            let (target, spb) = {
                let mut h = Decide::new();
                let p = playing(&mut h, seed, PIECE);
                let s = p.generator().spec();
                let sd = 60.0 / s.bpm / 4.0;
                (dlcore::player::track::phrase_before(s, (240.0 / sd) as u64), s.steps_per_bar)
            };
            let span = [target, target + 4 * section.max(64)];
            let (notes, at) = played(seed, [span[0], span[1] + 1]);
            let (jnotes, e, _, _, _) = jumped(seed, 3.0, Jump::Bar(target as f64 / spb), span[1] + 1);
            assert_eq!(e.step, target, "seed {seed}: landed on {} for {target}", e.step);
            let a = window(&notes, section, span, at);
            let b = window(&jnotes, section, span, e.time);
            let differ = a.iter().zip(&b).filter(|(x, y)| x != y).count() + a.len().abs_diff(b.len());
            println!("seed {seed}: {} notes over {} steps from step {target}, {differ} differ", a.len(), span[1] - span[0]);
            if differ > 0 {
                for (x, y) in a.iter().zip(&b).filter(|(x, y)| x != y).take(5) {
                    println!("  played {x:?}\n  jumped {y:?}");
                }
            }
            assert!(!a.is_empty() && differ == 0, "seed {seed}: the jump's notes are not playing's");
        }
    });
}

#[test]
fn a_jump_lands_on_a_phrase_line_within_a_second_and_three_hours_in() {
    roomy(|| {
        for seed in [LOOPS[0], LOOPS[2]] {
            for request in [PIECE, "bars=endless"] {
                let mut h = Decide::new();
                let mut p = playing(&mut h, seed, request);
                for _ in 0..1000 {
                    block(&mut p, &mut h);
                }
                let asked = h.frame as f64 / RATE;
                assert!(p.jump(Jump::Seconds(3.0 * 3600.0)));
                let mut landed = None;
                let mut blocks = 0;
                while landed.is_none() {
                    blocks += 1;
                    for e in block(&mut p, &mut h) {
                        if e.kind == Kind::Jump {
                            landed = Some(e);
                        }
                    }
                    assert!(blocks < 1000, "never landed");
                }
                let e = landed.expect("a jump");
                let spec = p.generator().spec();
                let sd = 60.0 / spec.bpm / 4.0;
                assert_eq!(dlcore::player::track::phrase_before(spec, e.step), e.step, "on a phrase line");
                assert!((e.step as f64 * sd - 3.0 * 3600.0).abs() < 4.0 * 16.0 * sd + 1e-9 && e.step as f64 * sd <= 3.0 * 3600.0, "three hours in: {}", e.step as f64 * sd);
                let heard = e.time - asked;
                println!("seed {seed} {request}: landed {blocks} blocks after, heard {heard:.3} s after asked");
                assert!((START..1.0).contains(&heard), "heard {heard} s after");
                // Every note before the jump falls from its first step.
                assert_eq!(h.fades.last().copied(), Some((e.time, e.time + JUMP_FADE)));
                // Where it is: three hours in, and (Endless) no end.
                for _ in 0..200 {
                    block(&mut p, &mut h);
                }
                let place = p.place(&h).expect("a place");
                println!("  place {place:?}");
                assert!((place.played - 3.0 * 3600.0).abs() < 30.0, "{place:?}");
                assert_eq!(place.bars.is_none(), request.contains("endless"));
                assert_eq!(place.left.is_none(), request.contains("endless"));
                if let (Some(bars), Some(left)) = (place.bars, place.left) {
                    assert!((place.bar / bars - place.played / (place.played + left)).abs() < 1e-6, "{place:?}");
                }
            }
        }
    });
}

#[test]
fn jumping_back_and_forth_leaves_nothing_ringing() {
    roomy(|| {
        let seed = LOOPS[4];
        let mut h = Decide::new();
        let mut p = playing(&mut h, seed, PIECE);
        let section = section_steps(seed) as f64;
        for i in 0..20u32 {
            for _ in 0..120 {
                block(&mut p, &mut h);
            }
            let to = if i % 2 == 0 { Jump::Section(u64::from(40 + i * 7)) } else { Jump::Bar(f64::from(i) * 3.0) };
            let before = h.fades.len();
            let sets = h.sets.len();
            assert!(p.jump(to));
            let mut landed = None;
            while landed.is_none() {
                for e in block(&mut p, &mut h) {
                    if e.kind == Kind::Jump {
                        landed = Some(e);
                    }
                }
            }
            let e = landed.expect("a jump");
            // Everything handed over before it falls from its first step,
            // and no note sent before the jump begins after the fade's end.
            assert_eq!(h.fades.len(), before + 1);
            assert_eq!(h.fades[before], (e.time, e.time + JUMP_FADE));
            if let Jump::Section(n) = to {
                assert_eq!(e.step as f64, n as f64 * section, "section {n}");
            }
            // padWow's swings stand where playing would have them.
            let age = h.sets[sets..].iter().find(|s| s.2 == dlcore::blocks::pad_wow::AGE && s.1 == dlcore::blocks::own::PAD_WOW);
            let sd = 60.0 / p.generator().spec().bpm / 4.0;
            assert!(age.is_some_and(|a| (a.3 - e.step as f64 * sd).abs() < 1e-6 && a.4 == e.time), "{age:?}");
        }
        // And it plays on: notes after the last jump.
        let n = h.notes.len();
        for _ in 0..2000 {
            block(&mut p, &mut h);
        }
        assert!(h.notes.len() > n);
    });
}

#[test]
fn a_jump_on_a_core_allocates_nothing() {
    roomy(|| {
        let mut core = Box::new(Core::new());
        let mut player = Box::new(Player::new());
        player.start(&mut core, RATE, 2, true).expect("a player");
        player.load(LOOPS[1], &Request::parse(PIECE).expect("a request"));
        player.ready(&mut *core);
        let mut left = [0.0f32; QUANTUM];
        let mut right = [0.0f32; QUANTUM];
        let before = allocations();
        for i in 0..400u32 {
            if i % 40 == 10 {
                assert!(player.jump(if i % 80 == 10 { Jump::Seconds(f64::from(i) * 9.0) } else { Jump::Section(u64::from(i)) }));
            }
            player.render(&mut core, &mut [&mut left, &mut right]).expect("a render");
            while player.event().is_some() {}
            let _ = player.place(&*core);
        }
        assert_eq!(allocations(), before, "a jump allocated");
    });
}

// Session 30h (queue item 116): the timeline moves the playhead on any loop,
// paused or playing. A short loop's rail asks for a step (`Jump::Step`),
// exactly; a jump asked while paused is held and lands as Play goes on; a
// step's jump moves a time's track with it, so it ends on its own clock.

/// The ears' corpus loops as the app's short loops (no length asked: each
/// its own bars, 32 at most).
const SHORT: [u32; 3] = [176_315_227, 2_679_763_182, 694_704_631];

/// `playing`, at full or lite, and the seconds a step takes.
fn playing_at(h: &mut Decide, seed: u32, request: &str, full: bool) -> Box<Player> {
    let mut p = Box::new(Player::new());
    p.attach(h, RATE, full);
    p.load(seed, &Request::parse(request).expect("a request"));
    p.ready(h);
    block(&mut p, h);
    assert_eq!(p.state(), State::Playing);
    p
}

fn step_dur(p: &Player) -> f64 {
    60.0 / p.generator().spec().bpm / 4.0
}

/// Blocks until the jump lands: its event (and the End and Loop events on
/// the way, none expected).
fn land(p: &mut Player, h: &mut Decide) -> dlcore::player::Event {
    for _ in 0..1000 {
        for e in block(p, h) {
            if e.kind == Kind::Jump {
                return e;
            }
        }
    }
    panic!("never landed");
}

/// The notes of `seed` played from its top, its steps `[from, to)`, their
/// times from step `from`'s.
fn reached(seed: u32, request: &str, full: bool, [from, to]: [u64; 2]) -> Vec<Note> {
    let mut h = Decide::new();
    let mut p = playing_at(&mut h, seed, request, full);
    let section = (p.generator().spec().bars * p.generator().spec().steps_per_bar) as u64;
    let mut at = f64::NAN;
    while p.steps() < to + 1 {
        for e in block(&mut p, &mut h) {
            if e.kind == Kind::Step && e.step == from {
                at = e.time;
            }
        }
    }
    window(&h.notes, section, [from, to], at)
}

/// Playing's notes against a jump's from the same step: the same at full,
/// note for note. At lite the voice budget refuses what doesn't fit beside
/// what is still ringing, and what rang before a jump falls at it, so a
/// jump may play a note playing refused (or another of a chord's): a few in
/// a hundred at most, either way.
fn same_notes(played: &[Note], jumped: &[Note], full: bool, what: &str) {
    let missing = played.iter().filter(|x| !jumped.contains(x)).count();
    let added = jumped.iter().filter(|y| !played.contains(y)).count();
    println!("  {what}: {} notes, {missing} missing, {added} added", played.len());
    for x in played.iter().filter(|x| !jumped.contains(x)).take(3) {
        println!("  played only {x:?}");
    }
    for y in jumped.iter().filter(|y| !played.contains(y)).take(3) {
        println!("  jumped only {y:?}");
    }
    assert!(!played.is_empty(), "{what}: no notes");
    if full {
        assert!(missing == 0 && added == 0, "{what}: the jump's notes are not playing's");
    } else {
        assert!(missing * 100 <= played.len() * 3 && added * 100 <= played.len() * 3, "{what}: {missing} missing, {added} added");
    }
}

#[test]
fn jump_kinds_are_read_in_one_place() {
    assert_eq!(Jump::of(0, 7.0), Some(Jump::Section(7)));
    assert_eq!(Jump::of(1, 7.5), Some(Jump::Bar(7.5)));
    assert_eq!(Jump::of(2, 90.0), Some(Jump::Seconds(90.0)));
    assert_eq!(Jump::of(3, 37.0), Some(Jump::Step(37)));
    assert_eq!(Jump::of(3, -1.0), None);
    assert_eq!(Jump::of(3, f64::NAN), None);
    assert_eq!(Jump::of(0, f64::INFINITY), None);
    assert_eq!(Jump::of(4, 1.0), None);
}

#[test]
fn a_short_loops_step_jump_lands_on_its_step_and_plays_what_playing_reached() {
    roomy(|| {
        for full in [true, false] {
            // Into its first pass, and into a later one.
            for (seed, wait) in SHORT.iter().flat_map(|&seed| [(seed, 600), (seed, 12_000)]) {
                let mut h = Decide::new();
                let mut p = playing_at(&mut h, seed, "", full);
                let spec = p.generator().spec();
                assert!(spec.length.is_none() && spec.bars <= 32.0, "a short loop: {} bars", spec.bars);
                let section = (spec.bars * spec.steps_per_bar) as u64;
                for _ in 0..wait {
                    block(&mut p, &mut h);
                }
                // Back into the pass before the one playing, on a step no
                // phrase line is on.
                let now = p.steps();
                let target = (now / section).saturating_sub(1) * section + 37 % section;
                assert_ne!(dlcore::player::track::phrase_before(p.generator().spec(), target), target, "not a phrase line");
                let asked = h.frame as f64 / RATE;
                let before = h.notes.len();
                assert!(p.jump(Jump::Step(target)));
                let e = land(&mut p, &mut h);
                let heard = e.time - asked;
                println!("seed {seed} full {full}: step {target} heard {heard:.4} s after asked");
                assert_eq!(e.step, target, "landed on the step asked");
                assert!((START..0.06).contains(&heard), "heard {heard} s after");
                assert_eq!(h.fades.last().copied(), Some((e.time, e.time + JUMP_FADE)));
                let span = [target, target + 2 * section];
                while p.steps() < span[1] + 1 {
                    block(&mut p, &mut h);
                }
                let played = reached(seed, "", full, span);
                same_notes(&played, &window(&h.notes[before..], section, span, e.time), full, &format!("seed {seed} full {full}, step {target}"));
                // Where it is: the step asked's bar, in its pass.
                let place = p.place(&h).expect("a place");
                assert!(place.bars.is_some() && place.bar < place.bars.unwrap_or(0.0), "{place:?}");
            }
        }
    });
}

#[test]
fn a_jump_while_paused_is_held_and_play_goes_on_from_it() {
    roomy(|| {
        for full in [true, false] {
            // A short loop by its step, and a long piece by its bar (on the
            // phrase line at or before it, as playing).
            for (request, long) in [("", false), (PIECE, true)] {
                let seed = SHORT[0];
                let mut h = Decide::new();
                let mut p = playing_at(&mut h, seed, request, full);
                let spec = p.generator().spec();
                let spb = spec.steps_per_bar as u64;
                let section = (spec.bars * spec.steps_per_bar) as u64;
                for _ in 0..800 {
                    block(&mut p, &mut h);
                }
                p.stop();
                assert!(p.place(&h).is_none(), "paused with nothing held: no place");
                for _ in 0..50 {
                    block(&mut p, &mut h);
                }
                let (to, want) = if long {
                    let bar = 300u64;
                    (Jump::Bar(bar as f64 + 0.5), dlcore::player::track::phrase_before(p.generator().spec(), bar * spb))
                } else {
                    let t = 3 * section + 21;
                    (Jump::Step(t), t)
                };
                assert!(p.jump(to), "a jump while paused is taken");
                // Held: nothing lands, nothing is decided, the place says it.
                let notes = h.notes.len();
                for _ in 0..200 {
                    assert!(block(&mut p, &mut h).iter().all(|e| e.kind != Kind::Jump), "nothing lands while paused");
                }
                assert_eq!(h.notes.len(), notes, "nothing decided while paused");
                let place = p.place(&h).expect("held, a place");
                let round = dlcore::player::track::round_steps(p.generator().spec()).expect("a round");
                assert!((place.bar - (want % round) as f64 / spb as f64).abs() < 1e-9, "{place:?} for step {want}");
                // Play: it lands there, heard within 0.06 s of the resume.
                let resumed = h.frame as f64 / RATE;
                let before = h.notes.len();
                p.resume(0.0);
                let e = land(&mut p, &mut h);
                let heard = e.time - resumed;
                println!("{request:?} full {full}: held to step {want}, heard {heard:.4} s after Play");
                assert_eq!(e.step, want);
                assert!(heard < if long { 0.065 } else { 0.06 }, "heard {heard} s after");
                if !long {
                    let span = [want, want + section];
                    while p.steps() < span[1] + 1 {
                        block(&mut p, &mut h);
                    }
                    let played = reached(seed, request, full, span);
                    same_notes(&played, &window(&h.notes[before..], section, span, e.time), full, &format!("{request:?} full {full}, held"));
                }
                // A jump under way at a pause is held too.
                assert!(p.jump(Jump::Step(spb * 2)));
                p.stop();
                for _ in 0..20 {
                    assert!(block(&mut p, &mut h).iter().all(|e| e.kind != Kind::Jump));
                }
                p.resume(0.0);
                assert_eq!(land(&mut p, &mut h).step, spb * 2);
                // And a load drops one held.
                p.stop();
                assert!(p.jump(Jump::Step(spb)));
                p.load(seed, &Request::parse(request).expect("a request"));
                p.ready(&mut h);
                for _ in 0..50 {
                    assert!(block(&mut p, &mut h).iter().all(|e| e.kind != Kind::Jump), "a load drops the jump held");
                }
            }
        }
    });
}

#[test]
fn a_step_jump_moves_a_times_track_and_its_fades_with_it() {
    roomy(|| {
        for full in [true, false] {
            let seed = SHORT[1];
            let mut h = Decide::new();
            let mut p = Box::new(Player::new());
            p.attach(&mut h, RATE, full);
            p.set_track_with(&h, Track::Seconds(60), Fades { fade_in: true, fade_out: true });
            p.load(seed, &Request::parse("").expect("a request"));
            p.ready(&mut h);
            block(&mut p, &mut h);
            let sd = step_dur(&p);
            for _ in 0..(10.0 * RATE / QUANTUM as f64) as usize {
                block(&mut p, &mut h);
            }
            // To 55 s on the track's clock: inside its 8 s fade out.
            let target = (55.0 / sd) as u64;
            let left = 60.0 - target as f64 * sd;
            assert!(p.jump(Jump::Step(target)));
            let gains = h.params.len();
            let e = land(&mut p, &mut h);
            block(&mut p, &mut h);
            assert_eq!(e.step, target);
            let end = p.track_at().expect("a time's track");
            assert!((end - (e.time + left)).abs() < 1e-9, "ends {left} s after the step: {} s", end - e.time);
            let told = p.track_end().expect("the track's end") as f64;
            assert!((told - (target as f64 + left / sd)).abs() <= 1.0, "its end step {told} as before");
            // Its time left: the track's, or the round's where that is sooner.
            let spb = p.generator().spec().steps_per_bar;
            let round_left = |pl: &dlcore::player::Place| (pl.bars.expect("a round") - pl.bar) * spb * sd;
            let place = p.place(&h).expect("a place");
            assert!((place.left.expect("time left") - js_min(end - h.frame as f64 / RATE, round_left(&place))).abs() < 1e-9, "{place:?}");
            // The gain falls from where the fade out has it there: no fade in
            // played again, the fade out's line to silence on its second.
            let g: Vec<(u32, f64, f64)> = h.params[gains..].iter().filter(|q| q.0 == dlcore::TRACK_GAIN).map(|q| (q.1, q.2, q.3)).collect();
            let level = (end - (e.time + GAIN_DIP)) / 8.0;
            assert!(g.iter().any(|q| (q.2 - (e.time + GAIN_DIP)).abs() < 1e-9 && (q.1 - level).abs() < 1e-9), "{level} at the landing: {g:?}");
            assert!(g.iter().any(|q| (q.2 - end).abs() < 1e-9 && q.1 == 0.0), "silence on its second: {g:?}");
            // Back to its first second: the fade in again, the full minute
            // to go.
            assert!(p.jump(Jump::Step(0)));
            let gains = h.params.len();
            let e = land(&mut p, &mut h);
            block(&mut p, &mut h);
            let end = p.track_at().expect("a time's track");
            assert!((end - (e.time + 60.0)).abs() < 1e-9, "a minute from its start: {}", end - e.time);
            let g: Vec<(u32, f64, f64)> = h.params[gains..].iter().filter(|q| q.0 == dlcore::TRACK_GAIN).map(|q| (q.1, q.2, q.3)).collect();
            assert!(g.iter().any(|q| (q.2 - (e.time + GAIN_DIP)).abs() < 1e-9 && (q.1 - GAIN_DIP / 3.0).abs() < 1e-9), "rising from silence: {g:?}");
            assert!(g.iter().any(|q| (q.2 - (e.time + 3.0)).abs() < 1e-9 && q.1 == 1.0), "at its level 3 s on: {g:?}");
            // Paused, the same: held, the place's time left the moved one.
            for _ in 0..200 {
                block(&mut p, &mut h);
            }
            p.stop();
            let target = (30.0 / sd) as u64;
            assert!(p.jump(Jump::Step(target)), "paused: {:?}", p.state());
            let held = p.place(&h).expect("a place");
            assert!((held.left.expect("time left") - js_min(60.0 - target as f64 * sd, round_left(&held))).abs() < 1e-6, "{held:?}");
            assert!(p.track_end().is_some(), "paused, the track's end is still told");
            p.resume(0.0);
            let e = land(&mut p, &mut h);
            let end = p.track_at().expect("a time's track");
            assert!((end - (e.time + 60.0 - target as f64 * sd)).abs() < 1e-6, "{}", end - e.time);
            // And it ends there, on its second.
            let mut ended = None;
            while ended.is_none() {
                for ev in block(&mut p, &mut h) {
                    if ev.kind == Kind::End {
                        ended = Some(ev);
                    }
                }
                assert!((h.frame as f64) < (end + 5.0) * RATE, "never ended");
            }
            assert!((ended.expect("the end").time - end).abs() < 1e-9);
        }
    });
}

#[test]
fn a_held_jump_allocates_nothing() {
    roomy(|| {
        let mut core = Box::new(Core::new());
        let mut player = Box::new(Player::new());
        player.start(&mut core, RATE, 2, true).expect("a player");
        player.set_track_with(&*core, Track::Seconds(120), Fades { fade_in: true, fade_out: true });
        player.load(SHORT[2], &Request::parse("").expect("a request"));
        player.ready(&mut *core);
        let mut left = [0.0f32; QUANTUM];
        let mut right = [0.0f32; QUANTUM];
        let before = allocations();
        for i in 0..600u64 {
            match i % 60 {
                10 => assert!(player.jump(Jump::Step(i * 3))),
                20 => player.stop(),
                25 => assert!(player.jump(Jump::Step(i))),
                30 => player.resume(0.0),
                _ => {}
            }
            player.render(&mut core, &mut [&mut left, &mut right]).expect("a render");
            while player.event().is_some() {}
            let _ = player.place(&*core);
            let _ = player.track_end();
        }
        assert_eq!(allocations(), before, "a jump allocated");
    });
}

fn js_min(a: f64, b: f64) -> f64 {
    if a < b { a } else { b }
}
