import type { Supplier } from "@/types/suppliers"

export type VerificationCheckId =
  | "tax_id"
  | "tax_document"
  | "bank_account"
  | "primary_contact"
  | "certifications_row"
  | "activity"

export interface VerificationCheck {
  id: VerificationCheckId
  label: string
  pass: boolean
  detail?: string
}

export interface SupplierVerificationInput {
  supplier: Supplier
  certificationsCount: number
  primaryContactCount: number
  workHistoryCountLast365d: number
}

/** Pure checklist used by UI and server-side enforcement for certify action. */
export function evaluateSupplierVerification(input: SupplierVerificationInput): {
  checks: VerificationCheck[]
  passedCount: number
  totalCount: number
  allRequiredPass: boolean
} {
  const { supplier, certificationsCount, primaryContactCount, workHistoryCountLast365d } = input
  const bank = supplier.bank_account_info as { account_number?: string; clabe?: string } | null | undefined
  const hasBank =
    !!bank &&
    (typeof bank.account_number === "string" && bank.account_number.trim().length > 0 ||
      typeof bank.clabe === "string" && bank.clabe.trim().length > 0)

  const taxExempt = supplier.tax_exempt === true

  const checks: VerificationCheck[] = [
    {
      id: "tax_id",
      label: "RFC registrado",
      pass: !!supplier.tax_id && supplier.tax_id.trim().length > 0,
    },
    {
      id: "tax_document",
      label: taxExempt ? "Documento fiscal (exento)" : "Constancia fiscal / documento (URL)",
      pass: taxExempt ? true : !!supplier.tax_document_url && supplier.tax_document_url.trim().length > 0,
      detail: taxExempt ? "Proveedor marcado como exento de impuestos" : undefined,
    },
    {
      id: "bank_account",
      label: "Datos bancarios (cuenta o CLABE)",
      pass: hasBank,
    },
    {
      id: "primary_contact",
      label: "Al menos un contacto registrado",
      pass: primaryContactCount > 0,
      detail: primaryContactCount === 0 ? "Agrega un contacto en el expediente" : undefined,
    },
    {
      id: "certifications_row",
      label: "Al menos una certificación o licencia documentada",
      pass: certificationsCount > 0,
    },
    {
      id: "activity",
      label: "Actividad comprobable (≥1 OC o ≥1 trabajo en últimos 12 meses)",
      pass: (supplier.total_orders ?? 0) >= 1 || workHistoryCountLast365d >= 1,
      detail:
        (supplier.total_orders ?? 0) < 1 && workHistoryCountLast365d < 1
          ? "Registra al menos una orden de compra o un trabajo con este proveedor"
          : undefined,
    },
  ]

  const requiredIds: VerificationCheckId[] = [
    "tax_id",
    "tax_document",
    "bank_account",
    "primary_contact",
    "certifications_row",
    "activity",
  ]
  const required = checks.filter((c) => requiredIds.includes(c.id))
  const passedCount = required.filter((c) => c.pass).length
  const totalCount = required.length
  const allRequiredPass = required.every((c) => c.pass)

  return { checks, passedCount, totalCount, allRequiredPass }
}
