#!/usr/bin/env python3
"""Report the cost of the workflow, one line for each week.

This is Broken Friends' tool of the same name (its S-231), for Ballad
Falls. The brain or a Hygiene session runs it (docs/briefs/hygiene.md).
It needs no packages, only git. It reads the history of the current branch:

  python3 tools/workflow-cost.py            the last 8 weeks
  python3 tools/workflow-cost.py --weeks 4  the last 4 weeks

The columns:

- Docs only: the commits that change only docs. A file is a doc if its
  name ends in ".md", or if it is in docs/ or design/. Merge commits
  are not counted.
- Read before work: the words that a hands session reads before it
  starts: CLAUDE.md, AGENTS.md, docs/QUEUE.md and the longest brief in
  docs/briefs/.
- Status lines: the lines of the queue's "## Status" section (the cap is
  40, as tools/check-docs.mjs holds it), and the queue's words.

The sizes are those of the last commit of the week. A week is Monday
to Sunday, by commit date. If a number climbs two weeks in a row, the
report says so. Then the brain queues a Hygiene session.
"""
import argparse
import datetime as dt
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
READ_FIRST = [
    "CLAUDE.md",
    "AGENTS.md",
    "docs/QUEUE.md",
]
BRIEFS = "docs/briefs/"
QUEUE = "docs/QUEUE.md"
STATUS_CAP = 40  # the same as STATUS_LINES in tools/check-docs.mjs


def git(*args):
    out = subprocess.run(
        ["git", *args], cwd=ROOT, capture_output=True, text=True, check=True
    )
    return out.stdout


def show(commit, path):
    """The text of a file at a commit, or "" if the file is not there."""
    try:
        return git("show", f"{commit}:{path}")
    except subprocess.CalledProcessError:
        return ""


def is_doc(path):
    return path.endswith(".md") or path.startswith(("docs/", "design/"))


def week_of(day):
    """The Monday of the week of a date."""
    return day - dt.timedelta(days=day.weekday())


def status_lines(queue):
    """The lines from "## Status" to the next "## " heading, or 0."""
    lines = queue.splitlines()
    start = next((i for i, l in enumerate(lines) if l.startswith("## Status")), None)
    if start is None:
        return 0
    end = next(
        (i for i in range(start + 1, len(lines)) if lines[i].startswith("## ")),
        len(lines),
    )
    return end - start


def sizes(commit):
    """Words before work, the longest brief, status lines, queue words."""
    words = sum(len(show(commit, p).split()) for p in READ_FIRST)
    try:
        listed = git("ls-tree", "--name-only", commit, BRIEFS).split()
    except subprocess.CalledProcessError:
        listed = []
    briefs = [p for p in listed if p.endswith(".md") and not p.endswith("README.md")]
    longest = max(briefs, key=lambda p: len(show(commit, p).split()), default="")
    words += len(show(commit, longest).split()) if longest else 0
    words += len(show(commit, BRIEFS + "README.md").split())
    queue = show(commit, QUEUE)
    return words, longest, status_lines(queue), len(queue.split())


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--weeks", type=int, default=8, help="weeks to show")
    args = ap.parse_args()

    if git("rev-parse", "--is-shallow-repository").strip() == "true":
        print(
            "This clone is shallow, so old weeks are missing. "
            "Run: git fetch --unshallow",
            file=sys.stderr,
        )

    # Count the commits of each week (merges are not counted).
    count, docs = {}, {}
    log = git("log", "--no-merges", "--format=@%H %cs", "--name-only")
    for block in log.split("\n@"):
        lines = block.lstrip("@").split("\n")
        if not lines[0]:
            continue
        _, day = lines[0].split()
        files = [f for f in lines[1:] if f]
        week = week_of(dt.date.fromisoformat(day))
        count[week] = count.get(week, 0) + 1
        if files and all(is_doc(f) for f in files):
            docs[week] = docs.get(week, 0) + 1

    # The last commit of each week on the main line.
    last = {}
    for line in git("log", "--first-parent", "--format=%H %cs").splitlines():
        commit, day = line.split()
        last.setdefault(week_of(dt.date.fromisoformat(day)), commit)

    # Every week from the first commit to today. A week with no commit
    # keeps the sizes of the week before it.
    today = week_of(dt.date.today())
    week, weeks = min(set(count) | set(last)), []
    while week <= max(today, *last):
        weeks.append(week)
        week += dt.timedelta(days=7)
    table, commit = [], None
    for week in weeks:
        commit = last.get(week, commit)
        if week not in weeks[-args.weeks:]:
            continue
        words, longest, status, qwords = sizes(commit) if commit else (0, "", 0, 0)
        n, d = count.get(week, 0), docs.get(week, 0)
        share = round(100 * d / n) if n else None  # no commits: no share
        table.append((week, n, d, share, words, longest, status, qwords))

    print("| Week (Monday) | Commits | Docs only | Read before work | Status lines | Queue words |")
    print("|---|---|---|---|---|---|")
    for week, n, d, share, words, _, status, qwords in table:
        mark = " (so far)" if week == today else ""
        cell = f"{d} ({share}%)" if share is not None else "–"
        lines = f"{status} of {STATUS_CAP}" if status else "–"
        print(f"| {week}{mark} | {n} | {cell} | {words:,} words | {lines} | {qwords:,} |")
    if table:
        print(f"\nThe longest brief now: {table[-1][5] or '(none)'}.")

    # A number that climbs two weeks in a row needs a Hygiene session.
    # A week with no status section (before 2026-11-26) does not count.
    names = {3: "Docs-only share", 4: "Read before work", 6: "Status lines", 7: "Queue words"}
    climbs = [
        name
        for i, name in names.items()
        if len(table) >= 3
        and None not in (table[-3][i], table[-2][i], table[-1][i])
        and table[-3][i] != 0
        and table[-3][i] < table[-2][i] < table[-1][i]
    ]
    if climbs:
        print("Climbs two weeks in a row: " + ", ".join(climbs) + ". Queue a Hygiene session.")
    else:
        print("No number climbs two weeks in a row.")


if __name__ == "__main__":
    main()
