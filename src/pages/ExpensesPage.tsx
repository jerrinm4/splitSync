import { LoadError } from '@/components/layout/LoadError'
import { ReceiptViewer } from '@/components/expenses/ReceiptViewer'
import { fromDateOnly } from '@/lib/dates'
import { useState, useMemo } from 'react'
import { useParams, Link } from '@tanstack/react-router'
import { useTrip } from '@/features/trips/hooks/useTrip'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatMoney } from '@/lib/money'
import { format } from 'date-fns'
import { Plus, Receipt, ChevronDown, ChevronUp, Edit, Trash2, Image as ImageIcon, Download, CheckCircle2, Clock, Search } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { ManageCategoriesModal } from '@/components/expenses/ManageCategoriesModal'
import { downloadFile, expensesToCsv, exportFilename } from '@/lib/export'

export default function ExpensesPage() {
  const { tripId } = useParams({ strict: false }) as { tripId: string }
  const { data: trip, isLoading, refetch } = useTrip(tripId)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [exportAction, setExportAction] = useState<(() => Promise<void>) | null>(null)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL')
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState<string>('ALL')
  const [sortBy, setSortBy] = useState('ADDED_DESC')

  const executeDelete = async () => {
    if (!deleteExpenseId) return

    try {
      const { error } = await supabase.from('expenses').delete().eq('id', deleteExpenseId)
      if (error) throw error
      toast({ title: 'Expense deleted successfully' })
      queryClient.invalidateQueries({ queryKey: ['trips', tripId] })
    } catch (err: any) {
      toast({ title: 'Error deleting expense', description: err.message, variant: 'destructive' })
    } finally {
      setDeleteExpenseId(null)
    }
  }

  const categories = useMemo(() => trip?.expense_categories || [], [trip])
  const allExpenses = useMemo(() => trip?.expenses?.filter(expense => expense.status !== 'VOIDED') || [], [trip])
  const hasFilters = !!searchQuery || statusFilter !== 'ALL' || categoryFilter !== 'ALL' || dateFilter !== 'ALL'
  const clearFilters = () => { setSearchQuery(''); setStatusFilter('ALL'); setCategoryFilter('ALL'); setDateFilter('ALL') }

  const uniqueDates = useMemo(() => {
    const dates = new Set(allExpenses.map(e => e.expense_date.slice(0, 10)))
    return Array.from(dates).sort().reverse()
  }, [allExpenses])

  const expenses = useMemo(() => {
    let result = [...allExpenses]

    if (searchQuery) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(e => {
        const payerIds = [e.paid_by_member_id, ...(e.expense_payers || []).map(payer => payer.member_id)]
        const payerNames = trip?.trip_members.filter(member => payerIds.includes(member.id)).map(member => member.name).join(' ')
        const category = categories.find(category => category.id === e.category_id)?.name || ''
        return [e.title, e.note, payerNames, category, e.payment_source === 'TRIP_WALLET' ? 'Trip Wallet' : ''].join(' ').toLowerCase().includes(q)
      })
    }

    if (statusFilter === 'PAID') result = result.filter(e => e.is_paid !== false)
    if (statusFilter === 'UNPAID') result = result.filter(e => e.is_paid === false)
    if (categoryFilter !== 'ALL') {
      if (categoryFilter === 'NONE') {
        result = result.filter(e => !e.category_id)
      } else {
        result = result.filter(e => e.category_id === categoryFilter)
      }
    }
    if (dateFilter !== 'ALL') {
      result = result.filter(e => e.expense_date.startsWith(dateFilter))
    }

    return result.sort((a, b) => {
      if (sortBy === 'DATE_DESC') {
        return fromDateOnly(b.expense_date).getTime() - fromDateOnly(a.expense_date).getTime()
      }
      if (sortBy === 'DATE_ASC') {
        return fromDateOnly(a.expense_date).getTime() - fromDateOnly(b.expense_date).getTime()
      }
      if (sortBy === 'ADDED_DESC') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      if (sortBy === 'AMOUNT_DESC') return b.amount_paise - a.amount_paise
      if (sortBy === 'AMOUNT_ASC') return a.amount_paise - b.amount_paise
      return 0
    })
  }, [allExpenses, categories, trip, statusFilter, categoryFilter, searchQuery, dateFilter, sortBy])


  const categorySummary = useMemo(() => {
    const map: Record<string, { name: string; color: string; total: number; count: number; paidTotal: number; unpaidTotal: number; estimated_amount_paise: number }> = {}
    categories.forEach((cat: any) => {
      map[cat.id] = { name: cat.name, color: cat.color, total: 0, count: 0, paidTotal: 0, unpaidTotal: 0, estimated_amount_paise: cat.estimated_amount_paise || 0 }
    })
    let uncategorized = { total: 0, count: 0, paidTotal: 0, unpaidTotal: 0 }
    allExpenses.forEach(exp => {
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
  }, [allExpenses, categories])

  if (isLoading) return <div className="flex justify-center items-center h-40"><div className="animate-pulse text-primary">Loading expenses...</div></div>
  if (!trip) return <LoadError retry={refetch} />

  const totalPaid = allExpenses.filter(e => e.is_paid !== false).reduce((a, b) => a + b.amount_paise, 0)
  const totalUnpaid = allExpenses.filter(e => e.is_paid === false).reduce((a, b) => a + b.amount_paise, 0)

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in-up pb-20 md:pb-0">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
        <div className="flex gap-2">
          <Button variant="outline" aria-label="Export expenses as CSV" disabled={!expenses.length} onClick={() => downloadFile(expensesToCsv(trip, expenses), exportFilename(trip.name, 'csv'), 'text/csv;charset=utf-8')} className="rounded-full shadow-sm">
            <Download className="w-4 h-4 mr-2" /> CSV
          </Button>
          <Button variant="outline" aria-label="Export expenses as PDF" disabled={!expenses.length} onClick={() => setExportAction(() => async () => { const { exportExpensesPDF } = await import('@/lib/pdf'); await exportExpensesPDF(trip, expenses) })} className="rounded-full shadow-sm">
            PDF
          </Button>
          <Button asChild aria-label="Add expense" className="rounded-full shadow-lg shadow-primary/20">
            <Link to="/trips/$tripId/expenses/new" params={{ tripId: trip.id }}><Plus className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Add Expense</span></Link>
          </Button>
        </div>
      </div>

      {allExpenses.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-xl p-3 border border-border/50">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-800 dark:text-green-300" /> Paid
            </p>
            <p className="text-base font-bold text-foreground mt-0.5">{formatMoney(totalPaid, trip.currency)}</p>
          </div>
          {totalUnpaid > 0 && (
            <div className="bg-card rounded-xl p-3 border border-border/50">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-800 dark:text-amber-300" /> Estimated
              </p>
              <p className="text-base font-bold text-amber-800 dark:text-amber-300 mt-0.5">{formatMoney(totalUnpaid, trip.currency)}</p>
            </div>
          )}
        </div>
      )}

      {categories.length > 0 && allExpenses.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categorySummary.categories.map(([id, cat]) => (
            (cat.total > 0 || cat.estimated_amount_paise > 0) && (
              <button
                key={id}
                onClick={() => setCategoryFilter(categoryFilter === id ? 'ALL' : id)}
                className={`flex flex-col items-start px-3 py-1.5 rounded-xl text-xs border transition-all ${
                  categoryFilter === id
                    ? 'bg-foreground text-background border-foreground shadow-md'
                    : 'bg-card border-border/50 text-foreground hover:border-border'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </div>
                <div className="flex gap-2 mt-1 text-[10px] w-full justify-between">
                  <span className="">Billed: {formatMoney(cat.paidTotal, trip.currency)}</span>
                  {Math.max(cat.paidTotal + cat.unpaidTotal, cat.estimated_amount_paise) > 0 && (
                    <span className="text-primary font-medium">Est: {formatMoney(Math.max(cat.paidTotal + cat.unpaidTotal, cat.estimated_amount_paise), trip.currency)}</span>
                  )}
                </div>
              </button>
            )
          ))}
          {categorySummary.uncategorized.count > 0 && (
            <button
              onClick={() => setCategoryFilter(categoryFilter === 'NONE' ? 'ALL' : 'NONE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                categoryFilter === 'NONE'
                  ? 'bg-foreground text-background border-foreground shadow-md'
                  : 'bg-card border-border/50 text-muted-foreground hover:border-border'
              }`}
            >
              Other
              <span className="font-normal">{formatMoney(categorySummary.uncategorized.total, trip.currency)}</span>
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {allExpenses.some(e => e.is_paid === false) ? (
            <div className="flex gap-2">
              {(['ALL', 'PAID', 'UNPAID'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    statusFilter === f
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card border-border/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f === 'ALL' ? 'All' : f === 'PAID' ? 'Paid' : 'Estimated'}
                </button>
              ))}
            </div>
          ) : <div />}
          <ManageCategoriesModal tripId={trip.id} />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              aria-label="Search expenses"
              placeholder="Search descriptions, notes or payers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm rounded-full bg-card border-border/50"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <select aria-label="Filter by date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-9 px-3 py-1 text-sm rounded-full bg-card border border-border/50 font-medium focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              <option value="ALL">All Dates</option>
              {uniqueDates.map(d => <option key={d} value={d}>{format(new Date(d), 'MMM d, yyyy')}</option>)}
            </select>

            <select aria-label="Sort expenses"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-9 px-3 py-1 text-sm rounded-full bg-card border border-border/50 font-medium focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              <option value="ADDED_DESC">Last Added</option>
              <option value="DATE_DESC">Newest Date</option>
              <option value="DATE_ASC">Oldest Date</option>
              <option value="AMOUNT_DESC">Highest Amount</option>
              <option value="AMOUNT_ASC">Lowest Amount</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm" aria-live="polite">
        <p className="text-muted-foreground">{expenses.length} of {allExpenses.length} expenses · <span className="font-semibold text-foreground">{formatMoney(expenses.reduce((sum, expense) => sum + expense.amount_paise, 0), trip.currency)}</span></p>
        {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>}
      </div>
      <div className="space-y-4">
        {expenses.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground glass-card rounded-2xl border border-dashed border-border flex flex-col items-center">
            <Receipt className="w-12 h-12 mb-4 text-muted-foreground/50" />
            <h2 className="text-lg font-medium text-foreground mb-1">
              {allExpenses.length > 0 ? 'No expenses match this filter' : 'No expenses yet'}
            </h2>
            <p className="text-sm">
              {allExpenses.length > 0 ? 'Try changing the filter.' : 'Add your first expense to start tracking.'}
            </p>
            {allExpenses.length === 0 && (
              <Button asChild className="mt-4 rounded-full" variant="outline">
                <Link to="/trips/$tripId/expenses/new" params={{ tripId: trip.id }}>Add Expense</Link>
              </Button>
            )}
          </div>
        ) : (
          expenses.map(expense => {
            const payers = (expense as any).expense_payers || []
            const payer = expense.payment_source === 'TRIP_WALLET'
              ? 'Trip Wallet'
              : payers.length > 1
                ? `${trip.trip_members?.find(m => m.id === payers[0].member_id)?.name || 'Unknown'} & ${payers.length - 1} other${payers.length - 1 > 1 ? 's' : ''}`
                : trip.trip_members?.find(m => m.id === (payers[0]?.member_id || expense.paid_by_member_id))?.name || 'Unknown'

            const isExpanded = expandedId === expense.id
            const splits = (expense as any).expense_splits || []
            const category = expense.category_id ? categories.find((c: any) => c.id === expense.category_id) : null
            const isUnpaid = expense.is_paid === false

            return (
              <Card key={expense.id} className={`glass-card overflow-hidden transition-all duration-300 border-border/50 ${isUnpaid ? 'border-l-2 border-l-amber-500/60' : ''}`}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  aria-label={`Details for ${expense.title}`}
                  onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setExpandedId(isExpanded ? null : expense.id) } }}
                  className="p-4 sm:p-3 flex items-center justify-between cursor-pointer hover:bg-muted/10 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : expense.id)}
                >
                  <div className="flex items-start space-x-3 sm:space-x-4 overflow-hidden">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${isUnpaid ? 'bg-amber-500/10' : 'bg-primary/10'}`}>
                      {isUnpaid ? <Clock className="w-5 h-5 text-amber-800 dark:text-amber-300" /> : <Receipt className="w-5 h-5 text-primary" />}
                    </div>
                    <div className="overflow-hidden pr-2">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="font-bold text-base sm:text-lg leading-tight truncate">{expense.title}</h2>
                        {isUnpaid && (
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 dark:text-amber-400 shrink-0">Est.</span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground font-medium truncate">
                        {format(fromDateOnly(expense.expense_date), 'MMM d, yyyy')} • Paid by {payer}
                      </p>
                      <div className="flex items-center mt-2 space-x-2 flex-wrap gap-y-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold bg-primary/10 text-primary">
                          {splits.length}/{trip.trip_members?.length || 0} Included
                        </span>
                        {category && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold bg-muted text-muted-foreground">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: category.color }} />
                            {category.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0 pl-2">
                    <div className="text-base sm:text-xl font-black text-foreground mb-1">
                      {formatMoney(expense.amount_paise, trip.currency)}
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 border-t border-border/30 bg-muted/5 animate-in-up">
                    <div className="pt-4">
                      {(expense as any).receipt_url && (
                        <div className="mb-4 text-sm bg-background/50 p-3 rounded-lg border border-border/50 flex justify-between items-center">
                          <span className="font-semibold text-muted-foreground flex items-center">
                            <ImageIcon className="w-4 h-4 mr-2" /> Receipt / Bill
                          </span>
                          <ReceiptViewer receipt={expense.receipt_url!} tripId={tripId} title={expense.title} />
                        </div>
                      )}

                      {expense.note && (
                        <div className="mb-4 text-sm bg-background/50 p-3 rounded-lg border border-border/50">
                          <span className="font-semibold text-muted-foreground block mb-1">Note</span>
                          {expense.note}
                        </div>
                      )}

                      <div className="flex justify-between items-center bg-background/50 p-3 rounded-lg border border-border/50 mb-4">
                        <span className="text-sm font-medium text-muted-foreground">Status</span>
                        <span className={`text-sm font-bold flex items-center gap-1.5 ${isUnpaid ? 'text-amber-800 dark:text-amber-300' : 'text-green-800 dark:text-green-300'}`}>
                          {isUnpaid ? <><Clock className="w-3.5 h-3.5" /> Estimated</> : <><CheckCircle2 className="w-3.5 h-3.5" /> Paid</>}
                        </span>
                      </div>

                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" size="sm" asChild className="hover:bg-primary/10 hover:text-primary hover:border-primary/30 flex-1 sm:flex-none">
                          <Link to="/trips/$tripId/expenses/$expenseId/edit" params={{ tripId: trip.id, expenseId: expense.id }}>
                            <Edit className="w-4 h-4 mr-2" /> Edit
                          </Link>
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setDeleteExpenseId(expense.id)} className="shadow-none flex-1 sm:flex-none">
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            )
          })
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteExpenseId}
        onClose={() => setDeleteExpenseId(null)}
        onConfirm={executeDelete}
        title="Delete Expense"
        description="This action cannot be undone. This will permanently delete the expense and remove it from all member balances."
        requiredText="delete"
        isDestructive={true}
      />

      <ConfirmModal
        isOpen={!!exportAction}
        onClose={() => setExportAction(null)}
        onConfirm={async () => { await exportAction?.() }}
        title="Export as PDF"
        confirmLabel="Download PDF"
        description={`Download ${expenses.length} currently shown expenses, with paid and estimated totals, payer contributions and member shares.`}
        requiredText=""
        isDestructive={false}
      />
    </div>
  )
}
