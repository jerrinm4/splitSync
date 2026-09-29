CREATE OR REPLACE FUNCTION get_share_token()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.headers', true)::json->>'x-share-token',
    ''
  );
END;
$$ LANGUAGE plpgsql STABLE;

CREATE POLICY trip_members_shared_select ON trip_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = trip_members.trip_id
      AND trips.share_enabled = TRUE
      AND trips.share_token = get_share_token()
    )
  );

CREATE POLICY fund_tx_shared_select ON fund_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = fund_transactions.trip_id
      AND trips.share_enabled = TRUE
      AND trips.share_token = get_share_token()
    )
  );

CREATE POLICY expenses_shared_select ON expenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = expenses.trip_id
      AND trips.share_enabled = TRUE
      AND trips.share_token = get_share_token()
    )
  );

CREATE POLICY splits_shared_select ON expense_splits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM expenses
      JOIN trips ON trips.id = expenses.trip_id
      WHERE expenses.id = expense_splits.expense_id
      AND trips.share_enabled = TRUE
      AND trips.share_token = get_share_token()
    )
  );

CREATE POLICY audit_shared_select ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = audit_logs.trip_id
      AND trips.share_enabled = TRUE
      AND trips.share_token = get_share_token()
    )
  );
