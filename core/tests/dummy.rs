//! Additions leave old codes as they sound, and what was taken out plays
//! something close (Mikey, 2026-11-10 and
//! 2026-11-17). Built with the `dummy` feature only (`cargo test --features
//! dummy --test dummy`, in the gate's core part): `build.rs` lays
//! `tests/dummy/*.txt` over `data/` (its README says what): a member of
//! each kind that joins at version 3, a setting drawn per loop and counted
//! against a loop's changes among them, a member of each kind taken out,
//! and fields that took more once. Every generation golden, written as a
//! version 2 code and read back, still makes its hashes bit for bit; a
//! version 3 loop draws each addition; a version 2 code that names one is
//! refused, and one that names what was taken out reads, and plays its
//! stand-in or goes without.
#![cfg(feature = "dummy")]

use dlcore::code::{self, ALPHABET, Loop, NEEDS_NEWER, NOT_A_CODE};
use dlcore::generator::request::Request;
use dlcore::generator::rng::Rng;
use dlcore::generator::{Generator, Layer, Part, canon, choices, data};

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
    assert_eq!(data::CODE_RELEASED, 2);
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
            let back = coded(&Loop { request, ..Loop::of(seed) });
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
        // Where each is seen: a part of what a loop generates, and its text.
        let draws: [(&str, Part, &str); 12] = [
            ("profile", Part::Spec, "dummyland"),
            ("mood", Part::Spec, "dummymood"),
            ("mode", Part::Spec, "dummymode"),
            ("bass style", Part::Meta, "dummystyle"),
            ("kit", Part::Meta, "dummykit"),
            ("bass voice", Part::Layer(Layer::Bass), "dummybass"),
            ("chords' voice", Part::Layer(Layer::Chords), "dummychords"),
            ("voice", Part::Meta, "dummyvoice"),
            ("texture", Part::Meta, "dummyair"),
            ("option", Part::Choices, "glass:\"dummy\""),
            ("choice", Part::Choices, "dummyAlone:\"on\""),
            ("word", Part::Load, "dummybell"),
                    ];
        let mut g = Box::new(Generator::new());
        let mut seen = [0; 12];
        let (mut setting, mut gave_way) = (0, 0);
        for seed in 0..300u32 {
            for version in [3, 2] {
                let l = coded(&Loop { request: Request::parse("bars=512").and_then(|r| r.with_version(version)).expect("a request"), ..Loop::of(seed) });
                g.load_with(l.seed, &l.request);
                if version == 2 {
                    for part in Part::ALL {
                        let text = text(&mut g, part);
                        assert!(!text.contains("dummy"), "{seed} {part:?}: a version 2 loop drew an addition: {text}");
                    }
                    // Nor in its piece: no related key is a later mode.
                    let mut map = Text(String::new());
                    g.form().expect("a long piece").write(&mut canon::Writer::new(&mut map));
                    assert!(!map.0.contains("dummy"), "{seed}: a version 2 piece went to a later mode: {}", map.0);
                    assert!(!choices::dummy_of(seed, l.request.pins(), 2), "{seed}: a setting drawn below its version");
                    continue;
                }
                for (n, &(_, part, find)) in seen.iter_mut().zip(draws.iter()) {
                    *n += usize::from(text(&mut g, part).contains(find));
                }
                if choices::dummy_of(seed, l.request.pins(), 3) {
                    setting += 1;
                    // Counted against its changes: held to today's it frees
                    // one for the list, where the list has one to give.
                    let changes = |g: &Generator| g.render().choices.iter().filter(|w| !w.get().is_empty() && w.get() != "today").count();
                    let with = changes(&g);
                    let off = Request::parse("bars=512,version=3,dummy.kind=today").expect("a pin");
                    g.load_with(seed, &off);
                    gave_way += usize::from(changes(&g) > with);
                }
            }
        }
        for ((what, _, _), n) in draws.iter().zip(seen) {
            assert!(n > 0, "no version 3 loop drew the dummy {what}");
        }
        assert!(setting > 0, "no version 3 loop drew the dummy setting");
        assert!(gave_way > 0, "the dummy setting was counted against no loop's changes");
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

/// A whole number as the format writes it.
fn uv(mut x: u64) -> String {
    let mut s = String::new();
    while x >= 32 {
        s.push(ALPHABET[usize::try_from(x & 31).expect("five bits") | 32] as char);
        x >>= 5;
    }
    s.push(ALPHABET[usize::try_from(x).expect("five bits")] as char);
    s
}

/// A decimal as the format writes it: `digits` and the power of ten.
fn dec(digits: i64, power: i64) -> String {
    let zigzag = |m: i64| ((m << 1) ^ (m >> 63)).cast_unsigned();
    format!("{}{}", uv(zigzag(digits)), uv(zigzag(power)))
}

/// A code at `version` of the loop of seed 5 holding `fields`, sealed with
/// its check.
fn sealed(version: u64, fields: &str) -> String {
    let mut out = [0u8; 64];
    let n = code::write_loop(&Loop::of(5), &mut out).expect("a code");
    let seed = core::str::from_utf8(&out[n - 8..n - 2]).expect("ASCII");
    let mut s = format!("{}{seed}{fields}", uv(version * 2));
    let h = s.bytes().fold(0u32, |h, c| (h * 64 + u32::try_from(ALPHABET.iter().position(|&a| a == c).expect("the alphabet")).expect("small") + 1) % 4093);
    s.push(ALPHABET[(h & 63) as usize] as char);
    s.push(ALPHABET[(h >> 6) as usize] as char);
    s
}

fn id(list: data::Ids, name: &str) -> String {
    uv(u64::from(list.iter().find(|e| e.0 == name).unwrap_or_else(|| panic!("no row: {name}")).1))
}

#[test]
fn a_version_2_code_naming_an_addition_is_refused() {
    let one = uv(1);
    let voice = |layer: u64, name: &str| format!("{}{}{one}{}", uv(11), uv(layer), id(data::CODE_VOICES[usize::try_from(layer).expect("a layer")], name));
    for fields in [
        format!("{}{}", uv(1), id(data::CODE_VIBES, "dummyvibe")),
        format!("{}{one}{}", uv(9), id(data::CODE_SCALES, "dummymode")),
        format!("{}{one}{}", uv(10), id(data::CODE_PROFILES, "dummyland")),
        voice(0, "dummykit"),
        voice(1, "dummybass"),
        voice(2, "dummychords"),
        voice(3, "dummyvoice"),
        voice(4, "dummyair"),
        format!("{}{}{}", uv(15), uv(0), id(data::options_of("glass"), "dummy")),
        format!("{}{}{}", uv(15), id(data::CODE_CHOICES, "dummyAlone"), uv(1)),
        format!("{}{}{}", uv(16), id(data::CODE_SETTINGS, "lowBell.kind"), id(data::words_of("lowBell.kind").expect("words"), "dummybell")),
        format!("{}{}{}", uv(16), id(data::CODE_SETTINGS, "dummy.kind"), uv(1)),
    ] {
        assert_eq!(code::read_loop(sealed(2, &fields).as_bytes()).err(), Some(NOT_A_CODE), "{fields}");
    }
}

/// What was taken out, as a version 2 code's fields name it, and the request
/// it reads as.
#[allow(clippy::too_many_lines)] // a kind at a time
fn taken_out() -> Vec<(&'static str, String, &'static str)> {
    let one = uv(1);
    let vibe = |name: &str| format!("{}{}", uv(1), id(data::CODE_VIBES, name));
    let weighed = |name: &str, tenths: i64| format!("{}{}{}", uv(2), id(data::CODE_VIBES, name), dec(tenths, -1));
    let mode = |name: &str| format!("{}{one}{}", uv(9), id(data::CODE_SCALES, name));
    let style = |name: &str| format!("{}{one}{}", uv(10), id(data::CODE_PROFILES, name));
    let journey = |name: &str| format!("{}{}", uv(7), id(data::CODE_JOURNEYS, name));
    let long = format!("{}{}", uv(5), uv(511));
    let voice = |layer: usize, name: &str| format!("{}{}{one}{}", uv(11), uv(layer as u64), id(data::CODE_VOICES[layer], name));
    let choice = |name: &str, option: &str| format!("{}{}{}", uv(15), id(data::CODE_CHOICES, name), id(data::options_of(name), option));
    let word = |name: &str, word: &str| format!("{}{}{}", uv(16), id(data::CODE_SETTINGS, name), id(data::words_of(name).expect("words"), word));
    let number = |name: &str, digits: i64, power: i64| format!("{}{}{}", uv(16), id(data::CODE_SETTINGS, name), dec(digits, power));
    vec![
        ("a vibe's stand-in", vibe("dummyfaded"), "mellow"),
        ("a vibe, without", vibe("dummylost"), ""),
        ("a vibe among others, without", vibe("cozy") + &vibe("dummylost"), "cozy"),
        ("a weighted vibe's stand-in", weighed("dummyfaded", 7), "mellow=0.7"),
        ("a stand-in yields to the vibe itself, after it", vibe("dummyfaded") + &weighed("mellow", 5), "mellow=0.5"),
        ("a stand-in yields to the vibe itself, before it", vibe("mellow") + &weighed("dummyfaded", 5), "mellow"),
        ("a mode's stand-in", mode("dummymajor"), "scale=ionian"),
        ("a mode, without", mode("dummyodd"), ""),
        ("a mode in a set, without", format!("{}{}{}{}", uv(9), uv(2), uv(0), uv(20)), "scale=dorian"),
        ("a style's stand-in", style("dummymoor"), "style=tide"),
        ("a style, without", style("dummyheath"), ""),
        ("a journey's stand-in", long.clone() + &journey("dummyroam"), "bars=512,journey=wander"),
        ("a journey, the piece's left to the generator", long.clone() + &journey("dummytour"), "bars=512"),
        ("a kit's stand-in", voice(0, "dummybroom"), "voice.drums=brush"),
        ("a bass's stand-in", voice(1, "dummytuba"), "voice.bass=round"),
        ("a chords' voice's stand-in", voice(2, "dummyzither"), "voice.chords=harp"),
        ("a tune's voice's stand-in", voice(3, "dummyreed"), "voice.melody=flute"),
        ("a voice, without", voice(3, "dummykazoo"), ""),
        ("a texture's stand-in", voice(4, "dummygale"), "voice.texture=wind"),
        ("an option's stand-in", choice("glass", "dummyshine"), "glass=on"),
        ("an option, its choice's today", choice("glass", "dummyclink"), "glass=today"),
        ("a choice's stand-in", choice("dummyWas", "on"), "organ=on"),
        ("a stand-in yields to the choice itself", choice("organ", "today") + &choice("dummyWas", "on"), "organ=today"),
        ("a choice, without", choice("dummyGone", "on"), ""),
        ("a word's stand-in", word("lowBell.kind", "dummyrung"), "lowBell.kind=swell"),
        ("a word, without", word("lowBell.kind", "dummyhum"), ""),
        ("twang's slow plays soft", word("twang.kind", "slow"), "twang.kind=soft"),
        ("twang's bright plays soft", word("twang.kind", "bright"), "twang.kind=soft"),
        ("a setting's stand-in, its word by name", word("dummy.oldBell", "struck"), "lowBell.kind=struck"),
        ("a setting of words, without", word("dummy.oldKind", "on"), ""),
        ("a setting's stand-in, its number", number("dummy.oldCents", -12, 0), "tuning.cents=-12"),
        ("a setting's stand-in, the nearest number", number("dummy.oldCents", 44, 0), "tuning.cents=35"),
        ("a stand-in yields to the setting itself", number("tuning.cents", 5, 0) + &number("dummy.oldCents", 44, 0), "tuning.cents=5"),
        ("a setting of numbers, without", number("dummy.oldSize", 7, 0), ""),
        ("a tempo past the range", format!("{}{}", uv(3), uv(210 - 32)), "bpm=190"),
        ("a tempo's range past the range", format!("{}{}{}", uv(4), uv(180 - 32), uv(29)), "bpm=180-190"),
        ("the slider's tempo past the range", format!("{}{}", uv(19), dec(2005, -1)), "edit.bpm=190"),
        ("a tone past the range", format!("{}{}{}", uv(18), uv(0), dec(15, -1)), "edit.warmth=1"),
        ("a setting past its range", number("tuning.cents", -48, 0), "tuning.cents=-35"),
        ("a whole setting past its range", number("kick.note", 4, 1), "kick.note=38"),
        ("a number the list lost", number("echo.beats", 12, -1), "echo.beats=1"),
    ]
}

#[test]
fn a_version_2_code_naming_what_was_taken_out_plays_something_close() {
    roomy(|| {
        let (mut g, mut want) = (Box::new(Generator::new()), Box::new(Generator::new()));
        for (what, fields, asks) in taken_out() {
            let code = sealed(2, &fields);
            let back = code::read_loop(code.as_bytes()).unwrap_or_else(|e| panic!("{what}: {e}"));
            let text = if asks.is_empty() { "version=2".to_string() } else { format!("{asks},version=2") };
            let request = Request::parse(&text).unwrap_or_else(|e| panic!("{what}: {text}: {e}"));
            // The request it stands for: the same code, and the same loop,
            // with no note lost.
            let mut out = [[0u8; 128]; 2];
            let [got, hoped] = &mut out;
            let n = code::write_loop(&back, got).unwrap_or_else(|e| panic!("{what}: written again: {e}"));
            let m = code::write_loop(&Loop { request, ..Loop::of(5) }, hoped).expect("a code");
            assert_eq!(&got[..n], &hoped[..m], "{what}: reads as {text}");
            g.load_with(back.seed, &back.request);
            want.load_with(5, &request);
            for part in Part::ALL {
                assert_eq!(g.hash(part), want.hash(part), "{what}: {part:?}");
            }
            assert_eq!(g.lost(), 0, "{what}");
            // It reads the same in a code of the version now open, and in an
            // album: a track's, and the picks of one from one seed.
            let open = code::read_loop(sealed(3, &fields).as_bytes()).unwrap_or_else(|e| panic!("{what} at 3: {e}"));
            assert_eq!(open.request.version(), 3);
            let mut album = [0u8; 256];
            let n = code::write_album([(code.as_bytes(), code::Pace::On)].into_iter(), &code::Name::NONE, &mut album).expect("an album");
            assert_eq!(code::read_album(&album[..n]).map(|a| a.count), Ok(1), "{what}");
        }
    });
}

#[test]
fn an_id_with_no_row_is_a_newer_builds() {
    let one = uv(1);
    let none = uv(999);
    for fields in [
        format!("{}{none}", uv(1)),
        format!("{}{none}", uv(7)),
        format!("{}{one}{none}", uv(9)),
        format!("{}{one}{none}", uv(10)),
        format!("{}{}{one}{none}", uv(11), uv(3)),
        format!("{}{none}{one}", uv(15)),
        format!("{}{}{none}", uv(15), uv(0)),
        format!("{}{none}{one}", uv(16)),
        format!("{}{}{none}", uv(16), uv(22)),
        format!("{}{}", uv(1), uv(1 << 40)),
    ] {
        // At the version still open, which newer builds share; a released
        // version's ids are all here.
        assert_eq!(code::read_loop(sealed(3, &fields).as_bytes()).err(), Some(NEEDS_NEWER), "{fields}");
        assert_eq!(code::read_loop(sealed(2, &fields).as_bytes()).err(), Some(NOT_A_CODE), "{fields}");
    }
    assert_eq!(code::read_loop(sealed(4, "").as_bytes()).err(), Some(NEEDS_NEWER));
}

#[test]
fn a_number_no_build_wrote_is_no_code() {
    let setting = |name: &str, digits: i64, power: i64| format!("{}{}{}", uv(16), id(data::CODE_SETTINGS, name), dec(digits, power));
    for fields in [
        format!("{}{}", uv(3), uv(221 - 32)),
        format!("{}{}{}", uv(4), uv(0), uv(u64::MAX)),
        format!("{}{}", uv(19), dec(31, 0)),
        format!("{}{}{}", uv(18), uv(0), dec(21, -1)),
        setting("tuning.cents", 51, 0),
        setting("kick.note", 395, -1),
        setting("echo.beats", 13, -1),
        setting("dummy.oldSize", 25, -1),
        setting("dummy.oldCents", 51, 0),
    ] {
        assert_eq!(code::read_loop(sealed(2, &fields).as_bytes()).err(), Some(NOT_A_CODE), "{fields}");
    }
}

#[test]
fn codes_of_anything_never_panic() {
    roomy(|| {
        let mut r = Rng::new(0x2405);
        let mut g = Box::new(Generator::new());
        let mut bodies: Vec<String> = taken_out().into_iter().map(|(_, fields, _)| fields).collect();
        // Every tag, with any ids and numbers after it, the small ones (the
        // rows') most often.
        for _ in 0..60_000 {
            let mut fields = uv(u64::try_from(r.pick_index(32)).expect("small"));
            for _ in 0..r.pick_index(6) {
                let most = [4, 8, 24, 72, 92, 1 << 16][r.pick_index(6)];
                fields += &uv(u64::try_from(r.pick_index(most)).expect("small"));
            }
            bodies.push(fields);
        }
        // And those that name what was taken out, a character changed.
        for (_, fields, _) in taken_out() {
            for i in 0..fields.len() {
                for &c in ALPHABET {
                    let mut b = fields.as_bytes().to_vec();
                    b[i] = c;
                    bodies.push(String::from_utf8(b).expect("ASCII"));
                }
            }
        }
        let (mut read, mut made) = (0, 0);
        for fields in &bodies {
            for version in [2, 3] {
                let code = sealed(version, fields);
                let _ = code::read_album(code.as_bytes());
                let Ok(l) = code::read_loop(code.as_bytes()) else { continue };
                read += 1;
                let mut out = [0u8; 256];
                code::write_loop(&l, &mut out).unwrap_or_else(|e| panic!("{code}: read, then {e}"));
                if read % 16 == 0 {
                    g.load_with(l.seed, &l.request);
                    assert_eq!(g.lost(), 0, "{code}");
                    made += 1;
                }
            }
        }
        assert!(read > 2000 && made > 100, "{read} read, {made} made");
    });
}
