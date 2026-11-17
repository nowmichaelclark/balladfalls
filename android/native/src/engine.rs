//! The engine: a core, the player on it, and the queue its commands come by
//! (queue item 107b).
//!
//! The app's thread sends commands (`send`); the audio thread renders
//! (`fill`), taking the commands waiting at the start of each callback, and
//! publishes what the app shows (`Counts`, the loop's name) in atomics. The
//! core and the player are the renderer's alone: nothing else ever touches
//! them while a stream runs, so `fill` takes no lock, and it allocates
//! nothing (`fill_allocates_nothing`, below). This is the worklet's way
//! (`js/worklet.js`: messages in, events out) on a native audio thread.
//!
//! The same `fill` renders offline (`render_line`), so the hash the tests
//! hold to the web's is made by the path the speaker hears.

use std::cell::UnsafeCell;
use std::fmt::Write as _;
use std::ptr;
use std::sync::atomic::{AtomicBool, AtomicU8, AtomicU32, AtomicU64, Ordering};
use std::sync::{Mutex, PoisonError};
use std::time::Instant;

use dlcore::Core;
use dlcore::player::{CROSSFADE, Handover, Kind, Moment, Player, Request, State};

use crate::ring::Ring;

/// The frames the core renders in one call, at most: a callback asking for
/// more is rendered in several. The core gives the same samples whatever
/// the split (`core/README.md`, rendering ahead), so this only sizes the
/// engine's two scratch planes.
pub const CHUNK: usize = 1024;

/// The commands that may wait at once. The app sends a handful a second at
/// most; a full queue refuses (`Counts::refused`) rather than block.
const COMMANDS: usize = 32;

/// The longest name kept for the app to read (the core's are short words).
const NAME: usize = 48;

/// What the app asks of the player, as the worklet's messages do. A load
/// carries its whole request (about 1.7 KB), so every slot of the queue is
/// that size: boxing it would allocate, which the queue must never do.
#[allow(clippy::large_enum_variant, reason = "a fixed slot of the queue; boxing would allocate")]
#[derive(Clone, Copy)]
pub enum Command {
    /// A loop from its seed, with what it asks for (`Player::load`): made a
    /// stage a block over the next blocks, then played.
    Load { seed: u32, request: Request },
    /// Make what is left of the loop asked for, now (`Player::ready`): the
    /// offline render's, never a stream's (it would spike one callback).
    Ready,
    /// Go on after a pause (`Player::resume`).
    Play,
    /// Stop deciding steps; what was handed over rings out (`Player::stop`).
    Pause,
    /// A loop of the core's own (`Player::next`), crossfading as the app's
    /// Next does.
    Next,
    /// The listener's volume, 0 to 1 (`Player::set_volume`).
    Volume(f64),
    /// How far each pass wanders (`Player::set_wander`).
    Wander(f64),
    /// The seed the core's own loops are drawn from (`Player::set_draws`).
    Draws(u32),
    /// Forget the busiest callback so far (the debug screen's reset).
    ResetBusiest,
}

/// What the audio thread tells the app: written by the renderer only, read
/// by anyone, never waited on.
#[derive(Default)]
pub struct Counts {
    /// The core's notes taken late, left out, and dropped, since it started
    /// (`Core::late`, `missed`, `dropped`): 0 unless something is wrong.
    pub late: AtomicU32,
    pub missed: AtomicU32,
    pub dropped: AtomicU32,
    /// Callbacks rendered, and the frames they asked for.
    pub callbacks: AtomicU64,
    pub frames: AtomicU64,
    /// The busiest callback since the start (or the last reset): its share
    /// of its deadline in millionths, its time in nanoseconds, its frames.
    pub busiest_ppm: AtomicU64,
    pub busiest_ns: AtomicU64,
    pub busiest_frames: AtomicU64,
    /// Every callback's time and deadline, summed, for the mean share.
    pub spent_ns: AtomicU64,
    pub deadline_ns: AtomicU64,
    /// The player's state (0 idle, 1 loading, 2 wandering, 3 playing, as
    /// `dl_player_state`), and the seed of the loop heard last (its `Loop`
    /// event).
    pub state: AtomicU32,
    pub seed: AtomicU32,
    /// Commands refused because the queue was full (the app's side).
    pub refused: AtomicU32,
    /// Callbacks that found another renderer at work and played silence:
    /// never, unless two streams were somehow open at once.
    pub collisions: AtomicU32,
}

/// The loop's name for the app: a sequence lock, so the reader never waits
/// on the audio thread and never sees half a name.
struct NameCell {
    version: AtomicU32,
    len: AtomicU8,
    bytes: [AtomicU8; NAME],
}

impl NameCell {
    fn new() -> Self {
        NameCell { version: AtomicU32::new(0), len: AtomicU8::new(0), bytes: [const { AtomicU8::new(0) }; NAME] }
    }

    /// The renderer's: a new name, odd version while it is written.
    fn write(&self, name: &[u8]) {
        let v = self.version.load(Ordering::Relaxed);
        self.version.store(v.wrapping_add(1), Ordering::Relaxed);
        std::sync::atomic::fence(Ordering::Release);
        let n = name.len().min(NAME);
        for (cell, b) in self.bytes.iter().zip(&name[..n]) {
            cell.store(*b, Ordering::Relaxed);
        }
        #[allow(clippy::cast_possible_truncation, reason = "n is at most NAME, 48")]
        self.len.store(n as u8, Ordering::Relaxed);
        self.version.store(v.wrapping_add(2), Ordering::Release);
    }

    /// Anyone's: the name as last written whole.
    fn read(&self) -> String {
        loop {
            let v = self.version.load(Ordering::Acquire);
            if v % 2 == 1 {
                std::hint::spin_loop();
                continue;
            }
            let n = usize::from(self.len.load(Ordering::Relaxed)).min(NAME);
            let bytes: Vec<u8> = self.bytes[..n].iter().map(|b| b.load(Ordering::Relaxed)).collect();
            std::sync::atomic::fence(Ordering::Acquire);
            if self.version.load(Ordering::Relaxed) == v {
                return String::from_utf8_lossy(&bytes).into_owned();
            }
        }
    }
}

/// The renderer's part: the core, the player, and the planes the core
/// renders into before they are interleaved.
struct Inner {
    core: Core,
    player: Player,
    planes: [[f32; CHUNK]; 2],
}

/// A core as `Core::new` makes one and a player as `Player::new` does, built
/// when the library is: a new engine copies them into its own memory, so
/// making one never builds megabytes on a stack (`core/src/capi.rs` does the
/// same). Both are all zero bytes, so they cost the library's file nothing.
struct Template<T>(T);

// SAFETY: never written: only ever copied from.
unsafe impl<T> Sync for Template<T> {}

static CORE: Template<Core> = Template(Core::new());
static PLAYER: Template<Player> = Template(Player::new());

/// A core and its player, the queue to them, and what they report.
pub struct Engine {
    inner: UnsafeCell<Inner>,
    /// Set while a thread renders: `fill`'s guard that the core and player
    /// are only ever its own.
    rendering: AtomicBool,
    commands: Ring<Command, COMMANDS>,
    /// The app's side of the queue: its threads take turns writing. The
    /// audio thread never takes it.
    writer: Mutex<()>,
    /// What the audio thread reports.
    pub counts: Counts,
    name: NameCell,
    rate: f64,
    layout: usize,
}

// SAFETY: `inner` is reached only inside `fill`, behind `rendering` (one
// thread at a time), or through `&mut self`; the rest is atomics, the
// lock-free queue (one writer under `writer`, one reader inside `fill`) and
// plain numbers set before the engine is shared.
unsafe impl Sync for Engine {}

impl Engine {
    /// A new engine: a core at `rate` Hz rendering `layout` channels (1 mono,
    /// 2 stereo), the full mix or lite's (`full`), and its player, idle.
    ///
    /// # Errors
    ///
    /// The core's refusal of the rate or layout, in plain words.
    pub fn new(rate: f64, layout: u32, full: bool) -> Result<Box<Engine>, &'static str> {
        let mut memory = Box::<Engine>::new_uninit();
        let p = memory.as_mut_ptr();
        // SAFETY: each field is written once before the whole is assumed
        // made; the templates are plain data (no pointers but to statics),
        // so their copies are a core and a player of their own. `UnsafeCell`
        // has its contents' layout.
        let mut engine = unsafe {
            let inner = (&raw mut (*p).inner).cast::<Inner>();
            ptr::copy_nonoverlapping(&raw const CORE.0, &raw mut (*inner).core, 1);
            ptr::copy_nonoverlapping(&raw const PLAYER.0, &raw mut (*inner).player, 1);
            (&raw mut (*inner).planes).write([[0.0; CHUNK]; 2]);
            (&raw mut (*p).rendering).write(AtomicBool::new(false));
            (&raw mut (*p).commands).write(Ring::new());
            (&raw mut (*p).writer).write(Mutex::new(()));
            (&raw mut (*p).counts).write(Counts::default());
            (&raw mut (*p).name).write(NameCell::new());
            (&raw mut (*p).rate).write(rate);
            (&raw mut (*p).layout).write(if layout == 2 { 2 } else { 1 });
            memory.assume_init()
        };
        let Inner { core, player, .. } = engine.inner.get_mut();
        player.start(core, rate, layout, full).map_err(|_| "the core can't play at that rate or layout")?;
        Ok(engine)
    }

    /// The rate the core renders at.
    #[cfg_attr(not(target_os = "android"), allow(dead_code, reason = "the stream's, on Android"))]
    pub fn rate(&self) -> f64 {
        self.rate
    }

    /// Queue a command for the audio thread's next callback. False if the
    /// queue is full (counted in `Counts::refused`): the command is dropped.
    pub fn send(&self, command: &Command) -> bool {
        let _turn = self.writer.lock().unwrap_or_else(PoisonError::into_inner);
        // SAFETY: the one writer: every push is made holding `writer`.
        let sent = unsafe { self.commands.push(*command) };
        if !sent {
            self.counts.refused.fetch_add(1, Ordering::Relaxed);
        }
        sent
    }

    /// The name of the loop heard last.
    pub fn name(&self) -> String {
        self.name.read()
    }

    /// Fill `out`, interleaved, `channels` samples a frame, with the next
    /// frames: the audio thread's call, once a callback. It takes the
    /// commands waiting, renders, reads the player's events and publishes
    /// the counts. No lock, no allocation, nothing that can wait.
    pub fn fill(&self, out: &mut [f32], channels: usize) {
        if channels == 0 {
            return;
        }
        if self.rendering.swap(true, Ordering::Acquire) {
            out.fill(0.0);
            self.counts.collisions.fetch_add(1, Ordering::Relaxed);
            return;
        }
        let began = Instant::now();
        // SAFETY: `rendering` was false and is now ours: no other thread is
        // inside `fill`, and nothing else reaches `inner` through `&self`.
        let inner = unsafe { &mut *self.inner.get() };

        // SAFETY: the one reader: every pop is made inside `fill`, behind
        // `rendering`.
        while let Some(command) = unsafe { self.commands.pop() } {
            self.apply(inner, &command);
        }

        let frames = out.len() / channels;
        let mut done = 0;
        while done < frames {
            let n = (frames - done).min(CHUNK);
            let Inner { core, player, planes } = &mut *inner;
            let [left, right] = planes;
            let rendered = {
                let mut both: [&mut [f32]; 2] = [&mut left[..n], &mut right[..n]];
                player.render(core, &mut both[..self.layout]).is_ok()
            };
            let into = &mut out[done * channels..(done + n) * channels];
            if rendered {
                interleave(into, channels, &left[..n], &right[..n], self.layout);
            } else {
                into.fill(0.0);
            }
            done += n;
        }
        // The rest of a buffer not a whole number of frames, if a host gave one.
        out[frames * channels..].fill(0.0);

        while let Some(event) = inner.player.event() {
            if event.kind == Kind::Loop {
                #[allow(clippy::cast_possible_truncation, reason = "a Loop event's number is its seed, a u32")]
                self.counts.seed.store(event.number as u32, Ordering::Relaxed);
                self.name.write(inner.player.generator().spec().name.as_str().as_bytes());
            }
        }

        let c = &self.counts;
        c.late.store(inner.core.late(), Ordering::Relaxed);
        c.missed.store(inner.core.missed(), Ordering::Relaxed);
        c.dropped.store(inner.core.dropped(), Ordering::Relaxed);
        c.state.store(state_number(inner.player.state()), Ordering::Relaxed);
        c.callbacks.fetch_add(1, Ordering::Relaxed);
        c.frames.fetch_add(frames as u64, Ordering::Relaxed);

        // The callback's time against its deadline: the frames it was asked
        // for, at the rate, are how long the device takes to play them.
        let spent = u64::try_from(began.elapsed().as_nanos()).unwrap_or(u64::MAX);
        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss, clippy::cast_precision_loss, reason = "a callback's deadline in ns, far inside u64")]
        let deadline = ((frames as f64) * 1e9 / self.rate) as u64;
        c.spent_ns.fetch_add(spent, Ordering::Relaxed);
        c.deadline_ns.fetch_add(deadline, Ordering::Relaxed);
        if let Some(ppm) = spent.saturating_mul(1_000_000).checked_div(deadline)
            && ppm > c.busiest_ppm.load(Ordering::Relaxed)
        {
            c.busiest_ppm.store(ppm, Ordering::Relaxed);
            c.busiest_ns.store(spent, Ordering::Relaxed);
            c.busiest_frames.store(frames as u64, Ordering::Relaxed);
        }

        self.rendering.store(false, Ordering::Release);
    }

    /// One command, on the audio thread.
    fn apply(&self, inner: &mut Inner, command: &Command) {
        let Inner { core, player, .. } = inner;
        match *command {
            Command::Load { seed, ref request } => player.load(seed, request),
            Command::Ready => player.ready(core),
            Command::Play => {
                if player.state() == State::Idle {
                    player.resume(0.0);
                }
            }
            Command::Pause => player.stop(),
            Command::Next => {
                player.next(Moment::Now, Handover::Crossfade(CROSSFADE));
            }
            Command::Volume(v) => player.set_volume(core, v),
            Command::Wander(a) => player.set_wander(a),
            Command::Draws(seed) => player.set_draws(seed),
            Command::ResetBusiest => {
                self.counts.busiest_ppm.store(0, Ordering::Relaxed);
                self.counts.busiest_ns.store(0, Ordering::Relaxed);
                self.counts.busiest_frames.store(0, Ordering::Relaxed);
                self.counts.spent_ns.store(0, Ordering::Relaxed);
                self.counts.deadline_ns.store(0, Ordering::Relaxed);
            }
        }
    }

    /// The name of the loop the player holds, read straight from it: for
    /// the offline render, which owns its engine.
    fn name_now(&mut self) -> String {
        self.inner.get_mut().player.generator().spec().name.as_str().to_owned()
    }

    /// The notes the core could not play as asked (`dl_player_trouble`).
    fn trouble(&mut self) -> u32 {
        let core = &self.inner.get_mut().core;
        core.late().saturating_add(core.missed()).saturating_add(core.dropped())
    }
}

/// The player's state as the C header numbers it.
fn state_number(state: State) -> u32 {
    match state {
        State::Idle => 0,
        State::Loading => 1,
        State::Wandering => 2,
        State::Playing => 3,
    }
}

/// The core's planes into the device's interleaved frames. The same
/// channels, frame by frame; a stereo render on a mono device as its mid
/// (the mono render, to rounding); a mono render on every channel; past
/// two channels, silence.
fn interleave(out: &mut [f32], channels: usize, left: &[f32], right: &[f32], layout: usize) {
    for (i, frame) in out.chunks_exact_mut(channels).enumerate() {
        match (layout, channels) {
            (2, 1) => frame[0] = f32::midpoint(left[i], right[i]),
            (2, _) => {
                frame[0] = left[i];
                frame[1] = right[i];
                frame[2..].fill(0.0);
            }
            _ => frame.fill(left[i]),
        }
    }
}

/// How a loop is rendered offline, as `dlrender --seed` and
/// `examples/c/seed.c` take it.
#[derive(Clone, Debug)]
pub struct Render {
    pub seed: u32,
    pub request: String,
    pub seconds: f64,
    pub rate: f64,
    pub layout: u32,
    pub full: bool,
    pub wander: f64,
    /// The frames a "callback" asks for: any number, the same samples.
    pub chunk: usize,
}

/// A loop rendered offline through the engine's own path (the commands
/// through the queue, `fill` a chunk at a time, interleaved as a device
/// takes them), and its line as `dlrender --seed`, `seed.c` and
/// `tools/player-wasm.mjs` print it: the loop's name, how it played, FNV-1a
/// 32 over each channel's float words and FNV-1a 64 over their bytes,
/// interleaved. Notes the core could not play as asked are added at the end
/// (` trouble=N`), so a line with any never matches the web's.
///
/// # Errors
///
/// The request's refusal, or the core's of the rate or layout, in plain
/// words.
pub fn render_line(r: &Render) -> Result<String, &'static str> {
    let request = Request::parse(&r.request)?;
    let mut engine = Engine::new(r.rate, r.layout, r.full)?;
    let layout = engine.layout;
    // As seed.c: the wander, the load, the loop made at once.
    for command in [Command::Wander(r.wander), Command::Load { seed: r.seed, request }, Command::Ready] {
        if !engine.send(&command) {
            return Err("the command queue is full");
        }
    }
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss, reason = "a render's frames, far inside usize")]
    let total = (r.seconds * r.rate).ceil() as usize;
    let chunk = r.chunk.max(1);
    let mut buffer = vec![0.0f32; chunk * layout];
    let mut words = [0x811c_9dc5u32; 2];
    let mut bytes = 0xcbf2_9ce4_8422_2325u64;
    let mut done = 0;
    while done < total {
        let n = (total - done).min(chunk);
        let out = &mut buffer[..n * layout];
        engine.fill(out, layout);
        for frame in out.chunks_exact(layout) {
            for (c, x) in frame.iter().enumerate() {
                let w = x.to_bits();
                words[c] = (words[c] ^ w).wrapping_mul(0x0100_0193);
                for i in 0..4 {
                    bytes = (bytes ^ u64::from((w >> (8 * i)) & 255)).wrapping_mul(0x0000_0100_0000_01b3);
                }
            }
        }
        done += n;
    }
    let mut line = format!(
        "seed={} name={} quality={} layout={} seconds={} rate={} wander={}",
        r.seed,
        engine.name_now(),
        if r.full { "full" } else { "lite" },
        if layout == 2 { "stereo" } else { "mono" },
        r.seconds,
        r.rate,
        r.wander
    );
    if !r.request.is_empty() {
        let _ = write!(line, " request={}", r.request);
    }
    if layout == 2 {
        let _ = write!(line, " frames={total} left={:08x} right={:08x}", words[0], words[1]);
    } else {
        let _ = write!(line, " frames={total} out={:08x}", words[0]);
    }
    let _ = write!(line, " hash={bytes:016x}");
    let trouble = engine.trouble();
    if trouble > 0 {
        let _ = write!(line, " trouble={trouble}");
    }
    Ok(line)
}

/// A line as `render_line` prints it, read back into how it was rendered:
/// the tests take a golden line and render it again.
#[must_use]
pub fn render_of(line: &str, chunk: usize) -> Option<Render> {
    let field = |name: &str| line.split_whitespace().find_map(|w| w.strip_prefix(name)?.strip_prefix('='));
    Some(Render {
        seed: field("seed")?.parse().ok()?,
        request: field("request").unwrap_or("").to_owned(),
        seconds: field("seconds")?.parse().ok()?,
        rate: field("rate")?.parse().ok()?,
        layout: if field("layout")? == "stereo" { 2 } else { 1 },
        full: field("quality")? == "full",
        wander: field("wander")?.parse().ok()?,
        chunk,
    })
}

#[cfg(test)]
mod tests {
    use super::{Command, Engine, render_line, render_of};
    use std::alloc::{GlobalAlloc, Layout, System};
    use std::cell::Cell;

    /// Counts this thread's allocations, so a test can say `fill` makes none.
    struct Counting;

    thread_local! {
        static ALLOCATIONS: Cell<u64> = const { Cell::new(0) };
    }

    // SAFETY: every call is passed to the system's allocator unchanged.
    unsafe impl GlobalAlloc for Counting {
        unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
            ALLOCATIONS.with(|n| n.set(n.get() + 1));
            // SAFETY: the caller's layout, as given.
            unsafe { System.alloc(layout) }
        }
        unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
            ALLOCATIONS.with(|n| n.set(n.get() + 1));
            // SAFETY: as given.
            unsafe { System.dealloc(ptr, layout) }
        }
        unsafe fn alloc_zeroed(&self, layout: Layout) -> *mut u8 {
            ALLOCATIONS.with(|n| n.set(n.get() + 1));
            // SAFETY: as given.
            unsafe { System.alloc_zeroed(layout) }
        }
        unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, size: usize) -> *mut u8 {
            ALLOCATIONS.with(|n| n.set(n.get() + 1));
            // SAFETY: as given.
            unsafe { System.realloc(ptr, layout, size) }
        }
    }

    #[global_allocator]
    static COUNTING: Counting = Counting;

    fn allocations() -> u64 {
        ALLOCATIONS.with(Cell::get)
    }

    fn golden(n: usize) -> String {
        let text = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/../../core/golden/seeds.hashes")).unwrap();
        let line = text.lines().filter(|l| !l.starts_with('#')).nth(n).unwrap();
        line.split_once(' ').unwrap().1.to_owned()
    }

    /// The engine's path makes the golden samples: the corpus's loops as
    /// every target plays them (`core/golden/seeds.hashes`, which
    /// `tools/seeds.sh` holds to `js/dlplayer.wasm` too), at a callback's
    /// size, an odd one, and one past the engine's chunk.
    #[test]
    fn the_engines_path_makes_the_golden_samples() {
        for (n, chunk) in [(0, 192), (1, 333), (2, 2500)] {
            let want = golden(n);
            let render = render_of(&want, chunk).unwrap();
            assert_eq!(render_line(&render).unwrap(), want, "golden line {n}, {chunk} frames a callback");
        }
    }

    /// A line the web's module printed (`DL_WASM_LINE`: CI's build job sets
    /// it from `node tools/player-wasm.mjs`, stereo at a device's 48 kHz),
    /// rendered again through the engine's path at a callback's size.
    #[test]
    fn the_webs_line_if_given() {
        let Ok(want) = std::env::var("DL_WASM_LINE") else { return };
        let render = render_of(&want, 192).expect("DL_WASM_LINE is a hash line");
        assert_eq!(render_line(&render).unwrap(), want);
    }

    /// Promise 2 on the audio thread: half a minute of callbacks of a
    /// device's size, a load, a Next, a pause and a play among them, and not
    /// one allocation inside `fill`.
    #[test]
    fn fill_allocates_nothing() {
        let rate = 48_000.0;
        let engine = Engine::new(rate, 2, true).unwrap();
        let request = dlcore::player::Request::parse("peaceful").unwrap();
        assert!(engine.send(&Command::Draws(20_261_117)));
        assert!(engine.send(&Command::Volume(0.8)));
        assert!(engine.send(&Command::Load { seed: 2_693_262_067, request }));
        let burst = 192;
        let mut out = vec![0.0f32; burst * 2];
        let mut inside = 0;
        let callbacks = 30 * 48_000 / burst;
        for i in 0..callbacks {
            match i {
                2_500 => assert!(engine.send(&Command::Next)),
                5_000 => assert!(engine.send(&Command::Pause)),
                5_500 => assert!(engine.send(&Command::Play)),
                _ => {}
            }
            let before = allocations();
            engine.fill(&mut out, 2);
            inside += allocations() - before;
        }
        assert_eq!(inside, 0, "allocations inside fill");
        let c = &engine.counts;
        assert_eq!(c.callbacks.load(std::sync::atomic::Ordering::Relaxed), callbacks as u64);
        assert_eq!(c.late.load(std::sync::atomic::Ordering::Relaxed), 0);
        assert_eq!(c.dropped.load(std::sync::atomic::Ordering::Relaxed), 0);
        assert_eq!(c.state.load(std::sync::atomic::Ordering::Relaxed), 3, "playing again after the pause");
        assert_ne!(engine.name(), "");
    }

    /// A full queue refuses and says so; the audio thread empties it.
    #[test]
    fn a_full_queue_refuses() {
        let engine = Engine::new(48_000.0, 2, true).unwrap();
        let mut sent = 0;
        while engine.send(&Command::Volume(0.5)) {
            sent += 1;
        }
        assert_eq!(sent, super::COMMANDS);
        assert_eq!(engine.counts.refused.load(std::sync::atomic::Ordering::Relaxed), 1);
        let mut out = [0.0f32; 256];
        engine.fill(&mut out, 2);
        assert!(engine.send(&Command::Volume(0.5)));
    }
}
