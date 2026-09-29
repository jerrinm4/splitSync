import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'

export function useAuth() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      setUser(session?.user ?? null)
      setLoading(false)
    }).catch((err) => {
      if (!active) return
      console.error("Error getting session:", err)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      setUser(session?.user ?? null)
      setLoading(false)
      if (event === 'SIGNED_OUT') queryClient.clear()
    })

    return () => { active = false; subscription.unsubscribe() }
  }, [queryClient])

  const signInWithEmail = async (email: string) => {
    return supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + '/trips'
      }
    })
  }

  const signInWithGoogle = async () => {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/trips'
      }
    })
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
      queryClient.clear()
      localStorage.removeItem('lastSelectedTrip')
      sessionStorage.removeItem('auth_error_hash')
      window.location.assign('/login')
    } catch (err) {
      toast({ title: 'Could not sign out', description: err instanceof Error ? err.message : 'Please try again.', variant: 'destructive' })
    }
  }

  return {
    user,
    loading,
    signInWithEmail,
    signInWithGoogle,
    signOut
  }
}
