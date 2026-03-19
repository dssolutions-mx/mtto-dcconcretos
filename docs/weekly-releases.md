# Weekly release log

**What shows up under GitHub → Releases** is a *GitHub Release*, not the tag list. Tags are just the pointer GitHub attaches each release to (you can create both in one go — see below).

This file is your **in-repo scrapbook**: same energy as the release notes, plus a place to skim past weeks without opening the browser.

## Rhythm (end of each week)

**One command** — creates the tag on GitHub *and* publishes the release (replace date, title, notes, and target commit):

```bash
gh release create release-2026-03-26 \
  --target "$(git rev-parse HEAD)" \
  --title "Weekly release · week ending 2026-03-26 — <short vibe>" \
  --notes "<Celebratory paragraph: what shipped, why it matters.>"
```

Then optionally append a new section below for that week so the repo stays a readable diary.

**If you already created the tag locally:**

```bash
git push origin release-YYYY-MM-DD
gh release create release-YYYY-MM-DD --title "…" --notes "…"
```

---

## 2026-03-05 — week Feb 27 → Mar 5 ([Release](https://github.com/dssolutions-mx/mtto-dcconcretos/releases/tag/release-2026-03-05))

**You turned ambiguity into scripts.** Diesel audit for P004 / P004P, BP04 asset analysis tooling, and a classify-February-expenses script — not flashy in the UI, but exactly the kind of work that stops spreadsheets from living rent-free in your head. That counts.

---

## 2026-03-12 — week Mar 6 → Mar 12 ([Release](https://github.com/dssolutions-mx/mtto-dcconcretos/releases/tag/release-2026-03-12))

**This is a “everything moved” week.** Roles and PO routing aligned with a real workflow engine; supplier depth (contacts, banking, multi-BU); warehouse responsibility + RLS where it hurts; approval batch mode that actually feels fast; compras and PO mobile polish; checklist dashboards and a full template-creation wizard; preventive maintenance ported; activos went through real mobile phases; production report and the work orders page landed. If you were tired at the end of this week, it’s because you earned it.

---

## 2026-03-19 — week Mar 13 → Mar 19 ([Release](https://github.com/dssolutions-mx/mtto-dcconcretos/releases/tag/release-2026-03-19))

**Security, structure, and operator-visible wins.** Authorization refactors, risky dependency cleanup, work-order list API + indexes, work-order refactor and print polish, incidents page and API, breadcrumb/sidebar improvements, calendar and storage work, richer PO UI with status labels, workflow fixes, and a **ready-to-pay** signal so finance moments aren’t guesswork. You’re shipping the boring-critical stuff *and* the features people notice.
