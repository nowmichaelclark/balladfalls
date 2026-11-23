//! Driftloom's core on Android's own audio (queue item 107b): the library
//! the app loads (`libdriftloom.so`), one for each ABI, built from the same
//! source as the web's module (`core/`, a path dependency: the core stays
//! `no_std` with no dependencies, and everything Android needs is here).
//!
//! - `engine`: the core and its player, the lock-free queue the app's
//!   commands come by, and the audio thread's `fill`.
//! - `aaudio`: the `AAudio` stream that calls `fill` (Android only; elsewhere
//!   a stand-in says there is no device, so the tests run on any machine).
//! - `bridge`: the page's side (session 27): the worklet's messages from
//!   `js/core.js` as the engine's commands, and the engine's reports back
//!   as the worklet's messages, with `json`, the little reader they need.
//! - `watch`: what a phone can say about a crackle (session 30g).
//! - `jni`: the five JVM calls the bridge below makes.
//!
//! The bridge is `app.loops.NativeCore` (Kotlin), a function each:
//! start and stop the stream, load a seed with a request, play, pause,
//! next, volume, the counts, and an offline render through the same path
//! that the tests hold to the web's hash (session 26's, for the debug
//! screen and the tests); and the page's three (session 27): `send` a
//! message from the page, `drain` what is due back to it, and `pageGone`
//! when it goes.

mod bridge;
mod engine;
mod json;
mod jni;
mod ring;
#[cfg_attr(not(target_os = "android"), allow(dead_code, reason = "the playhead is the stream's"))]
mod watch;

#[cfg(target_os = "android")]
mod aaudio;
#[cfg(target_os = "android")]
use aaudio as output;

/// No device here: the stand-in that lets the crate build and test on a
/// computer.
#[cfg(not(target_os = "android"))]
mod output {
    use crate::engine::Engine;

    #[derive(Clone, Copy, Default)]
    pub struct Info {
        pub rate: i32,
        pub channels: i32,
        pub burst: i32,
        pub buffer: i32,
        pub capacity: i32,
        pub performance: i32,
        pub sharing: i32,
        pub callback: i32,
    }

    pub struct Stream {
        pub running: bool,
        pub underruns: i64,
        pub reopens: u32,
        pub info: Info,
        pub policy: i32,
        pub priority: i32,
        pub latency: f64,
        pub behind: u32,
        pub behind_lost: f64,
        pub behind_ago: f64,
    }

    pub fn engine() -> Option<&'static Engine> {
        None
    }
    pub fn start(_full: bool) -> Result<(), String> {
        Err("no audio device on this machine".into())
    }
    pub fn stop() {}
    pub fn reopen() -> Result<(), String> {
        Err("no audio device on this machine".into())
    }
    pub fn stream() -> Stream {
        Stream { running: false, underruns: 0, reopens: 0, info: Info::default(), policy: -1, priority: -1, latency: 0.0, behind: 0, behind_lost: 0.0, behind_ago: 0.0 }
    }
}

use std::ptr;
use std::sync::atomic::Ordering;
use std::sync::{Mutex, PoisonError};
use std::time::Instant;

use dlcore::player::Request;

use crate::bridge::{Bridge, Figures};
use crate::engine::{Command, Engine, render_line, render_of};
use crate::jni::{Boolean, Double, Env, Int, Long, Object};

/// The counts' order in `NativeCore.counts()`'s array; `NativeCore.kt`
/// reads them by these places.
pub const COUNTS: [&str; 26] = [
    "late",
    "missed",
    "dropped",
    "underruns",
    "callbacks",
    "frames",
    "busiestMs",
    "busiestShare",
    "meanShare",
    "rate",
    "burst",
    "buffer",
    "capacity",
    "channels",
    "performance",
    "sharing",
    "policy",
    "priority",
    "reopens",
    "state",
    "seed",
    "running",
    "busiestFrames",
    "refused",
    "collisions",
    "engine",
];

/// Every figure the debug screen and the tests read, in `COUNTS`'s order.
fn counts() -> [f64; COUNTS.len()] {
    let s = output::stream();
    let mut out = [0.0; COUNTS.len()];
    #[allow(clippy::cast_precision_loss, reason = "counts far under 2^53")]
    if let Some(e) = output::engine() {
        let c = &e.counts;
        let load = |a: &std::sync::atomic::AtomicU64| a.load(Ordering::Relaxed) as f64;
        let deadline = load(&c.deadline_ns);
        out[0] = f64::from(c.late.load(Ordering::Relaxed));
        out[1] = f64::from(c.missed.load(Ordering::Relaxed));
        out[2] = f64::from(c.dropped.load(Ordering::Relaxed));
        out[4] = load(&c.callbacks);
        out[5] = load(&c.frames);
        out[6] = load(&c.busiest_ns) / 1e6;
        out[7] = load(&c.busiest_ppm) / 1e6;
        out[8] = if deadline > 0.0 { load(&c.spent_ns) / deadline } else { 0.0 };
        out[19] = f64::from(c.state.load(Ordering::Relaxed));
        out[20] = f64::from(c.seed.load(Ordering::Relaxed));
        out[22] = load(&c.busiest_frames);
        out[23] = f64::from(c.refused.load(Ordering::Relaxed));
        out[24] = f64::from(c.collisions.load(Ordering::Relaxed));
        out[25] = 1.0;
    }
    #[allow(clippy::cast_precision_loss, reason = "counts far under 2^53")]
    {
        out[3] = s.underruns as f64;
    }
    out[9] = f64::from(s.info.rate);
    out[10] = f64::from(s.info.burst);
    out[11] = f64::from(s.info.buffer);
    out[12] = f64::from(s.info.capacity);
    out[13] = f64::from(s.info.channels);
    out[14] = f64::from(s.info.performance);
    out[15] = f64::from(s.info.sharing);
    out[16] = f64::from(s.policy);
    out[17] = f64::from(s.priority);
    out[18] = f64::from(s.reopens);
    out[21] = if s.running { 1.0 } else { 0.0 };
    out
}

/// A command to the engine, if a stream has made one.
fn send(command: &Command) -> Boolean {
    Boolean::from(output::engine().is_some_and(|e| e.send(command)))
}

/// A seed as Kotlin passes it (a `Long`, since seeds use all 32 bits).
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss, reason = "a seed is the low 32 bits")]
fn seed_of(seed: Long) -> u32 {
    seed as u32
}

/// `null` for done, else why not, as a Java string.
///
/// # Safety
///
/// `env` is the call's own.
unsafe fn result(env: Env, r: Result<(), String>) -> Object {
    match r {
        Ok(()) => ptr::null_mut(),
        // SAFETY: the call's env.
        Err(why) => unsafe { jni::new_string(env, &why) },
    }
}

/// `NativeCore.start(full)`: open and start the stream (the engine at the
/// first start, at the device's rate: the full mix, or lite's). Null, or
/// why not.
///
/// # Safety
///
/// The JVM's call, with its own `env` (and a string or null).
#[unsafe(no_mangle)]
pub unsafe extern "system" fn Java_app_loops_NativeCore_start(env: Env, _class: Object, full: Boolean) -> Object {
    // SAFETY: the call's env.
    unsafe { result(env, output::start(full != 0)) }
}

/// `NativeCore.stop()`: stop and close the stream; the engine is kept.
#[unsafe(no_mangle)]
pub extern "system" fn Java_app_loops_NativeCore_stop(_env: Env, _class: Object) {
    output::stop();
}

/// `NativeCore.reopen()`: close the stream and open another, as a device
/// change does. Null, or why not.
///
/// # Safety
///
/// The JVM's call, with its own `env` (and a string or null).
#[unsafe(no_mangle)]
pub unsafe extern "system" fn Java_app_loops_NativeCore_reopen(env: Env, _class: Object) -> Object {
    // SAFETY: the call's env.
    unsafe { result(env, output::reopen()) }
}

/// `NativeCore.load(seed, request)`: a loop from its seed with a request as
/// text (`Request::parse`: "peaceful,bpm=70-85"), parsed here on the app's
/// thread and queued. Null, or the core's refusal in its own words.
///
/// # Safety
///
/// The JVM's call, with its own `env` (and a string or null).
#[unsafe(no_mangle)]
pub unsafe extern "system" fn Java_app_loops_NativeCore_load(env: Env, _class: Object, seed: Long, request: Object) -> Object {
    // SAFETY: the call's env and its string.
    let text = unsafe { jni::string(env, request) }.unwrap_or_default();
    let r = match Request::parse(&text) {
        Err(why) => Err(why.to_owned()),
        Ok(request) => match output::engine() {
            None => Err("start the stream first".to_owned()),
            Some(e) => {
                if e.send(&Command::Load { seed: seed_of(seed), request }) {
                    Ok(())
                } else {
                    Err("the command queue is full".to_owned())
                }
            }
        },
    };
    // SAFETY: the call's env.
    unsafe { result(env, r) }
}

/// `NativeCore.play()`: go on after a pause. True if it was queued.
#[unsafe(no_mangle)]
pub extern "system" fn Java_app_loops_NativeCore_play(_env: Env, _class: Object) -> Boolean {
    send(&Command::Play)
}

/// `NativeCore.pause()`: stop deciding steps; what was played rings out.
#[unsafe(no_mangle)]
pub extern "system" fn Java_app_loops_NativeCore_pause(_env: Env, _class: Object) -> Boolean {
    send(&Command::Pause)
}

/// `NativeCore.next()`: a loop of the core's own, crossfading in.
#[unsafe(no_mangle)]
pub extern "system" fn Java_app_loops_NativeCore_next(_env: Env, _class: Object) -> Boolean {
    send(&Command::Next)
}

/// `NativeCore.volume(v)`: the listener's volume, 0 to 1.
#[unsafe(no_mangle)]
pub extern "system" fn Java_app_loops_NativeCore_volume(_env: Env, _class: Object, volume: Double) -> Boolean {
    send(&Command::Volume(volume))
}

/// `NativeCore.draws(seed)`: the seed the core draws its own loops from
/// (Next needs one; the app gives a new one each start, as the page does).
#[unsafe(no_mangle)]
pub extern "system" fn Java_app_loops_NativeCore_draws(_env: Env, _class: Object, seed: Long) -> Boolean {
    send(&Command::Draws(seed_of(seed)))
}

/// `NativeCore.resetBusiest()`: forget the busiest callback so far.
#[unsafe(no_mangle)]
pub extern "system" fn Java_app_loops_NativeCore_resetBusiest(_env: Env, _class: Object) -> Boolean {
    send(&Command::ResetBusiest)
}

/// `NativeCore.counts()`: the figures, in `COUNTS`'s order.
///
/// # Safety
///
/// The JVM's call, with its own `env` (and a string or null).
#[unsafe(no_mangle)]
pub unsafe extern "system" fn Java_app_loops_NativeCore_counts(env: Env, _class: Object) -> Object {
    // SAFETY: the call's env.
    unsafe { jni::new_doubles(env, &counts()) }
}

/// `NativeCore.name()`: the name of the loop heard last ("" before one).
///
/// # Safety
///
/// The JVM's call, with its own `env` (and a string or null).
#[unsafe(no_mangle)]
pub unsafe extern "system" fn Java_app_loops_NativeCore_name(env: Env, _class: Object) -> Object {
    let name = output::engine().map(Engine::name).unwrap_or_default();
    // SAFETY: the call's env.
    unsafe { jni::new_string(env, &name) }
}

/// `NativeCore.renderLine(line, chunk)`: the loop a hash line names
/// (`dlrender --seed`'s, as `core/golden/seeds.hashes` keeps them and
/// `tools/player-wasm.mjs` prints them), rendered again offline through the
/// engine's own path, `chunk` frames a callback, and its line. "error: ..."
/// if it can't be.
///
/// # Safety
///
/// The JVM's call, with its own `env` (and a string or null).
#[unsafe(no_mangle)]
pub unsafe extern "system" fn Java_app_loops_NativeCore_renderLine(env: Env, _class: Object, line: Object, chunk: Int) -> Object {
    // SAFETY: the call's env and its string.
    let line = unsafe { jni::string(env, line) }.unwrap_or_default();
    let chunk = usize::try_from(chunk).unwrap_or(1).max(1);
    let out = match render_of(&line, chunk) {
        None => "error: not a hash line".to_owned(),
        Some(r) => render_line(&r).unwrap_or_else(|why| format!("error: {why}")),
    };
    // SAFETY: the call's env.
    unsafe { jni::new_string(env, &out) }
}

/// The page's side of the bridge (session 27): its refusals and what waits
/// to be posted to it. Only the app's bridge thread calls in, one call at a
/// time; the mutex is never the audio thread's.
static BRIDGE: Mutex<Bridge> = Mutex::new(Bridge::new());

/// The stream's figures, for the page's `native` message.
fn figures(e: &Engine) -> Figures {
    let s = output::stream();
    let c = &e.counts;
    #[allow(clippy::cast_precision_loss, reason = "nanoseconds summed, far under 2^53")]
    let mean = {
        let deadline = c.deadline_ns.load(Ordering::Relaxed) as f64;
        if deadline > 0.0 { c.spent_ns.load(Ordering::Relaxed) as f64 / deadline } else { 0.0 }
    };
    #[allow(clippy::cast_precision_loss, reason = "millionths, far under 2^53")]
    let busiest = c.busiest_ppm.load(Ordering::Relaxed) as f64 / 1e6;
    Figures {
        running: s.running,
        rate: e.rate(),
        underruns: s.underruns,
        burst: s.info.burst,
        buffer: s.info.buffer,
        capacity: s.info.capacity,
        channels: s.info.channels,
        performance: s.info.performance,
        sharing: s.info.sharing,
        policy: s.policy,
        priority: s.priority,
        reopens: s.reopens,
        busiest,
        mean,
        callbacks: c.callbacks.load(Ordering::Relaxed),
        refused: c.refused.load(Ordering::Relaxed),
        lost: c.out_lost.load(Ordering::Relaxed),
        latency: s.latency,
        callback: s.info.callback,
        behind: s.behind,
        behind_lost: s.behind_lost,
        behind_ago: s.behind_ago,
    }
}

/// `NativeCore.send(message)`: a message from the page (`js/native.js`), as
/// the worklet takes it. `init` starts the stream first (the engine too, the
/// first time) and starts the page's player on it. Null, or a batch to post
/// back at once: the `failed` message when the stream can't start, or the
/// text is no message.
///
/// # Safety
///
/// The JVM's call, with its own `env` (and a string or null).
#[unsafe(no_mangle)]
pub unsafe extern "system" fn Java_app_loops_NativeCore_send(env: Env, _class: Object, text: Object) -> Object {
    // SAFETY: the call's env and its string.
    let text = unsafe { jni::string(env, text) }.unwrap_or_default();
    let answer = match bridge::read(&text) {
        Err(why) => Some(bridge::failed(&format!("the page's message: {why}"))),
        Ok(m) => {
            let mut b = BRIDGE.lock().unwrap_or_else(PoisonError::into_inner);
            if m.get("type").str() == Some("init") {
                let (full, layout) = bridge::init_of(&m);
                match output::start(full) {
                    Err(why) => Some(bridge::failed(&why)),
                    Ok(()) => match output::engine() {
                        None => Some(bridge::failed("no engine")),
                        Some(e) => {
                            b.begin();
                            if e.send(&Command::Init { full, layout }) { None } else { Some(bridge::failed("the command queue is full")) }
                        }
                    },
                }
            } else {
                if let Some(e) = output::engine() {
                    b.receive(e, &m);
                }
                None
            }
        }
    };
    match answer {
        None => ptr::null_mut(),
        // SAFETY: the call's env.
        Some(a) => unsafe { jni::new_string(env, &a) },
    }
}

/// `NativeCore.drain()`: what is due to the page now (a JSON array of the
/// worklet's messages and the `native` one), or null. The app's bridge
/// thread calls it every 25 ms.
///
/// # Safety
///
/// The JVM's call, with its own `env`.
#[unsafe(no_mangle)]
pub unsafe extern "system" fn Java_app_loops_NativeCore_drain(env: Env, _class: Object) -> Object {
    let Some(e) = output::engine() else { return ptr::null_mut() };
    let batch = BRIDGE.lock().unwrap_or_else(PoisonError::into_inner).drain(e, &figures(e), Instant::now());
    match batch {
        None => ptr::null_mut(),
        // SAFETY: the call's env.
        Some(text) => unsafe { jni::new_string(env, &text) },
    }
}

/// `NativeCore.pageGone()`: the page went (a reload, a link, the activity
/// closing): its player let go, as a closed tab's worklet is, so a loop
/// doesn't play on under a page that knows nothing of it.
#[unsafe(no_mangle)]
pub extern "system" fn Java_app_loops_NativeCore_pageGone(_env: Env, _class: Object) {
    if let Some(e) = output::engine() {
        e.send(&Command::Dispose);
    }
    BRIDGE.lock().unwrap_or_else(PoisonError::into_inner).begin();
}
