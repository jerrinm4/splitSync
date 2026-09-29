-- ============ TRIP MEMBERS ============
CREATE POLICY trip_members_owner_insert ON trip_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_members.trip_id AND trips.owner_id = auth.uid())
  );

CREATE POLICY trip_members_owner_update ON trip_members
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_members.trip_id AND trips.owner_id = auth.uid())
  );

-- ============ FUND TRANSACTIONS ============
-- Note: fund_transactions are written via RPC functions (add_funds / remove_funds)
-- which run as SECURITY DEFINER, so they bypass RLS. The INSERT policy here is
-- a belt-and-suspenders guard for direct inserts.
CREATE POLICY fund_tx_owner_insert ON fund_transactions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = fund_transactions.trip_id AND trips.owner_id = auth.uid())
    AND created_by = auth.uid()
  );

-- ============ EXPENSES ============
-- Note: expenses are written via RPC (create_expense / SECURITY DEFINER).
CREATE POLICY expenses_owner_insert ON expenses
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = expenses.trip_id AND trips.owner_id = auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY expenses_owner_update ON expenses
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = expenses.trip_id AND trips.owner_id = auth.uid())
  );

-- ============ EXPENSE SPLITS ============
-- Written as part of the create_expense RPC (SECURITY DEFINER), but guard direct inserts too.
CREATE POLICY splits_owner_insert ON expense_splits
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM expenses
      JOIN trips ON trips.id = expenses.trip_id
      WHERE expenses.id = expense_splits.expense_id
      AND trips.owner_id = auth.uid()
    )
  );

-- ============ AUDIT LOGS ============
CREATE POLICY audit_owner_insert ON audit_logs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = audit_logs.trip_id AND trips.owner_id = auth.uid())
    AND actor_user_id = auth.uid()
  );
