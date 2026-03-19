# Weekly release habit (semver + GitHub Releases)

Ship a **versioned** GitHub Release each week so the **Releases** page matches common industry practice: [Semantic Versioning](https://semver.org/), [Keep a Changelog](https://keepachangelog.com/) in [`CHANGELOG.md`](../CHANGELOG.md), and structured sections (**Added** / **Changed** / **Fixed** / **Security** / …).

## 1. Update the changelog

Edit [`CHANGELOG.md`](../CHANGELOG.md):

1. Move content from `[Unreleased]` into a new section `## [0.x.y] - YYYY-MM-DD`.
2. Group bullets under the standard headings (Added, Changed, Fixed, Deprecated, Removed, Security).
3. Add compare links at the bottom (`[0.x.y]: …compare/v…`).

Bump **`package.json`** `version` to match the release you are cutting (same `0.x.y`).

## 2. Commit

```bash
git add CHANGELOG.md package.json
git commit -m "chore(release): v0.x.y"
```

## 3. Tag (annotated) at that commit

```bash
git tag -a v0.x.y -m "Release v0.x.y"
git push origin v0.x.y
```

## 4. Publish the GitHub Release (structured notes from CHANGELOG)

```bash
python3 scripts/extract-changelog-section.py 0.x.y > /tmp/release-notes.md
gh release create "v0.x.y" \
  --title "v0.x.y — <short product headline>" \
  --notes-file /tmp/release-notes.md
```

GitHub attaches the release to tag `v0.x.y` (create the tag first, as above).

---

## Published versions (backfill)

| Version | Week (end) | Compare |
|--------|------------|---------|
| [v0.2.0](https://github.com/dssolutions-mx/mtto-dcconcretos/releases/tag/v0.2.0) | 2026-03-05 | tooling / scripts |
| [v0.3.0](https://github.com/dssolutions-mx/mtto-dcconcretos/releases/tag/v0.3.0) | 2026-03-12 | PO workflow, RLS, checklists, activos, WO page |
| [v0.4.0](https://github.com/dssolutions-mx/mtto-dcconcretos/releases/tag/v0.4.0) | 2026-03-19 | WO/incidents, security, PO UX, calendar |

Short celebratory line for yourself: three minors in a row is a lot of surface area shipped—keep the changelog honest and you’ll see the arc.

---

## Monthly snapshots (full history on `main`)

Tags **`monthly-YYYY-MM`** mark the **last commit on `main`** inside each calendar month (America/Chicago `-06:00` month boundaries). Each has a GitHub Release titled **Monthly · May 2025** style (full month name + year) with **Added / Changed / Fixed / Security / Removed** bullets derived from commit subjects (heuristic — good for archaeology, not a substitute for semver notes).

- **Living document:** [`docs/release-history-monthly.md`](release-history-monthly.md) (regenerate anytime with `python3 scripts/monthly-release-history.py --write-docs` after `git fetch origin main`).
- **Script:** [`scripts/monthly-release-history.py`](../scripts/monthly-release-history.py) (`--tip YYYY-MM`, `--print-notes YYYY-MM`).
