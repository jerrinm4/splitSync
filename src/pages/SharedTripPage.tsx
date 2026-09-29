import { fromDateOnly } from '@/lib/dates'
import { calculateMemberBalances, calculateWalletBalance } from '@/lib/balances'
import { useState, useMemo, useEffect } from 'react'
import { useParams } from '@tanstack/react-router'
import { useSharedTrip, useCheckTripPin } from '@/features/trips/hooks/useSharedTrip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatMoney, applyRounding } from '@/lib/money'
import type { RoundingMode } from '@/lib/money'
import { format } from 'date-fns'
import { ChevronDown, Receipt, Lock, Calendar, Sun, Moon, CheckCircle2, Clock, Tag, Wallet, ArrowUpRight } from 'lucide-react'

export default function SharedTripPage() {
  const { shareToken } = useParams({ strict: false }) as { shareToken: string }

  const { data: requiresPin, isLoading: checkingPin } = useCheckTripPin(shareToken)
  const [pin, setPin] = useState('')
  const [submittedPin, setSubmittedPin] = useState<string | undefined>(undefined)
  const shouldFetchTrip = requiresPin === false || (requiresPin === true && submittedPin !== undefined)
  const { data: trip, isLoading: tripLoading, error } = useSharedTrip(shouldFetchTrip ? shareToken : '', submittedPin)
  const isLoading = checkingPin || (shouldFetchTrip && tripLoading)

  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null)
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'expenses' | 'members' | 'categories'>('expenses')
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('app-theme')
    if (saved) return saved === 'dark'
    return false // default light mode for shared view
  })

  useEffect(() => {
    localStorage.setItem('app-theme', isDark ? 'dark' : 'light')
    if (isDark) {
      document.documentElement.classList.remove('light')
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])

  const memberBalances = useMemo(() => calculateMemberBalances(
    trip?.trip_members || [], trip?.expenses || [], trip?.fund_transactions || []
  ), [trip])

  const categoryBreakdown = useMemo(() => {
    const allExpenses = trip?.expenses || []
    const categories = (trip as any)?.expense_categories || []
    const map: Record<string, { name: string; color: string; total: number; count: number; paidTotal: number; unpaidTotal: number; estimated_amount_paise: number }> = {}
    categories.forEach((cat: any) => {
      map[cat.id] = { name: cat.name, color: cat.color, total: 0, count: 0, paidTotal: 0, unpaidTotal: 0, estimated_amount_paise: cat.estimated_amount_paise || 0 }
    })
    let uncategorized = { total: 0, count: 0, paidTotal: 0, unpaidTotal: 0 }
    allExpenses.forEach((exp: any) => {
      const isPaid = exp.is_paid !== false
      const category = exp.category_id ? map[exp.category_id] : undefined
      if (category) {
        category.total += exp.amount_paise
        category.count += 1
        if (isPaid) category.paidTotal += exp.amount_paise
        else category.unpaidTotal += exp.amount_paise
      } else {
        uncategorized.total += exp.amount_paise
        uncategorized.count += 1
        if (isPaid) uncategorized.paidTotal += exp.amount_paise
        else uncategorized.unpaidTotal += exp.amount_paise
      }
    })
    return { categories: Object.entries(map), uncategorized }
  }, [trip])

  if (isLoading) return (
    <div className="flex justify-center items-center min-h-[100dvh] bg-muted/20">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Loading trip…</p>
      </div>
    </div>
  )

  if (requiresPin && (!submittedPin || error)) {
    return (
      <div className="min-h-[100dvh] bg-muted/20 flex items-center justify-center p-5">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Protected Trip</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter PIN to continue</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (pin) setSubmittedPin(pin) }} className="space-y-3">
            <Input aria-label="Trip PIN" type="password" placeholder="••••" value={pin} onChange={e => setPin(e.target.value)}
              className="text-center text-xl tracking-[0.5em] h-12 bg-card border-border" autoFocus />
            {error && <p role="alert" className="text-sm text-destructive text-center">Wrong PIN. Try again.</p>}
            <Button type="submit" className="w-full h-11 font-semibold text-sm">Unlock</Button>
          </form>
        </div>
      </div>
    )
  }

  if (error || !trip) return (
    <div className="flex flex-col justify-center items-center min-h-[100dvh] bg-muted/20 p-5">
      <div className="text-center">
        <h1 className="text-lg font-bold text-foreground">Link unavailable</h1>
        <p className="text-sm text-muted-foreground mt-1">This link may have been disabled or doesn't exist.</p>
      </div>
    </div>
  )

  const roundingMode = ((trip as any).rounding_mode || 'PAISE') as RoundingMode
  const showEstimatedPerHead = (trip as any).show_estimated_per_head !== false

  const allExpenses = trip.expenses || []
  const paidTotal = allExpenses.filter(e => e.is_paid !== false).reduce((a, e) => a + e.amount_paise, 0)
  const unpaidTotal = allExpenses.filter(e => e.is_paid === false).reduce((a, e) => a + e.amount_paise, 0)
  const expenses = [...allExpenses].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const members = [...(trip.trip_members || [])].sort((a, b) => a.name.localeCompare(b.name))

  const totalFundsAdded = trip.fund_transactions?.filter((t: any) => t.transaction_type === 'ADD').reduce((a: number, b: any) => a + b.amount_paise, 0) || 0
  const walletExpenses = allExpenses.filter(e => e.payment_source === 'TRIP_WALLET' && e.is_paid !== false).reduce((a, b) => a + b.amount_paise, 0) || 0
  const outOfPocketPaid = paidTotal - walletExpenses
  const totalCollected = totalFundsAdded + outOfPocketPaid
  const totalUsed = paidTotal
  const walletBalance = calculateWalletBalance(trip.expenses, trip.fund_transactions)
  const categories = (trip as any).expense_categories || []

  let finalEstimatedTripCost = 0;
  const expensesByCat: Record<string, number> = {};
  let uncategorizedExpenses = 0;
  allExpenses.forEach(exp => {
    if (exp.category_id) expensesByCat[exp.category_id] = (expensesByCat[exp.category_id] || 0) + exp.amount_paise;
    else uncategorizedExpenses += exp.amount_paise;
  });

  categories.forEach((cat: any) => {
    const spentAndPlanned = expensesByCat[cat.id] || 0;
    const catEstimate = cat.estimated_amount_paise || 0;
    finalEstimatedTripCost += Math.max(spentAndPlanned, catEstimate);
  });

  Object.keys(expensesByCat).forEach(catId => {
    if (!categories.find((c: any) => c.id === catId)) uncategorizedExpenses += expensesByCat[catId] || 0;
  });
  finalEstimatedTripCost += uncategorizedExpenses;


  return (
    <div className="min-h-[100dvh] bg-muted/20">
      <div className="bg-card border-b border-border/50 px-4 md:px-6 pt-5 pb-4">
        <div className="max-w-4xl mx-auto flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight">{trip.name}</h1>
            {trip.note && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{trip.note}</p>}
            <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground font-medium">
              {trip.start_date && (
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(fromDateOnly(trip.start_date), 'MMM d')} {trip.end_date && `– ${format(fromDateOnly(trip.end_date), 'MMM d, yyyy')}`}</span>
              )}
              <span>•</span>
              <span>{members.length} people</span>
            </div>
          </div>
          <button aria-label="Toggle dark or light theme" onClick={() => setIsDark(!isDark)} className="p-2 rounded-full border border-border bg-background/50 hover:bg-accent transition-colors flex-shrink-0 mt-0.5 group">
            {isDark ? <Sun className="w-4 h-4 text-amber-800 dark:text-amber-300 group-hover:text-white transition-colors" /> : <Moon className="w-4 h-4 text-indigo-500 group-hover:text-white transition-colors" />}
          </button>
        </div>
      </div>

      <div className="px-4 md:px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-2 py-4">
          <div className="bg-card rounded-xl p-3 border border-border/50">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-emerald-800 dark:text-emerald-300" /> Total Collected
            </p>
            <p className="text-base font-bold text-foreground mt-0.5">{formatMoney(applyRounding(totalCollected, roundingMode, 'COLLECT'), trip.currency)}</p>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border/50">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-800 dark:text-green-300" /> Total Used
            </p>
            <p className="text-base font-bold text-foreground mt-0.5">{formatMoney(applyRounding(totalUsed, roundingMode, 'COLLECT'), trip.currency)}</p>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border/50">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
              <Wallet className="w-3 h-3" /> Wallet Balance
            </p>
            <p className={`text-base font-bold mt-0.5 ${walletBalance < 0 ? 'text-destructive' : 'text-foreground'}`}>{formatMoney(applyRounding(walletBalance, roundingMode, 'COLLECT'), trip.currency)}</p>
          </div>
        </div>
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-2 pb-4">
          <div className="bg-card rounded-xl p-3 border border-border/50">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Per Head</p>
            <p className="text-base font-bold text-foreground mt-0.5">
              {members.length > 0 ? formatMoney(applyRounding(Math.round(paidTotal / members.length), roundingMode, 'COLLECT'), trip.currency) : '—'}
            </p>
          </div>
          {showEstimatedPerHead && finalEstimatedTripCost > 0 && (
            <div className="bg-card rounded-xl p-3 border border-border/50 border-l-2 border-l-primary/60">
              <p className="text-[10px] text-primary font-semibold uppercase tracking-wider flex items-center gap-1">
                <Tag className="w-3 h-3" /> Per Head (Est.)
              </p>
              <p className="text-base font-bold text-primary mt-0.5">
                {members.length > 0 ? formatMoney(applyRounding(Math.round(finalEstimatedTripCost / members.length), roundingMode, 'COLLECT'), trip.currency) : '—'}
              </p>
            </div>
          )}
          {unpaidTotal > 0 && (
            <div className="bg-card rounded-xl p-3 border border-border/50">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-800 dark:text-amber-300" /> Estimated
              </p>
              <p className="text-base font-bold text-amber-800 dark:text-amber-300 mt-0.5">{formatMoney(applyRounding(unpaidTotal, roundingMode, 'COLLECT'), trip.currency)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
            <button aria-pressed={activeTab === 'expenses'} onClick={() => setActiveTab('expenses')}
              className={`flex-1 text-xs font-semibold py-2 rounded-md transition-all ${activeTab === 'expenses' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              Expenses ({expenses.length})
            </button>
            <button aria-pressed={activeTab === 'members'} onClick={() => setActiveTab('members')}
              className={`flex-1 text-xs font-semibold py-2 rounded-md transition-all ${activeTab === 'members' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              Members ({members.length})
            </button>
            {categories.length > 0 && (
              <button aria-pressed={activeTab === 'categories'} onClick={() => setActiveTab('categories')}
                className={`flex-1 text-xs font-semibold py-2 rounded-md transition-all ${activeTab === 'categories' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                Categories
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 pb-10 pt-4">
        <div className="max-w-4xl mx-auto space-y-2">

          {activeTab === 'expenses' && (
            expenses.length === 0 ? (
              <div className="text-center py-16">
                <Receipt className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground font-medium">No expenses yet</p>
              </div>
            ) : (
              expenses.map(expense => {
                const payers = (expense as any).expense_payers || []
                const payer = expense.payment_source === 'TRIP_WALLET'
                  ? 'Trip Wallet'
                  : payers.length > 1
                    ? `${members.find(m => m.id === payers[0].member_id)?.name || '—'} & ${payers.length - 1} other${payers.length - 1 > 1 ? 's' : ''}`
                    : members.find(m => m.id === (payers[0]?.member_id || expense.paid_by_member_id))?.name || '—'
                const isExpanded = expandedExpenseId === expense.id
                const splits = (expense as any).expense_splits || []
                const isUnpaid = expense.is_paid === false
                const category = expense.category_id ? categories.find((c: any) => c.id === expense.category_id) : null

                return (
                  <div key={expense.id} className={`bg-card rounded-xl border border-border/50 overflow-hidden ${isUnpaid ? 'border-l-2 border-l-amber-500/60' : ''}`}>
                    <button aria-expanded={isExpanded} className="w-full text-left p-3.5 flex items-center gap-3" onClick={() => setExpandedExpenseId(isExpanded ? null : expense.id)}>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isUnpaid ? 'bg-amber-500/10' : 'bg-primary/10'}`}>
                        {isUnpaid ? <Clock className="w-4 h-4 text-amber-800 dark:text-amber-300" /> : <Receipt className="w-4 h-4 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-foreground truncate">{expense.title}</p>
                          {isUnpaid && (
                            <span className="text-[8px] font-bold uppercase px-1 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 dark:text-amber-400 shrink-0">Est.</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-[11px] text-muted-foreground">{format(fromDateOnly(expense.expense_date), 'MMM d')} · {payer}</p>
                          {category && (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: category.color }} />
                              {category.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 pl-2">
                        <p className="text-sm font-bold text-foreground">{formatMoney(expense.amount_paise, trip.currency)}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{splits.length} split{splits.length !== 1 ? 's' : ''}</p>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground/50 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 space-y-2">
                        <div className="h-px bg-border/50 -mx-3.5 mb-3" />

                        {expense.note && (
                          <div className="bg-muted/30 rounded-lg px-3 py-2">
                            <p className="text-xs text-muted-foreground">{expense.note}</p>
                          </div>
                        )}

                        <div className="space-y-1">
                          {splits.map((s: any) => {
                            const m = members.find(mem => mem.id === s.member_id)
                            if (!m) return null
                            return (
                              <div key={s.member_id} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-muted/30">
                                <span className="text-xs font-medium text-muted-foreground">{m.name}</span>
                                <span className="text-xs font-bold text-foreground">{formatMoney(s.amount_paise, trip.currency)}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )
          )}

          {activeTab === 'members' && (
            members.map(member => {
              const b = memberBalances[member.id] || { totalPaid: 0, totalOwed: 0, walletContribution: 0, finalBalance: 0 }
              const isPositive = b.finalBalance > 0
              const isNegative = b.finalBalance < 0

              const memberExpenses = expenses.filter(exp => {
                const splits = (exp as any).expense_splits || []
                return splits.some((s: any) => s.member_id === member.id)
              })

              const memberPaidExpenses = expenses.filter(exp => {
                if (exp.payment_source === 'MEMBER' && exp.is_paid !== false) {
                  const payers = (exp as any).expense_payers || []
                  if (payers.length > 0) {
                    return payers.some((p: any) => p.member_id === member.id)
                  } else {
                    return exp.paid_by_member_id === member.id
                  }
                }
                return false
              })

              return (
                <div key={member.id} className="bg-card rounded-xl border border-border/50 overflow-hidden">
                  <div className="p-3.5 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold
                      ${isPositive ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 dark:text-emerald-400'
                        : isNegative ? 'bg-red-500/10 text-red-700 dark:text-red-300 dark:text-red-400'
                          : 'bg-muted text-muted-foreground'}`}>
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{member.name}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${isPositive ? 'text-emerald-800 dark:text-emerald-300 dark:text-emerald-400' : isNegative ? 'text-red-700 dark:text-red-300 dark:text-red-400' : 'text-muted-foreground'}`}>
                        {isPositive ? '+' : isNegative ? '−' : ''}{formatMoney(applyRounding(Math.abs(b.finalBalance), roundingMode, isNegative ? 'COLLECT' : 'RETURN'), trip.currency)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-px bg-border/50 border-t border-border/50">
                    <div className="bg-card px-3 py-2 text-center">
                      <p className="text-[10px] text-muted-foreground font-medium">Paid</p>
                      <p className="text-xs font-bold text-foreground mt-0.5">{formatMoney(applyRounding(b.totalPaid, roundingMode, 'COLLECT'), trip.currency)}</p>
                    </div>
                    <div className="bg-card px-3 py-2 text-center">
                      <p className="text-[10px] text-muted-foreground font-medium">Share</p>
                      <p className="text-xs font-bold text-foreground mt-0.5">{formatMoney(applyRounding(b.totalOwed, roundingMode, 'COLLECT'), trip.currency)}</p>
                    </div>
                    <div className="bg-card px-3 py-2 text-center">
                      <p className="text-[10px] text-muted-foreground font-medium">Wallet</p>
                      <p className="text-xs font-bold text-foreground mt-0.5">{formatMoney(applyRounding(b.walletContribution, roundingMode, 'COLLECT'), trip.currency)}</p>
                    </div>
                  </div>

                  {(memberExpenses.length > 0 || memberPaidExpenses.length > 0) && (
                    <div className="border-t border-border/50">
                      <button
                        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-muted/10 hover:bg-muted/20 transition-colors"
                        aria-expanded={expandedMemberId === member.id} onClick={() => setExpandedMemberId(expandedMemberId === member.id ? null : member.id)}
                      >
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Contributions</p>
                        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground/50 transition-transform ${expandedMemberId === member.id ? 'rotate-180' : ''}`} />
                      </button>

                      {expandedMemberId === member.id && (
                        <div className="px-3.5 pb-2.5 space-y-3">
                          {memberExpenses.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Their Share (Owes)</p>
                              {memberExpenses.map(exp => {
                                const splits = (exp as any).expense_splits || []
                                const split = splits.find((s: any) => s.member_id === member.id)
                                if (!split) return null
                                const isUnpaid = exp.is_paid === false
                                return (
                                  <div key={`split-${exp.id}`} className="flex items-center justify-between py-1 text-xs">
                                    <span className="text-muted-foreground truncate pr-2 flex items-center gap-1">
                                      {isUnpaid && <Clock className="w-3 h-3 text-amber-800 dark:text-amber-300 shrink-0" />}
                                      {exp.title}
                                    </span>
                                    <span className={`font-semibold flex-shrink-0 ${isUnpaid ? 'text-amber-800 dark:text-amber-300' : 'text-foreground'}`}>
                                      {formatMoney(split.amount_paise, trip.currency)}
                                    </span>
                                  </div>
                                )
                          })}
                        </div>
                      )}

                      {memberPaidExpenses.length > 0 && (
                        <div className={`space-y-1 ${memberExpenses.length > 0 ? 'pt-2 border-t border-border/30' : ''}`}>
                          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Paid</p>
                          {memberPaidExpenses.map(exp => {
                            const payers = (exp as any).expense_payers || []
                            let paidAmount = 0
                            if (payers.length > 0) {
                              const payer = payers.find((p: any) => p.member_id === member.id)
                              if (payer) paidAmount = payer.amount_paise
                            } else if (exp.paid_by_member_id === member.id) {
                              paidAmount = exp.amount_paise
                            }
                            if (!paidAmount) return null

                            return (
                              <div key={`paid-${exp.id}`} className="flex items-center justify-between py-1 text-xs">
                                <span className="text-muted-foreground truncate pr-2">
                                  {exp.title}
                                </span>
                                <span className="font-semibold text-emerald-800 dark:text-emerald-300 flex-shrink-0">
                                  {formatMoney(paidAmount, trip.currency)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            }
                </div>
        )
            })
          )}

        {activeTab === 'categories' && (
          categories.length === 0 ? (
            <div className="text-center py-16">
              <Tag className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-medium">No categories</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categoryBreakdown.categories.map(([id, cat]) => {
                if (cat.total === 0 && cat.estimated_amount_paise === 0) return null;
                return (
                  <div key={id} className="bg-card rounded-xl border border-border/50 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{cat.name}</p>
                        <p className="text-[10px] text-muted-foreground">{cat.count} expense{cat.count !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right">
                      <span className="text-sm text-muted-foreground"><span className="text-[10px] uppercase mr-1 ">Billed:</span>{formatMoney(cat.paidTotal, trip.currency)}</span>
                      {Math.max(cat.paidTotal + cat.unpaidTotal, cat.estimated_amount_paise) > 0 && (
                        <span className="text-sm font-bold text-primary"><span className="text-[10px] uppercase mr-1 ">Est:</span>{formatMoney(Math.max(cat.paidTotal + cat.unpaidTotal, cat.estimated_amount_paise), trip.currency)}</span>
                      )}
                    </div>
                  </div>
                )
              })}
              {categoryBreakdown.uncategorized.count > 0 && (
                <div className="bg-card rounded-xl border border-border/50 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full shrink-0 bg-muted-foreground/30" />
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground">Uncategorized</p>
                      <p className="text-[10px] text-muted-foreground">{categoryBreakdown.uncategorized.count} expense{categoryBreakdown.uncategorized.count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-right">
                    <span className="text-sm text-muted-foreground"><span className="text-[10px] uppercase mr-1 ">Billed:</span>{formatMoney(categoryBreakdown.uncategorized.paidTotal, trip.currency)}</span>
                    {categoryBreakdown.uncategorized.paidTotal + categoryBreakdown.uncategorized.unpaidTotal > 0 && (
                      <span className="text-sm font-bold text-primary"><span className="text-[10px] uppercase mr-1 ">Est:</span>{formatMoney(categoryBreakdown.uncategorized.paidTotal + categoryBreakdown.uncategorized.unpaidTotal, trip.currency)}</span>
                    )}
                  </div>
                </div>
              )}

              {members.length > 0 && (
                <div className="bg-card rounded-xl border border-border/50 p-4 mt-4">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-3">Per Head by Category</p>
                  <div className="space-y-2">
                    {categoryBreakdown.categories.map(([id, cat]) => (
                      (cat.total > 0 || cat.estimated_amount_paise > 0) && (
                        <div key={id} className="flex flex-col border-b border-border/30 last:border-0 pb-2 mb-2 last:mb-0 last:pb-0">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="flex items-center gap-2 text-muted-foreground">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                              {cat.name}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <div>
                              <span className="text-[10px] text-muted-foreground block uppercase">Current</span>
                              <span className="font-bold text-foreground">{formatMoney(applyRounding(Math.round(cat.paidTotal / members.length), roundingMode, 'COLLECT'), trip.currency)}</span>
                            </div>
                            {Math.max(cat.paidTotal + cat.unpaidTotal, cat.estimated_amount_paise) > 0 && (
                              <div>
                                <span className="text-[10px] text-primary block uppercase">Estimated</span>
                                <span className="font-bold text-primary">{formatMoney(applyRounding(Math.round(Math.max(cat.paidTotal + cat.unpaidTotal, cat.estimated_amount_paise) / members.length), roundingMode, 'COLLECT'), trip.currency)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    ))}
                    {categoryBreakdown.uncategorized.total > 0 && (
                      <div className="flex flex-col border-b border-border/30 last:border-0 pb-2 mb-2 last:mb-0 last:pb-0">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                            Uncategorized
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <div>
                            <span className="text-[10px] text-muted-foreground block uppercase">Current</span>
                            <span className="font-bold text-foreground">{formatMoney(applyRounding(Math.round(categoryBreakdown.uncategorized.paidTotal / members.length), roundingMode, 'COLLECT'), trip.currency)}</span>
                          </div>
                          {categoryBreakdown.uncategorized.paidTotal + categoryBreakdown.uncategorized.unpaidTotal > 0 && (
                            <div>
                              <span className="text-[10px] text-primary block uppercase">Estimated</span>
                              <span className="font-bold text-primary">{formatMoney(applyRounding(Math.round((categoryBreakdown.uncategorized.paidTotal + categoryBreakdown.uncategorized.unpaidTotal) / members.length), roundingMode, 'COLLECT'), trip.currency)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
    </div >
  )
}
