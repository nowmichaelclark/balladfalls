// The mood vocabulary, in one place.
//
// Everything on the page that names a mood reads it from here: the regions
// of the feeling space, the numbers that a share code writes, and the words
// that the readout shows. The moods themselves are data, in data/moods.txt,
// which has the rules for a mood's code and word. To add, rename or merge a
// mood, edit that file (and, for a merge, FORMER_CODES below).

import { blocksOf, readBlock } from './data.js';

const SCHEMA = { code: 'num', word: 'word', lift: 'num', energy: 'num', warmth: 'num' };

export const MOODS = Object.fromEntries(blocksOf('moods', 'mood').map((b) => [b.name, readBlock(b, SCHEMA, 'data/moods.txt')]));

// The codes of moods that were merged away, and the mood that each one now
// reads as, so that share codes written before the merge still open. Empty
// until a merge happens.
const FORMER_CODES = {};

// What a share code's mood number reads as. An unknown number is a code
// from a newer build than this one; peaceful is the neutral guess.
export function moodForCode(code) {
  for (const [key, m] of Object.entries(MOODS)) if (m.code === code) return key;
  return FORMER_CODES[code] || 'peaceful';
}

export function codeForMood(key) {
  return MOODS[key] ? MOODS[key].code : -1;
}

export function moodWord(key) {
  return MOODS[key] ? MOODS[key].word : key;
}

// A word for a feeling that was saved as a single point, before feelings
// became mixtures. The rows go by energy, from the top. Each row gives its
// word for low, middle and high lift. 'restless' was never one of the moods
// above: only these old saves can show it.
const POINT_LIFT = [0.38, 0.66];
const POINT_WORDS = [
  [0.68, ['restless', 'refreshing', 'enthusiastic']],
  [0.36, ['reflective', 'comforting', 'happy']],
  [-Infinity, ['reflective', 'peaceful', 'joyful']],
];

export function pointWord({ lift, energy }) {
  const column = POINT_LIFT.filter((t) => lift > t).length;
  const [, words] = POINT_WORDS.find(([floor]) => energy > floor) || POINT_WORDS[POINT_WORDS.length - 1];
  return moodWord(words[column]);
}
