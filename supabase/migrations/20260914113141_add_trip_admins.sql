CREATE TABLE trip_admins (
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, user_id)
);

CREATE INDEX idx_trip_admins_trip ON trip_admins(trip_id);
CREATE INDEX idx_trip_admins_user ON trip_admins(user_id);

ALTER TABLE trip_admins ENABLE ROW LEVEL SECURITY;

-- Helper function to check if a user has full access to a trip (owner or admin)
CREATE OR REPLACE FUNCTION is_trip_admin(p_trip_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM trips 
    WHERE trips.id = p_trip_id 
    AND (
      trips.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM trip_admins WHERE trip_id = p_trip_id AND user_id = auth.uid())
    )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Admins can view the admins list
CREATE POLICY trip_admins_select ON trip_admins
  FOR SELECT USING (is_trip_admin(trip_id));

-- Only owners can modify admins
CREATE POLICY trip_admins_insert ON trip_admins
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_admins.trip_id AND trips.owner_id = auth.uid())
  );

CREATE POLICY trip_admins_delete ON trip_admins
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_admins.trip_id AND trips.owner_id = auth.uid())
  );

-- ==========================================
-- UPDATE EXISTING RLS POLICIES
-- ==========================================

-- Trips
DROP POLICY IF EXISTS trips_owner_select ON trips;
CREATE POLICY trips_owner_select ON trips
  FOR SELECT USING (is_trip_admin(id));

DROP POLICY IF EXISTS trips_owner_update ON trips;
CREATE POLICY trips_owner_update ON trips
  FOR UPDATE USING (is_trip_admin(id));

-- Trip Members
DROP POLICY IF EXISTS trip_members_owner_select ON trip_members;
CREATE POLICY trip_members_owner_select ON trip_members
  FOR SELECT USING (is_trip_admin(trip_id));

DROP POLICY IF EXISTS trip_members_owner_insert ON trip_members;
CREATE POLICY trip_members_owner_insert ON trip_members
  FOR INSERT WITH CHECK (is_trip_admin(trip_id));

DROP POLICY IF EXISTS trip_members_owner_update ON trip_members;
CREATE POLICY trip_members_owner_update ON trip_members
  FOR UPDATE USING (is_trip_admin(trip_id));

DROP POLICY IF EXISTS trip_members_owner_delete ON trip_members;
CREATE POLICY trip_members_owner_delete ON trip_members
  FOR DELETE USING (is_trip_admin(trip_id));

-- Fund Transactions
DROP POLICY IF EXISTS fund_tx_owner_select ON fund_transactions;
CREATE POLICY fund_tx_owner_select ON fund_transactions
  FOR SELECT USING (is_trip_admin(trip_id));

DROP POLICY IF EXISTS fund_tx_owner_insert ON fund_transactions;
CREATE POLICY fund_tx_owner_insert ON fund_transactions
  FOR INSERT WITH CHECK (is_trip_admin(trip_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS fund_tx_owner_delete ON fund_transactions;
CREATE POLICY fund_tx_owner_delete ON fund_transactions
  FOR DELETE USING (is_trip_admin(trip_id));

-- Expenses
DROP POLICY IF EXISTS expenses_owner_select ON expenses;
CREATE POLICY expenses_owner_select ON expenses
  FOR SELECT USING (is_trip_admin(trip_id));

DROP POLICY IF EXISTS expenses_owner_insert ON expenses;
CREATE POLICY expenses_owner_insert ON expenses
  FOR INSERT WITH CHECK (is_trip_admin(trip_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS expenses_owner_update ON expenses;
CREATE POLICY expenses_owner_update ON expenses
  FOR UPDATE USING (is_trip_admin(trip_id));

DROP POLICY IF EXISTS expenses_owner_delete ON expenses;
CREATE POLICY expenses_owner_delete ON expenses
  FOR DELETE USING (is_trip_admin(trip_id));

-- Expense Splits
DROP POLICY IF EXISTS splits_owner_select ON expense_splits;
CREATE POLICY splits_owner_select ON expense_splits
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM expenses WHERE id = expense_splits.expense_id AND is_trip_admin(trip_id))
  );

DROP POLICY IF EXISTS splits_owner_insert ON expense_splits;
CREATE POLICY splits_owner_insert ON expense_splits
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM expenses WHERE id = expense_splits.expense_id AND is_trip_admin(trip_id))
  );

DROP POLICY IF EXISTS splits_owner_delete ON expense_splits;
CREATE POLICY splits_owner_delete ON expense_splits
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM expenses WHERE id = expense_splits.expense_id AND is_trip_admin(trip_id))
  );

-- Audit Logs
DROP POLICY IF EXISTS audit_owner_select ON audit_logs;
CREATE POLICY audit_owner_select ON audit_logs
  FOR SELECT USING (is_trip_admin(trip_id));

DROP POLICY IF EXISTS audit_owner_insert ON audit_logs;
CREATE POLICY audit_owner_insert ON audit_logs
  FOR INSERT WITH CHECK (is_trip_admin(trip_id) AND actor_user_id = auth.uid());

-- Expense Categories
DROP POLICY IF EXISTS categories_owner_select ON expense_categories;
CREATE POLICY categories_owner_select ON expense_categories
  FOR SELECT USING (is_trip_admin(trip_id));

DROP POLICY IF EXISTS categories_owner_insert ON expense_categories;
CREATE POLICY categories_owner_insert ON expense_categories
  FOR INSERT WITH CHECK (is_trip_admin(trip_id));

DROP POLICY IF EXISTS categories_owner_update ON expense_categories;
CREATE POLICY categories_owner_update ON expense_categories
  FOR UPDATE USING (is_trip_admin(trip_id));

DROP POLICY IF EXISTS categories_owner_delete ON expense_categories;
CREATE POLICY categories_owner_delete ON expense_categories
  FOR DELETE USING (is_trip_admin(trip_id));


-- ==========================================
-- RPC FUNCTIONS
-- ==========================================

-- Function to add admin by email
CREATE OR REPLACE FUNCTION add_trip_admin_by_email(p_trip_id UUID, p_email TEXT)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_owner_id UUID;
BEGIN
  -- Verify caller is the owner
  SELECT owner_id INTO v_owner_id FROM trips WHERE id = p_trip_id;
  IF v_owner_id IS NULL OR v_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the trip owner can add admins.';
  END IF;

  -- Look up user by email in auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with this email not found.';
  END IF;
  
  IF v_user_id = v_owner_id THEN
    RAISE EXCEPTION 'Cannot add the trip owner as an admin.';
  END IF;

  -- Insert (ignore if already exists)
  INSERT INTO trip_admins (trip_id, user_id)
  VALUES (p_trip_id, v_user_id)
  ON CONFLICT DO NOTHING;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function to fetch admins with their emails (since auth.users is restricted)
CREATE OR REPLACE FUNCTION get_trip_admins(p_trip_id UUID)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Check access
  IF NOT is_trip_admin(p_trip_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    ta.user_id,
    au.email::TEXT,
    ta.created_at
  FROM trip_admins ta
  JOIN auth.users au ON au.id = ta.user_id
  WHERE ta.trip_id = p_trip_id
  ORDER BY ta.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get the owner email
CREATE OR REPLACE FUNCTION get_trip_owner(p_trip_id UUID)
RETURNS TABLE (
  owner_id UUID,
  email TEXT
) AS $$
BEGIN
  IF NOT is_trip_admin(p_trip_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    t.owner_id,
    au.email::TEXT
  FROM trips t
  JOIN auth.users au ON au.id = t.owner_id
  WHERE t.id = p_trip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
