import { LoadError } from '@/components/layout/LoadError'
import { useParams, useNavigate, useSearch, useRouter } from '@tanstack/react-router'
import { useTrip } from '@/features/trips/hooks/useTrip'
import { useAddExpense } from '@/features/expenses/hooks/useExpenses'
import { useToast } from '@/hooks/use-toast'
import { ExpenseForm } from '@/components/expenses/ExpenseForm'

export default function AddExpensePage() {
  const { tripId } = useParams({ strict: false }) as { tripId: string }
  const search = useSearch({ strict: false }) as { prefillMemberId?: string }
  const { data: trip, isLoading, refetch } = useTrip(tripId)
  const addExpense = useAddExpense()
  const { toast } = useToast()
  const navigate = useNavigate()
  const router = useRouter()

  const goBack = () => {
    if (window.history.length > 2) {
      router.history.go(-1)
    } else {
      navigate({ to: "/trips/$tripId", params: { tripId: tripId } })
    }
  }

  const handleCancel = () => {
    goBack()
  }

  const handleSubmit = async (data: any) => {
    try {
      await addExpense.mutateAsync({
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

      toast({ title: 'Expense added successfully' })
      goBack()
    } catch (err: any) {
      toast({ title: 'Error adding expense', description: err.message, variant: 'destructive' })
      throw err // Rethrow to let form handle it if needed
    }
  }

  if (isLoading) return <div className="flex justify-center items-center h-screen"><div className="animate-pulse text-primary">Loading...</div></div>
  if (!trip) return <LoadError retry={refetch} />

  return (
    <ExpenseForm
      trip={trip}
      prefillMemberId={search.prefillMemberId}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      isSubmitting={addExpense.isPending}
      submitLabel="Save Expense"
      pageTitle="Add Expense"
    />
  )
}
