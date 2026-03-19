# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Pre-1.0, **each minor (`0.x.0`)** is a **calendar-month milestone on `main`** (America/Chicago month boundaries), so the version line reads like a continuous product history—not a dump of commit titles.

## [Unreleased]

### Added
- (nothing yet)

## [0.11.0] - 2026-03-31

**Summary:** March hardens the **operational core**: work orders and incidents become first-class surfaces, procurement gets a real **workflow engine** (policy, email stages, batch approvals), and **checklists / activos** gain serious mobile and authoring UX. Security and dependency hygiene catch up with how much surface area you now expose in production.

### Added
- Work-order **list API and indexes**, full **work-order refactor**, create/edit flow, and **incidents** page + API.
- **Checklist** dashboards, **plantillas** shell, and a **template-creation wizard** (scratch vs template, stepper, sections, review/save).
- **Compras** direction: dashboard start, PO components, **status labels**, **ready-to-pay** signal, calendar-oriented UI and storage work.
- **Production report** page; **completed checklist detail**; **activos** mobile passes (responsive layout, pull-to-refresh, touch targets, clickable cards, compact KPI strip).
- Scripts: **February expense classification**, **BP04** asset analysis, **diesel P004** audit support.

### Changed
- **Purchase order service** driven by explicit **workflow policy**; **3-stage approval email** routing; faster **batch approval** context.
- **Roles**: `ENCARGADO_MANTENIMIENTO` → **`COORDINADOR_MANTENIMIENTO`** everywhere; **GERENTE_MANTENIMIENTO** scoped **company-wide**; authorization flow refactors.
- **Breadcrumb/sidebar** navigation; work-order **print** and **detail/proxy auth** performance work; **incident** layout polish; dashboard receiver tweaks; removal of legacy executive KPI block where superseded.
- Ported **mantenimiento-diace** improvements: preventive task flow, bulk model creation, work-order profile fixes.

### Fixed
- **Sitrak** maintenance API behaviour; asset **pending checklists** visibility; compras **sidebar** icon; **workflow status** display; badge **DOM** issue; **advance PO** overload; repeated **PO admin email** / viability edge cases.

### Security
- **RLS** extended to **inventory** and **suppliers**; maintenance-lead access tightened; **risky packages** removed; first-pass **security assessment** follow-ups.

## [0.10.0] - 2026-02-28

**Summary:** February is about **closing the loop between finance narratives and inventory reality**: PO forms align with the new inventory model, **Q4 reporting** and **import tooling** land, and **compliance / inventory policy** work starts to show up as real UI and flags—not only spreadsheets.

### Added
- **Q4 2025** reporting scripts and related **import** paths; fuller **“import de datos completos”** flow.
- **Compliance** feature flag; **inventory policy** analysis and **final inventory policy** groundwork.
- **PO purpose** classification and **purchase date** behaviour; **PO details** mobile implementation.

### Changed
- Purchase **order forms** wired to the **new inventory system**; **report** metrics and routes adjusted; **costo_cem_pct** calculation updates.

### Fixed
- **Report** regressions; **asset movement** notification function; intermittent **report-route** issues.

## [0.9.0] - 2026-01-31

**Summary:** January shifts the product toward **inventory-backed procurement**: quotations, receipts, and **cash vs inventory** segmentation so maintenance isn’t guessing whether parts are “on the books” or “on the truck.”

### Added
- **Compliance** and **onboarding** direction bundled with a **new inventory system** slice; **inventory reports** UI.
- **Quotation** workflow end-to-end (selection, notifications, final workflow tweaks); **PO creation** forms and **status workflow** for inventory POs.
- **Receive PO** dialog and **inventory receipt** service improvements; fulfillment paths that **preserve part IDs**.

### Changed
- Work orders and purchase orders **segmented** by **inventory usage** and **cash usage** tracking.

### Fixed
- **Inventory movements**; **receive PO** dialog behaviour; fulfillment when **parts are already in stock**; **special-order supplier** edge cases; **inventory PO status** workflow bugs.

## [0.8.0] - 2025-12-31

**Summary:** December deepens **diesel and financial ops**: FIFO-style thinking, **transfers**, **ingresos vs gastos** visuals, and **Next.js** migration pressure on diesel and PO surfaces—while hardening **consumption entry** with warehouse/plant context.

### Added
- **Diesel** balance/FIFO-style fixes; **transfer** support; **self-healing / validation** around warehouse consistency during diesel transactions.
- **Consumption entry** form with **warehouse** and **plant** selection; **November expense** classification/import; **asset drilldown** dialog.
- **Purchase-order** support alongside **Next.js** migration work; **ingresos–gastos** imagery and **refresh-view** routes.

### Fixed
- **PO edit** dialog; **parts** issues in **model creation**; **asset unassignment** RLS; consumption form **warehouse selection** bugs.

## [0.7.0] - 2025-11-30

**Summary:** November is **automation and trust**: pending work orders can **spawn on a schedule**, deduplication UX gets attention, and **diesel** + **executive reporting** move toward production-grade behaviour (grand totals, filters, recurring logic).

### Added
- **Server-side auto-creation** for pending work orders (cron / **pg_cron** migration path); **batch update** and **check updates** routes.
- **Diesel storage categories**; **urea migration** and **transaction control**; **work-order print** page.
- **Unified assignment wizard**; **security talk** section alongside checklist execution hardening.

### Changed
- **Executive report** implementation; **diesel warehouse** insert policy; **October expense** import.

### Fixed
- **Maintenance summary** report; **recurring first-cycle** logic; **maintenance alerts** schedule; **conflict detection** and **maintenance units**; **work-order ID** generation; **ingresos-gastos** grand total; **executive PO** filter; stubborn **DB** errors.

## [0.6.0] - 2025-10-31

**Summary:** October scales **diesel** and **governance**: multiple quotations, evidence on transactions, **Playwright** for regression safety, and **mantenimiento / almacén** routes appear as the org asks the app to mirror real plants and warehouses.

### Added
- **Playwright** e2e harness; richer **asset details** (breadcrumbs, service-order links).
- **Gerencial reports**; **diesel** edit modal, **checklist evidence** report, **executive** report enhancements (**unlinked additional expenses**).
- **Diesel analytics** page; **asset breakdown** report; **diesel entry** and **product ID on consumption**; **transaction edit** and **evidence** modals; **employees sync** script.
- **Mantenimiento** and **almacén** pages; **profiles active/deactivation** and **gastos adicionales** simplifications.

### Changed
- **Diesel** import/date fixes and **reimport** tooling; **purchase orders** multiple-quotation flow; **credential** UI aligned to brand; **dashboard** refresh; **purchase order service** and **role permissions**.

### Fixed
- **Suppliers** schema/routes; **PO list** linkage from work orders; **diesel inventory** bugs; **incidentes** page; **work-order status** updates; **evidence upload**; **advance workflow** PO route.

## [0.5.0] - 2025-09-30

**Summary:** September introduces **diesel as a first-class domain** (inventory + migration tooling), expands **executive PO** reporting, and pushes **roles/permissions** and **composite assets** so the app can model a larger fleet without everyone seeing everything.

### Added
- **Diesel inventory** page and **migration** components; **executive purchase-order** report; **credential** management and preview.
- **User roles and permissions** system; **composite assets** (stage 1); **suppliers** system foundation; **maintenance functions** expansion.
- **Checklist reprogramming**; **SQL** for **profiles** storage policies.

### Changed
- **Executive report** plumbing; **sidebar** rearrangement; **SEO** improvements; **diesel migration** enhancements; **cleanliness reports** iteration.
- CI: **legacy peer deps** for React 19 on Vercel; tooling: **papaparse** / CSV migration helpers.

### Fixed
- **Diesel inventory** fixes; **executive report** page; **cleanliness reports**; **checklist execution**; **Supabase** docs / **PO approval notification** doc drift.

## [0.4.0] - 2025-08-31

**Summary:** August tightens **reporting and field truth**: evidence on work orders, **kilometers** on assets, and analytics/export paths—so leadership stops arguing with screenshots in chat.

### Added
- **Asset report analytics** and **Excel export**; **initial/current kilometers** on asset edit (#1).

### Changed
- **Reporte de evidencias**; small **edit** affordances on reporting surfaces.

### Fixed
- **Receipt section** on work orders; **deployment lockfile** / **plant filter** on asset reports; **quotation manager**; **versioning** and **build** issues; **checklist date** handling.

## [0.3.0] - 2025-07-31

**Summary:** July connects **money to maintenance**: POs show cost on work orders, **offline checklists** get a real reliability pass, and **HR compliance** checklists hint that the product isn’t only for the shop floor.

### Added
- **Purchase order ↔ work order** link with **cost display**; **forgot password** flow.
- **HR checklist compliance** and **offline checklist** hardening; **operator** attribution when available.

### Changed
- **Work-order generation** from maintenance; **asset assignment** UX; **compact cards**; **delete** flows for work orders and POs; **incidentes** improvements; **mobile session** handling; **cleanliness reports**.

### Fixed
- **Cotización** issues; **hours** errors; **work-order completion** validation; **PO page**; **badges**; **calendar**; **asset routes**; **delete** dialogs; **email recovery**; **purchase orders**; **checklist scheduling** duplicates; **asset assignment** edge cases.

## [0.2.0] - 2025-06-30

**Summary:** June is the month **purchase orders become survivable on mobile** and **RLS starts meaning something**—admin roles get protection, plants structure lands, and a long tail of **checklist / PO** fixes stops daily demos from catching fire.

### Added
- **Plant structure** implementation; **asset assignment** page; **cleanliness reports**; **accounts payable** surface; Spanish **button** labelling on key flows.

### Changed
- **Administrative role protection** and **role guards**; **mobile dashboard**; **PO list** mobile; **maintenance cycle** updates; **models** section improvements.

### Fixed
- **Work-order and PO** issues; **checklist** and **sidebar** experience; **mobile navigation**; **build** errors; **corrective** work orders; **recurrence**; **RLS** on **maintenance_tasks** (401 on insert); **asset creation/edit**; **login/logout**; **pnpm lockfile** sync; **standalone/direct PO** creation; **advance PO workflow**.

## [0.1.0] - 2025-05-31

**Summary:** May is **foundation month**: assets, maintenance plans, checklists, work orders, offline-first thinking, and production reporting—rough at the edges, but the skeleton of “operate a plant from one app” is there from day one.

### Added
- **Asset registration** flows and **edit** processes; **maintenance** planning and **preventive checklists**; **work orders** and **checklists** core; **offline** service and UX; **calendar**; **receipt** upload sections; **sidebar** shell; **production reporting** direction.

### Changed
- Repeated iteration on **asset** pages and **services**; **work-order/checklist creation** enhancements.

### Fixed
- **Sidebar** and **work-order list**; **offline** indicators; **equipment model** form; **parts** and **model creation**; **params** issues; **maintenance plan** registration; **incidents** generation; **evidence/photo** upload; **hydration** errors; **navigation**; **MTTO** logic; **purchase order** form; **production report** stability; **checklist** reliability.

### Removed
- Some early **restrictions** and **migration** experiments that blocked iteration.

[Unreleased]: https://github.com/dssolutions-mx/mtto-dcconcretos/compare/v0.11.0...HEAD
[0.11.0]: https://github.com/dssolutions-mx/mtto-dcconcretos/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/dssolutions-mx/mtto-dcconcretos/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/dssolutions-mx/mtto-dcconcretos/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/dssolutions-mx/mtto-dcconcretos/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/dssolutions-mx/mtto-dcconcretos/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/dssolutions-mx/mtto-dcconcretos/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/dssolutions-mx/mtto-dcconcretos/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/dssolutions-mx/mtto-dcconcretos/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/dssolutions-mx/mtto-dcconcretos/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/dssolutions-mx/mtto-dcconcretos/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/dssolutions-mx/mtto-dcconcretos/compare/7b975e30fd675794c8d5e5bf723b83bac8f3c74e...v0.1.0
