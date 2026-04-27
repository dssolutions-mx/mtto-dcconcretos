import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: "Se requiere ID del checklist completado" }, { status: 400 })
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // ignore when invoked from Server Component boundary
          }
        },
      },
    },
  )

  try {
    const { data, error } = await supabase
      .from("checklist_evidence")
      .select(
        `
        id,
        section_id,
        category,
        description,
        photo_url,
        sequence_order,
        created_at,
        checklist_sections (
          id,
          title
        )
      `,
      )
      .eq("completed_checklist_id", id)
      .order("sequence_order", { ascending: true })

    if (error) {
      console.error("[completed checklist evidence]", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = (data ?? []).map((row: Record<string, unknown>) => {
      const sections = row.checklist_sections as { title?: string } | null
      return {
        id: row.id,
        section_id: row.section_id,
        category: row.category,
        description: row.description,
        photo_url: row.photo_url,
        sequence_order: row.sequence_order,
        created_at: row.created_at,
        section_title: sections?.title ?? "Evidencias generales",
      }
    })

    return NextResponse.json({ data: rows })
  } catch (e: unknown) {
    console.error("[completed checklist evidence]", e)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 })
  }
}
