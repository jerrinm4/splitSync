import { LoadError } from '@/components/layout/LoadError'
import { useMemo } from 'react'
import { useParams, useNavigate, useRouter } from '@tanstack/react-router'
import { useTrip } from '@/features/trips/hooks/useTrip'
import { useUpdateExpense } from '@/features/expenses/hooks/useExpenses'
import { useToast } from '@/hooks/use-toast'
import { ExpenseForm } from '@/components/expenses/ExpenseForm'

export default function EditExpensePage() {
  const { tripId, expenseId } = useParams({ strict: false }) as { tripId: string, expenseId: string }
  const { data: trip, isLoading, refetch } = useTrip(tripId)
  const updateExpense = useUpdateExpense()
  const { toast } = useToast()
  const navigate = useNavigate()

  const expense = useMemo(() => {
    return trip?.expenses?.find(e => e.id === expenseId)
  }, [trip, expenseId])

  const router = useRouter()

  const goBack = () => {
    if (window.history.length > 2) {
      router.history.go(-1)
    } else {
      navigate({ to: "/trips/$tripId/expenses", params: { tripId: tripId } })
    }
  }

  const handleCancel = () => {
    goBack()
  }

  const handleSubmit = async (data: any) => {
    try {
      await updateExpense.mutateAsync({
        expenseId,
        expectedVersion: data.version,
        tripId,
        title: data.title,
        amountPaise: data.amountPaise,
        expenseDate: data.expenseDate,
        paymentSource: data.paymentSource,
        paidByMemberId: data.paidByMemberId,
        splitMethod: data.splitMethod,
        note: data.note,
        splits: data.splits,
        payers: data.payers,
        receiptUrl: data.receiptUrl,
        isPaid: data.isPaid,
        categoryId: data.categoryId
      })

      toast({ title: 'Expense updated successfully' })
      goBack()
    } catch (err: any) {
      toast({ title: 'Error updating expense', description: err.message, variant: 'destructive' })
      throw err
    }
  }

  if (isLoading) return <div className="flex justify-center items-center h-screen"><div className="animate-pulse text-primary">Loading...</div></div>
  if (!trip || !expense) return <LoadError retry={refetch} />

  return (
    <ExpenseForm
      key={expense.id}
      trip={trip}
      initialData={expense}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      isSubmitting={updateExpense.isPending}
      submitLabel="Update Expense"
      pageTitle="Edit Expense"
    />
  )
}
