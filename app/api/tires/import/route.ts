import { createClient } from '@/lib/supabase-server'
import { parseAndValidateCsvImport, type CsvImportRow } from '@/lib/tires/csv-import'
import { insertTireWithIdentity } from '@/lib/tires/identifier'
import { NextRequest, NextResponse } from 'next/server'

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

    const body = (await request.json()) as {
      csv_text?: string
      rows?: CsvImportRow[]
      dry_run?: boolean
      plant_id?: string | null
    }

    const dryRun = body.dry_run !== false && !body.rows

    if (body.csv_text) {
      const { data: existingTires } = await supabase
        .from('tires')
        .select('serial_number')
        .not('serial_number', 'is', null)

      const existingDots = new Set(
        (existingTires ?? [])
          .map((t) => t.serial_number?.trim().toUpperCase())
          .filter((d): d is string => !!d)
      )

      const validation = parseAndValidateCsvImport(body.csv_text, existingDots)

      if (dryRun) {
        return NextResponse.json({
          dry_run: true,
          valid_count: validation.valid_rows.length,
          error_count: validation.errors.length,
          valid_rows: validation.valid_rows,
          errors: validation.errors,
          duplicate_dots_in_file: validation.duplicate_dots_in_file,
        })
      }

      if (validation.errors.length > 0) {
        return NextResponse.json(
          {
            error: 'Corrija los errores antes de importar',
            errors: validation.errors,
          },
          { status: 400 }
        )
      }

      return importRows(supabase, validation.valid_rows, body.plant_id ?? null)
    }

    if (body.rows && body.rows.length > 0 && body.dry_run === false) {
      return importRows(supabase, body.rows, body.plant_id ?? null)
    }

    return NextResponse.json({ error: 'Se requiere csv_text o rows' }, { status: 400 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function importRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: CsvImportRow[],
  plantId: string | null
) {
  const created: { id: string; row_number: number }[] = []
  const errors: { row_number: number; message: string }[] = []

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
        }
      )
      created.push({ id: createdRow.id, row_number: row.row_number })
    } catch (e) {
      errors.push({
        row_number: row.row_number,
        message: e instanceof Error ? e.message : 'Error al crear llanta',
      })
    }
  }

  return NextResponse.json({
    dry_run: false,
    created_count: created.length,
    error_count: errors.length,
    created,
    errors,
  })
}
