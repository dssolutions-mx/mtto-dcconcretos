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
