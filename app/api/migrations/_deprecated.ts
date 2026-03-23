import { NextResponse } from "next/server"

/** HTTP migration endpoints are disabled; schema changes use Supabase MCP or CLI. */
export function migrationEndpointDeprecated() {
  return NextResponse.json(
    {
      error: "Deprecated",
      message:
        "Database schema changes are applied via Supabase MCP or CLI only. Legacy SQL is in archive/legacy-db-migrations/. This endpoint is disabled.",
    },
    { status: 410 }
  )
}
