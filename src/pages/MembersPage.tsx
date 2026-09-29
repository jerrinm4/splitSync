import { LoadError } from '@/components/layout/LoadError'
import { fromDateOnly } from '@/lib/dates'
import { calculateMemberBalances } from '@/lib/balances'
import { useState, useMemo } from 'react'
import { useParams, Link } from '@tanstack/react-router'
import { useMembers, useAddMember } from '@/features/members/hooks/useMembers'
import { useTrip } from '@/features/trips/hooks/useTrip'
import { useUpdateExpense } from '@/features/expenses/hooks/useExpenses'
import { calculateEqualSplits, formatMoney, applyRounding } from '@/lib/money'
import type { RoundingMode } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Checkbox } from '@/components/ui/checkbox'
import { ManageGroupsModal } from '@/components/members/ManageGroupsModal'
import { ChevronRight, UserPlus, Receipt, TrendingUp, TrendingDown, RefreshCcw, Download, Search, Filter, ArrowUpDown, Wallet, Copy } from 'lucide-react'
import { ConfirmModal } from '@/components/ui/confirm-modal'

export default function MembersPage() {
  const { tripId } = useParams({ strict: false }) as { tripId: string }
  const { data: members, isLoading: membersLoading } = useMembers(tripId)
  const { data: trip, isLoading: tripLoading, refetch } = useTrip(tripId)

  const addMember = useAddMember()
  const updateExpense = useUpdateExpense()
  const { toast } = useToast()

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [selectedPastExpenses, setSelectedPastExpenses] = useState<string[]>([])
  const [exportAction, setExportAction] = useState<(() => Promise<void>) | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState('ALL') // ALL, ACTIVE, INACTIVE, OWES, GETS_BACK, SETTLED
  const [sortType, setSortType] = useState('NAME_ASC') // DEFAULT, NAME_ASC, NAME_DESC, COST_HIGH, COST_LOW, BALANCE_HIGH, BALANCE_LOW

  const equalExpenses = useMemo(() => {
    if (!trip?.expenses) return []
    return trip.expenses.filter(e => e.split_method === 'EQUAL')
  }, [trip])

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      const newMember = await addMember.mutateAsync({ tripId, name, note })

      if (selectedPastExpenses.length > 0) {
        toast({ title: 'Member added', description: `Updating ${selectedPastExpenses.length} past expenses...` })

        for (const expId of selectedPastExpenses) {
          const expToUpdate = equalExpenses.find(e => e.id === expId)
          if (!expToUpdate) continue

          const existingSplits = (expToUpdate as any).expense_splits || []
          const uniqueMemberIds = Array.from(new Set([
            ...existingSplits.map((s: any) => s.member_id),
            newMember.id // Include the newly created member!
          ]))

          const newSplits = calculateEqualSplits(expToUpdate.amount_paise, uniqueMemberIds)

          await updateExpense.mutateAsync({
            expenseId: expToUpdate.id,
            expectedVersion: expToUpdate.version,
            payers: expToUpdate.expense_payers.map(payer => ({ memberId: payer.member_id, amountPaise: payer.amount_paise })),
            tripId,
            title: expToUpdate.title,
            amountPaise: expToUpdate.amount_paise,
            expenseDate: fromDateOnly(expToUpdate.expense_date),
            paymentSource: expToUpdate.payment_source as any,
            paidByMemberId: expToUpdate.paid_by_member_id || undefined,
            splitMethod: 'EQUAL',
            note: expToUpdate.note || '',
            splits: newSplits,
            isPaid: expToUpdate.is_paid,
            categoryId: expToUpdate.category_id || undefined,
            receiptUrl: expToUpdate.receipt_url || undefined
          })
        }
        toast({ title: 'Success!', description: `${name} was added to ${selectedPastExpenses.length} past expenses.` })
      } else {
        toast({ title: 'Member added' })
      }

      setOpen(false)
      setName('')
      setNote('')
      setSelectedPastExpenses([])
    } catch (err: any) {
      toast({ title: 'Error adding member', description: err.message, variant: 'destructive' })
    }
  }

  const memberBalances = useMemo(() => calculateMemberBalances(
    trip?.trip_members || [], trip?.expenses || [], trip?.fund_transactions || []
  ), [trip])

  const filteredAndSortedMembers = useMemo(() => {
    if (!members) return []
    let result = [...members]

    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase()
      result = result.filter(m => m.name.toLowerCase().includes(lowerQ) || m.note?.toLowerCase().includes(lowerQ))
    }

    if (filterType === 'ACTIVE') {
      result = result.filter(m => m.status !== 'INACTIVE')
    } else if (filterType === 'INACTIVE') {
      result = result.filter(m => m.status === 'INACTIVE')
    } else if (filterType === 'OWES') {
      result = result.filter(m => (memberBalances[m.id]?.finalBalance || 0) < 0)
    } else if (filterType === 'GETS_BACK') {
      result = result.filter(m => (memberBalances[m.id]?.finalBalance || 0) > 0)
    } else if (filterType === 'SETTLED') {
      result = result.filter(m => (memberBalances[m.id]?.finalBalance || 0) === 0)
    }

    switch (sortType) {
      case 'NAME_ASC':
        result.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'NAME_DESC':
        result.sort((a, b) => b.name.localeCompare(a.name))
        break
      case 'COST_HIGH':
        result.sort((a, b) => (memberBalances[b.id]?.totalOwed || 0) - (memberBalances[a.id]?.totalOwed || 0))
        break
      case 'COST_LOW':
        result.sort((a, b) => (memberBalances[a.id]?.totalOwed || 0) - (memberBalances[b.id]?.totalOwed || 0))
        break
      case 'BALANCE_HIGH':
        result.sort((a, b) => (memberBalances[b.id]?.finalBalance || 0) - (memberBalances[a.id]?.finalBalance || 0))
        break
      case 'BALANCE_LOW':
        result.sort((a, b) => (memberBalances[a.id]?.finalBalance || 0) - (memberBalances[b.id]?.finalBalance || 0))
        break
      default:
        // DEFAULT: active first, then by creation date
        result.sort((a, b) => {
          if (a.status === 'INACTIVE' && b.status !== 'INACTIVE') return 1
          if (a.status !== 'INACTIVE' && b.status === 'INACTIVE') return -1
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        })
    }

    return result
  }, [members, searchQuery, filterType, sortType, memberBalances])

  const memberExpenseCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    if (!trip?.expenses) return counts

    trip.expenses.filter(e => e.is_paid !== false).forEach(exp => {
      const splits = (exp as any).expense_splits || []
      splits.forEach((s: any) => {
        counts[s.member_id] = (counts[s.member_id] || 0) + 1
      })
    })
    return counts
  }, [trip])

  // Generate a consistent avatar gradient based on name
  const getAvatarGradient = (name: string) => {
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    const gradients = [
      'from-violet-500/20 to-indigo-500/20',
      'from-rose-500/20 to-pink-500/20',
      'from-emerald-500/20 to-teal-500/20',
      'from-amber-500/20 to-orange-500/20',
      'from-cyan-500/20 to-blue-500/20',
      'from-fuchsia-500/20 to-purple-500/20',
      'from-lime-500/20 to-green-500/20',
      'from-sky-500/20 to-indigo-500/20',
    ]
    const textColors = [
      'text-violet-500',
      'text-rose-500',
      'text-emerald-500',
      'text-amber-800 dark:text-amber-300',
      'text-cyan-500',
      'text-fuchsia-500',
      'text-lime-600',
      'text-sky-500',
    ]
    const idx = Math.abs(hash) % gradients.length
    return { gradient: gradients[idx], textColor: textColors[idx] }
  }

  const toggleExpenseSelection = (expenseId: string, checked: boolean) => {
    setSelectedPastExpenses(prev =>
      checked ? [...prev, expenseId] : prev.filter(id => id !== expenseId)
    )
  }

  const handleCopyFundSummary = async (isDetailed: boolean = false) => {
    if (!members || !trip) return

    let text = isDetailed ? `*🧾 Detailed Ledger 📊*\n-----------------------------\n` : `*💰 Fund Overview ✨*\n-----------------------------\n`
    let total = 0
    let index = 1

    filteredAndSortedMembers.forEach(member => {
      const stats = memberBalances[member.id] || { totalPaid: 0, totalOwed: 0, walletContribution: 0, finalBalance: 0 }
      const memberTotal = stats.totalPaid + stats.walletContribution

      if (memberTotal > 0) {
        text += `${index}. ${member.name} - ${formatMoney(memberTotal, trip.currency)}✅\n`
        total += memberTotal
      } else {
        text += `${index}. ${member.name} 🚨\n`
      }
      index++
    })

    const billedExpensesList = trip.expenses?.filter(e => e.is_paid !== false) || [];
    const totalBilledExpenses = billedExpensesList.reduce((sum, exp) => sum + exp.amount_paise, 0);

    if (isDetailed) {
      text += `-----------------------------\n*Total Paid: ${formatMoney(total, trip.currency)}*\n*Total Used: ${formatMoney(totalBilledExpenses, trip.currency)}*\n-----------------------------\n`
      if (billedExpensesList.length > 0) {
        text += `\n*Expenses*\n-----------------------------\n`
        billedExpensesList.forEach(exp => {
          const catName = trip.expense_categories?.find(c => c.id === exp.category_id)?.name || 'General'
          text += `${exp.title} (${catName}) - ${formatMoney(exp.amount_paise, trip.currency)}\n`
        })
        text += `-----------------------------\n`
      }
      text += `*Remaining Balance: ${formatMoney(total - totalBilledExpenses, trip.currency)}*\n-----------------------------`
    } else {
      text += `-----------------------------\n*Total: ${formatMoney(total, trip.currency)}*\n*Total Used: ${formatMoney(totalBilledExpenses, trip.currency)}*\n-----------------------------`
    }

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text)
        toast({ title: 'Summary copied to clipboard!' })
      } catch {
        toast({ title: 'Failed to copy', variant: 'destructive' })
      }
    } else {
      toast({ title: 'Clipboard not supported', variant: 'destructive' })
    }
  }

  if (membersLoading || tripLoading) return <div className="flex justify-center items-center h-40"><div className="animate-pulse text-primary">Loading members...</div></div>
  if (!trip) return <LoadError retry={refetch} />

  return (
    <div className="space-y-6 animate-in-up pb-20 md:pb-0">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Members</h1>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-full shadow-sm hidden sm:flex">
                <Copy className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Copy</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleCopyFundSummary(false)}>
                Copy Summary
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCopyFundSummary(true)}>
                Copy Detailed
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-full shadow-sm sm:hidden w-9 h-9 p-0" title="Copy Fund Summary">
                <Copy className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleCopyFundSummary(false)}>
                Copy Summary
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCopyFundSummary(true)}>
                Copy Detailed
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" aria-label="Export member balances as PDF" onClick={() => setExportAction(() => async () => { const { exportMembersPDF } = await import('@/lib/pdf'); await exportMembersPDF(trip, members || []) })} className="rounded-full shadow-sm">
            <Download className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Export</span>
          </Button>

          <ManageGroupsModal
            tripId={trip?.id || ''}
            members={members || []}
            groups={trip?.trip_member_groups || []}
          />

          <Dialog open={open} onOpenChange={(o) => {
            setOpen(o)
            if (!o) { setName(''); setNote(''); setSelectedPastExpenses([]); }
          }}>
            <DialogTrigger asChild>
              <Button aria-label="Add member" className="rounded-full shadow-lg shadow-primary/20"><UserPlus className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Add Member</span></Button>
            </DialogTrigger>
            <DialogContent className="glass border border-border/50 max-h-[90vh] overflow-y-auto no-scrollbar">
              <DialogHeader>
                <DialogTitle>Add a new member</DialogTitle>
            <DialogDescription>Add a traveler and optionally include them in existing equal-split expenses.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddMember} className="space-y-6 pt-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="bg-background/50" placeholder="Enter name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="note">Note (Optional)</Label>
                    <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} className="bg-background/50" placeholder="Enter note" />
                  </div>
                </div>

                {equalExpenses.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-border/50">
                    <div className="flex items-center text-sm font-semibold text-primary">
                      <RefreshCcw className="w-4 h-4 mr-2" /> Auto-split Past Expenses?
                    </div>
                    <p className="text-xs text-muted-foreground">Select past EQUAL expenses to retroactively add {name || 'this member'} to.</p>

                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 no-scrollbar">
                      {equalExpenses.map(exp => {
                        const isSelected = selectedPastExpenses.includes(exp.id)
                        const splits = (exp as any).expense_splits || []
                        const currentMemberCount = new Set(splits.map((s: any) => s.member_id)).size
                        const currentAmountPerPerson = currentMemberCount > 0 ? exp.amount_paise / currentMemberCount : 0
                        const newAmountPerPerson = exp.amount_paise / (currentMemberCount + 1)

                        return (
                          <div key={exp.id} className={`flex flex-col p-3 rounded-lg border transition-all cursor-pointer ${isSelected ? 'bg-primary/5 border-primary/30 shadow-sm' : 'bg-background/50 border-border/30 '}`} onClick={() => toggleExpenseSelection(exp.id, !isSelected)}>
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                              <div className="flex items-center space-x-3">
                                <Checkbox
                                  aria-label={`Include ${exp.title}`} onClick={event => event.stopPropagation()}
                                  checked={isSelected}
                                  onCheckedChange={(c) => toggleExpenseSelection(exp.id, c as boolean)}
                                  className="w-4 h-4 rounded-md"
                                />
                                <span className="font-semibold text-sm truncate max-w-[150px] flex items-center gap-2">
                                  {exp.title}
                                  <Badge variant={exp.is_paid !== false ? "default" : "secondary"} className="text-[9px] px-1.5 py-0 h-4 uppercase scale-90 origin-left">
                                    {exp.is_paid !== false ? 'Billed' : 'Estimated'}
                                  </Badge>
                                </span>
                              </div>
                              <span className="font-bold text-sm">{formatMoney(exp.amount_paise, trip?.currency)}</span>
                            </div>

                            <div className="pl-7 flex items-center space-x-2 text-xs">
                              <span className="text-muted-foreground line-through">{formatMoney(currentAmountPerPerson, trip?.currency)}</span>
                              <span className="text-muted-foreground">→</span>
                              <span className={isSelected ? 'text-green-800 dark:text-green-300 font-bold' : 'text-muted-foreground'}>{formatMoney(newAmountPerPerson, trip?.currency)} / person</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full shadow-lg shadow-primary/20 h-11" disabled={addMember.isPending || updateExpense.isPending}>
                  {addMember.isPending || updateExpense.isPending ? 'Processing...' : `Add ${name || 'Member'}`}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background/50 border-border/50 h-10"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <select aria-label="Filter members"               className="w-full h-10 pl-3 pr-8 rounded-md border border-border/50 bg-background/50 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="ALL">All Members</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="OWES">Owes Money</option>
              <option value="GETS_BACK">Gets Back</option>
              <option value="SETTLED">Settled (Zero)</option>
            </select>
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          <div className="relative flex-1">
            <select aria-label="Sort members"               className="w-full h-10 pl-3 pr-8 rounded-md border border-border/50 bg-background/50 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={sortType}
              onChange={(e) => setSortType(e.target.value)}
            >
              <option value="DEFAULT">Sort: Default</option>
              <option value="NAME_ASC">Name: A → Z</option>
              <option value="NAME_DESC">Name: Z → A</option>
              <option value="COST_HIGH">Cost: High → Low</option>
              <option value="COST_LOW">Cost: Low → High</option>
              <option value="BALANCE_HIGH">Balance: High → Low</option>
              <option value="BALANCE_LOW">Balance: Low → High</option>
            </select>
            <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="flex flex-col space-y-3">
        {filteredAndSortedMembers.map((member) => {
          const stats = memberBalances[member.id] || { totalPaid: 0, totalOwed: 0, walletContribution: 0, finalBalance: 0 }
          const isNegative = stats.finalBalance < 0
          const isPositive = stats.finalBalance > 0
          const isInactive = member.status === 'INACTIVE'
          const expCount = memberExpenseCounts[member.id] || 0
          const totalExpCount = trip?.expenses?.filter(e => e.is_paid !== false).length || 0
          const participationPct = totalExpCount > 0 ? Math.round((expCount / totalExpCount) * 100) : 0
          const { gradient, textColor } = getAvatarGradient(member.name)

          return (
            <Link key={member.id} to="/trips/$tripId/members/$memberId" params={{ tripId: tripId, memberId: member.id }} className={`block ${isInactive ? 'opacity-50' : ''}`}>
              <div className={`relative overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg group ${isNegative ? 'border-l-[3px] border-l-red-500 border-r border-t border-b border-border/40'
                : isPositive ? 'border-l-[3px] border-l-green-500 border-r border-t border-b border-border/40'
                  : 'border-border/40'
                } bg-card`}>

                <div className="p-4 pb-3">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-inner`}>
                      <span className={`font-bold text-base ${textColor}`}>
                        {member.name.substring(0, 2).toUpperCase()}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground truncate text-base">{member.name}</span>
                        {isInactive && <Badge variant="secondary" className="text-[9px] px-1.5 h-4">Inactive</Badge>}
                      </div>
                      {member.note && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{member.note}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                          <Receipt className="w-3 h-3 " />
                          {expCount}/{totalExpCount}
                        </span>
                        <div className="flex-1 max-w-[80px] h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary/40 rounded-full transition-all"
                            style={{ width: `${participationPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-medium">{participationPct}%</span>
                      </div>
                    </div>

                    <div className={`flex flex-col items-end shrink-0 ${isNegative ? 'text-destructive' : isPositive ? 'text-green-800 dark:text-green-300' : 'text-foreground'}`}>
                      <span className="text-[9px] font-bold uppercase tracking-wider  mb-0.5">
                        {isNegative ? 'Owes' : isPositive ? 'Gets Back' : 'Settled'}
                      </span>
                      <div className="flex items-center font-black text-base">
                        {isNegative ? <TrendingDown className="w-4 h-4 mr-1" /> : isPositive ? <TrendingUp className="w-4 h-4 mr-1" /> : null}
                        {formatMoney(applyRounding(Math.abs(stats.finalBalance), (trip?.rounding_mode || 'PAISE') as RoundingMode, isNegative ? 'COLLECT' : 'RETURN'), trip?.currency)}
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden md:block shrink-0" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-px bg-border/30 border-t border-border/30">
                  <div className="bg-card px-3 py-2.5 text-center">
                    <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Paid</p>
                    <p className="text-xs font-bold text-foreground mt-0.5">{formatMoney(applyRounding(stats.totalPaid, (trip?.rounding_mode || 'PAISE') as RoundingMode, 'COLLECT'), trip?.currency)}</p>
                  </div>
                  <div className="bg-card px-3 py-2.5 text-center">
                    <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">Share</p>
                    <p className="text-xs font-bold text-foreground mt-0.5">{formatMoney(applyRounding(stats.totalOwed, (trip?.rounding_mode || 'PAISE') as RoundingMode, 'COLLECT'), trip?.currency)}</p>
                  </div>
                  <div className="bg-card px-3 py-2.5 text-center">
                    <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
                      <Wallet className="w-3 h-3" /> Wallet
                    </p>
                    <p className="text-xs font-bold text-foreground mt-0.5">{formatMoney(applyRounding(stats.walletContribution, (trip?.rounding_mode || 'PAISE') as RoundingMode, 'COLLECT'), trip?.currency)}</p>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}

        {filteredAndSortedMembers.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground glass-card rounded-xl border border-dashed border-border mt-4">
            {searchQuery || filterType !== 'ALL' ? 'No members match your search/filter.' : 'No members yet. Add someone to start splitting!'}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!exportAction}
        onClose={() => setExportAction(null)}
        onConfirm={async () => { await exportAction?.() }}
        title="Export as PDF"
        confirmLabel="Download PDF"
        description="Download balances for all trip members, including direct payments, wallet contributions and refunds."
        requiredText=""
        isDestructive={false}
      />
    </div>
  )
}
