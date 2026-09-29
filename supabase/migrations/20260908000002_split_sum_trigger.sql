CREATE OR REPLACE FUNCTION check_expense_splits_sum()
RETURNS TRIGGER AS $$
DECLARE
  expense_total BIGINT;
  splits_total BIGINT;
BEGIN
  SELECT amount_paise INTO expense_total
  FROM expenses
  WHERE id = COALESCE(NEW.expense_id, OLD.expense_id);

  SELECT COALESCE(SUM(amount_paise), 0) INTO splits_total
  FROM expense_splits
  WHERE expense_id = COALESCE(NEW.expense_id, OLD.expense_id);

  IF splits_total <> expense_total THEN
    RAISE EXCEPTION 'Split amounts (%) do not equal expense amount (%)',
      splits_total, expense_total;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_check_splits_sum
AFTER INSERT OR UPDATE OR DELETE ON expense_splits
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_expense_splits_sum();
