import { XMLParser } from 'fast-xml-parser'
import type { CfdiConcepto, CfdiRetencion, CfdiTipoComprobante, ParsedCfdi } from '@/types/cfdi'

export class CfdiParseError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message)
    this.name = 'CfdiParseError'
  }
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseAttributeValue: false,
  trimValues: true,
})

function num(v: unknown, fallback = 0): number {
  if (v === null || v === undefined || v === '') return fallback
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s.length === 0 ? null : s
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return []
  return Array.isArray(v) ? v : [v]
}

export function parseCfdiXml(xml: string): ParsedCfdi {
  let parsed: unknown
  try {
    parsed = parser.parse(xml)
  } catch (err) {
    throw new CfdiParseError(`XML inválido: ${(err as Error).message}`)
  }

  const comprobante = (parsed as { Comprobante?: Record<string, unknown> })?.Comprobante
  if (!comprobante) {
    throw new CfdiParseError('No se encontró el nodo cfdi:Comprobante', 'Comprobante')
  }

  const emisor = comprobante.Emisor as Record<string, unknown> | undefined
  const receptor = comprobante.Receptor as Record<string, unknown> | undefined
  if (!emisor?.['@_Rfc']) throw new CfdiParseError('Falta Emisor.Rfc', 'Emisor.Rfc')
  if (!receptor?.['@_Rfc']) throw new CfdiParseError('Falta Receptor.Rfc', 'Receptor.Rfc')

  const complemento = comprobante.Complemento as Record<string, unknown> | undefined
  const tfd = complemento?.TimbreFiscalDigital as Record<string, unknown> | undefined
  if (!tfd?.['@_UUID']) {
    throw new CfdiParseError('Falta TimbreFiscalDigital.UUID — el CFDI no está timbrado', 'UUID')
  }

  const tipo = String(comprobante['@_TipoDeComprobante'] ?? '').toUpperCase()
  if (!['I', 'E', 'P', 'N', 'T'].includes(tipo)) {
    throw new CfdiParseError(`TipoDeComprobante inválido: "${tipo}"`, 'TipoDeComprobante')
  }
  const tipo_comprobante = tipo as CfdiTipoComprobante

  const subtotal = num(comprobante['@_SubTotal'])
  const descuento = num(comprobante['@_Descuento'])
  const total = num(comprobante['@_Total'])

  const impuestos = comprobante.Impuestos as Record<string, unknown> | undefined
  let iva_trasladado = 0
  let vat_rate = 0
  if (impuestos?.Traslados) {
    const traslados = asArray(
      (impuestos.Traslados as { Traslado?: unknown }).Traslado as Record<string, unknown>,
    )
    for (const t of traslados) {
      if (String(t?.['@_Impuesto']) === '002') {
        iva_trasladado += num(t?.['@_Importe'])
        const tasa = num(t?.['@_TasaOCuota'])
        if (tasa > vat_rate) vat_rate = tasa
      }
    }
  }

  let isr_retenido = 0
  let iva_retenido = 0
  const retenciones: CfdiRetencion[] = []
  if (impuestos?.Retenciones) {
    const retencionNodes = asArray(
      (impuestos.Retenciones as { Retencion?: unknown }).Retencion as Record<string, unknown>,
    )
    for (const r of retencionNodes) {
      const imp = String(r?.['@_Impuesto'] ?? '')
      const importe = num(r?.['@_Importe'])
      const tasa = num(r?.['@_TasaOCuota'])
      if (imp === '001') isr_retenido += importe
      else if (imp === '002') iva_retenido += importe
      retenciones.push({
        impuesto_sat: imp,
        importe,
        tasa_o_cuota: tasa > 0 ? tasa : undefined,
      })
    }
  }

  const taxable_base = Math.max(0, subtotal - descuento)
  const retention_isr_rate =
    taxable_base > 0 ? Math.round((isr_retenido / taxable_base) * 1000000) / 1000000 : 0
  const retention_iva_rate =
    taxable_base > 0 ? Math.round((iva_retenido / taxable_base) * 1000000) / 1000000 : 0

  const conceptos: CfdiConcepto[] = []
  const conceptoNodes = asArray(
    (comprobante.Conceptos as { Concepto?: unknown } | undefined)?.Concepto as Record<
      string,
      unknown
    >,
  )
  for (const c of conceptoNodes) {
    conceptos.push({
      clave_prod_serv: str(c?.['@_ClaveProdServ']),
      clave_unidad: str(c?.['@_ClaveUnidad']),
      unidad: str(c?.['@_Unidad']),
      no_identificacion: str(c?.['@_NoIdentificacion']),
      cantidad: num(c?.['@_Cantidad'], 1),
      descripcion: str(c?.['@_Descripcion']) ?? '',
      valor_unitario: num(c?.['@_ValorUnitario']),
      importe: num(c?.['@_Importe']),
      descuento: num(c?.['@_Descuento']),
      objeto_imp: str(c?.['@_ObjetoImp']),
    })
  }

  const cfdi_relacionados: Array<{ uuid: string; tipo_relacion: string }> = []
  const relWrappers = asArray(comprobante.CfdiRelacionados as Record<string, unknown>)
  for (const wrap of relWrappers) {
    const tipoRel = String(wrap?.['@_TipoRelacion'] ?? '')
    const related = asArray(wrap?.CfdiRelacionado as Record<string, unknown>)
    for (const r of related) {
      const uuid = str(r?.['@_UUID'])
      if (uuid) cfdi_relacionados.push({ uuid: uuid.toLowerCase(), tipo_relacion: tipoRel })
    }
  }

  return {
    uuid: String(tfd['@_UUID']).toLowerCase(),
    serie: str(comprobante['@_Serie']),
    folio: str(comprobante['@_Folio']),
    tipo_comprobante,
    fecha_emision: String(comprobante['@_Fecha']),
    fecha_timbrado: String(tfd['@_FechaTimbrado']),
    emisor_rfc: String(emisor['@_Rfc']).toUpperCase(),
    emisor_nombre: str(emisor['@_Nombre']),
    receptor_rfc: String(receptor['@_Rfc']).toUpperCase(),
    receptor_nombre: str(receptor['@_Nombre']),
    subtotal,
    descuento,
    total,
    iva_trasladado,
    isr_retenido,
    iva_retenido,
    vat_rate,
    retention_isr_rate,
    retention_iva_rate,
    retenciones,
    metodo_pago: str(comprobante['@_MetodoPago']),
    forma_pago: str(comprobante['@_FormaPago']),
    uso_cfdi: str(receptor?.['@_UsoCFDI']),
    moneda: str(comprobante['@_Moneda']) ?? 'MXN',
    tipo_cambio: num(comprobante['@_TipoCambio'], 1),
    cfdi_relacionados,
    conceptos,
  }
}
