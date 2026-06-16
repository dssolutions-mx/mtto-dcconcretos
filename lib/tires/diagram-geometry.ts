import { isPressureOutOfRange, isTreadLow } from '@/lib/tires/positions'
import type { AssetTireInstallation, TireLayoutTemplateKey, TirePosition } from '@/types/tires'

/**
 * Legacy 3-state diagram status. Kept for backwards-compatibility and unit
 * tests. For richer presentation use `getTireHealthStatus` in lib/tires/status.
 */
export type TireDiagramVisualState = 'empty' | 'ok' | 'alert'

/** Visual body silhouette drawn under the tires. */
export type TireBodyType = 'truck' | 'mixer' | 'vehicle' | 'generic'

export interface DiagramTireCoords {
  code: string
  cx: number
  cy: number
  /** Hit-area radius (also used to size external drop zones). */
  r: number
  /** Rounded-rect footprint width. */
  w: number
  /** Rounded-rect footprint height. */
  h: number
  side: TirePosition['side']
  axle: number
  /** Compact tag rendered under the tire (e.g. "Ext", "Int"). */
  tag: string
}

export interface DiagramAxle {
  axle: number
  y: number
  xLeft: number
  xRight: number
  label: string
  role: string
}

export interface DiagramGeometry {
  viewBox: string
  bodyType: TireBodyType
  chassis: { x: number; y: number; width: number; height: number }
  cab: { x: number; y: number; width: number; height: number }
  frontLabel: { x: number; y: number }
  axles: DiagramAxle[]
  tires: DiagramTireCoords[]
}

const TIRE_RADIUS = 22
const TIRE_W = 30
const TIRE_H = 46

type RawCoord = { cx: number; cy: number }

/** Fixed top-down coordinates for truck_6x4 (10 positions). */
const TRUCK_6X4_COORDS: Record<string, RawCoord> = {
  eje1_izq: { cx: 92, cy: 120 },
  eje1_der: { cx: 308, cy: 120 },
  eje2_izq_ext: { cx: 70, cy: 250 },
  eje2_izq_int: { cx: 112, cy: 250 },
  eje2_der_int: { cx: 288, cy: 250 },
  eje2_der_ext: { cx: 330, cy: 250 },
  eje3_izq_ext: { cx: 70, cy: 360 },
  eje3_izq_int: { cx: 112, cy: 360 },
  eje3_der_int: { cx: 288, cy: 360 },
  eje3_der_ext: { cx: 330, cy: 360 },
}

/** Fixed top-down coordinates for vehicle_4wheel (4 positions). */
const VEHICLE_4WHEEL_COORDS: Record<string, RawCoord> = {
  del_izq: { cx: 70, cy: 110 },
  del_der: { cx: 230, cy: 110 },
  tras_izq: { cx: 70, cy: 300 },
  tras_der: { cx: 230, cy: 300 },
}

const TEMPLATE_CHASSIS: Record<
  Exclude<TireLayoutTemplateKey, 'custom'>,
  Pick<DiagramGeometry, 'viewBox' | 'chassis' | 'cab' | 'frontLabel' | 'bodyType'>
> = {
  truck_6x4: {
    viewBox: '0 0 400 450',
    chassis: { x: 150, y: 66, width: 100, height: 330 },
    cab: { x: 158, y: 24, width: 84, height: 46 },
    frontLabel: { x: 200, y: 16 },
    bodyType: 'truck',
  },
  vehicle_4wheel: {
    viewBox: '0 0 300 400',
    chassis: { x: 110, y: 60, width: 80, height: 300 },
    cab: { x: 118, y: 24, width: 64, height: 42 },
    frontLabel: { x: 150, y: 16 },
    bodyType: 'vehicle',
  },
}

/** Derive the visual silhouette from an asset/model category + layout template. */
export function tireBodyTypeFromCategory(
  category: string | null | undefined,
  templateKey: TireLayoutTemplateKey
): TireBodyType {
  const c = (category ?? '').toLowerCase()
  if (/mixer|revolved|olla|tromp|concret|hormig|mezclad/.test(c)) return 'mixer'
  if (templateKey === 'vehicle_4wheel') return 'vehicle'
  if (templateKey === 'truck_6x4') return 'truck'
  return 'generic'
}

function tireTag(pos: TirePosition): string {
  if (pos.code.includes('_ext')) return 'Ext'
  if (pos.code.includes('_int')) return 'Int'
  if (pos.side === 'centro') return 'Centro'
  return pos.side === 'izq' ? 'Izq' : 'Der'
}

function axleRole(axle: number, totalAxles: number, bodyType: TireBodyType): string {
  if (bodyType === 'vehicle') return axle === 1 ? 'Delantero' : 'Trasero'
  if (axle === 1) return 'Dirección'
  return 'Tracción'
}

function buildAxles(
  positions: TirePosition[],
  coords: Map<string, DiagramTireCoords>,
  bodyType: TireBodyType
): DiagramAxle[] {
  const byAxle = new Map<number, DiagramTireCoords[]>()
  for (const pos of positions) {
    const c = coords.get(pos.code)
    if (!c) continue
    const list = byAxle.get(pos.axle) ?? []
    list.push(c)
    byAxle.set(pos.axle, list)
  }
  const axleNums = [...byAxle.keys()].sort((a, b) => a - b)
  return axleNums.map((axle) => {
    const tires = byAxle.get(axle)!
    const xs = tires.map((t) => t.cx)
    const ys = tires.map((t) => t.cy)
    return {
      axle,
      y: ys.reduce((s, v) => s + v, 0) / ys.length,
      xLeft: Math.min(...xs),
      xRight: Math.max(...xs),
      label: `Eje ${axle}`,
      role: axleRole(axle, axleNums.length, bodyType),
    }
  })
}

/** Graceful auto-layout for custom / unknown templates. */
function buildAutoGeometry(positions: TirePosition[]): DiagramGeometry {
  const width = 360
  const centerX = 180
  const chassisW = 110
  const chassisX = centerX - chassisW / 2
  const topPad = 84
  const axleGap = 122

  const axleNums = [...new Set(positions.map((p) => p.axle))].sort((a, b) => a - b)
  const effectiveAxles = axleNums.length > 0 ? axleNums : [1]
  const height = topPad + effectiveAxles.length * axleGap + 16

  const tires: DiagramTireCoords[] = []

  effectiveAxles.forEach((axle, axleIdx) => {
    const y = topPad + axleIdx * axleGap + 44
    const inAxle = positions.filter((p) => (p.axle || 1) === axle)

    const order = (p: TirePosition) => (p.code.includes('_ext') ? 1 : 0)
    const left = inAxle.filter((p) => p.side === 'izq').sort((a, b) => order(a) - order(b))
    const right = inAxle.filter((p) => p.side === 'der').sort((a, b) => order(a) - order(b))
    const center = inAxle.filter((p) => p.side === 'centro')

    left.forEach((p, i) => {
      tires.push({
        code: p.code,
        cx: chassisX - 18 - i * 40,
        cy: y,
        r: TIRE_RADIUS,
        w: TIRE_W,
        h: TIRE_H,
        side: p.side,
        axle: p.axle,
        tag: tireTag(p),
      })
    })
    right.forEach((p, i) => {
      tires.push({
        code: p.code,
        cx: chassisX + chassisW + 18 + i * 40,
        cy: y,
        r: TIRE_RADIUS,
        w: TIRE_W,
        h: TIRE_H,
        side: p.side,
        axle: p.axle,
        tag: tireTag(p),
      })
    })
    center.forEach((p, i) => {
      tires.push({
        code: p.code,
        cx: centerX + (i - (center.length - 1) / 2) * 40,
        cy: y,
        r: TIRE_RADIUS,
        w: TIRE_W,
        h: TIRE_H,
        side: p.side,
        axle: p.axle,
        tag: tireTag(p),
      })
    })
  })

  return {
    viewBox: `0 0 ${width} ${height}`,
    bodyType: 'generic',
    chassis: { x: chassisX, y: 68, width: chassisW, height: height - 68 - 16 },
    cab: { x: centerX - 42, y: 24, width: 84, height: 44 },
    frontLabel: { x: centerX, y: 16 },
    axles: [],
    tires,
  }
}

export function getDiagramGeometry(
  templateKey: TireLayoutTemplateKey,
  positions: TirePosition[]
): DiagramGeometry {
  if (templateKey === 'custom') {
    const geo = buildAutoGeometry(positions)
    const coordMap = new Map(geo.tires.map((t) => [t.code, t]))
    geo.axles = buildAxles(positions, coordMap, 'generic')
    return geo
  }

  const template = TEMPLATE_CHASSIS[templateKey] ?? TEMPLATE_CHASSIS.truck_6x4
  const rawCoords = templateKey === 'vehicle_4wheel' ? VEHICLE_4WHEEL_COORDS : TRUCK_6X4_COORDS

  const tires: DiagramTireCoords[] = positions.map((pos, index) => {
    const raw = rawCoords[pos.code]
    if (raw) {
      return {
        code: pos.code,
        cx: raw.cx,
        cy: raw.cy,
        r: TIRE_RADIUS,
        w: TIRE_W,
        h: TIRE_H,
        side: pos.side,
        axle: pos.axle,
        tag: tireTag(pos),
      }
    }
    // Fallback for codes not in the fixed map (keeps cx/cy > 0).
    const cols = 2
    const row = Math.floor(index / cols)
    const col = index % cols
    const baseX = pos.side === 'der' || pos.side === 'centro' ? 260 : 80
    return {
      code: pos.code,
      cx: baseX + col * 30,
      cy: 80 + row * 70,
      r: TIRE_RADIUS,
      w: TIRE_W,
      h: TIRE_H,
      side: pos.side,
      axle: pos.axle,
      tag: tireTag(pos),
    }
  })

  const coordMap = new Map(tires.map((t) => [t.code, t]))
  return {
    ...template,
    axles: buildAxles(positions, coordMap, template.bodyType),
    tires,
  }
}

export function getPositionVisualState(
  installation: AssetTireInstallation | undefined
): TireDiagramVisualState {
  if (!installation?.tire) return 'empty'

  const reading = installation.latest_reading
  const treadLow = isTreadLow(reading?.tread_depth_mm, installation.tire.min_tread_mm)
  const pressureBad = isPressureOutOfRange(reading?.pressure_psi)

  if (treadLow || pressureBad) return 'alert'
  return 'ok'
}

export const DIAGRAM_STATE_COLORS: Record<
  TireDiagramVisualState,
  { fill: string; stroke: string; strokeDasharray?: string }
> = {
  empty: { fill: 'hsl(var(--tire-empty-fill))', stroke: 'hsl(var(--tire-empty))', strokeDasharray: '4 3' },
  ok: { fill: 'hsl(var(--tire-ok-fill))', stroke: 'hsl(var(--tire-ok))' },
  alert: { fill: 'hsl(var(--tire-warning-fill))', stroke: 'hsl(var(--tire-warning))' },
}
