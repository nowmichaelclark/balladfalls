// The lock screen's artwork in a browser (Mikey, 2026-11-22):
// the playing loop's own cover, with no browser: the media session, the
// object URLs and the cover's drawing are stand-ins.
// Run with:  node test/media.test.mjs
//
// What it pins down: the title never waits for the picture; a slow cover
// never lands on a later loop; a rename keeps the picture; at most one
// object URL lives, and an old one is freed only once it is not shown; the
// icons are only for a cover that could not be made, which is tried again.

let failures = 0;
function check(label, condition, detail = '') {
  console.log(condition ? `  pass  ${label}` : `  FAIL  ${label} ${detail}`);
  if (!condition) failures++;
}

const live = new Map();
let shown = null;
let freedShown = false;
let made = 0;
URL.createObjectURL = (blob) => {
  const url = `blob:test/${++made}`;
  live.set(url, blob);
  return url;
};
URL.revokeObjectURL = (url) => {
  if (shown && shown.artwork.some((a) => a.src === url)) freedShown = true;
  live.delete(url);
};

const { SessionArt } = await import('../js/media.js');
const asked = [];
const png = (spec) => new Promise((resolve, reject) => asked.push({ spec, resolve, reject }));
const art = new SessionArt(png, (words, artwork) => { shown = { ...words, artwork }; });
const settle = () => new Promise((r) => setTimeout(r, 0));
const cover = () => (shown.artwork.length === 1 ? live.get(shown.artwork[0].src) : undefined);

const one = { seed: 1, name: 'ta-ku' };
const two = { seed: 2, name: 'koa-roal' };
art.set('ta-ku', '80 bpm', one);
check('the title at once, before any picture', shown.title === 'ta-ku' && shown.artwork.length === 0);
await settle();
asked[0].resolve('cover 1');
await settle();
check('then the loop\'s own cover, 320 px', cover() === 'cover 1' && shown.artwork[0].sizes === '320x320');

const src = shown.artwork[0].src;
art.set('renamed', '80 bpm', { ...one, name: 'renamed' });
await settle();
check('a rename keeps the picture and asks for none', shown.title === 'renamed' && shown.artwork[0].src === src && asked.length === 1);

art.set('koa-roal', '90 bpm', two);
check('a new loop: its title at once, not the last one\'s cover, not the icon', shown.title === 'koa-roal' && shown.artwork.length === 0);
check('the last cover\'s address is freed', !live.size);
await settle();

const three = { seed: 3, name: 'shuin' };
art.set('shuin', '70 bpm', three);
await settle();
asked[1].resolve('cover 2, late');
await settle();
check('a slow cover never lands on a later loop', shown.title === 'shuin' && !shown.artwork.length && !live.size);
asked[2].resolve('cover 3');
await settle();
check('the later loop gets its own', cover() === 'cover 3');

const four = { seed: 4, name: 'noar' };
art.set('noar', '60 bpm', four);
await settle();
const renamedWaiting = asked.length;
art.set('noar two', '60 bpm', { ...four, name: 'noar two' });
asked[3].resolve('cover 4');
await settle();
check('renamed while its cover is drawn: the new name with that cover', shown.title === 'noar two' && cover() === 'cover 4' && asked.length === renamedWaiting);

const warn = console.warn;
console.warn = () => {};
const five = { seed: 5, name: 'mun' };
art.set('mun', '60 bpm', five);
await settle();
asked[4].reject(new Error('no canvas'));
await settle();
console.warn = warn;
check('a cover that can\'t be made: the icons, and only then', shown.title === 'mun' && shown.artwork.length === 2 && shown.artwork.every((a) => a.src.startsWith('icons/')));
art.set('mun', '60 bpm', five);
await settle();
check('asked again, it is tried again', asked.length === 6);
asked[5].resolve('cover 5');
await settle();
check('and shows when it can be made', cover() === 'cover 5');

check('one object URL lives', live.size === 1, String(live.size));
check('none was freed while shown', !freedShown);

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nAll good.');
