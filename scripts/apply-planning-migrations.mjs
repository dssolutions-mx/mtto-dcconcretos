#!/usr/bin/env node
/**
 * Apply planning-center SQL migrations to the hosted Supabase database.
 * Requires DATABASE_URL (postgres connection string) in the environment.
 *
 * Usage:
 *   DATABASE_URL='postgresql://...' node scripts/apply-planning-migrations.mjs
 */

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")

const MIGRATIONS = [
  "20260616120000_incident_response_times_agenda.sql",
  "20260617140000_asset_service_windows_planning.sql",
]

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error(
      "DATABASE_URL is required (Supabase → Project Settings → Database → Connection string).",
    )
    process.exit(1)
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  for (const file of MIGRATIONS) {
    const sql = readFileSync(join(root, "supabase/migrations", file), "utf8")
    console.log(`Applying ${file}…`)
    await client.query(sql)
    console.log(`  OK`)
  }

  await client.end()
  console.log("Planning migrations applied.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
