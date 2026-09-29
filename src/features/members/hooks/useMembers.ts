import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useMembers(tripId: string) {
  return useQuery({
    queryKey: ['members', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trip_members')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true })
        
      if (error) throw error
      return data
    },
    enabled: !!tripId
  })
}

export function useAddMember() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ tripId, name, note }: { tripId: string, name: string, note?: string }) => {
      const { data, error } = await supabase
        .from('trip_members')
        .insert({ trip_id: tripId, name, note })
        .select()
        .single()
        
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['members', data.trip_id] })
      queryClient.invalidateQueries({ queryKey: ['trips', data.trip_id] })
    }
  })
}

export function useUpdateMember() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ memberId, name, note, status }: { _tripId?: string, tripId?: string, memberId: string, name: string, note?: string, status?: 'ACTIVE' | 'INACTIVE' }) => {
      const { data, error } = await supabase
        .from('trip_members')
        .update({ name, note, status })
        .eq('id', memberId)
        .select()
        .single()
        
      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['members', variables.tripId] })
      queryClient.invalidateQueries({ queryKey: ['trips', variables.tripId] })
    }
  })
}

export function useDeleteMember() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ memberId }: { memberId: string, tripId: string }) => {
      const { error } = await supabase
        .from('trip_members')
        .delete()
        .eq('id', memberId)
        
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['members', variables.tripId] })
      queryClient.invalidateQueries({ queryKey: ['trips', variables.tripId] })
    }
  })
}
