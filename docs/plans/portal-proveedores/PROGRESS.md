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

## Inventario de fases

| Fase | Descripción | Repo | Estado |
|------|-------------|------|--------|
| 0 | Discovery & arquitectura | mtto | ☑ |
| 1 | Identidad & auth de proveedor | mtto | ☐ |
| 2 | Alta/seguimiento facturas contra OC | mtto | ☐ |
| 3 | Visibilidad de OC (ambos sistemas) | mtto (+ read cotizador) | ☐ |
| 4 | Estatus de pago & saldos | mtto (+ read cotizador) | ☐ |
| 5 | Notificaciones + pulido | mtto | ☐ |

## Inventario de rutas (portal)

| Ruta | Propósito | Estado |
|------|-----------|--------|
| `/portal-proveedores` | Landing / redirect a login o dashboard | ▶ esqueleto |
| `/portal-proveedores/login` | Acceso proveedor | ☐ |
| `/portal-proveedores/invitacion` | Aceptar invitación (token) | ☐ |
| `/portal-proveedores/dashboard` | Resumen OC/facturas/pagos | ☐ |
| `/portal-proveedores/ordenes` | Lista de OC del proveedor | ☐ |
| `/portal-proveedores/ordenes/[id]` | Detalle OC + subir factura | ☐ |
| `/portal-proveedores/facturas` | Facturas enviadas y estatus | ☐ |
| `/portal-proveedores/pagos` | Saldos y pagos recibidos | ☐ |
| `/portal-proveedores/perfil` | Datos fiscales y contacto | ☐ |

## APIs planeadas (por fase)

| Endpoint | Fase | Notas |
|----------|------|-------|
| `POST /api/portal-proveedores/auth/invite` | 1 | Staff-only; crea `supplier_portal_users` |
| `GET /api/portal-proveedores/me` | 1 | Contexto RFC + vínculos |
| `GET /api/portal-proveedores/ordenes` | 2–3 | Filtrado por RFC / `supplier_id` |
| `POST /api/portal-proveedores/facturas` | 2 | Wrap de `createPoSupplierInvoice` |
| `POST /api/portal-proveedores/cfdi/parse` | 2 | Wrap de `/api/ap/cfdi/parse` |
| `GET /api/portal-proveedores/pagos` | 4 | Vista `po_invoice_balances` |

## Migraciones planeadas (archivos only — no aplicar)

| Archivo | Fase | Contenido |
|---------|------|-----------|
| `*_supplier_portal_users.sql` | 1 | Tabla membresía + índices |
| `*_supplier_portal_rls.sql` | 1 | Políticas lectura scoped por RFC |
| `*_supplier_portal_invitations.sql` | 1 | Tokens de invitación (opcional) |

## Sprints completados

### Sprint 0 — Discovery & arquitectura (2026-06-17)

**Entregables:**
- ADR-001 con decisiones de arquitectura, identidad y federación cross-repo.
- Este ledger (`PROGRESS.md`) con inventario de fases y rutas.
- Esqueleto de ruta `/portal-proveedores` (landing placeholder).
- `proxy.ts` + `SidebarWrapper` actualizados para chrome mínimo del portal.

**Hallazgos clave:**
- Mantenimiento tiene AP completo (`po_supplier_invoices`, pagos, CFDI, NC) — listo para exponer al proveedor.
- Cotizador usa `supplier_groups.rfc` como identidad fiscal; mantenimiento usa `suppliers.tax_id`.
- No hay portal ni `supplier_portal_users` en ningún repo; client portal del cotizador es el patrón a copiar.
- `purchase_orders.supplier_id` a menudo null — portal necesita resolución por RFC/invitación.
- `COTIZADOR_SUPABASE_URL` es solo lectura gerencial — no usar para sync AP.

**PR:** (se añade al abrir borrador)

---

## Próximo sprint (Fase 1 — Identidad & auth de proveedor)

**Repo:** `mtto-dcconcretos` únicamente.

**Alcance acotado:**
1. Migración `supabase/migrations/<ts>_supplier_portal_users.sql`:
   - Tabla `supplier_portal_users` (ver ADR-001).
   - Índice único `(auth_user_id)` y `(rfc, status)` para membresías activas.
2. `lib/portal-proveedores/resolvePortalContext.ts` — resolver membresía desde sesión (patrón `resolvePortalContext` del cotizador).
3. Rutas `/portal-proveedores/login` y `/portal-proveedores/invitacion` con formulario básico.
4. API staff-only `POST /api/portal-proveedores/invitations` para invitar por correo + RFC.
5. Página `/portal-proveedores/dashboard` placeholder autenticada (muestra RFC vinculado).

**Fuera de alcance en Fase 1:** subida de facturas, lectura cotizador, notificaciones.

**Criterios de aceptación:** migración en archivo (sin aplicar); proveedor puede aceptar invitación y ver dashboard vacío; staff puede invitar desde API; tests de `resolvePortalContext`; PR borrador.
