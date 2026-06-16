# Integración contable de órdenes de compra (mantenimiento)

## Contexto

Las órdenes de compra de mantenimiento (`mtto-dcconcretos`) hoy manejan comprobantes operativos (`purchase_order_receipts`) y pagos (`accounts_payable_summary`), pero no tienen un registro fiscal estructurado como las facturas del ERP de cotizaciones.

## Referencia: cotizaciones-concreto

En `cotizaciones-concreto`, el módulo AP usa:

| Concepto | Tabla / archivo |
|----------|-----------------|
| Cabecera de factura | `supplier_invoices` |
| Líneas | `supplier_invoice_items` |
| Servicio de alta | `src/lib/ap/createSupplierInvoice.ts` |
| Estados | `open` → `partially_paid` → `paid` / `void` |
| Categoría de costo | `material` / `fleet` en líneas |

Documentación: `docs/AP_CUENTAS_POR_PAGAR.md`.

## Diseño espejo en mantenimiento

| Cotizaciones | Mantenimiento |
|--------------|---------------|
| `supplier_invoices` | `po_supplier_invoices` |
| `supplier_invoice_items` | `po_supplier_invoice_items` |
| `material_entries` / `po_id` | `purchase_order_id` directo |
| `cost_category` material/fleet | `expense_category` refacciones/mano_obra/servicio_externo/otros |

Migración: `supabase/migrations/20260616120000_po_supplier_invoices.sql`

## Flujo v1

1. OC en estado aprobado o posterior.
2. Área administrativa registra factura desde `/compras/[id]` (sección “Factura de proveedor”).
3. Se captura folio, fecha, subtotal, IVA, categoría contable y comprobante opcional.
4. `purchase_orders.accounting_status` pasa a `invoiced`.
5. Listado en `/compras/facturas`.

## Fuera de alcance (slice 1)

- Importación CFDI
- Notas de crédito
- Sincronización cross-DB con cotizador
- Conciliación de pagos fiscal vs operativo

## Portal de proveedores (futuro)

La estructura `po_supplier_invoices` + `supplier_id` deja el gancho para que un portal unificado maneje compras de ambos sistemas sin reescribir el modelo.
