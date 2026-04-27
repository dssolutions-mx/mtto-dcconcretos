# Gaps, drift, and open questions

## Policy cross-reference ambiguity

- **POL-OPE-002** cites “POL-OPE-001 §3.2.1” for user onboarding. The canonical POL-OPE-001 markdown in this repo uses **`## Alta de Usuarios y Asignación Operador–Equipo`** without numbered §. Treat that section as the cross-reference target unless a numbered PDF is supplied.

## Suplencias: POL-001 vs POL-002

Documented verbatim in [00-sources-and-conventions.md](./00-sources-and-conventions.md). **Open:** single operational truth for JUN/JP substitution wording — legal/ops decision, not engineering.

## “Coordinador de mayor antigüedad”

- **POL-001** and **POL-002** reference seniority for escalation when Gerente de Mtto is absent.  
- **Open:** whether `profiles` (or HR system) stores “antigüedad” for automated routing; **UNVERIFIED** in schema — search: `rg "antigüedad|seniority" lib app` (not run in pack generation).

## Live DB vs generated `user_role` enum

- **Discovery report** ([docs/2026-03-06-roles-po-rls-discovery-report.md](../../2026-03-06-roles-po-rls-discovery-report.md)): live enum snapshot at report time differed from app expectations in places.  
- **Repo today:** `types/supabase-types.ts` includes full role list including `GERENTE_MANTENIMIENTO`, `COORDINADOR_MANTENIMIENTO`, `MECANICO`, `RECURSOS_HUMANOS`.  
- **Action:** Re-verify live Supabase enum matches generated types before production role changes.

## `profiles` RLS off (reported)

- Per discovery report, `profiles` had RLS disabled in live project to avoid circular policy issues.  
- **Implication:** Authorization must not rely on RLS alone for profile reads; app uses service role / server paths carefully.  
- **Action:** Security reviews should confirm this is still intentional.

## Web enforcement inventory completeness

- [05-web-app-enforcement-inventory.md](./05-web-app-enforcement-inventory.md) marks most routes **UNVERIFIED**. Completing the inventory is a **documentation task**, not a policy change.

## POL002 implementation roadmap vs app features

- **Mes 1 / Mes 2** in POL-OPE-002 are business rollout milestones.  
- **Open:** Map each milestone to shipped features (or mark not implemented) — requires product checklist, not inferred here.

## Matrix vs `ModulePermissions` granularity

- HTML matrix rows (e.g. “Registrar evidencia fotográfica”) may involve **multiple** code paths (Coordinator + Mechanic). `ModulePermissions` alone does not prove row-level behavior — check workflows and APIs per [06-html-matrix-to-code-matrix.md](./06-html-matrix-to-code-matrix.md).

## JUN/JP “solicitar alta” vs self-service registration (product decision)

- **Shipped behavior:** JUN/JP may **POST** scoped operator registration (digital equivalent of *solicitud*: form + audit line in `notas_rh` / policy copy in UI). RRHH retains **unscoped** registration and governance pages and is the role expected to work **most intensively** on personnel in the product.
- **Queue workflow (declined):** A separate JUN/JP → RH **ticket/queue** for alta (beyond the in-flow audit) is **out of scope** — product decision: avoid extra bureaucracy. If legal ever challenges direct `createUser` for JUN/JP, that is a **policy conversation**, not a committed roadmap item here.
- **Optional RH / GG notifications** for personnel movements remain **out of product** unless ops explicitly requests them (matrix rows may stay **UNVERIFIED** in [06-html-matrix-to-code-matrix.md](./06-html-matrix-to-code-matrix.md) until then).

## Multi-plant Jefe de Planta

- **Settled in product:** A person can have **one** role `JEFE_PLANTA` and **several** plants in scope via `profile_managed_plants` + primary `profiles.plant_id` — same matrix row as JP, **not** a separate enum and **not** JUN (BU-wide) semantics. If HR/payroll later needs a distinct payroll code, that would be a separate field mapped to the same app permissions, not a new `user_role` for authorization.
- **Open:** whether cross–business-unit plant pairs for one JP are allowed; if restricted, add validation when saving `profile_managed_plants` (compare `plants.business_unit_id`).
