'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { AssetTrustField, FleetTreeNode } from '@/types/fleet'
import { toast } from 'sonner'
import { fleetFieldLabel } from '@/lib/fleet/field-labels'
import { TRACKED_TRUST_FIELDS } from '@/lib/fleet/trust-server'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATE_BADGE: Record<AssetTrustField['state'], { label: string; className: string }> = {
  verified: { label: 'Verificado', className: 'bg-emerald-600/15 text-emerald-800 dark:text-emerald-200' },
  stale: { label: 'Desactualizado', className: 'bg-amber-500/15 text-amber-900 dark:text-amber-100' },
  unverified: { label: 'Sin confirmar', className: 'bg-muted text-muted-foreground' },
  conflicted: { label: 'Conflicto', className: 'bg-destructive/15 text-destructive' },
}

export function ConfianzaTab({
  assetId,
  node,
  canEdit,
  onVerified,
}: {
  assetId: string | null
  node: FleetTreeNode
  canEdit: boolean
  onVerified: () => void
}) {
  const [fields, setFields] = useState<AssetTrustField[] | null>(null)
  const [trustPct, setTrustPct] = useState<number | null>(null)

  useEffect(() => {
    if (!assetId) {
      setFields(null)
      setTrustPct(null)
      return
    }
    let c = false
    ;(async () => {
      const res = await fetch(`/api/assets/${assetId}/trust-detail`)
      const j = await res.json()
      if (c) return
      if (!res.ok) {
        setFields([])
        setTrustPct(null)
        return
      }
      setFields(j.fields ?? [])
      setTrustPct(j.trust_pct ?? null)
    })()
    return () => {
      c = true
    }
  }, [assetId])

  async function verifyField(field: string) {
    if (!assetId || !canEdit) return
    if (!TRACKED_TRUST_FIELDS.includes(field as (typeof TRACKED_TRUST_FIELDS)[number])) return
    try {
      const res = await fetch('/api/assets/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'field', asset_id: assetId, field }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Error')
      }
      toast.success('Campo confirmado')
      onVerified()
      const r2 = await fetch(`/api/assets/${assetId}/trust-detail`)
      const j2 = await r2.json()
      if (r2.ok) {
        setFields(j2.fields ?? [])
        setTrustPct(j2.trust_pct ?? null)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
  }

  async function verifyNode() {
    if (!canEdit) return
    try {
      const ids = node.asset_ids ?? []
      if (ids.length === 0) return
      const res = await fetch('/api/assets/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'node', asset_ids: ids }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error || 'Error')
      }
      toast.success('Nodo confirmado')
      onVerified()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
  }

  if (!assetId) {
    return (
      <div className="space-y-3 text-xs text-muted-foreground">
        <p>
          Confianza agregada del nodo: <strong>{node.trust_pct}%</strong>
        </p>
        <Button
          size="sm"
          disabled={!canEdit || (node.asset_ids?.length ?? 0) === 0}
          onClick={verifyNode}
        >
          Confirmar todos los campos rastreados ({node.asset_ids?.length ?? 0} activos)
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3 text-xs">
      <p className="text-muted-foreground">
        Confianza del activo:{' '}
        <strong>{trustPct != null ? `${trustPct}%` : '—'}</strong>
      </p>
      <ul className="space-y-2">
        {TRACKED_TRUST_FIELDS.map((field) => {
          const tf: AssetTrustField =
            fields?.find((x) => x.field === field) ?? {
              field,
              state: 'unverified',
              verified_at: null,
            }
          const badge = STATE_BADGE[tf.state]
          return (
            <li
              key={field}
              className="flex flex-col gap-2 rounded-lg border border-border bg-card p-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{fleetFieldLabel(tf.field)}</span>
                  <Badge variant="secondary" className={cn('text-[10px]', badge.className)}>
                    {badge.label}
                  </Badge>
                </div>
                {tf.verified_at ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Confirmado: {new Date(tf.verified_at).toLocaleString('es-MX')}
                  </p>
                ) : null}
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="shrink-0"
                disabled={!canEdit}
                onClick={() => verifyField(tf.field)}
              >
                Confirmar
              </Button>
            </li>
          )
        })}
      </ul>
      <div className="pt-2">
        <Button
          size="sm"
          disabled={!canEdit || (node.asset_ids?.length ?? 0) === 0}
          onClick={verifyNode}
        >
          Confirmar nodo completo ({node.asset_ids?.length ?? 0} activos)
        </Button>
      </div>
    </div>
  )
}
