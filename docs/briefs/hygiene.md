# Hygiene session: clean after a wave

## Read first

Read `AGENTS.md`, the queue's status, `docs/README.md` (the map of the
docs) and `tools/README.md`.

## Steps

1. Run `node tools/check-docs.mjs --list`. Take finished parts out of a
   doc that is near its limit. Do not raise a limit.
2. Read the docs that the last wave changed. Fix a stale line, a broken
   pointer or a rule that two docs say in two ways.
3. Read the tools' "Limits" cells. Make a weak tool better if the fix is
   small; else write the fault there.
4. Run `python3 tools/workflow-cost.py`. If a number climbs, say why in
   the summary, and cut what is not needed.
5. Move the inbox's lines that are now queue items, done or wrong out of
   `docs/inbox.md`. The brain sorts the rest.
6. Make one docs-only PR. A docs-only PR needs no `BUILD` bump.

## Do not

- Do not change code that plays or generates. That is a Build or a Fix.
