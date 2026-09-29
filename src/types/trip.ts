import type { Database } from './database'

type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']

export type TripMember = Row<'trip_members'>
export type Category = Row<'expense_categories'>
export type FundTransaction = Row<'fund_transactions'>
export type ExpenseShare = { member_id: string; amount_paise: number }
export type Expense = Row<'expenses'> & {
  expense_splits: ExpenseShare[]
  expense_payers: ExpenseShare[]
}
export type Trip = Row<'trips'> & { show_estimated_per_head?: boolean; rounding_mode?: 'PAISE' | 'FLOOR' | 'CEIL' }
export type TripDetails = Trip & {
  trip_members: TripMember[]
  trip_member_groups: Row<'trip_member_groups'>[]
  expense_categories: Category[]
  expenses: Expense[]
  fund_transactions: FundTransaction[]
}
