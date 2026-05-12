-- INSERT ... RETURNING uses SELECT visibility. Some roles could INSERT (WITH CHECK) but not see the
-- new row under the hierarchical policy alone, yielding an empty body and PGRST116 with `.single()`.
-- Users retried and duplicated rows (notably urea at P004P). Permissive OR: authors can always read
-- rows they created.

DROP POLICY IF EXISTS "Diesel transactions author can read own inserts" ON public.diesel_transactions;

CREATE POLICY "Diesel transactions author can read own inserts"
  ON public.diesel_transactions
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

COMMENT ON POLICY "Diesel transactions author can read own inserts" ON public.diesel_transactions IS
  'Ensures INSERT RETURNING sees the new row when hierarchical SELECT is too narrow; prevents duplicate retries.';
