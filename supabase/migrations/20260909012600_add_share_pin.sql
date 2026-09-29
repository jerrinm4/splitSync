-- 1. Add the share_pin column
ALTER TABLE trips ADD COLUMN IF NOT EXISTS share_pin TEXT;

-- 2. Create helper to get pin from headers
CREATE OR REPLACE FUNCTION get_share_pin()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.headers', true)::json->>'x-share-pin',
    ''
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Update the main trips shared policy
DROP POLICY IF EXISTS trips_shared_select ON trips;
CREATE POLICY trips_shared_select ON trips
  FOR SELECT USING (
    share_enabled = TRUE
    AND share_token IS NOT NULL
    AND share_token = COALESCE(current_setting('request.headers', true)::json->>'x-share-token', '')
    AND (share_pin IS NULL OR share_pin = get_share_pin())
  );

-- 4. Update child table policies to also enforce the PIN
DROP POLICY IF EXISTS trip_members_shared_select ON trip_members;
CREATE POLICY trip_members_shared_select ON trip_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_members.trip_id
      AND trips.share_enabled = TRUE
      AND trips.share_token = get_share_token()
      AND (trips.share_pin IS NULL OR trips.share_pin = get_share_pin())
    )
  );

DROP POLICY IF EXISTS fund_tx_shared_select ON fund_transactions;
CREATE POLICY fund_tx_shared_select ON fund_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = fund_transactions.trip_id
      AND trips.share_enabled = TRUE
      AND trips.share_token = get_share_token()
      AND (trips.share_pin IS NULL OR trips.share_pin = get_share_pin())
    )
  );

DROP POLICY IF EXISTS expenses_shared_select ON expenses;
CREATE POLICY expenses_shared_select ON expenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = expenses.trip_id
      AND trips.share_enabled = TRUE
      AND trips.share_token = get_share_token()
      AND (trips.share_pin IS NULL OR trips.share_pin = get_share_pin())
    )
  );

DROP POLICY IF EXISTS splits_shared_select ON expense_splits;
CREATE POLICY splits_shared_select ON expense_splits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM expenses
      JOIN trips ON trips.id = expenses.trip_id
      WHERE expenses.id = expense_splits.expense_id
      AND trips.share_enabled = TRUE
      AND trips.share_token = get_share_token()
      AND (trips.share_pin IS NULL OR trips.share_pin = get_share_pin())
    )
  );

DROP POLICY IF EXISTS audit_shared_select ON audit_logs;
CREATE POLICY audit_shared_select ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = audit_logs.trip_id
      AND trips.share_enabled = TRUE
      AND trips.share_token = get_share_token()
      AND (trips.share_pin IS NULL OR trips.share_pin = get_share_pin())
    )
  );

-- 5. Create an RPC function to check if a PIN is required before accessing
CREATE OR REPLACE FUNCTION check_trip_pin_required(p_share_token TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_pin BOOLEAN;
BEGIN
    SELECT (share_pin IS NOT NULL) INTO v_has_pin
    FROM trips
    WHERE share_token = p_share_token AND share_enabled = TRUE;
    
    -- If the trip doesn't exist or isn't shared, we can return false or throw. 
    -- Returning false is fine, the subsequent fetch will just fail.
    RETURN COALESCE(v_has_pin, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
