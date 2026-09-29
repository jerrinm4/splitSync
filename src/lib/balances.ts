import type { Expense, FundTransaction } from '@/types/trip'

export type Balance = { totalPaid: number; totalOwed: number; walletContribution: number; finalBalance: number }

export function calculateMemberBalances(members: { id: string }[], expenses: Expense[], funds: FundTransaction[]) {
  const balances: Record<string, Balance> = Object.fromEntries(members.map(member => [member.id, {
    totalPaid: 0, totalOwed: 0, walletContribution: 0, finalBalance: 0,
  }]))
  for (const expense of expenses) {
    if (expense.is_paid === false || expense.status === 'VOIDED') continue
    if (expense.payment_source === 'MEMBER') {
      const payers = expense.expense_payers?.length ? expense.expense_payers : [{
        member_id: expense.paid_by_member_id || '', amount_paise: expense.amount_paise,
      }]
      for (const payer of payers) {
        const balance = balances[payer.member_id]
        if (balance) balance.totalPaid += payer.amount_paise
      }
    }
    for (const split of expense.expense_splits || []) {
      const balance = balances[split.member_id]
      if (balance) balance.totalOwed += split.amount_paise
    }
  }
  for (const fund of funds) {
    const balance = balances[fund.member_id]
    if (!balance || fund.status === 'VOIDED') continue
    balance.walletContribution += fund.transaction_type === 'ADD' ? fund.amount_paise : -fund.amount_paise
  }
  for (const balance of Object.values(balances)) {
    balance.finalBalance = balance.totalPaid + balance.walletContribution - balance.totalOwed
  }
  return balances
}

export function calculateWalletBalance(expenses: Expense[], funds: FundTransaction[]) {
  const contributed = funds.filter(fund => fund.status !== 'VOIDED').reduce((sum, fund) =>
    sum + (fund.transaction_type === 'ADD' ? fund.amount_paise : -fund.amount_paise), 0)
  const spent = expenses.filter(expense => expense.status !== 'VOIDED' && expense.is_paid !== false && expense.payment_source === 'TRIP_WALLET')
    .reduce((sum, expense) => sum + expense.amount_paise, 0)
  return contributed - spent
}
