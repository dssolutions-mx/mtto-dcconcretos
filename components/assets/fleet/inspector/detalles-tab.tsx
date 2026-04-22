/* eslint-disable react-hooks/set-state-in-effect -- asset fetch */
'use client'

import { useEffect, useState } from 'react'
import type { FleetTreeNode } from '@/types/fleet'
import { InlineEditableField } from '../inline-editable-field'
import { FleetAssetStatusField } from '../fleet-asset-status-field'
import { Badge } from '@/components/ui/badge'
import { getTrackedReadingFieldsForModelUnit } from '@/lib/utils/maintenance-units'
import { formatMaintenanceUnitLabel } from '@/lib/utils/maintenance-units'

type EquipmentModelJoin = {
  name: string
  manufacturer: string | null
  category: string | null
  year_introduced: number | null
  maintenance_unit: string
} | null

type AssetDetail = {
  id: string
  asset_id: string
  name: string
  status: string | null
  current_hours: number | null
  current_kilometers: number | null
  fabrication_year: number | null
  serial_number: string | null
  notes: string | null
  plant_id: string | null
  model_id: string | null
  equipment_models?: EquipmentModelJoin
  plants?: { name: string } | null
  departments?: { name: string } | null
}

const YEAR_MAX = new Date().getFullYear() + 1

export function DetallesTab({
  assetId,
  node,
  canEdit,
  onSaved,
}: {
  assetId: string | null
  node: FleetTreeNode
  canEdit: boolean
  onSaved: () => void
}) {
  const [asset, setAsset] = useState<AssetDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!assetId) return
    let c = false
    setLoading(true)
    ;(async () => {
      const res = await fetch(`/api/assets/${assetId}`)
      if (!res.ok) {
        if (!c) setLoading(false)
        return
      }
      const j = await res.json()
      if (c) return
      setAsset(j as AssetDetail)
      setLoading(false)
    })()
    return () => {
      c = true
    }
  }, [assetId])

  if (!assetId) {
    return (
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          Nodo <strong>{node.label}</strong>: {node.count} activos · confianza {node.trust_pct}%
        </p>
        <p>Seleccione un activo en el árbol para editar campos.</p>
      </div>
    )
  }

  if (loading || !asset) {
    return <p className="text-xs text-muted-foreground">Cargando…</p>
  }

  const rawMu = asset.equipment_models?.maintenance_unit ?? 'hours'
  const readingFields = getTrackedReadingFieldsForModelUnit(rawMu)
  const modelYear = asset.equipment_models?.year_introduced ?? null
  const fab = asset.fabrication_year
  const yearMismatch =
    modelYear != null && fab != null && Math.abs(modelYear - fab) > 1

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
        <div className="text-muted-foreground">Modelo (catálogo)</div>
        <div className="font-medium">
          {asset.equipment_models?.name ?? '—'}
          {asset.equipment_models?.category ? (
            <span className="ml-1 text-muted-foreground">
              · {asset.equipment_models.category}
            </span>
          ) : null}
        </div>
        {modelYear != null && (
          <p className="mt-1 text-muted-foreground">
            Año de referencia del modelo: <span className="font-mono">{modelYear}</span>
          </p>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">
          Unidad de mantenimiento:{' '}
          <span className="font-medium text-foreground">
            {formatMaintenanceUnitLabel(rawMu)}
          </span>
        </p>
      </div>

      <div className="text-xs">
        <div className="text-muted-foreground">Planta</div>
        <div>{asset.plants?.name ?? '—'}</div>
      </div>

      {asset.departments?.name ? (
        <div className="text-xs">
          <div className="text-muted-foreground">Departamento</div>
          <div>{asset.departments.name}</div>
        </div>
      ) : null}

      {readingFields.length === 0 ? (
        <p className="rounded-md border border-dashed p-2 text-[11px] text-muted-foreground">
          Sin medidor según el modelo — no hay horómetro ni odómetro que editar aquí.
        </p>
      ) : null}

      {readingFields.includes('current_hours') ? (
        <InlineEditableField
          label="Horómetro"
          value={String(asset.current_hours ?? '')}
          field="current_hours"
          assetId={asset.id}
          canEdit={canEdit}
          onSaved={onSaved}
          type="number"
          suffix="h"
          displayFormat="integer-thousands"
        />
      ) : null}

      {readingFields.includes('current_kilometers') ? (
        <InlineEditableField
          label="Odómetro"
          value={String(asset.current_kilometers ?? '')}
          field="current_kilometers"
          assetId={asset.id}
          canEdit={canEdit}
          onSaved={onSaved}
          type="number"
          suffix="km"
          displayFormat="integer-thousands"
        />
      ) : null}

      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Año de fabricación (activo)</span>
          {yearMismatch ? (
            <Badge variant="secondary" className="text-[10px]">
              Difiere del modelo
            </Badge>
          ) : null}
        </div>
        <InlineEditableField
          label="Año de fabricación"
          value={asset.fabrication_year != null ? String(asset.fabrication_year) : ''}
          field="fabrication_year"
          assetId={asset.id}
          canEdit={canEdit}
          onSaved={onSaved}
          type="number"
          min={1950}
          max={YEAR_MAX}
        />
      </div>

      <InlineEditableField
        label="Serie"
        value={asset.serial_number ?? ''}
        field="serial_number"
        assetId={asset.id}
        canEdit={canEdit}
        onSaved={onSaved}
      />

      <FleetAssetStatusField
        value={asset.status ?? 'operational'}
        assetId={asset.id}
        canEdit={canEdit}
        onSaved={onSaved}
      />

      <InlineEditableField
        label="Notas"
        value={asset.notes ?? ''}
        field="notes"
        assetId={asset.id}
        canEdit={canEdit}
        onSaved={onSaved}
        type="textarea"
      />
    </div>
  )
}
