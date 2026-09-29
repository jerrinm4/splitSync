import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// Preserve OAuth errors for the login screen before the auth client consumes the URL.
if (typeof window !== 'undefined' && window.location.hash.includes('error=')) {
  sessionStorage.setItem('auth_error_hash', window.location.hash)
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
