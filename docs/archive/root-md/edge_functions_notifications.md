# Edge Functions, Notifications, and Credit Validation Flow

This document consolidates the current implementation of our notification systems and credit validation flow across the codebase and the live Supabase project. It includes an inventory of Edge Functions, how credit validation emails with action buttons work end-to-end, data model references, deployment/secrets requirements, and hardening/extension guidelines.

## What’s deployed (Supabase Edge Functions)

The following functions are ACTIVE in the `cotizador` project (id: `pkjqznogflgbnwzkzmpg`). Items marked “not in repo” exist in the project but aren’t present in this workspace; consider exporting and committing them.

- credit-validation-notification
  - Purpose: Sends credit validation emails with Approve/Reject buttons; escalates on validator rejection.
  - Triggers:
    - Database triggers when `orders.credit_status` is set to `pending` (new order) or `rejected_by_validator` (escalation).
    - Direct invocation from the app when needed (escalation in rejection flow).
  - Sends: Per-recipient emails via SendGrid; logs to `order_notifications`; stores action tokens in `credit_action_tokens`.
  - Code: Deployed; canonical source in repo at `migrations/supabase/functions/credit-validation-notification/index.ts`.

- daily-schedule-report
  - Purpose: Daily digest of next day’s deliveries; includes status badges and totals.
  - Sends: SendGrid email to `EXECUTIVE`, `PLANT_MANAGER`, `DOSIFICADOR`, plus order creators; logs in `order_notifications`.
  - Code: `supabase/functions/daily-schedule-report/index.ts`.

- today-schedule-report
  - Purpose: Same as above but for “today”; uses BCC to avoid recipient exposure.
  - Code: `supabase/functions/today-schedule-report/index.ts`.

- ensayo-notification
  - Purpose: Quality module function to enqueue notifications into `quality_notification_queue`.
  - Code: `supabase/functions/ensayo-notification/index.ts`.

- weekly-balance-report (not in repo)
  - Purpose: Weekly customer balance digest; emails to management; records in `system_notifications` (table not present in this repo).
  - Action: Export and commit this function and any related migrations/tables to avoid drift.

- send-actual-notification (not in repo)
  - Purpose: Quality notification sender with rich sample context, using SendGrid.
  - Action: Export and commit along with any related SQL.

## Data model relevant to notifications

- orders
  - Fields used by notifications: `credit_status`, `rejection_reason`, `requires_invoice`, `delivery_date`, `delivery_time`, amounts, creator, etc.
  - Credit statuses (current): `pending`, `approved`, `rejected`, `rejected_by_validator`.

- order_notifications
  - Columns: `id`, `order_id`, `notification_type`, `recipient`, `sent_at`, `delivery_status`.
  - Used by: `credit-validation-notification`, `daily-schedule-report`, `today-schedule-report` (and various SQL fixes).

- credit_action_tokens
  - Columns: `order_id`, `recipient_email`, `approve_token`, `reject_token`, `jwt_token`, `expires_at`.
  - Purpose: Store per-recipient approval/rejection tokens for email action links.
  - RLS: Restricted to service role.

Note: The deployed `weekly-balance-report` writes into `system_notifications` which is not present in this repo. Add corresponding migration if we keep using it.

## Credit validation: end-to-end flow

1) Triggering notifications

- Database triggers (see `migrations/new_roles_and_credit_validation.sql`):
  - On INSERT when `orders.credit_status = 'pending'` → call `credit-validation-notification` with `{ type: 'new_order' }`.
  - On UPDATE when `orders.credit_status` changes to `rejected_by_validator` → call `credit-validation-notification` with `{ type: 'rejected_by_validator' }`.
  - Implementation uses `pg_net` with an Authorization bearer for the function endpoint.

2) Building and sending the email

- Edge Function: `credit-validation-notification`:
  - Fetches order, client, and creator context; computes simple projected balance.
  - Picks recipients by role:
    - `new_order` → `CREDIT_VALIDATOR` users.
    - `rejected_by_validator` → `EXECUTIVE` and `PLANT_MANAGER` for escalation.
  - Generates per-recipient action tokens (JWT-like) with exp = 24h; stores in `credit_action_tokens`.
  - Composes HTML with 3 links:
    - Approve: `${FRONTEND_URL}/api/credit-actions/direct-action?order={id}&action=approve&email={recipient}`
    - Reject: `${FRONTEND_URL}/api/credit-actions/direct-action?order={id}&action=reject&email={recipient}`
    - View: `${FRONTEND_URL}/orders/{id}`
  - Sends via SendGrid; records `order_notifications`.

3) One-click buttons → secure processing

- `/api/credit-actions/direct-action` (Next.js API Route):
  - Looks up `credit_action_tokens` by `order_id` and `recipient_email` (with fallback loose match), then redirects to `/api/credit-actions/process?token={stored_token}`.

- `/api/credit-actions/process` (Next.js API Route):
  - Verifies the JWT with `SUPABASE_JWT_SECRET` (fallback to `SUPABASE_SERVICE_ROLE_KEY`), checks exp, and decodes `{ orderId, action, recipientEmail }`.
  - Confirms token exists in DB for that `orderId` (email fallback allowed) and that `orders.credit_status` is in valid states (`pending` or `rejected_by_validator`).
  - Approve path:
    - Update `orders.credit_status = 'approved'`, set validator, timestamps; log in `order_logs`; delete tokens; redirect to `/orders/{id}?action=approved`.
  - Reject path:
    - If current status was `pending` → set `rejected_by_validator` and a default reason; else → set final `rejected`.
    - Log in `order_logs`; delete tokens; if `rejected_by_validator`, invoke `credit-validation-notification` with `{ type: 'rejected_by_validator' }`; redirect to `/orders/{id}?action=rejected`.

4) User feedback in UI

- The order detail page (`src/app/orders/[id]/page.tsx`) reads the `action` query param (`approved`, `rejected`, `error`) and shows a contextual alert at the top.

## Secrets and configuration

Set these in Supabase functions’ secrets (and relevant server environments):

- SENDGRID_API_KEY: SendGrid API key.
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: For server-side Supabase clients.
- SUPABASE_JWT_SECRET or JWT_SECRET: Used to sign/verify action tokens.
- FRONTEND_URL: Base URL used to build email links.

Next.js server routes use `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_JWT_SECRET`. Ensure these are only referenced in server code.

## Known gaps and recommendations

- Source drift:
  - `weekly-balance-report` and `send-actual-notification` exist in the live project but are not committed here. Export and commit both the function code and any dependent SQL (e.g., `system_notifications`) to avoid configuration drift.

- Webhook auth secret in SQL:
  - The `pg_net` triggers embed a long-lived bearer in migrations. Prefer moving secrets out of SQL: either parameterize via a secure function or use `supabase_functions.http_request` with platform-managed auth where possible.

- Token storage and expiry:
  - We already verify the JWT `exp` in `/process`. Optionally, also enforce DB `expires_at` when looking up tokens to provide a second gate.
  - Consider hashing stored tokens if we decide to store long-lived tokens. Current access is service-role only, which mitigates exposure.

- Idempotency:
  - Tokens are deleted after use. Keep logs (`order_logs`, `order_notifications`) for traceability. Avoid reprocessing by ensuring update statements filter `WHERE id = ... AND credit_status IN (...)` if races are suspected.

- Deliverability:
  - The deployed function disables SendGrid click tracking to preserve exact action URLs (prevents link rewriting). Keep this setting.

## How to add/extend interactive approval emails

Use this playbook to add a new interactive email flow or extend the current one.

1) Decide the trigger
- Database trigger (`pg_net` http_post) on `orders` or other table transitions, or invoke the Edge Function from application code.

2) Edge Function responsibilities
- Read necessary context from DB (order, client, creator, totals).
- Compute recipients by role.
- Generate per-recipient tokens (JWT with 24h exp is already implemented in `credit-validation-notification`).
- Store tokens in a secure table tied to the target entity and recipient.
- Compose HTML with action links to your server route: `/api/{feature}/direct-action?entity={id}&action=...&email=...`.
- Send via SendGrid; record results in a notifications log table.

3) Server routes
- `direct-action`: lookup token in DB by `entity` and `recipient`, redirect to `process?token=...`.
- `process`: verify signature + expiry, validate DB token record and entity state, perform state transition, log, delete tokens, redirect with result query param for UI feedback.

4) UI feedback
- On the destination page, read the `action` param and show success/error banners.

5) Hardening
- Verify both JWT expiry and DB expiry.
- Log to an append-only audit trail (`order_logs`).
- Disable link tracking at email provider level.
- Prefer role-based recipient queries that respect `is_active` users only.

## Testing checklist

- Create an order → verify `pending` credit status triggers email to `CREDIT_VALIDATOR` users.
- Click Approve → order becomes `approved`, tokens deleted, success banner shown.
- Click Reject from validator → order becomes `rejected_by_validator`, escalation email goes to managers; second-stage Reject from managers sets final `rejected`.
- Attempt reusing token → should fail or redirect with error.
- Token expiry → after 24h link should be invalid.

## Useful file references

- Edge Functions
  - `migrations/supabase/functions/credit-validation-notification/index.ts`
  - `supabase/functions/daily-schedule-report/index.ts`
  - `supabase/functions/today-schedule-report/index.ts`
  - `supabase/functions/ensayo-notification/index.ts`

- Next.js API routes
  - `src/app/api/credit-actions/direct-action/route.ts`
  - `src/app/api/credit-actions/process/route.ts`

- SQL
  - `migrations/new_roles_and_credit_validation.sql`
  - `migrations/supabase/webhook-trigger.sql`
  - `migrations/supabase/migrations/20240601000000_add_credit_action_tokens.sql`
  - `migrations/orders_tables.sql` (tables + RLS for `order_notifications`)

## Deploy notes

- Set/verify secrets in Supabase for all deployed functions:
  - `supabase secrets set SENDGRID_API_KEY=... FRONTEND_URL=https://...`
- Deploy or re-deploy functions to sync with codebase:
  - `supabase functions deploy credit-validation-notification`
  - `supabase functions deploy daily-schedule-report`
  - `supabase functions deploy today-schedule-report`
  - `supabase functions deploy ensayo-notification`
- Export and commit `weekly-balance-report` and `send-actual-notification` (and related SQL) to avoid drift.


import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { format } from 'https://deno.land/x/date_fns@v2.22.1/index.js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://pkjqznogflgbnwzkzmpg.supabase.co';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://cotizaciones-concreto.vercel.app';

// Helper function to format currency
const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return 'N/A';
  return amount.toLocaleString('es-MX', { minimumFractionDigits: 2 });
};

// Helper function to create a secure action token following JWT standards
const generateActionToken = async (orderId, action, recipientEmail, expiresIn = 86400) => {
  try {
    // Current timestamp in seconds
    const now = Math.floor(Date.now() / 1000);
    // Token expires in 24 hours by default
    const exp = now + expiresIn;
    
    // Create JWT header
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };
    
    // Create token payload (claims)
    const payload = {
      sub: recipientEmail,
      iss: 'credit-validation-system',
      iat: now,
      exp: exp,
      data: {
        orderId,
        action,
        recipientEmail
      }
    };
    
    // Get JWT secret from environment
    const JWT_SECRET = Deno.env.get('SUPABASE_JWT_SECRET') || Deno.env.get('JWT_SECRET') || SUPABASE_SERVICE_KEY;
    
    // Base64Url encode header and payload
    const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    // Create signature - in production use a proper HMAC library
    // This is a simplified implementation
    const data = encodedHeader + '.' + encodedPayload;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(data)
    );
    
    // Convert signature to base64url
    const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    
    // Combine all parts
    const jwt = `${encodedHeader}.${encodedPayload}.${signatureBase64}`;
    
    return jwt;
  } catch (error) {
    console.error('Error generating JWT:', error);
    // Fallback to simple token if JWT generation fails
    const fallbackToken = btoa(JSON.stringify({
      orderId, action, recipientEmail, exp: now + expiresIn
    }));
    return fallbackToken;
  }
};

serve(async (req)=>{
  // Create a Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  // Get the order details from the request
  const { record, type } = await req.json();
  // Determine the notification type (new_order or rejected_by_validator)
  const notificationType = type || 'new_order';
  
  // Get order details with more financial and delivery information
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      id, 
      order_number, 
      requires_invoice, 
      credit_status, 
      special_requirements, 
      rejection_reason, 
      client_id, 
      created_by,
      delivery_date,
      delivery_time,
      preliminary_amount,
      invoice_amount,
      previous_client_balance
    `)
    .eq('id', record.id)
    .single();

  if (orderError) {
    console.error('Error fetching order:', orderError);
    return new Response(JSON.stringify({
      error: orderError.message
    }), {
      status: 400
    });
  }
  
  // Get client details with client code
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('business_name, client_code')
    .eq('id', order.client_id)
    .single();
    
  if (clientError) {
    console.error('Error fetching client:', clientError);
    return new Response(JSON.stringify({
      error: clientError.message
    }), {
      status: 400
    });
  }
  
  // Get creator details
  const { data: creator, error: creatorError } = await supabase
    .from('user_profiles')
    .select('email, first_name, last_name')
    .eq('id', order.created_by)
    .single();
    
  if (creatorError) {
    console.error('Error fetching creator:', creatorError);
    return new Response(JSON.stringify({
      error: creatorError.message
    }), {
      status: 400
    });
  }
  
  // Format the delivery date and time
  const formatDateStr = (dateStr) => {
    try {
      const [year, month, day] = dateStr.split('-');
      return format(new Date(parseInt(year), parseInt(month) - 1, parseInt(day)), 'PPP', { locale: 'es' });
    } catch (e) {
      return dateStr;
    }
  };
  
  const formatTimeStr = (timeStr) => {
    return timeStr ? timeStr.substring(0, 5) : 'N/A';
  };
  
  // Calculate projected balance
  const previousBalance = order.previous_client_balance || 0;
  const orderAmount = order.invoice_amount || 0;
  const projectedBalance = previousBalance + orderAmount;
  
  // Determine recipient roles based on notification type
  let recipientRoles = [];
  if (notificationType === 'new_order') {
    // Nuevas órdenes van a validadores de crédito
    recipientRoles = [
      'CREDIT_VALIDATOR'
    ];
  } else if (notificationType === 'rejected_by_validator') {
    // Órdenes rechazadas por validadores van a gerentes y ejecutivos
    recipientRoles = [
      'EXECUTIVE',
      'PLANT_MANAGER'
    ];
  }
  
  // Get email recipients with their roles
  const { data: recipients, error: recipientsError } = await supabase
    .from('user_profiles')
    .select('email, first_name, last_name, role')
    .in('role', recipientRoles);
    
  if (recipientsError) {
    console.error('Error fetching recipients:', recipientsError);
    return new Response(JSON.stringify({
      error: recipientsError.message
    }), {
      status: 400
    });
  }
  
  // Limit special requirements text
  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    return text.length > maxLength 
      ? text.substring(0, maxLength) + '...' 
      : text;
  };

  // CSS for email styling
  const emailStyles = `
    .container { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #f8fafc; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .title { font-size: 24px; color: #1e293b; margin-bottom: 10px; }
    .subtitle { font-size: 18px; color: #334155; margin-bottom: 15px; }
    .info-box { background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 5px; padding: 15px; margin-bottom: 15px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .info-label { color: #64748b; font-weight: normal; }
    .info-value { font-weight: bold; color: #334155; }
    .financial-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 15px; margin-bottom: 15px; }
    .financial-title { color: #475569; font-weight: bold; margin-bottom: 10px; }
    .financial-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .financial-total { border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 8px; }
    .negative { color: #ef4444; }
    .positive { color: #22c55e; }
    .btn-container { margin-top: 25px; }
    .btn { display: inline-block; padding: 10px 20px; margin-right: 10px; text-decoration: none; border-radius: 5px; font-weight: bold; text-align: center; }
    .btn-approve { background-color: #22c55e; color: white; }
    .btn-reject { background-color: #ef4444; color: white; }
    .btn-view { background-color: #3b82f6; color: white; }
    .notes { margin-top: 15px; padding: 10px; background-color: #f8fafc; border-left: 4px solid #94a3b8; }
  `;

  // Prepare email subject and content based on notification type
  let emailSubject, emailContent;
  
  // Send email using SendGrid API for each recipient
  for (const recipient of recipients) {
    // Generate action tokens for this recipient
    const approveToken = await generateActionToken(order.id, 'approve', recipient.email);
    const rejectToken = await generateActionToken(order.id, 'reject', recipient.email);
    
    // Use both direct-action and process endpoints for backward compatibility
    // Direct action URLs are more friendly for email clients that modify links (like SendGrid's click tracking)
    const approveUrl = `${FRONTEND_URL}/api/credit-actions/direct-action?order=${order.id}&action=approve&email=${encodeURIComponent(recipient.email)}`;
    const rejectUrl = `${FRONTEND_URL}/api/credit-actions/direct-action?order=${order.id}&action=reject&email=${encodeURIComponent(recipient.email)}`;
    const viewOrderUrl = `${FRONTEND_URL}/orders/${order.id}`;
    
    if (notificationType === 'rejected_by_validator') {
      emailSubject = `Revisión de rechazo de crédito - Pedido ${order.order_number}`;
      emailContent = `
        <html>
        <head>
          <style>${emailStyles}</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="title">Revisión de rechazo de crédito requerida</h1>
              <h2 class="subtitle">Pedido: ${order.order_number}</h2>
            </div>
            
            <div class="info-box">
              <div class="info-row">
                <span class="info-label">Cliente:</span>
                <span class="info-value">${client.business_name}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Código de cliente:</span>
                <span class="info-value">${client.client_code || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Entrega:</span>
                <span class="info-value">${formatDateStr(order.delivery_date)} a las ${formatTimeStr(order.delivery_time)}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Requiere Factura:</span>
                <span class="info-value">${order.requires_invoice ? 'Sí' : 'No'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Creado por:</span>
                <span class="info-value">${creator.first_name} ${creator.last_name}</span>
              </div>
            </div>
            
            <div class="financial-box">
              <h3 class="financial-title">Información Financiera</h3>
              <div class="financial-row">
                <span class="info-label">Monto Preliminar:</span>
                <span class="info-value">$${formatCurrency(order.preliminary_amount)}</span>
              </div>
              <div class="financial-row">
                <span class="info-label">Balance Actual (Previo):</span>
                <span class="info-value ${previousBalance > 0 ? 'negative' : 'positive'}">$${formatCurrency(previousBalance)}</span>
              </div>
              <div class="financial-row">
                <span class="info-label">Monto Orden (con IVA si aplica):</span>
                <span class="info-value">$${formatCurrency(orderAmount)}</span>
              </div>
              <div class="financial-row financial-total">
                <span class="info-label">Balance Proyectado:</span>
                <span class="info-value ${projectedBalance > 0 ? 'negative' : 'positive'}">$${formatCurrency(projectedBalance)}</span>
              </div>
            </div>
            
            <div class="notes">
              <p><strong>Razón de rechazo:</strong> ${order.rejection_reason || 'No especificada'}</p>
              ${order.special_requirements ? `<p><strong>Notas adicionales:</strong> ${truncateText(order.special_requirements, 200)}</p>` : ''}
            </div>
            
            <div class="btn-container">
              <a href="${approveUrl}" class="btn btn-approve">Aprobar Crédito</a>
              <a href="${rejectUrl}" class="btn btn-reject">Rechazar Definitivamente</a>
              <a href="${viewOrderUrl}" class="btn btn-view">Ver Detalles Completos</a>
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      emailSubject = `Validación de crédito requerida - Pedido ${order.order_number}`;
      emailContent = `
        <html>
        <head>
          <style>${emailStyles}</style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="title">Se requiere validación de crédito</h1>
              <h2 class="subtitle">Pedido: ${order.order_number}</h2>
            </div>
            
            <div class="info-box">
              <div class="info-row">
                <span class="info-label">Cliente:</span>
                <span class="info-value">${client.business_name}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Código de cliente:</span>
                <span class="info-value">${client.client_code || 'N/A'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Entrega:</span>
                <span class="info-value">${formatDateStr(order.delivery_date)} a las ${formatTimeStr(order.delivery_time)}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Requiere Factura:</span>
                <span class="info-value">${order.requires_invoice ? 'Sí' : 'No'}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Creado por:</span>
                <span class="info-value">${creator.first_name} ${creator.last_name}</span>
              </div>
            </div>
            
            <div class="financial-box">
              <h3 class="financial-title">Información Financiera</h3>
              <div class="financial-row">
                <span class="info-label">Monto Preliminar:</span>
                <span class="info-value">$${formatCurrency(order.preliminary_amount)}</span>
              </div>
              <div class="financial-row">
                <span class="info-label">Balance Actual (Previo):</span>
                <span class="info-value ${previousBalance > 0 ? 'negative' : 'positive'}">$${formatCurrency(previousBalance)}</span>
              </div>
              <div class="financial-row">
                <span class="info-label">Monto Orden (con IVA si aplica):</span>
                <span class="info-value">$${formatCurrency(orderAmount)}</span>
              </div>
              <div class="financial-row financial-total">
                <span class="info-label">Balance Proyectado:</span>
                <span class="info-value ${projectedBalance > 0 ? 'negative' : 'positive'}">$${formatCurrency(projectedBalance)}</span>
              </div>
            </div>
            
            ${order.special_requirements ? `
            <div class="notes">
              <p><strong>Requisitos especiales:</strong> ${truncateText(order.special_requirements, 200)}</p>
            </div>
            ` : ''}
            
            <div class="btn-container">
              <a href="${approveUrl}" class="btn btn-approve">Aprobar Crédito</a>
              <a href="${rejectUrl}" class="btn btn-reject">Rechazar Crédito</a>
              <a href="${viewOrderUrl}" class="btn btn-view">Ver Detalles Completos</a>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [
              {
                email: recipient.email
              }
            ]
          }
        ],
        from: {
          email: "juan.aguirre@dssolutions-mx.com"
        },
        subject: emailSubject,
        content: [
          {
            type: "text/html",
            value: emailContent
          }
        ]
      })
    });

    if (!response.ok) {
      console.error('Error sending email via SendGrid:', await response.text());
    } else {
      // Record notification in database
      await supabase.from('order_notifications').insert({
        order_id: order.id,
        notification_type: notificationType === 'rejected_by_validator' ? 'CREDIT_REJECTION_REVIEW' : 'CREDIT_VALIDATION_REQUEST',
        recipient: recipient.email,
        delivery_status: response.ok ? 'SENT' : 'FAILED'
      });
      
      // Store tokens in database for validation
      await supabase.from('credit_action_tokens').insert({
        order_id: order.id,
        recipient_email: recipient.email,
        approve_token: approveToken,
        reject_token: rejectToken,
        jwt_token: approveToken,  // Store JWT token
        expires_at: new Date(Date.now() + 86400 * 1000).toISOString() // 24 hours from now
      });
    }
  }

  return new Response(JSON.stringify({
    success: true
  }), {
    headers: {
      "Content-Type": "application/json"
    }
  });
});