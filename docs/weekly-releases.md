# Release rhythm (one semver line on `main`)

Everything public uses **normal SemVer** on the **`0.x.0` minor line**: **`v0.1.0`** was the first full month on `main` (May 2025), and each following month through **`v0.11.0`** (March 2026) is the next minor. **Patch** (`0.11.1`, …) is for intra-month fixes if you ever need it.

**Why `0.10.0` and not `0.1` vs `0.01`?** SemVer compares **numeric** components: **`0.10.0` comes after `0.9.0`**. A string like `0.09` is ambiguous and sorts wrong in tooling—three-part versions keep GitHub, npm, and `sort -V` aligned.

[`CHANGELOG.md`](../CHANGELOG.md) is the source of truth: each version has a **short narrative summary** (what moved for the *product*) plus grouped **Added / Changed / Fixed / Security**—not a raw commit dump.

## Cut a new month (after the month closes on `main`)

```bash
git fetch origin main
# 1) Edit CHANGELOG.md — new ## [0.12.0] - YYYY-MM-DD with Summary + sections
# 2) Bump package.json version to match
git add CHANGELOG.md package.json
git commit -m "chore(release): v0.12.0"
git tag -a v0.12.0 -m "Release v0.12.0"
git push origin main && git push origin v0.12.0
python3 scripts/extract-changelog-section.py 0.12.0 > /tmp/notes.md
gh release create v0.12.0 \
  --title "v0.12.0 — <one-line story>" \
  --notes-file /tmp/notes.md \
  --latest
```

Optional: prepend a **compare link** to the notes file (`v0.11.0…v0.12.0`).

## Published range (backfill on GitHub)

Releases **`v0.1.0` … `v0.11.0`** on GitHub match the tags on **`main`** at each month-end snapshot (same commits the old `monthly-*` tags used). **Latest** should stay on the highest minor unless you ship a pre-release.
