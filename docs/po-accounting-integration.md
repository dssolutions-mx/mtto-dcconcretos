# Integración contable de órdenes de compra (mantenimiento)

## Contexto

Las órdenes de compra de mantenimiento (`mtto-dcconcretos`) gestionan comprobantes operativos y pagos a nivel OC. Este módulo añade un **espacio de compras post-aprobación** alineado con el patrón AP del cotizador (`cotizaciones-concreto`).

**Regla de negocio clave:** el monto registrado en la OC es **sin IVA**. El pago al proveedor corresponde al **neto a pagar** de la factura (base + IVA − retenciones). La UI expone esta distinción en todo el flujo.

## Referencia: cotizaciones-concreto

| Concepto cotizador | Mantenimiento |
|--------------------|---------------|
| `CxpWorkspace` | `/compras/procurement` |
| `supplier_invoices` | `po_supplier_invoices` |
| `invoice_credit_notes` | `po_credit_notes` |
| `BulkCfdiInvoiceDialog` | `BulkCfdiInvoiceDialog` (mantenimiento) |
| `cxp-review-export` | `GET /api/ap/cxp-review-export` |
| Validación 3-way | RPC `validate_po_invoice_vs_oc` |

## Flujo post-aprobación

```
OC aprobada (monto sin IVA)
  → ejecutada (purchased/ordered/received/fulfilled)
  → comprobante (purchase_order_receipts)
  → factura proveedor (manual o CFDI XML)
  → validación suave OC ↔ factura ↔ comprobante
  → pagos parciales/totales (monto neto con IVA)
  → notas de crédito (opcional)
  → accounting_status = paid
```

## Migraciones (no aplicar en agente)

| Archivo | Contenido |
|---------|-----------|
| `20260616120000_po_supplier_invoices.sql` | Tablas factura, accounting_status |
| `20260616140000_po_procurement_payments_and_views.sql` | Pagos, retenciones, vistas |
| `20260616160000_po_procurement_cfdi_credit_notes.sql` | CFDI, NC, validación 3-way |

## Rutas UI

| Ruta | Descripción |
|------|-------------|
| `/compras/procurement` | Workspace (resumen, sin factura, facturas, NC, post-aprobación) |
| `/compras/[id]` | Detalle OC + desglose sin IVA / neto a pagar |

## APIs

| Endpoint | Rol |
|----------|-----|
| `POST /api/ap/cfdi/parse` | Parse XML único |
| `POST /api/ap/cfdi/parse-bulk` | ZIP masivo facturas |
| `POST /api/ap/cfdi/parse-bulk-credit-notes` | ZIP masivo NC tipo E |
| `GET /api/ap/invoices/[id]/validate` | Validación 3-way + recordatorio IVA |
| `GET/POST /api/ap/credit-notes` | Notas de crédito |
| `GET /api/ap/cxp-review-export` | Excel revisión CxP |

## Componentes UX (IVA)

- `PoAmountBreakdown` — desglose OC sin IVA vs neto a pagar
- `po-context-band` — etiqueta "Sin IVA" en monto autorizado
- `RecordPoPaymentModal` — validación + advertencias antes de pagar

## Fuera de alcance

- Sincronización cross-DB con cotizador
- Portal de proveedores unificado
- Complementos de pago (REP) automáticos
