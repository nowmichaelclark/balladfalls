# Fix session: one known issue, shown and fixed

## Read first

Read `AGENTS.md`, the queue's status and its "Known issues", and the issue
that you fix. Look at the latest `nightly.yml` run on `main`. A red nightly
with a reason in the code comes first.

## Steps

1. Show the issue before you fix it: a test, a tool's output or a render
   that fails. Add that test to the suite if it is fast.
2. Find the cause. "A flake" is not a cause.
3. Fix the cause in one PR. The test from step 1 now passes.
4. If the fix moves the sound, follow the queue's standing rules for
   sound (the baseline, the long pieces, the stored render hashes).
5. Take the issue out of "Known issues", and add its line to
   `docs/DONE.md`.

## Do not

- Do not skip, disable or loosen a test to get green.
- Do not fix two issues in one PR.
- If you cannot show the issue, say so in a note and stop.
