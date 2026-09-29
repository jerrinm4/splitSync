import { ReceiptViewer } from '@/components/expenses/ReceiptViewer'
import { useState, useMemo, useEffect, useRef } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { fromDateOnly, toDateOnly } from '@/lib/dates'
import { createExpenseSchema } from '@/lib/validation'
import { parseMoneyToPaise, formatMoney } from '@/lib/money'
import { Card, CardContent } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Receipt, Calendar, User, Wallet, SplitSquareHorizontal, ArrowLeft, AlignLeft, Image as ImageIcon, CheckCircle2, Clock, Tag, Info } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import imageCompression from 'browser-image-compression'
import { ManageCategoriesModal } from '@/components/expenses/ManageCategoriesModal'
import { SplitSelector } from '@/components/expenses/SplitSelector'
import type { SplitSelectorRef } from '@/components/expenses/SplitSelector'

type ExpenseFormValues = z.infer<typeof createExpenseSchema>

interface ExpenseFormProps {
  trip: any;
  initialData?: any;
  prefillMemberId?: string;
  onSubmit: (data: {
    title: string;
    amountPaise: number;
    expenseDate: Date;
    paymentSource: 'TRIP_WALLET' | 'MEMBER';
    paidByMemberId?: string;
    payers?: { memberId: string, amountPaise: number }[];
    splitMethod: 'EQUAL' | 'CUSTOM';
    note?: string;
    splits: { memberId: string, amountPaise: number }[];
    customTotalPaise?: number;
    isPaid?: boolean;
    categoryId?: string | null;
  }) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  submitLabel: string;
  pageTitle: string;
}

export function ExpenseForm({ trip, initialData, prefillMemberId, onSubmit, onCancel, isSubmitting, submitLabel, pageTitle }: ExpenseFormProps) {
  const { toast } = useToast()

  const receiptInputRef = useRef<HTMLInputElement>(null)
  const payersRef = useRef<SplitSelectorRef>(null)
  const splitsRef = useRef<SplitSelectorRef>(null)
  const [editingVersion] = useState<number | undefined>(initialData?.version)

  const [confirmData, setConfirmData] = useState<any>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [removeExistingReceipt, setRemoveExistingReceipt] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      title: initialData?.title || '',
      amountString: initialData ? (initialData.amount_paise / 100).toFixed(2) : '',
      expenseDate: initialData ? fromDateOnly(initialData.expense_date) : new Date(),
      paymentSource: initialData?.payment_source || (prefillMemberId ? 'MEMBER' : 'TRIP_WALLET'),
      payerMode: initialData && (initialData.expense_payers?.length || 0) <= 1 ? 'SINGLE' : 'MULTIPLE',
      paidByMemberId: initialData?.expense_payers?.[0]?.member_id || initialData?.paid_by_member_id || prefillMemberId,
      splitMethod: 'CUSTOM',
      note: initialData?.note || '',
      isPaid: initialData?.is_paid !== false,
      categoryId: initialData?.category_id || null,
    }
  })

  const paymentSource = useWatch({ control: form.control, name: 'paymentSource' })
  const payerMode = useWatch({ control: form.control, name: 'payerMode' })
  const amountString = useWatch({ control: form.control, name: 'amountString' })

  const payerOptions = useMemo(() => {
    if (!trip?.trip_members) return []
    return [...trip.trip_members].sort((a: any, b: any) => a.name.localeCompare(b.name)).filter((m: any) => m.status !== 'INACTIVE' || initialData?.paid_by_member_id === m.id || initialData?.expense_payers?.some((p: { member_id: string }) => p.member_id === m.id))
  }, [trip, initialData])

  const splitMembers = useMemo(() => {
    if (!trip?.trip_members) return []
    return [...trip.trip_members].sort((a: any, b: any) => a.name.localeCompare(b.name)).filter((m: any) => m.status !== 'INACTIVE' || initialData?.expense_splits?.some((s: any) => s.member_id === m.id))
  }, [trip, initialData])

  const handleSubmit = async (data: ExpenseFormValues) => {
    try {
      const amountPaise = parseMoneyToPaise(data.amountString)

      splitsRef.current?.validate(amountPaise)
      const splitsToUse = splitsRef.current?.getSplits() || []
      const isAllAuto = splitsRef.current?.isAllAuto() || false
      const splitsTotal = splitsToUse.reduce((sum, s) => sum + s.amountPaise, 0)

      let payersToUse: { memberId: string, amountPaise: number }[] = []
      if (data.paymentSource === 'MEMBER' && data.payerMode === 'MULTIPLE') {
        payersRef.current?.validate(amountPaise)
        payersToUse = payersRef.current?.getSplits() || []
      }

      setConfirmData({
        version: editingVersion,
        title: data.title,
        amountPaise,
        expenseDate: data.expenseDate,
        paymentSource: data.paymentSource,
        paidByMemberId: data.payerMode === 'SINGLE' ? data.paidByMemberId : undefined,
        payers: data.payerMode === 'MULTIPLE' ? payersToUse : undefined,
        splitMethod: isAllAuto ? 'EQUAL' : 'CUSTOM',
        note: data.note,
        splits: splitsToUse,
        customTotalPaise: splitsTotal,
        isPaid: data.isPaid,
        categoryId: data.categoryId
      })
    } catch (err: any) {
      toast({ title: 'Validation Error', description: err.message, variant: 'destructive' })
    }
  }

  const executeSubmit = async () => {
    if (!confirmData || isUploading || isSubmitting) return
    setIsUploading(true)
    try {
      let finalReceiptUrl = confirmData.receiptUrl || (removeExistingReceipt ? null : initialData?.receipt_url)

      if (receiptFile) {
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true
        }
        const compressedFile = await imageCompression(receiptFile, options)
        const fileExt = compressedFile.name.split('.').pop()
        const fileName = `${crypto.randomUUID()}.${fileExt}`
        const filePath = `${trip.id}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(filePath, compressedFile)

        if (uploadError) throw uploadError

        finalReceiptUrl = filePath
      }

      await onSubmit({
        ...confirmData,
        receiptUrl: finalReceiptUrl
      })
      setConfirmData(null)
      setReceiptFile(null)
      setPreviewUrl(null)
    } catch (err: any) {
      toast({ title: 'Could not save expense', description: err.message, variant: 'destructive' })
    } finally {
      setIsUploading(false)
    }
  }


  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in-up pb-24 md:pb-8">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" aria-label="Cancel expense editing" onClick={onCancel} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
      </div>
      <Form {...form}>
        <form onSubmit={event => { void form.handleSubmit(handleSubmit)(event) }} className="space-y-6">

          <Card className="glass-card overflow-hidden border-border/50 shadow-sm">
            <CardContent className="p-0">
              <div className="p-4 space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Description</FormLabel>

                        <div className="relative group">
                          <Receipt className="absolute left-3 top-3 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          <FormControl><Input aria-label="Description" placeholder="Enter description" {...field} className="pl-10 bg-background/50 h-12 text-base border-transparent shadow-sm focus-visible:ring-primary/50 transition-shadow" /></FormControl>
                        </div>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amountString"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Total Amount</FormLabel>

                        <div className="relative group">
                          <span className="absolute left-4 top-3 text-lg font-bold text-muted-foreground group-focus-within:text-primary transition-colors">₹</span>
                          <FormControl><Input aria-label="Total Amount" type="number" step="0.01" min="0" placeholder="0.00" {...field} className="pl-14 bg-background/50 h-14 text-2xl font-black border-transparent shadow-sm focus-visible:ring-primary/50 transition-shadow" /></FormControl>
                        </div>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="expenseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Date</FormLabel>

                          <div className="relative group">
                            <Calendar className="absolute left-3 top-3 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none" />
                            <FormControl><Input
                              type="date"
                              aria-label="Date"
                              {...field}
                              value={field.value ? toDateOnly(field.value) : ''}
                              onChange={e => {
                                if (!e.target.value) return;
                                field.onChange(fromDateOnly(e.target.value));
                              }}
                              className="pl-10 bg-background/50 h-10 border-transparent shadow-sm focus-visible:ring-primary/50 transition-shadow [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:left-0 [&::-webkit-calendar-picker-indicator]:top-0"
                            /></FormControl>
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
                        <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Note (Optional)</FormLabel>

                          <div className="relative group">
                            <AlignLeft className="absolute left-3 top-3 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <FormControl><Input aria-label="Note" placeholder="Enter note" {...field} className="pl-10 bg-background/50 h-10 border-transparent shadow-sm focus-visible:ring-primary/50 transition-shadow" /></FormControl>
                          </div>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="col-span-2">
                    <label htmlFor="receipt-image" className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-2 block">Bill Image (Optional)</label>
                    <div className="relative group">
                      <ImageIcon className="absolute left-3 top-3 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        type="file"
                        id="receipt-image" ref={receiptInputRef} aria-label="Receipt image" aria-describedby="receipt-help"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null
                          if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024)) {
                            toast({ title: 'Choose a JPEG, PNG or WebP image up to 10 MB', variant: 'destructive' })
                            e.target.value = ''
                            return
                          }
                          setReceiptFile(file)
                          if (file) {
                            setPreviewUrl(URL.createObjectURL(file))
                          } else {
                            setPreviewUrl(null)
                          }
                        }}
                        className="pl-10 bg-background/50 h-10 border-transparent shadow-sm focus-visible:ring-primary/50 transition-shadow file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer text-muted-foreground"
                      />
                    </div>
                    <p id="receipt-help" className="text-xs text-muted-foreground mt-2">JPEG, PNG or WebP, up to 10 MB.</p>
                    {previewUrl && (
                      <div className="mt-4 relative rounded-xl overflow-hidden border border-border/50 max-h-48 group">
                        <img src={previewUrl} alt="Receipt preview" className="w-full h-auto object-cover max-h-48" />
                        <div className="absolute bottom-2 right-2">
                          <Button type="button" variant="destructive" size="sm" onClick={() => { setReceiptFile(null); setPreviewUrl(null); if (receiptInputRef.current) receiptInputRef.current.value = '' }}>Remove selected image</Button>
                        </div>
                      </div>
                    )}
                    {initialData?.receipt_url && !receiptFile && !previewUrl && !removeExistingReceipt && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <ReceiptViewer receipt={initialData.receipt_url} tripId={trip.id} title={initialData.title} />
                        <Button type="button" variant="destructive" size="sm" onClick={() => setRemoveExistingReceipt(true)}>Remove receipt</Button>
                      </div>
                    )}
                    {removeExistingReceipt && !receiptFile && (
                      <p className="text-xs text-destructive mt-2">Existing bill will be removed upon saving. (Refresh to undo)</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card overflow-hidden border-border/50 shadow-sm">
            <CardContent className="p-4 space-y-6">
              <FormField
                control={form.control}
                name="paymentSource"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold flex items-center">
                      Paid By
                    </FormLabel>
                    <FormControl>
                      <div className="relative flex w-full h-12 bg-muted/30 rounded-xl p-1 overflow-hidden backdrop-blur-sm border border-border/30">
                        <div
                          className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-background shadow-md rounded-lg transition-transform duration-300 ease-in-out border border-border/50"
                          style={{ transform: `translateX(${field.value === 'TRIP_WALLET' ? '0' : '100%'})`, marginLeft: field.value === 'TRIP_WALLET' ? '0' : '8px' }}
                        />
                        <button
                          type="button"
                          className={`relative flex-1 flex items-center justify-center text-sm font-bold z-10 transition-colors ${field.value === 'TRIP_WALLET' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
                          aria-pressed={field.value === 'TRIP_WALLET'} onClick={() => field.onChange('TRIP_WALLET')}
                        >
                          <Wallet className="w-4 h-4 mr-2" /> Wallet
                        </button>
                        <button
                          type="button"
                          className={`relative flex-1 flex items-center justify-center text-sm font-bold z-10 transition-colors ${field.value === 'MEMBER' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
                          aria-pressed={field.value === 'MEMBER'} onClick={() => field.onChange('MEMBER')}
                        >
                          <User className="w-4 h-4 mr-2" /> Member
                        </button>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />

              {paymentSource === 'MEMBER' && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="payerMode"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="relative flex w-full h-10 bg-muted/20 rounded-lg p-1 overflow-hidden backdrop-blur-sm border border-border/20">
                            <div
                              className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-background shadow-sm rounded-md transition-transform duration-300 ease-in-out border border-border/30"
                              style={{ transform: `translateX(${field.value === 'SINGLE' ? '0' : '100%'})`, marginLeft: field.value === 'SINGLE' ? '0' : '8px' }}
                            />
                            <button
                              type="button"
                              className={`relative flex-1 flex items-center justify-center text-xs font-bold z-10 transition-colors ${field.value === 'SINGLE' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
                              aria-pressed={field.value === 'SINGLE'} onClick={() => field.onChange('SINGLE')}
                            >
                              Single Person
                            </button>
                            <button
                              type="button"
                              className={`relative flex-1 flex items-center justify-center text-xs font-bold z-10 transition-colors ${field.value === 'MULTIPLE' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'}`}
                              aria-pressed={field.value === 'MULTIPLE'} onClick={() => field.onChange('MULTIPLE')}
                            >
                              Multiple People
                            </button>
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {payerMode === 'SINGLE' ? (
                    <FormField
                      control={form.control}
                      name="paidByMemberId"
                      render={({ field }) => (
                        <FormItem className="animate-in slide-in-from-top-2">
                          <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Select Member</FormLabel>

                            <div className="relative group">
                              <User className="absolute left-3 top-3.5 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                              <FormControl><select aria-label="Select member"
                                className="flex h-12 w-full items-center justify-between rounded-xl border border-transparent bg-background/80 shadow-sm pl-10 pr-3 py-2 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow appearance-none"
                                {...field}
                                value={field.value || ''}
                              >
                                <option value="" disabled>Select who paid...</option>
                                {payerOptions.map((m: any) => (
                                  <option key={m.id} value={m.id}>{m.name} {m.status === 'INACTIVE' ? '(Inactive)' : ''}</option>
                                ))}
                              </select></FormControl>
                            </div>

                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <div className="animate-in slide-in-from-top-2 pt-2">
                      <SplitSelector
                        ref={payersRef}
                        title="Specify Amounts Paid"
                        icon={<Wallet className="w-4 h-4" />}
                        amountPaise={parseMoneyToPaise(amountString || '0')}
                        currency={trip?.currency}
                        members={payerOptions}
                        initialSplits={initialData?.expense_payers || []}
                        initialSplitMethod="CUSTOM"
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card overflow-hidden border-border/50 shadow-sm">
            <CardContent className="p-4 space-y-6">
              <FormField
                control={form.control}
                name="isPaid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold flex items-center">
                      Payment Status
                    </FormLabel>
                    <FormControl>
                      <div className="relative flex w-full h-12 bg-muted/30 rounded-xl p-1 overflow-hidden backdrop-blur-sm border border-border/30">
                        <div
                          className={`absolute top-1 bottom-1 w-[calc(50%-4px)] shadow-md rounded-lg transition-transform duration-300 ease-in-out border ${field.value ? 'bg-green-500/15 border-green-500/30' : 'bg-amber-500/15 border-amber-500/30'}`}
                          style={{ transform: `translateX(${field.value ? '0' : '100%'})`, marginLeft: field.value ? '0' : '8px' }}
                        />
                        <button
                          type="button"
                          className={`relative flex-1 flex items-center justify-center text-sm font-bold z-10 transition-colors ${field.value ? 'text-green-800 dark:text-green-300 dark:text-green-400' : 'text-muted-foreground hover:text-foreground/80'}`}
                          aria-pressed={field.value} onClick={() => field.onChange(true)}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-2" /> Paid
                        </button>
                        <button
                          type="button"
                          className={`relative flex-1 flex items-center justify-center text-sm font-bold z-10 transition-colors ${!field.value ? 'text-amber-800 dark:text-amber-300 dark:text-amber-400' : 'text-muted-foreground hover:text-foreground/80'}`}
                          aria-pressed={!field.value} onClick={() => field.onChange(false)}
                        >
                          <Clock className="w-4 h-4 mr-2" /> Estimated
                        </button>
                      </div>
                    </FormControl>
                    {!field.value && (
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 dark:text-amber-400 font-medium mt-1.5 flex items-center gap-1">
                        <Info className="w-3 h-3" /> This expense is an estimate and won't affect the wallet balance.
                      </p>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="text-xs uppercase tracking-wider text-muted-foreground font-bold flex items-center">
                        <Tag className="w-3.5 h-3.5 mr-1.5" /> Category
                      </FormLabel>
                      <ManageCategoriesModal tripId={trip.id} trigger={<button type="button" className="text-[10px] text-primary hover:underline font-semibold uppercase tracking-wider">Manage</button>} />
                    </div>

                      <div className="relative group">
                        <FormControl><select aria-label="Category"
                          className="flex h-11 w-full items-center justify-between rounded-xl border border-transparent bg-background/80 shadow-sm pl-4 pr-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow appearance-none"
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        >
                          <option value="">No Category</option>
                          {trip?.expense_categories?.map((cat: any) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select></FormControl>
                        {field.value && (
                          <div
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                            style={{ backgroundColor: trip?.expense_categories?.find((c: any) => c.id === field.value)?.color || '#6366f1' }}
                          />
                        )}
                      </div>

                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="glass-card overflow-hidden border-border/50 shadow-sm">
            <CardContent className="p-4">
              <SplitSelector
                ref={splitsRef}
                title="Split Between"
                icon={<SplitSquareHorizontal className="w-4 h-4" />}
                amountPaise={parseMoneyToPaise(amountString || '0')}
                currency={trip?.currency}
                members={splitMembers}
                groups={trip?.trip_member_groups || []}
                initialSplits={initialData?.expense_splits || []}
                initialSplitMethod={initialData?.split_method || 'EQUAL'}
                showGroups={true}
              />
            </CardContent>
          </Card>

          <div className="sticky bottom-0 -mx-4 p-4 bg-background/80 backdrop-blur-xl border-t border-border/50 z-10 md:mx-0 md:relative md:bg-transparent md:border-0 md:p-0 md:backdrop-blur-none">
            <div className="max-w-xl mx-auto flex gap-3">
              <Button type="button" variant="outline" className="hidden md:flex flex-1 rounded-xl h-12 font-bold" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || isUploading} className="flex-1 h-12 text-base shadow-xl shadow-primary/20 rounded-xl font-bold">
                {isSubmitting || isUploading ? 'Saving...' : submitLabel}
              </Button>
            </div>
          </div>
        </form>
      </Form>

      <Dialog open={!!confirmData} onOpenChange={(open) => !open && setConfirmData(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Expense</DialogTitle>
            <DialogDescription>Please review the details before saving.</DialogDescription>
          </DialogHeader>
          {confirmData && (
            <div className="space-y-4 py-2">
              <div className="flex justify-between items-center border-b border-border/50 pb-2">
                <span className="font-semibold">{confirmData.title}</span>
                <span className="font-bold text-lg">{formatMoney(confirmData.amountPaise, trip?.currency)}</span>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                <p className="text-sm font-semibold text-muted-foreground">Split Breakdown</p>
                {confirmData.splits.map((s: any) => {
                  const member = trip?.trip_members?.find((m: any) => m.id === s.memberId)
                  return (
                    <div key={s.memberId} className="flex justify-between text-sm items-center">
                      <span>{member?.name || 'Unknown'}</span>
                      <span className="font-medium">{formatMoney(s.amountPaise, trip?.currency)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <DialogFooter className="sm:justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmData(null)}>Cancel</Button>
            <Button
              type="button"
              onClick={executeSubmit}
              disabled={isUploading}
            >
              {isUploading ? 'Saving...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
