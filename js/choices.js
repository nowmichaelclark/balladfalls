// The per-loop choices' tables, as the page reads them: the choices and
// settings of data/choices.txt. The page needs them for the pins that a
// request or a share code carries (js/pins.js): which options a choice has,
// and which range a setting takes. The core decides which changes a loop
// gets, and makes every draw (`core/src/generator/choices.rs`, with the
// same file compiled in).

import { blockOf, blocksOf, readBlock } from './data.js';

const WHERE = 'data/choices.txt';
const setting = (name, schema) => readBlock(blockOf('choices', 'setting', name), schema, WHERE);

// The data of every choice: { options, weight?, vibes?, optionVibes?,
// ownStream?, alone? }. `ownStream`: the option is drawn on a random stream
// of its own. `alone`: the choice is drawn by itself, not among the
// changes.
const CHOICE_DATA = Object.fromEntries(blocksOf('choices', 'choice').map((b) => [b.name, readBlock(b, {
  options: 'pool', weight: 'num', vibes: 'table', 'optionVibes.*': 'table', ownStream: 'num', alone: 'num',
}, WHERE)]));
const choiceData = (id) => CHOICE_DATA[id];

// The arc's settings: every variable of the arc, named, with the range that
// a loop draws it from, in this one place. So a request can pin them
// (docs/CORE.md, promises 9 and 11), and a later slider or a game host can
// set them. The core draws a loop's arc from them and plays it
// (core/src/blocks/arc.rs). The file says what each one is.
export const ARC = {
  weight: choiceData('arc').weight,
  vibes: choiceData('arc').vibes,
  ...setting('arc', {
    shapes: 'pool', 'shapeVibes.*': 'table', 'period.*': 'range', calm: 'words', bright: 'words', glacialNear: 'words',
    glacialChance: 'num', 'from.*': 'range', floor: 'range', dip: 'num',
  }),
};

// The tuned kick's settings: every variable of it, named, with its range,
// as ARC's are. The core draws a loop's kick from them, works out its level
// at load, and plays it (core/src/blocks/kick.rs).
export const KICK = {
  options: choiceData('tunedKick').options,
  optionVibes: choiceData('tunedKick').optionVibes,
  ...setting('kick', {
    note: 'range', short: 'range', long: 'range', loud: 'num', tailLoud: 'num', band: 'num', swap: 'num',
  }),
};

// subDuck's settings. The bass channel alone dips at each kick and comes
// back, so the kick and the sub take turns. `deep` holds deepDuck's own
// ranges. The core draws a loop's settings and plays them
// (core/src/blocks/sub_duck.rs).
export const SUBDUCK = {
  weight: choiceData('subDuck').weight,
  vibes: choiceData('subDuck').vibes,
  ...setting('subduck', { depth: 'range', recover: 'range', beat: 'num', 'deep.*': 'range' }),
};

// lateFloor's settings. After a load, the kit and the bass sit out a while,
// then arrive. `slow` holds slowOpening's wait and fade. The core draws a
// loop's settings, and its player plays them (core/src/player/sequencer.rs).
export const LATEFLOOR = {
  weight: choiceData('lateFloor').weight,
  vibes: choiceData('lateFloor').vibes,
  ...setting('latefloor', {
    seconds: 'range', round: 'num', first: 'num', orders: 'pool', gap: 'numpool', maxGap: 'num', gapLong: 'num', longVibes: 'table',
    'slow.*': 'range',
  }),
};

// padSweep's settings. A lowpass on the chord layer swings open and shut,
// while the rest stays as bright as it was. `wide` and `fast` are
// wideSweep's two sets, each of the same four ranges. The core draws a
// loop's settings and plays them (core/src/blocks/pad_sweep.rs).
export const PADSWEEP = {
  weight: choiceData('padSweep').weight,
  vibes: choiceData('padSweep').vibes,
  ...setting('padsweep', {
    sustained: 'words', lo: 'range', oct: 'range', period: 'range', q: 'range', 'wide.*': 'range', 'fast.*': 'range',
  }),
};

// echoTime's settings: the echo's time, drawn for each loop, in beats. It is
// drawn for every loop, outside the list of choices, and is not counted
// among a loop's changes.
export const ECHO = setting('echo', { beats: 'numpool', 'vibes.*': 'table' });

// tuningOffset's settings: how often a loop plays a little off A440, and how
// far. It is drawn for each loop, outside the list of choices, as echoTime
// is. The page reads them for the tuning pin's range.
export const TUNING = setting('tuning', { share: 'num', cents: 'range', vibes: 'table' });

// lowBell's draw: how often a loop plays the low bell, and its kinds. It is
// drawn for each loop, outside the list of choices, as tuningOffset is. The
// page reads its kinds for the pin's words.
export const LOWBELL = setting('lowbell', {
  share: 'num', kinds: 'pool', 'kindVibes.*': 'table', regap: 'num', spotlight: 'num', spotlightVibes: 'table', spotlightLeast: 'num',
});

// twang's draw: how often a loop that may play it does, and its versions.
// It is drawn for each loop, outside the list of choices, as the low bell
// is. The page reads its versions for the pin's words.
export const TWANG = setting('twang', { share: 'num', kinds: 'pool', drawn: 'pool', 'kindVibes.*': 'table', regap: 'num', spread: 'num', kitMost: 'num' });
// Every choice, in the file's order (the pins' order): its id and its
// options, the default first.
export const CHOICES = Object.keys(CHOICE_DATA).map((id) => ({ id, ...CHOICE_DATA[id] }));
