# Brain session B-parallel 4: Mikey's last changes, before the polish

Written by brain B-parallel 3 (2026-11-23), at Mikey's request: "I would
still like to start another brain session wrapping up the remaining changes
I would like to do as there are quite a few. Could you write that prompt for
me".

- **Model:** Opus 5.5. **Effort:** high.
- **Where:** a Claude Code session on the repo (the desktop app's Code tab),
  starting each hands session in its own worktree.
- **Start after:** brain B-parallel 3 (its bullet in `docs/BRAIN.md`, "Start
  here"). Session 30 and B5 wait for this one.

Paste everything in the block as the session's first message, then send
your list of changes.

````text
Brain session B-parallel 4 for Driftloom's road to 1.0 (Opus 5.5, high): turn Mikey's remaining changes into hands sessions, run them two at a time, oversee them, and close 30g, so that session 30 and B5 can follow.

Start as docs/BRAIN.md says ("Start here": brain B-parallel 3's bullet first; it is where you pick up). Then read docs/sessions/README.md (the order, every row's After and Alongside, "Rules for every session"), docs/QUEUE.md (status, Known issues, item 115, the merge policy), docs/notes/for-mikey.md, docs/DECISIONS.md's lines of 2026-11-22, docs/PAINTER.md (any change to the look keeps its rules or records Mikey's exception), and the prompts still to come (30g's "Left" list, 30, brain-5). You are the brain: you verify, plan, keep the docs true, and merge; you never write app or core code. The brain may merge any PR once CI is green on its last commit and it checks out against its prompt; nobody waits on the export workflow's long job (docs/DECISIONS.md, "How the project runs").

1. If B-parallel 3's close-out PR ("B-parallel 3 ends: brain B-parallel 4's prompt, the State") is still open, merge it first once its CI is green: it holds this prompt and the State. Then check main's CI and the latest nightly; a red one is the next hands session's to fix, as its own PR.
2. 30g (item 115): #458 is the fix Mikey heard clean on v201 (docs/notes/115-crackles.md). If it is still open, read its last commit's CI and merge it under the policy, then start the nightly by hand on main and read it. 30g's session ends when #458 merges, so its "Left" list (top of docs/sessions/30g-crackles.md) goes to a new session with the same prompt, which may run beside the sessions below.
3. Mikey's list. Ask for it if the first message doesn't hold it. For each change: say back in one line what you understood, ask only where the answer changes what gets built, and record each answer as a dated line in docs/DECISIONS.md (its 40 KB limit is near: move an old long line word for word to docs/archive/decisions-reasoning.md, as before). Group them into small sessions by the files they touch (a session per kind of thing, with a prompt in docs/sessions/ like 30c's: model, effort, After, Alongside, the block, yardsticks, "When you finish"), queue items 116 on, rows in the README's table before 30, and say the order to Mikey. Anything that would hold 1.0 is marked so.
4. Run them, at most two hands sessions at once, each pair named in each other's Alongside with the files kept apart. Give each its versions up front (main's number now; the next for the first to merge, the one after for the second). Start each with its prompt's block as the brief and a background: who runs beside it and what that one changes, what merged since its prompt was written, the lessons below.
5. Oversee. When a session reports, check its PR against its prompt: CI green on its last commit, the yardsticks in the PR body as read back from GitHub, the Done line, the README row ticked. Where a claim matters, measure it yourself (one heavy run at a time on this machine, about 7 GB) or read it from CI's logs. After any PR that moves what is generated, played or drawn, start the nightly by hand on main once that day's merges are done, and read it.
6. Stop when Mikey's changes are merged and he has seen or heard what needs his eyes or ears, or earlier if his usage runs low. Session 30 is next after you, then B5. Leave every running session's state in docs/BRAIN.md's State.

Lessons from B-parallel 3, for you and for each background:
- Auto-fix wakes a session only when something is red, never when CI turns green, and nothing may poll CI. So a session ends its turn saying what it waits on and when; you wake it then, or the next time Mikey writes.
- A session's report isn't proof: read the PR, the logs and the body from GitHub. Twice that day a test passed that tested nothing (a swipe that never scrolled; test loops that printed "ok" on a failure).
- An APK built before a merge doesn't have that merge, whatever its version label says (Mikey saw v201's test APK without v200's sideways swap). Say which commit a build is from.
- Downloading a CI artifact needs Mikey's OK first, each time (file, source, size). Artifact links 404 unless signed in to GitHub; with his OK the brain can download one and send him the APK.
- Phone-only behavior (the browser's insets, a collapsing address bar, the screen off) can't be proven in emulation: ask Mikey for a short check, and his ears close audio items.
- Mikey's browser: DuckDuckGo usually, Chrome for some tests; the phone is a moto g stylus 5G (2022). The design checks are in for-mikey.md.
- Ten rows runs take 60 to 80 minutes; versions must be given up front so two sessions don't collide; never rebase or force-push, merge main in.
- Never write a token or Mikey's personal email anywhere.

Always, before you end: Mikey's answers as dated lines in docs/DECISIONS.md, answered lines out of for-mikey.md; docs/BRAIN.md's State current; the archive pass and node tools/check-docs.mjs. Tell Mikey in a few plain lines what merged, what you verified, what waits on him, and what is still running.
````
