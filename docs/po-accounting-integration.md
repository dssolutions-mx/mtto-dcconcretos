# Integración contable de órdenes de compra (mantenimiento)

## Contexto

Las órdenes de compra de mantenimiento (`mtto-dcconcretos`) gestionan comprobantes operativos y pagos a nivel OC. Este módulo añade un **espacio de compras post-aprobación** alineado con el patrón AP del cotizador (`cotizaciones-concreto`).

## Referencia: cotizaciones-concreto

| Concepto cotizador | Mantenimiento |
|--------------------|---------------|
| `CxpWorkspace` (sin factura / facturas / NC) | `/compras/procurement` (resumen / sin factura / facturas / post-aprobación) |
| `supplier_invoices` | `po_supplier_invoices` |
| `supplier_invoice_items` | `po_supplier_invoice_items` |
| `payments` | `po_invoice_payments` |
| `OrphanEntriesTab` | `PoWithoutInvoiceTab` (OC aprobadas sin factura) |
| `InvoicesPayablesTab` | `PoInvoicesPayablesTab` (agrupado por proveedor, pagos parciales) |
| `RecordPaymentModal` | `RecordPoPaymentModal` |
| Action queue / dashboard | `ProcurementDashboardTab` + APIs |

Documentación cotizador: `cotizaciones-concreto/docs/AP_CUENTAS_POR_PAGAR.md`

## Flujo post-aprobación (mantenimiento)

```
OC aprobada
  → ejecutada (purchased/ordered/received/fulfilled)
  → comprobante (purchase_order_receipts)
  → factura proveedor (po_supplier_invoices + líneas)
  → pagos parciales/totales (po_invoice_payments)
  → validada (workflow) + accounting_status = paid
```

## Migraciones (no aplicar en agente)

| Archivo | Contenido |
|---------|-----------|
| `20260616120000_po_supplier_invoices.sql` | Tablas factura, accounting_status, vista resumen |
| `20260616140000_po_procurement_payments_and_views.sql` | Pagos, retenciones, vistas sin factura y balances |

## Rutas UI

| Ruta | Descripción |
|------|-------------|
| `/compras/procurement` | Workspace principal (tabs URL-driven) |
| `/compras/procurement?tab=sin_factura` | Cola OC sin factura |
| `/compras/procurement?tab=facturas` | CxP con pagos parciales |
| `/compras/[id]` | Detalle OC + ciclo contable + registro factura |

## APIs

| Endpoint | Rol |
|----------|-----|
| `GET /api/compras/procurement/dashboard` | KPIs post-aprobación |
| `GET /api/compras/procurement/action-queue` | Cola de acciones |
| `GET /api/ap/po-without-invoice` | OC sin factura |
| `GET /api/ap/invoices` | Facturas con saldo |
| `GET/POST /api/ap/payments` | Pagos parciales |
| `GET /api/purchase-orders/[id]/lifecycle` | Cadena documental |

## Fuera de alcance actual

- CFDI / SAT (importación, complementos de pago)
- Notas de crédito multi-factura
- Sincronización cross-DB con cotizador
- Portal de proveedores unificado

## Próximos pasos sugeridos

1. Notas de crédito (`po_credit_notes` + allocations)
2. Importación CFDI (parse + match a OC/comprobante)
3. Export contable integral (Excel revisión CxP)
4. Validación 3-way match (OC ↔ comprobante ↔ factura)
