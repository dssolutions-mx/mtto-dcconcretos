# ADR-001: Portal de proveedores unificado — arquitectura

**Estado:** Aceptado (Sprint 0)  
**Fecha:** 2026-06-17  
**Repos:** `mtto-dcconcretos` (ancla) + `cotizaciones-concreto` (fase 3+)

## Contexto

DC Concretos opera dos sistemas de compras/AP con modelos distintos:

| Sistema | Repo | OC / recepción | Facturas fiscales | Identidad proveedor |
|---------|------|----------------|-------------------|---------------------|
| Mantenimiento | `mtto-dcconcretos` | `purchase_orders`, `purchase_order_receipts` | `po_supplier_invoices`, `po_credit_notes` | `suppliers` (`tax_id` = RFC) |
| ERP cotizador | `cotizaciones-concreto` | `purchase_orders` → `material_entries` | `supplier_invoices`, `invoice_credit_notes` | `supplier_groups` (RFC) + `suppliers` por planta |

El módulo contable de OC en mantenimiento (`docs/po-accounting-integration.md`) dejó la estructura lista para un portal, pero lo marcó explícitamente **fuera de alcance**. No existe portal de proveedor en ningún repo. El puente `COTIZADOR_SUPABASE_URL` es **solo lectura** para reportes gerenciales — no sincroniza AP ni proveedores.

## Decisión

### 1. Repo ancla y rutas

- El portal vive en **`mtto-dcconcretos`** bajo `/portal-proveedores/*`.
- Repo ancla porque el brief nombra mantenimiento como sistema de OC/compras de mantenimiento y el ledger vive aquí.
- Rutas internas de staff (`/compras`, `/suppliers`) permanecen separadas; el portal usa layout sin sidebar interno.

### 2. Modelo de identidad

- **Clave fiscal unificadora:** RFC del emisor CFDI.
  - Mantenimiento: `suppliers.tax_id`
  - Cotizador: `supplier_groups.rfc`
- Tabla nueva `supplier_portal_users` (migración en Fase 1):
  - `auth_user_id` → `auth.users`
  - `rfc` (text, NOT NULL) — ancla de tenancy
  - `mtto_supplier_id` (uuid, nullable FK `suppliers`)
  - `cotizador_group_id` (uuid, nullable — sin FK cross-DB; validado en API)
  - `status`, `invited_by`, `invited_at`
- Patrón de referencia: `client_portal_users` en `cotizaciones-concreto` (`src/lib/client-portal/resolvePortalContext.ts`).

### 3. Autenticación y autorización

- **Supabase Auth** con invitación por correo (magic link o contraseña temporal).
- Rol interno `PROVEEDOR` **no** se añade al enum `user_role` de staff; el portal usa membresía en `supplier_portal_users`.
- **API-mediated reads/writes** con service role + filtro por RFC — no RLS directo sobre tablas AP (cotizador tiene RLS off en `payables`).
- `proxy.ts`: rutas `/portal-proveedores/login` y `/portal-proveedores/invitacion` como públicas (como `/compras/accion-po`).

### 4. Alcance de datos por fase

| Fase | Repo | Qué ve/hace el proveedor |
|------|------|--------------------------|
| 1 | mtto | Login, perfil, vincular RFC ↔ `suppliers` |
| 2 | mtto | Subir CFDI/factura contra OC de mantenimiento |
| 3 | mtto + cotizador (read API) | Ver OC consolidadas de ambos sistemas |
| 4 | ambos (API) | Estatus de pago, saldos, complementos |
| 5 | mtto | Notificaciones, pulido UX |

Cross-repo en fases 3–4: **federación en API** del portal (lee cotizador vía `COTIZADOR_SUPABASE_SERVICE_ROLE_KEY`), sin sincronización de esquema ni escritura cross-DB.

### 5. Vinculación OC ↔ proveedor (gap conocido)

Hoy `purchase_orders.supplier_id` se puebla principalmente al seleccionar cotización; muchas OC solo tienen `supplier` (texto). Para el portal:

1. Resolver por `supplier_id` cuando exista.
2. Fallback: match `cfdi_emisor_rfc` = RFC del usuario en facturas subidas.
3. Invitación explícita por OC (token en correo) como respaldo.

### 6. Reutilización de código existente

| Capacidad | Reutilizar |
|-----------|------------|
| Parse CFDI | `lib/sat/cfdiParser.ts` (mtto) |
| Crear factura PO | `lib/ap/createPoSupplierInvoice.ts` |
| Validación 3-way | RPC `validate_po_invoice_vs_oc` |
| UI referencia interna | `components/compras/procurement/*` (patrones, no componentes directos) |

## Consecuencias

- **Positivas:** Aprovecha AP ya entregado en mantenimiento; identidad RFC alinea con CFDI; patrón probado en client portal del cotizador.
- **Negativas:** Dos padrones de proveedor sin merge automático; federación cross-DB añade complejidad en Fase 3+; `supplier_id` débil en OC requiere trabajo de vinculación.
- **Riesgos:** Proveedor con RFC en un sistema pero no en el otro — requiere onboarding manual en Fase 1.

## Alternativas descartadas

1. **Portal en cotizador** — el brief ancla mantenimiento; OC de mantenimiento es el driver principal.
2. **App dedicada (tercer repo)** — overhead innecesario; mismo stack Next.js + Supabase.
3. **Sincronización cross-DB de proveedores** — fuera de alcance explícito; federación por API es suficiente.
4. **RLS directo con rol PROVEEDOR en profiles** — mezcla identidad staff y externa; rechazado.

## Referencias

- `docs/po-accounting-integration.md`
- `cotizaciones-concreto/docs/AP_CUENTAS_POR_PAGAR.md`
- `types/suppliers.ts`, `types/po-invoices.ts`
- `lib/auth/supplier-padron-permissions.ts`
