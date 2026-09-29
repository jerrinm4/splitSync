import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { TripDetails } from '@/types/trip'
import { supabase } from '@/lib/supabase'

export function useTrip(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select(`
          *,
          trip_members (*),
          trip_member_groups (*),
          expense_categories (*),
          expenses (
            *,
            expense_splits (*),
            expense_payers (*)
          ),
          fund_transactions (*)
        `)
        .eq('id', tripId)
        .single()
        
      if (error) throw error
      return data as TripDetails
    },
    enabled: !!tripId
  })
}

export function useUpdateTrip() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ tripId, updates }: { tripId: string, updates: any }) => {
      const { data, error } = await supabase
        .from('trips')
        .update(updates)
        .eq('id', tripId)
        .select()
        .single()
        
      if (error) throw error
      return data
    },
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId] })
      queryClient.invalidateQueries({ queryKey: ['trips'] })
    }
  })
}

export function useDeleteTrip() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (tripId: string) => {
      const { error } = await supabase
        .from('trips')
        .delete()
        .eq('id', tripId)
        
      if (error) throw error
      return true
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] })
    }
  })
}
