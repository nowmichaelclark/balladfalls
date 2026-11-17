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

use dlcore::block::Event;
use dlcore::player::host::Host;
use dlcore::player::{JUMP_FADE, Jump, Kind, Player, Request, START, State};
use dlcore::{EXTRA, Key, QUANTUM, Tap};

const RATE: f64 = 44_100.0;

fn roomy(f: impl FnOnce() + Send + 'static) {
    let stack = std::mem::size_of::<Player>() * 4 + (16 << 20);
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
}

impl Decide {
    fn new() -> Self {
        Decide { frame: 0, key: Key { seed: 0, pass: 0, step: 0, ord: 0 }, notes: Vec::new(), fades: Vec::new(), sets: Vec::new() }
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
    fn param(&mut self, _: u32, _: u32, _: f64, _: f64, _: f64) {}
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
