#!/usr/bin/env python3
"""
Build monthly release history from git (origin/main), write docs, and print notes for GitHub Releases.

Tag convention: monthly-YYYY-MM (calendar snapshot; not semver — see CHANGELOG.md for semver v0.x).

Timezone: America/Chicago-style -06:00 for month boundaries (matches dominant author timestamps in this repo).
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

TZ_SUFFIX = "-06:00"
GIT_REF = "origin/main"
REPO_COMPARE = "https://github.com/dssolutions-mx/mtto-dcconcretos/compare"


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], text=True).strip()


def month_bounds(y: int, m: int) -> tuple[str, str]:
    """ISO start (inclusive) and next month start (exclusive) for git --since / --before."""
    if m == 12:
        ny, nm = y + 1, 1
    else:
        ny, nm = y, m + 1
    since = f"{y}-{m:02d}-01T00:00:00{TZ_SUFFIX}"
    before = f"{ny}-{nm:02d}-01T00:00:00{TZ_SUFFIX}"
    return since, before


def iter_months(first_y: int, first_m: int, last_y: int, last_m: int):
    y, m = first_y, first_m
    while (y, m) <= (last_y, last_m):
        yield y, m
        if m == 12:
            y, m = y + 1, 1
        else:
            m += 1


def month_tip(ref: str, y: int, m: int) -> str | None:
    since, before = month_bounds(y, m)
    out = git("log", ref, f"--since={since}", f"--before={before}", "-1", "--format=%H")
    return out or None


def month_subjects(ref: str, y: int, m: int) -> list[str]:
    since, before = month_bounds(y, m)
    raw = git(
        "log",
        ref,
        f"--since={since}",
        f"--before={before}",
        "--reverse",
        "--format=%s",
    )
    return [ln for ln in raw.splitlines() if ln.strip()]


def bucket(subject: str) -> str:
    s = subject.strip()
    sl = s.lower()
    if re.match(r"^fix[\(:]", sl) or sl.startswith("'fix") or sl.startswith("fixed"):
        return "Fixed"
    if re.match(r"^feat[\(:]", sl) or sl.startswith("'feat"):
        return "Added"
    if re.match(r"^(security|chore\(security\))", sl) or " rls" in sl or sl.startswith("rls "):
        return "Security"
    if sl.startswith("add ") or sl.startswith("added ") or "implementación" in sl[:20] or sl.startswith("implement "):
        return "Added"
    if re.match(r"^(remove|delete|drop)", sl) or sl.startswith("'remove"):
        return "Removed"
    return "Changed"


def build_notes_markdown(
    y: int,
    m: int,
    tip: str,
    prev_tip: str | None,
    subjects: list[str],
) -> str:
    tag = f"monthly-{y}-{m:02d}"
    lines: list[str] = [
        f"## Monthly · {y}-{m:02d}",
        "",
        f"**Snapshot:** [`{tip[:7]}`](https://github.com/dssolutions-mx/mtto-dcconcretos/commit/{tip}) (last commit on `main` in this calendar month, `{TZ_SUFFIX}` boundaries).",
        "",
    ]
    if prev_tip:
        lines.append(
            f"**Diff vs previous month:** [{prev_tip[:7]}…{tip[:7]}]({REPO_COMPARE}/{prev_tip}...{tip})"
        )
        lines.append("")
    else:
        lines.append("**Diff vs previous month:** *(first monthly snapshot — project started this month.)*")
        lines.append("")
    lines.append(f"**Commits this month:** {len(subjects)}")
    lines.append("")
    buckets: dict[str, list[str]] = {k: [] for k in ("Added", "Changed", "Fixed", "Removed", "Security")}
    for subj in subjects:
        buckets[bucket(subj)].append(subj)
    for cat in ("Added", "Changed", "Fixed", "Security", "Removed"):
        items = buckets[cat]
        if not items:
            continue
        lines.append(f"### {cat}")
        lines.append("")
        for s in items:
            lines.append(f"- {s}")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def repo_month_range(ref: str) -> tuple[int, int, int, int]:
    root = git("rev-list", "--max-parents=0", ref)
    first_ci = git("log", "-1", "--format=%ci", root)
    last_ci = git("log", ref, "-1", "--format=%ci")
    # "2025-05-06 18:02:11 -0600"

    def ym(ci: str) -> tuple[int, int]:
        d = datetime.strptime(ci[:10], "%Y-%m-%d")
        return d.year, d.month

    fy, fm = ym(first_ci)
    ly, lm = ym(last_ci)
    return fy, fm, ly, lm


def main() -> None:
    ap = argparse.ArgumentParser(description="Monthly release history from git")
    ap.add_argument("--ref", default=GIT_REF, help="git ref (default origin/main)")
    ap.add_argument(
        "--write-docs",
        action="store_true",
        help="Write docs/release-history-monthly.md",
    )
    ap.add_argument("--print-notes", metavar="YYYY-MM", help="Print GitHub release notes for one month")
    ap.add_argument("--tip", metavar="YYYY-MM", help="Print tip full SHA for one month")
    args = ap.parse_args()
    ref = args.ref

    try:
        git("rev-parse", "--verify", ref)
    except subprocess.CalledProcessError:
        print(f"fatal: ref {ref} not found; run: git fetch origin main", file=sys.stderr)
        sys.exit(1)

    fy, fm, ly, lm = repo_month_range(ref)

    if args.tip:
        y, m = map(int, args.tip.split("-"))
        t = month_tip(ref, y, m)
        print(t or "")
        return

    if args.print_notes:
        y, m = map(int, args.print_notes.split("-"))
        months = list(iter_months(fy, fm, ly, lm))
        prev_full: str | None = None
        for yy, mm in months:
            t = month_tip(ref, yy, mm)
            if not t:
                continue
            if yy == y and mm == m:
                subs = month_subjects(ref, y, m)
                print(build_notes_markdown(y, m, t, prev_full, subs))
                return
            prev_full = t
        print(f"month {args.print_notes} not in range", file=sys.stderr)
        sys.exit(1)

    if args.write_docs:
        parts: list[str] = [
            "# Monthly release history (main)\n",
            "Calendar-month snapshots of `main`, auto-grouped from commit subjects (heuristic: not as strict as manual semver notes).\n",
            "Semver releases: see [CHANGELOG.md](../CHANGELOG.md).\n",
        ]
        prev_full: str | None = None
        for y, m in iter_months(fy, fm, ly, lm):
            tip = month_tip(ref, y, m)
            if not tip:
                continue
            subs = month_subjects(ref, y, m)
            parts.append(build_notes_markdown(y, m, tip, prev_full, subs))
            parts.append("\n---\n\n")
            prev_full = tip
        out = Path("docs/release-history-monthly.md")
        out.write_text("".join(parts).rstrip() + "\n", encoding="utf-8")
        print(f"wrote {out}")
        return

    ap.print_help()
    sys.exit(2)


if __name__ == "__main__":
    main()
