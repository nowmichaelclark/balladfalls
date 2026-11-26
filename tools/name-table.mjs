#!/usr/bin/env node
// The table a share code's name is held to
// (core/src/code/name.rs): every code point that is not an ordinary visible
// character, by class, as ranges. Written from Node's own Unicode tables
// (its regular expressions' property escapes), so the core carries no
// Unicode library and the page asks the core, not its browser.
//
//   node tools/name-table.mjs           write core/src/code/classes.rs
//   node tools/name-table.mjs --check   fail if the file differs
//
// The file is frozen with the format (core/README.md, "Share codes"): a
// newer Unicode is taken only with a version raise, since a name the table
// let through must read the same in every build. The classes:
//
//   mark     a combining mark (Mn, Me) or a variation selector: only after
//            a visible character, at most MARKS_MOST in a row
//   join     ZWNJ and ZWJ: only between two visible characters
//   tag      a tag letter (U+E0020 to U+E007E): only in a flag's run
//   cancel   the tag run's end (U+E007F)
//   refused  controls, format characters (direction overrides, invisible
//            spaces), separators other than the plain space, private use,
//            surrogates, noncharacters, default-ignorables and the blank
//            Braille pattern
//
// Everything else (letters, digits, punctuation, symbols, emoji, unassigned
// code points) is an ordinary character.

import fs from 'node:fs';

const OUT = new URL('../core/src/code/classes.rs', import.meta.url);
const CLASSES = ['mark', 'join', 'tag', 'cancel', 'refused'];

const is = (re) => (s) => re.test(s);
const vs = is(/\p{Variation_Selector}/u);
const refused = is(/[\p{Cc}\p{Cf}\p{Zs}\p{Zl}\p{Zp}\p{Co}\p{Cs}\p{Noncharacter_Code_Point}\p{Default_Ignorable_Code_Point}]/u);
const mark = is(/[\p{Mn}\p{Me}]/u);

function classOf(cp) {
  if (cp === 0x20) return null;
  if (cp === 0x200c || cp === 0x200d) return 'join';
  if (cp >= 0xe0020 && cp <= 0xe007e) return 'tag';
  if (cp === 0xe007f) return 'cancel';
  const s = String.fromCodePoint(cp);
  if (vs(s)) return 'mark';
  if (cp === 0x2800 || refused(s)) return 'refused';
  if (mark(s)) return 'mark';
  return null;
}

const ranges = [];
for (let cp = 0; cp <= 0x10ffff; cp++) {
  const c = classOf(cp);
  if (c == null) continue;
  const last = ranges[ranges.length - 1];
  if (last && last[2] === c && last[1] === cp - 1) last[1] = cp;
  else ranges.push([cp, cp, c]);
}

const hex = (n) => { const h = n.toString(16).toUpperCase().padStart(8, '0'); return `0x${h.slice(0, 4)}_${h.slice(4)}`; };
const rows = ranges.map(([a, b, c]) => `    (${hex(a)}, ${hex(b)} | ${c.toUpperCase()}),`);
const text = `//! The classes of code points a share code's name is held to (\`name.rs\`):
//! Unicode ${process.versions.unicode}, as ranges, ascending. Written by
//! \`node tools/name-table.mjs\`; do not edit. Frozen with the format: a newer
//! Unicode only with a version raise.

${CLASSES.map((c, i) => `/// The class \`${c}\`, in a range's high bits.\npub const ${c.toUpperCase()}: u32 = ${i + 1} << 24;`).join('\n')}

/// Each range: its first code point, and its last with its class above.
pub static RANGES: [(u32, u32); ${ranges.length}] = [
${rows.join('\n')}
];
`;

if (process.argv.includes('--check')) {
  const have = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (have !== text) {
    console.error('name-table: core/src/code/classes.rs differs from this Unicode (run without --check)');
    process.exit(1);
  }
  console.log(`name-table: core/src/code/classes.rs holds (${ranges.length} ranges)`);
} else {
  fs.mkdirSync(new URL('.', OUT), { recursive: true });
  fs.writeFileSync(OUT, text);
  console.log(`name-table: wrote core/src/code/classes.rs (${ranges.length} ranges, Unicode ${process.versions.unicode})`);
}
