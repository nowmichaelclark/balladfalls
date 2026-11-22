//! What a phone can say about a crackle (session 30g, queue item 115).
//! AAudio's own underrun count read 0 through crackles Mikey heard, so it
//! isn't the only one kept:
//!
//! - `Watch`, the audio thread's: the callbacks that took longer than the
//!   audio they made, the worst few (when, how many frames, what they did),
//!   the longest time between two callbacks, and how often that was longer
//!   than the whole buffer (which had then run dry, whatever AAudio says).
//!   Fixed memory and plain numbers: no lock, no allocation, no log.
//! - `Playhead`, the app's thread's: how often the frame the speaker plays
//!   fell behind the phone's clock and stayed there. A dropout past the
//!   buffer (the mixer's, the device's) shows here where the device's
//!   position stops for it; one it plays through as if nothing happened
//!   does not, so 0 is not proof of a clean sound.

/// What a callback did, as bits; `did_words` names them.
pub mod did {
    /// A page's player began (`Command::Init`: the mix built afresh).
    pub const INIT: u32 = 1;
    /// The page's player let go.
    pub const DISPOSE: u32 = 1 << 1;
    /// A loop asked for: a load, a change, a re-roll, a Next.
    pub const LOAD: u32 = 1 << 2;
    /// The track set, or the loop that follows its end.
    pub const TRACK: u32 = 1 << 3;
    pub const JUMP: u32 = 1 << 4;
    /// Any other command.
    pub const CONTROL: u32 = 1 << 5;
    /// The player was making a loop.
    pub const MAKING: u32 = 1 << 6;
    /// Another loop began (a track change).
    pub const LOOP: u32 = 1 << 7;
    /// A pass or a section began.
    pub const PASS: u32 = 1 << 8;

    pub const WORDS: [&str; 9] = ["init", "dispose", "load", "track", "jump", "control", "making", "new loop", "pass"];
}

/// The bits in words, joined by plus signs; "playing" for none.
#[must_use]
pub fn did_words(bits: u32) -> String {
    let words: Vec<&str> = did::WORDS.iter().enumerate().filter(|(i, _)| bits & (1 << i) != 0).map(|(_, word)| *word).collect();
    if words.is_empty() { "playing".to_owned() } else { words.join("+") }
}

/// How many of the worst callbacks are kept.
pub const WORST: usize = 4;

/// A stream's first second: the buffer fills and the device wakes, and the
/// times between callbacks say nothing yet.
const SETTLE_NS: u64 = 1_000_000_000;

/// One callback, as it ended. Its times are nanoseconds since the engine
/// was made.
#[derive(Clone, Copy, Default, Debug, PartialEq)]
pub struct Called {
    pub at: u64,
    pub spent: u64,
    /// The time its block takes to play (`Counts::block`).
    pub deadline: u64,
    pub frames: u64,
    pub did: u32,
}

impl Called {
    /// Its share of its deadline, in millionths.
    #[must_use]
    pub fn ppm(&self) -> u64 {
        self.spent.saturating_mul(1_000_000).checked_div(self.deadline).unwrap_or(0)
    }
}

/// The audio thread's figures.
#[derive(Clone, Copy, Debug)]
pub struct Watch {
    /// Callbacks over their deadline.
    pub over: u64,
    /// The worst callbacks by share of their deadline, worst first.
    pub worst: [Called; WORST],
    /// The longest time from one callback's start to the next's, and when
    /// it ended.
    pub gap: u64,
    pub gap_at: u64,
    /// Times that gap was longer than the buffer holds.
    pub dry: u64,
    began: u64,
    last: Option<u64>,
}

impl Watch {
    #[must_use]
    pub const fn new() -> Self {
        Watch { over: 0, worst: [Called { at: 0, spent: 0, deadline: 0, frames: 0, did: 0 }; WORST], gap: 0, gap_at: 0, dry: 0, began: 0, last: None }
    }

    /// A stream began at `at`: no gap counts across it, or in its first
    /// second.
    pub fn stream_began(&mut self, at: u64) {
        self.began = at;
        self.last = None;
    }

    /// A callback ended; `buffer` is what the stream's buffer holds, in
    /// nanoseconds (0 offline).
    pub fn called(&mut self, c: Called, buffer: u64) {
        if c.deadline > 0 && c.spent > c.deadline {
            self.over += 1;
        }
        if let Some(i) = self.worst.iter().position(|w| c.ppm() > w.ppm()) {
            self.worst.copy_within(i..WORST - 1, i + 1);
            self.worst[i] = c;
        }
        if let Some(last) = self.last
            && c.at.saturating_sub(self.began) >= SETTLE_NS
        {
            let gap = c.at.saturating_sub(last);
            if gap > self.gap {
                self.gap = gap;
                self.gap_at = c.at;
            }
            if buffer > 0 && gap > buffer {
                self.dry += 1;
            }
        }
        self.last = Some(c.at);
    }
}

/// How far the playhead must fall behind the clock to be counted, seconds:
/// more than a timestamp's own jitter.
const BEHIND: f64 = 0.010;
/// The readings in a row that must agree.
const AGREE: u32 = 5;
/// A reading at most this often, and none in a stream's first seconds.
const EVERY_NS: i64 = 200_000_000;
const WARM_NS: i64 = 3_000_000_000;
/// How much of a reading's difference the line takes: it follows the
/// clocks' drift, not a step.
const FOLLOW: f64 = 0.05;

/// The speaker's playhead against the phone's clock.
#[derive(Clone, Copy, Debug)]
pub struct Playhead {
    /// Times it fell behind and stayed there, and the seconds lost in all.
    pub behind: u32,
    pub lost: f64,
    /// When it last did, on the monotonic clock in nanoseconds.
    pub last: i64,
    /// Where it is expected: frames played in seconds, less the clock.
    line: Option<f64>,
    off: u32,
    began: i64,
    read: i64,
}

impl Playhead {
    #[must_use]
    pub const fn new() -> Self {
        Playhead { behind: 0, lost: 0.0, last: 0, line: None, off: 0, began: 0, read: 0 }
    }

    /// A stream began at `now`: its playhead is a new one, the counts go on.
    pub fn stream_began(&mut self, now: i64) {
        self.line = None;
        self.off = 0;
        self.began = now;
        self.read = now;
    }

    /// A reading at `now`: the seconds the speaker has played.
    pub fn read(&mut self, now: i64, played: f64) {
        if now - self.began < WARM_NS || now - self.read < EVERY_NS {
            return;
        }
        self.read = now;
        #[allow(clippy::cast_precision_loss, reason = "a phone's uptime in nanoseconds, to well under a millisecond")]
        let at = played - now as f64 * 1e-9;
        let Some(line) = self.line else {
            self.line = Some(at);
            return;
        };
        let by = at - line;
        if by.abs() < BEHIND {
            self.line = Some(line + by * FOLLOW);
            self.off = 0;
            return;
        }
        self.off += 1;
        if self.off >= AGREE {
            if by < 0.0 {
                self.behind += 1;
                self.lost -= by;
                self.last = now;
            }
            self.line = Some(at);
            self.off = 0;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{Called, Playhead, Watch, did, did_words};

    const MS: u64 = 1_000_000;

    fn called(at: u64, spent: u64, did: u32) -> Called {
        Called { at: at * MS, spent: spent * MS, deadline: 21 * MS, frames: 1024, did }
    }

    #[test]
    fn the_callbacks_over_their_deadline_and_the_worst_first() {
        let mut w = Watch::new();
        for (i, spent) in [5, 30, 8, 48, 22, 6, 21].into_iter().enumerate() {
            w.called(called(i as u64, spent, 0), 0);
        }
        assert_eq!(w.over, 3);
        assert_eq!(w.worst.map(|c| c.spent / MS), [48, 30, 22, 21]);
        assert_eq!(w.worst.map(|c| c.at / MS), [3, 1, 4, 6]);
    }

    #[test]
    fn a_gap_past_the_buffer_is_a_glitch_but_not_as_a_stream_starts() {
        let mut w = Watch::new();
        let buffer = 160 * MS;
        w.stream_began(0);
        w.called(called(0, 1, 0), buffer);
        w.called(called(600, 1, 0), buffer);
        assert_eq!((w.dry, w.gap), (0, 0), "the first second");
        w.called(called(1_100, 1, 0), buffer);
        assert_eq!((w.dry, w.gap / MS), (1, 500));
        w.called(called(1_180, 1, 0), buffer);
        assert_eq!(w.dry, 1, "inside the buffer");
        w.stream_began(9_000 * MS);
        w.called(called(10_500, 1, 0), buffer);
        assert_eq!((w.dry, w.gap / MS), (1, 500), "none across a pause");
    }

    #[test]
    fn what_a_callback_did_in_words() {
        assert_eq!(did_words(0), "playing");
        assert_eq!(did_words(did::INIT | did::LOAD), "init+load");
        assert_eq!(did_words(did::PASS | did::LOOP), "new loop+pass");
    }

    /// Ten minutes of readings, 250 ms apart: 4 ms of jitter and 60 ppm of
    /// drift count nothing, nor one wild reading; 30 ms lost counts once; a
    /// jump forward counts nothing.
    #[test]
    fn the_playhead_counts_what_is_lost_and_not_jitter() {
        let mut p = Playhead::new();
        p.stream_began(0);
        for i in 1..2_400_i32 {
            let seconds = f64::from(i) * 0.25;
            let jitter = [0.0, 0.004, -0.004, 0.002][usize::try_from(i % 4).unwrap()];
            let mut played = seconds * (1.0 - 60e-6) + jitter;
            if i == 400 {
                played -= 0.2;
            }
            if i >= 1_000 {
                played -= 0.03;
            }
            if i >= 1_800 {
                played += 0.05;
            }
            p.read(i64::from(i) * 250_000_000, played);
        }
        assert_eq!(p.behind, 1);
        assert!((p.lost - 0.03).abs() < 0.008, "{}", p.lost);
    }
}
