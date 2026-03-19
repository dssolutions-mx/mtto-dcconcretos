# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Release channels:** **Semver** (`v0.x.y`) — curated milestones in this file. **Monthly** (`monthly-YYYY-MM`) — calendar snapshots of `main` since repo creation, documented in [`docs/release-history-monthly.md`](docs/release-history-monthly.md) and as separate GitHub Releases.

## [Unreleased]

### Added
- (nothing yet)

## [0.4.0] - 2026-03-19

Weekly milestone: work orders & incidents hardening, security hygiene, purchase-order UX, and calendar-related improvements.

### Added

- Work orders list API and supporting database indexes.
- Incidents page and API.
- Work order create/edit flow (implementation across multiple commits).
- Calendar-related components and storage-oriented optimizations.
- Purchase order UI components, status labels, and broader PO perspective improvements.
- PO **ready-to-pay** style notification for downstream workflow.

### Changed

- Authorization flow refactored for clearer, more maintainable access control.
- Work orders: substantial refactor of list/detail experience, print output, breadcrumb/sidebar navigation.
- Work order detail: performance and proxy/auth rendering adjustments.
- Incident page layout refined.
- Dashboard receiver experience updated; executive KPIs and pending-actions block removed where superseded.
- Advance purchase order workflow: overload/guard-rail style fixes.

### Fixed

- Badge component DOM effect error.
- Purchase order admin email trigger (multiple iterations: routing, workflow policy handling, viability state).

### Security

- Dependency cleanup: removed known-risky packages.
- Follow-ups from initial security assessment protocol.

## [0.3.0] - 2026-03-12

Weekly milestone: procurement workflow alignment, access control (RLS/roles), checklist authoring, assets mobile experience, and early work-orders surface.

### Added

- Purchase order service aligned with new **workflow policy** model; tasks 1–9 for roles, PO routing, workflow engine, and email alignment.
- Supplier registry depth: contacts, bank details, multi–business-unit support (#4).
- Warehouse responsibility model: authority, RLS, UI/API gating; related RH ownership, types, and cutover documentation.
- PO approval email workflow: three-stage routing and notification triggers.
- Batch-oriented approval context route for faster approval flows.
- Checklist dashboards and assets dashboard surfaces.
- Checklist template creation **wizard**: entry step (scratch vs template), stepper wrapper, basics step, collapsible sections, review/save, integrated crear flow; template editor state extraction for reuse.
- Plantillas layout shell and plantillas page.
- Completed checklist detail page; assets list page improvements.
- Production report page.
- Work orders page (initial listing/entry surface).
- Activos mobile phases: `useIsMobile`, summary cards, pull-to-refresh, responsive header/touch targets, fully clickable asset cards, compact KPI/quick-actions/filters layout.
- Compras dashboard (initial implementation).

### Changed

- Role rename: **ENCARGADO_MANTENIMIENTO** → **COORDINADOR_MANTENIMIENTO** across app and emails.
- **GERENTE_MANTENIMIENTO** scope set to global (company-wide authority).
- Compras page and purchase orders list redesigned/improved.
- Compras / purchase order mobile experience refactored (including PO details mobile view).
- Ported mantenimiento-diace improvements: task-based preventive flow, bulk model creation, work order profiles fixes.

### Fixed

- Role permissions and guards (including gerente mantenimiento RLS access).
- Maintenance API behavior for Sitrak trucks.
- Asset detail page: pending checklists not showing.
- Sidebar icon for compras page.
- Workflow status display.

### Security

- RLS policies extended to inventory and suppliers tables.

## [0.2.0] - 2026-03-05

Weekly milestone: operational data scripts and audits (tooling-first).

### Added

- Script to **classify February expenses**.
- Script to **analyze BP04** asset data.
- Diesel audit coverage for **P004 / P004P**.

[Unreleased]: https://github.com/dssolutions-mx/mtto-dcconcretos/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/dssolutions-mx/mtto-dcconcretos/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/dssolutions-mx/mtto-dcconcretos/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/dssolutions-mx/mtto-dcconcretos/compare/7b975e30fd675794c8d5e5bf723b83bac8f3c74e...v0.2.0
