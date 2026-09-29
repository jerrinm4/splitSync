import { LoadError } from '@/components/layout/LoadError'
import { ReceiptViewer } from '@/components/expenses/ReceiptViewer'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { fromDateOnly } from '@/lib/dates'
import { useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTrip } from '@/features/trips/hooks/useTrip'
import { useUpdateMember, useDeleteMember } from '@/features/members/hooks/useMembers'
import { useManageFunds } from '@/features/funds/hooks/useFunds'
import { useUpdateExpense } from '@/features/expenses/hooks/useExpenses'
import { formatMoney, parseMoneyToPaise, calculateEqualSplits } from '@/lib/money'
import { addFundSchema } from '@/lib/validation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { Receipt, ArrowLeft, ArrowRight, Wallet, ArrowDownRight, ArrowUpRight, Edit, UserMinus, UserCheck, MoreVertical, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'

export default function MemberDetailPage() {
  const { tripId, memberId } = useParams({ strict: false }) as { tripId: string, memberId: string }
  const navigate = useNavigate()
  const { data: trip, isLoading, refetch } = useTrip(tripId)
  const manageFunds = useManageFunds()
  const updateMember = useUpdateMember()
  const deleteMember = useDeleteMember()
  const updateExpense = useUpdateExpense()
  const { toast } = useToast()

  const [exportOpen, setExportOpen] = useState(false)
  const [openFunds, setOpenFunds] = useState(false)
  const [actionType, setActionType] = useState<'ADD' | 'REMOVE'>('ADD')
  const [confirmFundData, setConfirmFundData] = useState<z.infer<typeof addFundSchema> | null>(null)

  const [openEdit, setOpenEdit] = useState(false)
  const [editName, setEditName] = useState('')
  const [editNote, setEditNote] = useState('')

  const [openStatusConfirm, setOpenStatusConfirm] = useState(false)
  const [selectedExpensesToUpdate, setSelectedExpensesToUpdate] = useState<string[]>([])

  const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const member = trip?.trip_members?.find(m => m.id === memberId)

  const form = useForm<z.infer<typeof addFundSchema>>({
    resolver: zodResolver(addFundSchema),
    defaultValues: { memberId: memberId || '', amountString: '', note: '' }
  })

  const involvedExpenses = useMemo(() => {
    return trip?.expenses?.filter(e => (e as any).expense_splits?.some((s: any) => s.member_id === memberId)) || []
  }, [trip, memberId])

  const unInvolvedExpenses = useMemo(() => {
    return trip?.expenses?.filter(e => !(e as any).expense_splits?.some((s: any) => s.member_id === memberId)) || []
  }, [trip, memberId])

  // EQUAL splits for disable/enable checkboxes
  const involvedEqualExpenses = useMemo(() => {
    return involvedExpenses.filter(e => e.split_method === 'EQUAL')
  }, [involvedExpenses])

  const unInvolvedEqualExpenses = useMemo(() => {
    return unInvolvedExpenses.filter(e => e.split_method === 'EQUAL')
  }, [unInvolvedExpenses])

  const memberFunds = useMemo(() => {
    return trip?.fund_transactions?.filter(f => f.member_id === memberId) || []
  }, [trip, memberId])

  const walletContribution = memberFunds.reduce((acc, tx) => {
    return tx.transaction_type === 'ADD' ? acc + tx.amount_paise : acc - tx.amount_paise
  }, 0)

  const onFundSubmit = (data: z.infer<typeof addFundSchema>) => {
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
      setOpenFunds(false)
      setConfirmFundData(null)
      form.reset()
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editName.trim()) return
    try {
      await updateMember.mutateAsync({
        tripId,
        memberId,
        name: editName.trim(),
        note: editNote.trim() || undefined
      })
      toast({ title: 'Member updated successfully' })
      setOpenEdit(false)
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  const hasFinancialHistory = memberFunds.length > 0 || trip?.expenses.some(expense =>
    expense.paid_by_member_id === memberId || expense.expense_payers?.some(payer => payer.member_id === memberId) || expense.expense_splits?.some(split => split.member_id === memberId)
  )

  const handleDeleteMember = () => setOpenDeleteConfirm(true)
  const handleConfirmDelete = async () => {
    if (hasFinancialHistory) return
    setIsDeleting(true)
    try {
      await deleteMember.mutateAsync({ tripId, memberId })
      toast({ title: 'Member deleted' })
      navigate({ to: '/trips/$tripId/members', params: { tripId } })
    } catch (error) {
      toast({ title: 'Could not delete member', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' })
    } finally { setIsDeleting(false) }
  }

  const handleToggleStatus = async () => {
    if (!member) return;
    try {
      await updateMember.mutateAsync({
        tripId,
        memberId,
        name: member.name,
        status: member.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
      })

      if (selectedExpensesToUpdate.length > 0) {
        toast({ title: `Member ${member.status === 'ACTIVE' ? 'disabled' : 'enabled'}`, description: `Updating ${selectedExpensesToUpdate.length} expenses...` })

        const expensesList = member.status === 'ACTIVE' ? involvedEqualExpenses : unInvolvedEqualExpenses

        for (const expId of selectedExpensesToUpdate) {
          const expToUpdate = expensesList.find(e => e.id === expId)
          if (!expToUpdate) continue

          const existingSplits = (expToUpdate as any).expense_splits || []
          let uniqueMemberIds = []

          if (member.status === 'ACTIVE') {
            uniqueMemberIds = existingSplits.filter((s: any) => s.member_id !== memberId).map((s: any) => s.member_id)
          } else {
            uniqueMemberIds = Array.from(new Set([...existingSplits.map((s: any) => s.member_id), memberId]))
          }

          const newSplits = calculateEqualSplits(expToUpdate.amount_paise, uniqueMemberIds)

          await updateExpense.mutateAsync({
            expenseId: expToUpdate.id,
            expectedVersion: expToUpdate.version,
            tripId,
            title: expToUpdate.title,
            amountPaise: expToUpdate.amount_paise,
            expenseDate: fromDateOnly(expToUpdate.expense_date),
            paymentSource: expToUpdate.payment_source as any,
            paidByMemberId: expToUpdate.paid_by_member_id || undefined,
            payers: (expToUpdate as any).expense_payers?.map((p: any) => ({ memberId: p.member_id, amountPaise: p.amount_paise })),
            splitMethod: 'EQUAL',
            note: expToUpdate.note || '',
            splits: newSplits,
            isPaid: expToUpdate.is_paid,
            categoryId: expToUpdate.category_id || undefined,
            receiptUrl: expToUpdate.receipt_url || undefined
          })
        }
        toast({ title: 'Success!', description: `Expenses updated successfully.` })
      } else {
        toast({ title: `Member marked as ${member.status === 'ACTIVE' ? 'inactive' : 'active'}` })
      }

      setOpenStatusConfirm(false)
      setSelectedExpensesToUpdate([])
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    }
  }

  if (isLoading) return <div className="flex justify-center items-center h-40"><div className="animate-pulse text-primary font-bold">Loading profile...</div></div>
  if (!member) return <LoadError retry={refetch} />

  return (
    <div className="space-y-4 animate-in-up pb-24 md:pb-8">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" asChild className="rounded-full bg-muted/30 hover:bg-muted/50 border border-transparent hover:border-border/50 transition-all shadow-sm backdrop-blur-sm h-9 w-9">
          <Link aria-label="Back to members" to="/trips/$tripId/members" params={{ tripId: tripId }}><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>Export PDF</Button>
          <Button size="sm" asChild className="rounded-full shadow-md shadow-primary/20 hover:shadow-lg transition-all h-9 px-4 font-bold">
            <Link to="/trips/$tripId/expenses/new" params={{ tripId: tripId }} search={{ prefillMemberId: memberId }}>
              <Plus className="w-4 h-4 mr-1.5" /> Expense
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Member actions" className="rounded-full bg-muted/30 hover:bg-muted/50 border border-transparent hover:border-border/50 transition-all shadow-sm backdrop-blur-sm h-9 w-9">
                <MoreVertical className="w-4 h-4 text-foreground/80" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass border-border/50 rounded-2xl min-w-[180px] p-2 shadow-xl shadow-black/5">
              <DropdownMenuItem onClick={() => { setEditName(member.name); setEditNote(member.note || ''); setOpenEdit(true); }} className="rounded-xl cursor-pointer font-medium p-2.5">
                <Edit className="w-4 h-4 mr-2 text-primary" /> Edit Details
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/50" />
              <DropdownMenuItem onClick={() => setOpenStatusConfirm(true)} className={`rounded-xl cursor-pointer font-medium p-2.5 ${member.status === 'ACTIVE' ? 'text-destructive focus:text-destructive focus:bg-destructive/10' : 'text-green-800 dark:text-green-300 focus:text-green-600 focus:bg-green-500/10'}`}>
                {member.status === 'ACTIVE' ? <><UserMinus className="w-4 h-4 mr-2" /> Disable Member</> : <><UserCheck className="w-4 h-4 mr-2" /> Enable Member</>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDeleteMember} disabled={deleteMember.isPending} className="rounded-xl cursor-pointer font-medium p-2.5 text-red-700 dark:text-red-300 focus:text-red-600 focus:bg-red-500/10">
                <Trash2 className="w-4 h-4 mr-2" /> Delete Member
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="glass-card p-4 sm:p-5 rounded-3xl border border-border/50 shadow-sm flex flex-col md:flex-row gap-5 md:items-center justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center text-2xl sm:text-3xl font-black shadow-inner border-2 border-background shrink-0">
            {member.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              {member.name}
              {member.status === 'INACTIVE' && <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-destructive/10 text-destructive border-0">INACTIVE</Badge>}
            </h1>
            <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wider mt-0.5">Joined {format(new Date(member.created_at), 'MMM yyyy')}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary text-[10px] px-2 py-0.5"><Receipt className="w-3 h-3 mr-1" /> {involvedExpenses.length} Included</Badge>
              {unInvolvedExpenses.length > 0 && (
                <Badge variant="outline" className="bg-destructive/5 border-destructive/20 text-destructive text-[10px] px-2 py-0.5"><UserMinus className="w-3 h-3 mr-1" /> {unInvolvedExpenses.length} Missing</Badge>
              )}
            </div>
            {member.note && (
              <p className="text-xs bg-muted/50 rounded-lg px-2 py-1 mt-2 inline-block font-medium border border-border/50 max-w-xs truncate">
                {member.note}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-start md:items-end bg-background/60 p-3 sm:p-4 rounded-2xl border border-border/50 min-w-[200px] relative z-10 shadow-sm backdrop-blur-sm">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-0.5">Wallet Balance</p>
          <div className={`text-2xl sm:text-3xl font-black tracking-tight ${walletContribution < 0 ? 'text-destructive' : 'text-primary'}`}>
            {formatMoney(walletContribution, trip?.currency)}
          </div>
          <div className="flex gap-2 mt-3 w-full">
            <Dialog open={openFunds} onOpenChange={setOpenFunds}>
              <DialogTrigger asChild>
                <Button size="sm" className="flex-1 rounded-xl shadow-md shadow-primary/20 h-8 text-xs font-bold" onClick={() => setActionType('ADD')}>
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
              </DialogTrigger>
              <DialogContent className="glass rounded-3xl sm:rounded-3xl border-border/50">
                <DialogHeader>
                  <DialogTitle>{actionType === 'ADD' ? 'Add Funds to Wallet' : 'Withdraw Funds'}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onFundSubmit)} className="space-y-4 pt-2">
                    <FormField
                      control={form.control}
                      name="memberId"
                      render={({ field }) => (
                        <FormItem className="hidden">
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="amountString"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Amount ({trip?.currency})</FormLabel>

                            <div className="relative group">
                              <span className="absolute left-3 top-2.5 text-sm font-bold text-muted-foreground group-focus-within:text-primary transition-colors">₹</span>
                              <FormControl><Input type="number" step="0.01" min="0" placeholder="0.00" {...field} className="pl-7 bg-background/50 border-border/50 font-bold rounded-xl h-10 focus-visible:ring-primary/50" /></FormControl>
                            </div>

                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="note"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Note (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter note" {...field} className="bg-background/50 border-border/50 rounded-xl h-10 font-medium focus-visible:ring-primary/50" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full shadow-lg shadow-primary/20 rounded-xl h-10 font-bold mt-2">
                      Continue
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
            <Button size="sm" variant="secondary" className="flex-1 rounded-xl shadow-sm bg-background/80 hover:bg-background h-8 text-xs font-bold" onClick={() => { setActionType('REMOVE'); setOpenFunds(true); }}>
              Withdraw
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="expenses" className="w-full mt-2">
        <TabsList className="grid w-full grid-cols-2 bg-muted/30 p-1 rounded-2xl backdrop-blur-md border border-border/50 h-auto">
          <TabsTrigger value="expenses" className="rounded-xl font-bold text-sm py-2 data-[state=active]:shadow-sm data-[state=active]:bg-background">Expenses</TabsTrigger>
          <TabsTrigger value="wallet" className="rounded-xl font-bold text-sm py-2 data-[state=active]:shadow-sm data-[state=active]:bg-background">Wallet Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="space-y-6 focus-visible:outline-none mt-4 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
          <div className="space-y-3">
            <h2 className="text-sm font-bold tracking-tight text-muted-foreground uppercase flex items-center">
              Included In
            </h2>
            {involvedExpenses.length === 0 ? (
              <Card className="glass-card bg-muted/10 border-dashed rounded-2xl shadow-none">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <p className="text-sm font-bold">No expenses found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-2">
                {involvedExpenses.map(exp => {
                  const mySplit = (exp as any).expense_splits?.find((s: any) => s.member_id === memberId)?.amount_paise || 0;
                  return (
                    <Card key={exp.id} className="glass-card group relative hover:shadow-md transition-all border-border/50 overflow-hidden rounded-2xl">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/30 group-hover:bg-primary transition-colors" />
                      <CardContent className="p-3 pl-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div className="flex-1">
                          <h3 className="font-bold text-sm flex items-center gap-2 group-hover:text-primary transition-colors">
                            {exp.title}
                            {(exp as any).receipt_url && (
                              <ReceiptViewer receipt={exp.receipt_url!} tripId={tripId} title={exp.title} />
                            )}
                          </h3>
                          <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                            {format(fromDateOnly(exp.expense_date), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-black text-base text-primary tabular-nums">{formatMoney(mySplit, trip?.currency)}</div>
                            <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Total: {formatMoney(exp.amount_paise, trip?.currency)}</div>
                          </div>
                          <Button asChild size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-background/50 hover:bg-primary/10 hover:text-primary shadow-sm  transition-all border border-border/50 shrink-0">
                            <Link aria-label={`Edit ${exp.title}`} to="/trips/$tripId/expenses/$expenseId/edit" params={{ tripId: tripId, expenseId: exp.id }}>
                              <Edit className="w-3.5 h-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>

          {unInvolvedExpenses.length > 0 && (
            <div className="space-y-3 pt-2">
              <h2 className="text-sm font-bold tracking-tight text-muted-foreground uppercase flex items-center">
                Missing From
              </h2>
              <div className="grid gap-2  hover:opacity-100 transition-opacity">
                {unInvolvedExpenses.map(exp => (
                  <Card key={exp.id} className="glass-card border-l-2 border-l-destructive/50 hover:border-l-destructive transition-colors rounded-2xl">
                    <CardContent className="p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-sm truncate">{exp.title}</h3>
                        <p className="text-[11px] text-muted-foreground font-medium mt-0.5">
                          {format(fromDateOnly(exp.expense_date), 'MMM d, yyyy')} • {formatMoney(exp.amount_paise, trip?.currency)}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="secondary" className="shadow-sm rounded-xl h-7 px-2 text-[10px] font-bold bg-background/80 hover:bg-background shrink-0">
                        <Link aria-label={`Edit ${exp.title}`} to="/trips/$tripId/expenses/$expenseId/edit" params={{ tripId: tripId, expenseId: exp.id }}>
                          Add <ArrowRight className="w-3 h-3 ml-1" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="wallet" className="space-y-4 focus-visible:outline-none mt-4 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
          {memberFunds.length === 0 ? (
            <Card className="glass-card bg-muted/10 border-dashed rounded-2xl shadow-none">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Wallet className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-bold">No logs found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="relative">
              <div className="absolute left-[19px] top-3 bottom-3 w-px bg-border/60 hidden sm:block rounded-full" />
              <div className="space-y-3">
                {[...memberFunds].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()).map(log => (
                  <div key={log.id} className="relative flex items-start gap-3 group">
                    <div className={`hidden sm:flex w-10 h-10 rounded-full items-center justify-center shrink-0 z-10 border-4 border-background shadow-sm transition-transform group-hover:scale-110 ${log.transaction_type === 'ADD' ? 'bg-green-100 text-green-800 dark:text-green-300 dark:bg-green-500/20 dark:text-green-400' : 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400'}`}>
                      {log.transaction_type === 'ADD' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <Card className="glass-card flex-1 border-border/50 shadow-sm hover:shadow-md transition-all rounded-2xl group-hover:border-primary/20">
                      <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-sm flex items-center truncate">
                            <span className={`sm:hidden mr-2 p-1 rounded-md ${log.transaction_type === 'ADD' ? 'bg-green-500/10 text-green-800 dark:text-green-300' : 'bg-orange-500/10 text-orange-500'}`}>
                              {log.transaction_type === 'ADD' ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                            </span>
                            {log.transaction_type === 'ADD' ? 'Added Funds' : 'Withdrew Funds'}
                          </h3>
                          <p className="text-[11px] text-muted-foreground font-medium mt-0.5 truncate">
                            {format(new Date(log.occurred_at), 'MMM d, yyyy h:mm a')}
                            {log.note && ` • ${log.note}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`font-black text-base sm:text-lg tabular-nums tracking-tight ${log.transaction_type === 'ADD' ? 'text-green-800 dark:text-green-300 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                            {log.transaction_type === 'ADD' ? '+' : '-'}{formatMoney(log.amount_paise, trip?.currency)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!confirmFundData} onOpenChange={(open) => !open && setConfirmFundData(null)}>
        <DialogContent className="sm:max-w-md glass rounded-3xl border-border/50">
          <DialogHeader>
            <DialogTitle>Confirm Transaction</DialogTitle>
            <DialogDescription>Please review the fund transaction details.</DialogDescription>
          </DialogHeader>
          {confirmFundData && (
            <div className="space-y-3 py-2">
              <div className="flex justify-between items-center bg-background/50 p-3 rounded-xl border border-border/50">
                <span className="font-semibold text-muted-foreground text-sm">Action</span>
                <span className={`font-bold ${actionType === 'ADD' ? 'text-green-800 dark:text-green-300' : 'text-orange-500'}`}>
                  {actionType === 'ADD' ? 'Add Funds' : 'Withdraw Funds'}
                </span>
              </div>
              <div className="flex justify-between items-center bg-background/50 p-3 rounded-xl border border-border/50">
                <span className="font-semibold text-muted-foreground text-sm">Member</span>
                <span className="font-bold">{member.name}</span>
              </div>
              <div className="flex justify-between items-center bg-background/50 p-3 rounded-xl border border-border/50">
                <span className="font-semibold text-muted-foreground text-sm">Amount</span>
                <span className="font-bold text-lg">{formatMoney(parseMoneyToPaise(confirmFundData.amountString), trip?.currency)}</span>
              </div>
            </div>
          )}
          <DialogFooter className="sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmFundData(null)} className="rounded-xl h-10">Cancel</Button>
            <Button type="button" onClick={executeManageFunds} disabled={manageFunds.isPending} className="rounded-xl font-bold shadow-md h-10">
              {manageFunds.isPending ? 'Processing...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="glass border-border/50 max-h-[90vh] overflow-y-auto no-scrollbar rounded-3xl sm:rounded-3xl">
          <DialogHeader>
            <DialogTitle>Edit Details</DialogTitle>
            <DialogDescription>Update this member's name and note.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="editName" className="text-xs">Name</Label>
              <Input id="editName" value={editName} onChange={(e) => setEditName(e.target.value)} required className="bg-background/50 border-border/50 rounded-xl h-10 font-medium" placeholder="Enter name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editNote" className="text-xs">Note (Optional)</Label>
              <Input id="editNote" value={editNote} onChange={(e) => setEditNote(e.target.value)} className="bg-background/50 border-border/50 rounded-xl h-10 font-medium" placeholder="Enter note" />
            </div>
            <DialogFooter className="mt-2">
              <Button type="button" variant="ghost" onClick={() => setOpenEdit(false)} className="rounded-xl h-10 text-sm">Cancel</Button>
              <Button type="submit" disabled={updateMember.isPending} className="rounded-xl font-bold shadow-lg shadow-primary/20 h-10">{updateMember.isPending ? 'Saving...' : 'Save'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openStatusConfirm} onOpenChange={setOpenStatusConfirm}>
        <DialogContent className="glass border-border/50 rounded-3xl sm:rounded-3xl">
          <DialogHeader>
            <DialogTitle className={member.status === 'ACTIVE' ? 'text-destructive' : ''}>{member.status === 'ACTIVE' ? 'Disable Member?' : 'Enable Member?'}</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed">
              {member.status === 'ACTIVE'
                ? 'Disabling hides them from future expenses, but preserves history. You can re-enable anytime.'
                : 'Enabling allows them to be selected in new expenses again.'}
            </DialogDescription>
          </DialogHeader>

          {member.status === 'ACTIVE' && involvedEqualExpenses.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-border/50">
              <div className="text-sm font-semibold text-primary">Remove from existing expenses?</div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-2 no-scrollbar">
                {involvedEqualExpenses.map(exp => (
                  <div key={exp.id} className={`flex items-center space-x-3 p-3 rounded-xl border transition-all cursor-pointer ${selectedExpensesToUpdate.includes(exp.id) ? 'bg-destructive/10 border-destructive/30' : 'bg-background/50 border-border/30'}`} onClick={() => setSelectedExpensesToUpdate(prev => prev.includes(exp.id) ? prev.filter(id => id !== exp.id) : [...prev, exp.id])}>
                    <Checkbox aria-label={`Update ${exp.title}`} onClick={event => event.stopPropagation()} checked={selectedExpensesToUpdate.includes(exp.id)} onCheckedChange={(c) => setSelectedExpensesToUpdate(prev => c ? [...prev, exp.id] : prev.filter(id => id !== exp.id))} />
                    <span className="font-semibold text-sm truncate flex-1">{exp.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {member.status === 'INACTIVE' && unInvolvedEqualExpenses.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-border/50">
              <div className="text-sm font-semibold text-primary">Add back to past expenses?</div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-2 no-scrollbar">
                {unInvolvedEqualExpenses.map(exp => (
                  <div key={exp.id} className={`flex items-center space-x-3 p-3 rounded-xl border transition-all cursor-pointer ${selectedExpensesToUpdate.includes(exp.id) ? 'bg-primary/10 border-primary/30' : 'bg-background/50 border-border/30'}`} onClick={() => setSelectedExpensesToUpdate(prev => prev.includes(exp.id) ? prev.filter(id => id !== exp.id) : [...prev, exp.id])}>
                    <Checkbox aria-label={`Update ${exp.title}`} onClick={event => event.stopPropagation()} checked={selectedExpensesToUpdate.includes(exp.id)} onCheckedChange={(c) => setSelectedExpensesToUpdate(prev => c ? [...prev, exp.id] : prev.filter(id => id !== exp.id))} />
                    <span className="font-semibold text-sm truncate flex-1">{exp.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 gap-2">
            <Button variant="ghost" onClick={() => setOpenStatusConfirm(false)} className="rounded-xl h-10">Cancel</Button>
            <Button variant={member.status === 'ACTIVE' ? 'destructive' : 'default'} onClick={handleToggleStatus} disabled={updateMember.isPending || updateExpense.isPending} className="rounded-xl font-bold shadow-md h-10">
              {updateMember.isPending || updateExpense.isPending ? 'Processing...' : (member.status === 'ACTIVE' ? 'Disable' : 'Enable')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal isOpen={exportOpen} onClose={() => setExportOpen(false)} title="Export member statement" confirmLabel="Download PDF" isDestructive={false}
        description="Includes this member's expense shares, direct payments, wallet deposits and refunds."
        onConfirm={async () => { if (trip) { const { exportUserReportPDF } = await import('@/lib/pdf'); await exportUserReportPDF(trip, member) } }} />
      <Dialog open={openDeleteConfirm} onOpenChange={setOpenDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete member</DialogTitle>
            <DialogDescription>{hasFinancialHistory
              ? 'This member has financial history. Disable the member to keep existing expenses, payments and balances intact.'
              : 'This will permanently remove this member from the trip.'}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDeleteConfirm(false)}>Cancel</Button>
            {!hasFinancialHistory && <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>{isDeleting ? 'Deleting...' : 'Delete member'}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
