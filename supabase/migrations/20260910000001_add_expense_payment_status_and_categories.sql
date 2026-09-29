-- ============================================================
-- 1. Expense Categories table
-- ============================================================
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) > 0),
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expense_categories_trip ON expense_categories(trip_id);

-- ============================================================
-- 2. Add is_paid and category_id columns to expenses
-- ============================================================
ALTER TABLE expenses
  ADD COLUMN is_paid BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE expenses
  ADD COLUMN category_id UUID REFERENCES expense_categories(id) ON DELETE SET NULL;

CREATE INDEX idx_expenses_category ON expenses(category_id);

-- ============================================================
-- 3. RLS policies for expense_categories
-- ============================================================
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

-- Owner can do everything
CREATE POLICY "Trip owner full access to categories"
  ON expense_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = expense_categories.trip_id
        AND trips.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = expense_categories.trip_id
        AND trips.owner_id = auth.uid()
    )
  );

-- Shared link read access
CREATE POLICY "Shared link read access to categories"
  ON expense_categories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM trips
      WHERE trips.id = expense_categories.trip_id
        AND trips.share_enabled = TRUE
        AND trips.share_token = current_setting('request.headers', true)::json->>'x-share-token'
    )
  );

-- ============================================================
-- 4. Update create_expense RPC
-- ============================================================
CREATE OR REPLACE FUNCTION create_expense(
  p_trip_id UUID,
  p_title TEXT,
  p_amount_paise BIGINT,
  p_expense_date DATE,
  p_payment_source TEXT,
  p_paid_by_member_id UUID,
  p_split_method TEXT,
  p_note TEXT,
  p_idempotency_key UUID,
  p_splits JSONB,
  p_receipt_url TEXT DEFAULT NULL,
  p_is_paid BOOLEAN DEFAULT TRUE,
  p_category_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_expense_id UUID;
  v_split JSONB;
BEGIN
  -- Insert the expense
  INSERT INTO expenses (
    trip_id, title, amount_paise, expense_date, payment_source,
    paid_by_member_id, split_method, note, idempotency_key, created_by,
    receipt_url, is_paid, category_id
  )
  VALUES (
    p_trip_id, p_title, p_amount_paise, p_expense_date, p_payment_source,
    p_paid_by_member_id, p_split_method, p_note, p_idempotency_key, auth.uid(),
    p_receipt_url, p_is_paid, p_category_id
  )
  RETURNING id INTO v_expense_id;

  -- Insert the splits
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    INSERT INTO expense_splits (
      expense_id, member_id, amount_paise
    )
    VALUES (
      v_expense_id, (v_split->>'member_id')::UUID, (v_split->>'amount_paise')::BIGINT
    );
  END LOOP;

  -- Insert audit log
  INSERT INTO audit_logs (trip_id, actor_user_id, entity_type, entity_id, action, after_data)
  VALUES (
    p_trip_id, auth.uid(), 'EXPENSE', v_expense_id, 'CREATE',
    jsonb_build_object('title', p_title, 'amount_paise', p_amount_paise, 'splits', p_splits, 'is_paid', p_is_paid)
  );

  RETURN v_expense_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. Update update_expense RPC
-- ============================================================
CREATE OR REPLACE FUNCTION update_expense(
  p_expense_id UUID,
  p_title TEXT,
  p_amount_paise BIGINT,
  p_expense_date DATE,
  p_payment_source TEXT,
  p_paid_by_member_id UUID,
  p_split_method TEXT,
  p_note TEXT,
  p_splits JSONB,
  p_receipt_url TEXT DEFAULT NULL,
  p_is_paid BOOLEAN DEFAULT TRUE,
  p_category_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_trip_id UUID;
  v_split JSONB;
BEGIN
  SELECT trip_id INTO v_trip_id FROM expenses WHERE id = p_expense_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expense not found';
  END IF;

  -- Update the main expense record
  UPDATE expenses
  SET
    title = p_title,
    amount_paise = p_amount_paise,
    expense_date = p_expense_date,
    payment_source = p_payment_source,
    paid_by_member_id = p_paid_by_member_id,
    split_method = p_split_method,
    note = p_note,
    receipt_url = p_receipt_url,
    is_paid = p_is_paid,
    category_id = p_category_id
  WHERE id = p_expense_id;

  -- Delete old splits
  DELETE FROM expense_splits WHERE expense_id = p_expense_id;

  -- Insert the new splits
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
  LOOP
    INSERT INTO expense_splits (
      expense_id, member_id, amount_paise
    )
    VALUES (
      p_expense_id, (v_split->>'member_id')::UUID, (v_split->>'amount_paise')::BIGINT
    );
  END LOOP;

  -- Insert audit log
  INSERT INTO audit_logs (trip_id, actor_user_id, entity_type, entity_id, action, after_data)
  VALUES (
    v_trip_id, auth.uid(), 'EXPENSE', p_expense_id, 'UPDATE',
    jsonb_build_object('title', p_title, 'amount_paise', p_amount_paise, 'splits', p_splits, 'is_paid', p_is_paid)
  );

  RETURN p_expense_id;
END;
$$ LANGUAGE plpgsql;
