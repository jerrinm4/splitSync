import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface TripAdmin {
  user_id: string
  email: string
  created_at: string
}

export interface TripOwner {
  owner_id: string
  email: string
}

export function useTripAdmins(tripId: string) {
  return useQuery({
    queryKey: ['trip-admins', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_trip_admins', { p_trip_id: tripId })

      if (error) throw error
      return data as TripAdmin[]
    },
    enabled: !!tripId
  })
}

export function useTripOwner(tripId: string) {
  return useQuery({
    queryKey: ['trip-owner', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_trip_owner', { p_trip_id: tripId })

      if (error) throw error
      return data?.[0] as TripOwner | undefined
    },
    enabled: !!tripId
  })
}

export function useAddTripAdmin() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ tripId, email }: { tripId: string, email: string }) => {
      const { data, error } = await supabase
        .rpc('add_trip_admin_by_email', { p_trip_id: tripId, p_email: email })
        
      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trip-admins', variables.tripId] })
      queryClient.invalidateQueries({ queryKey: ['trips'] })
    }
  })
}

export function useRemoveTripAdmin() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ tripId, userId }: { tripId: string, userId: string }) => {
      // Direct delete since RLS restricts to owner
      const { error } = await supabase
        .from('trip_admins')
        .delete()
        .eq('trip_id', tripId)
        .eq('user_id', userId)
        
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trip-admins', variables.tripId] })
      queryClient.invalidateQueries({ queryKey: ['trips'] })
    }
  })
}
