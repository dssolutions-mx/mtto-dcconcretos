/**
 * Diesel Import Parser Utilities
 * Implements per-plant batch processing with movement classification,
 * meter tracking, and inventory reconciliation
 */

import { 
  DieselExcelRow, 
  PlantBatch, 
  MovementCategory, 
  MeterReading 
} from '@/types/diesel'

// Parse DD/MM/YY to Date (Latin American format)
export function parseSmartsheetDate(dateStr: string): Date | null {
  if (!dateStr || !dateStr.trim()) return null
  try {
    // Handle DD/MM/YY format (e.g., 08/02/25 = February 8, 2025)
    const parts = dateStr.trim().split('/')
    if (parts.length !== 3) return null
    
    const day = parseInt(parts[0], 10)      // First part is DAY
    const month = parseInt(parts[1], 10)    // Second part is MONTH
    let year = parseInt(parts[2], 10)
    
    // Convert 2-digit year to 4-digit
    if (year < 100) {
      year += year < 50 ? 2000 : 1900
    }
    
    const date = new Date(year, month - 1, day)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

// Classify movement type based on data patterns
export function classifyMovement(row: Partial<DieselExcelRow>): {
  category: MovementCategory
  is_adjustment: boolean
  adjustment_reason: string | null
} {
  const hasUnit = Boolean(row.unidad?.trim())
  const hasLitros = Boolean(row.litros_cantidad && row.litros_cantidad > 0)
  const hasInventarioInicial = Boolean(row.inventario_inicial && row.inventario_inicial > 0)
  const largeQuantity = (row.litros_cantidad || 0) > 1000
  const roundNumber = (row.litros_cantidad || 0) % 100 === 0
  const hasValidationDiscrepancy = Math.abs(
    (row.litros_cantidad || 0) - (parseFloat(row.validacion || '0') || 0)
  ) > 5
  
  // Inventory opening
  if (row.tipo === 'Entrada' && !hasUnit && !hasLitros && hasInventarioInicial) {
    return {
      category: 'inventory_opening',
      is_adjustment: true,
      adjustment_reason: 'opening_balance'
    }
  }
  
  // Fuel receipt (large entrada without unit)
  if (row.tipo === 'Entrada' && !hasUnit && hasLitros && largeQuantity) {
    return {
      category: 'fuel_receipt',
      is_adjustment: false,
      adjustment_reason: null
    }
  }
  
  // Small entrada without unit - likely adjustment
  if (row.tipo === 'Entrada' && !hasUnit && hasLitros) {
    return {
      category: 'inventory_adjustment',
      is_adjustment: true,
      adjustment_reason: 'manual_correction'
    }
  }
  
  // Asset consumption (normal case)
  if (row.tipo === 'Salida' && hasUnit && hasLitros) {
    // Check for adjustment indicators
    if (hasValidationDiscrepancy || roundNumber) {
      return {
        category: 'asset_consumption',
        is_adjustment: false,
        adjustment_reason: hasValidationDiscrepancy ? 'validation_correction' : null
      }
    }
    return {
      category: 'asset_consumption',
      is_adjustment: false,
      adjustment_reason: null
    }
  }
  
  // Salida without unit - needs mapping to assign to an asset
  if (row.tipo === 'Salida' && !hasUnit && hasLitros) {
    return {
      category: 'unassigned_consumption',
      is_adjustment: false,
      adjustment_reason: 'requires_asset_assignment'
    }
  }
  
  // Default fallback
  return {
    category: 'inventory_adjustment',
    is_adjustment: true,
    adjustment_reason: 'unknown_pattern'
  }
}

// Build enhanced row with all computed fields
export function buildEnhancedRow(
  raw: Record<string, any>, 
  indexZeroBased: number,
  batchId: string
): DieselExcelRow {
  const litros = typeof raw.litros_cantidad === 'number' 
    ? raw.litros_cantidad 
    : Number(raw.litros_cantidad) || 0
  
  const validacion = parseFloat(String(raw.validacion || '0')) || 0
  const validationDiscrepancy = Math.abs(litros - validacion)
  
  const parsedDate = parseSmartsheetDate(raw.fecha_)
  const sortKey = parsedDate 
    ? `${parsedDate.toISOString()}-${raw.horario || '00:00'}-${indexZeroBased}`
    : `9999-${indexZeroBased}`
  
  const classification = classifyMovement(raw)
  
  const hasUnit = Boolean(raw.unidad?.trim())
  const hasHorometer = raw.horometro != null && !isNaN(Number(raw.horometro))
  const hasKilometer = raw.kilometraje != null && !isNaN(Number(raw.kilometraje))
  const hasMeterReadings = hasHorometer || hasKilometer
  
  // Build meter reading if present
  let meterReading: MeterReading | null = null
  if (hasUnit && hasMeterReadings && parsedDate) {
    meterReading = {
      asset_code: String(raw.unidad).trim(),
      reading_date: parsedDate,
      reading_time: raw.horario || null,
      horometer: hasHorometer ? Number(raw.horometro) : null,
      kilometer: hasKilometer ? Number(raw.kilometraje) : null,
      fuel_consumed: litros,
      operator: raw.responsable_unidad ? String(raw.responsable_unidad).trim() : null,
      
      // Deltas computed later during batch processing
      horometer_delta: null,
      kilometer_delta: null,
      days_since_last: null,
      daily_hours_avg: null,
      daily_km_avg: null,
      fuel_efficiency_per_hour: null,
      fuel_efficiency_per_km: null,
      
      has_warnings: false,
      has_errors: false,
      validation_messages: [],
      
      original_row_number: indexZeroBased + 1,
      source_batch_id: batchId
    }
  }
  
  return {
    // Raw fields
    creado: String(raw.creado ?? ''),
    planta: String(raw.planta ?? ''),
    clave_producto: String(raw.clave_producto ?? ''),
    almacen: String(raw.almacen ?? ''),
    tipo: raw.tipo === 'Entrada' ? 'Entrada' : 'Salida',
    unidad: String(raw.unidad ?? '').trim(),
    identificador: String(raw.identificador ?? ''),
    fecha_: String(raw.fecha_ ?? ''),
    horario: String(raw.horario ?? ''),
    horometro: hasHorometer ? Number(raw.horometro) : null,
    kilometraje: hasKilometer ? Number(raw.kilometraje) : null,
    litros_cantidad: litros,
    cuenta_litros: raw.cuenta_litros != null ? Number(raw.cuenta_litros) : null,
    responsable_unidad: String(raw.responsable_unidad ?? ''),
    responsable_suministro: String(raw.responsable_suministro ?? ''),
    validacion: String(raw.validacion ?? ''),
    inventario_inicial: raw.inventario_inicial != null ? Number(raw.inventario_inicial) : null,
    inventario: raw.inventario != null ? Number(raw.inventario) : null,
    
    // Metadata
    original_row_index: indexZeroBased + 1,
    
    // Parsing
    parsed_date: parsedDate,
    sort_key: sortKey,
    movement_category: classification.category,
    
    // Adjustment detection
    is_likely_adjustment: classification.is_adjustment,
    adjustment_reason: classification.adjustment_reason,
    
    // Validation
    has_validation_discrepancy: validationDiscrepancy > 1,
    validation_discrepancy_liters: validationDiscrepancy,
    
    // Asset resolution (filled later)
    asset_id: null,
    exception_asset_name: null,
    asset_category: null,
    resolved_asset_name: null,
    resolved_asset_type: hasUnit ? 'unmapped' : null,
    resolved_asset_id: null,
    requires_asset_mapping: (hasUnit && classification.category === 'asset_consumption') || 
                            classification.category === 'unassigned_consumption',
    
    // Meter tracking
    has_meter_readings: hasMeterReadings,
    meter_reading: meterReading,
    
    // Processing state
    validation_status: 'valid',
    validation_messages: [],
    processing_status: 'pending',
    processing_notes: null
  }
}

// Group rows into plant batches
export function groupIntoPlantBatches(
  rows: DieselExcelRow[],
  filename: string
): PlantBatch[] {
  // Group by plant + warehouse
  const groups = new Map<string, DieselExcelRow[]>()
  
  rows.forEach(row => {
    const key = `${row.planta}|${row.almacen}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(row)
  })
  
  // Build batches
  const batches: PlantBatch[] = []
  
  for (const [key, plantRows] of groups) {
    const [plantCode, warehouseNum] = key.split('|')
    
    // Sort rows chronologically
    const sorted = [...plantRows].sort((a, b) => a.sort_key.localeCompare(b.sort_key))
    
    const batch = computePlantBatchStats(sorted, plantCode, warehouseNum, filename)
    batches.push(batch)
  }
  
  return batches
}

// Compute statistics for a plant batch
function computePlantBatchStats(
  rows: DieselExcelRow[],
  plantCode: string,
  warehouseNum: string,
  filename: string
): PlantBatch {
  const batchId = `${plantCode}-${warehouseNum}-${Date.now()}`
  
  // Find inventory opening
  const openingRow = rows.find(r => r.movement_category === 'inventory_opening')
  const initialInventory = openingRow?.inventario_inicial || 0
  
  // Compute running inventory
  let computed = initialInventory
  const litrosIn = rows
    .filter(r => r.tipo === 'Entrada' && r.litros_cantidad > 0)
    .reduce((sum, r) => sum + r.litros_cantidad, 0)
  const litrosOut = rows
    .filter(r => r.tipo === 'Salida')
    .reduce((sum, r) => sum + r.litros_cantidad, 0)
  
  computed = initialInventory + litrosIn - litrosOut
  
  const finalProvided = rows[rows.length - 1]?.inventario || 0
  const discrepancy = Math.abs(computed - finalProvided)
  
  // Count movements
  const counts = {
    fuel_receipts: rows.filter(r => r.movement_category === 'fuel_receipt').length,
    asset_consumptions: rows.filter(r => r.movement_category === 'asset_consumption').length,
    unassigned: rows.filter(r => r.movement_category === 'unassigned_consumption').length,
    adjustments: rows.filter(r => r.is_likely_adjustment).length
  }
  
  // Extract unique assets (only those with a unit code)
  const uniqueAssets = Array.from(new Set(
    rows
      .filter(r => r.unidad)
      .map(r => r.unidad)
  ))
  
  // Unmapped assets: those with unit codes that need mapping, plus unassigned consumptions
  const unmappedAssets = Array.from(new Set(
    rows
      .filter(r => r.requires_asset_mapping && r.unidad)
      .map(r => r.unidad)
  ))
  
  // Count unassigned consumptions separately (exits without unit that need mapping)
  const unassignedExits = rows.filter(r => 
    r.movement_category === 'unassigned_consumption' && !r.unidad
  )
  
  const assetsWithMeters = Array.from(new Set(
    rows
      .filter(r => r.has_meter_readings && r.unidad)
      .map(r => r.unidad)
  ))
  
  // Extract meter readings
  const meterReadings = rows
    .filter(r => r.meter_reading)
    .map(r => r.meter_reading!)
  
  // Compute meter deltas (adjacent readings per asset)
  computeMeterDeltas(meterReadings)
  
  // Date range
  const dates = rows
    .map(r => r.parsed_date)
    .filter(Boolean) as Date[]
  const dateRange = {
    start: dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null,
    end: dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null
  }
  
  // Validation counts
  const warnings = rows.filter(r => r.validation_status === 'warning').length
  const errors = rows.filter(r => r.validation_status === 'error').length
  
  return {
    batch_id: batchId,
    plant_code: plantCode,
    warehouse_number: warehouseNum,
    original_filename: filename,
    rows,
    total_rows: rows.length,
    inventory_opening_row: openingRow || null,
    initial_inventory: initialInventory,
    final_inventory_computed: computed,
    final_inventory_provided: finalProvided,
    inventory_discrepancy: discrepancy,
    fuel_receipts: counts.fuel_receipts,
    asset_consumptions: counts.asset_consumptions,
    unassigned_consumptions: counts.unassigned,
    adjustments: counts.adjustments,
    unique_assets: uniqueAssets,
    unmapped_assets: unmappedAssets,
    assets_with_meters: assetsWithMeters,
    meter_readings: meterReadings,
    meter_conflicts: [], // Filled later when checking against checklist data
    total_litros_in: litrosIn,
    total_litros_out: litrosOut,
    net_change: litrosIn - litrosOut,
    validation_warnings: warnings,
    validation_errors: errors,
    date_range: dateRange,
    status: 'pending',
    created_at: new Date().toISOString()
  }
}

// Compute deltas between consecutive meter readings for each asset
function computeMeterDeltas(readings: MeterReading[]) {
  // Group by asset
  const byAsset = new Map<string, MeterReading[]>()
  readings.forEach(r => {
    if (!byAsset.has(r.asset_code)) {
      byAsset.set(r.asset_code, [])
    }
    byAsset.get(r.asset_code)!.push(r)
  })
  
  // Process each asset's readings
  for (const [assetCode, assetReadings] of byAsset) {
    // Already sorted by date in parent function
    let prev: MeterReading | null = null
    
    for (const reading of assetReadings) {
      if (prev) {
        // Compute deltas
        if (reading.horometer != null && prev.horometer != null) {
          reading.horometer_delta = reading.horometer - prev.horometer
        }
        if (reading.kilometer != null && prev.kilometer != null) {
          reading.kilometer_delta = reading.kilometer - prev.kilometer
        }
        
        // Days between readings
        const daysDiff = Math.abs(
          (reading.reading_date.getTime() - prev.reading_date.getTime()) / (1000 * 60 * 60 * 24)
        )
        reading.days_since_last = daysDiff
        
        // Compute averages
        if (reading.horometer_delta != null && daysDiff > 0) {
          reading.daily_hours_avg = reading.horometer_delta / daysDiff
          if (reading.fuel_consumed > 0) {
            reading.fuel_efficiency_per_hour = reading.fuel_consumed / reading.horometer_delta
          }
        }
        
        if (reading.kilometer_delta != null && daysDiff > 0) {
          reading.daily_km_avg = reading.kilometer_delta / daysDiff
          if (reading.fuel_consumed > 0) {
            reading.fuel_efficiency_per_km = reading.fuel_consumed / reading.kilometer_delta
          }
        }
        
        // Validate
        validateMeterReading(reading)
      }
      
      prev = reading
    }
  }
}

// Validate a meter reading and populate warnings/errors
function validateMeterReading(reading: MeterReading) {
  const messages: string[] = []
  let hasWarnings = false
  let hasErrors = false
  
  // Check horometer delta
  if (reading.horometer_delta != null) {
    if (reading.horometer_delta < 0) {
      messages.push(`Horómetro disminuyó ${Math.abs(reading.horometer_delta).toFixed(1)} horas (posible reset o error)`)
      hasErrors = true
    } else if (reading.horometer_delta === 0 && reading.fuel_consumed > 0) {
      messages.push('Consumió combustible pero horómetro sin cambio')
      hasWarnings = true
    } else if (reading.daily_hours_avg && reading.daily_hours_avg > 24) {
      messages.push(`Uso imposible: ${reading.daily_hours_avg.toFixed(1)} hrs/día (>24)`)
      hasErrors = true
    } else if (reading.daily_hours_avg && reading.daily_hours_avg > 20) {
      messages.push(`Uso muy alto: ${reading.daily_hours_avg.toFixed(1)} hrs/día`)
      hasWarnings = true
    }
  }
  
  // Check kilometer delta
  if (reading.kilometer_delta != null) {
    if (reading.kilometer_delta < 0) {
      messages.push(`Kilometraje disminuyó ${Math.abs(reading.kilometer_delta).toFixed(0)} km`)
      hasErrors = true
    } else if (reading.daily_km_avg && reading.daily_km_avg > 500) {
      messages.push(`Recorrido alto: ${reading.daily_km_avg.toFixed(0)} km/día`)
      hasWarnings = true
    }
  }
  
  // Check fuel efficiency
  if (reading.fuel_efficiency_per_hour != null) {
    if (reading.fuel_efficiency_per_hour < 0.5 || reading.fuel_efficiency_per_hour > 50) {
      messages.push(`Eficiencia anómala: ${reading.fuel_efficiency_per_hour.toFixed(1)} L/hr`)
      hasWarnings = true
    }
  }
  
  reading.has_warnings = hasWarnings
  reading.has_errors = hasErrors
  reading.validation_messages = messages
}
