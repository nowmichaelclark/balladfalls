//! The page's messages as text (session 27, queue item 107c): a small JSON
//! reader for what `js/core.js`'s `CoreHost` posts, and the few helpers the
//! bridge writes its answers with. No crate: the app's thread reads a
//! message a few times a second, so this is plain and short, never fast.
//!
//! Numbers are read as JavaScript reads them (doubles); a value the page
//! leaves out (`undefined`, which `JSON.stringify` drops) reads as `Null`.

use std::fmt::Write as _;

/// A JSON value.
#[derive(Clone, Debug, PartialEq)]
pub enum Value {
    Null,
    Bool(bool),
    Num(f64),
    Str(String),
    Arr(Vec<Value>),
    Obj(Vec<(String, Value)>),
}

/// What a missing field or a missing element reads as.
static NULL: Value = Value::Null;

impl Value {
    /// The field `key` of an object (`Null` for none, or for not an object).
    #[must_use]
    pub fn get(&self, key: &str) -> &Value {
        match self {
            Value::Obj(fields) => fields.iter().find(|(k, _)| k == key).map_or(&NULL, |(_, v)| v),
            _ => &NULL,
        }
    }

    /// Element `i` of an array (`Null` past its end, or for not an array).
    #[must_use]
    pub fn at(&self, i: usize) -> &Value {
        match self {
            Value::Arr(items) => items.get(i).unwrap_or(&NULL),
            _ => &NULL,
        }
    }

    /// An array's elements (none for anything else).
    #[must_use]
    pub fn items(&self) -> &[Value] {
        match self {
            Value::Arr(items) => items,
            _ => &[],
        }
    }

    /// A string's text.
    #[must_use]
    pub fn str(&self) -> Option<&str> {
        match self {
            Value::Str(s) => Some(s),
            _ => None,
        }
    }

    /// `null` or left out: JavaScript's `x == null`.
    #[must_use]
    pub fn is_null(&self) -> bool {
        matches!(self, Value::Null)
    }

    /// JavaScript's truthiness (`if (x)`).
    #[must_use]
    pub fn truthy(&self) -> bool {
        match self {
            Value::Null => false,
            Value::Bool(b) => *b,
            Value::Num(n) => *n != 0.0 && !n.is_nan(),
            Value::Str(s) => !s.is_empty(),
            Value::Arr(_) | Value::Obj(_) => true,
        }
    }

    /// The number a WebAssembly call is given for this value (JavaScript's
    /// `ToNumber`, as the worklet's calls into the module take their
    /// arguments): `null` and `false` 0, `true` 1, a number itself, anything
    /// else NaN.
    #[must_use]
    pub fn num(&self) -> f64 {
        match self {
            Value::Null => 0.0,
            Value::Bool(b) => f64::from(u8::from(*b)),
            Value::Num(n) => *n,
            Value::Str(s) => s.trim().parse().unwrap_or(f64::NAN),
            Value::Arr(_) | Value::Obj(_) => f64::NAN,
        }
    }

    /// `x || 0`: the number, or 0 for anything falsy.
    #[must_use]
    pub fn num_or_zero(&self) -> f64 {
        if self.truthy() { self.num() } else { 0.0 }
    }

    /// `x >>> 0`, JavaScript's `ToUint32` (a seed, a tag, a mask).
    #[must_use]
    pub fn u32(&self) -> u32 {
        to_u32(self.num())
    }
}

/// JavaScript's `ToUint32`: the number truncated, modulo 2^32.
#[must_use]
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss, reason = "the value is reduced into 0..2^32 first")]
pub fn to_u32(x: f64) -> u32 {
    if !x.is_finite() {
        return 0;
    }
    let m = x.trunc() % 4_294_967_296.0;
    let m = if m < 0.0 { m + 4_294_967_296.0 } else { m };
    m as u32
}

/// Read a JSON text.
///
/// # Errors
///
/// Where it stops being JSON, in plain words.
pub fn parse(text: &str) -> Result<Value, &'static str> {
    let mut r = Reader { b: text.as_bytes(), i: 0 };
    let v = r.value(0)?;
    r.space();
    if r.i != r.b.len() {
        return Err("more after the message");
    }
    Ok(v)
}

/// How deep a message nests, at most (the page's go four deep).
const DEPTH: usize = 32;

struct Reader<'a> {
    b: &'a [u8],
    i: usize,
}

impl Reader<'_> {
    fn space(&mut self) {
        while self.i < self.b.len() && matches!(self.b[self.i], b' ' | b'\t' | b'\n' | b'\r') {
            self.i += 1;
        }
    }

    fn eat(&mut self, word: &str) -> Result<(), &'static str> {
        if self.b[self.i..].starts_with(word.as_bytes()) {
            self.i += word.len();
            Ok(())
        } else {
            Err("not JSON")
        }
    }

    fn value(&mut self, depth: usize) -> Result<Value, &'static str> {
        if depth > DEPTH {
            return Err("nested too deep");
        }
        self.space();
        match self.b.get(self.i) {
            None => Err("the message ended early"),
            Some(b'n') => self.eat("null").map(|()| Value::Null),
            Some(b't') => self.eat("true").map(|()| Value::Bool(true)),
            Some(b'f') => self.eat("false").map(|()| Value::Bool(false)),
            Some(b'"') => self.string().map(Value::Str),
            Some(b'[') => {
                self.i += 1;
                let mut items = Vec::new();
                self.space();
                if self.b.get(self.i) == Some(&b']') {
                    self.i += 1;
                    return Ok(Value::Arr(items));
                }
                loop {
                    items.push(self.value(depth + 1)?);
                    self.space();
                    match self.b.get(self.i) {
                        Some(b',') => self.i += 1,
                        Some(b']') => {
                            self.i += 1;
                            return Ok(Value::Arr(items));
                        }
                        _ => return Err("an array not closed"),
                    }
                }
            }
            Some(b'{') => {
                self.i += 1;
                let mut fields = Vec::new();
                self.space();
                if self.b.get(self.i) == Some(&b'}') {
                    self.i += 1;
                    return Ok(Value::Obj(fields));
                }
                loop {
                    self.space();
                    if self.b.get(self.i) != Some(&b'"') {
                        return Err("a field without a name");
                    }
                    let key = self.string()?;
                    self.space();
                    if self.b.get(self.i) != Some(&b':') {
                        return Err("a field without a value");
                    }
                    self.i += 1;
                    fields.push((key, self.value(depth + 1)?));
                    self.space();
                    match self.b.get(self.i) {
                        Some(b',') => self.i += 1,
                        Some(b'}') => {
                            self.i += 1;
                            return Ok(Value::Obj(fields));
                        }
                        _ => return Err("an object not closed"),
                    }
                }
            }
            Some(_) => self.number().map(Value::Num),
        }
    }

    fn number(&mut self) -> Result<f64, &'static str> {
        let start = self.i;
        while self.i < self.b.len() && matches!(self.b[self.i], b'0'..=b'9' | b'-' | b'+' | b'.' | b'e' | b'E') {
            self.i += 1;
        }
        std::str::from_utf8(&self.b[start..self.i]).ok().and_then(|s| s.parse().ok()).ok_or("not a number")
    }

    fn string(&mut self) -> Result<String, &'static str> {
        self.i += 1;
        let mut out = String::new();
        loop {
            let Some(&c) = self.b.get(self.i) else { return Err("a string not closed") };
            self.i += 1;
            match c {
                b'"' => return Ok(out),
                b'\\' => {
                    let Some(&e) = self.b.get(self.i) else { return Err("a string not closed") };
                    self.i += 1;
                    match e {
                        b'"' => out.push('"'),
                        b'\\' => out.push('\\'),
                        b'/' => out.push('/'),
                        b'b' => out.push('\u{8}'),
                        b'f' => out.push('\u{c}'),
                        b'n' => out.push('\n'),
                        b'r' => out.push('\r'),
                        b't' => out.push('\t'),
                        b'u' => {
                            let hex = self.b.get(self.i..self.i + 4).ok_or("a short escape")?;
                            self.i += 4;
                            let code = std::str::from_utf8(hex).ok().and_then(|h| u32::from_str_radix(h, 16).ok()).ok_or("a bad escape")?;
                            // A lone surrogate (half of a pair) is kept as the
                            // replacement character: the core's words are ASCII.
                            out.push(char::from_u32(code).unwrap_or('\u{fffd}'));
                        }
                        _ => return Err("a bad escape"),
                    }
                }
                _ => {
                    // The bytes of one character, as they came (the text is UTF-8).
                    let start = self.i - 1;
                    let len = match c {
                        0x00..=0x7f => 1,
                        0xc0..=0xdf => 2,
                        0xe0..=0xef => 3,
                        _ => 4,
                    };
                    let end = (start + len).min(self.b.len());
                    out.push_str(std::str::from_utf8(&self.b[start..end]).unwrap_or("\u{fffd}"));
                    self.i = end;
                }
            }
        }
    }
}

/// A number as `JSON.stringify` writes one: the shortest text that reads
/// back as the same double (Rust's `Display` is that too), and `null` for
/// one that isn't finite.
pub fn number(out: &mut String, x: f64) {
    if x.is_finite() {
        let _ = write!(out, "{x}");
    } else {
        out.push_str("null");
    }
}

/// A string as JSON.
pub fn string(out: &mut String, s: &str) {
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => {
                let _ = write!(out, "\\u{:04x}", c as u32);
            }
            c => out.push(c),
        }
    }
    out.push('"');
}

#[cfg(test)]
mod tests {
    use super::{Value, number, parse, to_u32};

    #[test]
    fn reads_what_the_page_posts() {
        let v = parse(r#"{"type":"playLoad","seed":2693262067,"ask":{"vibes":[[3,null],[5,0.5]],"tempo":null,"length":"endless","tone":[0.1,1e-3,-2]},"at":0,"resumed":false}"#).unwrap();
        assert_eq!(v.get("type").str(), Some("playLoad"));
        assert_eq!(v.get("seed").u32(), 2_693_262_067);
        let ask = v.get("ask");
        assert_eq!(ask.get("vibes").items().len(), 2);
        assert!(ask.get("vibes").at(0).at(1).is_null());
        assert!((ask.get("vibes").at(1).at(1).num() - 0.5).abs() < 1e-12);
        assert!(ask.get("tempo").is_null() && ask.get("pins").is_null());
        assert_eq!(ask.get("length").str(), Some("endless"));
        assert!((ask.get("tone").at(2).num() + 2.0).abs() < 1e-12);
        assert!(!v.get("resumed").truthy());
        assert!(parse("{\"a\":").is_err());
        assert!(parse("[1,2] 3").is_err());
        assert_eq!(parse(r#""aA\n""#).unwrap(), Value::Str("aA\n".into()));
    }

    #[test]
    fn uint32_as_javascript() {
        assert_eq!(to_u32(-1.0), 4_294_967_295);
        assert_eq!(to_u32(4_294_967_297.0), 1);
        assert_eq!(to_u32(3.9), 3);
        assert_eq!(to_u32(f64::NAN), 0);
    }

    #[test]
    fn numbers_round_trip() {
        for x in [0.0, 1.0, 0.1, 2.693_262_067e9, 1e-7, -3.25, 1.0 / 3.0] {
            let mut s = String::new();
            number(&mut s, x);
            assert_eq!(s.parse::<f64>().unwrap().to_bits(), x.to_bits(), "{s}");
        }
        let mut s = String::new();
        number(&mut s, f64::INFINITY);
        assert_eq!(s, "null");
    }
}
