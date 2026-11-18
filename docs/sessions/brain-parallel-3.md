# Brain session B-parallel 3: the seven's end, two at a time

Written by brain B-parallel 2 (2026-11-18), when Mikey's usage on that account ran out. He goes on from another account, so nothing here leans on that account's project, its threads or its files: the repo is the whole handover.

- **Model:** Opus 5.5. **Effort:** high.
- **Where:** a Claude Code session on the repo (the desktop app's Code tab on the repo's own folder, starting each hands session in its own worktree; or a claude.ai project whose coordinator starts each hands session as a thread on the brain's word).
- **Start after:** brain B-parallel 2 (its State in `docs/BRAIN.md`).

Paste everything in the block as the session's first message.

````text
Brain session B-parallel 3 for Driftloom's road to 1.0 (Opus 5.5, high): finish Mikey's seven, two hands sessions at a time, and oversee them.

Start as docs/BRAIN.md says ("Start here": brain B-parallel 2's bullet first; its State is where you pick up, then B4's). Then read docs/sessions/README.md (the order from 17 on: every row's After and Alongside, "Mikey's seven", "Rules for every session"), docs/QUEUE.md (status, items 109 to 114, the merge policy), docs/notes/for-mikey.md, docs/DECISIONS.md's lines of 2026-11-18, and the prompts still to come (30c, 30d, 24c, 30e, 30f, 30; brain-5 for where B5 starts). You are the brain: you verify, plan, keep the docs true; you never write app or core code. Mikey, 2026-11-18: the brain may merge any PR once CI is green on its last commit and it checks out against its prompt, and nobody waits on the export workflow's long job (docs/DECISIONS.md, "How the project runs").

1. Check main's CI and the latest nightly (.github/workflows/nightly.yml) first; a red one is the next hands session's to fix, as its own PR.
2. The rows left, in order: 30d (resume from its draft PR and the "Left" list at the top of docs/sessions/30d-info-card.md, if B-parallel 2's State says it stopped partway), 30c, then 24c (after 30c), then 30e (after 30a to 30d), 30f, 30. At most two hands sessions at once, each pair named in each other's Alongside. Start each with its prompt's block as the whole brief, the model and effort its file names, and a background (below).
3. Oversee. When a session reports, check its PR against its prompt: CI green on its last commit, the yardsticks in the PR body (not only in the session's chat), the Done line, the README row ticked with every cell's `|` kept. Where a claim matters, measure it yourself (one heavy run at a time) or read it from CI. A session idle with its PR green: merge it yourself or tell it to. After any PR that moves what is generated, played or drawn, start the nightly by hand on main and read it.
4. Stop when 30e has merged, or earlier if Mikey's usage runs low: 30f, 30 and B5 are the next brain's. Leave every running session's state in docs/BRAIN.md's State.

The background to give each hands session (fill in the names and numbers):
- Who runs beside it (its row's Alongside must name it), and what that one changes, so a clash is said, not guessed.
- What merged since its prompt was written that it must keep (for example 30b's layers, 24b's paced album codes).
- The gate is read from CI: core and docs green on the last commit, longform where it runs, the export rows; not the export workflow's long job. Run a part locally only to find a failure, one heavy run at a time.
- Versions: main's number now; the first of the pair to merge takes the next; the second merges main in (never rebase or force-push), takes main's js/dlplayer.wasm and BUILD/CACHE, rebuilds, takes the number after, and lets CI run again. Run tools/build-core.sh --check on the last source before pushing a module.
- Subscribe to the PR's activity (or wait in the background) rather than ending the turn with CI running; merge when green. The core's sketch job has a timing test (tests/longform.rs, "a section costs the same at one and at a billion") that flakes now and then: one re-run.
- Report: PR, last commit, CI's runs, the yardsticks, the Done line, the row ticked, what went into for-mikey.md.

Always, before you end: Mikey's answers as dated lines in docs/DECISIONS.md, answered lines out of for-mikey.md; docs/BRAIN.md's State current; the archive pass and node tools/check-docs.mjs. Tell Mikey in a few plain lines what merged, what you verified, what waits on him, and what is still running.
````
