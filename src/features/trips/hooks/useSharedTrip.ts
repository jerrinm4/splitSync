import type { TripDetails } from '@/types/trip'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@supabase/supabase-js'

export function useCheckTripPin(shareToken: string) {
  return useQuery({
    queryKey: ['shared_trip_pin_check', shareToken],
    queryFn: async () => {
      // Use anon client without any specific headers
      const anonClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_KEY),
        { auth: { storageKey: `shared-${crypto.randomUUID()}`, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
      )
      
      const { data, error } = await anonClient.rpc('check_trip_pin_required', { p_share_token: shareToken })
      if (error) throw error
      return data as boolean
    },
    enabled: !!shareToken
  })
}

export function useSharedTrip(shareToken: string, sharePin?: string) {
  return useQuery({
    queryKey: ['shared_trip', shareToken, sharePin],
    queryFn: async () => {
      // Create a temporary client that sets the x-share-token header
      const anonClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_KEY),
        {
          auth: { storageKey: `shared-${crypto.randomUUID()}`, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          global: {
            headers: {
              'x-share-token': shareToken,
              ...(sharePin ? { 'x-share-pin': sharePin } : {})
            }
          }
        }
      )

      const { data, error } = await anonClient
        .from('trips')
        .select(`
          *,
          trip_members (*),
          expense_categories (*),
          expenses (
            *,
            expense_splits (*),
            expense_payers (*)
          ),
          fund_transactions (*)
        `)
        .eq('share_token', shareToken)
        .single()
        
      if (error) throw error
      return data as TripDetails
    },
    enabled: !!shareToken
  })
}
