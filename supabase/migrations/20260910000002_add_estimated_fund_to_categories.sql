-- Add estimated_amount_paise to expense_categories
ALTER TABLE expense_categories
  ADD COLUMN estimated_amount_paise BIGINT NOT NULL DEFAULT 0;
