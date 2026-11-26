# The docs: a map

Which doc is for what, and who reads it. Every role loads only its own live
docs. The history before the slim after 1.0 (2026-11-26) left the tree:
`docs/archived.txt` lists it and says where to read it. Sizes and pointers
are checked in CI (`node tools/check-docs.mjs`). The explanations of how the
parts work go to the Workshop Wiki's Ballad Falls pages
(<https://nowmichaelclark.github.io/wiki/>).

## Start here, by role

| Role | Starts at | Then |
|---|---|---|
| Any agent | `AGENTS.md` (the root) | the role's start below |
| Brain | `docs/BRAIN.md`, "Start here" | `docs/DECISIONS.md`, `docs/QUEUE.md`, `ROADMAP.md` |
| Hands | `docs/QUEUE.md`, "Status" | the brief for the line's type (`docs/briefs/`); `core/AGENTS.md` for `core/`; `docs/notes/` for open notes |
| Research (the ears' work since 2026-11-26) | `docs/briefs/research.md` | `tools/ears/README.md`; the wiki's `Ballad Falls/What the ears found` |
| Painter | `docs/PAINTER.md` | `design/README.md`, `design/next-picks.md` |

## The live docs

| Doc | What it is | Read by |
|---|---|---|
| `AGENTS.md`, `CLAUDE.md` | What Ballad Falls is, the roles, the rules that hold everywhere, build and test. `CLAUDE.md` imports it. | everyone |
| `core/AGENTS.md` | The core's standing rules, and the rules for sound items. | hands (core) |
| `docs/QUEUE.md` | The work queue: status (40 lines at most), standing rules, the open items, known issues, the merge policy. | hands, brain |
| `docs/DONE.md` | One line for each merged PR since 1.0 (started fresh 2026-11-26; earlier lines read at commit f040b5b). | hands (to add), brain |
| `docs/archived.txt` | Every path removed at the slim after 1.0, and where its text still reads (the commit before the slim; the driftloom repository). | anyone following an old pointer |
| `docs/briefs/` | The session types (Build, Fix, Tune by ear, Hygiene, Research), the cycle, and a short brief for each. | hands |
| `docs/inbox.md` | Ideas for later, one line each; the brain sorts them. | anyone (to add), brain |
| `tools/README.md` | The toolbox: every tool, what to use it for, how to run it and its limits; what earlier sessions learned. | hands |
| `docs/notes/` | One file for each note from the hands (`<item>-<name>.md`); `for-mikey.md` is the one list of what waits for Mikey's ears, phone, accounts or a decision. | brain, Mikey |
| `docs/BRAIN.md` | How the work is organized, getting oriented, "Start here", listening albums, methods, tools. | brain |
| `docs/DECISIONS.md` | What Mikey has decided: one dated line each, by topic. | brain, hands |
| `ROADMAP.md` | What is still ahead, what was decided against, the contribution rules. | brain |
| `docs/CORE.md` | The core's charter: ten promises, each with its measure, and the phases. | brain, hands (core) |
| `docs/LONGFORM.md` | Long pieces (item 102): the design that stands, the piece map and how to read one, and the pieces to hear. | hands (sessions 12 to 16), brain |
| `docs/PAINTER.md`, `design/` | What there is to paint; the design spec and the picks' brief. | Painter |
| `tools/ears/` | The tools that measure a record and a render the same way, and the ears' raw measurements (`data.csv`). Research sessions run them. | research |
| `docs/MOODS.md`, `docs/VIBES.md` | The mood words, and the vibe recipes (the source is `data/vibes.txt`; `docs/VIBES.md` says how to edit one). | brain |
| `android/` | The Android app (queue item 107): the project, its CI build and smoke test, and `android/README.md` (what is in it, how to build, the ids and the name, releases and their signing, F-Droid). | hands |
| `data/` | The generation data as plain text, read by the core's generator (compiled in) and by the page for its labels and ranges: profiles, vibes, moods, the voice table and the choice tables. The format is in `js/data.js`'s header. | hands, brain (vibes) |
| `docs/ALBUMS.md` | Listening albums out for Mikey (started fresh at 1.0; none is out). | brain |
| `README.md`, `core/README.md`, `core/golden/README.md` | The public front page; how a host drives the core and how to add a block; the golden renders. | everyone; core developers |
| `CHANGELOG.md` | What changed for listeners, in plain words, by release (begun in session 30; session 31 wrote the 1.0 entry). | everyone; whoever makes a release |
| `Mikey's Thoughts.md` | His. | Mikey |

## The archive (removed after 1.0)

`docs/archive/` and `docs/sessions/` left the tree in the slim after 1.0
(2026-11-26), with the Painter's old spec versions and reference pictures.
`docs/archived.txt` lists them. An old pointer such as "item 46" (the text
in `docs/archive/queue-items.md`) or "session 30g" (`docs/sessions/`)
still names that text: read it at the commit `docs/archived.txt` names.
