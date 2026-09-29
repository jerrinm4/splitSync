begin;

-- Import pgtap
create extension if not exists pgtap;

select plan(5);

-- Check if tables exist
select has_table('trips', 'trips table should exist');
select has_table('trip_members', 'trip_members table should exist');
select has_table('expenses', 'expenses table should exist');
select has_table('expense_splits', 'expense_splits table should exist');

-- Test the check_expense_splits_sum trigger
-- We'll insert a mock trip, member, and expense, then try to insert an invalid split.

-- Create mock user
insert into auth.users (id) values ('00000000-0000-0000-0000-000000000001');

-- Insert trip
insert into trips (id, owner_id, name, currency) 
values ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Test Trip', 'INR');

-- Insert member
insert into trip_members (id, trip_id, name)
values ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'Alice');

-- Insert expense
insert into expenses (id, trip_id, title, amount_paise, expense_date, payment_source, split_method, idempotency_key, created_by)
values (
  '00000000-0000-0000-0000-000000000004', 
  '00000000-0000-0000-0000-000000000002', 
  'Test Expense', 
  1000, 
  '2026-01-01', 
  'TRIP_WALLET', 
  'EQUAL', 
  '00000000-0000-0000-0000-000000000005', 
  '00000000-0000-0000-0000-000000000001'
);

-- Try to insert invalid split (900 instead of 1000)
-- Since the trigger is INITIALLY DEFERRED, we must set it to IMMEDIATE to test it within the transaction
set constraints trg_check_splits_sum immediate;

select throws_ok(
  $$ 
    insert into expense_splits (expense_id, member_id, amount_paise)
    values ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003', 900);
  $$,
  'P0001',
  'Split amounts (900) do not equal expense amount (1000)',
  'trigger should reject splits that do not sum to the expense amount'
);

select * from finish();

rollback;
