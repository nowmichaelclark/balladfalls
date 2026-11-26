# Build session: one queue item

## Read first

Read `AGENTS.md`, the queue's status, its standing rules and its merge
policy, and the full text of your item (`docs/QUEUE.md`). If the item
touches `core/`, read `core/AGENTS.md`. Then read only the code that you
will change.

## Steps

1. Write the item's checks again in your own words. If the item has no
   checks, stop and leave a note (`docs/notes/<item>-<name>.md`).
2. Look for what is known before you code: the wiki's `Ballad Falls/`
   pages, and the tools in `tools/README.md`.
3. Build in small steps. After each step, run the tests that the change
   touches.
4. Keep tuning values as data (`data/*.txt`) where the core already reads
   data. Do not add a constant where a data line fits.
5. If the item leaves a musical choice open, take the conservative option.
   Mark it "for Mikey's ears" in the PR.
6. Open one PR from the latest `main`. Bump `BUILD` and `CACHE` for an app
   change. Merge it when CI is green and the item's checks pass.
7. Add the item's line to `docs/DONE.md`. Take the item out of the queue.

## Done when

- Every check of the item passes, and a test or a printed number shows it.
- CI's gate is green on the PR's last commit.
- The queue's status, `docs/DONE.md` and the item's text are up to date.

## Do not

- Do not plan past your item. Write ideas in `docs/inbox.md`.
- Do not ask Mikey technical questions. Read Diagnostics and the tools.
