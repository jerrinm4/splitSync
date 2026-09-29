import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Trip } from '@/types/trip'
import { supabase } from '@/lib/supabase'

export function useTrips() {
  return useQuery({
    queryKey: ['trips'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data as Trip[]
    }
  })
}

export function useCreateTrip() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (tripData: { name: string, note?: string, currency: string }) => {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('trips')
        .insert({
          name: tripData.name,
          note: tripData.note,
          currency: tripData.currency,
          owner_id: user.user.id
        })
        .select()
        .single()
        
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] })
    }
  })
}
