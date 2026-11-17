//! Jumps within a piece (session 17, queue item 106a): `dlrender --jumps`.
//! Each loop is played three ways, as 32,768-bar pieces, at the full mix,
//! and heard from a phrase line `--at` seconds in:
//!
//! - **played**: from its load, on a core started with it;
//! - **played late**: the same, on a core that had rendered three seconds of
//!   silence first (the control: the same music, the core's own clock
//!   elsewhere, so the master's wobble and flutter swing at another phase;
//!   they run from the core's start, not the loop's, as across any loop);
//! - **jumped**: played three seconds, then `Player::jump` to the line.
//!
//! From `--settle` seconds after the line (the jump's fade and the room's
//! tail passed) for `--length` seconds, each against **played**: the
//! difference's level under the signal, in dB, and the largest gap between
//! the two's levels over 400 ms windows. The jump holds if it differs from
//! playing no more than the control does. And the jump's cost: its busiest
//! block (the player's stage and the core's block) as a share of a block's
//! deadline, beside the loop's own busiest. A line a loop, and the worst.

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

/// The ears' corpus loops (corpus seed 20261009) that draw what batch 6 gave
/// time and memory (`core/tests/jump.rs` says which draws which).
pub const LOOPS: [u32; 6] = [176_315_227, 550_269_749, 2_679_763_182, 431_335_035, 694_704_631, 3_372_926_893];

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
/// seconds, and the busiest block from the jump asked to the line (0 where
/// none was asked) and of the loop's own playing before.
struct Heard {
    samples: Vec<f32>,
    jump_worst: f64,
    own_worst: f64,
    landed: f64,
}

/// Play `seed` as `way` asks, after `silence` seconds of the core alone; with
/// `jump`, three seconds in, jump to `target` (a step from the load). Keep
/// what is heard from `target` on.
fn render(seed: u32, way: &Way, silence: f64, jump: Option<f64>, target: u64) -> Result<Heard, String> {
    let request = Request::parse(&way.request).map_err(|e| format!("--request: {e}"))?;
    let mut core = Box::new(Core::new());
    let mut player = Box::new(Player::new());
    player.start(&mut core, way.rate, 1, true).map_err(|e| format!("{e:?}"))?;
    let mut block = [0.0f32; QUANTUM];
    let mut t = 0.0;
    let step = |core: &mut Core, player: &mut Player, block: &mut [f32; QUANTUM]| -> f64 {
        let t0 = Instant::now();
        player.render(core, &mut [&mut block[..]]).expect("a render");
        t0.elapsed().as_secs_f64()
    };
    while t < silence {
        step(&mut core, &mut player, &mut block);
        t += QUANTUM as f64 / way.rate;
    }
    if let Some(solo) = std::env::var("DL_JUMP_SOLO").ok().and_then(|s| s.parse::<usize>().ok()) {
        for (i, &l) in dlcore::generator::LAYERS.iter().enumerate() {
            player.set_mute(&mut *core, l, i != solo);
        }
    }
    player.load(seed, &request);
    let mut out = Vec::new();
    let (mut from, mut asked, mut own_worst, mut jump_worst, mut landed) = (None::<f64>, None::<f64>, 0.0f64, 0.0f64, f64::NAN);
    let start = t;
    let keep = |from: f64| from + way.settle + way.length;
    loop {
        let took = step(&mut core, &mut player, &mut block);
        let now = t;
        t += QUANTUM as f64 / way.rate;
        if asked.is_some() && from.is_none() {
            jump_worst = jump_worst.max(took);
        } else if asked.is_none() && now > start + 0.5 {
            own_worst = own_worst.max(took);
        }
        while let Some(e) = player.event() {
            let at_line = match e.kind {
                Kind::Jump => true,
                Kind::Step => jump.is_none() && e.step == target,
                _ => false,
            };
            if at_line && from.is_none() {
                if std::env::var("DL_JUMP_DEBUG").is_ok() {
                    eprintln!("line at {:.9} s, frame {:.6}", e.time - start, e.time * way.rate);
                }
                from = Some(e.time);
                if let Some(a) = asked {
                    landed = e.time - a;
                }
            }
        }
        if let Some(f) = from {
            // The block's samples at or after the line's time, from the line.
            for (i, &s) in block.iter().enumerate() {
                let time = now + i as f64 / way.rate;
                if time >= f + way.settle && time < keep(f) {
                    out.push(s);
                }
            }
            if t >= keep(f) {
                break;
            }
        }
        if let Some(bar) = jump
            && asked.is_none()
            && t >= start + 3.0
        {
            if !player.jump(Jump::Bar(bar)) {
                return Err(format!("seed {seed}: the jump was refused"));
            }
            asked = Some(t);
        }
        if t > start + way.at + way.settle + way.length + 60.0 {
            return Err(format!("seed {seed}: never reached step {target}"));
        }
    }
    Ok(Heard { samples: out, jump_worst, own_worst, landed })
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

pub fn run(way: &Way) -> Result<(), String> {
    // A core and a player are megabytes each, built on the stack before
    // they are boxed: a thread with room for them.
    let stack = (std::mem::size_of::<Core>() + std::mem::size_of::<Player>()) * 8 + (16 << 20);
    std::thread::scope(|scope| std::thread::Builder::new().stack_size(stack).spawn_scoped(scope, || measure(way)).map_err(|e| e.to_string())?.join().map_err(|_| "a jump's thread failed".to_string())?)
}

fn measure(way: &Way) -> Result<(), String> {
    let deadline = QUANTUM as f64 / way.rate;
    let (mut worst_jump, mut worst_ctl, mut worst_gap, mut worst_cost, mut worst_heard) = (-300.0f64, -300.0f64, 0.0f64, 0.0f64, 0.0f64);
    let mut fails = 0;
    for &seed in &way.seeds {
        // The phrase line `at` seconds in, as the jump reaches it.
        let (target, bar) = {
            let mut core = Box::new(Core::new());
            let mut player = Box::new(Player::new());
            player.start(&mut core, way.rate, 1, true).map_err(|e| format!("{e:?}"))?;
            player.load(seed, &Request::parse(&way.request).map_err(|e| format!("--request: {e}"))?);
            player.ready(&mut *core);
            let spec = player.generator().spec();
            let sd = 60.0 / spec.bpm / 4.0;
            let target = dlcore::player::track::phrase_before(spec, (way.at / sd) as u64);
            (target, target as f64 / spec.steps_per_bar)
        };
        let played = render(seed, way, 0.0, None, target)?;
        let late = render(seed, way, std::env::var("DL_JUMP_LATE").ok().and_then(|s| s.parse().ok()).unwrap_or(3.0), None, target)?;
        let jumped = render(seed, way, 0.0, Some(bar), target)?;
        let (r_jump, g_jump) = against(&played.samples, &jumped.samples, way.rate);
        if std::env::var("DL_JUMP_DEBUG").is_ok() {
            let w = (0.4 * way.rate) as usize;
            for ((a, b), c) in played.samples.chunks(w).zip(jumped.samples.chunks(w)).zip(late.samples.chunks(w)) {
                eprint!("[{:.1} {:.1} {:.1}] ", db(rms(a)), db(rms(b)), db(rms(c)));
            }
            eprintln!();
        }
        let (r_ctl, g_ctl) = against(&played.samples, &late.samples, way.rate);
        let cost = jumped.jump_worst / deadline;
        println!(
            "seed {seed}: step {target} (bar {bar}), heard {:.3} s after asked; from {:.0} s for {:.0} s: jumped {r_jump:.1} dB under played, level gap {g_jump:.2} dB; control {r_ctl:.1} dB, {g_ctl:.2} dB; busiest jump block {:.1}% of a block (the loop's own {:.1}%)",
            jumped.landed,
            way.settle,
            way.length,
            100.0 * cost,
            100.0 * played.own_worst / deadline
        );
        // The jump may differ from playing by a little more than the
        // control (the master's state, the room's own, differ too).
        if r_jump > r_ctl + 3.0 || g_jump > g_ctl + 0.5 {
            fails += 1;
        }
        worst_jump = worst_jump.max(r_jump);
        worst_ctl = worst_ctl.max(r_ctl);
        worst_gap = worst_gap.max(g_jump);
        worst_cost = worst_cost.max(cost);
        worst_heard = worst_heard.max(jumped.landed);
    }
    println!(
        "jumps: {} loops; worst: jumped {worst_jump:.1} dB under played (control {worst_ctl:.1} dB), level gap {worst_gap:.2} dB, heard {worst_heard:.3} s after asked, busiest jump block {:.1}% of a block",
        way.seeds.len(),
        100.0 * worst_cost
    );
    if fails > 0 {
        return Err(format!("{fails} jumps differ from playing more than the control does"));
    }
    Ok(())
}
