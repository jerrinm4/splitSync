import { LoadError } from '@/components/layout/LoadError'
import { fromDateOnly } from '@/lib/dates'
import { calculateWalletBalance } from '@/lib/balances'
import { useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from '@tanstack/react-router'
import { useTrip, useUpdateTrip, useDeleteTrip } from '@/features/trips/hooks/useTrip'
import { ManageCategoriesModal } from '@/components/expenses/ManageCategoriesModal'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { formatMoney, applyRounding } from '@/lib/money'
import type { RoundingMode } from '@/lib/money'
import { useToast } from '@/hooks/use-toast'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { Label } from '@/components/ui/label'
import { Receipt, Users, Link as LinkIcon, TrendingDown, ArrowRight, Plus, Wallet, ArrowUpRight, Edit, Trash, MoreVertical, CheckCircle2, Clock, Tag } from 'lucide-react'


export default function TripDashboardPage() {
  const { tripId } = useParams({ strict: false }) as { tripId: string }
  const { data: trip, isLoading, error, refetch } = useTrip(tripId)
  const updateTrip = useUpdateTrip()
  const { toast } = useToast()

  const navigate = useNavigate()
  const deleteTrip = useDeleteTrip()

  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  const [editName, setEditName] = useState('')
  const [editNote, setEditNote] = useState('')

  const allExpenses = useMemo(() => trip?.expenses || [], [trip])
  const categories = useMemo(() => trip?.expense_categories || [], [trip])
  const categoryBreakdown = useMemo(() => {
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
    return { categories: map, uncategorized }
  }, [allExpenses, categories])

  if (deleteTrip.isPending || deleteTrip.isSuccess) {
    return <div className="flex h-full items-center justify-center"><div className="animate-pulse text-muted-foreground font-medium">Deleting trip...</div></div>
  }
  if (isLoading) return <div className="flex h-full items-center justify-center"><div className="animate-pulse text-primary font-medium">Loading dashboard...</div></div>
  if (error || !trip) return <LoadError retry={refetch} />

  const walletBalance = calculateWalletBalance(trip.expenses, trip.fund_transactions);

  const handleCopyLink = async (url: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(url)
        toast({ title: 'Link copied to clipboard' })
        return
      } catch {
        // Clipboard access can be denied; show a copyable prompt below.
      }
    }
    window.prompt('Copy this link to share:', url)
  }

  const handleNativeShare = async (url: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Trip: ${trip.name}`,
          text: `Check out our trip expenses for ${trip.name}!`,
          url: url
        })
      } catch {
        // Closing the native share sheet requires no error message.
      }
    }
  }

  const paidExpenses = allExpenses.filter(e => e.is_paid !== false)
  const totalPaid = paidExpenses.reduce((acc, exp) => acc + exp.amount_paise, 0)
  const isOverdrawn = walletBalance < 0;

  const roundingMode = (trip.rounding_mode || 'PAISE') as RoundingMode
  const showEstimatedPerHead = trip.show_estimated_per_head !== false

  let finalEstimatedTripCost = 0;
  const expensesByCat: Record<string, number> = {};
  let uncategorizedExpenses = 0;
  allExpenses.forEach(exp => {
    if (exp.category_id) expensesByCat[exp.category_id] = (expensesByCat[exp.category_id] || 0) + exp.amount_paise;
    else uncategorizedExpenses += exp.amount_paise;
  });

  (trip.expense_categories || []).forEach((cat: any) => {
    const spentAndPlanned = expensesByCat[cat.id] || 0;
    const catEstimate = cat.estimated_amount_paise || 0;
    finalEstimatedTripCost += Math.max(spentAndPlanned, catEstimate);
  });

  Object.keys(expensesByCat).forEach(catId => {
    if (!(trip.expense_categories || []).find((c: any) => c.id === catId)) uncategorizedExpenses += expensesByCat[catId] || 0;
  });
  finalEstimatedTripCost += uncategorizedExpenses;

  const handleDeleteTrip = async () => {
    try {
      await deleteTrip.mutateAsync(trip.id)
      localStorage.removeItem('lastSelectedTrip')
      toast({ title: 'Trip deleted successfully' })
      navigate({ to: '/trips', search: { all: true } })
    } catch {
      toast({ title: 'Failed to delete trip', variant: 'destructive' })
    }
  }

  const handleEditTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editName.trim()) return

    try {
      await updateTrip.mutateAsync({ tripId: trip.id, updates: { name: editName.trim(), note: editNote.trim() } })
      toast({ title: 'Trip updated successfully' })
      setIsEditModalOpen(false)
    } catch {
      toast({ title: 'Failed to update trip', variant: 'destructive' })
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in-up pb-24 md:pb-8 md:px-8 mt-4 md:mt-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between px-2 pt-2 gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">{trip.name}</h1>
          <p className="text-sm font-medium text-muted-foreground mt-0.5">{trip.note || 'Overview of your trip expenses'}</p>
        </div>
        <div className="flex items-center space-x-2 self-end md:self-auto">
          <Dialog open={isShareModalOpen} onOpenChange={setIsShareModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full shadow-sm border-primary/20 hover:bg-primary/5 hover:text-primary transition-colors">
                <LinkIcon className="w-4 h-4 mr-2" /> Share Trip
              </Button>
            </DialogTrigger>
            <DialogContent className="glass border border-border/50 sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Share Trip</DialogTitle>
                <DialogDescription>
                  Anyone with this link can view the expenses and member balances for <strong>{trip.name}</strong>. Receipt images are available only to the owner and admins.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 pt-4">
                <div className="flex items-center space-x-4 bg-muted/30 p-4 rounded-xl border border-border/50">
                  <Switch
                    id="is_shared"
                    checked={trip.share_enabled}
                    onCheckedChange={async (checked) => {
                      const newToken = trip.share_token || crypto.randomUUID()
                      try {
                        await updateTrip.mutateAsync({ tripId: trip.id, updates: { share_token: newToken, share_enabled: checked } })
                      } catch {
                        toast({ title: 'Sharing was not updated', description: 'Check your connection and try again.', variant: 'destructive' })
                      }
                    }}
                    disabled={updateTrip.isPending}
                  />
                  <div className="space-y-1 flex-1 leading-none">
                    <label htmlFor="is_shared" className="text-sm font-semibold cursor-pointer">
                      Enable Shareable Link
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Allow others to view this trip via the link below.
                    </p>
                  </div>
                </div>

                {trip.share_enabled && trip.share_token && (
                  <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-2">
                      <Input
                        aria-label="Share link" readOnly
                        value={`${window.location.origin}/shared/${encodeURIComponent(trip.name.toLowerCase().replace(/\s+/g, '-'))}/${trip.share_token}`}
                        className="bg-background/50 font-mono text-xs text-muted-foreground"
                      />
                      <Button onClick={() => handleCopyLink(`${window.location.origin}/shared/${encodeURIComponent(trip.name.toLowerCase().replace(/\s+/g, '-'))}/${trip.share_token}`)} className="shrink-0 shadow-sm shadow-primary/20">
                        Copy
                      </Button>
                    </div>
                    {typeof navigator.share === 'function' && (
                      <Button variant="outline" className="w-full" onClick={() => handleNativeShare(`${window.location.origin}/shared/${encodeURIComponent(trip.name.toLowerCase().replace(/\s+/g, '-'))}/${trip.share_token}`)}>
                        <LinkIcon className="w-4 h-4 mr-2" /> Share via...
                      </Button>
                    )}

                    <div className="pt-4 border-t border-border/50">
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                        Password / PIN Protection
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          aria-label="Sharing PIN" placeholder="Optional PIN"
                          defaultValue={trip.share_pin || ''}
                          onBlur={async (e) => {
                            const newPin = e.target.value.trim()
                            if (newPin === (trip.share_pin || '')) return
                            try {
                              await updateTrip.mutateAsync({ tripId: trip.id, updates: { share_pin: newPin || null } })
                              toast({ title: 'Sharing PIN saved' })
                            } catch {
                              toast({ title: 'PIN was not saved', description: 'Check your connection and try again.', variant: 'destructive' })
                            }
                          }}
                          className="bg-background/50 font-mono text-sm"
                          type="password"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Leave blank for no password. Click outside the box to save.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Trip actions" className="h-9 w-9 rounded-full">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => {
                setEditName(trip.name)
                setEditNote(trip.note || '')
                setIsEditModalOpen(true)
              }}>
                <Edit className="mr-2 h-4 w-4" />
                <span>Edit Trip</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsDeleteModalOpen(true)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                <Trash className="mr-2 h-4 w-4" />
                <span>Delete Trip</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteTrip}
        title="Delete Trip"
        description={`Are you sure you want to delete "${trip.name}"? This action cannot be undone and will delete all expenses, members, and transactions associated with this trip.`}
        requiredText="DELETE"
      />

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Trip</DialogTitle>
            <DialogDescription>Update the trip name and note.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditTrip} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="tripName">Trip Name <span className="text-destructive">*</span></Label>
              <Input
                id="tripName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter Trip Name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tripNote">Note (Optional)</Label>
              <Input
                id="tripNote"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Enter Note"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={!editName.trim() || updateTrip.isPending}>Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="relative overflow-hidden rounded-3xl p-6 text-card-foreground shadow-xl bg-card border border-border">
        <div className="absolute top-0 right-0 p-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 p-24 bg-primary/5 rounded-full blur-2xl -ml-12 -mb-12 pointer-events-none"></div>

        <div className="relative z-10 flex flex-col gap-6">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-widest flex items-center">
              <Wallet className="w-4 h-4 mr-2" /> Total Balance
            </p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">
              {formatMoney(walletBalance)}
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-muted/50 p-4 rounded-2xl border border-border/50 backdrop-blur-sm">
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-800 dark:text-green-300" /> Paid
              </p>
              <p className="text-lg font-bold flex items-center text-foreground">
                <TrendingDown className="w-4 h-4 mr-1.5 text-red-700 dark:text-red-300" />
                {formatMoney(totalPaid)}
              </p>
            </div>
            {finalEstimatedTripCost > 0 && (
              <div>
                <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-800 dark:text-amber-300" /> Expected Total
                </p>
                <p className="text-lg font-bold text-amber-800 dark:text-amber-300">
                  {formatMoney(finalEstimatedTripCost)}
                </p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Per Head (Current)</p>
              <p className="text-lg font-bold text-foreground">
                {(trip.trip_members?.length || 0) > 0 ? formatMoney(applyRounding(Math.round(totalPaid / (trip.trip_members?.length || 1)), roundingMode, 'COLLECT')) : '—'}
              </p>
              {showEstimatedPerHead && finalEstimatedTripCost > 0 && (trip.trip_members?.length || 0) > 0 && (
                <p className="text-[10px] text-primary font-medium mt-1">
                  Est: {formatMoney(applyRounding(Math.round(finalEstimatedTripCost / (trip.trip_members?.length || 1)), roundingMode, 'COLLECT'))}
                </p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Status</p>
              <div className="flex items-center h-7">
                {isOverdrawn ? (
                  <span className="text-xs font-bold text-red-700 dark:text-red-300 bg-red-400/10 px-2.5 py-0.5 rounded-md border border-red-400/20">Overdrawn</span>
                ) : (
                  <span className="text-xs font-bold text-green-800 dark:text-green-300 bg-green-400/10 px-2.5 py-0.5 rounded-md border border-green-400/20">Healthy</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2 bg-background/40 p-3 rounded-2xl border border-border/50 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="bg-primary/20 text-primary p-2 rounded-xl">
                <Users className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-foreground">Total Members</span>
                <span className="text-xs text-muted-foreground font-medium">{trip.trip_members?.length || 0} active</span>
              </div>
            </div>
            <Link to="/trips/$tripId/members" params={{ tripId: trip.id }} aria-label="View trip members" className="flex -space-x-3 overflow-hidden hover:scale-105 transition-transform mr-1">
              {trip.trip_members?.slice(0, 5).map(m => (
                <div key={m.id} className="inline-block h-9 w-9 rounded-full bg-muted ring-4 ring-background flex items-center justify-center text-xs font-bold text-muted-foreground shadow-sm">
                  {m.name.substring(0, 2).toUpperCase()}
                </div>
              ))}
              {(trip.trip_members?.length || 0) > 5 && (
                <div className="inline-block h-9 w-9 rounded-full bg-primary/20 text-primary ring-4 ring-background flex items-center justify-center text-xs font-bold shadow-sm">
                  +{(trip.trip_members?.length || 0) - 5}
                </div>
              )}
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 md:gap-4 px-1">
        <Link to="/trips/$tripId/expenses/new" params={{ tripId: trip.id }} className="flex flex-col items-center gap-2 group">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-lg group-hover:shadow-primary/30 transition-all duration-300">
            <Plus className="w-6 h-6 md:w-7 md:h-7" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">Add</span>
        </Link>
        <Link to="/trips/$tripId/expenses" params={{ tripId: trip.id }} className="flex flex-col items-center gap-2 group">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-muted/50 text-foreground/70 flex items-center justify-center group-hover:bg-accent group-hover:text-accent-foreground group-hover:shadow-lg transition-all duration-300">
            <Receipt className="w-6 h-6 md:w-7 md:h-7" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">Expenses</span>
        </Link>
        <Link to="/trips/$tripId/funds" params={{ tripId: trip.id }} className="flex flex-col items-center gap-2 group">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-muted/50 text-foreground/70 flex items-center justify-center group-hover:bg-green-500/20 group-hover:text-green-600 group-hover:shadow-lg transition-all duration-300">
            <ArrowUpRight className="w-6 h-6 md:w-7 md:h-7" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">Funds</span>
        </Link>
        <Link to="/trips/$tripId/members" params={{ tripId: trip.id }} className="flex flex-col items-center gap-2 group">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-muted/50 text-foreground/70 flex items-center justify-center group-hover:bg-indigo-500/20 group-hover:text-indigo-600 group-hover:shadow-lg transition-all duration-300">
            <Users className="w-6 h-6 md:w-7 md:h-7" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">Members</span>
        </Link>
      </div>

      {(categories.length > 0 || allExpenses.length > 0) && (
        <div className="pt-2">
          <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" /> Categories
            </h3>
            <ManageCategoriesModal tripId={trip.id} />
          </div>

          <div className="bg-background/40 backdrop-blur-xl border border-border/50 rounded-3xl overflow-hidden shadow-sm">
            {categories.length > 0 && (
              <div className="divide-y divide-border/30">
                {categories.map((cat: any) => {
                  const data = categoryBreakdown.categories[cat.id]
                  if (!data || (data.total === 0 && data.estimated_amount_paise === 0)) return null;
                  return (
                    <div key={cat.id} className="flex items-center justify-between p-4 group">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        <div>
                          <p className="font-semibold text-sm text-foreground">{cat.name}</p>
                          <p className="text-[10px] text-muted-foreground font-medium">{data.count} expense{data.count !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-right">
                        <span className="text-xs text-muted-foreground"><span className="text-[10px] uppercase mr-1 ">Billed:</span>{formatMoney(data.paidTotal)}</span>
                        {Math.max(data.paidTotal + data.unpaidTotal, data.estimated_amount_paise) > 0 && (
                          <span className="text-xs font-bold text-primary"><span className="text-[10px] uppercase mr-1 ">Est:</span>{formatMoney(Math.max(data.paidTotal + data.unpaidTotal, data.estimated_amount_paise))}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
                {categoryBreakdown.uncategorized.count > 0 && (
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shrink-0 bg-muted-foreground/30" />
                      <div>
                        <p className="font-semibold text-sm text-muted-foreground">Uncategorized</p>
                        <p className="text-[10px] text-muted-foreground font-medium">{categoryBreakdown.uncategorized.count} expense{categoryBreakdown.uncategorized.count !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right">
                      <span className="text-xs text-muted-foreground"><span className="text-[10px] uppercase mr-1 ">Billed:</span>{formatMoney(categoryBreakdown.uncategorized.paidTotal)}</span>
                      {categoryBreakdown.uncategorized.paidTotal + categoryBreakdown.uncategorized.unpaidTotal > 0 && (
                        <span className="text-xs font-bold text-primary"><span className="text-[10px] uppercase mr-1 ">Est:</span>{formatMoney(categoryBreakdown.uncategorized.paidTotal + categoryBreakdown.uncategorized.unpaidTotal)}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      <div className="pt-6">
        <div className="flex items-center justify-between mb-4 px-2">
          <h3 className="text-lg font-bold tracking-tight">Recent Activity</h3>
          <Link to="/trips/$tripId/expenses" params={{ tripId: trip.id }} className="text-sm font-semibold text-primary hover:underline flex items-center">
            See all <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>

        <div className="bg-background/40 backdrop-blur-xl border border-border/50 rounded-3xl overflow-hidden shadow-sm">
          {trip.expenses?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Receipt className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p className="font-semibold text-foreground">No expenses yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-[200px]">Add your first expense to start tracking your trip.</p>
              <Button asChild className="mt-6 rounded-full" variant="outline">
                <Link to="/trips/$tripId/expenses/new" params={{ tripId: trip.id }}>Add Expense</Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {trip.expenses?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5).map(exp => {
                const category = exp.category_id ? categories.find((c: any) => c.id === exp.category_id) : null
                return (
                  <Link
                    key={exp.id}
                    to="/trips/$tripId/expenses/$expenseId/edit" params={{ tripId: trip.id, expenseId: exp.id }}
                    className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${exp.is_paid === false ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300' : 'bg-primary/10 text-primary'}`}>
                        {exp.is_paid === false ? <Clock className="w-5 h-5" /> : <Receipt className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-foreground">{exp.title}</p>
                          {exp.is_paid === false && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 dark:text-amber-400">Est.</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs font-medium text-muted-foreground">{fromDateOnly(exp.expense_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          {category && (
                            <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }} />
                              {category.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-foreground">
                        {formatMoney(exp.amount_paise)}
                      </p>
                      <p className="text-xs font-medium text-muted-foreground mt-0.5 flex items-center justify-end">
                        {exp.payment_source === 'TRIP_WALLET' ? 'Wallet' : 'Member'}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
