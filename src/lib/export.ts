import type { Expense, TripDetails } from '@/types/trip'
import { toDateOnly } from './dates'

function csvCell(value: string | number): string {
  let text = String(value)
  // Spreadsheet programs evaluate formula prefixes even in quoted CSV fields.
  if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export function expensesToCsv(trip: TripDetails, expenses: Expense[]): string {
  const memberName = (id: string | null) => trip.trip_members.find(member => member.id === id)?.name || 'Unknown member'
  const rows: (string | number)[][] = [['Date', 'Description', 'Amount', 'Currency', 'Status', 'Category', 'Paid by', 'Shares', 'Note']]
  for (const expense of expenses) {
    const payers = expense.expense_payers?.length
      ? expense.expense_payers.map(payer => `${memberName(payer.member_id)}: ${(payer.amount_paise / 100).toFixed(2)}`).join('; ')
      : memberName(expense.paid_by_member_id)
    rows.push([
      expense.expense_date.slice(0, 10), expense.title, (expense.amount_paise / 100).toFixed(2), trip.currency,
      expense.is_paid === false ? 'Estimated' : 'Paid',
      trip.expense_categories.find(category => category.id === expense.category_id)?.name || 'Uncategorized',
      expense.payment_source === 'TRIP_WALLET' ? 'Trip Wallet' : payers,
      (expense.expense_splits || []).map(split => `${memberName(split.member_id)}: ${(split.amount_paise / 100).toFixed(2)}`).join('; '),
      expense.note || '',
    ])
  }
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')
}

export function createTripBackup(trip: TripDetails) {
  // Only allowlisted trip fields are exported; sharing credentials and account IDs stay private.
  return {
    format: 'splitsync-trip', version: 1, exportedAt: new Date().toISOString(),
    trip: {
      id: trip.id, name: trip.name, note: trip.note, currency: trip.currency,
      start_date: trip.start_date, end_date: trip.end_date, status: trip.status,
      rounding_mode: trip.rounding_mode || 'PAISE',
      members: trip.trip_members.map(({ id, name, note, status }) => ({ id, name, note, status })),
      groups: (trip.trip_member_groups || []).map(({ id, name, member_ids }) => ({ id, name, member_ids })),
      categories: trip.expense_categories.map(({ id, name, color, estimated_amount_paise }) => ({ id, name, color, estimated_amount_paise })),
      expenses: trip.expenses.map(({ id, title, note, amount_paise, expense_date, payment_source, paid_by_member_id, split_method, is_paid, category_id, status, receipt_url, expense_splits, expense_payers }) => ({
        id, title, note, amount_paise, expense_date, payment_source, paid_by_member_id, split_method, is_paid, category_id, status, receipt_url,
        splits: expense_splits.map(({ member_id, amount_paise }) => ({ member_id, amount_paise })),
        payers: expense_payers.map(({ member_id, amount_paise }) => ({ member_id, amount_paise })),
      })),
      funds: trip.fund_transactions.map(({ id, member_id, transaction_type, amount_paise, note, occurred_at, status }) => ({ id, member_id, transaction_type, amount_paise, note, occurred_at, status })),
    },
  }
}

export function downloadFile(contents: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportFilename(name: string, suffix: string): string {
  return `${name.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 80) || 'trip'}-${toDateOnly(new Date())}.${suffix}`
}
