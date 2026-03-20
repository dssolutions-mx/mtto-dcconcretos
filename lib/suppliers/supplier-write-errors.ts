import { NextResponse } from 'next/server'

const DUPLICATE_NAME_BU_MESSAGE =
  'Este proveedor ya está registrado para la misma unidad de negocio. No se puede crear de nuevo. Cierra este formulario y búscalo en la lista con el buscador, o cambia el nombre / la unidad principal si corresponde otro registro.'

export function isSupplierNameBusinessUnitUniqueViolation(error: {
  code?: string
  message?: string
}): boolean {
  return (
    error.code === '23505' ||
    (error.message?.includes('suppliers_name_business_unit_unique') ?? false)
  )
}

export function supplierDuplicateNameBuResponse(): NextResponse {
  return NextResponse.json(
    { error: DUPLICATE_NAME_BU_MESSAGE, code: 'DUPLICATE_SUPPLIER_NAME_BU' },
    { status: 409 }
  )
}
