//! What the player tells a host about where the loop is (queue item 94a):
//! events (0 to 9), each at the time on the core's clock it is heard, so a host can
//! draw the cursor, the pass, the phrase lines and a piece's sections as the
//! music reaches them, with nothing of its own deciding when.
//!
//! **Decided ahead, heard later.** An event is made when the player decides
//! its step, up to `LOOKAHEAD` before it sounds (a change's boundary, up to
//! `Player::lead`), and carries the time it is heard. A host takes them as
//! they come (`Player::event`, after each render) and shows each at its time:
//! the app's page queues them against the audio clock, as it queues the
//! steps it decides today. They never change what plays.
//!
//! **Fixed room.** The events wait in a ring of `EVENTS_MAX`, taken oldest
//! first; a host that leaves them longer than that loses the newest
//! (`Player::events_lost` counts them), and nothing else. A step is a tenth of
//! a second or so, so the ring holds some twenty seconds of a busy loop.

use crate::generator::list::Empty;

/// How many events wait for the host at most.
pub const EVENTS_MAX: usize = 256;

/// What an event says. The numbers hosts know them by are their places here
/// (0 to 9).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum Kind {
    /// A step: `number` is the step in its pass (in a piece, in its
    /// section). First, so that an empty event is all zero bytes.
    Step = 0,
    /// A pass of the loop begins (a loop's own; in a piece, a round of all
    /// its sections): `number` is the pass, from the loop's first (0).
    Pass = 1,
    /// A section of a piece begins (queue item 88): `number` is the
    /// section, from the piece's first (0). A loop with no length asked has
    /// none.
    Section = 2,
    /// A phrase line (`Moment::Phrase`'s grid; the length slider's lines
    /// inside a pass): `number` is the step in its pass.
    Phrase = 3,
    /// A new loop takes its first step: `number` is its seed.
    Loop = 4,
    /// The loop playing, made again in its place (`Player::revise`, a layer
    /// re-rolled): `number` is its seed; the steps go on from where they
    /// were.
    Revised = 5,
    /// The track ends (`Player::set_track`): the length the host set has
    /// run. `number` is 0. If a change waits for it (`Moment::End`), its
    /// loop starts here; if not, the loop plays on.
    End = 6,
    /// The loop whose `Loop` comes next, at the same time, is one the core
    /// made itself (queue item 95: `Player::next`, or a track's end with
    /// nothing waiting for it): its seed drawn from the host's
    /// (`Player::set_draws`), with the picks the host numbered `number`
    /// (`Player::set_picks`), so the host knows which loop it is.
    Own = 7,
    /// The loop playing goes on from somewhere else in it (session 17,
    /// `Player::jump`): `number` and `step` are the step it goes on from,
    /// from the load (a piece's from its start); its section, phrase and
    /// steps follow as they come.
    Jump = 8,
    /// What each layer sounded on a step, as heard (session 30b, queue item
    /// 110), made as the step is decided and at its time: `number` holds the
    /// five layers, in `LAYERS`' order, `HEARD_BITS` each from the lowest
    /// (`pack_heard`, `unpack_heard`): the loudest note's velocity as heard
    /// (times the share of its level a long piece's plan leaves its
    /// channel; 0 for none, a note refused, muted or left out), and that
    /// share, the late floor's rise in it; `step` is the step from the load.
    /// The layers draw a note when and as loud as it is heard.
    Heard = 9,
}

/// How many bits each layer takes in a `Kind::Heard` event's number (five
/// layers in 50, so the number is exact as a double, as the page reads it):
/// its loudness in the low `LOUD_BITS`, to a step of `1 / HEARD_ONE` (an
/// accent's 2 at most), and its share in the rest, to a seventh.
pub const HEARD_BITS: u32 = 10;
pub const LOUD_BITS: u32 = 7;
pub const HEARD_ONE: f64 = 64.0;
const SHARE_MOST: f64 = 7.0;

/// Five layers' loudness and share as a `Kind::Heard` event's number.
#[must_use]
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)] // clamped to the field first
pub fn pack_heard(loud: &[f64; 5], share: &[f64; 5]) -> u64 {
    let most = f64::from((1u32 << LOUD_BITS) - 1);
    let q = |x: f64, one: f64, top: f64| if x > 0.0 { crate::math::round(x * one).clamp(0.0, top) as u64 } else { 0 };
    (0..5).fold(0, |n, i| {
        let field = q(loud[i], HEARD_ONE, most) | (q(share[i], SHARE_MOST, SHARE_MOST) << LOUD_BITS);
        n | (field << (HEARD_BITS * i as u32))
    })
}

/// A `Kind::Heard` event's number as the five layers' loudness and share.
#[must_use]
#[allow(clippy::cast_precision_loss, clippy::cast_possible_truncation)] // ten bits a layer, five layers
pub fn unpack_heard(number: u64) -> ([f64; 5], [f64; 5]) {
    let field = |i: usize| (number >> (HEARD_BITS * i as u32)) & ((1 << HEARD_BITS) - 1);
    let loud = core::array::from_fn(|i| (field(i) & ((1 << LOUD_BITS) - 1)) as f64 / HEARD_ONE);
    let share = core::array::from_fn(|i| (field(i) >> LOUD_BITS) as f64 / SHARE_MOST);
    (loud, share)
}

impl Kind {
    /// Every kind, in the hosts' numbering.
    pub const ALL: [Kind; 10] = [Kind::Step, Kind::Pass, Kind::Section, Kind::Phrase, Kind::Loop, Kind::Revised, Kind::End, Kind::Own, Kind::Jump, Kind::Heard];
}

/// An event: what it says, when it is heard, and where the loop is then.
#[derive(Clone, Copy, PartialEq, Debug)]
pub struct Event {
    /// When it is heard, in seconds on the core's clock.
    pub time: f64,
    /// What it says.
    pub kind: Kind,
    /// Its number (`Kind` says what it counts).
    pub number: u64,
    /// The step it falls on, from the loop's load (it never resets in a
    /// loop: a re-roll keeps it).
    pub step: u64,
}

impl Empty for Event {
    const EMPTY: Self = Event { time: 0.0, kind: Kind::Step, number: 0, step: 0 };
}

/// The events waiting for the host: a ring, oldest first.
pub struct Events {
    ring: [Event; EVENTS_MAX],
    head: usize,
    len: usize,
    lost: u32,
}

impl Events {
    /// None waiting. All zero bytes, as the player's start must be.
    #[must_use]
    pub const fn new() -> Self {
        Events { ring: [Event::EMPTY; EVENTS_MAX], head: 0, len: 0, lost: 0 }
    }

    /// Add one; with the ring full it is lost and counted.
    pub fn push(&mut self, event: Event) {
        if self.len >= EVENTS_MAX {
            self.lost = self.lost.saturating_add(1);
            return;
        }
        let at = (self.head + self.len) % EVENTS_MAX;
        if let Some(slot) = self.ring.get_mut(at) {
            *slot = event;
            self.len += 1;
        }
    }

    /// Take the oldest.
    pub fn pop(&mut self) -> Option<Event> {
        if self.len == 0 {
            return None;
        }
        let e = self.ring.get(self.head).copied();
        self.head = (self.head + 1) % EVENTS_MAX;
        self.len -= 1;
        e
    }

    /// How many wait.
    #[must_use]
    pub fn len(&self) -> usize {
        self.len
    }

    /// Whether none wait.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    /// How many were lost for want of room since the player started.
    #[must_use]
    pub fn lost(&self) -> u32 {
        self.lost
    }

    /// Forget every event waiting (a player started again).
    pub fn clear(&mut self) {
        self.head = 0;
        self.len = 0;
    }
}

impl Default for Events {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(t: f64) -> Event {
        Event { time: t, kind: Kind::Step, number: 0, step: 0 }
    }

    #[test]
    fn the_ring_keeps_its_order_and_counts_what_it_loses() {
        let mut e = Events::new();
        assert!(e.pop().is_none());
        for i in 0..EVENTS_MAX + 3 {
            e.push(at(f64::from(u32::try_from(i).unwrap_or(0))));
        }
        assert_eq!((e.len(), e.lost()), (EVENTS_MAX, 3));
        assert_eq!(e.pop().map(|x| x.time), Some(0.0));
        e.push(at(1000.0));
        let mut last = None;
        while let Some(x) = e.pop() {
            last = Some(x.time);
        }
        assert_eq!(last, Some(1000.0));
        assert!(e.is_empty());
        assert_eq!(Kind::ALL[6], Kind::End);
        assert_eq!(Kind::ALL[9] as u8, 9);
    }

    #[test]
    fn heard_packs_five_layers_into_a_number_a_double_holds() {
        let loud = [0.0, 0.5, 1.0, 1.98, 0.3];
        let share = [0.0, 1.0, 0.5, 1.0, 0.3];
        let n = pack_heard(&loud, &share);
        assert!(n < 1 << 53, "exact as a double");
        let (l, s) = unpack_heard(n);
        for (a, b) in loud.iter().zip(l) {
            assert!((a - b).abs() <= 0.5 / HEARD_ONE, "{a} {b}");
        }
        for (a, b) in share.iter().zip(s) {
            assert!((a - b).abs() <= 0.5 / SHARE_MOST, "{a} {b}");
        }
        let (l, s) = unpack_heard(pack_heard(&[3.0, -1.0, f64::NAN, 0.0, 0.0], &[2.0, 1.0, 1.0, f64::NAN, -1.0]));
        assert_eq!(l, [127.0 / HEARD_ONE, 0.0, 0.0, 0.0, 0.0]);
        assert_eq!(s, [1.0, 1.0, 1.0, 0.0, 0.0]);
    }
}
