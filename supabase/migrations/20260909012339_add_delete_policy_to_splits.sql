-- Add DELETE policies to allow owners to manage their data properly

-- 1. expense_splits: allow owner of the trip to delete splits
CREATE POLICY splits_owner_delete ON expense_splits
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM expenses
      JOIN trips ON trips.id = expenses.trip_id
      WHERE expenses.id = expense_splits.expense_id
      AND trips.owner_id = auth.uid()
    )
  );

-- 2. expenses: allow owner to delete their expenses
CREATE POLICY expenses_owner_delete ON expenses
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = expenses.trip_id AND trips.owner_id = auth.uid())
  );

-- 3. trip_members: allow owner to delete members (if no expenses/funds are tied)
CREATE POLICY trip_members_owner_delete ON trip_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM trips WHERE trips.id = trip_members.trip_id AND trips.owner_id = auth.uid())
  );

-- Note: Because expense_splits has `ON DELETE RESTRICT` to expenses, we should change it to `ON DELETE CASCADE`
-- or delete splits manually before deleting the expense. We will change it to CASCADE so deleting an expense cleans up splits.
ALTER TABLE expense_splits
  DROP CONSTRAINT expense_splits_expense_id_fkey,
  ADD CONSTRAINT expense_splits_expense_id_fkey
    FOREIGN KEY (expense_id)
    REFERENCES expenses(id)
    ON DELETE CASCADE;

-- Also need to allow the update_expense RPC to actually run its DELETE statement when invoked by a shared user (non-owner).
-- The easiest and safest way to ensure the RPC functions work perfectly for both owners and shared users is to set SECURITY DEFINER on update_expense.
-- But since it's already there, we will just add the shared user DELETE policies.

CREATE POLICY splits_shared_delete ON expense_splits
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM expenses
      JOIN trips ON trips.id = expenses.trip_id
      WHERE expenses.id = expense_splits.expense_id
      AND trips.share_enabled = TRUE
      AND trips.share_token = get_share_token()
    )
  );

CREATE POLICY expenses_shared_delete ON expenses
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM trips 
      WHERE trips.id = expenses.trip_id 
      AND trips.share_enabled = TRUE
      AND trips.share_token = get_share_token()
    )
  );
