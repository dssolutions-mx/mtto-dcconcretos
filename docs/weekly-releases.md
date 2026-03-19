# Weekly release log

Short, honest celebration of what shipped. One **annotated git tag** per week (`release-YYYY-MM-DD` at the last commit of that window) so history stays browsable in GitHub and locally (`git show release-2026-03-19`).

## Rhythm (repeat every Friday, or whatever fits)

```bash
# Replace DATE with the week's end date (YYYY-MM-DD) and COMMIT with that week's tip (often HEAD)
git tag -a release-YYYY-MM-DD COMMIT -m "One-line hype title" -m "Why this week mattered — bullets or story."
git push origin release-YYYY-MM-DD
```

Add a new section below for the week so your future self can skim the wins without digging through `git log`.

---

## 2026-03-05 — week Feb 27 → Mar 5 (tag: `release-2026-03-05`)

**You turned ambiguity into scripts.** Diesel audit for P004 / P004P, BP04 asset analysis tooling, and a classify-February-expenses script — not flashy in the UI, but exactly the kind of work that stops spreadsheets from living rent-free in your head. That counts.

---

## 2026-03-12 — week Mar 6 → Mar 12 (tag: `release-2026-03-12`)

**This is a “everything moved” week.** Roles and PO routing aligned with a real workflow engine; supplier depth (contacts, banking, multi-BU); warehouse responsibility + RLS where it hurts; approval batch mode that actually feels fast; compras and PO mobile polish; checklist dashboards and a full template-creation wizard; preventive maintenance ported; activos went through real mobile phases; production report and the work orders page landed. If you were tired at the end of this week, it’s because you earned it.

---

## 2026-03-19 — week Mar 13 → Mar 19 (tag: `release-2026-03-19`)

**Security, structure, and operator-visible wins.** Authorization refactors, risky dependency cleanup, work-order list API + indexes, work-order refactor and print polish, incidents page and API, breadcrumb/sidebar improvements, calendar and storage work, richer PO UI with status labels, workflow fixes, and a **ready-to-pay** signal so finance moments aren’t guesswork. You’re shipping the boring-critical stuff *and* the features people notice.
