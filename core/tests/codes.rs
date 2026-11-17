//! Share codes, version 2 (queue item 105; `dlcore::code`): every name a
//! code carries has its id and version (`data/codes.txt`); every part of a
//! request, every length, journey and edit round-trips, text and sound (a
//! walk of the request's whole list, as the pins' test walks them, and a few
//! thousand random requests); every generation golden's case written as a
//! code and read back generates its same hashes; codes from a newer build,
//! or naming what this build lacks, are refused plainly; and corrupt or
//! truncated codes never panic. The dummy build's test (`tests/dummy.rs`)
//! holds the version rule: what joins later moves no older code.

use dlcore::code::{self, ALPHABET, Album, Kind, Loop, NEEDS_NEWER, NOT_A_CODE, Title};
use dlcore::generator::data::{self, CHARACTERS, CHOICES, Ids, MOODS, VIBES};
use dlcore::generator::request::{self, Journey, LAYER_NAMES, LENGTH_MOST, LayerAsk, Length, PROFILE_ORDER, Pins, Request, VOICE_ORDER};
use dlcore::generator::rng::{Rng, seed_name};
use dlcore::generator::theory::SCALES;
use dlcore::generator::{Generator, Part};
use dlcore::space;

/// Run `f` on a thread with room for the generator's frames.
fn roomy(f: impl FnOnce() + Send + 'static) {
    std::thread::Builder::new().stack_size(64 << 20).spawn(f).expect("a thread").join().expect("the test");
}

fn write(l: &Loop) -> String {
    let mut out = [0u8; code::LOOP_MOST];
    let n = code::write_loop(l, &mut out).expect("a code");
    String::from_utf8(out[..n].to_vec()).expect("ASCII")
}

/// Every part's hash of the loop `l` generates.
fn hashes(g: &mut Generator, l: &Loop) -> Vec<u64> {
    g.load_with(l.seed, &l.request);
    Part::ALL.iter().map(|&p| g.hash(p)).collect()
}

/// `l` written, read back, written again: the same code, the same mutes and
/// salt, and (where `g` is given) the same loop generated.
fn round_trip(g: Option<&mut Generator>, l: &Loop) -> String {
    let text = write(l);
    assert!(text.bytes().all(|b| ALPHABET.contains(&b)), "{text}: the alphabet only");
    let back = code::read_loop(text.as_bytes()).unwrap_or_else(|e| panic!("{text}: {e}"));
    assert_eq!(write(&back), text, "read and written again");
    assert_eq!((back.seed, back.mutes, back.salt), (l.seed, l.mutes, l.salt), "{text}");
    assert_eq!(back.request.version(), data::CODE_NEWEST, "{text}: a code's loop is drawn at its version");
    if let Some(g) = g {
        let want = hashes(g, l);
        assert_eq!(hashes(g, &back), want, "{text}: the loop it plays");
    }
    text
}

fn asked(r: Result<Request, &'static str>) -> Loop {
    Loop { request: r.expect("a request"), ..Loop::of(20_261_009) }
}

// -------------------------------------------------------------- the ids

/// `names` each have one row in `list`, and `list` names nothing else.
fn covers(what: &str, list: Ids, names: &[&str]) {
    for n in names {
        assert!(list.iter().any(|e| e.0 == *n), "{what}: '{n}' has no row in data/codes.txt");
    }
    for e in list {
        assert!(names.contains(&e.0), "{what}: data/codes.txt names '{}', which is none", e.0);
    }
}

#[test]
fn every_member_has_an_id_and_a_version() {
    covers("vibes", data::CODE_VIBES, &VIBES.iter().map(|v| v.id).collect::<Vec<_>>());
    covers("profiles", data::CODE_PROFILES, &CHARACTERS.iter().map(|c| c.id).collect::<Vec<_>>());
    for p in PROFILE_ORDER {
        assert!(data::CODE_PROFILES.iter().any(|e| e.0 == p), "{p}");
    }
    covers("moods", data::CODE_MOODS, &MOODS.iter().map(|m| m.id).collect::<Vec<_>>());
    covers("modes", data::CODE_SCALES, &SCALES.iter().map(|s| s.id).collect::<Vec<_>>());
    covers("layers", data::CODE_LAYERS, &LAYER_NAMES);
    covers("journeys", data::CODE_JOURNEYS, &[Journey::Arc.name(), Journey::Wander.name()]);
    covers("tones", data::CODE_TONES, &request::TONE_NAMES);
    covers("choices", data::CODE_CHOICES, &CHOICES.iter().map(|c| c.id).collect::<Vec<_>>());
    for c in CHOICES {
        let list = data::CODE_OPTIONS.iter().find(|e| e.0 == c.id).map(|e| e.1).unwrap_or_else(|| panic!("{}: no [options]", c.id));
        covers(c.id, list, &c.options.iter().map(|o| o.0).collect::<Vec<_>>());
    }
    assert_eq!(data::CODE_OPTIONS.len(), CHOICES.len(), "an [options] block for no choice");
    // The settings a pin names, and each setting's words.
    let mut settings = Vec::new();
    let mut worded = Vec::new();
    for number in request::CHOICE_PINS..request::PINS_MAX {
        let Some((prefix, name)) = Pins::name(number) else { continue };
        let full: &'static str = Box::leak(format!("{prefix}{name}").into_boxed_str());
        settings.push(full);
        if let Some(words) = Pins::words(number) {
            let list = data::CODE_WORDS.iter().find(|e| e.0 == full).map(|e| e.1).unwrap_or_else(|| panic!("{full}: no [words]"));
            covers(full, list, &words.iter().map(|w| w.0).collect::<Vec<_>>());
            worded.push(full);
        }
    }
    covers("settings", data::CODE_SETTINGS, &settings);
    assert_eq!(data::CODE_WORDS.len(), worded.len(), "a [words] block for no setting of words");
    assert_eq!(settings.len(), request::SETTINGS.len() + space::n::COUNT);
    // Each layer's voices: everything a request can ask, and every name a
    // profile's pool draws from.
    let pools: [fn(&data::Character) -> Option<data::Pool>; 5] = [|c| c.kits, |c| c.bass_voices, |c| c.chord_voices, |c| c.melody_voices, |c| c.textures];
    for (layer, list) in data::CODE_VOICES.iter().enumerate() {
        for v in VOICE_ORDER[layer] {
            assert!(list.iter().any(|e| e.0 == *v), "{}: '{v}' has no row", LAYER_NAMES[layer]);
        }
        for c in &CHARACTERS {
            for (name, _) in pools[layer](c).unwrap_or(&[]) {
                assert!(list.iter().any(|e| e.0 == *name), "{}: '{name}' ({}) has no row", LAYER_NAMES[layer], c.id);
            }
        }
    }
    for c in &CHARACTERS {
        for (name, _) in c.bass_styles.unwrap_or(&[]) {
            assert!(data::CODE_BASS_STYLES.iter().any(|e| e.0 == *name), "bass style '{name}' has no row");
        }
    }
    // Every id below 2^32 and every version from 2 to the newest (build.rs
    // holds them once each).
    assert!(data::CODE_NEWEST >= request::FIRST_VERSION);
}

#[test]
fn ids_today_are_the_old_numbers() {
    // The first ids were given in today's orders, so a host that numbered
    // them by place still names the same thing (they are frozen from here).
    for (i, v) in VIBES.iter().enumerate() {
        assert_eq!(data::CODE_VIBES.iter().find(|e| e.0 == v.id).map(|e| e.1), Some(u32::try_from(i).unwrap()), "{}", v.id);
    }
    for (i, c) in CHOICES.iter().enumerate() {
        assert_eq!(data::CODE_CHOICES.iter().find(|e| e.0 == c.id).map(|e| e.1), Some(u32::try_from(i).unwrap()), "{}", c.id);
    }
}

// ------------------------------------------------------- short and plain

#[test]
fn a_loop_with_nothing_asked_is_nine_characters() {
    for seed in [0, 1, 20_261_009, u32::MAX] {
        let text = round_trip(None, &Loop::of(seed));
        assert_eq!(text.len(), 9, "{text}");
        assert_eq!(code::kind(text.as_bytes()), Some(Kind::Loop));
    }
    // A loop with a few picks, as a listener makes one, still under 20.
    let picks = Request::parse("glacial,cozy,bars=64,bpm=72").expect("picks");
    let text = round_trip(None, &Loop { request: picks, ..Loop::of(4_000_000_000) });
    assert!(text.len() < 20, "{text}: {} characters", text.len());
}

#[test]
fn the_charters_lengths() {
    // Promise 11: up to 32 bars, one character; up to 1,024, two; up to
    // 32,768, three (beside the field's own character).
    for (bars, chars) in [(1.0, 1), (32.0, 1), (33.0, 2), (1024.0, 2), (1025.0, 3), (32768.0, 3)] {
        let l = asked(Request::new().with_length(Length::Bars(bars)));
        let text = write(&l);
        assert_eq!(text.len(), 9 + 1 + chars, "{bars} bars: {text}");
    }
    assert_eq!(write(&asked(Request::new().with_length(Length::Endless))).len(), 10);
}

// ------------------------------------------------------- the whole list

#[test]
fn every_part_of_a_request_round_trips() {
    roomy(walk);
}

#[allow(clippy::too_many_lines)] // the request's whole list, item by item
fn walk() {
    let mut g = Box::new(Generator::new());
    let g = &mut *g;
    let mut n = 0;
    let mut check = |g: &mut Generator, l: Loop| {
        round_trip(Some(g), &l);
        n += 1;
    };
    // Every vibe, without a weight and with one.
    for i in 0..data::VIBE_COUNT {
        check(g, asked(Ok(Request::new().with(i))));
        check(g, asked(Request::new().with_weight(i, 0.35)));
    }
    check(g, asked(Request::parse("glacial=0,cozy=2.5,misty=0.123456789")));
    // The tempo, pinned and a range, at both ends.
    for (lo, hi) in [(32.0, 32.0), (190.0, 190.0), (70.0, 85.0), (32.0, 190.0)] {
        check(g, asked(Request::new().with_tempo(lo, hi)));
    }
    // Every length kind, and the journeys.
    for bars in [1.0, 4.0, 31.0, 32.0, 33.0, 1024.0, 32_768.0, 3072.0, LENGTH_MOST] {
        check(g, asked(Request::new().with_length(Length::Bars(bars))));
    }
    check(g, asked(Request::new().with_length(Length::Endless)));
    for j in [Journey::Arc, Journey::Wander] {
        check(g, asked(Request::new().with_length(Length::Endless).map(|r| r.with_journey(j))));
        check(g, asked(Ok(Request::new().with_journey(j))));
    }
    // Every key, every mode, every style, alone and all at once.
    for k in 0..12 {
        check(g, asked(Request::new().with_keys(1 << k)));
    }
    check(g, asked(Request::new().with_keys(request::KEYS_ALL)));
    for s in 0..SCALES.len() {
        check(g, asked(Request::new().with_scales(1 << s)));
    }
    check(g, asked(Request::new().with_scales(request::SCALES_ALL)));
    for s in 0..PROFILE_ORDER.len() {
        check(g, asked(Request::new().with_styles(1 << s)));
    }
    check(g, asked(Request::new().with_styles(request::STYLES_ALL)));
    // Every layer's every voice, and each layer on and off.
    for (layer, voices) in VOICE_ORDER.iter().enumerate() {
        for v in 0..voices.len() {
            check(g, asked(Request::new().with_voices(layer, 1 << v)));
        }
        check(g, asked(Request::new().with_voices(layer, (1 << voices.len()) - 1)));
        for ask in [LayerAsk::On, LayerAsk::Off] {
            check(g, asked(Request::new().with_layer(layer, ask)));
        }
    }
    check(g, asked(Request::parse("layer.drums=on,layer.bass=off,layer.melody=on,layer.texture=off")));
    // A theme.
    check(g, asked(Ok(Request::new().with_theme(123_456_789))));
    check(g, asked(Ok(Request::new().with_theme(0))));
    // Every pin: each choice at each option, each setting at each word, or
    // at both ends of its range and between, or at each number it takes.
    for number in 0..request::PINS_MAX {
        if Pins::name(number).is_none() {
            continue;
        }
        if let Some(words) = Pins::words(number) {
            for w in 0..words.len() {
                #[allow(clippy::cast_precision_loss)] // a word's place
                check(g, asked(Request::new().with_pin(number, w as f64)));
            }
        } else if let Some(values) = Pins::values(number) {
            for &(x, _) in values {
                check(g, asked(Request::new().with_pin(number, x)));
            }
        } else if let Some(([lo, hi], whole)) = Pins::range(number) {
            let mid = if whole { ((lo + hi) / 2.0).floor() } else { lo + (hi - lo) * 0.37 };
            for x in [lo, hi, mid] {
                check(g, asked(Request::new().with_pin(number, x)));
            }
        } else {
            panic!("pin {number} takes nothing");
        }
    }
    // The edits: every layer's seed, set and re-rolled; every part of the
    // tone; the tempo the slider set; then the listener's mutes and the
    // wander's salt, which a code carries beside the request.
    for layer in 0..5 {
        for rolled in [false, true] {
            check(g, asked(Request::new().with_layer_seed(layer, 0xdead_beef ^ u32::try_from(layer).unwrap(), rolled)));
        }
    }
    for k in 0..3 {
        for x in [0.0, 0.6, 1.0, 0.123_456_789_012_345_67] {
            check(g, asked(Request::new().with_tone(k, x)));
        }
    }
    for bpm in [32.0, 88.0, 101.25, 190.0] {
        check(g, asked(Request::new().with_bpm(bpm)));
    }
    for mutes in [1u8, 2, 4, 8, 16, 31] {
        check(g, Loop { mutes, ..Loop::of(77) });
    }
    check(g, Loop { salt: 1, ..Loop::of(77) });
    check(g, Loop { salt: u32::MAX, ..Loop::of(77) });
    // A pin of minus zero keeps its sign (as the request's text does).
    let neg = Request::parse("tuning.cents=-0").expect("a pin");
    let back = code::read_loop(write(&asked(Ok(neg))).as_bytes()).expect("a code");
    assert!(back.request.pins().get("tuning.cents").is_some_and(|x| x == 0.0 && x.is_sign_negative()));
    assert!(n > 500, "{n} requests walked");
}

#[test]
fn a_pin_to_today_frees_a_change_and_its_code_plays_it() {
    // Batch 6's draws count against a loop's changes (Mikey, 2026-11-17):
    // pinning one to today frees a change the list fills with another.
    // wen-glui (corpus 20261009 #50) with its tuning held at A440 gains the
    // arc; its code must play that, not only read back the same text.
    roomy(|| {
        let mut r = Rng::new(20_261_009);
        let seed = (0..200).map(|_| r.seed32()).find(|&s| seed_name(s).as_str() == "wen-glui").expect("wen-glui in the corpus");
        let mut g = Box::new(Generator::new());
        g.load_with(seed, &Request::new());
        let before = g.render().choice("arc");
        let l = asked(Request::parse("tuning.cents=0"));
        let l = Loop { seed, ..l };
        round_trip(Some(&mut g), &l);
        let back = code::read_loop(write(&l).as_bytes()).expect("a code");
        g.load_with(seed, &back.request);
        assert_eq!(g.render().choice("arc"), Some("on"), "the freed change");
        assert_ne!(before, Some("on"), "wen-glui has no arc unpinned");
    });
}

// --------------------------------------------------------------- the fuzz

/// A random request, as a listener's picks and edits could make one.
#[allow(clippy::too_many_lines)] // one part of the request after another
fn random_loop(r: &mut Rng) -> Loop {
    let mut q = Request::new();
    let mut d = Rng::new(r.seed32());
    let mut u = Rng::new(r.seed32());
    let mut maybe = |q: &mut Request, p: f64, f: &mut dyn FnMut(Request) -> Result<Request, &'static str>| {
        if r.f() < p
            && let Ok(x) = f(*q)
        {
            *q = x;
        }
    };
    let mut pick = move |n: usize| d.pick_index(n);
    for _ in 0..pick(5) {
        let i = pick(data::VIBE_COUNT);
        let w = if u.f() < 0.5 { None } else { Some((u.f() * 3.0 * 100.0).round() / 100.0) };
        maybe(&mut q, 1.0, &mut |x| match w {
            None => Ok(x.with(i)),
            Some(w) => x.with_weight(i, w),
        });
    }
    let (lo, span) = (32.0 + js_floor(u.f() * 158.0), js_floor(u.f() * 30.0));
    maybe(&mut q, 0.3, &mut |x| x.with_tempo(lo, (lo + span).min(190.0)));
    let bars = [1.0, 4.0, 16.0, 64.0, 512.0, 3072.0, 32_768.0][pick(7)];
    let endless = u.f() < 0.3;
    maybe(&mut q, 0.3, &mut |x| x.with_length(if endless { Length::Endless } else { Length::Bars(bars) }));
    let journey = if u.f() < 0.5 { Journey::Arc } else { Journey::Wander };
    maybe(&mut q, 0.2, &mut |x| Ok(x.with_journey(journey)));
    let keys = (u.seed32() & 0xfff) | 1;
    maybe(&mut q, 0.2, &mut |x| x.with_keys(keys));
    let scales = (u.seed32() & request::SCALES_ALL) | 1;
    maybe(&mut q, 0.2, &mut |x| x.with_scales(scales));
    let styles = 1 << pick(PROFILE_ORDER.len());
    maybe(&mut q, 0.2, &mut |x| x.with_styles(styles));
    for (layer, voices) in VOICE_ORDER.iter().enumerate() {
        let bits = 1 << pick(voices.len());
        maybe(&mut q, 0.1, &mut |x| x.with_voices(layer, bits));
        let ask = if u.f() < 0.5 { LayerAsk::On } else { LayerAsk::Off };
        maybe(&mut q, 0.1, &mut |x| x.with_layer(layer, ask));
    }
    let theme = u.seed32();
    maybe(&mut q, 0.1, &mut |x| Ok(x.with_theme(theme)));
    for _ in 0..pick(4) {
        let number = pick(request::PINS_MAX);
        let value = if let Some(w) = Pins::words(number) {
            #[allow(clippy::cast_precision_loss)] // a word's place
            let v = pick(w.len()) as f64;
            v
        } else if let Some(v) = Pins::values(number) {
            v[pick(v.len())].0
        } else if let Some(([lo, hi], whole)) = Pins::range(number) {
            let x = lo + u.f() * (hi - lo);
            if whole { js_floor(x).max(lo) } else { x }
        } else {
            continue;
        };
        maybe(&mut q, 1.0, &mut |x| x.with_pin(number, value));
    }
    for layer in 0..5 {
        let (seed, rolled) = (u.seed32(), u.f() < 0.5);
        maybe(&mut q, 0.05, &mut |x| x.with_layer_seed(layer, seed, rolled));
    }
    for k in 0..3 {
        let t = u.f();
        maybe(&mut q, 0.1, &mut |x| x.with_tone(k, t));
    }
    let bpm = 32.0 + u.f() * 158.0;
    maybe(&mut q, 0.1, &mut |x| x.with_bpm(bpm));
    let mutes = if u.f() < 0.1 { u8::try_from(u.seed32() & 31).unwrap() } else { 0 };
    let salt = if u.f() < 0.1 { u.seed32() | 1 } else { 0 };
    Loop { seed: u.seed32(), request: q, mutes, salt }
}

fn js_floor(x: f64) -> f64 {
    x.floor()
}

#[test]
fn a_few_thousand_random_requests_round_trip() {
    roomy(|| {
        let mut r = Rng::new(105);
        let mut g = Box::new(Generator::new());
        let mut longest = 0;
        for i in 0..4000 {
            let l = random_loop(&mut r);
            // Every request's text; every fourth one's sound as well.
            let text = round_trip(if i % 4 == 0 { Some(&mut g) } else { None }, &l);
            longest = longest.max(text.len());
        }
        assert!(longest < 200, "the longest random code: {longest}");
    });
}

// ------------------------------------------------------------ the goldens

#[test]
fn every_golden_case_as_a_code_makes_its_hashes() {
    roomy(|| {
        let text = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/golden/generation.hashes")).expect("the goldens");
        let mut g = Box::new(Generator::new());
        let mut cases = 0;
        for line in text.lines().filter(|l| !l.is_empty() && !l.starts_with('#')) {
            let fields: Vec<&str> = line.split(' ').collect();
            let seed: u32 = fields[1].parse().expect("a seed");
            let request = Request::parse(fields[2]).expect("a request");
            let code = write(&Loop { seed, request, mutes: 0, salt: 0 });
            let back = code::read_loop(code.as_bytes()).unwrap_or_else(|e| panic!("{}: {code}: {e}", fields[0]));
            g.load_with(back.seed, &back.request);
            for part in Part::ALL {
                let want = part.in_line(line).expect("the part's hash");
                assert_eq!(format!("{:016x}", g.hash(part)), want, "{} {code} {part:?}", fields[0]);
            }
            cases += 1;
        }
        assert_eq!(cases, 5139);
    });
}

// ------------------------------------------------------------- the albums

fn album_tracks(album: &str) -> Vec<String> {
    let a = code::read_album(album.as_bytes()).expect("an album");
    (0..a.count)
        .map(|i| {
            let mut out = [0u8; code::LOOP_MOST];
            let n = code::album_track(album.as_bytes(), i, &mut out).expect("a track");
            String::from_utf8(out[..n].to_vec()).expect("ASCII")
        })
        .collect()
}

#[test]
fn an_album_of_loops_holds_each_as_it_was() {
    let mut r = Rng::new(9);
    let tracks: Vec<String> = (0..12).map(|_| write(&random_loop(&mut r))).collect();
    let title = Title::new(b"Rainy Sunday, side A").expect("a title");
    let mut out = vec![0u8; 8192];
    let n = code::write_album(tracks.iter().map(String::as_bytes), &title, &mut out).expect("an album");
    let album = String::from_utf8(out[..n].to_vec()).expect("ASCII");
    assert_eq!(code::kind(album.as_bytes()), Some(Kind::Album));
    let a = code::read_album(album.as_bytes()).expect("an album");
    assert_eq!((a.count, a.seed, a.title.text()), (12, None, &b"Rainy Sunday, side A"[..]));
    assert_eq!(album_tracks(&album), tracks);
    // Eight plain loops: about 60 characters (promise 8).
    let plain: Vec<String> = (0..8).map(|s| write(&Loop::of(s * 1_000_003))).collect();
    let n = code::write_album(plain.iter().map(String::as_bytes), &Title::NONE, &mut out).expect("an album");
    assert!(n <= 64, "eight plain loops: {n} characters");
    assert_eq!(album_tracks(core::str::from_utf8(&out[..n]).unwrap()), plain);
    // A loop's code is no album's, nor an album's a loop's.
    assert_eq!(code::read_album(tracks[0].as_bytes()).err(), Some(NOT_A_CODE));
    assert_eq!(code::read_loop(album.as_bytes()).err(), Some(NOT_A_CODE));
    assert_eq!(code::write_album(core::iter::empty(), &Title::NONE, &mut out).err(), Some(code::BAD_ALBUM));
}

#[test]
fn an_album_from_one_seed_is_one_short_code() {
    let picks = Request::parse("glacial,cozy,bars=3072,journey=wander").expect("picks");
    let mut out = [0u8; 256];
    let n = code::write_seed_album(424_242, 12, &picks, &Title::NONE, &mut out).expect("an album");
    let album = String::from_utf8(out[..n].to_vec()).expect("ASCII");
    // A 24-hour, 12-track album in under 20 characters (Painter, item 4).
    assert!(album.len() < 20, "{album}");
    let a = code::read_album(album.as_bytes()).expect("an album");
    assert_eq!((a.count, a.seed), (12, Some(424_242)));
    let tracks = album_tracks(&album);
    for (i, t) in tracks.iter().enumerate() {
        let l = code::read_loop(t.as_bytes()).expect("a track");
        assert_eq!(l.seed, code::track_seed(424_242, i));
        assert_eq!(write(&Loop { seed: l.seed, request: picks, mutes: 0, salt: 0 }), *t, "track {i} shares the picks");
    }
    let distinct: std::collections::BTreeSet<_> = tracks.iter().collect();
    assert_eq!(distinct.len(), 12);
    // A title, and the edits left out (an album shares picks, not edits).
    let edited = picks.with_bpm(99.0).expect("an edit");
    let title = Title::new(b"Night drive").expect("a title");
    let n = code::write_seed_album(7, 3, &edited, &title, &mut out).expect("an album");
    let a = code::read_album(&out[..n]).expect("an album");
    assert_eq!(a, Album { count: 3, version: data::CODE_NEWEST, seed: Some(7), title });
    let first = code::read_loop(album_tracks(core::str::from_utf8(&out[..n]).unwrap())[0].as_bytes()).expect("a track");
    assert!(first.request.edits().bpm().is_none());
}

// ------------------------------------------------------------- refusals

/// A code's characters (without its check) closed with the right check.
fn sealed(chars: &str) -> String {
    let h = chars.bytes().fold(0u32, |h, c| (h * 64 + u32::try_from(ALPHABET.iter().position(|&a| a == c).unwrap()).unwrap() + 1) % 4093);
    let mut s = chars.to_string();
    s.push(ALPHABET[(h & 63) as usize] as char);
    s.push(ALPHABET[(h >> 6) as usize] as char);
    s
}

/// A whole number as the format writes it.
fn uv(mut x: u64) -> String {
    let mut s = String::new();
    while x >= 32 {
        s.push(ALPHABET[(x & 31) as usize | 32] as char);
        x >>= 5;
    }
    s.push(ALPHABET[x as usize] as char);
    s
}

#[test]
fn a_newer_builds_code_is_refused_plainly() {
    let plain = write(&Loop::of(5));
    let seed = &plain[1..7];
    // A newer version, a loop's and an album's.
    let newer = u64::from(data::CODE_NEWEST) + 1;
    assert_eq!(code::read_loop(sealed(&format!("{}{seed}", uv(newer * 2))).as_bytes()).err(), Some(NEEDS_NEWER));
    assert_eq!(code::read_album(sealed(&format!("{}A{}{}", uv(newer * 2 + 1), uv(1), &plain[..7])).as_bytes()).err(), Some(NEEDS_NEWER));
    assert_eq!(code::read_loop(sealed(&format!("{}{seed}", uv(1 << 40))).as_bytes()).err(), Some(NEEDS_NEWER));
    // An id this build lacks: a vibe, a choice, a setting, a voice, a field.
    let head = &plain[..7];
    for fields in [
        format!("{}{}", uv(1), uv(9999 * 2)),
        format!("{}{}{}", uv(13), uv(999), uv(1)),
        format!("{}{}{}", uv(13), uv(0), uv(99)),
        format!("{}{}{}", uv(14), uv(999), uv(0)),
        format!("{}{}{}{}", uv(9), uv(3), uv(1), uv(200)),
        format!("{}{}", uv(5), uv(7)),
        uv(25),
        uv(31),
    ] {
        assert_eq!(code::read_loop(sealed(&format!("{head}{fields}")).as_bytes()).err(), Some(NEEDS_NEWER), "{fields}");
    }
    assert_eq!(code::kind(sealed(&format!("{}{seed}", uv(newer * 2))).as_bytes()), None);
    // The line names no app: the host says whose build it is.
    assert_eq!(NEEDS_NEWER, "needs a newer version");
}

#[test]
fn no_code_is_read_as_another() {
    let text = write(&asked(Request::parse("glacial,bpm=80,organ=on,space.room=0.8")));
    // Every character changed to every other, and every pair swapped:
    // refused, never another loop.
    let bytes = text.as_bytes();
    for i in 0..bytes.len() {
        for &c in ALPHABET {
            if c != bytes[i] {
                let mut b = bytes.to_vec();
                b[i] = c;
                assert!(code::read_loop(&b).is_err(), "{} read", String::from_utf8_lossy(&b));
            }
        }
        if i + 1 < bytes.len() && bytes[i] != bytes[i + 1] {
            let mut b = bytes.to_vec();
            b.swap(i, i + 1);
            assert!(code::read_loop(&b).is_err());
        }
    }
    for bad in ["", "DL1-ABCDE", "AAAAAAAAA", "not a code at all", "E+AAAAA//"] {
        assert_eq!(code::read_loop(bad.as_bytes()).err(), Some(NOT_A_CODE), "{bad}");
    }
    // Spaces a paste brings are let be.
    assert!(code::read_loop(format!("  {text}\n").as_bytes()).is_ok());
    // Out of order, twice, or a set empty: no code's.
    let head = &text[..7];
    for fields in [format!("{}{}", uv(2), uv(0)) + &uv(0) + &uv(1) + &uv(1), format!("{}{}{}{}", uv(6), uv(1), uv(0), uv(6)) + &uv(1) + &uv(0), format!("{}{}", uv(6), uv(0))] {
        assert_eq!(code::read_loop(sealed(&format!("{head}{fields}")).as_bytes()).err(), Some(NOT_A_CODE), "{fields}");
    }
}

#[test]
fn corrupt_and_truncated_codes_never_panic() {
    let mut r = Rng::new(31337);
    let mut seeds = Rng::new(1);
    let codes: Vec<String> = (0..200).map(|_| write(&random_loop(&mut seeds))).collect();
    let mut out = vec![0u8; 8192];
    let n = code::write_album(codes[..10].iter().map(String::as_bytes), &Title::new(b"x").unwrap(), &mut out).expect("an album");
    let album = String::from_utf8(out[..n].to_vec()).unwrap();
    let n = code::write_seed_album(3, 5, &Request::parse("cozy,bars=8").unwrap(), &Title::NONE, &mut out).expect("an album");
    let seeded = String::from_utf8(out[..n].to_vec()).unwrap();
    let mut all = codes.clone();
    all.push(album);
    all.push(seeded);
    let mut tried = 0;
    for _ in 0..40 {
        for c in &all {
            let mut b: Vec<u8> = c.as_bytes()[..c.len() - 2].to_vec();
            // Cut short, a character changed, one added or taken out, or
            // random characters: then sealed with a right check, so the
            // reader walks what it holds, not only the check.
            match r.pick_index(5) {
                0 => b.truncate(r.pick_index(b.len() + 1)),
                1 => {
                    let i = r.pick_index(b.len());
                    b[i] = ALPHABET[r.pick_index(64)];
                }
                2 => b.insert(r.pick_index(b.len() + 1), ALPHABET[r.pick_index(64)]),
                3 => {
                    b.remove(r.pick_index(b.len()));
                }
                _ => {
                    let keep = r.pick_index(b.len() + 1);
                    b.truncate(keep);
                    for _ in 0..r.pick_index(40) {
                        b.push(ALPHABET[r.pick_index(64)]);
                    }
                }
            }
            let text = sealed(core::str::from_utf8(&b).unwrap());
            let _ = code::read_loop(text.as_bytes());
            if let Ok(a) = code::read_album(text.as_bytes()) {
                for i in 0..a.count.min(4) {
                    let mut t = [0u8; code::LOOP_MOST];
                    if let Ok(n) = code::album_track(text.as_bytes(), i, &mut t) {
                        code::read_loop(&t[..n]).expect("an album's track reads as a loop");
                    }
                }
            }
            let _ = code::kind(text.as_bytes());
            // And without sealing: the check refuses nearly all.
            let _ = code::read_loop(&b);
            tried += 1;
        }
    }
    // Text of any bytes at all.
    for _ in 0..20_000 {
        let len = r.pick_index(30);
        let b: Vec<u8> = (0..len).map(|_| u8::try_from(r.seed32() & 255).unwrap()).collect();
        let _ = code::read_loop(&b);
        let _ = code::read_album(&b);
        tried += 1;
    }
    assert!(tried > 20_000);
    // Every code still reads back as it was.
    for c in &codes {
        assert_eq!(write(&code::read_loop(c.as_bytes()).expect("a code")), *c);
    }
}

#[test]
fn a_request_asks_its_version_in_text() {
    let r = Request::parse("version=2,glacial").expect("a request");
    assert_eq!(r.version(), 2);
    assert_eq!(Request::parse("version=1").err(), Some(request::BAD_VERSION));
    assert_eq!(Request::parse(&format!("version={}", data::CODE_NEWEST + 1)).err(), Some(NEEDS_NEWER));
    // No room: refused, not cut short.
    let mut small = [0u8; 8];
    assert_eq!(code::write_loop(&Loop::of(1), &mut small).err(), Some(code::NO_ROOM));
}
