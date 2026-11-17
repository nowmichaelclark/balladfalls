//! Additions leave old codes as they sound (queue item 105; Mikey,
//! 2026-11-10). Built with the `dummy` feature only (`cargo test --features
//! dummy --test dummy`, in the gate's core part): `build.rs` lays
//! `tests/dummy/*.txt` over `data/`, a profile, a voice, a vibe, a mood, an
//! option and a choice drawn alone (one that counts as a change) that all
//! join at version 3. Every generation golden, written as a version 2 code
//! and read back, still makes its hashes bit for bit, while a version 3 loop
//! draws each addition, and a version 2 code that names one is refused.
#![cfg(feature = "dummy")]

use dlcore::code::{self, Loop, NOT_A_CODE};
use dlcore::generator::request::Request;
use dlcore::generator::{Generator, Part, canon, data};

fn roomy(f: impl FnOnce() + Send + 'static) {
    std::thread::Builder::new().stack_size(64 << 20).spawn(f).expect("a thread").join().expect("the test");
}

struct Text(String);

impl canon::Sink for Text {
    fn bytes(&mut self, b: &[u8]) {
        self.0.push_str(std::str::from_utf8(b).expect("ASCII"));
    }
}

fn text(g: &mut Generator, part: Part) -> String {
    let mut t = Text(String::new());
    g.write(part, &mut t);
    t.0
}

fn coded(l: &Loop) -> Loop {
    let mut out = [0u8; code::LOOP_MOST];
    let n = code::write_loop(l, &mut out).expect("a code");
    code::read_loop(&out[..n]).expect("read back")
}

#[test]
fn the_additions_are_at_version_3() {
    assert_eq!(data::CODE_NEWEST, 3);
    assert!(data::vibe_index("dummyvibe").is_some());
    assert!(data::character_index("dummyland").is_some());
}

#[test]
fn every_golden_as_a_version_2_code_is_as_it_was() {
    roomy(|| {
        let goldens = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/golden/generation.hashes")).expect("the goldens");
        let mut g = Box::new(Generator::new());
        let mut cases = 0;
        for line in goldens.lines().filter(|l| !l.is_empty() && !l.starts_with('#')) {
            let fields: Vec<&str> = line.split(' ').collect();
            let seed: u32 = fields[1].parse().expect("a seed");
            let request = Request::parse(fields[2]).and_then(|r| r.with_version(2)).expect("a request");
            let back = coded(&Loop { seed, request, mutes: 0, salt: 0 });
            assert_eq!(back.request.version(), 2);
            g.load_with(back.seed, &back.request);
            for part in Part::ALL {
                let want = part.in_line(line).expect("the part's hash");
                assert_eq!(format!("{:016x}", g.hash(part)), want, "{} {part:?}", fields[0]);
            }
            assert_eq!(g.lost(), 0, "{}", fields[0]);
            cases += 1;
        }
        assert_eq!(cases, 5139);
    });
}

#[test]
fn a_version_3_loop_draws_each_addition() {
    roomy(|| {
        let mut g = Box::new(Generator::new());
        let (mut profile, mut voice, mut mood, mut option, mut alone) = (0, 0, 0, 0, 0);
        let mut older = 0;
        for seed in 0..300u32 {
            for version in [3, 2] {
                let l = coded(&Loop { request: Request::new().with_version(version).expect("a version"), ..Loop::of(seed) });
                g.load_with(l.seed, &l.request);
                let spec = text(&mut g, Part::Spec);
                let meta = text(&mut g, Part::Meta);
                let choices = text(&mut g, Part::Choices);
                let found = [
                    spec.contains("dummyland"),
                    meta.contains("dummyvoice"),
                    spec.contains("dummymood"),
                    choices.contains("glass:\"dummy\""),
                    choices.contains("dummyAlone:\"on\""),
                ];
                if version == 3 {
                    for (n, f) in [&mut profile, &mut voice, &mut mood, &mut option, &mut alone].into_iter().zip(found) {
                        *n += usize::from(f);
                    }
                } else {
                    older += found.iter().filter(|&&f| f).count();
                    assert!(!choices.contains("dummyAlone"), "{seed}: a version 2 loop's choices name a later one");
                }
            }
        }
        assert_eq!(older, 0, "a version 2 loop drew an addition");
        for (what, n) in [("profile", profile), ("voice", voice), ("mood", mood), ("option", option), ("choice", alone)] {
            assert!(n > 0, "no version 3 loop drew the dummy {what}");
        }
        // The vibe: asked at version 3, it round-trips; a version 2 code
        // can't name it, and a request at version 2 that asks it is refused.
        let i = data::vibe_index("dummyvibe").expect("the vibe");
        let l = coded(&Loop { request: Request::new().with(i), ..Loop::of(5) });
        assert_eq!(l.request.vibe(i), Some(None));
        assert_eq!(l.request.version(), 3);
        let mut out = [0u8; 64];
        let at_2 = Loop { request: Request::new().with(i).with_version(2).expect("a version"), ..Loop::of(5) };
        assert_eq!(code::write_loop(&at_2, &mut out).err(), Some(code::NOT_AT_VERSION));
    });
}

#[test]
fn a_version_2_code_naming_an_addition_is_refused() {
    // A version 3 code naming the vibe, its head changed to version 2 and
    // sealed again: no code's (version 2 never had it).
    let i = data::vibe_index("dummyvibe").expect("the vibe");
    let mut out = [0u8; 64];
    let n = code::write_loop(&Loop { request: Request::new().with(i), ..Loop::of(5) }, &mut out).expect("a code");
    let mut chars: Vec<u8> = out[..n - 2].to_vec();
    chars[0] = b'E';
    let value = |c: u8| u32::try_from(code::ALPHABET.iter().position(|&a| a == c).expect("the alphabet")).expect("small");
    let h = chars.iter().fold(0u32, |h, &c| (h * 64 + value(c) + 1) % 4093);
    chars.push(code::ALPHABET[(h & 63) as usize]);
    chars.push(code::ALPHABET[(h >> 6) as usize]);
    assert_eq!(code::read_loop(&chars).err(), Some(NOT_A_CODE));
}
