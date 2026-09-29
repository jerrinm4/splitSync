CREATE OR REPLACE FUNCTION update_expense(
  p_expense_id UUID,
  p_title TEXT,
  p_amount_paise BIGINT,
  p_expense_date DATE,
  p_payment_source TEXT,
  p_paid_by_member_id UUID,
  p_split_method TEXT,
  p_note TEXT,
  p_splits JSONB -- Array of { member_id, amount_paise }
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
    note = p_note
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
    jsonb_build_object('title', p_title, 'amount_paise', p_amount_paise, 'splits', p_splits)
  );

  RETURN p_expense_id;
END;
$$ LANGUAGE plpgsql;
