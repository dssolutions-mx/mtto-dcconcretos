# MCP / one-off payloads

JSON or helper files used with Cursor MCP or manual Supabase operations — **not** executed by the Next.js app.

## Planning center migrations

| File | MCP `apply_migration` name |
|------|---------------------------|
| `mcp_apply_incident_response_times_agenda.json` | `incident_response_times_agenda` |
| `mcp_apply_asset_service_windows_planning.json` | `asset_service_windows_planning` |

### Option A — Cursor Supabase MCP (interactive)

1. **Cursor → Settings → Tools & MCP** → add Supabase MCP:
   - URL: `https://mcp.supabase.com/mcp?project_ref=txapndpstzcspgxlybll`
   - Complete OAuth in browser (or PAT header — see Option B)
2. In agent chat: *"Apply `scripts/mcp/mcp_apply_incident_response_times_agenda.json` then `mcp_apply_asset_service_windows_planning.json` using apply_migration"*
3. Or paste each file's `query` into MCP tool `apply_migration` with matching `name` and `project_id`.

### Option B — Cloud Agent / CI (headless)

1. Create a [Supabase Personal Access Token](https://supabase.com/dashboard/account/tokens)
2. Add secret **`SUPABASE_ACCESS_TOKEN`** to the Cloud Agent environment
3. Run:

```bash
SUPABASE_ACCESS_TOKEN=sbp_... node scripts/mcp/apply-via-supabase-mcp.mjs
```

This calls the same Management API endpoint as MCP `apply_migration`.

### Verify

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  for (const t of ['asset_service_windows','planning_calendar_events']) {
    const { error } = await sb.from(t).select('*').limit(1);
    console.log(t, error ? error.message : 'OK');
  }
})();
"
```

## Other payloads

- `mcp_apply_po_migration.json` — PO email approval RPC (historical)
