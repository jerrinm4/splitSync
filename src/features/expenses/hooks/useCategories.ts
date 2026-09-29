import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useCategories(tripId: string) {
  return useQuery({
    queryKey: ['categories', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data
    },
    enabled: !!tripId
  })
}

export function useAddCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ tripId, name, color, estimatedAmountPaise }: { tripId: string; name: string; color: string; estimatedAmountPaise?: number }) => {
      const { data, error } = await supabase
        .from('expense_categories')
        .insert({ trip_id: tripId, name, color, estimated_amount_paise: estimatedAmountPaise || 0 })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['categories', variables.tripId] })
      queryClient.invalidateQueries({ queryKey: ['trips', variables.tripId] })
    }
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ categoryId, name, color, estimatedAmountPaise }: { categoryId: string; tripId: string; name: string; color: string; estimatedAmountPaise?: number }) => {
      const { data, error } = await supabase
        .from('expense_categories')
        .update({ name, color, estimated_amount_paise: estimatedAmountPaise || 0 })
        .eq('id', categoryId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['categories', variables.tripId] })
      queryClient.invalidateQueries({ queryKey: ['trips', variables.tripId] })
    }
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ categoryId }: { categoryId: string; tripId: string }) => {
      const { error } = await supabase
        .from('expense_categories')
        .delete()
        .eq('id', categoryId)

      if (error) throw error
      return true
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['categories', variables.tripId] })
      queryClient.invalidateQueries({ queryKey: ['trips', variables.tripId] })
    }
  })
}
