-- Idempotent diesel consumption sync from offline outbox.
--
-- Each outbox entry uses its id as client_transaction_id so worker retries and
-- concurrent enqueues cannot create duplicate diesel_transactions rows.

ALTER TABLE public.diesel_transactions
  ADD COLUMN IF NOT EXISTS client_transaction_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_diesel_transactions_client_tx
  ON public.diesel_transactions (client_transaction_id)
  WHERE client_transaction_id IS NOT NULL;

COMMENT ON COLUMN public.diesel_transactions.client_transaction_id IS
  'Client-generated idempotency key (offline outbox entry id). At most one row per key.';
