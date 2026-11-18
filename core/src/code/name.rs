//! A name a code carries (session 23; Mikey, 2026-11-17: "a loop's name
//! should travel with its code", "all characters and emojis"): a renamed
//! loop's, a track's or an album's, in any script and with emoji, as its
//! UTF-8 bytes. The code itself stays the 64 link-safe characters: the bytes
//! are packed into them, eight bits a byte (`core/README.md`, "Share codes").
//!
//! **What a name may hold** is what reads as itself on any screen: no
//! controls, no format characters (direction overrides and isolates, the
//! invisible spaces and fillers), no separator but the plain space, no
//! private use. A combining mark (or a variation selector) only after a
//! visible character and at most `MARKS_MOST` in a row, so Thai's vowel and
//! tone marks and an emoji's selector pass and piled-up marks do not; a
//! joiner (ZWNJ, ZWJ) only between two visible characters, so an emoji's
//! sequence and a Persian word pass and a run of invisible joiners does
//! not; tag letters only in a flag's run (England's, Scotland's), ended by
//! its cancel tag. No space at either end, and never two in a row. The
//! classes are `classes.rs`, Unicode 17.0, written by
//! `tools/name-table.mjs` and frozen with the format.
//!
//! **The cap is `NAME_MOST` bytes:** sixty letters of English, twenty of
//! Thai, fifteen emoji; in a code about 1.3 characters an English letter,
//! 4 a Thai one. A loop with no name of its own carries none, and costs
//! nothing.

use super::{In, NOT_A_CODE, Out, classes};

/// The most bytes a name holds, in UTF-8.
pub const NAME_MOST: usize = 60;
/// The most combining marks (or variation selectors) in a row after one
/// character: Thai's two (a vowel and a tone), an emoji keycap's two, a
/// Hebrew letter's points, and no more.
pub const MARKS_MOST: usize = 4;
/// The most tag letters in a flag's run (a region's code is up to six).
pub const TAGS_MOST: usize = 8;
/// The line for a name a code can't carry: too long, or a character it
/// refuses (`Name::new`).
pub const BAD_NAME: &str = "a name a code can't carry";

/// The black flag a tag run follows.
const FLAG: u32 = 0x1F3F4;

/// A name: 1 to `NAME_MOST` bytes of UTF-8 that `Name::new` lets through,
/// or none.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Name {
    bytes: [u8; NAME_MOST],
    len: usize,
}

/// What a character is to a name (`classes.rs`), the plain space apart.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Class {
    Visible,
    Space,
    Mark,
    Join,
    Tag,
    Cancel,
    Refused,
}

fn class(c: char) -> Class {
    let c = u32::from(c);
    if c == 0x20 {
        return Class::Space;
    }
    let ranges = &classes::RANGES;
    // The last range starting at or before `c`.
    let at = ranges.partition_point(|r| r.0 <= c);
    let Some(&(_, end)) = at.checked_sub(1).and_then(|i| ranges.get(i)) else { return Class::Visible };
    if c > end & 0x00FF_FFFF {
        return Class::Visible;
    }
    match end & 0xFF00_0000 {
        classes::MARK => Class::Mark,
        classes::JOIN => Class::Join,
        classes::TAG => Class::Tag,
        classes::CANCEL => Class::Cancel,
        _ => Class::Refused,
    }
}

/// Where a name's walk is, after a character.
#[derive(Clone, Copy, PartialEq, Eq)]
enum After {
    Start,
    Space,
    /// A visible character (the black flag, which a tag run may follow).
    Visible { flag: bool },
    /// Marks after a visible character: how many.
    Marks(usize),
    Join,
    /// A flag's tag run: how many tags so far.
    Tags(usize),
}

/// Whether `text` is a name a code carries (the rules above).
fn fits(text: &str) -> bool {
    let mut after = After::Start;
    for c in text.chars() {
        after = match (class(c), after) {
            (Class::Tag, After::Visible { flag: true }) => After::Tags(1),
            (Class::Tag, After::Tags(n)) if n < TAGS_MOST => After::Tags(n + 1),
            (Class::Cancel, After::Tags(_)) => After::Visible { flag: false },
            (Class::Space, After::Visible { .. } | After::Marks(_)) => After::Space,
            (Class::Visible, After::Start | After::Space | After::Visible { .. } | After::Marks(_) | After::Join) => After::Visible { flag: u32::from(c) == FLAG },
            (Class::Mark, After::Visible { .. }) => After::Marks(1),
            (Class::Mark, After::Marks(n)) if n < MARKS_MOST => After::Marks(n + 1),
            (Class::Join, After::Visible { .. } | After::Marks(_)) => After::Join,
            // Anything refused; a tag run not ended by its cancel; a space,
            // a mark or a joiner out of place.
            _ => return false,
        };
    }
    matches!(after, After::Visible { .. } | After::Marks(_))
}

impl Name {
    /// No name.
    pub const NONE: Name = Name { bytes: [0; NAME_MOST], len: 0 };

    /// A name from its UTF-8 bytes (none for none).
    ///
    /// # Errors
    /// `BAD_NAME` for more than `NAME_MOST` bytes, bytes that are not UTF-8,
    /// or text the rules above refuse.
    pub fn new(text: &[u8]) -> Result<Self, &'static str> {
        if text.is_empty() {
            return Ok(Name::NONE);
        }
        if text.len() > NAME_MOST {
            return Err(BAD_NAME);
        }
        let ok = core::str::from_utf8(text).is_ok_and(fits);
        if !ok {
            return Err(BAD_NAME);
        }
        let mut n = Name::NONE;
        n.bytes[..text.len()].copy_from_slice(text);
        n.len = text.len();
        Ok(n)
    }

    /// The name's UTF-8 bytes (empty for none).
    #[must_use]
    pub fn text(&self) -> &[u8] {
        &self.bytes[..self.len]
    }

    /// Whether there is no name.
    #[must_use]
    pub const fn is_none(&self) -> bool {
        self.len == 0
    }

    /// Written: how many bytes, then the bytes, eight bits each packed six
    /// to a character, the first bit highest, the last character's spare
    /// bits 0.
    pub(super) fn write(&self, w: &mut Out) {
        w.uv(self.len as u64);
        let (mut acc, mut bits) = (0u32, 0);
        for &b in self.text() {
            acc = (acc << 8) | u32::from(b);
            bits += 8;
            while bits >= 6 {
                bits -= 6;
                #[allow(clippy::cast_possible_truncation)] // six bits
                w.put(((acc >> bits) & 63) as u8);
            }
            acc &= (1 << bits) - 1;
        }
        if bits > 0 {
            #[allow(clippy::cast_possible_truncation)] // six bits
            w.put(((acc << (6 - bits)) & 63) as u8);
        }
    }

    /// Read as `write` wrote it, and held to `new`'s rules: a name a code
    /// can't carry is no code's.
    pub(super) fn read(r: &mut In) -> Result<Self, &'static str> {
        let len = usize::try_from(r.below(NAME_MOST as u64 + 1)?).map_err(|_| NOT_A_CODE)?;
        if len == 0 {
            return Err(NOT_A_CODE);
        }
        let mut bytes = [0u8; NAME_MOST];
        let (mut acc, mut bits, mut n) = (0u32, 0, 0);
        while n < len {
            acc = (acc << 6) | u32::from(r.take()?);
            bits += 6;
            if bits >= 8 {
                bits -= 8;
                #[allow(clippy::cast_possible_truncation)] // eight bits
                {
                    bytes[n] = (acc >> bits) as u8;
                }
                n += 1;
                acc &= (1 << bits) - 1;
            }
        }
        if acc != 0 {
            return Err(NOT_A_CODE);
        }
        Name::new(&bytes[..len]).map_err(|_| NOT_A_CODE)
    }
}
