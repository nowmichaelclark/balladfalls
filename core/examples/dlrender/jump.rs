//! Jumps within a piece: `dlrender --jumps`.
//! Each loop is a 32,768-bar piece at the full mix, heard from the phrase
//! line `--at` seconds in, played from its load and jumped to:
//!
//! - **the jump as the app makes it**: played three seconds, then
//!   `Player::jump` to the line: how soon it is heard, and its busiest block
//!   (the player's stage and the core's block) against a block's deadline,
//!   beside the loop's own busiest;
//! - **the jump on a core in step**: the same, on a core started so that the
//!   line falls within a block of playing's on the core's clock. The master's
//!   wobble and flutter and the organ's shimmer run from the core's start, not
//!   the loop's (as across any loop): playing the same loop on a core started
//!   10 s later already differs from it by -6 dB. In step, what is left is
//!   the jump's own: from `--settle` seconds after the line (the jump's fade
//!   and the room's tail passed) for `--length` seconds, the difference's
//!   level under playing's, and the largest gap between the two's levels over
//!   400 ms windows;
//! - **from another place**: the same jump asked from halfway to the line,
//!   on a core in step: what a jump plays depends only on where it lands,
//!   the same samples wherever it came from (but for the organ's pipes,
//!   which run free from its start: their phases are its history).
//!
//! What a jump cannot know without playing everything before it is said in
//! the PR: notes struck before the line, which it lets go (a
//! long chord, a held bass), twang's strings' and the organ's pipes' phases.
//! It fails past `JUMP_HOLDS`' figures.

// Frame counts and rates here are bounded by the render's own length.
#![allow(clippy::cast_possible_truncation, clippy::cast_sign_loss, clippy::cast_precision_loss)]

use std::time::Instant;

use dlcore::Core;
use dlcore::QUANTUM;
use dlcore::player::{Jump, Kind, Player, Request};

/// How the jumps are made and measured.
pub struct Way {
    pub seeds: Vec<u32>,
    pub request: String,
    pub rate: f64,
    pub at: f64,
    pub settle: f64,
    pub length: f64,
}

/// The options of `--jumps`: where the line is, and how long after it it is
/// heard, in seconds.
pub struct Options {
    pub on: bool,
    pub at: f64,
    pub settle: f64,
    pub length: f64,
}

impl Default for Options {
    fn default() -> Self {
        Options { on: false, at: 240.0, settle: 8.0, length: 20.0 }
    }
}

impl Options {
    /// Take `arg` (and its value) if it is one of `--jumps`' options.
    pub fn take(&mut self, arg: &str, args: &mut impl Iterator<Item = String>) -> Result<bool, String> {
        let mut seconds = || args.next().ok_or_else(|| format!("{arg} needs seconds"))?.parse::<f64>().map_err(|_| format!("{arg}: seconds"));
        match arg {
            "--jumps" => self.on = true,
            "--at" => self.at = seconds()?,
            "--settle" => self.settle = seconds()?,
            "--length" => self.length = seconds()?,
            _ => return Ok(false),
        }
        Ok(true)
    }
}

/// The ears' corpus loops (corpus seed 20261009) that draw what batch 6 gave
/// time and memory (`core/tests/jump.rs` says which draws which).
pub const LOOPS: [u32; 6] = [176_315_227, 550_269_749, 2_679_763_182, 431_335_035, 694_704_631, 3_372_926_893];

/// What a jump on a core in step is held to against playing: the difference
/// under playing's level, the largest level gap over 400 ms windows, and the
/// difference between the jump from two places, each in dB.
const JUMP_HOLDS: [f64; 3] = [-12.0, 2.0, -80.0];

fn rms(x: &[f32]) -> f64 {
    if x.is_empty() {
        return 0.0;
    }
    (x.iter().map(|&s| f64::from(s) * f64::from(s)).sum::<f64>() / x.len() as f64).sqrt()
}

fn db(x: f64) -> f64 {
    if x > 0.0 { 20.0 * x.log10() } else { -300.0 }
}

/// A render from the line on: its samples from `settle` for `length`
/// seconds; the busiest block from the jump asked to the line (0 where none
/// was asked) and of the loop's own playing before; how long after it was
/// asked the jump was heard; and the line's time on the core's clock.
struct Heard {
    samples: Vec<f32>,
    jump_worst: f64,
    own_worst: f64,
    landed: f64,
    line: f64,
}

/// Play `seed` as `way` asks after `silence` seconds of the core alone; with
/// `jump` (a bar, and seconds after the load), jump there; keep what is heard
/// from the line (step `target` from the load) on.
fn render(seed: u32, way: &Way, silence: f64, jump: Option<(f64, f64)>, target: u64) -> Result<Heard, String> {
    let request = Request::parse(&way.request).map_err(|e| format!("--request: {e}"))?;
    let mut core = Box::new(Core::new());
    let mut player = Box::new(Player::new());
    player.start(&mut core, way.rate, 1, true).map_err(|e| format!("{e:?}"))?;
    let mut block = [0.0f32; QUANTUM];
    let dt = QUANTUM as f64 / way.rate;
    let step = |core: &mut Core, player: &mut Player, block: &mut [f32; QUANTUM]| -> f64 {
        let t0 = Instant::now();
        player.render(core, &mut [&mut block[..]]).expect("a render");
        t0.elapsed().as_secs_f64()
    };
    let mut blocks = 0.0;
    while blocks * dt < silence {
        step(&mut core, &mut player, &mut block);
        blocks += 1.0;
    }
    player.load(seed, &request);
    let start = blocks * dt;
    let mut now = start;
    let mut out = Vec::new();
    let (mut from, mut asked, mut own_worst, mut jump_worst, mut landed) = (None::<f64>, None::<f64>, 0.0f64, 0.0f64, f64::NAN);
    let keep = |from: f64| from + way.settle + way.length;
    loop {
        let took = step(&mut core, &mut player, &mut block);
        let here = now;
        now += dt;
        if asked.is_some() && from.is_none() {
            jump_worst = jump_worst.max(took);
        } else if asked.is_none() && here > start + 0.5 {
            own_worst = own_worst.max(took);
        }
        while let Some(e) = player.event() {
            let at_line = match e.kind {
                Kind::Jump => true,
                Kind::Step => jump.is_none() && e.step == target,
                _ => false,
            };
            if at_line && from.is_none() {
                from = Some(e.time);
                if let Some(a) = asked {
                    landed = e.time - a;
                }
            }
        }
        if let Some(f) = from {
            for (i, &s) in block.iter().enumerate() {
                let time = here + i as f64 / way.rate;
                if time >= f + way.settle && time < keep(f) {
                    out.push(s);
                }
            }
            if now >= keep(f) {
                break;
            }
        }
        if let Some((bar, after)) = jump
            && asked.is_none()
            && now >= start + after
        {
            if !player.jump(Jump::Bar(bar)) {
                return Err(format!("seed {seed}: the jump was refused"));
            }
            asked = Some(now);
        }
        if now > start + way.at + way.settle + way.length + 60.0 {
            return Err(format!("seed {seed}: never reached step {target}"));
        }
    }
    Ok(Heard { samples: out, jump_worst, own_worst, landed, line: from.unwrap_or(f64::NAN) })
}

/// The difference of `b` from `a`, in dB under `a`, and the largest gap
/// between their levels over 400 ms windows (where `a` is not near silent).
fn against(a: &[f32], b: &[f32], rate: f64) -> (f64, f64) {
    let n = a.len().min(b.len());
    let diff: Vec<f32> = a[..n].iter().zip(&b[..n]).map(|(x, y)| x - y).collect();
    let residual = db(rms(&diff)) - db(rms(&a[..n]));
    let w = (0.4 * rate) as usize;
    let mut gap = 0.0f64;
    for (x, y) in a[..n].chunks(w).zip(b[..n].chunks(w)) {
        let (lx, ly) = (db(rms(x)), db(rms(y)));
        if lx > -60.0 {
            gap = gap.max((lx - ly).abs());
        }
    }
    (residual, gap)
}

/// The jump to `bar` asked `after` seconds in, on a core whose line falls
/// within a block of `line` (playing's) on the core's clock.
fn in_step(seed: u32, way: &Way, (bar, after): (f64, f64), target: u64, line: f64) -> Result<Heard, String> {
    let probe = render(seed, way, 0.0, Some((bar, after)), target)?;
    let blocks = ((line - probe.line) * way.rate / QUANTUM as f64).floor().max(0.0);
    render(seed, way, blocks * QUANTUM as f64 / way.rate, Some((bar, after)), target)
}

/// `--jumps`: the loops given (`--seed`), else `LOOPS`, as the request asks
/// (else a 32,768-bar piece), at `rate` (else 44.1 kHz).
pub fn from_options(o: &Options, seeds: Vec<u32>, request: Option<String>, rate: Option<f64>) -> Result<(), String> {
    let seeds = if seeds.is_empty() { LOOPS.to_vec() } else { seeds };
    let request = request.unwrap_or_else(|| "bars=32768".to_string());
    run(&Way { seeds, request, rate: rate.unwrap_or(44_100.0), at: o.at, settle: o.settle, length: o.length })
}

pub fn run(way: &Way) -> Result<(), String> {
    // A core and a player are megabytes each, built on the stack before
    // they are boxed: a thread with room for them.
    let stack = (std::mem::size_of::<Core>() + std::mem::size_of::<Player>()) * 8 + (16 << 20);
    std::thread::scope(|scope| std::thread::Builder::new().stack_size(stack).spawn_scoped(scope, || measure(way)).map_err(|e| e.to_string())?.join().map_err(|_| "a jump's thread failed".to_string())?)
}

fn measure(way: &Way) -> Result<(), String> {
    let deadline = QUANTUM as f64 / way.rate;
    let mut worst = [-300.0f64, 0.0, -300.0, 0.0, 0.0];
    let mut fails = 0;
    for &seed in &way.seeds {
        // The phrase line `at` seconds in, as the jump reaches it.
        let (target, bar, organ) = {
            let mut core = Box::new(Core::new());
            let mut player = Box::new(Player::new());
            player.start(&mut core, way.rate, 1, true).map_err(|e| format!("{e:?}"))?;
            player.load(seed, &Request::parse(&way.request).map_err(|e| format!("--request: {e}"))?);
            player.ready(&mut *core);
            let spec = player.generator().spec();
            let sd = 60.0 / spec.bpm / 4.0;
            let target = dlcore::player::track::phrase_before(spec, (way.at / sd) as u64);
            (target, target as f64 / spec.steps_per_bar, player.generator().settings().organ.is_some())
        };
        let played = render(seed, way, 0.0, None, target)?;
        let app = render(seed, way, 0.0, Some((bar, 3.0)), target)?;
        let near = in_step(seed, way, (bar, 3.0), target, played.line)?;
        let far = in_step(seed, way, (bar, way.at / 2.0), target, played.line)?;
        let (residual, gap) = against(&played.samples, &near.samples, way.rate);
        let (origin, _) = against(&near.samples, &far.samples, way.rate);
        let cost = app.jump_worst / deadline;
        println!(
            "seed {seed}: step {target} (bar {bar}), heard {:.3} s after asked, busiest jump block {:.1}% of a block (the loop's own {:.1}%); from {:.0} s for {:.0} s on a core in step: {residual:.1} dB under played, levels within {gap:.2} dB; from another place {origin:.1} dB",
            app.landed,
            100.0 * cost,
            100.0 * played.own_worst / deadline,
            way.settle,
            way.length,
        );
        // The organ's pipes run free from its start, a chord's pitch moving
        // them on: their phases are its whole history, which no jump walks,
        // so they stand where the place it left had them.
        if residual > JUMP_HOLDS[0] || gap > JUMP_HOLDS[1] || (origin > JUMP_HOLDS[2] && !organ) || app.landed.is_nan() || app.landed >= 1.0 {
            fails += 1;
        }
        worst = [worst[0].max(residual), worst[1].max(gap), worst[2].max(origin), worst[3].max(cost), worst[4].max(app.landed)];
    }
    println!(
        "jumps: {} loops; worst: {:.1} dB under played, levels within {:.2} dB, from another place {:.1} dB, heard {:.3} s after asked, busiest jump block {:.1}% of a block",
        way.seeds.len(),
        worst[0],
        worst[1],
        worst[2],
        worst[4],
        100.0 * worst[3]
    );
    if fails > 0 {
        return Err(format!("{fails} jumps past the figures it holds to ({JUMP_HOLDS:?} dB), or heard a second or more after asked"));
    }
    Ok(())
}
