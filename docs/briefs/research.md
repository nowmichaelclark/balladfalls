# Research session: what is known, in the wiki

Research goes in the Workshop Wiki (`nowmichaelclark/wiki`, folder
`Ballad Falls/`), as Broken Friends does it. Follow the wiki's
`CLAUDE.md`. In this repo, link to the article and keep only the result
that an item needs.

## Steps

1. Write the question that the item or the brain asks, in one sentence.
2. Read what the wiki already has. Do not write an article that exists.
3. Find two or three sources: papers, open-source code, articles. Note
   each source's method, its cost and its license.
4. Write the article in the wiki's style. Never invent a source. If you
   cannot check a fact against a page that you read, leave it out.
5. Link the article from the item, or from `docs/inbox.md`.

## Measuring a record

Since 2026-11-26 the ears' work is a Research session (Mikey: the ears
fold into Research). The question is then "how does this record differ
from Ballad Falls?"

1. Read the wiki's "Ballad Falls/What the ears found" and its subpage
   "Measuring a record": the method, each measure's limits and the traps.
2. Run the tools in `tools/ears/` (its README says how) on the record and
   on Ballad Falls renders, the same way. Use `python3 -P` on downloaded
   audio.
3. Give each difference a yardstick that a Build session can test.
4. Write the findings in the wiki. Put the raw numbers in
   `tools/ears/data.csv` if they are new rows.
5. Never build a sound in the app. Sketch it offline; the brain queues it.

## Do not

- Do not copy code with a license that does not fit this repo.
- Do not change the app or the core.
