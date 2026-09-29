-- 1. Create the new expense_payers table
CREATE TABLE IF NOT EXISTS public.expense_payers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES public.trip_members(id) ON DELETE CASCADE,
    amount_paise BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Migrate existing data (for existing expenses paid by a single member)
INSERT INTO public.expense_payers (expense_id, member_id, amount_paise)
SELECT id, paid_by_member_id, amount_paise
FROM public.expenses
WHERE payment_source = 'MEMBER' AND paid_by_member_id IS NOT NULL;

-- 3. Enable RLS and add policies for expense_payers
ALTER TABLE public.expense_payers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON public.expense_payers
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON public.expense_payers
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.expense_payers
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON public.expense_payers
    FOR DELETE USING (auth.role() = 'authenticated');

-- 4. Update create_expense RPC to handle multiple payers
CREATE OR REPLACE FUNCTION public.create_expense(
    p_trip_id UUID,
    p_title TEXT,
    p_amount_paise BIGINT,
    p_expense_date DATE,
    p_payment_source TEXT,
    p_paid_by_member_id UUID,
    p_split_method TEXT,
    p_note TEXT,
    p_idempotency_key TEXT,
    p_splits JSONB,
    p_receipt_url TEXT DEFAULT NULL,
    p_is_paid BOOLEAN DEFAULT TRUE,
    p_category_id UUID DEFAULT NULL,
    p_payers JSONB DEFAULT NULL -- New argument for multiple payers
) RETURNS UUID AS $$
DECLARE
    v_expense_id UUID;
    v_split JSONB;
    v_payer JSONB;
BEGIN
    -- Idempotency check
    SELECT id INTO v_expense_id FROM public.expenses WHERE idempotency_key = p_idempotency_key;
    IF v_expense_id IS NOT NULL THEN
        RETURN v_expense_id;
    END IF;

    -- Insert expense
    INSERT INTO public.expenses (
        trip_id, title, amount_paise, expense_date, payment_source, paid_by_member_id,
        split_method, note, idempotency_key, created_by, receipt_url, is_paid, category_id
    ) VALUES (
        p_trip_id, p_title, p_amount_paise, p_expense_date, p_payment_source, p_paid_by_member_id,
        p_split_method, p_note, p_idempotency_key, auth.uid(), p_receipt_url, p_is_paid, p_category_id
    ) RETURNING id INTO v_expense_id;

    -- Insert splits
    FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
    LOOP
        INSERT INTO public.expense_splits (expense_id, member_id, amount_paise)
        VALUES (v_expense_id, (v_split->>'member_id')::UUID, (v_split->>'amount_paise')::BIGINT);
    END LOOP;

    -- Insert payers (if provided, else fallback to single payer)
    IF p_payers IS NOT NULL AND jsonb_array_length(p_payers) > 0 THEN
        FOR v_payer IN SELECT * FROM jsonb_array_elements(p_payers)
        LOOP
            INSERT INTO public.expense_payers (expense_id, member_id, amount_paise)
            VALUES (v_expense_id, (v_payer->>'member_id')::UUID, (v_payer->>'amount_paise')::BIGINT);
        END LOOP;
    ELSIF p_payment_source = 'MEMBER' AND p_paid_by_member_id IS NOT NULL THEN
        INSERT INTO public.expense_payers (expense_id, member_id, amount_paise)
        VALUES (v_expense_id, p_paid_by_member_id, p_amount_paise);
    END IF;

    RETURN v_expense_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Update update_expense RPC
CREATE OR REPLACE FUNCTION public.update_expense(
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
    p_category_id UUID DEFAULT NULL,
    p_payers JSONB DEFAULT NULL -- New argument for multiple payers
) RETURNS VOID AS $$
DECLARE
    v_split JSONB;
    v_payer JSONB;
BEGIN
    UPDATE public.expenses
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
        category_id = p_category_id,
        updated_at = NOW(),
        version = version + 1
    WHERE id = p_expense_id;

    -- Re-create splits
    DELETE FROM public.expense_splits WHERE expense_id = p_expense_id;
    FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
    LOOP
        INSERT INTO public.expense_splits (expense_id, member_id, amount_paise)
        VALUES (p_expense_id, (v_split->>'member_id')::UUID, (v_split->>'amount_paise')::BIGINT);
    END LOOP;

    -- Re-create payers
    DELETE FROM public.expense_payers WHERE expense_id = p_expense_id;
    IF p_payers IS NOT NULL AND jsonb_array_length(p_payers) > 0 THEN
        FOR v_payer IN SELECT * FROM jsonb_array_elements(p_payers)
        LOOP
            INSERT INTO public.expense_payers (expense_id, member_id, amount_paise)
            VALUES (p_expense_id, (v_payer->>'member_id')::UUID, (v_payer->>'amount_paise')::BIGINT);
        END LOOP;
    ELSIF p_payment_source = 'MEMBER' AND p_paid_by_member_id IS NOT NULL THEN
        INSERT INTO public.expense_payers (expense_id, member_id, amount_paise)
        VALUES (p_expense_id, p_paid_by_member_id, p_amount_paise);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
