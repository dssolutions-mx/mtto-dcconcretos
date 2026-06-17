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

## Inventario de fases

| Fase | Descripción | Repo | Estado |
|------|-------------|------|--------|
| 0 | Discovery & arquitectura | mtto | ☑ |
| 1 | Identidad & auth de proveedor | mtto | ☑ |
| 2 | Alta/seguimiento facturas contra OC | mtto | ☐ |
| 3 | Visibilidad de OC (ambos sistemas) | mtto (+ read cotizador) | ☐ |
| 4 | Estatus de pago & saldos | mtto (+ read cotizador) | ☐ |
| 5 | Notificaciones + pulido | mtto | ☐ |

## Inventario de rutas (portal)

| Ruta | Propósito | Estado |
|------|-----------|--------|
| `/portal-proveedores` | Landing / redirect a login o dashboard | ☑ |
| `/portal-proveedores/login` | Acceso proveedor | ☑ |
| `/portal-proveedores/invitacion` | Aceptar invitación (token) | ☑ |
| `/portal-proveedores/dashboard` | Resumen OC/facturas/pagos | ▶ placeholder |
| `/portal-proveedores/ordenes` | Lista de OC del proveedor | ☐ |
| `/portal-proveedores/ordenes/[id]` | Detalle OC + subir factura | ☐ |
| `/portal-proveedores/facturas` | Facturas enviadas y estatus | ☐ |
| `/portal-proveedores/pagos` | Saldos y pagos recibidos | ☐ |
| `/portal-proveedores/perfil` | Datos fiscales y contacto | ☐ |

## APIs (estado)

| Endpoint | Fase | Estado |
|----------|------|--------|
| `POST /api/portal-proveedores/invitations` | 1 | ☑ staff-only |
| `GET/POST /api/portal-proveedores/invitations/accept` | 1 | ☑ token público + aceptación |
| `GET /api/portal-proveedores/me` | 1 | ☑ contexto RFC + vínculos |
| `GET /api/portal-proveedores/ordenes` | 2–3 | ☐ |
| `POST /api/portal-proveedores/facturas` | 2 | ☐ |
| `POST /api/portal-proveedores/cfdi/parse` | 2 | ☐ wrap `/api/ap/cfdi/parse` |
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

**Notas:**
- Staff de compras/admin invita vía API; la respuesta incluye `invitation_url` para copiar al proveedor.
- Proveedor acepta token, define contraseña, inicia sesión y ve RFC vinculado en dashboard.
- Sin UI interna de invitación aún (solo API); email transaccional pendiente (SendGrid no configurado en mtto).

**PR:** (se añade al abrir borrador)

---

## Próximo sprint (Fase 2 — Alta/seguimiento de facturas contra OC)

**Repo:** `mtto-dcconcretos` únicamente.

**Alcance acotado:**
1. API `GET /api/portal-proveedores/ordenes` — OC de mantenimiento filtradas por `mtto_supplier_id` o RFC del usuario (resolver gaps de `supplier_id` null según ADR §5).
2. Página `/portal-proveedores/ordenes` + `/portal-proveedores/ordenes/[id]` — lista y detalle read-only.
3. API `POST /api/portal-proveedores/cfdi/parse` — wrap de parser CFDI existente (`lib/sat/cfdiParser.ts` / `/api/ap/cfdi/parse`).
4. API `POST /api/portal-proveedores/facturas` — wrap de `createPoSupplierInvoice` con validación 3-way scoped al proveedor.
5. Página `/portal-proveedores/facturas` — listado de facturas enviadas por el proveedor.

**Fuera de alcance en Fase 2:** cotizador cross-repo, pagos, notificaciones, UI staff de invitación.

**Criterios de aceptación:** proveedor autenticado ve sus OC de mantenimiento y puede subir CFDI contra una OC; factura queda en `po_supplier_invoices` vía flujo existente; migraciones solo si hace falta metadata portal; PR borrador.
