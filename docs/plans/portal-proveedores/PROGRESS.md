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
| 3 | Visibilidad de OC (ambos sistemas) | mtto (+ read cotizador) | ☑ |
| 4 | Estatus de pago & saldos | mtto (+ read cotizador) | ☑ |
| 5 | Notificaciones + pulido | mtto | ☐ |

## Inventario de rutas (portal)

| Ruta | Propósito | Estado |
|------|-----------|--------|
| `/portal-proveedores` | Landing / redirect a login o dashboard | ☑ |
| `/portal-proveedores/login` | Acceso proveedor | ☑ |
| `/portal-proveedores/invitacion` | Aceptar invitación (token) | ☑ |
| `/portal-proveedores/dashboard` | Resumen OC/facturas/pagos | ☑ |
| `/portal-proveedores/ordenes` | Lista de OC del proveedor | ☑ consolidada |
| `/portal-proveedores/ordenes/[id]` | Detalle OC mtto + subir factura | ☑ |
| `/portal-proveedores/ordenes/cotizador/[id]` | Detalle OC cotizador (solo lectura) | ☑ |
| `/portal-proveedores/facturas` | Facturas enviadas y estatus | ☑ |
| `/portal-proveedores/pagos` | Saldos y pagos recibidos | ☑ |
| `/portal-proveedores/perfil` | Datos fiscales y contacto | ☐ |

## APIs (estado)

| Endpoint | Fase | Estado |
|----------|------|--------|
| `POST /api/portal-proveedores/invitations` | 1 | ☑ staff-only |
| `GET/POST /api/portal-proveedores/invitations/accept` | 1 | ☑ token público + aceptación |
| `GET /api/portal-proveedores/me` | 1 | ☑ contexto RFC + vínculos |
| `GET /api/portal-proveedores/ordenes` | 2–3 | ☑ lista consolidada mtto + cotizador |
| `GET /api/portal-proveedores/ordenes/[id]` | 2 | ☑ detalle mtto + facturas |
| `GET /api/portal-proveedores/ordenes/cotizador/[id]` | 3 | ☑ detalle read-only cotizador |
| `POST /api/portal-proveedores/cfdi/parse` | 2 | ☑ RFC emisor = portal |
| `GET/POST /api/portal-proveedores/facturas` | 2 | ☑ list + create + validate RPC |
| `GET /api/portal-proveedores/pagos` | 4 | ☑ |

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

**PR:** https://github.com/dssolutions-mx/mtto-dcconcretos/pull/33

### Sprint 3 — Fase 3: Visibilidad OC cross-repo (2026-06-17)

**Entregables:**
- `lib/portal-proveedores/cotizador-client.ts` — cliente read-only vía `COTIZADOR_SUPABASE_*`.
- `lib/portal-proveedores/cotizador-purchase-orders.ts` — listado y acceso a OC del cotizador por `cotizador_group_id` / RFC (`supplier_groups` → `suppliers`).
- `lib/portal-proveedores/consolidated-purchase-orders.ts` — merge mtto + cotizador con badge de origen.
- API `GET /ordenes` extendida; nueva `GET /ordenes/cotizador/[id]`.
- UI `/ordenes` consolidada; `/ordenes/cotizador/[id]` detalle read-only con líneas.
- Tests unitarios en `cotizador-purchase-orders.test.ts` y `consolidated-purchase-orders.test.ts`.

**Notas:**
- Sin migraciones (solo lectura federada al cotizador).
- Subida de facturas contra OC del cotizador queda para fase posterior.
- `invoice_count` en OC cotizador se deja en 0 (vínculo AP↔OC es indirecto vía entradas).

**PR:** https://github.com/dssolutions-mx/mtto-dcconcretos/pull/34

### Sprint 4 — Fase 4: Estatus de pago & saldos (2026-06-17)

**Entregables:**
- `lib/portal-proveedores/payment-summary.ts` — saldos mtto (`po_invoice_balances` + `po_invoice_payments`) y cotizador (`supplier_invoices` + `payables`/`payments`).
- API `GET /api/portal-proveedores/pagos` con resumen consolidado y por sistema.
- Página `/portal-proveedores/pagos` con tarjetas de saldo, facturas con saldo y pagos recientes.
- Detalle OC mtto muestra pagado/saldo por factura; nav y dashboard enlazan a pagos.
- Tests unitarios en `payment-summary.test.ts`.

**Notas:**
- Sin migraciones (solo lectura de vistas/tablas existentes).
- Cotizador: balance incluye notas de crédito aplicadas (`credit_note_invoice_allocations`).
- OC cotizador sin vínculo directo a facturas en portal (sin subida cross-repo aún).

**PR:** (se añade al abrir borrador)

---

## Próximo sprint (Fase 5 — Notificaciones + pulido)

**Repo:** `mtto-dcconcretos`.

**Alcance acotado:**
1. Notificaciones básicas al proveedor (factura recibida/aprobada/pagada) — email o in-app según infra disponible en mtto.
2. Página `/portal-proveedores/perfil` con datos fiscales de contacto (lectura/edición limitada).
3. Alineación visual final del portal (accesibilidad, estados vacíos, español consistente).

**Fuera de alcance en Fase 5:** subida de facturas contra OC del cotizador.

**Criterios de aceptación:** notificaciones o perfil entregado en alcance acotado; ledger actualizado; PR borrador.
