#!/usr/bin/env node
/**
 * Apply planning migrations via Supabase Management API (same backend as MCP apply_migration).
 *
 * Requires SUPABASE_ACCESS_TOKEN (PAT from https://supabase.com/dashboard/account/tokens)
 * and optionally SUPABASE_PROJECT_REF (defaults to txapndpstzcspgxlybll).
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/mcp/apply-via-supabase-mcp.mjs
 */

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF ??
  process.env.SUPABASE_PROJECT_ID ??
  "txapndpstzcspgxlybll"

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN

const MIGRATIONS = [
  {
    file: "mcp_apply_incident_response_times_agenda.json",
    version: "20260616120000",
  },
  {
    file: "mcp_apply_asset_service_windows_planning.json",
    version: "20260617140000",
  },
]

async function listAppliedMigrations() {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/migrations`,
    {
      headers: { Authorization: `Bearer ${TOKEN}` },
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`list_migrations failed (${res.status}): ${text}`)
  }
  return res.json()
}

async function applyMigration({ name, query }) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/migrations`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, query }),
    },
  )
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`apply_migration ${name} failed (${res.status}): ${text}`)
  }
  return text ? JSON.parse(text) : {}
}

async function verifyObjects() {
  const { createClient } = await import("@supabase/supabase-js")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.warn("Skip verify: missing SUPABASE_URL / SERVICE_ROLE_KEY")
    return
  }
  const sb = createClient(url, key)
  const checks = [
    ["asset_service_windows", () => sb.from("asset_service_windows").select("id").limit(1)],
    ["work_orders.planned_start_at", () => sb.from("work_orders").select("planned_start_at").limit(1)],
    ["incident_history.first_planned_at", () => sb.from("incident_history").select("first_planned_at").limit(1)],
  ]
  for (const [label, fn] of checks) {
    const { error } = await fn()
    console.log(label + ":", error ? "MISSING (" + error.message + ")" : "OK")
  }
}

async function main() {
  if (!TOKEN) {
    console.error(
      "SUPABASE_ACCESS_TOKEN is required.\n" +
        "Generate at https://supabase.com/dashboard/account/tokens\n" +
        "Add it to Cloud Agent secrets or run with the env var set.",
    )
    process.exit(1)
  }

  console.log("Project:", PROJECT_REF)
  const applied = await listAppliedMigrations()
  const versions = new Set(
    (Array.isArray(applied) ? applied : []).map((m) => String(m.version ?? m.name ?? "")),
  )
  console.log("Applied migrations count:", versions.size)

  for (const { file, version } of MIGRATIONS) {
    const payload = JSON.parse(readFileSync(join(__dirname, file), "utf8"))
    if (versions.has(version) || versions.has(payload.name)) {
      console.log(`Skip ${payload.name} — already in migration history`)
      continue
    }
    console.log(`Applying ${payload.name}…`)
    await applyMigration(payload)
    console.log(`  OK`)
  }

  console.log("\nPost-apply verification:")
  await verifyObjects()
  console.log("Done.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
