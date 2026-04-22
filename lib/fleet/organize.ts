import type { FleetOrganizeLens, FleetTreeNode } from '@/types/fleet'

/** Joined asset shape from fleet-tree query (minimal). */
export type FleetAssetRow = {
  id: string
  asset_id: string
  name: string
  status: string | null
  current_hours: number | null
  current_kilometers: number | null
  serial_number: string | null
  insurance_end_date?: string | null
  plant_id: string | null
  model_id: string | null
  department_id: string | null
  installation_date: string | null
  plants: {
    id: string
    name: string
    code: string | null
    business_unit_id: string | null
    business_units: { id: string; name: string; code: string | null } | null
  } | null
  equipment_models: {
    id: string
    name: string
    manufacturer: string | null
    category: string | null
    year_introduced: number | null
  } | null
}

function sortLabel(a: string, b: string) {
  return a.localeCompare(b, 'es', { sensitivity: 'base' })
}

function avgTrust(ids: string[], trustByAssetId: Record<string, number>) {
  if (ids.length === 0) return 100
  return Math.round(
    ids.reduce((s, id) => s + (trustByAssetId[id] ?? 0), 0) / ids.length
  )
}

/** Main entry: flat DFS-ordered nodes for virtualization. */
export function buildFleetNodes(
  assets: FleetAssetRow[],
  lens: FleetOrganizeLens,
  trustByAssetId: Record<string, number>
): FleetTreeNode[] {
  if (lens === 'bu-plant-model' || lens === 'bu-plant-categoria') {
    return buildBuPlantTrees(assets, lens, trustByAssetId)
  }
  return buildMultiLevelTree(assets, lens, trustByAssetId)
}

function buildBuPlantTrees(
  assets: FleetAssetRow[],
  lens: FleetOrganizeLens,
  trustByAssetId: Record<string, number>
): FleetTreeNode[] {
  const nodes: FleetTreeNode[] = []
  const rootId = 'root'

  const push = (partial: Omit<FleetTreeNode, 'trust_pct'> & { trust_pct?: number }) => {
    const ids = partial.asset_ids ?? []
    nodes.push({
      ...partial,
      trust_pct: partial.trust_pct ?? avgTrust(ids, trustByAssetId),
    })
  }

  push({
    id: rootId,
    parent_id: null,
    depth: 0,
    kind: 'root',
    label: 'Empresa',
    count: assets.length,
    asset_ids: assets.map((a) => a.id),
    trust_pct: avgTrust(
      assets.map((a) => a.id),
      trustByAssetId
    ),
  })

  const buOrder = [...new Set(assets.map((a) => a.plants?.business_units?.id ?? 'sin-bu'))].sort(
    (x, y) => {
      const nx =
        assets.find((a) => (a.plants?.business_units?.id ?? 'sin-bu') === x)?.plants
          ?.business_units?.name ?? ''
      const ny =
        assets.find((a) => (a.plants?.business_units?.id ?? 'sin-bu') === y)?.plants
          ?.business_units?.name ?? ''
      return sortLabel(nx, ny)
    }
  )

  for (const buId of buOrder) {
    const buKey = `bu:${buId}`
    const buAssets = assets.filter(
      (a) => (a.plants?.business_units?.id ?? 'sin-bu') === buId
    )
    const buLabel =
      buAssets[0]?.plants?.business_units?.name ?? 'Sin unidad de negocio'

    push({
      id: buKey,
      parent_id: rootId,
      depth: 1,
      kind: 'bu',
      label: buLabel,
      count: buAssets.length,
      asset_ids: buAssets.map((a) => a.id),
    })

    const plantOrder = [
      ...new Set(buAssets.map((a) => a.plants?.id ?? 'sin-planta')),
    ].sort((x, y) => {
      const nx = buAssets.find((a) => (a.plants?.id ?? 'sin-planta') === x)?.plants?.name ?? ''
      const ny = buAssets.find((a) => (a.plants?.id ?? 'sin-planta') === y)?.plants?.name ?? ''
      return sortLabel(nx, ny)
    })

    for (const pId of plantOrder) {
      const pAssets = buAssets.filter((a) => (a.plants?.id ?? 'sin-planta') === pId)
      const pKey = `${buKey}|plant:${pId}`
      const pLabel = pAssets[0]?.plants?.name ?? 'Sin planta'

      push({
        id: pKey,
        parent_id: buKey,
        depth: 2,
        kind: 'plant',
        label: pLabel,
        count: pAssets.length,
        asset_ids: pAssets.map((a) => a.id),
      })

      if (lens === 'bu-plant-model') {
        const modelOrder = [...new Set(pAssets.map((a) => a.equipment_models?.id ?? 'sin-modelo'))].sort(
          (x, y) => {
            const nx =
              pAssets.find((a) => (a.equipment_models?.id ?? 'sin-modelo') === x)?.equipment_models
                ?.name ?? ''
            const ny =
              pAssets.find((a) => (a.equipment_models?.id ?? 'sin-modelo') === y)?.equipment_models
                ?.name ?? ''
            return sortLabel(nx, ny)
          }
        )
        for (const mId of modelOrder) {
          const mAssets = pAssets.filter(
            (a) => (a.equipment_models?.id ?? 'sin-modelo') === mId
          )
          const mKey = `${pKey}|model:${mId}`
          const mLabel = mAssets[0]?.equipment_models?.name ?? 'Sin modelo'
          push({
            id: mKey,
            parent_id: pKey,
            depth: 3,
            kind: 'model',
            label: mLabel,
            count: mAssets.length,
            asset_ids: mAssets.map((a) => a.id),
          })
          addAssetLeaves(nodes, push, mAssets, mKey, 4, trustByAssetId)
        }
      } else {
        // bu-plant-categoria
        const catOrder = [
          ...new Set(pAssets.map((a) => a.equipment_models?.category ?? 'sin-categoria')),
        ].sort((x, y) => sortLabel(x === 'sin-categoria' ? 'Sin categoría' : x, y === 'sin-categoria' ? 'Sin categoría' : y))

        for (const cat of catOrder) {
          const cAssets = pAssets.filter(
            (a) => (a.equipment_models?.category ?? 'sin-categoria') === cat
          )
          const cKey = `${pKey}|cat:${encodeURIComponent(cat)}`
          push({
            id: cKey,
            parent_id: pKey,
            depth: 3,
            kind: 'category',
            label: cat === 'sin-categoria' ? 'Sin categoría' : cat,
            count: cAssets.length,
            asset_ids: cAssets.map((a) => a.id),
          })

          const modelOrder = [
            ...new Set(cAssets.map((a) => a.equipment_models?.id ?? 'sin-modelo')),
          ].sort((x, y) => {
            const nx =
              cAssets.find((a) => (a.equipment_models?.id ?? 'sin-modelo') === x)
                ?.equipment_models?.name ?? ''
            const ny =
              cAssets.find((a) => (a.equipment_models?.id ?? 'sin-modelo') === y)
                ?.equipment_models?.name ?? ''
            return sortLabel(nx, ny)
          })

          for (const mId of modelOrder) {
            const mAssets = cAssets.filter(
              (a) => (a.equipment_models?.id ?? 'sin-modelo') === mId
            )
            const mKey = `${cKey}|model:${mId}`
            const mLabel = mAssets[0]?.equipment_models?.name ?? 'Sin modelo'
            push({
              id: mKey,
              parent_id: cKey,
              depth: 4,
              kind: 'model',
              label: mLabel,
              count: mAssets.length,
              asset_ids: mAssets.map((a) => a.id),
            })
            addAssetLeaves(nodes, push, mAssets, mKey, 5, trustByAssetId)
          }
        }
      }
    }
  }

  return nodes
}

function addAssetLeaves(
  nodes: FleetTreeNode[],
  push: (p: Omit<FleetTreeNode, 'trust_pct'> & { trust_pct?: number }) => void,
  leafAssets: FleetAssetRow[],
  parentId: string,
  depth: number,
  trustByAssetId: Record<string, number>
) {
  const sorted = [...leafAssets].sort((a, b) => sortLabel(a.asset_id, b.asset_id))
  for (const a of sorted) {
    push({
      id: `asset:${a.id}`,
      parent_id: parentId,
      depth,
      kind: 'asset',
      label: a.asset_id,
      count: 1,
      asset_ids: [a.id],
      payload: { assetId: a.id },
      trust_pct: trustByAssetId[a.id] ?? 0,
    })
  }
}

type Level = {
  kind: FleetTreeNode['kind']
  label: (a: FleetAssetRow) => string
  key: (a: FleetAssetRow) => string
}

function buildMultiLevelTree(
  assets: FleetAssetRow[],
  lens: FleetOrganizeLens,
  trustByAssetId: Record<string, number>
): FleetTreeNode[] {
  let levels: Level[] | null = null

  switch (lens) {
    case 'fabricante-modelo-planta':
      levels = [
        {
          kind: 'manufacturer',
          label: (a) =>
            (a.equipment_models?.manufacturer ?? '').trim() || 'Sin fabricante',
          key: (a) =>
            `mfr:${(a.equipment_models?.manufacturer ?? 'sin-fabricante').trim()}`,
        },
        {
          kind: 'model',
          label: (a) => a.equipment_models?.name ?? 'Sin modelo',
          key: (a) => `mfr:${(a.equipment_models?.manufacturer ?? '').trim()}|m:${a.equipment_models?.id ?? 'sin'}`,
        },
        {
          kind: 'plant',
          label: (a) => a.plants?.name ?? 'Sin planta',
          key: (a) =>
            `mfr:${(a.equipment_models?.manufacturer ?? '').trim()}|m:${a.equipment_models?.id ?? 'sin'}|p:${a.plants?.id ?? 'sin'}`,
        },
      ]
      break
    case 'ano-modelo-planta': {
      const y = (a: FleetAssetRow) =>
        a.equipment_models?.year_introduced != null
          ? String(a.equipment_models.year_introduced)
          : 'sin-ano'
      levels = [
        {
          kind: 'year',
          label: (a) => (y(a) === 'sin-ano' ? 'Sin año' : y(a)),
          key: (a) => `y:${y(a)}`,
        },
        {
          kind: 'model',
          label: (a) => a.equipment_models?.name ?? 'Sin modelo',
          key: (a) => `y:${y(a)}|m:${a.equipment_models?.id ?? 'sin'}`,
        },
        {
          kind: 'plant',
          label: (a) => a.plants?.name ?? 'Sin planta',
          key: (a) => `y:${y(a)}|m:${a.equipment_models?.id ?? 'sin'}|p:${a.plants?.id ?? 'sin'}`,
        },
      ]
      break
    }
    case 'categoria-modelo-planta':
      levels = [
        {
          kind: 'category',
          label: (a) => a.equipment_models?.category ?? 'Sin categoría',
          key: (a) => `cat:${a.equipment_models?.category ?? 'sin-categoria'}`,
        },
        {
          kind: 'model',
          label: (a) => a.equipment_models?.name ?? 'Sin modelo',
          key: (a) =>
            `cat:${a.equipment_models?.category ?? 'sin'}|m:${a.equipment_models?.id ?? 'sin'}`,
        },
        {
          kind: 'plant',
          label: (a) => a.plants?.name ?? 'Sin planta',
          key: (a) =>
            `cat:${a.equipment_models?.category ?? 'sin'}|m:${a.equipment_models?.id ?? 'sin'}|p:${a.plants?.id ?? 'sin'}`,
        },
      ]
      break
    case 'estado-planta-modelo':
      levels = [
        {
          kind: 'status',
          label: (a) => a.status ?? 'Sin estado',
          key: (a) => `st:${a.status ?? 'sin-estado'}`,
        },
        {
          kind: 'plant',
          label: (a) => a.plants?.name ?? 'Sin planta',
          key: (a) => `st:${a.status ?? 'sin'}|p:${a.plants?.id ?? 'sin'}`,
        },
        {
          kind: 'model',
          label: (a) => a.equipment_models?.name ?? 'Sin modelo',
          key: (a) =>
            `st:${a.status ?? 'sin'}|p:${a.plants?.id ?? 'sin'}|m:${a.equipment_models?.id ?? 'sin'}`,
        },
      ]
      break
    default:
      return buildBuPlantTrees(assets, 'bu-plant-model', trustByAssetId)
  }

  if (!levels) return []
  const nodes: FleetTreeNode[] = []
  const rootId = 'root'

  const push = (partial: Omit<FleetTreeNode, 'trust_pct'> & { trust_pct?: number }) => {
    const ids = partial.asset_ids ?? []
    nodes.push({
      ...partial,
      trust_pct: partial.trust_pct ?? avgTrust(ids, trustByAssetId),
    })
  }

  push({
    id: rootId,
    parent_id: null,
    depth: 0,
    kind: 'root',
    label: 'Empresa',
    count: assets.length,
    asset_ids: assets.map((a) => a.id),
    trust_pct: avgTrust(
      assets.map((a) => a.id),
      trustByAssetId
    ),
  })

  function walk(
    parentId: string,
    parentDepth: number,
    levelIdx: number,
    candidates: FleetAssetRow[]
  ) {
    if (levelIdx >= levels!.length || candidates.length === 0) return
    const level = levels![levelIdx]!
    const buckets = new Map<string, FleetAssetRow[]>()
    for (const a of candidates) {
      const k = level.key(a)
      if (!buckets.has(k)) buckets.set(k, [])
      buckets.get(k)!.push(a)
    }
    const keys = [...buckets.keys()].sort((x, y) =>
      sortLabel(level.label(buckets.get(x)![0]!), level.label(buckets.get(y)![0]!))
    )

    for (const key of keys) {
      const group = buckets.get(key)!
      const sample = group[0]!
      const nodeId = `${parentId}/${levelIdx}:${encodeURIComponent(key)}`
      push({
        id: nodeId,
        parent_id: parentId,
        depth: parentDepth,
        kind: level.kind,
        label: level.label(sample),
        count: group.length,
        asset_ids: group.map((g) => g.id),
      })

      if (levelIdx === levels!.length - 1) {
        addAssetLeaves(nodes, push, group, nodeId, parentDepth + 1, trustByAssetId)
      } else {
        walk(nodeId, parentDepth + 1, levelIdx + 1, group)
      }
    }
  }

  walk(rootId, 1, 0, assets)
  return nodes
}
