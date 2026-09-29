import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { useEffect, useState, useRef } from "react"
import { Outlet, Link, useLocation, useParams, useNavigate } from "@tanstack/react-router"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { useTrips } from "@/features/trips/hooks/useTrips"
import { Button } from "@/components/ui/button"
import { LogOut, Map, Plus, ChevronRight, Menu, Home, Users, CreditCard, Receipt, Sun, Moon, Settings, History, Palette } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export default function AppLayout() {
  const { user, loading, signOut } = useAuth()
  const { data: trips } = useTrips()
  const location = useLocation()
  const params = useParams({ strict: false }) as { tripId?: string }
  const [mobileMenu, setMobileMenu] = useState({ path: location.pathname, open: false })
  const mobileMenuOpen = mobileMenu.open && mobileMenu.path === location.pathname
  const setMobileMenuOpen = (open: boolean) => setMobileMenu({ path: location.pathname, open })
  const mainRef = useRef<HTMLDivElement>(null)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const queryClient = useQueryClient()

  const handleRefresh = async () => {
    await queryClient.invalidateQueries()
    await new Promise(resolve => setTimeout(resolve, 500)) // smooth UX
  }

  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('app-theme')
    if (saved) return saved === 'dark'
    return true // default dark mode for admin view
  })

  const [themeColor, setThemeColor] = useState(() => {
    return localStorage.getItem('app-theme-color') || 'default'
  })

  useEffect(() => {
    localStorage.setItem('app-theme', isDark ? 'dark' : 'light')
    if (isDark) {
      document.documentElement.classList.remove('light')
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])

  useEffect(() => {
    localStorage.setItem('app-theme-color', themeColor)
    if (themeColor === 'yellow') {
      document.documentElement.classList.add('theme-yellow')
    } else {
      document.documentElement.classList.remove('theme-yellow')
    }
  }, [themeColor])

  useEffect(() => {
    if (params.tripId) {
      localStorage.setItem('lastSelectedTrip', params.tripId)
    }
  }, [params.tripId])

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo(0, 0)
    }
  }, [location.pathname])

  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: '/login' })
    }
  }, [loading, user, navigate])

  if (loading || !user) return <div className="flex h-screen items-center justify-center bg-background"><div className="animate-pulse text-primary">Loading...</div></div>

  const activeTripId = params.tripId

  const renderTripNavigation = (tripId: string) => (
    <div className="flex flex-col space-y-1 mt-2 pl-4 border-l-2 border-primary/20 ml-2">
      <Link to="/trips/$tripId" params={{ tripId: tripId }} className={`flex items-center text-sm px-3 py-2 rounded-md transition-colors ${location.pathname === `/trips/${tripId}` ? 'bg-primary/20 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'}`}>
        <Home className="w-4 h-4 mr-2" /> Dashboard
      </Link>
      <Link to="/trips/$tripId/expenses" params={{ tripId: tripId }} className={`flex items-center text-sm px-3 py-2 rounded-md transition-colors ${location.pathname.includes('/expenses') ? 'bg-primary/20 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'}`}>
        <Receipt className="w-4 h-4 mr-2" /> Expenses
      </Link>
      <Link to="/trips/$tripId/members" params={{ tripId: tripId }} className={`flex items-center text-sm px-3 py-2 rounded-md transition-colors ${location.pathname.includes('/members') ? 'bg-primary/20 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'}`}>
        <Users className="w-4 h-4 mr-2" /> Members
      </Link>
      <Link to="/trips/$tripId/funds" params={{ tripId: tripId }} className={`flex items-center text-sm px-3 py-2 rounded-md transition-colors ${location.pathname.includes('/funds') ? 'bg-primary/20 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'}`}>
        <CreditCard className="w-4 h-4 mr-2" /> Funds
      </Link>
      <Link to="/trips/$tripId/settings" params={{ tripId: tripId }} className={`flex items-center text-sm px-3 py-2 rounded-md transition-colors ${location.pathname.includes('/settings') ? 'bg-primary/20 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'}`}>
        <Settings className="w-4 h-4 mr-2" /> Settings
      </Link>
      <Link to="/trips/$tripId/activity" params={{ tripId: tripId }} className={`flex items-center text-sm px-3 py-2 rounded-md transition-colors ${location.pathname.includes('/activity') ? 'bg-primary/20 text-primary font-medium' : 'hover:bg-muted text-muted-foreground'}`}>
        <History className="w-4 h-4 mr-2" /> Activity Log
      </Link>
    </div>
  )

  const renderSidebarContent = () => (
    <>
      <div className="p-6 font-black text-2xl tracking-tighter text-primary flex items-center justify-between border-b border-border/50">
        SplitSync

      </div>
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-4 no-scrollbar">
        <div className="space-y-1">
          <Link to="/trips" search={{ all: true }} className={`flex items-center px-3 py-2 rounded-lg font-medium transition-all ${location.pathname === '/trips' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'hover:bg-muted'}`}>
            <Map className="w-5 h-5 mr-3" /> All Trips
          </Link>
        </div>

        <div className="pt-4">
          <div className="px-3 mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground flex justify-between items-center">
            Your Trips
              <Link to="/trips/new" aria-label="Create a trip" className="hover:text-primary transition-colors">
              <Plus className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-1">
            {trips?.map(trip => (
              <div key={trip.id} className="mb-1">
                <Link to="/trips/$tripId" params={{ tripId: trip.id }} className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all ${activeTripId === trip.id ? 'bg-muted/50 font-semibold text-foreground' : 'hover:bg-muted text-muted-foreground font-medium'}`}>
                  <span className="truncate">{trip.name}</span>
                  {activeTripId !== trip.id && <ChevronRight className="w-4 h-4 opacity-50" />}
                </Link>
                {activeTripId === trip.id && renderTripNavigation(trip.id)}
              </div>
            ))}
            {trips?.length === 0 && (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center bg-muted/30 rounded-lg border border-dashed border-border">
                No trips found
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="p-4 border-t border-border/50 bg-muted/10">
        <div className="flex items-center justify-between px-3 py-2 mb-2 bg-background rounded-lg border border-border/50 shadow-sm">
          <span className="text-sm font-medium truncate mr-2">{user.email}</span>
          <div className="flex items-center space-x-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-full bg-background border-border hover:bg-accent group" title="Select Color Theme">
                  <Palette className="h-4 w-4 text-primary group-hover:text-black transition-colors" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setThemeColor('default')} className={themeColor === 'default' ? 'bg-primary/10 text-primary font-bold' : ''}>
                  Purple Theme
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setThemeColor('yellow')} className={themeColor === 'yellow' ? 'bg-primary/10 text-primary font-bold' : ''}>
                  Yellow Theme
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full bg-background border-border hover:bg-accent group" onClick={() => setIsDark(!isDark)} title="Toggle Dark/Light Mode">
              {isDark ? <Sun className="h-4 w-4 text-amber-500 group-hover:text-black transition-colors" /> : <Moon className="h-4 w-4 text-indigo-500 group-hover:text-white transition-colors" />}
            </Button>
          </div>
        </div>
        <Button variant="destructive" className="w-full justify-center bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground shadow-none" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </>
  )

  return (
    <div className="flex h-dvh w-full flex-col md:flex-row bg-background">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-background focus:p-3">Skip to main content</a>
      <aside aria-label="Trip sidebar" className="hidden w-72 flex-col border-r border-border/50 bg-card/40 backdrop-blur-xl md:flex shadow-xl shadow-black/5 z-10">
        {renderSidebarContent()}
      </aside>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 flex flex-col w-[min(85vw,320px)] gap-0" onCloseAutoFocus={event => { event.preventDefault(); menuTriggerRef.current?.focus() }}>
          <SheetTitle className="sr-only">Trip navigation</SheetTitle>
          <SheetDescription className="sr-only">Choose a trip, open a page or manage your account.</SheetDescription>
          {renderSidebarContent()}
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden relative">
        <header className="flex h-16 items-center justify-between border-b border-border/50 bg-card/60 backdrop-blur-md px-4 lg:px-6 md:hidden z-30 sticky top-0">
          <div className="flex items-center">
            <Button ref={menuTriggerRef} variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setMobileMenuOpen(true)} className="mr-2 -ml-2">
              <Menu className="h-6 w-6" />
            </Button>
            <div className="font-black text-xl tracking-tighter text-primary">SplitSync</div>
          </div>
          <div className="flex items-center space-x-2 ml-auto">
            <Button variant="outline" size="icon" onClick={() => setIsDark(!isDark)} className="rounded-full bg-background/50 border-border hover:bg-accent group" title="Toggle Dark/Light Mode">
              {isDark ? <Sun className="h-5 w-5 text-amber-500 group-hover:text-black transition-colors" /> : <Moon className="h-5 w-5 text-indigo-500 group-hover:text-white transition-colors" />}
            </Button>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col overflow-hidden bg-background relative z-0">
          <PullToRefresh onRefresh={handleRefresh} ref={mainRef}>
            <div className="p-4 md:p-8 min-h-full">
              <Outlet />
            </div>
          </PullToRefresh>
        </main>

        {activeTripId && (
          <nav aria-label="Trip pages" className="flex items-center justify-around border-t border-border/50 bg-card/80 backdrop-blur-lg md:hidden z-30 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
            <Link to="/trips/$tripId" params={{ tripId: activeTripId }} className={`flex flex-col items-center justify-center w-full h-full text-[10px] font-medium transition-colors ${location.pathname === `/trips/${activeTripId}` ? 'text-primary' : 'text-muted-foreground'}`}>
              <Home className={`w-5 h-5 mb-1 ${location.pathname === `/trips/${activeTripId}` ? 'fill-primary/20' : ''}`} />
              Home
            </Link>
            <Link to="/trips/$tripId/expenses" params={{ tripId: activeTripId }} className={`flex flex-col items-center justify-center w-full h-full text-[10px] font-medium transition-colors ${location.pathname.includes('/expenses') ? 'text-primary' : 'text-muted-foreground'}`}>
              <Receipt className={`w-5 h-5 mb-1 ${location.pathname.includes('/expenses') ? 'fill-primary/20' : ''}`} />
              Expenses
            </Link>
            <Link to="/trips/$tripId/members" params={{ tripId: activeTripId }} className={`flex flex-col items-center justify-center w-full h-full text-[10px] font-medium transition-colors ${location.pathname.includes('/members') ? 'text-primary' : 'text-muted-foreground'}`}>
              <Users className={`w-5 h-5 mb-1 ${location.pathname.includes('/members') ? 'fill-primary/20' : ''}`} />
              Members
            </Link>
            <Link to="/trips/$tripId/funds" params={{ tripId: activeTripId }} className={`flex flex-col items-center justify-center w-full h-full text-[10px] font-medium transition-colors ${location.pathname.includes('/funds') ? 'text-primary' : 'text-muted-foreground'}`}>
              <CreditCard className={`w-5 h-5 mb-1 ${location.pathname.includes('/funds') ? 'fill-primary/20' : ''}`} />
              Funds
            </Link>
          </nav>
        )}
      </div>
    </div>
  )
}
