import { createClient } from '@/lib/supabase-server'
import {
  parseAndValidateCsvImport,
  parseAndValidateImportRows,
  parseCsvText,
  type CsvImportRow,
  type ImportValidationContext,
} from '@/lib/tires/csv-import'
import { parseExcelToRows } from '@/lib/tires/excel-import'
import { insertTireWithIdentity, loadTireIdRules } from '@/lib/tires/identifier'
import { NextRequest, NextResponse } from 'next/server'

async function buildValidationContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  plantId: string | null
): Promise<ImportValidationContext> {
  const [{ data: existingTires }, { data: warehouses }, idRules] = await Promise.all([
    supabase.from('tires').select('serial_number, internal_code'),
    supabase.from('inventory_warehouses').select('id, warehouse_code').eq('is_active', true),
    loadTireIdRules(supabase, plantId),
  ])

  const existingDots = new Set(
    (existingTires ?? [])
      .map((t) => t.serial_number?.trim().toUpperCase())
      .filter((d): d is string => !!d)
  )

  const existingInternalCodes = new Set(
    (existingTires ?? [])
      .map((t) => t.internal_code?.trim().toUpperCase())
      .filter((c): c is string => !!c)
  )

  const warehouseIds = new Set((warehouses ?? []).map((w) => w.id as string))
  const warehouseCodes = new Map<string, string>()
  for (const w of warehouses ?? []) {
    const code = (w.warehouse_code as string | null)?.trim()
    if (code) warehouseCodes.set(code.toUpperCase(), w.id as string)
  }

  return { existingDots, existingInternalCodes, warehouseIds, warehouseCodes, idRules }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const contentType = request.headers.get('content-type') ?? ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file')
      const plantId = (formData.get('plant_id') as string | null) ?? null
      const dryRun = formData.get('dry_run') !== 'false'

      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Se requiere archivo' }, { status: 400 })
      }

      const ctx = await buildValidationContext(supabase, plantId)
      let rawRows: string[][]

      if (/\.xlsx?$/i.test(file.name)) {
        const buffer = await file.arrayBuffer()
        rawRows = await parseExcelToRows(buffer)
      } else {
        const text = await file.text()
        rawRows = parseCsvText(text)
      }

      const validation = parseAndValidateImportRows(rawRows, ctx)

      if (dryRun) {
        return NextResponse.json({
          dry_run: true,
          valid_count: validation.valid_rows.length,
          error_count: validation.errors.length,
          valid_rows: validation.valid_rows,
          errors: validation.errors,
          duplicate_dots_in_file: validation.duplicate_dots_in_file,
          duplicate_internal_codes_in_file: validation.duplicate_internal_codes_in_file,
        })
      }

      if (validation.errors.length > 0) {
        return NextResponse.json(
          { error: 'Corrija los errores antes de importar', errors: validation.errors },
          { status: 400 }
        )
      }

      return importRows(supabase, validation.valid_rows, plantId, user.id)
    }

    const body = (await request.json()) as {
      csv_text?: string
      rows?: CsvImportRow[]
      dry_run?: boolean
      plant_id?: string | null
    }

    const plantId = body.plant_id ?? null
    const dryRun = body.dry_run !== false && !body.rows

    if (body.csv_text) {
      const ctx = await buildValidationContext(supabase, plantId)
      const validation = parseAndValidateCsvImport(body.csv_text, ctx)

      if (dryRun) {
        return NextResponse.json({
          dry_run: true,
          valid_count: validation.valid_rows.length,
          error_count: validation.errors.length,
          valid_rows: validation.valid_rows,
          errors: validation.errors,
          duplicate_dots_in_file: validation.duplicate_dots_in_file,
          duplicate_internal_codes_in_file: validation.duplicate_internal_codes_in_file,
        })
      }

      if (validation.errors.length > 0) {
        return NextResponse.json(
          { error: 'Corrija los errores antes de importar', errors: validation.errors },
          { status: 400 }
        )
      }

      return importRows(supabase, validation.valid_rows, plantId, user.id)
    }

    if (body.rows && body.rows.length > 0 && body.dry_run === false) {
      return importRows(supabase, body.rows, plantId, user.id)
    }

    return NextResponse.json({ error: 'Se requiere csv_text, rows o archivo' }, { status: 400 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function importRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: CsvImportRow[],
  plantId: string | null,
  userId: string
) {
  const created: { id: string; row_number: number; internal_code: string | null }[] = []
  const errors: { row_number: number; message: string }[] = []
  let readingsCreated = 0

  for (const row of rows) {
    try {
      const createdRow = await insertTireWithIdentity(
        supabase,
        {
          brand: row.marca.trim(),
          size: row.medida.trim(),
          model: row.modelo?.trim() || null,
          condition: row.condicion,
          purchase_cost: row.costo_compra,
          purchase_date: row.fecha_compra,
          warehouse_id: row.almacen_id,
          plant_id: plantId,
          status: 'en_almacen',
        },
        {
          plantId,
          serialNumber: row.dot,
          internalCode: row.codigo_interno,
        }
      )
      created.push({
        id: createdRow.id,
        row_number: row.row_number,
        internal_code: createdRow.internal_code,
      })

      if (row.banda_mm != null || row.presion_psi != null) {
        const { error: readingError } = await supabase.from('tire_readings').insert({
          tire_id: createdRow.id,
          installation_id: null,
          asset_id: null,
          tread_depth_mm: row.banda_mm,
          pressure_psi: row.presion_psi,
          read_at: new Date().toISOString(),
          recorded_by: userId,
          notes: 'Lectura inicial (importación)',
        })
        if (readingError) {
          errors.push({
            row_number: row.row_number,
            message: `Llanta creada pero lectura inicial falló: ${readingError.message}`,
          })
        } else {
          readingsCreated += 1
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al crear llanta'
      const friendly =
        msg.includes('internal_code') || msg.includes('idx_tires_internal_code')
          ? `Código interno duplicado en fila ${row.row_number}`
          : msg
      errors.push({ row_number: row.row_number, message: friendly })
    }
  }

  return NextResponse.json({
    dry_run: false,
    created_count: created.length,
    readings_created: readingsCreated,
    error_count: errors.length,
    created,
    errors,
  })
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { generateExcelTemplateBuffer } = await import('@/lib/tires/excel-import')
    const buffer = await generateExcelTemplateBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="plantilla-llantas.xlsx"',
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
