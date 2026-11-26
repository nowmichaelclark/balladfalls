//! What the samples say (steps 1 and 4): the
//! crackles Mikey heard were in the samples or in playback. These render
//! the loop that crackled (E9T-ZxDxj) and the Batch 6 album (`docs/ALBUMS.md`)
//! through the engine's own path, the commands through its queue and `fill`
//! at the callback sizes a phone asks for, through the album's track changes,
//! at full and lite, and across a quality switch as the page makes one, and
//! look for what a crackle is in the samples: a step, a value that is not a
//! number, a value past full scale.
//!
//! A step is found by `Steps`: a sample's second difference (how sharply
//! the wave turns) against the sharpest turn in the ten milliseconds before
//! it. Music turns smoothly however loud it is: the album's sharpest turn is
//! a little over twice the one before it. A cut to silence, a callback
//! dropped or one played twice turns at once, eight to sixty times
//! (`the_steps_are_found_where_a_callback_is_lost`).

use crate::engine::{Arm, ArmEnd, Command, Engine, Out, at};
use dlcore::code;
use dlcore::player::{Fades, Kind, Request, Track};

const RATE: f64 = 48_000.0;

/// Held by each test here while it renders, and by the engine's timing
/// test (`every_command_in_a_callback_against_promise_1`), so that minutes
/// of rendering on every core never run beside the timing.
pub static RENDERING: std::sync::Mutex<()> = std::sync::Mutex::new(());

fn alone() -> std::sync::MutexGuard<'static, ()> {
    RENDERING.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

/// The loop that crackled on Mikey's phone with the screen off.
const E9T: &str = "E9T-ZxDxj";

/// The Batch 6 album in the app (`docs/ALBUMS.md`, "Batch 6 in the app"):
/// fifteen tracks of 45 to 97 s, each crossfading into the next.
const BATCH6: &str = "FAPJKOYsYDW0FJ7ZatZAW0HGfJIxZAJ4c7hKCWkMJu7pCOAWsHJKky18BWgJJHbNWxCWwHJXpKi6AWkLJ63vuPBW8HJxTa0wAW4IJTYm7NBWwJJH3VwoDWkGJ8i3bEBW0GGCVXKDBJFzdmMAWwKWgIeSQmF0Y2ggNiBpbiB0aGUgYXBwTr";

/// How much sharper than the window before it a turn must be to be a step.
const STEP: f32 = 4.0;
/// The window, in blocks of `BLOCK` frames: about ten milliseconds.
const BLOCK: usize = 96;
const BLOCKS: usize = 5;
/// The least turn a window is taken to have: so the first sound after
/// silence is held to a turn of 0.008 at once, not to nothing.
const FLOOR: f32 = 0.002;

/// One track: the loop and how long it plays.
#[derive(Clone, Copy)]
struct Planned {
    seed: u32,
    request: Request,
    salt: u32,
    track: Option<(Track, Fades)>,
}

fn loop_of(text: &[u8]) -> Planned {
    let l = code::read_loop(text).expect("a loop's code");
    assert_eq!(l.mutes, 0, "no layer muted");
    Planned { seed: l.seed, request: l.request, salt: l.salt, track: None }
}

fn album_of(text: &str) -> Vec<Planned> {
    let album = code::read_album(text.as_bytes()).expect("an album's code");
    (0..album.count)
        .map(|i| {
            let mut buf = [0u8; 512];
            let n = code::album_track(text.as_bytes(), i, &mut buf).expect("its track");
            let pace = code::album_pace(text.as_bytes(), i).expect("its pace");
            Planned { track: Track::of(pace.kind(), pace.count()), ..loop_of(&buf[..n]) }
        })
        .collect()
}

/// Steps in one channel's samples, as `fill` makes them.
struct Steps {
    last: [f32; 2],
    /// The sharpest turn of each of the last blocks, and of this one.
    blocks: [f32; BLOCKS],
    this: f32,
    n: usize,
    /// Steps found, the sharpest (as a share of its window), and where.
    found: usize,
    /// Where the first few were found, in frames.
    at: Vec<usize>,
    worst: f32,
    worst_at: usize,
    bad: usize,
    over: usize,
}

impl Steps {
    fn new() -> Self {
        Steps { last: [0.0; 2], blocks: [0.0; BLOCKS], this: 0.0, n: 0, found: 0, at: Vec::new(), worst: 0.0, worst_at: 0, bad: 0, over: 0 }
    }

    fn push(&mut self, x: f32) {
        if !x.is_finite() {
            self.bad += 1;
            return;
        }
        if x.abs() > 1.0 {
            self.over += 1;
        }
        let turn = (x - 2.0 * self.last[1] + self.last[0]).abs();
        self.last = [self.last[1], x];
        if self.n >= BLOCK * BLOCKS {
            let window = self.blocks.iter().copied().fold(self.this, f32::max);
            let share = turn / (window + FLOOR);
            if share > self.worst {
                self.worst = share;
                self.worst_at = self.n;
            }
            if share > STEP {
                self.found += 1;
                if self.at.len() < 64 {
                    self.at.push(self.n);
                }
            }
        }
        self.this = self.this.max(turn);
        self.n += 1;
        if self.n.is_multiple_of(BLOCK) {
            self.blocks.copy_within(1.., 0);
            self.blocks[BLOCKS - 1] = self.this;
            self.this = 0.0;
        }
    }
}

/// Both channels' steps, and a hash of the samples of the first `HASHED`
/// frames (renders at different callbacks end at different frames).
struct Heard {
    steps: [Steps; 2],
    hash: u64,
    hashed: usize,
    loops: usize,
}

const HASHED: usize = 140 * 48_000;

impl Heard {
    fn new() -> Self {
        Heard { steps: [Steps::new(), Steps::new()], hash: 0xcbf2_9ce4_8422_2325, hashed: 0, loops: 0 }
    }

    fn hear(&mut self, out: &[f32]) {
        for frame in out.as_chunks::<2>().0 {
            for (s, &x) in self.steps.iter_mut().zip(frame) {
                s.push(x);
                if self.hashed < HASHED {
                    self.hash = (self.hash ^ u64::from(x.to_bits())).wrapping_mul(0x0000_0100_0000_01b3);
                }
            }
            self.hashed += 1;
        }
    }

    fn found(&self) -> usize {
        self.steps.iter().map(|s| s.found).sum()
    }

    fn worst(&self) -> f32 {
        self.steps.iter().map(|s| s.worst).fold(0.0, f32::max)
    }

    /// Nothing that is not a number, nothing past full scale, no step.
    fn clean(&self) -> bool {
        self.steps.iter().all(|s| s.bad == 0 && s.over == 0) && self.found() == 0
    }

    fn says(&self) -> String {
        let [l, r] = &self.steps;
        #[allow(clippy::cast_precision_loss, reason = "frames, far under 2^53")]
        let when = |s: &Steps| s.worst_at as f64 / RATE;
        format!(
            "{} steps; the sharpest {:.2} times its window (left at {:.2} s, right at {:.2} s); {} not numbers, {} past full scale; {} loops",
            self.found(),
            self.worst(),
            when(l),
            when(r),
            l.bad + r.bad,
            l.over + r.over,
            self.loops
        )
    }
}

/// The armed loop that follows track `i`, as the page arms an album's next
/// track (js/player.js's `_arm`: a crossfade of `END_FADE`, a second).
fn arm(plan: &[Planned], i: usize) -> ArmEnd {
    plan.get(i).map_or(ArmEnd::Drop, |t| ArmEnd::Set(Arm { seed: t.seed, request: t.request, fade: 1.0, track: t.track }))
}

/// The app's player starting on the first track, as the page starts it.
fn started(plan: &[Planned], full: bool, callback: usize) -> Box<Engine> {
    let engine = Engine::new(RATE, 2, true).unwrap();
    engine.stream_began(callback as u64);
    let t = &plan[0];
    assert!(engine.send_all(&[
        Command::Init { full, layout: 2 },
        Command::Volume(1.0),
        Command::WanderSalted { amount: 1.0, salt: t.salt },
        Command::LoadAt { seed: t.seed, request: t.request, at: 0.0, resumed: false },
        Command::Track { track: t.track, arm: arm(plan, 1) },
    ]));
    engine
}

/// One callback of `callback` frames, heard; at each new loop the next
/// track armed, as the page does when the album moves on. Returns the
/// core's clock after it.
fn call(engine: &Engine, plan: &[Planned], out: &mut [f32], heard: &mut Heard) -> f64 {
    engine.fill(out, 2);
    let mut loops = 0;
    engine.take(|o, _, _| {
        if let Out::Event { kind, .. } = o
            && kind == Kind::Loop as u8
        {
            loops += 1;
        }
    });
    for _ in 0..loops {
        heard.loops += 1;
        if heard.loops > 1 {
            assert!(engine.send(&Command::Arm(arm(plan, heard.loops))));
        }
    }
    heard.hear(out);
    engine.status.read()[at::TIME]
}

/// `seconds` of `plan` played through the engine, `callback` frames at a time.
fn played(plan: &[Planned], full: bool, callback: usize, seconds: f64) -> Heard {
    let engine = started(plan, full, callback);
    let mut out = vec![0.0f32; callback * 2];
    let mut heard = Heard::new();
    while call(&engine, plan, &mut out, &mut heard) < seconds {}
    heard
}

/// The steps are found where a crackle would be: E9T-ZxDxj, its samples
/// left as they are, has none, and its sharpest turn is under half the
/// line; every 20 s a callback's worth cut to silence, or played twice, is
/// found each time, and one lost (the next played in its place) nearly
/// every time.
#[test]
fn the_steps_are_found_where_a_callback_is_lost() {
    let _alone = alone();
    let plan = [loop_of(E9T.as_bytes())];
    let engine = started(&plan, true, 1024);
    let mut out = vec![0.0f32; 2048];
    let mut heard = [Heard::new(), Heard::new(), Heard::new(), Heard::new()];
    let mut faults: Vec<usize> = Vec::new();
    let mut n = 0;
    let mut last = vec![0.0f32; 2048];
    while n < 120 * 48_000 {
        let mut unheard = Heard::new();
        call(&engine, &plan, &mut out, &mut unheard);
        let fault = n > 48_000 && n % (20 * 48_000) < 1024;
        if fault {
            faults.push(n);
        }
        heard[0].hear(&out);
        if fault {
            heard[1].hear(&[0.0; 2048]);
            heard[3].hear(&last);
        } else {
            heard[1].hear(&out);
            heard[2].hear(&out);
        }
        heard[3].hear(&out);
        last.copy_from_slice(&out);
        n += 1024;
    }
    assert!(heard[0].clean(), "as it is: {}", heard[0].says());
    assert!(heard[0].worst() < STEP / 2.0, "well inside the line: {}", heard[0].says());
    assert_eq!(faults.len(), 5);
    // Where each fault lands in what was heard: a lost callback moves the
    // ones after it a callback earlier, one played twice a callback later.
    let found = |h: &Heard, shift: isize| {
        faults
            .iter()
            .enumerate()
            .filter(|&(i, &f)| {
                let f = f.cast_signed() + shift * isize::try_from(i).unwrap();
                h.steps.iter().any(|s| s.at.iter().any(|&a| (a.cast_signed() - f).abs() <= 2048))
            })
            .count()
    };
    assert_eq!(found(&heard[1], 0), 5, "a callback cut to silence: {}", heard[1].says());
    assert_eq!(found(&heard[3], 1024), 5, "a callback played twice: {}", heard[3].says());
    // A callback lost can join the next smoothly by chance (and is not
    // heard then either): most are found.
    assert!(found(&heard[2], -1024) >= 4, "a callback lost: {}", heard[2].says());
}

/// Step 1: E9T-ZxDxj through the engine at the callbacks a phone asks for
/// (the music path's 1,024, the old fast path's 192, and an odd top-up's),
/// at full and lite: the same samples at every size, and none of them a
/// step, not a number or past full scale.
#[test]
fn the_loop_that_crackled_is_clean_at_every_callback() {
    let _alone = alone();
    let plan = [loop_of(E9T.as_bytes())];
    for full in [true, false] {
        let heard: Vec<Heard> = [1024, 192, 333].into_iter().map(|c| played(&plan, full, c, 150.0)).collect();
        for h in &heard {
            assert!(h.clean(), "full {full}: {}", h.says());
        }
        let hashes: Vec<u64> = heard.iter().map(|h| h.hash).collect();
        assert!(hashes.iter().all(|&x| x == hashes[0]), "full {full}, the first 140 s: {hashes:x?}");
    }
}

/// Step 1: the Batch 6 album through the engine, its fifteen tracks and
/// their crossfades, at full and lite, at the music path's callbacks and
/// at the old fast path's: no step, nothing not a number or past full
/// scale; the same samples at either size.
#[test]
fn the_batch_6_album_is_clean_through_its_track_changes() {
    let _alone = alone();
    let plan = album_of(BATCH6);
    assert_eq!(plan.len(), 15);
    let seconds = 16.0 * 60.0;
    let full = played(&plan, true, 1024, seconds);
    assert!(full.clean(), "full: {}", full.says());
    assert_eq!(full.loops, 15, "every track: {}", full.says());
    let lite = played(&plan, false, 1024, seconds);
    assert!(lite.clean(), "lite: {}", lite.says());
    let small = played(&plan, false, 192, seconds);
    assert!(small.clean(), "lite, 192 frames: {}", small.says());
    assert_eq!(small.hash, lite.hash, "the first 140 s, at 192 frames and at 1,024");
    println!("full: {}\nlite: {}", full.says(), lite.says());
}

/// The page's mix parameters a switch moves (js/core.js's `MIX`) and the
/// calls it makes on them (`SET` and the rest).
const KILL: u32 = 18;
const TAILS: u32 = 6;
const PUMP: u32 = 5;
const LINEAR: u32 = 1;
const CANCEL: u32 = 3;
const HOLD: u32 = 4;

/// How a quality switch goes over, as the page sends it.
#[derive(Clone, Copy, Debug, PartialEq)]
enum Switch {
    /// The listener's switch before it faded (js/main.js's
    /// `buildAudio` at once): the old player let go in the same callback
    /// that the transport's 60 ms silence was asked in, so it never fades.
    AtOnce,
    /// The listener's switch now (`quality.HAND_PREP`, `HAND_FADE`): the
    /// old player fades for a tenth of a second from 0.15 s on, and is let
    /// go once the core has rendered the fade.
    ByHand,
    /// The app's own (`quality.PREP`, `FADE`): half a second's fade.
    ByItself,
}

/// js/output.js's `silence` and `unsilence`, from `now`.
fn kill(now: f64, to: f64, over: f64) -> [Command; 2] {
    [Command::Param { id: KILL, op: HOLD, value: 0.0, time: now, tau: 0.0 }, Command::Param { id: KILL, op: LINEAR, value: to, time: now + over, tau: 0.0 }]
}

/// The old player let go and the new one built at `full`, the loop again
/// from its top (js/main.js's `buildAudio`: `dropAudio`, then `makeAudio`
/// and the engine's `start`).
fn rebuild(t: &Planned, full: bool, now: f64) -> Vec<Command> {
    let mut c = vec![Command::Stop, Command::Cancel(None)];
    c.extend(kill(now, 0.0, 0.06));
    c.extend([Command::Dispose, Command::Init { full, layout: 2 }]);
    c.extend(kill(now, 1.0, 0.02));
    c.extend([
        Command::Volume(1.0),
        Command::WanderSalted { amount: 1.0, salt: t.salt },
        Command::LoadAt { seed: t.seed, request: t.request, at: 0.0, resumed: true },
        Command::Track { track: t.track, arm: ArmEnd::Drop },
    ]);
    c
}

/// E9T-ZxDxj switched at `when` seconds from `full` to the other quality,
/// as `how` goes over, and two seconds after the new player starts: what
/// was heard, and the loudest of its last second (the new player sounds).
fn switched(how: Switch, full: bool, when: f64) -> (Heard, f32) {
    let plan = [loop_of(E9T.as_bytes())];
    let t = plan[0];
    let engine = started(&plan, full, 1024);
    let mut out = vec![0.0f32; 2048];
    let mut heard = Heard::new();
    let mut now = 0.0;
    while now < when {
        now = call(&engine, &plan, &mut out, &mut heard);
    }
    let (prep, fade) = match how {
        Switch::AtOnce => (0.0, 0.0),
        Switch::ByHand => (0.15, 0.1),
        Switch::ByItself => (0.5, 0.5),
    };
    if how != Switch::AtOnce {
        // `quality.handOff`: nothing handed over for the end or after it,
        // and the fade to it.
        let end = now + prep + fade;
        let mut c = vec![
            Command::Cancel(Some(end)),
            Command::Param { id: TAILS, op: CANCEL, value: 0.0, time: end, tau: 0.0 },
            Command::Param { id: PUMP, op: CANCEL, value: 0.0, time: end, tau: 0.0 },
        ];
        c.extend([Command::Param { id: KILL, op: HOLD, value: 0.0, time: end - fade, tau: 0.0 }, Command::Param { id: KILL, op: LINEAR, value: 0.0, time: end, tau: 0.0 }]);
        assert!(engine.send_all(&c));
        // The alarm: once the core has rendered to the end.
        while now < end {
            now = call(&engine, &plan, &mut out, &mut heard);
        }
    }
    assert!(engine.send_all(&rebuild(&t, !full, now)));
    let start = now;
    let mut loudest = 0.0f32;
    while now < start + 3.0 {
        now = call(&engine, &plan, &mut out, &mut heard);
        if now > start + 2.0 {
            loudest = out.iter().fold(loudest, |a, x| a.max(x.abs()));
        }
    }
    (heard, loudest)
}

/// Step 4: Lite switched on and off, by hand and by the app itself, at a
/// dozen points through E9T-ZxDxj (each 1.37 s on from the last, so they
/// fall anywhere in its bars): no step in the samples either way, and the
/// new player sounds. The switch as the listener's was made before step 4,
/// the old player let go at once, steps at nearly every point: the test
/// holds that too, so it can't pass by finding nothing.
#[test]
fn a_switch_by_hand_or_by_itself_goes_over_without_a_step() {
    let _alone = alone();
    let points: Vec<f64> = (0..12).map(|k| 8.0 + 1.37 * f64::from(k)).collect();
    let mut cut = 0;
    for (i, &when) in points.iter().enumerate() {
        let full = i % 2 == 0;
        for how in [Switch::ByHand, Switch::ByItself] {
            let (heard, loudest) = switched(how, full, when);
            assert!(heard.clean(), "{how:?} from {} at {when:.2} s: {}", if full { "full" } else { "lite" }, heard.says());
            assert!(loudest > 0.05, "{how:?} at {when:.2} s: the new player sounds ({loudest})");
        }
        let (heard, _) = switched(Switch::AtOnce, full, when);
        cut += usize::from(heard.found() > 0);
    }
    println!("at once: a step at {cut} of {} points", points.len());
    assert!(cut >= points.len() * 3 / 4, "at once, a step at {cut} of {} points", points.len());
}
