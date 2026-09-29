import { LoadError } from '@/components/layout/LoadError'
import { calculateWalletBalance } from '@/lib/balances'
import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTrip } from '@/features/trips/hooks/useTrip'
import { useManageFunds } from '@/features/funds/hooks/useFunds'
import { addFundSchema } from '@/lib/validation'
import { formatMoney, parseMoneyToPaise } from '@/lib/money'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Plus, Minus, CreditCard } from 'lucide-react'

type FundFormValues = z.infer<typeof addFundSchema>

export default function FundsPage() {
  const { tripId } = useParams({ strict: false }) as { tripId: string }
  const { data: trip, isLoading, refetch } = useTrip(tripId)
  const manageFunds = useManageFunds()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [actionType, setActionType] = useState<'ADD' | 'REMOVE'>('ADD')
  const [confirmFundData, setConfirmFundData] = useState<FundFormValues | null>(null)

  const form = useForm<FundFormValues>({
    resolver: zodResolver(addFundSchema),
    defaultValues: { memberId: '', amountString: '', note: '' }
  })

  const onSubmit = (data: FundFormValues) => {
    setConfirmFundData(data)
  }

  const executeManageFunds = async () => {
    if (!confirmFundData) return
    try {
      await manageFunds.mutateAsync({
        action: actionType,
        tripId,
        memberId: confirmFundData.memberId,
        amountPaise: parseMoneyToPaise(confirmFundData.amountString),
        note: confirmFundData.note
      })
      toast({ title: `Funds ${actionType === 'ADD' ? 'added' : 'removed'} successfully` })
      setOpen(false)
      setConfirmFundData(null)
      form.reset()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  if (isLoading) return <div className="flex justify-center items-center h-40"><div className="animate-pulse text-primary">Loading funds...</div></div>
  if (!trip) return <LoadError retry={refetch} />

  const walletBalance = calculateWalletBalance(trip.expenses, trip.fund_transactions);

  let finalEstimatedTripCost = 0;
  const expensesByCat: Record<string, number> = {};
  let uncategorizedExpenses = 0;
  (trip.expenses || []).forEach(exp => {
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

  // Assuming the final estimated trip cost is the overall budget, the projected balance subtracts the final estimated trip cost from the total funds added.
  const projectedBalance = calculateWalletBalance([], trip.fund_transactions) - finalEstimatedTripCost;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in-up pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight mb-2">Trip Wallet</h1>
          <p className="text-muted-foreground font-medium flex items-center">
            <Wallet className="w-4 h-4 mr-2" /> Shared Funds Management
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="glass-card md:col-span-1 bg-gradient-to-br from-primary/20 via-background to-background relative overflow-hidden border-primary/20">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <CreditCard className="w-24 h-24 text-primary" />
          </div>
          <CardHeader className="pb-2 relative z-10">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Current Balance</CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 pb-6">
            <div className="text-5xl font-black text-foreground tracking-tighter">
              {formatMoney(walletBalance, trip.currency)}
            </div>

            {finalEstimatedTripCost > 0 && (
              <div className="mt-4 p-3 bg-muted/50 rounded-xl border border-border/50">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Projected Balance</span>
                  <span className={`text-sm font-bold ${projectedBalance >= 0 ? 'text-green-800 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                    {formatMoney(projectedBalance, trip.currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground">Based on Total Estimated Budget</span>
                  <span className="text-[10px] font-semibold">{formatMoney(finalEstimatedTripCost, trip.currency)}</span>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-6">
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full shadow-lg shadow-primary/20" onClick={() => setActionType('ADD')}>
                    <Plus className="w-4 h-4 mr-2" /> Add
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass border border-border/50">
                  <DialogHeader>
                    <DialogTitle>{actionType === 'ADD' ? 'Add Funds to Wallet' : 'Withdraw Funds'}</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                      <FormField
                        control={form.control}
                        name="memberId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Member</FormLabel>
                            <FormControl>
                              <select
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background/50 px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                {...field}
                              >
                                <option value="">Select a member...</option>
                                {trip.trip_members?.map(m => (
                                  <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="amountString"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount (₹)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} className="bg-background/50 font-bold" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="note"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Note (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter note" {...field} className="bg-background/50" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full shadow-lg shadow-primary/20">
                        Continue
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
              <Button variant="outline" className="w-full bg-background/50" onClick={() => { setActionType('REMOVE'); setOpen(true); }}>
                <Minus className="w-4 h-4 mr-2" /> Withdraw
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card md:col-span-2 border-border/50 flex flex-col h-full">
          <CardHeader className="border-b border-border/30 pb-4">
            <CardTitle className="text-lg">Transaction History</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 flex-1">
            {trip.fund_transactions?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-muted-foreground">
                <Wallet className="w-12 h-12 mb-3 opacity-20" />
                <p>No transactions yet.</p>
                <p className="text-sm opacity-60">Add funds to start the shared wallet.</p>
              </div>
            ) : (
              <div role="region" aria-label="Wallet transactions" tabIndex={0} className="space-y-3 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                {trip.fund_transactions?.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()).map(tx => {
                  const member = trip.trip_members?.find(m => m.id === tx.member_id)
                  const isAdd = tx.transaction_type === 'ADD'

                  return (
                    <div key={tx.id} className="flex justify-between items-center bg-muted/10 p-4 rounded-xl border border-border/30 transition-colors hover:bg-muted/20">
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isAdd ? 'bg-green-500/10 text-green-800 dark:text-green-300' : 'bg-red-500/10 text-red-700 dark:text-red-300'}`}>
                          {isAdd ? <ArrowDownToLine className="w-5 h-5" /> : <ArrowUpFromLine className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-bold text-foreground">
                            {member?.name || 'Unknown Member'}
                          </p>
                          <p className="text-xs text-muted-foreground font-medium">
                            {format(new Date(tx.occurred_at), 'MMM d, h:mm a')}
                            {tx.note && <span className=""> • {tx.note}</span>}
                          </p>
                        </div>
                      </div>
                      <div className={`font-black text-lg ${isAdd ? 'text-green-800 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                        {isAdd ? '+' : '-'}{formatMoney(tx.amount_paise, trip.currency)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!confirmFundData} onOpenChange={(open) => !open && setConfirmFundData(null)}>
        <DialogContent className="sm:max-w-md glass">
          <DialogHeader>
            <DialogTitle>Confirm Transaction</DialogTitle>
            <DialogDescription>Please review the fund transaction details.</DialogDescription>
          </DialogHeader>
          {confirmFundData && (
            <div className="space-y-4 py-4">
              <div className="flex justify-between items-center bg-background/50 p-3 rounded-lg border border-border/50">
                <span className="font-semibold text-muted-foreground">Action</span>
                <span className={`font-bold ${actionType === 'ADD' ? 'text-green-800 dark:text-green-300' : 'text-orange-500'}`}>
                  {actionType === 'ADD' ? 'Add Funds' : 'Withdraw Funds'}
                </span>
              </div>
              <div className="flex justify-between items-center bg-background/50 p-3 rounded-lg border border-border/50">
                <span className="font-semibold text-muted-foreground">Member</span>
                <span className="font-bold">{trip.trip_members?.find(m => m.id === confirmFundData.memberId)?.name || 'Unknown'}</span>
              </div>
              <div className="flex justify-between items-center bg-background/50 p-3 rounded-lg border border-border/50">
                <span className="font-semibold text-muted-foreground">Amount</span>
                <span className="font-bold text-lg">{formatMoney(parseMoneyToPaise(confirmFundData.amountString), trip?.currency)}</span>
              </div>
            </div>
          )}
          <DialogFooter className="sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmFundData(null)}>Cancel</Button>
            <Button type="button" onClick={executeManageFunds} disabled={manageFunds.isPending}>
              {manageFunds.isPending ? 'Processing...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
