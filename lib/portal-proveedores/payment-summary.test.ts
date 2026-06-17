import test from "node:test"
import assert from "node:assert/strict"
import {
  aggregatePaymentSummary,
  type PortalInvoicePayable,
  type PortalPaymentWithInvoice,
} from "./payment-summary"

const sampleInvoices: PortalInvoicePayable[] = [
  {
    id: "inv-1",
    source: "mtto",
    invoice_number: "A-100",
    invoice_date: "2026-06-01",
    due_date: "2026-06-15",
    total: 1000,
    paid_to_date: 400,
    balance: 600,
    status: "partially_paid",
    order_id: "OC-001",
    purchase_order_id: "po-1",
    is_overdue: false,
    cfdi_uuid: null,
  },
  {
    id: "inv-2",
    source: "cotizador",
    invoice_number: "B-200",
    invoice_date: "2026-06-02",
    due_date: "2026-06-20",
    total: 500,
    paid_to_date: 500,
    balance: 0,
    status: "paid",
    order_id: null,
    purchase_order_id: null,
    is_overdue: false,
    cfdi_uuid: "uuid-1",
  },
]

const samplePayments: PortalPaymentWithInvoice[] = [
  {
    id: "pay-1",
    payment_date: "2026-06-10",
    amount: 400,
    reference: "TRF-1",
    payment_method: "transfer",
    invoice_id: "inv-1",
    invoice_number: "A-100",
    source: "mtto",
  },
]

test("aggregatePaymentSummary computes per-source and combined totals", () => {
  const summary = aggregatePaymentSummary(sampleInvoices, samplePayments, true)

  assert.equal(summary.mtto.invoice_count, 1)
  assert.equal(summary.mtto.partially_paid_count, 1)
  assert.equal(summary.mtto.total_balance, 600)

  assert.equal(summary.cotizador.paid_count, 1)
  assert.equal(summary.cotizador.total_paid, 500)

  assert.equal(summary.combined.invoice_count, 2)
  assert.equal(summary.combined.total_invoiced, 1500)
  assert.equal(summary.combined.total_paid, 900)
  assert.equal(summary.combined.total_balance, 600)
  assert.equal(summary.recent_payments.length, 1)
})

test("aggregatePaymentSummary marks cotizador unconfigured", () => {
  const summary = aggregatePaymentSummary([], [], false)
  assert.equal(summary.cotizador.configured, false)
  assert.equal(summary.cotizador.invoice_count, 0)
})
