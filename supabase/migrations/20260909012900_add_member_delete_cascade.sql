-- Drop existing constraints
ALTER TABLE expense_splits DROP CONSTRAINT IF EXISTS expense_splits_member_id_fkey;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_paid_by_member_id_fkey;
ALTER TABLE fund_transactions DROP CONSTRAINT IF EXISTS fund_transactions_member_id_fkey;

-- Re-add with ON DELETE CASCADE so deleting a trip (which deletes members) doesn't fail on member constraints
ALTER TABLE expense_splits 
  ADD CONSTRAINT expense_splits_member_id_fkey 
  FOREIGN KEY (member_id) REFERENCES trip_members(id) ON DELETE CASCADE;

ALTER TABLE expenses 
  ADD CONSTRAINT expenses_paid_by_member_id_fkey 
  FOREIGN KEY (paid_by_member_id) REFERENCES trip_members(id) ON DELETE CASCADE;

ALTER TABLE fund_transactions 
  ADD CONSTRAINT fund_transactions_member_id_fkey 
  FOREIGN KEY (member_id) REFERENCES trip_members(id) ON DELETE CASCADE;
