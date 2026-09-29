CREATE OR REPLACE FUNCTION add_funds(
  p_trip_id UUID,
  p_member_id UUID,
  p_amount_paise BIGINT,
  p_note TEXT,
  p_idempotency_key UUID
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
BEGIN
  -- Insert the fund transaction
  INSERT INTO fund_transactions (
    trip_id, member_id, transaction_type, amount_paise, note, idempotency_key, created_by
  )
  VALUES (
    p_trip_id, p_member_id, 'ADD', p_amount_paise, p_note, p_idempotency_key, auth.uid()
  )
  RETURNING id INTO v_transaction_id;

  -- Insert audit log
  INSERT INTO audit_logs (trip_id, actor_user_id, entity_type, entity_id, action, after_data)
  VALUES (
    p_trip_id, auth.uid(), 'FUND_TRANSACTION', v_transaction_id, 'ADD_FUNDS',
    jsonb_build_object('amount_paise', p_amount_paise, 'note', p_note)
  );

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION remove_funds(
  p_trip_id UUID,
  p_member_id UUID,
  p_amount_paise BIGINT,
  p_note TEXT,
  p_idempotency_key UUID
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  v_current_balance BIGINT;
BEGIN
  -- Calculate current balance
  SELECT
    COALESCE(SUM(CASE WHEN transaction_type = 'ADD' THEN amount_paise ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN transaction_type = 'REMOVE' THEN amount_paise ELSE 0 END), 0)
  INTO v_current_balance
  FROM fund_transactions
  WHERE trip_id = p_trip_id;

  IF v_current_balance < p_amount_paise THEN
    RAISE EXCEPTION 'Insufficient funds in trip wallet (Current: %, Requested: %)', v_current_balance, p_amount_paise;
  END IF;

  -- Insert the fund transaction
  INSERT INTO fund_transactions (
    trip_id, member_id, transaction_type, amount_paise, note, idempotency_key, created_by
  )
  VALUES (
    p_trip_id, p_member_id, 'REMOVE', p_amount_paise, p_note, p_idempotency_key, auth.uid()
  )
  RETURNING id INTO v_transaction_id;

  -- Insert audit log
  INSERT INTO audit_logs (trip_id, actor_user_id, entity_type, entity_id, action, after_data)
  VALUES (
    p_trip_id, auth.uid(), 'FUND_TRANSACTION', v_transaction_id, 'REMOVE_FUNDS',
    jsonb_build_object('amount_paise', p_amount_paise, 'note', p_note)
  );

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

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
  p_splits JSONB -- Array of { member_id, amount_paise }
)
RETURNS UUID AS $$
DECLARE
  v_expense_id UUID;
  v_split JSONB;
BEGIN
  -- Insert the expense
  INSERT INTO expenses (
    trip_id, title, amount_paise, expense_date, payment_source, paid_by_member_id, split_method, note, idempotency_key, created_by
  )
  VALUES (
    p_trip_id, p_title, p_amount_paise, p_expense_date, p_payment_source, p_paid_by_member_id, p_split_method, p_note, p_idempotency_key, auth.uid()
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
    jsonb_build_object('title', p_title, 'amount_paise', p_amount_paise, 'splits', p_splits)
  );

  RETURN v_expense_id;
END;
$$ LANGUAGE plpgsql;
