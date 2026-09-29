ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============ TRIPS ============
CREATE POLICY trips_owner_select ON trips
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY trips_owner_insert ON trips
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY trips_owner_update ON trips
  FOR UPDATE USING (owner_id = auth.uid());

-- Shared read-only access (for public share links)
CREATE POLICY trips_shared_select ON trips
  FOR SELECT USING (
    share_enabled = TRUE
    AND share_token IS NOT NULL
    AND share_token = current_setting('request.headers', true)::json->>'x-share-token'
  );

-- ============ TRIP MEMBERS ============
CREATE POLICY trip_members_owner_select ON trip_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_members.trip_id AND trips.owner_id = auth.uid())
  );

-- ============ FUND TRANSACTIONS ============
CREATE POLICY fund_tx_owner_select ON fund_transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = fund_transactions.trip_id AND trips.owner_id = auth.uid())
  );

-- ============ EXPENSES ============
CREATE POLICY expenses_owner_select ON expenses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = expenses.trip_id AND trips.owner_id = auth.uid())
  );

-- ============ EXPENSE SPLITS ============
CREATE POLICY splits_owner_select ON expense_splits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM expenses
      JOIN trips ON trips.id = expenses.trip_id
      WHERE expenses.id = expense_splits.expense_id
      AND trips.owner_id = auth.uid()
    )
  );

-- ============ AUDIT LOGS ============
CREATE POLICY audit_owner_select ON audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = audit_logs.trip_id AND trips.owner_id = auth.uid())
  );
