'use client'

import type { ReactNode } from 'react'
import { useId, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  getDiagramGeometry,
  type DiagramTireCoords,
  type TireBodyType,
} from '@/lib/tires/diagram-geometry'
import {
  getTireHealthStatus,
  getTireStatusDetail,
  treadFraction,
  TIRE_STATUS_LEGEND,
  TIRE_STATUS_VISUALS,
  type TireHealthStatus,
} from '@/lib/tires/status'
import type {
  AssetTireInstallation,
  TireLayoutTemplateKey,
  TirePosition,
  TireThresholds,
} from '@/types/tires'

export type TireDiagramDropState = 'default' | 'drag-over' | 'invalid'

interface TireDiagramSvgProps {
  templateKey: TireLayoutTemplateKey
  positions: TirePosition[]
  activeInstallations: AssetTireInstallation[]
  /** Overrides the silhouette body (e.g. 'mixer' to draw the drum hint). */
  bodyType?: TireBodyType
  thresholds?: TireThresholds
  selectedPositionCode?: string | null
  dragOverPositionCode?: string | null
  invalidDropPositionCode?: string | null
  positionDropStates?: Record<string, TireDiagramDropState>
  /** Empty positions to softly pulse as drop/tap targets (mobile assign). */
  availablePositionCodes?: string[]
  /** Position to play a one-shot "mounted" pop animation on. */
  recentlyMountedCode?: string | null
  positionWrapper?: (props: { position: TirePosition; children: ReactNode }) => ReactNode
  onPositionClick: (position: TirePosition, installation?: AssetTireInstallation) => void
  className?: string
  showLegend?: boolean
}

export function TireDiagramSvg({
  templateKey,
  positions,
  activeInstallations,
  bodyType,
  thresholds,
  selectedPositionCode,
  dragOverPositionCode,
  invalidDropPositionCode,
  positionDropStates,
  availablePositionCodes,
  recentlyMountedCode,
  positionWrapper,
  onPositionClick,
  className,
  showLegend = true,
}: TireDiagramSvgProps) {
  const uid = useId().replace(/:/g, '')
  const geometry = useMemo(
    () => getDiagramGeometry(templateKey, positions),
    [templateKey, positions]
  )
  const resolvedBody = bodyType ?? geometry.bodyType

  const byPosition = useMemo(
    () => new Map(activeInstallations.map((i) => [i.position_code, i])),
    [activeInstallations]
  )
  const positionByCode = useMemo(
    () => new Map(positions.map((p) => [p.code, p])),
    [positions]
  )
  const availableSet = useMemo(
    () => new Set(availablePositionCodes ?? []),
    [availablePositionCodes]
  )

  // Group dual tires (same axle + side) to draw a subtle grouping hub behind them.
  const dualHubs = useMemo(() => {
    const groups = new Map<string, DiagramTireCoords[]>()
    for (const t of geometry.tires) {
      const key = `${t.axle}-${t.side}`
      const list = groups.get(key) ?? []
      list.push(t)
      groups.set(key, list)
    }
    return [...groups.values()]
      .filter((g) => g.length > 1)
      .map((g) => {
        const xs = g.map((t) => t.cx)
        const minX = Math.min(...xs)
        const maxX = Math.max(...xs)
        const cy = g[0].cy
        return {
          key: `${g[0].axle}-${g[0].side}`,
          x: minX - g[0].w / 2 - 5,
          y: cy - g[0].h / 2 - 5,
          width: maxX - minX + g[0].w + 10,
          height: g[0].h + 10,
        }
      })
  }, [geometry.tires])

  return (
    <div className={cn('w-full', className)}>
      <svg
        viewBox={geometry.viewBox}
        className="tire-diagram mx-auto h-auto w-full max-w-lg"
        role="img"
        aria-label="Diagrama de posiciones de llantas del vehículo"
      >
        <defs>
          <linearGradient id={`chassis-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity={0.9} />
            <stop offset="100%" stopColor="hsl(var(--muted))" stopOpacity={0.55} />
          </linearGradient>
          <linearGradient id={`cab-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity={0.95} />
            <stop offset="100%" stopColor="hsl(var(--muted))" stopOpacity={0.7} />
          </linearGradient>
          <radialGradient id={`drum-${uid}`} cx="0.5" cy="0.35" r="0.75">
            <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.18} />
            <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.04} />
          </radialGradient>
        </defs>

        {/* ── Vehicle silhouette ─────────────────────────────────────────── */}
        <g aria-hidden>
          {/* Chassis body */}
          <rect
            x={geometry.chassis.x}
            y={geometry.chassis.y}
            width={geometry.chassis.width}
            height={geometry.chassis.height}
            rx={16}
            fill={`url(#chassis-${uid})`}
            stroke="hsl(var(--border))"
            strokeWidth={1.5}
          />
          {/* Subtle center frame rail — starts below cab / front label */}
          <line
            x1={geometry.chassis.x + geometry.chassis.width / 2}
            y1={geometry.cab.y + geometry.cab.height + 6}
            x2={geometry.chassis.x + geometry.chassis.width / 2}
            y2={geometry.chassis.y + geometry.chassis.height - 8}
            stroke="hsl(var(--border))"
            strokeWidth={1}
            strokeDasharray="2 5"
            opacity={0.6}
          />

          {/* Cab / front */}
          <rect
            x={geometry.cab.x}
            y={geometry.cab.y}
            width={geometry.cab.width}
            height={geometry.cab.height}
            rx={12}
            fill={`url(#cab-${uid})`}
            stroke="hsl(var(--border))"
            strokeWidth={1.5}
          />
          {/* Windshield hint */}
          <rect
            x={geometry.cab.x + 10}
            y={geometry.cab.y + geometry.cab.height - 14}
            width={geometry.cab.width - 20}
            height={8}
            rx={3}
            fill="hsl(var(--border))"
            opacity={0.5}
          />
          {/* Front direction chevron + label */}
          <path
            d={`M ${geometry.frontLabel.x - 7} ${geometry.cab.y - 2} L ${geometry.frontLabel.x} ${geometry.cab.y - 9} L ${geometry.frontLabel.x + 7} ${geometry.cab.y - 2}`}
            fill="none"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.7}
          />
          <rect
            x={geometry.frontLabel.x - 26}
            y={geometry.frontLabel.y - 9}
            width={52}
            height={14}
            rx={4}
            fill="hsl(var(--background))"
            stroke="hsl(var(--border))"
            strokeWidth={0.75}
            opacity={0.95}
          />
          <text
            x={geometry.frontLabel.x}
            y={geometry.frontLabel.y + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground text-[10px] font-semibold uppercase tracking-wide"
          >
            Frente
          </text>

          {/* Mixer drum hint */}
          {resolvedBody === 'mixer' && <MixerDrum geometry={geometry} uid={uid} />}

          {/* Axle lines + labels */}
          {geometry.axles.map((axle) => (
            <g key={axle.axle}>
              <line
                x1={axle.xLeft}
                y1={axle.y}
                x2={axle.xRight}
                y2={axle.y}
                stroke="hsl(var(--border))"
                strokeWidth={3}
                strokeLinecap="round"
                opacity={0.8}
              />
              <text
                x={8}
                y={axle.y - 3}
                className="fill-foreground text-[10px] font-semibold"
              >
                {axle.label}
              </text>
              <text
                x={8}
                y={axle.y + 9}
                className="fill-muted-foreground text-[8px] font-medium uppercase tracking-wide"
              >
                {axle.role}
              </text>
            </g>
          ))}

          {/* Dual grouping hubs */}
          {dualHubs.map((hub) => (
            <rect
              key={hub.key}
              x={hub.x}
              y={hub.y}
              width={hub.width}
              height={hub.height}
              rx={8}
              fill="hsl(var(--muted-foreground))"
              opacity={0.05}
            />
          ))}
        </g>

        {/* ── Tires ──────────────────────────────────────────────────────── */}
        {geometry.tires.map((tire) => {
          const pos = positionByCode.get(tire.code)
          if (!pos) return null
          const inst = byPosition.get(tire.code)
          const status = getTireHealthStatus(inst, thresholds)
          const isSelected = selectedPositionCode === tire.code
          const dropState =
            positionDropStates?.[tire.code] ??
            (invalidDropPositionCode === tire.code
              ? 'invalid'
              : dragOverPositionCode === tire.code
                ? 'drag-over'
                : 'default')

          const node = (
            <TireGlyph
              key={tire.code}
              tire={tire}
              position={pos}
              installation={inst}
              status={status}
              isSelected={isSelected}
              dropState={dropState}
              isAvailable={!inst && availableSet.has(tire.code)}
              poppedMount={recentlyMountedCode === tire.code}
              thresholds={thresholds}
              onClick={() => onPositionClick(pos, inst)}
            />
          )

          if (positionWrapper) {
            return <g key={tire.code}>{positionWrapper({ position: pos, children: node })}</g>
          }
          return node
        })}
      </svg>

      {showLegend && <DiagramLegend />}
    </div>
  )
}

function MixerDrum({
  geometry,
  uid,
}: {
  geometry: ReturnType<typeof getDiagramGeometry>
  uid: string
}) {
  const cx = geometry.chassis.x + geometry.chassis.width / 2
  // Drum sits over the rear two thirds of the chassis.
  const top = geometry.chassis.y + geometry.chassis.height * 0.32
  const bottom = geometry.chassis.y + geometry.chassis.height - 6
  const rx = geometry.chassis.width * 0.42
  const cy = (top + bottom) / 2
  const ry = (bottom - top) / 2
  return (
    <g aria-hidden>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#drum-${uid})`} stroke="hsl(var(--border))" strokeWidth={1} />
      {[0.28, 0.5, 0.72].map((f) => (
        <line
          key={f}
          x1={cx - rx + 4}
          y1={top + (bottom - top) * f}
          x2={cx + rx - 4}
          y2={top + (bottom - top) * f - 14}
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={1}
          opacity={0.25}
        />
      ))}
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-muted-foreground text-[8px] font-medium uppercase tracking-widest"
        opacity={0.6}
      >
        Olla
      </text>
    </g>
  )
}

interface TireGlyphProps {
  tire: DiagramTireCoords
  position: TirePosition
  installation?: AssetTireInstallation
  status: TireHealthStatus
  isSelected: boolean
  dropState: TireDiagramDropState
  isAvailable: boolean
  poppedMount: boolean
  thresholds?: TireThresholds
  onClick: () => void
}

function TireGlyph({
  tire,
  position,
  installation,
  status,
  isSelected,
  dropState,
  isAvailable,
  poppedMount,
  thresholds,
  onClick,
}: TireGlyphProps) {
  const visual = TIRE_STATUS_VISUALS[status]
  const x = tire.cx - tire.w / 2
  const y = tire.cy - tire.h / 2
  const reading = installation?.latest_reading
  const tread = reading?.tread_depth_mm
  const frac = treadFraction(tread)

  const outline =
    dropState === 'drag-over'
      ? 'hsl(var(--primary))'
      : dropState === 'invalid'
        ? 'hsl(var(--destructive))'
        : isSelected
          ? 'hsl(var(--primary))'
          : visual.stroke
  const outlineWidth = dropState !== 'default' || isSelected ? 2.5 : 1.75

  return (
    <g
      className="tire-pos-group cursor-pointer outline-none"
      data-position={tire.code}
      data-drop={dropState !== 'default' ? dropState : undefined}
      data-available={isAvailable ? 'true' : undefined}
      data-mounted-pop={poppedMount ? 'true' : undefined}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`${position.label} — ${installation ? visual.label : 'vacía'}${dropState === 'drag-over' ? ', soltar aquí' : ''}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {/* Hit area */}
      <rect x={tire.cx - 30} y={tire.cy - 30} width={60} height={60} fill="transparent" />

      {/* Selection / drop ring */}
      {(isSelected || dropState !== 'default') && (
        <rect
          x={x - 4}
          y={y - 4}
          width={tire.w + 8}
          height={tire.h + 8}
          rx={10}
          fill="none"
          stroke={outline}
          strokeWidth={2}
          opacity={0.7}
        />
      )}

      {/* Tire footprint */}
      <rect
        x={x}
        y={y}
        width={tire.w}
        height={tire.h}
        rx={7}
        fill={visual.fill}
        stroke={outline}
        strokeWidth={outlineWidth}
        strokeDasharray={visual.dashed ? '4 3' : undefined}
        className="transition-colors duration-200"
      />

      {installation ? (
        <>
          {/* Tread block hints */}
          {[0.3, 0.5, 0.7].map((f) => (
            <line
              key={f}
              x1={x + 6}
              y1={y + tire.h * f}
              x2={x + tire.w - 6}
              y2={y + tire.h * f}
              stroke={visual.stroke}
              strokeWidth={1}
              opacity={0.22}
            />
          ))}
          {/* Center reading value */}
          <text
            x={tire.cx}
            y={tire.cy + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fill: visual.stroke }}
            className="text-[11px] font-bold tabular-num pointer-events-none select-none"
          >
            {tread != null ? tread : '—'}
          </text>
          {/* Mini tread gauge */}
          {frac != null && (
            <>
              <rect
                x={x + 5}
                y={y + tire.h - 8}
                width={tire.w - 10}
                height={3}
                rx={1.5}
                fill="hsl(var(--border))"
                opacity={0.6}
              />
              <rect
                x={x + 5}
                y={y + tire.h - 8}
                width={(tire.w - 10) * frac}
                height={3}
                rx={1.5}
                fill={visual.stroke}
                className="transition-all duration-300"
              />
            </>
          )}
          {/* Severity glyph */}
          {(status === 'critical' || status === 'warning' || status === 'no-reading') && (
            <circle
              cx={x + tire.w - 3}
              cy={y + 3}
              r={4}
              fill={visual.stroke}
              stroke="hsl(var(--card))"
              strokeWidth={1}
            />
          )}
        </>
      ) : (
        <text
          x={tire.cx}
          y={tire.cy + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fill: visual.stroke }}
          className="text-[16px] font-light pointer-events-none select-none"
        >
          +
        </text>
      )}

      {/* Position tag under the tire */}
      <text
        x={tire.cx}
        y={y + tire.h + 11}
        textAnchor="middle"
        className="fill-muted-foreground text-[8px] font-medium pointer-events-none select-none"
      >
        {tire.tag}
      </text>

      <title>
        {position.label}
        {installation?.tire
          ? ` — ${installation.tire.brand} ${installation.tire.size} · ${getTireStatusDetail(installation, thresholds)}`
          : ' — Vacío'}
      </title>
    </g>
  )
}

function DiagramLegend() {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {TIRE_STATUS_LEGEND.map((state) => {
        const visual = TIRE_STATUS_VISUALS[state]
        return (
          <div key={state} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3.5 w-3.5 rounded-[4px] border-2"
              style={{
                backgroundColor: visual.fill,
                borderColor: visual.stroke,
                borderStyle: visual.dashed ? 'dashed' : 'solid',
              }}
            />
            <span>{visual.label}</span>
          </div>
        )
      })}
    </div>
  )
}
