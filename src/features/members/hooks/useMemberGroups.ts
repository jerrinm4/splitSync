import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useAddMemberGroup() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ tripId, name, memberIds }: { tripId: string, name: string, memberIds: string[] }) => {
      const { data, error } = await supabase
        .from('trip_member_groups')
        .insert({
          trip_id: tripId,
          name,
          member_ids: memberIds
        })
        .select()
        .single()
        
      if (error) throw error
      return data
    },
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId] })
    }
  })
}

export function useUpdateMemberGroup() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ groupId, updates }: { groupId: string, tripId: string, updates: { name?: string, member_ids?: string[] } }) => {
      const { data, error } = await supabase
        .from('trip_member_groups')
        .update(updates)
        .eq('id', groupId)
        .select()
        .single()
        
      if (error) throw error
      return data
    },
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId] })
    }
  })
}

export function useDeleteMemberGroup() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ groupId }: { groupId: string, tripId: string }) => {
      const { error } = await supabase
        .from('trip_member_groups')
        .delete()
        .eq('id', groupId)
        
      if (error) throw error
    },
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId] })
    }
  })
}
