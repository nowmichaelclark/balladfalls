# Done

One line for each PR that merged, newest last: the PR number, the version, the
commit preview URL, and what the ears should listen for. Add yours when your PR
merges (`docs/QUEUE.md`, standing rules). Started fresh at 1.0 (Mikey,
2026-11-26): the lines from #357 to #482, the road to 1.0, read at commit
f040b5b (`docs/DONE.md` there); older ones are in the archived driftloom
repository.

- balladfalls #1 (the new repository's numbers start again), the new name's
  icon (item 120, session 30l, merged by session 31; v220 a placeholder):
  `icons/icon.svg`, round 20's c, every size made from it by
  `tools/icons.mjs`, the app, the favicon and the Android launcher. Look, no
  listening. No album loop.
- balladfalls #2, the new name (session 31a, merged by session 31, v221):
  Ballad Falls at balladfalls.com, the release id `com.balladfalls.app`, the
  old address's Worker in `old-address/` (deployed on launch day). Nothing
  should sound different. No album loop.
- balladfalls #3, 1.0 (item 108, session 31, v222): the version 1.0 in the app
  (Advanced's last line, Diagnostics' first) and the APK (versionName 1.0,
  code 10000), CHANGELOG.md dated, codes frozen (`core/golden/frozen-codes.txt`,
  `test/frozen-codes.test.mjs`), the nightly kept nightly in the merge policy
  (Mikey, 2026-11-25). Nothing should sound different. No album loop.
- balladfalls #4, the release signed by GitHub (Mikey, 2026-11-25; no app
  change): the release workflow signs the universal APK with the key in the
  repository's secrets (apksigner 34), checks its certificate, and attaches
  `balladfalls-<version>.apk` to the tag's release; by hand with a tag it signs
  that release again. Nothing to hear.
- balladfalls #5, the old address's Worker as connected (Mikey, 2026-11-25;
  docs only): `docs/notes/for-mikey.md` says how the `driftloom` Worker builds
  from this repository's `main` (the deploy command's `cd old-address`; the
  root `wrangler.jsonc` keeps its name). Nothing to hear.
- balladfalls #6, the old address's page fixed (2026-11-25; the old-address
  Worker only): wrangler's `keep_names` had put `__name` into the page script
  the Worker sends as text, so the old address showed a blank page; now off,
  with a shim and a test that runs the bundled script. The old link then
  landed on balladfalls.com with its loop playing. Nothing to hear.
- balladfalls #7, the F-Droid listing's screenshots retaken (Mikey,
  2026-11-25; no app change): seven screens, each with a loop and cover of its
  own and a theme of its own (Nocturne, Dawn, Tidal, Ember, Abyss, Night Light,
  AMOLED), by `android/screenshots.mjs` on CI's emulator. The F-Droid recipe
  names this merge for 1.0, since F-Droid reads the listing from the commit it
  builds. Nothing to hear.
- balladfalls #8, the docs after 1.0 (Mikey, 2026-11-26; docs only): the
  queue, the brain's Start here, for-mikey, the sessions' table, the README
  and the changelog say 1.0 is out, the old address forwards, driftloom is
  archived and F-Droid's review (!59136) is open; what was done is archived.
  Nothing to hear.
- balladfalls #9, the slim after 1.0, part 1 (Mikey, 2026-11-26; docs and
  tools only): `docs/archive/`, `docs/sessions/`, the Painter's old pictures
  and spec versions and five closed notes leave the tree (listed in
  `docs/archived.txt`, still readable at 72b13f0 and in driftloom);
  `tools/check-docs.mjs` fails on a broken pointer into `docs/` or `design/`;
  `fastlane/` no longer deploys with the site. Nothing to hear.
- balladfalls #10, the slim after 1.0, part 2 (Mikey, 2026-11-26; docs only):
  the ears' batch reports, album cards, prompts, first sketches and raw
  archives (21 MB) and item 82's note for Broken Friends leave the tree, now
  that the wiki's Ballad Falls pages tell what they found (listed in
  `docs/archived.txt`); F-Droid's recipe no longer deletes `docs/ears/raw`.
  `docs/ears/plan.md`, `sessions.md`, `data.csv` and `tools/ears/` stay
  until Mikey says whether the ears go on. Nothing to hear.
- balladfalls #11, what Ballad Falls takes from Broken Friends (Mikey,
  2026-11-26; docs and tools only): the queue's status is a table of one
  line an item with its type, model and effort, held to 40 lines by
  `tools/check-docs.mjs`; session briefs and the cycle in `docs/briefs/`;
  `docs/inbox.md` for ideas (the queue's "Later, not queued" moved there);
  `tools/README.md` lists every tool with its use, its command and its
  limits; `AGENTS.md` has the voice rules shared with Broken Friends;
  `docs/notes/for-mikey.md` opens with a table of sittings;
  `tools/workflow-cost.py` reports the workflow's cost week by week.
  Nothing to hear.
- balladfalls #12, Mikey's five answers after 1.0 (2026-11-26; docs and
  tools only): the ears fold into Research (`docs/EARS.md` and `docs/ears/`
  leave, their lasting parts are three new wiki pages, wiki #3;
  `tools/ears/` and its `data.csv` stay); no baked design spec is kept;
  `docs/DONE.md` and `docs/ALBUMS.md` start fresh and the four albums that
  were out retire; no listening gate; the decisions in `docs/DECISIONS.md`,
  whose links to the removed reasoning file are now plain text. Nothing to
  hear.
- balladfalls #13, the history's fresh start queued (Mikey, 2026-11-26; docs
  only): queue item H1 starts the history again at 1.0 once F-Droid lists
  1.0, with a bundle of the old history on the `v1.0` release. Nothing to
  hear.
- balladfalls #14, the plain style, a sample (Mikey, 2026-11-26: "everything
  looks good"): the README and the comments of `js/player.js` in the Broken
  Friends style. The code is the same. Nothing to hear.
- balladfalls #15, the plain style, the entry docs (docs only): `docs/README.md`
  and `core/AGENTS.md` rewritten, and small fixes in `tools/README.md`.
  Nothing to hear.
- balladfalls #16, the plain style, the core's guide (docs only):
  `core/README.md` is now a short guide with a table of the parts, and the
  detail moves to `core/docs/` (`blocks.md`, `player.md`, `codes.md`).
  Nothing to hear.
- balladfalls #16, the plain style, the Android guide (docs only):
  `android/README.md` rewritten, with a short "How it works" first. Nothing
  to hear.
