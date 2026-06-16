export type CfdiTipoComprobante = 'I' | 'E' | 'P' | 'N' | 'T'

export interface CfdiConcepto {
  clave_prod_serv?: string | null
  clave_unidad?: string | null
  unidad?: string | null
  no_identificacion?: string | null
  cantidad: number
  descripcion: string
  valor_unitario: number
  importe: number
  descuento?: number
  objeto_imp?: string | null
}

export interface CfdiRetencion {
  impuesto_sat: string
  importe: number
  tasa_o_cuota?: number
}

export interface ParsedCfdi {
  uuid: string
  serie?: string | null
  folio?: string | null
  tipo_comprobante: CfdiTipoComprobante
  fecha_emision: string
  fecha_timbrado: string
  emisor_rfc: string
  emisor_nombre?: string | null
  receptor_rfc: string
  receptor_nombre?: string | null
  subtotal: number
  descuento: number
  total: number
  iva_trasladado: number
  isr_retenido: number
  iva_retenido: number
  vat_rate: number
  retention_isr_rate: number
  retention_iva_rate: number
  retenciones: CfdiRetencion[]
  metodo_pago?: string | null
  forma_pago?: string | null
  uso_cfdi?: string | null
  moneda: string
  tipo_cambio: number
  cfdi_relacionados: Array<{ uuid: string; tipo_relacion: string }>
  conceptos: CfdiConcepto[]
}
