# The docs: a map

This page says what each doc is for and who reads it. Each role reads only
its own docs, so that a session starts fast. CI checks the size of each live
doc and every pointer into `docs/` and `design/` (`node tools/check-docs.mjs`).

The wiki explains how the parts work inside and why they are that way. Read
the Ballad Falls pages of the Workshop Wiki
(<https://nowmichaelclark.github.io/wiki/>). The repository keeps only what
the work needs now.

## Start here, by role

| Role | Start at | Then read |
|---|---|---|
| Any agent | `AGENTS.md` (in the root) | the start for your role, below |
| Brain | `docs/BRAIN.md`, "Start here" | `docs/DECISIONS.md`, `docs/QUEUE.md`, `ROADMAP.md` |
| Hands | `docs/QUEUE.md`, "Status" | the brief for the item's type (`docs/briefs/`); `core/AGENTS.md` if you touch `core/`; the open notes in `docs/notes/` |
| Research | `docs/briefs/research.md` | `tools/ears/README.md`; the wiki page "What the ears found" |
| Painter | `docs/PAINTER.md` | `design/README.md`, `design/next-picks.md` |

## The live docs

| Doc | What it is | Who reads it |
|---|---|---|
| `AGENTS.md`, `CLAUDE.md` | What Ballad Falls is, the roles, the rules for all work, and the build and test commands. `CLAUDE.md` imports `AGENTS.md`. | everyone |
| `README.md` | The front page: what the app is, how it works, the folders, and how to run it. | everyone |
| `core/README.md` | How a host drives the core, how the sound is built, and how to add a block. | core developers |
| `core/AGENTS.md` | The rules for work in `core/`, and the rules for new sounds. | hands (core) |
| `core/golden/README.md` | The golden renders: stored results that the tests compare with. | hands (core) |
| `docs/QUEUE.md` | The work queue: the status table (40 lines at most), the standing rules, the open items, the known issues and the merge policy. | hands, brain |
| `docs/briefs/` | The session types (Build, Fix, Tune by ear, Hygiene, Research), with a short brief for each. | hands |
| `docs/DONE.md` | One line for each PR merged since 1.0. | hands (to add), brain |
| `docs/inbox.md` | Ideas for later, one line each. The brain sorts them. | anyone (to add), brain |
| `docs/notes/` | One file for each open note from the hands. `for-mikey.md` is the one list of what waits for Mikey's ears, phone, accounts or a decision. | brain, Mikey |
| `tools/README.md` | The toolbox: each tool, what it is for, how to run it, and its limits. | hands |
| `tools/ears/` | The tools that measure a record and a render in the same way, and their measurements (`data.csv`). | research |
| `docs/BRAIN.md` | How the work is organized, listening albums, methods and the current state. | brain |
| `docs/DECISIONS.md` | What Mikey decided: one dated line for each decision, by topic. | brain, hands |
| `ROADMAP.md` | What is still ahead, what was decided against, and the rules for contributions. | brain |
| `docs/CORE.md` | The core's charter: ten promises, each with its measure. | brain, hands (core) |
| `docs/LONGFORM.md` | Long pieces: the design, the piece map and how to read it, and the pieces to hear. | hands, brain |
| `docs/MOODS.md`, `docs/VIBES.md` | The mood words, and the vibe recipes. The source of the vibes is `data/vibes.txt`; `docs/VIBES.md` says how to edit one. | brain |
| `docs/ALBUMS.md` | The listening albums that wait for Mikey's answers. | brain |
| `docs/PAINTER.md`, `design/` | What there is to design, the design spec, and the brief for the picks. | Painter |
| `android/README.md` | The Android app: what is in it, how to build it, the ids and the name, releases and their signing, and F-Droid. | hands |
| `data/` | The generation data as plain text: profiles, vibes, moods, voices, choices and codes. The core compiles it in, and the page reads it for its labels and ranges. `js/data.js` describes the format. | hands, brain (vibes) |
| `CHANGELOG.md` | What changed for listeners, in plain words, for each release. | everyone |
| `Mikey's Thoughts.md` | Mikey's own notes. | Mikey |

## Old pointers

Some text left the repository after 1.0 (2026-11-26). `docs/archived.txt`
lists each removed path and the commit where you can still read it. Older
history is in the archived
[driftloom](https://github.com/nowmichaelclark/driftloom) repository.

Some docs and comments name a queue item ("item 46") or a session ("session
30g"). These names point to the old text: `docs/archive/queue-items.md` for
items and `docs/sessions/` for sessions. Read them at the commit that
`docs/archived.txt` names.
