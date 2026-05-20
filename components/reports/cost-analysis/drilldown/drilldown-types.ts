export type DrilldownMetric =
  | 'volume'
  | 'ventas'
  | 'costo_mp'
  | 'spread'
  | 'costo_op'
  | 'ebitda'
  | 'diesel'
  | 'mantto'
  | 'nomina'
  | 'otros'
  | 'waterfall'

export const DRILLDOWN_LABELS: Record<DrilldownMetric, string> = {
  volume: 'Volumen concreto',
  ventas: 'Ventas totales',
  costo_mp: 'Costo materia prima',
  spread: 'Spread unitario',
  costo_op: 'Costo operativo',
  ebitda: 'EBITDA (incl. bombeo)',
  diesel: 'Diesel',
  mantto: 'Mantenimiento',
  nomina: 'Nómina',
  otros: 'Otros indirectos',
  waterfall: 'Cascada EBITDA',
}
