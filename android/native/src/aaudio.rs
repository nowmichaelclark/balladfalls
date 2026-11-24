//! The sound out: an AAudio stream, straight through the NDK's C API
//! (`libaaudio.so`, in every Android from 8.0; the app's floor is 8.1).
//!
//! Why AAudio itself and not Oboe: Oboe is a C++ library over AAudio (and
//! OpenSL ES for Android before 8.1), so the app would build C++ with CMake
//! and carry Oboe's source or Google's prebuilt package; F-Droid builds from
//! source only, so it would be a submodule to vendor, pin and keep building.
//! AAudio needs nothing: it is part of the system, the NDK has its header
//! and stub library, and these few calls are all the app uses. What Oboe adds
//! that matters here (OpenSL ES below 8.1) the app's floor doesn't need, and
//! its other help (reopening on a device change) is the few lines below.
//!
//! The stream: output, 32-bit float, stereo, the device's own rate (the
//! core renders at whatever rate it is given), shared with other apps, and
//! since session 30g (queue item 115) a music player's path: the
//! power-saving performance mode (Android's deep buffer: a mixer that wakes
//! less often, with a far larger buffer) in callbacks of `CALLBACK_FRAMES`.
//! It is what Chrome opens for the page's `latencyHint: 'playback'`
//! (Chromium's `aaudio_stream_wrapper.cc` and `audio_latency.cc`: the same
//! mode, 1,024 frames at 48 kHz), and the site is clean with the screen
//! off on the phone where the low-latency path crackled. Not the mode None:
//! that is a normal mixer in front of the same fast mixer (`AAudio`'s
//! `AudioStreamTrack.cpp`). AAudio's own buffer size is kept, never set
//! smaller. What the system gave (the mode, the buffer, the callback
//! thread's scheduling: no longer `SCHED_FIFO` on this path, which is why
//! the buffer is what protects it) is read back and reported.
//!
//! The data callback calls the engine's `fill` and nothing else. When the
//! device goes (headphones in or out), AAudio calls the error callback with
//! `DISCONNECTED`; a stream can't be closed from its own callbacks, so a
//! short-lived thread closes it and opens another at the same rate, and the
//! engine plays on from where it was (`reopen_after`).

use std::ffi::{CStr, c_char, c_void};
use std::ptr;
use std::sync::atomic::{AtomicBool, AtomicI32, AtomicPtr, AtomicUsize, Ordering};
use std::sync::{Mutex, MutexGuard, OnceLock, PoisonError};
use std::time::Duration;

use crate::engine::Engine;
use crate::watch::Playhead;

#[repr(C)]
struct AAudioStream {
    _opaque: [u8; 0],
}

#[repr(C)]
struct AAudioStreamBuilder {
    _opaque: [u8; 0],
}

type DataCallback = unsafe extern "C" fn(*mut AAudioStream, *mut c_void, *mut c_void, i32) -> i32;
type ErrorCallback = unsafe extern "C" fn(*mut AAudioStream, *mut c_void, i32);

// AAudio's numbers (aaudio/AAudio.h; `abi-check.c` holds them to the NDK's).
const UNSPECIFIED: i32 = 0;
const DIRECTION_OUTPUT: i32 = 0;
const FORMAT_PCM_FLOAT: i32 = 2;
const SHARING_MODE_SHARED: i32 = 1;
const PERFORMANCE_MODE_POWER_SAVING: i32 = 11;
/// The frames each callback makes, as Chrome's for `playback` at 44.1 and
/// 48 kHz: 21 ms at 48 kHz. AAudio calls as often as the buffer has room.
const CALLBACK_FRAMES: i32 = 1024;
const CALLBACK_RESULT_CONTINUE: i32 = 0;
const OK: i32 = 0;
const ERROR_DISCONNECTED: i32 = -899;

// Every call here is in API 26; anything later would need looking up at
// run time, since the app runs from 27.
#[link(name = "aaudio")]
unsafe extern "C" {
    fn AAudio_createStreamBuilder(builder: *mut *mut AAudioStreamBuilder) -> i32;
    fn AAudio_convertResultToText(result: i32) -> *const c_char;
    fn AAudioStreamBuilder_setDirection(builder: *mut AAudioStreamBuilder, direction: i32);
    fn AAudioStreamBuilder_setSharingMode(builder: *mut AAudioStreamBuilder, mode: i32);
    fn AAudioStreamBuilder_setPerformanceMode(builder: *mut AAudioStreamBuilder, mode: i32);
    fn AAudioStreamBuilder_setFramesPerDataCallback(builder: *mut AAudioStreamBuilder, frames: i32);
    fn AAudioStreamBuilder_setFormat(builder: *mut AAudioStreamBuilder, format: i32);
    fn AAudioStreamBuilder_setChannelCount(builder: *mut AAudioStreamBuilder, channels: i32);
    fn AAudioStreamBuilder_setSampleRate(builder: *mut AAudioStreamBuilder, rate: i32);
    fn AAudioStreamBuilder_setDataCallback(builder: *mut AAudioStreamBuilder, callback: DataCallback, user: *mut c_void);
    fn AAudioStreamBuilder_setErrorCallback(builder: *mut AAudioStreamBuilder, callback: ErrorCallback, user: *mut c_void);
    fn AAudioStreamBuilder_openStream(builder: *mut AAudioStreamBuilder, stream: *mut *mut AAudioStream) -> i32;
    fn AAudioStreamBuilder_delete(builder: *mut AAudioStreamBuilder) -> i32;
    fn AAudioStream_requestStart(stream: *mut AAudioStream) -> i32;
    fn AAudioStream_requestStop(stream: *mut AAudioStream) -> i32;
    fn AAudioStream_close(stream: *mut AAudioStream) -> i32;
    fn AAudioStream_getSampleRate(stream: *mut AAudioStream) -> i32;
    fn AAudioStream_getChannelCount(stream: *mut AAudioStream) -> i32;
    fn AAudioStream_getFormat(stream: *mut AAudioStream) -> i32;
    fn AAudioStream_getFramesPerBurst(stream: *mut AAudioStream) -> i32;
    fn AAudioStream_getBufferSizeInFrames(stream: *mut AAudioStream) -> i32;
    fn AAudioStream_getBufferCapacityInFrames(stream: *mut AAudioStream) -> i32;
    fn AAudioStream_getXRunCount(stream: *mut AAudioStream) -> i32;
    fn AAudioStream_getPerformanceMode(stream: *mut AAudioStream) -> i32;
    fn AAudioStream_getSharingMode(stream: *mut AAudioStream) -> i32;
    fn AAudioStream_getTimestamp(stream: *mut AAudioStream, clock: i32, frame: *mut i64, nanos: *mut i64) -> i32;
    fn AAudioStream_getFramesWritten(stream: *mut AAudioStream) -> i64;
    fn AAudioStream_getFramesPerDataCallback(stream: *mut AAudioStream) -> i32;
}

#[link(name = "log")]
unsafe extern "C" {
    fn __android_log_write(priority: i32, tag: *const c_char, text: *const c_char) -> i32;
}

unsafe extern "C" {
    fn sched_getscheduler(pid: i32) -> i32;
    fn sched_getparam(pid: i32, param: *mut i32) -> i32;
    fn clock_gettime(clock: i32, time: *mut Timespec) -> i32;
}

/// `struct timespec`: a `time_t` and a `long`, each a C long on Android's
/// 32- and 64-bit ABIs alike.
#[repr(C)]
struct Timespec {
    seconds: std::ffi::c_long,
    nanos: std::ffi::c_long,
}

/// `CLOCK_MONOTONIC`, the clock AAudio's timestamps are on.
const CLOCK_MONOTONIC: i32 = 1;

/// A line in the system log (logcat, tag `driftloom`): never from the data
/// callback.
pub fn log(text: &str) {
    if let Ok(text) = std::ffi::CString::new(text) {
        // SAFETY: two NUL-terminated strings; 4 is ANDROID_LOG_INFO.
        unsafe { __android_log_write(4, c"driftloom".as_ptr(), text.as_ptr()) };
    }
}

/// AAudio's words for a result.
fn said(result: i32) -> String {
    // SAFETY: AAudio returns a static NUL-terminated string for any result.
    let text = unsafe { AAudio_convertResultToText(result) };
    if text.is_null() {
        return format!("AAudio error {result}");
    }
    // SAFETY: as above.
    unsafe { CStr::from_ptr(text) }.to_string_lossy().into_owned()
}

/// What the stream is, as opened: for the debug screen and the tests.
#[derive(Clone, Copy, Default)]
pub struct Info {
    pub rate: i32,
    pub channels: i32,
    pub burst: i32,
    pub buffer: i32,
    pub capacity: i32,
    pub performance: i32,
    pub sharing: i32,
    /// The frames each callback makes (0 where the device chooses).
    pub callback: i32,
}

/// The stream's side of things, behind one mutex the app's threads and the
/// reopening thread share (never the audio thread).
struct Control {
    stream: *mut AAudioStream,
    /// Underruns of the streams closed since the engine started, and the
    /// count at the last "reset counters", taken off what is reported.
    xruns_before: i64,
    xruns_reset: i64,
    /// Streams reopened after the device went away (or `reopen` asked).
    reopens: u32,
    info: Info,
    /// The speaker's playhead against the clock (`watch.rs`).
    playhead: Playhead,
    /// Whether the app wants a stream: a reopen after `stop` opens none.
    wanted: bool,
}

// SAFETY: the stream pointer is only used under the mutex.
unsafe impl Send for Control {}

static CONTROL: Mutex<Control> = Mutex::new(Control { stream: ptr::null_mut(), xruns_before: 0, xruns_reset: 0, reopens: 0, info: Info { rate: 0, channels: 0, burst: 0, buffer: 0, capacity: 0, performance: 0, sharing: 0, callback: 0 }, playhead: Playhead::new(), wanted: false });

/// The process's one engine, made at the first start at the device's rate
/// and kept (a stream stopped and started again plays on from it).
static ENGINE: OnceLock<&'static Engine> = OnceLock::new();

/// What the data callback renders, and into how many channels.
static CURRENT: AtomicPtr<Engine> = AtomicPtr::new(ptr::null_mut());
static CHANNELS: AtomicUsize = AtomicUsize::new(2);

/// The callback thread's scheduling, read at a stream's first callback:
/// the policy (0 other, 1 FIFO, 2 round robin; -1 not yet) and priority.
static FIRST: AtomicBool = AtomicBool::new(false);
static POLICY: AtomicI32 = AtomicI32::new(-1);
static PRIORITY: AtomicI32 = AtomicI32::new(-1);

fn control() -> MutexGuard<'static, Control> {
    CONTROL.lock().unwrap_or_else(PoisonError::into_inner)
}

/// The engine, once a stream has started one.
pub fn engine() -> Option<&'static Engine> {
    ENGINE.get().copied()
}

/// The audio thread's call: the engine's `fill`, and nothing else.
unsafe extern "C" fn on_data(_stream: *mut AAudioStream, _user: *mut c_void, audio: *mut c_void, frames: i32) -> i32 {
    if FIRST.swap(false, Ordering::Relaxed) {
        // Once a stream: two system calls, no lock, no allocation.
        let mut priority = 0i32;
        // SAFETY: 0 is this thread; `sched_param` is one int.
        unsafe {
            POLICY.store(sched_getscheduler(0), Ordering::Relaxed);
            if sched_getparam(0, &raw mut priority) == 0 {
                PRIORITY.store(priority, Ordering::Relaxed);
            }
        }
    }
    let channels = CHANNELS.load(Ordering::Relaxed);
    let n = usize::try_from(frames).unwrap_or(0) * channels;
    if audio.is_null() || n == 0 {
        return CALLBACK_RESULT_CONTINUE;
    }
    // SAFETY: AAudio hands `frames` frames of `channels` floats (the format
    // asked and checked at open), ours until the callback returns.
    let out = unsafe { std::slice::from_raw_parts_mut(audio.cast::<f32>(), n) };
    // SAFETY: CURRENT is null or the leaked, 'static engine.
    match unsafe { CURRENT.load(Ordering::Acquire).as_ref() } {
        Some(engine) => engine.fill(out, channels),
        None => out.fill(0.0),
    }
    CALLBACK_RESULT_CONTINUE
}

/// AAudio's call when the stream fails: a device gone is reopened by a
/// thread of its own (the stream can't be closed from here).
unsafe extern "C" fn on_error(stream: *mut AAudioStream, _user: *mut c_void, error: i32) {
    let old = stream as usize;
    let why = if error == ERROR_DISCONNECTED { "the device changed" } else { "the stream failed" };
    let _ = std::thread::Builder::new().name("dl-reopen".into()).spawn(move || {
        log(&format!("{why} ({}): reopening", said(error)));
        reopen_after(old);
    });
}

/// A stream opened (not started): at `rate` Hz, or the device's own for 0.
fn open(rate: i32) -> Result<*mut AAudioStream, String> {
    let mut builder = ptr::null_mut();
    // SAFETY: AAudio's documented calls, each on the builder it made; the
    // builder is deleted whatever the open did.
    unsafe {
        let r = AAudio_createStreamBuilder(&raw mut builder);
        if r != OK || builder.is_null() {
            return Err(format!("no stream builder: {}", said(r)));
        }
        AAudioStreamBuilder_setDirection(builder, DIRECTION_OUTPUT);
        AAudioStreamBuilder_setSharingMode(builder, SHARING_MODE_SHARED);
        AAudioStreamBuilder_setPerformanceMode(builder, PERFORMANCE_MODE_POWER_SAVING);
        AAudioStreamBuilder_setFramesPerDataCallback(builder, CALLBACK_FRAMES);
        AAudioStreamBuilder_setFormat(builder, FORMAT_PCM_FLOAT);
        AAudioStreamBuilder_setChannelCount(builder, 2);
        AAudioStreamBuilder_setSampleRate(builder, if rate > 0 { rate } else { UNSPECIFIED });
        AAudioStreamBuilder_setDataCallback(builder, on_data, ptr::null_mut());
        AAudioStreamBuilder_setErrorCallback(builder, on_error, ptr::null_mut());
        let mut stream = ptr::null_mut();
        let r = AAudioStreamBuilder_openStream(builder, &raw mut stream);
        AAudioStreamBuilder_delete(builder);
        if r != OK || stream.is_null() {
            return Err(format!("the stream did not open: {}", said(r)));
        }
        if AAudioStream_getFormat(stream) != FORMAT_PCM_FLOAT || AAudioStream_getChannelCount(stream) < 1 {
            AAudioStream_close(stream);
            return Err("the stream opened without float samples".into());
        }
        Ok(stream)
    }
}

/// What an open stream is.
fn info(stream: *mut AAudioStream) -> Info {
    // SAFETY: an open stream, under the control mutex.
    unsafe {
        Info {
            rate: AAudioStream_getSampleRate(stream),
            channels: AAudioStream_getChannelCount(stream),
            burst: AAudioStream_getFramesPerBurst(stream),
            buffer: AAudioStream_getBufferSizeInFrames(stream),
            capacity: AAudioStream_getBufferCapacityInFrames(stream),
            performance: AAudioStream_getPerformanceMode(stream),
            sharing: AAudioStream_getSharingMode(stream),
            callback: AAudioStream_getFramesPerDataCallback(stream),
        }
    }
}

/// Open and start a stream for the engine (making the engine at the first
/// start, at the device's rate, the full mix or lite's), under the mutex.
fn open_and_start(c: &mut Control, full: bool) -> Result<(), String> {
    #[allow(clippy::cast_possible_truncation, reason = "the engine's rate is a device's, a whole number of Hz")]
    let want = engine().map_or(0, |e| e.rate() as i32);
    let mut stream = open(want)?;
    let mut rate = info(stream).rate;
    if want == 0 && !(dlcore::MIN_RATE..=dlcore::MAX_RATE).contains(&f64::from(rate)) {
        // A device rate the core doesn't take: ask for 48 kHz and let AAudio
        // convert.
        // SAFETY: the stream just opened, not started.
        unsafe { AAudioStream_close(stream) };
        stream = open(48_000)?;
        rate = info(stream).rate;
    }
    let engine = if let Some(e) = engine() {
        e
    } else {
        let made = Engine::new(f64::from(rate), 2, full).map_err(|why| {
            // SAFETY: as above.
            unsafe { AAudioStream_close(stream) };
            why.to_owned()
        })?;
        let made: &'static Engine = Box::leak(made);
        let _ = ENGINE.set(made);
        made
    };
    #[allow(clippy::cast_possible_truncation, reason = "the engine's rate is a device's, a whole number of Hz")]
    if rate != engine.rate() as i32 {
        // SAFETY: as above.
        unsafe { AAudioStream_close(stream) };
        return Err(format!("the device gave {rate} Hz for the engine's {}", engine.rate()));
    }
    let i = info(stream);
    CHANNELS.store(usize::try_from(i.channels).unwrap_or(2).max(1), Ordering::Relaxed);
    // A block's deadline is at least a burst's time, or a callback's where
    // that is less: a burst here may be many callbacks.
    let block = if i.callback > 0 { i.burst.min(i.callback) } else { i.burst };
    engine.stream_began(u64::try_from(block).unwrap_or(0));
    CURRENT.store(std::ptr::from_ref(engine).cast_mut(), Ordering::Release);
    FIRST.store(true, Ordering::Relaxed);
    // SAFETY: as above.
    let r = unsafe { AAudioStream_requestStart(stream) };
    if r != OK {
        // SAFETY: as above.
        unsafe { AAudioStream_close(stream) };
        return Err(format!("the stream did not start: {}", said(r)));
    }
    c.stream = stream;
    c.info = i;
    c.playhead.stream_began(monotonic().unwrap_or(0));
    log(&format!(
        "stream: {} Hz, {} channels, burst {}, callbacks of {}, buffer {} of {}, performance {}, sharing {}",
        i.rate, i.channels, i.burst, i.callback, i.buffer, i.capacity, i.performance, i.sharing
    ));
    Ok(())
}

/// Stop and close the stream, keeping its underruns, under the mutex.
fn close(c: &mut Control) {
    if c.stream.is_null() {
        return;
    }
    // SAFETY: the open stream, under the control mutex; close waits for
    // the callback thread to finish.
    unsafe {
        c.xruns_before += i64::from(AAudioStream_getXRunCount(c.stream).max(0));
        AAudioStream_requestStop(c.stream);
        AAudioStream_close(c.stream);
    }
    c.stream = ptr::null_mut();
}

/// Start the stream (and the engine, the first time: `full` the full mix,
/// else lite's). Nothing if it is already playing.
///
/// # Errors
///
/// Why the stream could not open or start, in plain words.
pub fn start(full: bool) -> Result<(), String> {
    let mut c = control();
    if !c.stream.is_null() {
        return Ok(());
    }
    open_and_start(&mut c, full)?;
    c.wanted = true;
    Ok(())
}

/// Stop and close the stream. The engine is kept, and a start plays on.
pub fn stop() {
    let mut c = control();
    c.wanted = false;
    close(&mut c);
}

/// Close the stream `old` and open another, if `old` is still the one
/// playing: after a device change, and for `reopen`.
fn reopen_after(old: usize) {
    let mut c = control();
    if c.stream.is_null() || c.stream as usize != old {
        return;
    }
    close(&mut c);
    for _ in 0..20 {
        match open_and_start(&mut c, true) {
            Ok(()) => {
                c.reopens += 1;
                return;
            }
            Err(why) => {
                log(&format!("reopen: {why}; again in 250 ms"));
                drop(c);
                std::thread::sleep(Duration::from_millis(250));
                c = control();
                if !c.wanted || !c.stream.is_null() {
                    return;
                }
            }
        }
    }
    log("reopen: gave up after five seconds");
}

/// Reopen the stream now, as a device change does (the debug screen's and
/// the tests' way to try that path without unplugging anything).
///
/// # Errors
///
/// When no stream is playing.
pub fn reopen() -> Result<(), String> {
    let old = control().stream as usize;
    if old == 0 {
        return Err("no stream is playing".into());
    }
    reopen_after(old);
    if control().stream.is_null() { Err("the stream did not reopen".into()) } else { Ok(()) }
}

/// The stream's figures: whether one plays, the underruns of every stream
/// since the engine started (or the last reset), the reopens, what it is, and the callback
/// thread's scheduling.
pub struct Stream {
    pub running: bool,
    pub underruns: i64,
    pub reopens: u32,
    pub info: Info,
    pub policy: i32,
    pub priority: i32,
    /// How long a frame written now takes to reach the speaker, in seconds,
    /// as the stream measures it (session 30b, `latency_of`): 0 where it
    /// can't say yet (the stream just started).
    pub latency: f64,
    /// Times the playhead fell behind the clock since the engine started,
    /// the seconds lost, and the seconds since the last (`watch::Playhead`).
    pub behind: u32,
    pub behind_lost: f64,
    pub behind_ago: f64,
}

/// The open stream's underruns, 0 with none.
fn xruns(c: &Control) -> i64 {
    if c.stream.is_null() {
        0
    } else {
        // SAFETY: the open stream, under the mutex.
        i64::from(unsafe { AAudioStream_getXRunCount(c.stream) }.max(0))
    }
}

/// "Reset counters" (Diagnostics): the underruns and the playhead's counts
/// start again from nothing; the engine's are its own command's.
pub fn reset_counts() {
    let mut c = control();
    c.xruns_reset = c.xruns_before + xruns(&c);
    c.playhead.reset_counts();
}

/// The stream's figures now.
pub fn stream() -> Stream {
    let mut c = control();
    let now = xruns(&c);
    let mut latency = 0.0;
    if !c.stream.is_null()
        && let Some(t) = timing_of(c.stream, c.info.rate)
    {
        c.playhead.read(t.now, t.played);
        latency = t.latency;
    }
    #[allow(clippy::cast_precision_loss, reason = "nanoseconds of a session, far under 2^53")]
    let behind_ago = monotonic().map_or(0.0, |now| now.saturating_sub(c.playhead.last) as f64 * 1e-9);
    Stream {
        running: !c.stream.is_null(),
        underruns: c.xruns_before + now - c.xruns_reset,
        reopens: c.reopens,
        info: c.info,
        policy: POLICY.load(Ordering::Relaxed),
        priority: PRIORITY.load(Ordering::Relaxed),
        latency,
        behind: c.playhead.behind,
        behind_lost: c.playhead.lost,
        behind_ago,
    }
}

/// The monotonic clock now, in nanoseconds.
fn monotonic() -> Option<i64> {
    let mut now = Timespec { seconds: 0, nanos: 0 };
    // SAFETY: a place to write to.
    if unsafe { clock_gettime(CLOCK_MONOTONIC, &raw mut now) } != 0 {
        return None;
    }
    #[allow(clippy::useless_conversion, reason = "a C long is 32 bits on armeabi-v7a")]
    let ns = i64::from(now.seconds).saturating_mul(1_000_000_000).saturating_add(i64::from(now.nanos));
    Some(ns)
}

/// What the stream's timestamp says now.
struct Timing {
    /// When, on the monotonic clock in nanoseconds.
    now: i64,
    /// The seconds of this stream the speaker has played.
    played: f64,
    /// The latency to the speaker, in seconds; 0 for one that makes no sense.
    latency: f64,
}

/// The open stream's timing now (session 30b, queue item 110): its latency
/// to the speaker is the frames written to it less the frame the speaker
/// plays now (its last timestamp, carried on to now on the same clock), at
/// `rate`. None where the stream has no timestamp yet (the layers' playhead
/// then reads the stream's buffer instead). The app's thread, under the
/// mutex: never the data callback.
fn timing_of(stream: *mut AAudioStream, rate: i32) -> Option<Timing> {
    if rate <= 0 {
        return None;
    }
    let (mut frame, mut at) = (0i64, 0i64);
    // SAFETY: the open stream, under the mutex, and places to write to.
    let (timed, written) = unsafe {
        let timed = AAudioStream_getTimestamp(stream, CLOCK_MONOTONIC, &raw mut frame, &raw mut at);
        (timed, AAudioStream_getFramesWritten(stream))
    };
    let now = monotonic()?;
    if timed != OK || written <= 0 {
        return None;
    }
    let rate = f64::from(rate);
    #[allow(clippy::cast_precision_loss, reason = "frames and nanoseconds over a session, far under 2^53")]
    let (played, written) = (frame as f64 / rate + (now - at) as f64 * 1e-9, written as f64 / rate);
    let latency = written - played;
    Some(Timing { now, played, latency: if latency.is_finite() && latency > 0.0 && latency < 1.0 { latency } else { 0.0 } })
}
