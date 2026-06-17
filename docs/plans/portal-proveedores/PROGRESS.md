# Portal de proveedores — ledger de sprints

**Notion:** [Portal de proveedores (cross-repo, multi-fase)](https://app.notion.com/p/382f8f7fa96c81bd8c50db0159bbe9a3)  
**ADR:** [ADR-001-architecture.md](./ADR-001-architecture.md)  
**Repo ancla:** `dssolutions-mx/mtto-dcconcretos`  
**Repo federado (fases 3+):** `dssolutions-mx/cotizaciones-concreto`

## Decisiones registradas

| Fecha | Decisión |
|-------|----------|
| 2026-06-17 | Portal en `/portal-proveedores/*` dentro de mtto; layout sin sidebar interno. |
| 2026-06-17 | Identidad por RFC + tabla `supplier_portal_users`; sin rol `PROVEEDOR` en `user_role`. |
| 2026-06-17 | Cross-repo vía API del portal (lectura cotizador con service role), sin sync de esquema. |
| 2026-06-17 | Reutilizar stack AP existente (`po_supplier_invoices`, CFDI parser, validación 3-way). |
| 2026-06-17 | Invitaciones vía token en `supplier_portal_invitations`; staff recibe `invitation_url` en respuesta API (sin SendGrid en mtto aún). |
| 2026-06-17 | Rutas protegidas del portal redirigen a `/portal-proveedores/login` (no al login interno). |
| 2026-06-17 | Fase 2: lecturas/escrituras AP vía `createAdminClient` + `assertPurchaseOrderAccess`; CFDI debe coincidir RFC emisor con RFC del portal. |
| 2026-06-17 | OC visibles por `supplier_id` o fallback vía facturas previas con `cfdi_emisor_rfc` (ADR §5). |

## Inventario de fases

| Fase | Descripción | Repo | Estado |
|------|-------------|------|--------|
| 0 | Discovery & arquitectura | mtto | ☑ |
| 1 | Identidad & auth de proveedor | mtto | ☑ |
| 2 | Alta/seguimiento facturas contra OC | mtto | ☑ |
| 3 | Visibilidad de OC (ambos sistemas) | mtto (+ read cotizador) | ☐ |
| 4 | Estatus de pago & saldos | mtto (+ read cotizador) | ☐ |
| 5 | Notificaciones + pulido | mtto | ☐ |

## Inventario de rutas (portal)

| Ruta | Propósito | Estado |
|------|-----------|--------|
| `/portal-proveedores` | Landing / redirect a login o dashboard | ☑ |
| `/portal-proveedores/login` | Acceso proveedor | ☑ |
| `/portal-proveedores/invitacion` | Aceptar invitación (token) | ☑ |
| `/portal-proveedores/dashboard` | Resumen OC/facturas/pagos | ☑ |
| `/portal-proveedores/ordenes` | Lista de OC del proveedor | ☑ |
| `/portal-proveedores/ordenes/[id]` | Detalle OC + subir factura | ☑ |
| `/portal-proveedores/facturas` | Facturas enviadas y estatus | ☑ |
| `/portal-proveedores/pagos` | Saldos y pagos recibidos | ☐ |
| `/portal-proveedores/perfil` | Datos fiscales y contacto | ☐ |

## APIs (estado)

| Endpoint | Fase | Estado |
|----------|------|--------|
| `POST /api/portal-proveedores/invitations` | 1 | ☑ staff-only |
| `GET/POST /api/portal-proveedores/invitations/accept` | 1 | ☑ token público + aceptación |
| `GET /api/portal-proveedores/me` | 1 | ☑ contexto RFC + vínculos |
| `GET /api/portal-proveedores/ordenes` | 2 | ☑ lista scoped |
| `GET /api/portal-proveedores/ordenes/[id]` | 2 | ☑ detalle + facturas |
| `POST /api/portal-proveedores/cfdi/parse` | 2 | ☑ RFC emisor = portal |
| `GET/POST /api/portal-proveedores/facturas` | 2 | ☑ list + create + validate RPC |
| `GET /api/portal-proveedores/pagos` | 4 | ☐ |

## Migraciones (archivos only — no aplicar)

| Archivo | Fase | Estado |
|---------|------|--------|
| `20260617140000_supplier_portal_users.sql` | 1 | ☑ `supplier_portal_users` + `supplier_portal_invitations` + RLS |

## Sprints completados

### Sprint 0 — Discovery & arquitectura (2026-06-17)

**Entregables:**
- ADR-001 con decisiones de arquitectura, identidad y federación cross-repo.
- Este ledger (`PROGRESS.md`) con inventario de fases y rutas.
- Esqueleto de ruta `/portal-proveedores` (landing placeholder).
- `proxy.ts` + `SidebarWrapper` actualizados para chrome mínimo del portal.

**PR:** https://github.com/dssolutions-mx/mtto-dcconcretos/pull/30

### Sprint 1 — Fase 1: Identidad & auth (2026-06-17)

**Entregables:**
- Migración `20260617140000_supplier_portal_users.sql` (membresía + invitaciones + RLS).
- `lib/portal-proveedores/resolvePortalContext.ts` + tests + helpers RFC/permisos staff.
- Login, aceptación de invitación y dashboard placeholder autenticado.
- APIs staff `POST /api/portal-proveedores/invitations`, `GET /api/portal-proveedores/me`, accept flow.
- `proxy.ts`: rutas protegidas del portal → login del portal.

**PR:** https://github.com/dssolutions-mx/mtto-dcconcretos/pull/32

### Sprint 2 — Fase 2: Facturas contra OC (2026-06-17)

**Entregables:**
- `lib/portal-proveedores/purchase-order-scope.ts` — listado y control de acceso a OC (supplier_id + fallback RFC).
- APIs: `GET /ordenes`, `GET /ordenes/[id]`, `POST /cfdi/parse`, `GET/POST /facturas` (wrap `createPoSupplierInvoice` + RPC `validate_po_invoice_vs_oc`).
- Páginas: `/ordenes`, `/ordenes/[id]` (formulario CFDI), `/facturas`; dashboard con navegación.
- `CfdiXmlUploadField` acepta `parseUrl` para reutilizar en portal.
- Tests unitarios en `purchase-order-scope.test.ts`.

**Notas:**
- Sin migraciones nuevas (reutiliza `po_supplier_invoices` existente).
- Facturas portal se marcan con prefijo `[Portal proveedor]` en notas.
- Proveedor sin `mtto_supplier_id` solo ve OC vinculadas por facturas previas con su RFC.

**PR:** (se añade al abrir borrador)

---

## Próximo sprint (Fase 3 — Visibilidad de OC cross-repo)

**Repo:** `mtto-dcconcretos` (API federada; lectura cotizador).

**Alcance acotado:**
1. Cliente read-only a cotizador vía `COTIZADOR_SUPABASE_URL` / service role en `lib/portal-proveedores/cotizador-client.ts`.
2. Extender `GET /api/portal-proveedores/ordenes` para incluir OC del ERP filtradas por `cotizador_group_id` o RFC (`supplier_groups.rfc`).
3. Vista consolidada en `/portal-proveedores/ordenes` con badge de origen (Mantenimiento / Cotizador).
4. Detalle read-only de OC cotizador (sin subida de factura cross-repo en este sprint — solo visibilidad).

**Fuera de alcance en Fase 3:** subida de facturas al cotizador, pagos, notificaciones.

**Criterios de aceptación:** proveedor con `cotizador_group_id` ve OC de ambos sistemas en una lista; ledger actualizado; PR borrador.
