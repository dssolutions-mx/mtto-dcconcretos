# POL-OPE-001 / POL-OPE-002 — Roles y acciones en plataforma (resumen interno)

Versión de referencia: **POL-OPE-001 Mantenimiento · POL-OPE-002 Inventario y Activos · v2.0 (Marzo 2026)**. El documento completo de stakeholders vive fuera del repo; este archivo es la **contraparte breve para ingeniería** y debe mantenerse alineado cuando cambie la política.

## Reglas absolutas (mantenimiento / OC)

1. **Crear OC:** solo **Coordinador de Mantenimiento** o **Gerente de Mantenimiento** (demás roles solo desencadenan la necesidad).
2. **Autorizar OC Nivel 1 (técnica):** solo **Gerente de Mantenimiento** (Gerencia General puede actuar en flujos de aprobación según política de montos y etapas; no confundir con “ser” el rol de mantenimiento).
3. **Revisar OT y decidir cierre vs generar OC:** **Coordinador de Mantenimiento**.
4. **Jefe de Unidad de Negocio** y **Jefe de Planta:** no son el Gerente de Mantenimiento; **no** deben compartir la misma matriz de permisos ni `business_role` que simule a Gerente.

## Mapeo política → `profiles.role` (app)

| Rol en política | Valor en base de datos |
|-----------------|-------------------------|
| Gerencia General | `GERENCIA_GENERAL` |
| Gerente Mantenimiento | `GERENTE_MANTENIMIENTO` |
| Coordinador | `COORDINADOR_MANTENIMIENTO` |
| JUN | `JEFE_UNIDAD_NEGOCIO` |
| Jefe de Planta | `JEFE_PLANTA` |
| Encargado Mantenimiento (deprecado) | `ENCARGADO_MANTENIMIENTO` → migrar a `COORDINADOR_MANTENIMIENTO` |

## Paridad técnica en el código

- **HTTP** (`advance-workflow`), **UI** (`approval-context` + `workflow-policy.ts`) y **correo** (`process_po_email_action`) deben usar la **misma regla** para la primera firma técnica: actor con `profiles.role = GERENTE_MANTENIMIENTO` (no `business_role` suelto).
- **Notificación Edge:** destinatario técnico resuelto solo con `role = GERENTE_MANTENIMIENTO`.

## Migraciones relacionadas

- `migrations/sql/20260321_fix_profiles_business_role_jun_jp.sql` — corrige `business_role` de JUN y JP.
- `migrations/sql/20260321_process_po_email_action_technical_gerente_only.sql` — restringe aprobación técnica por correo a Gerente de Mantenimiento.
