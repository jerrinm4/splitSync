-- Replace obsolete overloads so PostgREST resolves one expense API consistently.
DO $$
DECLARE fn regprocedure;
BEGIN
  FOR fn IN SELECT p.oid::regprocedure FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('create_expense', 'update_expense')
  LOOP EXECUTE format('DROP FUNCTION %s', fn); END LOOP;
END $$;

ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS rounding_mode text NOT NULL DEFAULT 'PAISE'
  CHECK (rounding_mode IN ('PAISE', 'FLOOR', 'CEIL'));
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS show_estimated_per_head boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS splits_shared_delete ON public.expense_splits;
DROP POLICY IF EXISTS expenses_shared_delete ON public.expenses;

CREATE OR REPLACE FUNCTION public.is_trip_admin(p_trip_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.trips t WHERE t.id = p_trip_id AND (
      t.owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.trip_admins a WHERE a.trip_id = t.id AND a.user_id = auth.uid()
      )
    )
  );
$$;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.expense_payers;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.expense_payers;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.expense_payers;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.expense_payers;
CREATE POLICY payers_read ON public.expense_payers FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = expense_payers.expense_id)
);
CREATE POLICY payers_insert ON public.expense_payers FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = expense_payers.expense_id AND public.is_trip_admin(e.trip_id))
);
CREATE POLICY payers_update ON public.expense_payers FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = expense_payers.expense_id AND public.is_trip_admin(e.trip_id))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = expense_payers.expense_id AND public.is_trip_admin(e.trip_id))
);
CREATE POLICY payers_delete ON public.expense_payers FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = expense_payers.expense_id AND public.is_trip_admin(e.trip_id))
);
GRANT SELECT ON public.expense_payers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.expense_payers TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.expense_payers FROM anon;

CREATE OR REPLACE FUNCTION public.validate_expense_input(
  p_trip_id uuid, p_amount bigint, p_splits jsonb, p_payers jsonb, p_category_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE shares jsonb; item jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_trip_admin(p_trip_id) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 9007199254740991 THEN
    RAISE EXCEPTION 'Invalid expense amount';
  END IF;
  IF p_category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.expense_categories WHERE id = p_category_id AND trip_id = p_trip_id
  ) THEN RAISE EXCEPTION 'Category must belong to this trip'; END IF;

  FOREACH shares IN ARRAY ARRAY[p_splits, p_payers] LOOP
    IF shares IS NULL THEN CONTINUE; END IF;
    IF jsonb_typeof(shares) <> 'array' OR jsonb_array_length(shares) = 0 THEN
      RAISE EXCEPTION 'At least one member is required';
    END IF;
    IF (SELECT count(*) <> count(DISTINCT value->>'member_id') FROM jsonb_array_elements(shares)) THEN
      RAISE EXCEPTION 'Duplicate member shares';
    END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(shares) LOOP
      IF NOT COALESCE((item->>'amount_paise') ~ '^[0-9]+$', false)
        OR COALESCE((item->>'amount_paise')::bigint, 0) <= 0 THEN
        RAISE EXCEPTION 'Shares must be positive integer paise';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.trip_members WHERE id = (item->>'member_id')::uuid AND trip_id = p_trip_id) THEN
        RAISE EXCEPTION 'Members must belong to this trip';
      END IF;
    END LOOP;
    IF (SELECT sum((value->>'amount_paise')::bigint) FROM jsonb_array_elements(shares)) <> p_amount THEN
      RAISE EXCEPTION 'Shares must equal the expense amount';
    END IF;
  END LOOP;
  IF p_splits IS NULL THEN RAISE EXCEPTION 'Expense splits are required'; END IF;
END;
$$;

CREATE FUNCTION public.create_expense(
  p_trip_id uuid, p_title text, p_amount_paise bigint, p_expense_date date,
  p_payment_source text, p_paid_by_member_id uuid, p_split_method text, p_note text,
  p_idempotency_key uuid, p_splits jsonb, p_receipt_url text DEFAULT NULL,
  p_is_paid boolean DEFAULT true, p_category_id uuid DEFAULT NULL, p_payers jsonb DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_id uuid; v_payers jsonb; v_payer uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_trip_admin(p_trip_id) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.trips WHERE id = p_trip_id FOR UPDATE;
  SELECT id INTO v_id FROM public.expenses WHERE trip_id = p_trip_id AND idempotency_key = p_idempotency_key;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  IF p_payment_source = 'MEMBER' THEN
    v_payers := COALESCE(NULLIF(p_payers, '[]'::jsonb), jsonb_build_array(jsonb_build_object('member_id', p_paid_by_member_id, 'amount_paise', p_amount_paise)));
    v_payer := (v_payers->0->>'member_id')::uuid;
  END IF;
  PERFORM public.validate_expense_input(p_trip_id, p_amount_paise, p_splits, v_payers, p_category_id);
  INSERT INTO public.expenses (trip_id, title, amount_paise, expense_date, payment_source, paid_by_member_id,
    split_method, note, idempotency_key, created_by, receipt_url, is_paid, category_id)
  VALUES (p_trip_id, trim(p_title), p_amount_paise, p_expense_date, p_payment_source, v_payer,
    p_split_method, p_note, p_idempotency_key, auth.uid(), p_receipt_url, p_is_paid, p_category_id)
  RETURNING id INTO v_id;
  INSERT INTO public.expense_splits (expense_id, member_id, amount_paise)
    SELECT v_id, (value->>'member_id')::uuid, (value->>'amount_paise')::bigint FROM jsonb_array_elements(p_splits);
  INSERT INTO public.expense_payers (expense_id, member_id, amount_paise)
    SELECT v_id, (value->>'member_id')::uuid, (value->>'amount_paise')::bigint FROM jsonb_array_elements(v_payers);
  INSERT INTO public.audit_logs (trip_id, actor_user_id, entity_type, entity_id, action, after_data)
    VALUES (p_trip_id, auth.uid(), 'EXPENSE', v_id, 'CREATE', jsonb_build_object('title', p_title, 'amount_paise', p_amount_paise));
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.update_expense(
  p_expense_id uuid, p_title text, p_amount_paise bigint, p_expense_date date,
  p_payment_source text, p_paid_by_member_id uuid, p_split_method text, p_note text, p_splits jsonb,
  p_receipt_url text DEFAULT NULL, p_is_paid boolean DEFAULT true, p_category_id uuid DEFAULT NULL,
  p_payers jsonb DEFAULT NULL, p_expected_version integer DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_expense public.expenses; v_payers jsonb; v_payer uuid;
BEGIN
  SELECT * INTO v_expense FROM public.expenses WHERE id = p_expense_id FOR UPDATE;
  IF NOT FOUND OR auth.uid() IS NULL OR NOT public.is_trip_admin(v_expense.trip_id) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;
  IF p_expected_version IS NOT NULL AND v_expense.version <> p_expected_version THEN
    RAISE EXCEPTION 'This expense was changed by someone else. Reload before editing.' USING ERRCODE = '40001';
  END IF;
  IF p_payment_source = 'MEMBER' THEN
    v_payers := COALESCE(NULLIF(p_payers, '[]'::jsonb), jsonb_build_array(jsonb_build_object('member_id', p_paid_by_member_id, 'amount_paise', p_amount_paise)));
    v_payer := (v_payers->0->>'member_id')::uuid;
  END IF;
  PERFORM public.validate_expense_input(v_expense.trip_id, p_amount_paise, p_splits, v_payers, p_category_id);
  UPDATE public.expenses SET title = trim(p_title), amount_paise = p_amount_paise, expense_date = p_expense_date,
    payment_source = p_payment_source, paid_by_member_id = v_payer, split_method = p_split_method,
    note = p_note, receipt_url = p_receipt_url, is_paid = p_is_paid, category_id = p_category_id,
    version = version + 1 WHERE id = p_expense_id;
  DELETE FROM public.expense_splits WHERE expense_id = p_expense_id;
  INSERT INTO public.expense_splits (expense_id, member_id, amount_paise)
    SELECT p_expense_id, (value->>'member_id')::uuid, (value->>'amount_paise')::bigint FROM jsonb_array_elements(p_splits);
  DELETE FROM public.expense_payers WHERE expense_id = p_expense_id;
  INSERT INTO public.expense_payers (expense_id, member_id, amount_paise)
    SELECT p_expense_id, (value->>'member_id')::uuid, (value->>'amount_paise')::bigint FROM jsonb_array_elements(v_payers);
  INSERT INTO public.audit_logs (trip_id, actor_user_id, entity_type, entity_id, action, before_data, after_data)
    VALUES (v_expense.trip_id, auth.uid(), 'EXPENSE', p_expense_id, 'UPDATE', to_jsonb(v_expense), jsonb_build_object('title', p_title, 'amount_paise', p_amount_paise));
END;
$$;

-- Definer functions remain callable only by signed-in users, except the public PIN check.
DO $$
DECLARE fn regprocedure;
BEGIN
  FOR fn IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN (
      'create_expense', 'update_expense', 'validate_expense_input', 'add_trip_admin_by_email',
      'get_trip_admins', 'get_trip_owner', 'get_trip_audit_logs', 'add_funds', 'remove_funds'
    )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

-- Receipt URLs remain public; mutations are limited to a trip's owner and admins.
DROP POLICY IF EXISTS "Auth Receipt Upload" ON storage.objects;
DROP POLICY IF EXISTS "Auth Receipt Update" ON storage.objects;
DROP POLICY IF EXISTS "Auth Receipt Delete" ON storage.objects;
CREATE POLICY receipt_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'receipts' AND EXISTS (SELECT 1 FROM public.trips t WHERE t.id::text = (storage.foldername(storage.objects.name))[1] AND public.is_trip_admin(t.id))
);
CREATE POLICY receipt_update ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'receipts' AND EXISTS (SELECT 1 FROM public.trips t WHERE t.id::text = (storage.foldername(storage.objects.name))[1] AND public.is_trip_admin(t.id))
) WITH CHECK (
  bucket_id = 'receipts' AND EXISTS (SELECT 1 FROM public.trips t WHERE t.id::text = (storage.foldername(storage.objects.name))[1] AND public.is_trip_admin(t.id))
);
CREATE POLICY receipt_delete ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'receipts' AND EXISTS (SELECT 1 FROM public.trips t WHERE t.id::text = (storage.foldername(storage.objects.name))[1] AND public.is_trip_admin(t.id))
);
