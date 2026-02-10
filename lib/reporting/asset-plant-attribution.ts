type AssetAssignmentHistoryRow = {
  asset_id: string
  previous_plant_id: string | null
  new_plant_id: string | null
  created_at: string
}

type AssignmentRecord = {
  previousPlantId: string | null
  newPlantId: string | null
  createdAtMs: number
}

export function buildAssignmentHistoryMap(rows: AssetAssignmentHistoryRow[]) {
  const historyByAsset = new Map<string, AssignmentRecord[]>()

  for (const row of rows) {
    if (!historyByAsset.has(row.asset_id)) {
      historyByAsset.set(row.asset_id, [])
    }

    historyByAsset.get(row.asset_id)!.push({
      previousPlantId: row.previous_plant_id,
      newPlantId: row.new_plant_id,
      createdAtMs: new Date(row.created_at).getTime(),
    })
  }

  for (const [assetId, records] of historyByAsset) {
    records.sort((a, b) => a.createdAtMs - b.createdAtMs)
    historyByAsset.set(assetId, records)
  }

  return historyByAsset
}

export function resolveAssetPlantAtTimestamp(params: {
  assetId: string
  eventDate: string | Date | null | undefined
  currentPlantId: string | null | undefined
  historyByAsset: Map<string, AssignmentRecord[]>
}) {
  const { assetId, eventDate, currentPlantId, historyByAsset } = params
  const records = historyByAsset.get(assetId) || []

  if (!eventDate || records.length === 0) {
    return currentPlantId || null
  }

  const eventMs = new Date(eventDate).getTime()
  if (Number.isNaN(eventMs)) {
    return currentPlantId || null
  }

  let latestBeforeOrAt: AssignmentRecord | null = null
  for (const record of records) {
    if (record.createdAtMs <= eventMs) {
      latestBeforeOrAt = record
    } else {
      break
    }
  }

  if (latestBeforeOrAt) {
    return latestBeforeOrAt.newPlantId || currentPlantId || null
  }

  // Event happened before first recorded move: use previous_plant_id from first row when available.
  const firstRecord = records[0]
  return firstRecord.previousPlantId || currentPlantId || null
}
