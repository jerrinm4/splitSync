import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useManageFunds() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      action, tripId, memberId, amountPaise, note 
    }: { 
      action: 'ADD' | 'REMOVE', tripId: string, memberId: string, amountPaise: number, note?: string 
    }) => {
      const idempotencyKey = crypto.randomUUID()
      
      const functionName = action === 'ADD' ? 'add_funds' : 'remove_funds'
      
      const { data, error } = await supabase.rpc(functionName, {
        p_trip_id: tripId,
        p_member_id: memberId,
        p_amount_paise: amountPaise,
        p_note: note || '',
        p_idempotency_key: idempotencyKey
      })
        
      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['trips', variables.tripId] })
    }
  })
}
