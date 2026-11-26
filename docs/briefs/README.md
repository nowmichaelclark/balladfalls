# Session briefs: the cycle and the types

A hands session (Claude Code) has one type. The type tells the session what
to do and what not to do. This follows Broken Friends' `plan/sessions/`, in
a shorter form: Ballad Falls keeps its queue, its gate and its roles.

Mikey starts a session with: "Run the <type> session. Read
docs/briefs/README.md." If he gives no type, take the first ready line of
the queue's status (`docs/QUEUE.md`, "Status") and use its type.

## The types

| Type | Brief | Job | Model, effort |
|---|---|---|---|
| Build | `build.md` | Does one queue item: code, checks, PR, merge | Opus 5.5, high (core), medium (app) |
| Fix | `fix.md` | Finds, shows and fixes one known issue or a red nightly | Opus 5.5, medium |
| Tune by ear | `tune.md` | Turns Mikey's listening notes into data and defaults | Sonnet 5.5, medium |
| Hygiene | `hygiene.md` | Docs, tests, CI, tools, weak spots | Sonnet 5.5, medium |
| Research | `research.md` | Wiki articles, research for an item | Sonnet 5.5, medium |
| Bird's-eye | `docs/BRAIN.md` | Plans, sorts the inbox, writes the queue | the brain (claude.ai) |

## The cycle

1. **Build:** the ready items of the queue, one PR each.
2. **Fix:** the known issues and a red nightly, before Mikey listens.
3. **Hygiene:** clean after the wave: docs, tools, the inbox's new lines.
4. **Mikey listens:** the brain builds an album from `docs/DONE.md`.
   Mikey listens when he likes. Nothing waits on him.
5. **Tune by ear:** turn his notes into changes. A note that is a bug
   becomes a known issue for Fix.
6. **Bird's-eye:** the brain sorts the inbox and writes the next items.

Research has no fixed place: run it before an item that needs it, or while
the cycle waits for Mikey. A session can stop early. Then it writes, in the
queue's status, which type is next.

## Rules for every type

- Read `AGENTS.md`, the queue's status and its standing rules, and your
  brief. A session that touches `core/` also reads `core/AGENTS.md`.
- Do the work of your type only. Write ideas for later in
  `docs/inbox.md`, one line each.
- Look in `tools/README.md` before you check a thing by hand.
- Write the queue's status again at the end: the line of your item
  changes or leaves.
- End your summary with **Weak spots** (`AGENTS.md`).
