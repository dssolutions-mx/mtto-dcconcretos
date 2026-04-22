'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useFleetTree } from '@/hooks/useFleetTree'
import { useTreeState } from '@/hooks/useTreeState'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useTrust } from '@/hooks/useTrust'
import type { FleetOrganizeLens, FleetTreeNode } from '@/types/fleet'
import { FleetTree } from '@/components/assets/fleet/tree/fleet-tree'
import { FleetInspector } from '@/components/assets/fleet/inspector/inspector'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { Menu } from 'lucide-react'
import { FleetCommandPalette } from '@/components/assets/fleet/command-palette'
import { ShortcutsOverlay } from '@/components/assets/fleet/shortcuts-overlay'
import { BulkEditBar } from '@/components/assets/fleet/bulk-edit-bar'
import { BreadcrumbFocus } from '@/components/assets/fleet/toolbar/breadcrumb-focus'
import { SavedViewsMenu } from '@/components/assets/fleet/toolbar/saved-views-menu'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import { canFleetEdit } from '@/lib/fleet/fleet-api-auth'
import { useFleetQuickview } from '@/hooks/useFleetQuickview'

const LENSES: { id: FleetOrganizeLens; label: string }[] = [
  { id: 'bu-plant-model', label: 'Unidad → Planta → Modelo' },
  { id: 'bu-plant-categoria', label: 'Unidad → Planta → Categoría → Modelo' },
  { id: 'fabricante-modelo-planta', label: 'Fabricante → Modelo → Planta' },
  { id: 'ano-modelo-planta', label: 'Año → Modelo → Planta' },
  { id: 'categoria-modelo-planta', label: 'Categoría → Modelo → Planta' },
  { id: 'estado-planta-modelo', label: 'Estado → Planta → Modelo' },
]

export function FleetPageClient() {
  const [lens, setLens] = useState<FleetOrganizeLens>('bu-plant-model')
  const { nodes, loading, error, refresh } = useFleetTree(lens)
  const { globalTrustPct, refresh: refreshTrust } = useTrust()
  const { profile } = useAuthZustand()
  const actor = profile
    ? {
        id: profile.id,
        role: profile.role,
        plant_id: profile.plant_id ?? null,
        business_unit_id: profile.business_unit_id ?? null,
      }
    : null
  const canEdit = actor != null && canFleetEdit(actor)

  const { visibleNodes, expanded, toggle, expandAll, collapseAll } = useTreeState(
    nodes,
    lens
  )

  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<FleetTreeNode | null>(null)
  const [multi, setMulti] = useState<Set<string>>(new Set())
  const [density, setDensity] = useState<'compact' | 'normal' | 'roomy'>('normal')
  const [focusRoot, setFocusRoot] = useState<FleetTreeNode | null>(null)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const isMobile = useIsMobile()

  const onSelectNode = useCallback((n: FleetTreeNode) => {
    setSelected(n)
  }, [])

  const selectedAssetId =
    selected?.kind === 'asset' ? (selected.payload?.assetId as string | null) : null

  const inspectorNode = focusRoot ?? selected
  const inspectorAssetId =
    inspectorNode?.kind === 'asset'
      ? (inspectorNode.payload?.assetId as string | null)
      : null
  const quickview = useFleetQuickview(inspectorAssetId)
  const { refresh: refreshQuickview, data: quickviewData } = quickview

  const rowOperationalSignal =
    inspectorAssetId && quickviewData
      ? {
          assetId: inspectorAssetId,
          alert:
            quickviewData.schedules.overdue > 0 ||
            quickviewData.incidents.open_count > 0,
          warn: quickviewData.preventive.status === 'upcoming',
        }
      : null

  const onRefresh = useCallback(() => {
    refresh()
    refreshTrust()
    refreshQuickview()
  }, [refresh, refreshTrust, refreshQuickview])

  useKeyboardShortcuts({
    onCommandPalette: () => setCmdOpen(true),
    onHelp: () => setHelpOpen((v) => !v),
    onFocusFilter: () => {
      const el = document.getElementById('fleet-quick-filter')
      el?.focus()
    },
    onFocusMode: () => {
      if (selected) setFocusRoot(selected)
    },
    onToggleExpandAll: () => {
      expandAll()
    },
  })

  const displayNodes = useMemo(() => {
    if (!focusRoot || focusRoot.kind === 'root') return visibleNodes
    const ids = new Set<string>()
    function walk(id: string) {
      ids.add(id)
      for (const n of nodes) {
        if (n.parent_id === id) walk(n.id)
      }
    }
    walk(focusRoot.id)
    return visibleNodes.filter((n) => ids.has(n.id))
  }, [visibleNodes, nodes, focusRoot])

  const toggleMulti = useCallback((assetId: string, checked: boolean) => {
    setMulti((prev) => {
      const next = new Set(prev)
      if (checked) next.add(assetId)
      else next.delete(assetId)
      return next
    })
  }, [])

  if (error) {
    return (
      <div className="p-6 text-destructive">
        Error: {error}
        <Button className="ml-2" variant="outline" onClick={() => refresh()}>
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/activos">← Lista de activos</Link>
        </Button>
        <SavedViewsMenu
          currentLens={lens}
          onApplyConfig={(c) => {
            if (c.lens) setLens(c.lens)
            if (c.density) setDensity(c.density)
          }}
        />
        <Select value={lens} onValueChange={(v) => setLens(v as FleetOrganizeLens)}>
          <SelectTrigger className="w-[280px] max-w-full">
            <SelectValue placeholder="Organizar por" />
          </SelectTrigger>
          <SelectContent>
            {LENSES.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ToggleGroup
          type="single"
          value={density}
          onValueChange={(v) => v && setDensity(v as typeof density)}
          size="sm"
        >
          <ToggleGroupItem value="compact">Compacto</ToggleGroupItem>
          <ToggleGroupItem value="normal">Normal</ToggleGroupItem>
          <ToggleGroupItem value="roomy">Amplio</ToggleGroupItem>
        </ToggleGroup>
        <Input
          id="fleet-quick-filter"
          placeholder="Filtrar ( / )"
          className="max-w-xs"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <Button size="sm" variant="secondary" onClick={expandAll}>
          Expandir
        </Button>
        <Button size="sm" variant="secondary" onClick={collapseAll}>
          Colapsar
        </Button>
        <BreadcrumbFocus focus={focusRoot} onClear={() => setFocusRoot(null)} />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando árbol de flota…</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 md:flex-row">
          <div className="min-h-0 min-w-0 flex-1">
            <FleetTree
              allNodes={nodes}
              visibleNodes={displayNodes}
              expanded={expanded}
              toggle={toggle}
              density={density}
              filter={filter}
              selectedAssetId={selectedAssetId}
              onSelectNode={onSelectNode}
              multiSelected={multi}
              onToggleMulti={toggleMulti}
              rowOperationalSignal={rowOperationalSignal}
            />
          </div>

          {isMobile ? (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="md:hidden">
                  <Menu className="mr-2 h-4 w-4" />
                  Inspector
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[70vh]">
                <FleetInspector
                  selectedNode={focusRoot ?? selected}
                  globalTrustPct={globalTrustPct}
                  onRefresh={onRefresh}
                  quickview={quickview}
                />
              </SheetContent>
            </Sheet>
          ) : (
            <div className="hidden w-full max-w-md shrink-0 md:block">
              <FleetInspector
                selectedNode={focusRoot ?? selected}
                globalTrustPct={globalTrustPct}
                onRefresh={onRefresh}
                quickview={quickview}
              />
            </div>
          )}
        </div>
      )}

      <BulkEditBar
        selectedIds={[...multi]}
        onCleared={() => setMulti(new Set())}
        onDone={onRefresh}
        canEdit={canEdit}
      />

      <FleetCommandPalette
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        nodes={nodes}
        onSelectNode={(n) => {
          setSelected(n)
          setCmdOpen(false)
        }}
      />
      <ShortcutsOverlay open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  )
}
