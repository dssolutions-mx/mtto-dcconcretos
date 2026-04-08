import type { CollisionDetection, UniqueIdentifier } from '@dnd-kit/core'
import { closestCorners, pointerWithin } from '@dnd-kit/core'

/** Sortable / draggable item ids — never bare UUIDs (avoids collision with plant/profile droppables). */
export const ASSET_DRAG_PREFIX = 'asset-drag:' as const
export const OPERATOR_DRAG_PREFIX = 'operator-drag:' as const
export const ASSET_DROP_PREFIX = 'asset-drop:' as const

/** Droppable ids — must stay distinct from drag ids. */
export const PLANT_DROP_PREFIX = 'plant-' as const
export const BU_DROP_PREFIX = 'business-unit-' as const
export const UNASSIGNED_DROP_ID = 'unassigned' as const

export function assetDragId(assetId: string): string {
  return `${ASSET_DRAG_PREFIX}${assetId}`
}

export function parseAssetDragId(id: UniqueIdentifier | null | undefined): string | null {
  const s = String(id ?? '')
  if (s.startsWith(ASSET_DRAG_PREFIX)) return s.slice(ASSET_DRAG_PREFIX.length)
  return null
}

export function operatorDragId(operatorId: string): string {
  return `${OPERATOR_DRAG_PREFIX}${operatorId}`
}

export function parseOperatorDragId(id: UniqueIdentifier | null | undefined): string | null {
  const s = String(id ?? '')
  if (s.startsWith(OPERATOR_DRAG_PREFIX)) return s.slice(OPERATOR_DRAG_PREFIX.length)
  return null
}

export function assetDropId(assetId: string): string {
  return `${ASSET_DROP_PREFIX}${assetId}`
}

export function parseAssetDropId(id: UniqueIdentifier | null | undefined): string | null {
  const s = String(id ?? '')
  if (s.startsWith(ASSET_DROP_PREFIX)) return s.slice(ASSET_DROP_PREFIX.length)
  return null
}

/** Prefer asset card droppables over nested operator hitboxes when assigning operators to assets. */
export function preferAssetDropCollision(): CollisionDetection {
  return (args) => {
    const pointerHits = pointerWithin(args)
    const drops = pointerHits.filter((c) => String(c.id).startsWith(ASSET_DROP_PREFIX))
    if (drops.length > 0) return drops

    const corners = closestCorners(args)
    const dropCorners = corners.filter((c) => String(c.id).startsWith(ASSET_DROP_PREFIX))
    if (dropCorners.length > 0) return dropCorners

    return corners
  }
}

export function plantDroppableId(plantId: string): string {
  return `${PLANT_DROP_PREFIX}${plantId}`
}

export function parsePlantDroppableId(id: UniqueIdentifier | null | undefined): string | null {
  const s = String(id ?? '')
  if (!s.startsWith(PLANT_DROP_PREFIX)) return null
  return s.slice(PLANT_DROP_PREFIX.length)
}

export function isDroppableContainerId(id: UniqueIdentifier | null | undefined): boolean {
  const s = String(id ?? '')
  return (
    s === UNASSIGNED_DROP_ID ||
    s.startsWith(PLANT_DROP_PREFIX) ||
    s.startsWith(BU_DROP_PREFIX)
  )
}

/**
 * Prefer plant (and other large zone) droppables over nested sortable/draggable children.
 */
export function preferZoneDroppableCollision(): CollisionDetection {
  return (args) => {
    const pointerHits = pointerWithin(args)
    const zonePointer = pointerHits.filter((c) => isDroppableContainerId(c.id))
    if (zonePointer.length > 0) return zonePointer

    const corners = closestCorners(args)
    const zoneCorners = corners.filter((c) => isDroppableContainerId(c.id))
    if (zoneCorners.length > 0) return zoneCorners

    return corners
  }
}

export type PersonnelDropTarget =
  | { type: 'unassigned' }
  | { type: 'businessUnit'; id: string }
  | { type: 'plant'; id: string }

/**
 * Resolve personnel board drop from `over.id`, with optional last container from onDragOver.
 * `validPlantIds` / `validBuIds` prevent treating arbitrary UUIDs as plants.
 */
export function resolvePersonnelDropTarget(
  overId: UniqueIdentifier | null | undefined,
  lastContainerOverId: string | null,
  validPlantIds: Set<string>,
  validBuIds: Set<string>
): PersonnelDropTarget | null {
  const tryIds = [String(overId ?? ''), lastContainerOverId].filter(Boolean)

  for (const raw of tryIds) {
    if (raw === UNASSIGNED_DROP_ID) return { type: 'unassigned' }
    if (raw.startsWith(BU_DROP_PREFIX)) {
      const id = raw.slice(BU_DROP_PREFIX.length)
      if (validBuIds.has(id)) return { type: 'businessUnit', id }
      continue
    }
    const plantId = parsePlantDroppableId(raw)
    if (plantId && validPlantIds.has(plantId)) return { type: 'plant', id: plantId }
  }
  return null
}
