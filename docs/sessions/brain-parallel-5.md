# Brain session B-parallel 5: the rest of Mikey's changes, in the cloud

Written by brain B-parallel 4 (2026-11-24), at Mikey's request: "After these
two finish though I am going to start a new brain session that completes
whatever is left, so can you prepare that for me? ... I'm going to use my
other account (Kruu Mikey) to finish things up with claude cloud sessions I
think".

- **Model:** Opus 5.5. **Effort:** high.
- **Where:** a Claude Code cloud session (claude.ai/code) on Mikey's other
  account, on this repo. It can't start hands sessions itself: it writes
  each one's opening message for Mikey to paste into a new cloud session,
  and oversees them by their PRs.
- **Start after:** brain B-parallel 4 (its bullet in `docs/BRAIN.md`, "Start
  here", says what was still running when it ended). Session 30 and B5 wait
  for this one.

Paste everything in the block as the session's first message.

````text
Brain session B-parallel 5 for Driftloom's road to 1.0 (Opus 5.5, high), in a Claude Code cloud session on Mikey's other account: finish Mikey's last changes (items 116 to 122, sessions 30h to 30n) and 30g's Left list, so that session 30 and B5 can follow.

Start as docs/BRAIN.md says ("Start here": brain B-parallel 4's bullet first; it is where you pick up). Then read docs/sessions/README.md (the order, every row's After and Alongside, "Rules for every session"), docs/QUEUE.md (status, Known issues, items 115 to 122, the merge policy), docs/notes/for-mikey.md, docs/DECISIONS.md's lines of 2026-11-22 to 24, docs/PAINTER.md, and the prompts still to come (30k to 30n, 30g's "Left" list, 30, brain-5). You are the brain: you verify, plan, keep the docs true, and merge; you never write app or core code. The brain may merge any PR once CI is green on its last commit and it checks out against its prompt; nobody waits on the export workflow's long job (docs/DECISIONS.md, "How the project runs").

1. First, what you can reach: check that you can read the repo, read CI (`gh run list`, job logs), comment on and merge PRs. If GitHub's API is closed to this session, say so to Mikey at once: he may paste a token for the session (use it, never keep it), or merge on your word.
2. Pick up the three sessions B-parallel 4 stopped at Mikey's word, each with a "Left" list at the top of its file: 30m (#467, the album export: three checks to see green, then the docs), 30k (draft #468, the look: Mikey's playhead pick, the bead, and the rest of its steps), 30l (draft #465, the new name's icon: Mikey is still changing the drawing). For each, write a new session's opening message for Mikey to paste: its prompt's block, a background that says to start from the Left list on the PR's own branch, and the lessons below. Check each PR against its prompt and merge it under the policy. #465 stays open on purpose: session 31 merges it with 31a's, and its session needs the new name, which Mikey pastes into that session himself (never into this repo).
3. Start what is left, in the README's order and Alongside: 30n (the keys, after 30h, 30j, 30k and 30m) and 30g's Left list (a new session with 30g's prompt; it may run beside 30n). You can't start sessions yourself, so for each, write its opening message for Mikey to paste into a new cloud session: the prompt's block from its file, then a background: what runs beside it and what that one changes, what merged since its prompt was written, its version (main's number now, the next for the first to merge), and the lessons below. At most two hands sessions at once.
4. Oversee. When Mikey says a session reported, check its PR: CI green on its last commit, the yardsticks in the PR body as read back from GitHub, the Done line, the README row ticked. Where a claim matters, measure it yourself in the cloud, or read it from CI's logs. After the day's merges that move what is generated, played or drawn, start the nightly by hand on main (`gh workflow run nightly.yml --ref main`) and read it.
5. Stop when 30h to 30n (all but 30l's open draft) and 30g's Left list are merged, and Mikey has seen or heard what needs his eyes or ears; or earlier if his usage runs low. Session 30 is next after you, then B5. Leave every running session's state in docs/BRAIN.md's State.

Lessons from B-parallel 3 and 4, for you and for each background:
- Nothing wakes a session when CI turns green, and nothing may poll CI. So a session ends its turn saying what it waits on and when; Mikey or you go back to it then.
- A session's report isn't proof: read the PR, the logs and the body from GitHub. More than once a test passed that tested nothing, and a row was made to listen longer before anyone knew why it failed: ask for the cause (B-par4: a random loop silent for 6 s; pinning the rows to a fixed busy loop fixed it).
- Two export-workflow dispatches on one branch a second apart cancel the first while it's pending (its concurrency group): dispatch ten rows alone. Ten rows now take about 90 minutes.
- Since #462 about 1 loop in 10 with nothing asked is a long piece: a test or row that takes a fresh loop as short needs a fixed seed.
- Known flakes, re-run once: the Kotlin Gradle plugin's download; the Android smoke check's blocked page on a quiet random loop; longform.rs's "a section costs the same" timing.
- The new name, and its icon's subject, stay out of the repo, its commits and PR text until 31a (docs/DECISIONS.md, 2026-11-11). The icon's draft #465 merges with 31a.
- An APK built before a merge doesn't have that merge: say which commit a build is from. Downloading a CI artifact needs Mikey's OK, each time.
- Phone-only behavior (Chrome's address bar, the screen off) can't be proven in emulation: ask Mikey for a short check, and his ears close audio items.
- Mikey's browser: DuckDuckGo usually, Chrome for some tests; the phone is a moto g stylus 5G (2022). He may answer a session directly; record his picks in its PR.
- Versions must be given up front so two sessions don't collide; never rebase or force-push, merge main in.
- Never write a token or Mikey's personal email anywhere.

Always, before you end: Mikey's answers as dated lines in docs/DECISIONS.md (its 40 KB limit is near: move an old long line word for word to docs/archive/decisions-reasoning.md), answered lines out of for-mikey.md; docs/BRAIN.md's State current; the archive pass and node tools/check-docs.mjs. Tell Mikey in a few plain lines what merged, what you verified, what waits on him, and what is still running.
````
