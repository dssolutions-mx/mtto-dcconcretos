import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase-server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("exception_assets_review")
      .select("*")
      .order("total_consumption_liters", { ascending: false })
      .limit(200)

    if (error) {
      console.error("[exception_assets_review]", error)
      return NextResponse.json(
        { error: "Failed to load registry", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ items: data ?? [] })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
