-- Drop existing constraints
ALTER TABLE trip_members DROP CONSTRAINT IF EXISTS trip_members_trip_id_fkey;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_trip_id_fkey;
ALTER TABLE fund_transactions DROP CONSTRAINT IF EXISTS fund_transactions_trip_id_fkey;
ALTER TABLE expense_splits DROP CONSTRAINT IF EXISTS expense_splits_expense_id_fkey;

-- Re-add with ON DELETE CASCADE
ALTER TABLE trip_members 
  ADD CONSTRAINT trip_members_trip_id_fkey 
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;

ALTER TABLE expenses 
  ADD CONSTRAINT expenses_trip_id_fkey 
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;

ALTER TABLE fund_transactions 
  ADD CONSTRAINT fund_transactions_trip_id_fkey 
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;

ALTER TABLE expense_splits 
  ADD CONSTRAINT expense_splits_expense_id_fkey 
  FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE;

-- Add RLS Policy to allow trip deletion by the owner
DROP POLICY IF EXISTS "Users can delete their own trips" ON trips;

CREATE POLICY "Users can delete their own trips" 
  ON trips
  FOR DELETE
  USING (auth.uid() = owner_id);
