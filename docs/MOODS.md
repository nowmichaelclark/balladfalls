# Mood words

Mikey's vocabulary for describing loops (2026-09-27). The spirit, in his
words: wholesome, but free to be strange or nuanced. Inspired by
Buddhadasa and Ajahn Dhammarato: feelings and sensations are textures,
neither good nor bad -- "tight or hot or tingling or a mix of things and
ever-changing" -- and it's up to the listener to hold them wholesomely.
Near-synonyms are allowed to mean different things: "a happy song isn't
the same as a merry song."

This page keeps the list, the ten dials and Mikey's decisions. The words
reach the app as **vibes**: 88 recipes in `data/vibes.txt`, explained in
`docs/VIBES.md`. The story of how the words were sorted, ranked and made
into vibes is in the wiki, "Ballad Falls/Mood words and vibes/How the
words were tested". The pool-3 ranking (181 trials, v85) is the base for
the dial fits.

## The list

Affectionate, Airy, Ambient, Awake, Balanced, Beaming, Billowing, Bizarre,
Blissful, Booming, Bouncy, Breezy, Bubbling, Buoyant, Bursting, Buttery,
Buzzing, Calming, Carefree, Charming, Cheerful, Chill, Chirping,
Cleansing, Clear, Clearing, Coasting, Comforting, Confident, Content,
Cool, Cozy, Creamy, Crisp, Cruising, Curious, Decadent, Delightful, Dewy,
Dreamy, Drifting, Droning, Earnest, Earthy, Easygoing, Effervescent,
Embracing, Energetic, Enthusiastic, Ethereal, Expansive, Fizzing,
Flickering, Floating, Flowing, Fluffy, Fluttering, Flying, Freeing,
Friendly, Frosty, Fuzzy, Gentle, Glad, Gleaming, Gleeful, Gliding,
Glistening, Glowing, Golden, Groovy, Happy, Heartfelt, Heartwarming,
Humming, Intimate, Jolly, Joyful, Jubilant, Laid-back, Leisurely, Light,
Lighthearted, Lingering, Lively, Luminous, Meandering, Mellow, Merry, Misty,
Nourishing, Nurturing, Oscillating, Otherworldly, Pastel, Peaceful,
Playful, Pleasant, Plush, Pristine, Puffing, Pulsing, Purring, Quirky,
Radiant, Reflective, Refreshing, Relaxing, Reminiscent, Resilient,
Resonant, Resonating, Restful, Reverberating, Rippling, Rocking, Rolling,
Rubbing, Rumbling, Rustling, Sailing, Salty, Satisfying, Serene,
Shimmering, Shining, Showering, Sincere, Sizzling, Smooth, Soaring, Soft,
Soothing, Sour, Spacious, Sparking, Sparkling, Spicy, Springy, Sprinkling,
Squishy, Steady, Still, Strange, Strumming, Surging, Surreal, Swaying,
Sweeping, Sweet, Swelling, Swirling, Swishing, Tender, Thundering,
Tingling, Trickling, Tumbling, Turning, Twinkling, Twisting, Unbothered,
Unhurried, Velvety, Vibrant, Vibrating, Wandering, Warm, Wavy, Weird,
Welcoming, Wet, Whimsical, Whispering, Wholesome, Wild, Worry-free, Zany.

## How words combine

- **A word bends a profile, but does not replace it.** A word leans the
  profile's own ranges, and never leaves them.
- **No pair is forbidden** (Mikey, 2026-09-28). Words that pull against
  each other find their in-between. His example: *bouncy* and *floating*
  is a helium balloon. It floats by default, bounces when children bat
  it, and then drifts back. So a conflict becomes a shape over time: a
  home state, with excursions from it.
- **A share on a label must be honest.** Measure it from the rendered
  loop. Do not take it from the draw.

## Decided (Mikey, 2026-09-28)

- **Lively** joins the list.
- **Near neighbors, told apart:** *tender* is close (a small room, a soft
  touch, a narrow tune); *soothing* is settling (slow, long chords).
  *Serene* is still and wide; *peaceful* is content and moving gently. On
  the three feeling dials these pairs sit almost on top of each other, so
  the recipe must separate them.
- **Heart words replace the eight moods.** The eight became vibes like
  the rest, not a second system. Their share-code numbers stay frozen.
- **The ten dials, and option B for the maps** (below).

## Dials

Three feeling dials (lift, energy, warmth) can't tell tender from
soothing. So there are ten. Each dial has two wholesome ends. The
generator can steer it, and a rendered loop can be measured on it
(`tools/dials.mjs`). A word is a point on only the dials it cares about.

| dial | one end -- other end | steers / measures |
|---|---|---|
| lift | inward -- bright | mode brightness, share of major chords |
| energy | still -- lively | tempo, note density, drums |
| warmth | cool -- warm | tone warmth, filter |
| room | close -- wide | tone space, chord spread, tune span |
| ground | floating -- grounded | kicks and bass on the beat, notes tied over it |
| edge | soft -- crisp | attack, note length, tone brightness |
| height | low -- high | register of tune and texture |
| bounce | flowing -- springy | dotted and syncopated rhythm, short notes, leaps |
| tang | sweet -- tart | added seconds, b9, clusters over plain triads |
| oddness | familiar -- strange | unexpected intervals, whole-tone steps, odd pairings |

Instrument families (strumming, humming), meter (swaying's lilt) and
shapes over time (the balloon) stay leans, not dials. Separate dials also
remove some conflicts: *bouncy* is bounce up, *floating* is ground down.

**The maps, option B** (Mikey, 2026-09-28). The dials pair into five x-y
views, for placing words by ear: color (warmth x lift), shimmer (edge x
height), air (room x ground), motion (energy x bounce) and flavor (tang x
oddness). The engine measures on all ten dials, so a word can use any
dials it needs.

## Decided (Mikey, 2026-10-11)

- **Reflective** leaning brighter since #107 is okay, and reflective can
  also be **neutral** (the middle of the mode axis), not only inward.
- **Cinder and shatter may take a bright mode when a word calls for one**
  (borrowed modes their pools don't have, used only when the word is a
  bright one). Queue item 36 built both.
- **Answers are votes, not verdicts.** Mikey: "don't take my answers as
  the only truth. I'm just one person." Fit regions softly, over many
  answers and days.
- **Word albums** ask about one word at a time ("Is this playlist
  heartwarming? Which songs are not?"). They replace the five-word
  ranking.
