-- 1. Add receipt_url to expenses table
ALTER TABLE expenses ADD COLUMN receipt_url TEXT;

-- 2. Update update_expense RPC to include receipt_url
CREATE OR REPLACE FUNCTION update_expense(
  p_expense_id UUID,
  p_title TEXT,
  p_amount_paise BIGINT,
  p_expense_date DATE,
  p_payment_source TEXT,
  p_paid_by_member_id UUID,
  p_split_method TEXT,
  p_note TEXT,
  p_splits JSONB, -- Array of { member_id, amount_paise }
  p_receipt_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_trip_id UUID;
  v_split JSONB;
BEGIN
  -- Verify the expense exists and the user has permission to update it
  -- (RLS on expenses table will apply to SELECT)
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
    receipt_url = p_receipt_url
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
    jsonb_build_object('title', p_title, 'amount_paise', p_amount_paise, 'splits', p_splits, 'receipt_url', p_receipt_url)
  );

  RETURN p_expense_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Create Storage bucket for receipts
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Set up Storage RLS Policies
-- Allow public access to read receipts
CREATE POLICY "Public Receipt Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipts');

-- Allow authenticated users to upload receipts
CREATE POLICY "Auth Receipt Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- Allow authenticated users to update their uploaded receipts
CREATE POLICY "Auth Receipt Update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'receipts');

-- Allow authenticated users to delete receipts
CREATE POLICY "Auth Receipt Delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'receipts');

-- 5. Update create_expense RPC to include receipt_url
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
  p_splits JSONB, -- Array of { member_id, amount_paise }
  p_receipt_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_expense_id UUID;
  v_split JSONB;
BEGIN
  -- Insert the expense
  INSERT INTO expenses (
    trip_id, title, amount_paise, expense_date, payment_source, paid_by_member_id, split_method, note, idempotency_key, created_by, receipt_url
  )
  VALUES (
    p_trip_id, p_title, p_amount_paise, p_expense_date, p_payment_source, p_paid_by_member_id, p_split_method, p_note, p_idempotency_key, auth.uid(), p_receipt_url
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
    jsonb_build_object('title', p_title, 'amount_paise', p_amount_paise, 'splits', p_splits, 'receipt_url', p_receipt_url)
  );

  RETURN v_expense_id;
END;
$$ LANGUAGE plpgsql;
