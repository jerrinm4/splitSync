import { useState, useEffect } from 'react'
import { Navigate } from '@tanstack/react-router'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState(() => {
    const hash = sessionStorage.getItem('auth_error_hash') || window.location.hash
    const params = new URLSearchParams(hash.replace('#', '?'))
    return params.get('error_description') || (params.has('error') ? 'Authentication error. Please try signing in again.' : '')
  })
  const [linkSent, setLinkSent] = useState(false)
  const { signInWithEmail, signInWithGoogle, user, loading: authLoading } = useAuth()

  useEffect(() => {
    // We saved the hash in sessionStorage before initializing Supabase to prevent it from hanging
    const savedHash = typeof window !== 'undefined' ? sessionStorage.getItem('auth_error_hash') : null
    const hashToParse = savedHash || window.location.hash

    if (hashToParse) {
      // Clear consumed OAuth errors before the next sign-in.
      if (savedHash) sessionStorage.removeItem('auth_error_hash')
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }
    }
  }, [])

  if (authLoading) return <div className="min-h-[100dvh] flex items-center justify-center text-primary animate-pulse">Loading...</div>
  if (user) return <Navigate to="/trips" />

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      const { error } = await signInWithEmail(email)

      if (error) {
        setErrorMsg(error.message)
      } else {
        setLinkSent(true)
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (linkSent) {
    return (
      <Card className="w-full max-w-md mx-auto glass-card border-primary/20 shadow-2xl shadow-primary/10 overflow-hidden relative animate-in zoom-in-95 duration-300">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40"></div>
        <CardHeader className="text-center space-y-4 pt-10">
          <div className="mx-auto w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-2">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black">Check your email</h1>
          <CardDescription className="text-base">
            We sent a secure magic link to <br/>
            <span className="font-bold text-foreground mt-1 block">{email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-10 pt-4 px-8 text-center">
          <p className="text-sm text-muted-foreground">
            Click the link in the email to instantly sign in. You can safely close this window.
          </p>
        </CardContent>
        <CardFooter className="justify-center border-t border-border/40 py-4 bg-muted/20">
          <Button variant="ghost" onClick={() => setLinkSent(false)} className="text-xs font-bold text-muted-foreground hover:text-foreground">
            Use a different email
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="text-center space-y-2 mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-4 shadow-inner">
          <Mail className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-black tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">SplitSync</h1>
        <p className="text-muted-foreground font-medium">Log in or create an account</p>
      </div>

      <Card className="w-full glass-card border-border/50 shadow-xl overflow-hidden relative">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl font-bold flex items-center">
            Welcome
          </CardTitle>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {errorMsg && (
              <div role="alert" className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-xl flex items-start animate-in slide-in-from-top-2">
                <AlertCircle className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 w-5 h-5 text-muted-foreground/50" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  className="pl-10 h-12 bg-background/50 border-transparent shadow-sm focus-visible:ring-primary/50 text-base rounded-xl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="pt-2 pb-6 flex-col gap-4">
            <Button className="w-full h-12 text-base font-bold shadow-lg shadow-primary/20 rounded-xl transition-transform active:scale-95" type="submit" disabled={loading || !email}>
              {loading ? 'Sending link...' : (
                <>Sign In with Magic Link <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>

            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground font-bold">Or continue with</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-12 text-base font-bold rounded-xl border-border/50 shadow-sm"
              onClick={async () => {
                try {
                  const { error } = await signInWithGoogle()
                  if (error) setErrorMsg(error.message)
                } catch (err: any) {
                  setErrorMsg(err.message)
                }
              }}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
                <path d="M1 1h22v22H1z" fill="none" />
              </svg>
              Google
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
