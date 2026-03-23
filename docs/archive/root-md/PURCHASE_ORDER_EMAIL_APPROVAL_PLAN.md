## Purchase Order Email Approval – Implementation Plan

### Goal
Send actionable email notifications for Purchase Orders (PO) to the correct authorizer(s). Each email includes one-click Approve/Reject buttons that securely transition the PO in the system, mirroring the proven “credit validation” email pattern.

### TL;DR
- Add `po_action_tokens` table (per-recipient, expiring tokens) + indexes
- New Edge Function: `purchase-order-approval-notification` (SendGrid)
- New API routes: `GET /api/purchase-order-actions/direct-action`, `GET /api/purchase-order-actions/process`
- Trigger when PO enters `pending_approval` to invoke the Edge Function via `pg_net`
- Use DB RPCs to compute authorizers; enforce expiry/idempotency; audit in `notifications`

---

## 1) Current State Findings

- Authorization logic
  - API already exposes who-can-authorize endpoints and suggested approver:
    - `app/api/authorization/purchase-order/route.ts` → RPCs `get_purchase_order_authorizers`, `get_purchase_order_approver` (dynamic, considers Business Unit and Plant).
  - Workflow advancement endpoint validates business rules on approval:
    - `app/api/purchase-orders/advance-workflow/[id]/route.ts` – validates dynamic user limits on approval and admin roles for validation.

- Purchase Orders model
  - Table `purchase_orders` includes fields for approval: `status`, `approved_by`, `approval_date`, `authorized_by`, `authorization_date` and more (RLS in place and already integrated with work orders).

- Notifications infra
  - Generic `notifications` table exists (RLS). No per-email action tokens for POs yet.
  - SQL file mentions `notify_purchase_order_update` trigger function, but no email sending flow is wired for approval requests.

- Credit validation precedent (other project)
  - Uses an Edge Function to send SendGrid emails with one-click action links and stores expiring tokens in `credit_action_tokens`.
  - Pattern is applicable here with a PO-focused variant.

Environment and tooling
- `.env.local` already includes `SENDGRID_API_KEY` and Supabase keys.
- Supabase project has `pg_net` for HTTP triggers and `pgjwt`/`pgcrypto` for token work.

Conclusion: We can replicate the credit-validation approach for POs using our existing authorization RPCs and workflow functions.

---

## 2) High-Level Design

1. Data model
   - Create `po_action_tokens` for per-recipient, one-time, expiring approve/reject tokens.
   - Reuse `notifications` to log email attempts and delivery outcomes, with `related_entity='purchase_order'` and `entity_id=PO.id`.

2. Edge Function: `purchase-order-approval-notification`
   - Triggered on PO transition to `pending_approval` (or on manual invocation for re-send/escalation).
   - Fetch PO context; compute recipients via `get_purchase_order_authorizers` RPC.
   - Generate per-recipient JWT tokens (24h exp); store in `po_action_tokens`.
   - Send SendGrid HTML email with Approve/Reject/View buttons.
   - Record in `notifications` per recipient.

3. API Routes (Next.js App Router)
   - `GET /api/purchase-order-actions/direct-action`
     - Input: `po`, `action`, `email`
     - Lookup stored token by `po` + `email` + `action`; redirect to `/api/purchase-order-actions/process?token=...`
   - `GET /api/purchase-order-actions/process`
     - Verify JWT signature and exp; confirm token record exists and matches.
     - Perform state transition via DB function(s) with required validations.
     - Delete tokens (idempotent) and redirect to PO page with result (`/compras?po={id}&action=approved|rejected|error`).

4. Triggers
   - SQL trigger (via `pg_net`) on `purchase_orders` to call the Edge Function when `status` becomes `pending_approval`.

5. Security & hardening
   - JWT exp + DB `expires_at` checks.
   - Delete tokens on first use (idempotent behavior if re-used).
   - Disable SendGrid click-tracking to preserve exact URLs.
   - Authorizer list is computed at send time; validate token existence instead of recomputing authorizers at click time (optional additional guard: re-check current authorizers).

---

## 3) Data Model Changes

Create `po_action_tokens` with service-role-only access (RLS restrictive):

```sql
create table if not exists public.po_action_tokens (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  recipient_email citext not null,
  action text not null check (action in ('approve','reject')),
  jwt_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Basic indexes
create index if not exists idx_po_action_tokens_po on public.po_action_tokens(purchase_order_id);
create index if not exists idx_po_action_tokens_email on public.po_action_tokens(recipient_email);
create index if not exists idx_po_action_tokens_exp on public.po_action_tokens(expires_at);

-- RLS: deny by default; service role or security definer functions will access
alter table public.po_action_tokens enable row level security;
create policy "deny all" on public.po_action_tokens for all using (false);
```

Optional: Log per-email notification in `notifications` table with:
- `user_id` (resolved from `profiles.email`) when available; else null
- `title`: "Aprobación de Orden de Compra"
- `message`: context summary
- `type`: `PURCHASE_ORDER_APPROVAL_REQUEST`
- `related_entity`: `purchase_order`
- `entity_id`: `<purchase_order_id>`

---

## 4) Edge Function: `purchase-order-approval-notification`

Responsibilities
- Input: `{ record: { id: <po_id> } }` from trigger or `{ po_id }` when invoked directly.
- Fetch PO details: amount, plant/business unit, requester, supplier, items.
- Compute recipients via RPC `get_purchase_order_authorizers(amount, business_unit_id, plant_id)`; join with `profiles` to get `email` and display name.
- Generate JWT per recipient with claims: `{ poId, action, recipientEmail }`, `exp = now + 24h` using `SUPABASE_JWT_SECRET` (fallback service key).
- Insert one row per action into `po_action_tokens` (approve and reject) or store a single token with `action` in payload per row.
- Build email HTML with buttons:
  - Approve: `${FRONTEND_URL}/api/purchase-order-actions/direct-action?po={id}&action=approve&email={recipient}`
  - Reject: `${FRONTEND_URL}/api/purchase-order-actions/direct-action?po={id}&action=reject&email={recipient}`
  - View: `${FRONTEND_URL}/compras?po={id}`
- Send via SendGrid; record in `notifications`.

Config (Supabase function secrets)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET` (or `JWT_SECRET`)
- `SENDGRID_API_KEY`
- `FRONTEND_URL` (prod and preview/local)

Deliverability
- Disable click-tracking on SendGrid if possible, or ensure URLs aren’t rewritten.

---

## 5) API Routes (Next.js)

Follow our SSR Supabase client rules (ONLY `@supabase/ssr`, cookie `getAll`/`setAll` pattern).

- `GET /api/purchase-order-actions/direct-action`
  - Input query: `po`, `action`, `email`
  - Lookup: fetch matching row from `po_action_tokens` where `purchase_order_id = po`, `recipient_email = email`, `action = action`, and `expires_at > now()`.
  - If found → redirect to `/api/purchase-order-actions/process?token=<jwt_token>`; else → redirect with error.

- `GET /api/purchase-order-actions/process`
  - Verify JWT signature using `SUPABASE_JWT_SECRET`; validate `exp`.
  - Decode `{ poId, action, recipientEmail }`.
  - Confirm token row exists and not expired.
  - Perform action:
    - Approve → advance PO workflow to `approved`.
    - Reject → advance to `rejected`.
  - Use a database function with appropriate permissions to ensure RLS-safe updates. Prefer calling our existing workflow function (or add an `approve/reject` SQL function marked `SECURITY DEFINER`) to centralize validation and auditing.
  - Delete token row(s) for this `poId` + `recipientEmail` + `action`.
  - Redirect to `/compras?po={poId}&action=approved|rejected` for UI feedback.

Validation strategy
- Because recipients are chosen by `get_purchase_order_authorizers(...)`, the authorization check is front-loaded. Optionally re-check authorizers at click time (non-blocking if token exists) to handle revocations.

---

## 6) Database Trigger to Invoke Edge Function

On `purchase_orders` insert/update when status transitions into `pending_approval` → use `pg_net` to POST to the Edge Function endpoint with `{ record: NEW }`.

Notes
- Avoid embedding long-lived secrets directly in SQL. Prefer using a Postgres function that reads from Vault/Config, or keep bearer tokens short-lived.
- Provide a manual re-send path by allowing app code to invoke the Edge Function directly with `{ po_id }` payload.

---

## 7) UI Feedback

- Leverage existing purchases UI. On `/compras` read `?po` and `?action` query params to show toasts/banners similar to the credit validation UX (e.g., "Orden aprobada" / "Orden rechazada").
- Optional: add a minimal confirmation page for users who open links on devices without a session.

---

## 8) Security & Compliance

- Tokens
  - JWT signed with `HS256`; exp=24h; stored in DB; hard-delete on first use.
  - Also enforce DB-level `expires_at` > now() on lookup.
- RLS
  - `po_action_tokens` is service-role-only via RLS deny-all; access from Edge Function and server routes with service role or security definer procedures.
- Email URLs
  - Disable click-tracking to prevent URL rewriting.
- Auditing
  - Log notifications and state transitions. Consider an append-only `purchase_order_logs` if we want detailed trails (optional).

---

## 9) Configuration

Environment
- App (server): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- App (server runtime only): `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
- Edge Function: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SENDGRID_API_KEY`, `SUPABASE_JWT_SECRET`, `FRONTEND_URL`

Provider
- SendGrid sender domain and from-address must be verified for deliverability.

---

## 10) Deployment Steps

1) SQL – apply migration for `po_action_tokens` and trigger
- Add a migration file with the DDL above and the `pg_net` trigger invoking the Edge Function.
- Apply via Supabase MCP or CLI.

2) Edge Function
- Create `supabase/functions/purchase-order-approval-notification/index.ts` (Deno). Reuse patterns from `credit-validation-notification` (email composition, token generation, per-recipient loop, insert tokens and notifications).
- `supabase functions deploy purchase-order-approval-notification`
- `supabase secrets set SENDGRID_API_KEY=... FRONTEND_URL=...`

3) API Routes
- Add `app/api/purchase-order-actions/direct-action/route.ts`
- Add `app/api/purchase-order-actions/process/route.ts`
- Use `@supabase/ssr` with ONLY `cookies.getAll/setAll` as per workspace rules.

4) UI
- Update purchases page (`app/compras/page.tsx`) to read `?action` and show toasts.

5) Verify
- Run build; exercise flows end-to-end in staging.

---

## 11) Testing Plan

- Unit
  - Token generation/verification (Edge Function utility), 24h expiry boundary.
  - API route guards: missing/expired/invalid token paths → redirect with error.

- Integration (staging)
  - Create PO that requires approval → trigger email to correct authorizer(s).
  - Approve link → PO transitions to `approved` and tokens deleted.
  - Reject link → PO transitions to `rejected` and tokens deleted.
  - Token reuse → no-op with safe messaging.
  - Token expiry → safe error with re-send guidance.
  - Verify `notifications` rows per recipient.

- Deliverability
  - Confirm emails render across major clients and links are not rewritten.

---

## 12) Rollback Strategy

- Disable trigger calling the Edge Function.
- Optionally keep `po_action_tokens` table; it’s inert without the function and routes.
- Revert deployment of new API routes if necessary.

---

## 13) Effort & Sequencing

- Day 1: DDL migration + Edge Function (send email, tokens, logging).
- Day 2: API routes (direct-action, process) + basic UI feedback.
- Day 3: E2E tests, retries, guardrails; deliverability tuning.

---

## 14) Notes & Alternatives

- Alternative to JWT: random opaque tokens (store hashed); JWT is fine given service-role isolation and 24h expiry.
- Optional: re-check current authorizers at click time using the same RPCs for additional safety.
- Consider a digest/reminder function for pending approvals.


