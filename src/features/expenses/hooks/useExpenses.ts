import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toDateOnly } from '@/lib/dates'
import { supabase } from '@/lib/supabase'

export function useAddExpense() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({
      tripId,
      title,
      amountPaise,
      expenseDate,
      paymentSource,
      paidByMemberId,
      splitMethod,
      note,
      splits,
      payers,
      receiptUrl,
      isPaid = true,
      categoryId
    }: {
      tripId: string
      title: string
      amountPaise: number
      expenseDate: Date
      paymentSource: string
      paidByMemberId?: string | null
      splitMethod: string
      note?: string
      splits: { memberId: string, amountPaise: number }[]
      payers?: { memberId: string, amountPaise: number }[]
      receiptUrl?: string | null
      isPaid?: boolean
      categoryId?: string | null
    }) => {
      const idempotencyKey = crypto.randomUUID()
      
      const { data, error } = await supabase.rpc('create_expense', {
        p_trip_id: tripId,
        p_title: title,
        p_amount_paise: amountPaise,
        p_expense_date: toDateOnly(expenseDate),
        p_payment_source: paymentSource,
        p_paid_by_member_id: paymentSource === 'TRIP_WALLET' ? null : (paidByMemberId || null),
        p_split_method: splitMethod,
        p_note: note || '',
        p_idempotency_key: idempotencyKey,
        p_splits: splits.map(s => ({ member_id: s.memberId, amount_paise: s.amountPaise })),
        p_payers: payers?.map(p => ({ member_id: p.memberId, amount_paise: p.amountPaise })) || null,
        p_receipt_url: receiptUrl || null,
        p_is_paid: isPaid,
        p_category_id: categoryId || null
      })
        
      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trips', variables.tripId] })
    }
  })
}

export function useUpdateExpense() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({
      expenseId,
      expectedVersion,
      title,
      amountPaise,
      expenseDate,
      paymentSource,
      paidByMemberId,
      splitMethod,
      note,
      splits,
      payers,
      receiptUrl,
      isPaid = true,
      categoryId
    }: {
      expenseId: string
      expectedVersion?: number
      tripId: string
      title: string
      amountPaise: number
      expenseDate: Date
      paymentSource: string
      paidByMemberId?: string | null
      splitMethod: string
      note?: string
      splits: { memberId: string, amountPaise: number }[]
      payers?: { memberId: string, amountPaise: number }[]
      receiptUrl?: string | null
      isPaid?: boolean
      categoryId?: string | null
    }) => {
      const { data, error } = await supabase.rpc('update_expense', {
        p_expense_id: expenseId,
        p_expected_version: expectedVersion ?? null,
        p_title: title,
        p_amount_paise: amountPaise,
        p_expense_date: toDateOnly(expenseDate),
        p_payment_source: paymentSource,
        p_paid_by_member_id: paymentSource === 'TRIP_WALLET' ? null : (paidByMemberId || null),
        p_split_method: splitMethod,
        p_note: note || '',
        p_splits: splits.map(s => ({ member_id: s.memberId, amount_paise: s.amountPaise })),
        p_payers: payers?.map(p => ({ member_id: p.memberId, amount_paise: p.amountPaise })) || null,
        p_receipt_url: receiptUrl || null,
        p_is_paid: isPaid,
        p_category_id: categoryId || null
      })
        
      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trips', variables.tripId] })
    }
  })
}

export function useResyncExpenses() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({
      updatedExpenses
    }: {
      tripId: string
      updatedExpenses: any[]
    }) => {
      for (const exp of updatedExpenses) {
        const { error } = await supabase.rpc('update_expense', {
          p_expense_id: exp.id,
          p_expected_version: exp.version,
          p_title: exp.title,
          p_amount_paise: exp.amount_paise,
          p_expense_date: exp.expense_date.split('T')[0],
          p_payment_source: exp.payment_source,
          p_paid_by_member_id: exp.paid_by_member_id,
          p_split_method: exp.split_method,
          p_note: exp.note || '',
          p_splits: exp.expense_splits.map((s: any) => ({ member_id: s.member_id, amount_paise: s.amount_paise })),
          p_payers: exp.expense_payers?.map((p: any) => ({ member_id: p.member_id, amount_paise: p.amount_paise })) || null,
          p_receipt_url: exp.receipt_url || null,
          p_is_paid: exp.is_paid,
          p_category_id: exp.category_id || null
        })
        if (error) throw error
      }
      return true
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trips', variables.tripId] })
    }
  })
}
