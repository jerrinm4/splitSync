CREATE OR REPLACE FUNCTION public.check_trip_references()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_trip uuid;
BEGIN
  IF TG_TABLE_NAME IN ('expense_splits', 'expense_payers') THEN
    SELECT trip_id INTO v_trip FROM public.expenses WHERE id = NEW.expense_id;
  ELSE v_trip := NEW.trip_id; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.trip_members WHERE id = NEW.member_id AND trip_id = v_trip) THEN
    RAISE EXCEPTION 'Members must belong to this trip';
  END IF;
  IF NEW.amount_paise <= 0 OR NEW.amount_paise > 9007199254740991 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER validate_split_trip BEFORE INSERT OR UPDATE ON public.expense_splits
  FOR EACH ROW EXECUTE FUNCTION public.check_trip_references();
CREATE TRIGGER validate_payer_trip BEFORE INSERT OR UPDATE ON public.expense_payers
  FOR EACH ROW EXECUTE FUNCTION public.check_trip_references();
CREATE TRIGGER validate_fund_trip BEFORE INSERT OR UPDATE ON public.fund_transactions
  FOR EACH ROW EXECUTE FUNCTION public.check_trip_references();

CREATE OR REPLACE FUNCTION public.protect_member_history()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  -- A whole-trip deletion can still cascade; individual deletion must keep its ledger intact.
  IF EXISTS (SELECT 1 FROM public.trips WHERE id = OLD.trip_id) AND (
    EXISTS (SELECT 1 FROM public.expense_splits WHERE member_id = OLD.id) OR
    EXISTS (SELECT 1 FROM public.expense_payers WHERE member_id = OLD.id) OR
    EXISTS (SELECT 1 FROM public.expenses WHERE paid_by_member_id = OLD.id) OR
    EXISTS (SELECT 1 FROM public.fund_transactions WHERE member_id = OLD.id)
  ) THEN RAISE EXCEPTION 'This member has financial history. Disable the member instead.'; END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER protect_member_history BEFORE DELETE ON public.trip_members
  FOR EACH ROW EXECUTE FUNCTION public.protect_member_history();

CREATE OR REPLACE FUNCTION public.protect_trip_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Trip ownership cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_trip_owner BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.protect_trip_owner();

CREATE OR REPLACE FUNCTION public.remove_funds(
  p_trip_id uuid, p_member_id uuid, p_amount_paise bigint, p_note text, p_idempotency_key uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_id uuid; v_balance bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_trip_admin(p_trip_id) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  SELECT id INTO v_id FROM public.fund_transactions WHERE trip_id = p_trip_id AND idempotency_key = p_idempotency_key;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  SELECT COALESCE(sum(CASE WHEN transaction_type = 'ADD' THEN amount_paise ELSE -amount_paise END), 0)
    INTO v_balance FROM public.fund_transactions WHERE trip_id = p_trip_id AND status = 'ACTIVE';
  SELECT v_balance - COALESCE(sum(amount_paise), 0) INTO v_balance FROM public.expenses
    WHERE trip_id = p_trip_id AND status = 'ACTIVE' AND payment_source = 'TRIP_WALLET' AND is_paid;
  IF p_amount_paise > v_balance THEN RAISE EXCEPTION 'Insufficient funds in trip wallet'; END IF;
  INSERT INTO public.fund_transactions(trip_id, member_id, transaction_type, amount_paise, note, idempotency_key, created_by)
    VALUES (p_trip_id, p_member_id, 'REMOVE', p_amount_paise, p_note, p_idempotency_key, auth.uid()) RETURNING id INTO v_id;
  INSERT INTO public.audit_logs(trip_id, actor_user_id, entity_type, entity_id, action, after_data)
    VALUES (p_trip_id, auth.uid(), 'FUND_TRANSACTION', v_id, 'REMOVE_FUNDS', jsonb_build_object('amount_paise', p_amount_paise, 'note', p_note));
  RETURN v_id;
END;
$$;
