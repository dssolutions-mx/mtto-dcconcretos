#!/usr/bin/env python3
"""Extract one version section from CHANGELOG.md for GitHub release notes (stdout)."""
from __future__ import annotations

import re
import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 2:
        sys.stderr.write("usage: extract-changelog-section.py <version>\n  example: extract-changelog-section.py 0.3.0\n")
        sys.exit(2)
    version = sys.argv[1]
    text = Path("CHANGELOG.md").read_text(encoding="utf-8")
    pattern = rf"^## \[{re.escape(version)}\].*?(?=^## \[|\Z)"
    m = re.search(pattern, text, flags=re.MULTILINE | re.DOTALL)
    if not m:
        sys.stderr.write(f"version [{version}] not found in CHANGELOG.md\n")
        sys.exit(1)
    body = m.group(0).rstrip()
    # Footer compare links ([Unreleased]: / [0.x.y]:) are not part of the release notes.
    trim = re.search(r"\n\n\[(?:Unreleased|\d+\.\d+\.\d+)\]: https?://", body)
    if trim:
        body = body[: trim.start()].rstrip()
    print(body)


if __name__ == "__main__":
    main()
