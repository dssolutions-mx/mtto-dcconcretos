# Sources and conventions (roles SOP pack)

## Authoritative normative sources

1. **[POL-OPE-001 v2.0](../policies/POL-OPE-001_v2.0_SOP.md)** — Mantenimiento.
2. **[POL-OPE-002 v2.0](../policies/POL-OPE-002_v2.0_SOP.md)** — Inventario y activos.
3. **[roles-y-acciones-plataforma-v2.html](./source/roles-y-acciones-plataforma-v2.html)** — Companion UI reference (flows, role cards, matrix `#matriz`). Use for navigation and matrix wording; resolve conflicts in favor of the POL markdown files.

## Citation format

- **Policy:** `POL-OPE-001 v2.0 — heading "Correctivo — Protocolo PAT"` (quote the `##` or `###` heading text exactly from the canonical markdown file).
- **HTML companion:** `HTML companion — anchor #oc` (anchor from `id` attribute in the HTML file).

## No-speculation rule

- **Normative statements** must include a citation to POL-OPE-001, POL-OPE-002, or a specific HTML `id`.
- **Implementation statements** must name a **file path** in this repo (and ideally symbol or pattern), or be labeled **`UNVERIFIED`** with a suggested search, e.g. `rg "loadActorContext" app/api`.

## Numeric and time thresholds (inventory for code alignment)

All values below are **quoted from policy text** only.

| Threshold | POL | Location (heading) |
|-----------|-----|-------------------|
| OC correctivo ≥ $7,000 → GG after Administración | 001, 002 | PAT table / Tipo B table |
| OC correctivo < $7,000 → CxP after Administración | 001, 002 | PAT / Tipo B |
| Activos: herramienta mayor > $10,000 | 002 | Alcance |
| Artículos > $2,000: fotografía en sistema | 002 | Administración de Almacén |
| Baja inventario: GG si > $5,000 | 002 | Inventario Obsoleto |
| Activo > $100,000 cambia operador → notificación GG | 002 | Notificaciones a GG |
| Activo fuera de servicio > 7 días → notificación GG | 002 | Notificaciones a GG |
| Activo sin operador > 48h → notificación GG | 002 | Notificaciones a GG |
| > 3 cambios de operador en 1 mes → notificación GG | 002 | Notificaciones a GG |
| Preventivo: agendar antes de 100 h o 1,000 km del intervalo | 001 | Preventivo |
| Equipo sin operador / Inactividad: máx. 48 h | 001, 002 | Alta… / Movimientos |
| WhatsApp / formalización: < 2 h hábiles | 001 | Grupo WhatsApp |
| Emergencia OC: verbal GM + OC formal < 2 h | 002 | Órdenes de Compra |
| Alta en plataforma: registrar asignación < 24 h | 002 | Movimientos — asignación |
| Entradas almacén: registro < 2 h | 002 | Administración de Almacén |
| Conteo cíclico 20% mensual | 002 | Administración de Almacén / Auditorías |
| Inventario completo trimestral | 002 | Administración de Almacén / Auditorías |
| Emergencia fuera de padrón: alta proveedor 72 h | 001 | Servicios Externos y Padrón |
| Semana 1 post-firma: tolerancia incidencias técnicas | 001 | Incidencias de Sistema |

## Suplencias: POL-OPE-001 vs POL-OPE-002 (do not merge)

Engineering **must not** pick one table over the other. Operations / legal owns a single operational truth. Document both verbatim.

### POL-OPE-001 — `## Suplencias`

| Falta | Quién suple |
|-------|---------------|
| Jefe de Planta | JUN |
| JUN | Jefe de Planta |
| JUN + Jefe de Planta | Gerente de Mtto → directo a GG |
| Coordinador | Gerente de Mtto asume funciones operativas |
| Gerente de Mtto | Coordinador de mayor antigüedad escala a JUN/JP. GG notificado. |

### POL-OPE-002 — `## Suplencias`

| Falta | Quién suple |
|-------|---------------|
| JUN | JP asume autorizaciones y supervisión |
| JP | JUN asume responsabilidades de inventario y activos |
| JUN + JP | Gerente de Mtto escala todo a GG |
| Gerente de Mtto | Coordinador de mayor antigüedad; escala a JUN/JP. GG notificado. |
| Coordinador | Gerente de Mtto asume funciones operativas |
| Encargado de Almacén | JP asume custodia temporal (con restricción de OC). Designar sustituto <48h. |

**Delta note:** POL-001 rows are ordered and scoped to “mantenimiento” style coverage; POL-002 adds **Encargado de Almacén** suplencia and describes JUN/JP substitution asymmetrically (“autorizaciones” vs “inventario y activos”). Any app workflow that implements “suplencia” needs a **business decision** on which table applies per scenario.

## Stable internal IDs

See [INDEX.md](./INDEX.md) for the full `SOP-FLOW-*`, `SOP-ROLE-*`, and `SOP-MATRIX-ROW-*` registry and mapping to POL headings / HTML anchors.
