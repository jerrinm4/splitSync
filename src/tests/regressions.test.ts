import { describe, expect, it } from 'vitest'
import { calculateEqualSplits, parseMoneyToPaise, recalculateAllTripSplits } from '../lib/money'
import { fromDateOnly, toDateOnly } from '../lib/dates'
import { calculateMemberBalances, calculateWalletBalance } from '../lib/balances'
import { createExpenseSchema } from '../lib/validation'
import { createTripBackup, expensesToCsv } from '../lib/export'
import { sampleTrip } from '../../e2e/fixtures'

describe('expense regressions', () => {
  it.each(['1oops', '1e3', 'Infinity', '-10', '0.001', '9007199254740992'])('rejects invalid money: %s', input => {
    expect(parseMoneyToPaise(input)).toBe(0)
  })
  it('converts paise without floating point rounding', () => {
    expect(parseMoneyToPaise(' 1.01 ')).toBe(101)
    expect(parseMoneyToPaise('99.99')).toBe(9999)
  })
  it('preserves the local calendar date', () => {
    const date = new Date(2026, 8, 26, 0, 0)
    expect(toDateOnly(date)).toBe('2026-09-26')
    expect(fromDateOnly('2026-09-26').getDate()).toBe(26)
    expect(fromDateOnly('2026-09-26').getHours()).toBe(0)
  })
  it('conserves paise and returns stable equal splits', () => {
    for (let total = 1; total < 1000; total += 13) {
      const splits = calculateEqualSplits(total, ['a', 'b', 'c'])
      expect(splits.reduce((sum, split) => sum + split.amountPaise, 0)).toBe(total)
      expect(calculateEqualSplits(total, ['a', 'b', 'c'])).toEqual(splits)
    }
  })
  it('keeps custom shares unchanged during rounding resync', () => {
    expect(recalculateAllTripSplits([{ ...sampleTrip.expenses[0], split_method: 'CUSTOM' }])).toEqual([])
  })
  it('rejects blank titles and accepts the multiple-payer form before selector validation', () => {
    const values = { title: 'Dinner', amountString: '100', expenseDate: new Date(), paymentSource: 'MEMBER', payerMode: 'MULTIPLE', splitMethod: 'CUSTOM', isPaid: true }
    expect(createExpenseSchema.safeParse(values).success).toBe(true)
    expect(createExpenseSchema.safeParse({ ...values, title: '   ' }).success).toBe(false)
  })
  it('subtracts refunds and paid wallet expenses while excluding estimates', () => {
    expect(calculateWalletBalance(sampleTrip.expenses, sampleTrip.fund_transactions)).toBe(430000)
    const balances = calculateMemberBalances(sampleTrip.trip_members, sampleTrip.expenses, sampleTrip.fund_transactions)
    expect(balances[sampleTrip.trip_members[0]!.id]?.totalPaid).toBe(600000)
    expect(Object.values(balances).reduce((sum, balance) => sum + balance.totalOwed, 0)).toBe(1560000)
  })
  it('exports only selected rows with safe CSV cells and exact decimals', () => {
    const expense = { ...sampleTrip.expenses[0]!, title: '=SUM(1,2)', note: 'A "quoted"\nnote', amount_paise: 101 }
    const csv = expensesToCsv(sampleTrip, [expense])
    expect(csv).toContain('"\'=SUM(1,2)"')
    expect(csv).toContain('"1.01"')
    expect(csv).toContain('A ""quoted""\nnote')
    expect(csv).not.toContain('Sunset dinner')
  })
  it('includes complete shares in a backup without account or sharing credentials', () => {
    const backup = createTripBackup(sampleTrip)
    expect(backup.trip.expenses[0]?.payers).toHaveLength(2)
    const json = JSON.stringify(backup)
    expect(json).not.toContain('share_pin')
    expect(json).not.toContain('share_token')
    expect(json).not.toContain('owner_id')
    expect(json).not.toContain('idempotency_key')
  })
})
