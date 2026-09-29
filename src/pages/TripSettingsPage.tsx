import { LoadError } from '@/components/layout/LoadError'
import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useTripAdmins, useTripOwner, useAddTripAdmin, useRemoveTripAdmin } from '@/features/trips/hooks/useTripAdmins'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { format } from 'date-fns'
import { UserPlus, ShieldAlert, ShieldCheck, Shield, Trash2, RefreshCw, AlertTriangle, Settings, ArrowDown, ArrowUp, Equal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useTrip, useUpdateTrip } from '@/features/trips/hooks/useTrip'
import { recalculateAllTripSplits } from '@/lib/money'
import type { RoundingMode } from '@/lib/money'
import { useResyncExpenses } from '@/features/expenses/hooks/useExpenses'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { createTripBackup, downloadFile, exportFilename } from '@/lib/export'

export default function TripSettingsPage() {
  const { tripId } = useParams({ strict: false }) as { tripId: string }
  const { user } = useAuth()
  const { data: admins, isLoading: adminsLoading } = useTripAdmins(tripId)
  const { data: owner, isLoading: ownerLoading } = useTripOwner(tripId)
  const addAdmin = useAddTripAdmin()
  const removeAdmin = useRemoveTripAdmin()
  const { toast } = useToast()

  const { data: trip, isLoading: tripLoading } = useTrip(tripId)
  const updateTrip = useUpdateTrip()
  const resyncExpenses = useResyncExpenses()

  const [openAddModal, setOpenAddModal] = useState(false)
  const [newAdminEmail, setNewAdminEmail] = useState('')

  const [openRemoveModal, setOpenRemoveModal] = useState(false)
  const [adminToRemove, setAdminToRemove] = useState<{ id: string, email: string } | null>(null)

  const [isResyncModalOpen, setIsResyncModalOpen] = useState(false)

  const isOwner = user?.id === owner?.owner_id

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAdminEmail.trim()) return

    try {
      await addAdmin.mutateAsync({ tripId, email: newAdminEmail.trim() })
      toast({ title: 'Success', description: `${newAdminEmail} is now an admin.` })
      setOpenAddModal(false)
      setNewAdminEmail('')
    } catch (err: any) {
      toast({ title: 'Error adding admin', description: err.message, variant: 'destructive' })
    }
  }

  const handleRemoveAdmin = async () => {
    if (!adminToRemove) return
    try {
      await removeAdmin.mutateAsync({ tripId, userId: adminToRemove.id })
      toast({ title: 'Admin removed successfully' })
      setOpenRemoveModal(false)
      setAdminToRemove(null)
    } catch (err: any) {
      toast({ title: 'Error removing admin', description: err.message, variant: 'destructive' })
    }
  }

  const handleResync = async () => {
    if (!trip?.expenses || trip.expenses.length === 0) return;

    toast({ title: 'Analyzing expenses...', description: 'Calculating optimal rounding distribution.' });

    try {
      const updatedExpenses = recalculateAllTripSplits(trip.expenses);
      if (updatedExpenses.length === 0) {
        toast({ title: 'Everything is balanced!', description: 'No rounding corrections were needed.' });
        setIsResyncModalOpen(false)
        return;
      }

      toast({ title: 'Resyncing...', description: `Updating ${updatedExpenses.length} expenses for fair rounding.` });
      await resyncExpenses.mutateAsync({ tripId: trip.id, updatedExpenses });
      toast({ title: 'Resync complete', description: 'Rounding errors have been fairly distributed.' });
      setIsResyncModalOpen(false)
    } catch (err: any) {
      toast({ title: 'Resync failed', description: err.message || 'An error occurred', variant: 'destructive' });
      setIsResyncModalOpen(false)
    }
  }

  if (adminsLoading || ownerLoading || tripLoading) return <div className="flex justify-center items-center h-40"><div className="animate-pulse text-primary font-bold">Loading settings...</div></div>

  if (!trip || !owner || !admins) return <LoadError retry={() => window.location.reload()} />

  return (
    <div className="space-y-6 animate-in-up pb-24 md:pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">Trip Settings</h1>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Keep a copy of your trip</CardTitle>
          <CardDescription>Download members, expenses, payer shares, categories and wallet transactions as JSON. Receipt references are included; image files must be saved separately.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" disabled={!trip} onClick={() => {
            if (trip) downloadFile(JSON.stringify(createTripBackup(trip), null, 2), exportFilename(trip.name, 'json'), 'application/json')
          }}>Download trip backup</Button>
          <p className="text-xs text-muted-foreground mt-2">Keep this file private. Automatic restore is not available.</p>
        </CardContent>
      </Card>

      <Card className="glass-card overflow-hidden">
        <CardHeader className="bg-primary/5 border-b border-border/50">
          <CardTitle className="text-xl flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> Manage Trip Admins
          </CardTitle>
          <CardDescription>
            Admins have full access to view and manage this trip.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">

            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Main Admin</h2>
              <div className="flex items-center justify-between p-4 rounded-xl border border-primary/20 bg-primary/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <ShieldAlert className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{owner?.email}</p>
                    <p className="text-xs text-muted-foreground">Trip Creator & Owner</p>
                  </div>
                </div>
                <Badge className="bg-primary hover:bg-primary">Owner</Badge>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Co-Admins</h2>
                {isOwner && (
                  <Button size="sm" variant="outline" className="h-8 rounded-full shadow-sm" onClick={() => setOpenAddModal(true)}>
                    <UserPlus className="w-4 h-4 mr-2" /> Add Admin
                  </Button>
                )}
              </div>

              {admins?.length === 0 ? (
                <div className="p-6 border border-dashed rounded-xl text-center text-muted-foreground bg-background/50">
                  <p className="text-sm">No co-admins added yet.</p>
                  {isOwner && <p className="text-xs mt-1">Add someone to help you manage this trip.</p>}
                </div>
              ) : (
                <div className="space-y-3">
                  {admins?.map(admin => (
                    <div key={admin.user_id} className="flex items-center justify-between p-4 rounded-xl border bg-background/50 hover:bg-background/80 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                          <ShieldCheck className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold">{admin.email}</p>
                          <p className="text-xs text-muted-foreground">Added {format(new Date(admin.created_at), 'MMM d, yyyy')}</p>
                        </div>
                      </div>

                      {isOwner && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full"
                          onClick={() => {
                            setAdminToRemove({ id: admin.user_id, email: admin.email })
                            setOpenRemoveModal(true)
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </CardContent>
      </Card>

      <Card className="glass-card overflow-hidden">
        <CardHeader className="bg-primary/5 border-b border-border/50">
          <CardTitle className="text-xl flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" /> Display & Calculation
          </CardTitle>
          <CardDescription>
            Customize how per-head costs and settlement amounts are displayed.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border bg-background/50 hover:bg-background/80 transition-colors">
            <div>
              <h2 className="font-bold text-foreground">Show Estimated Per Head</h2>
              <p className="text-sm text-muted-foreground mt-1">
                When enabled, per-head values on the dashboard and shared link include estimated expenses (based on category budgets). When off, only actual paid amounts are used.
              </p>
            </div>
            <Switch aria-label="Show estimated cost per person"               checked={trip?.show_estimated_per_head !== false}
              onCheckedChange={async (checked) => {
                try {
                  await updateTrip.mutateAsync({ tripId, updates: { show_estimated_per_head: checked } })
                  toast({ title: 'Setting updated', description: checked ? 'Showing estimated per head' : 'Showing actual per head only' })
                } catch (err: any) {
                  toast({ title: 'Error', description: err.message, variant: 'destructive' })
                }
              }}
              disabled={updateTrip.isPending}
            />
          </div>

          <div className="p-4 rounded-xl border bg-background/50 space-y-4">
            <div>
              <h2 className="font-bold text-foreground">Settlement Rounding Mode</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Controls how fractional paise are rounded when settling amounts between members.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  value: 'PAISE' as RoundingMode,
                  label: 'Keep Paise',
                  icon: <Equal className="w-4 h-4" />,
                  description: 'Preserve exact fractional amounts.',
                  example: 'Displays full precision (e.g. ₹125.60)'
                },
                {
                  value: 'FLOOR' as RoundingMode,
                  label: 'Floor (Lower Limit)',
                  icon: <ArrowDown className="w-4 h-4" />,
                  description: 'Round down when returning money.',
                  example: 'Favors the collector for simplicity'
                },
                {
                  value: 'CEIL' as RoundingMode,
                  label: 'Ceil (Upper Limit)',
                  icon: <ArrowUp className="w-4 h-4" />,
                  description: 'Round up when returning money.',
                  example: 'Favors the payer for simplicity'
                }
              ].map((option) => {
                const isSelected = (trip?.rounding_mode || 'PAISE') === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={async () => {
                      try {
                        await updateTrip.mutateAsync({ tripId, updates: { rounding_mode: option.value } })
                        toast({ title: 'Rounding updated', description: `Using ${option.label} mode` })
                      } catch (err: any) {
                        toast({ title: 'Error', description: err.message, variant: 'destructive' })
                      }
                    }}
                    disabled={updateTrip.isPending}
                    className={`relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border/50 bg-background hover:border-primary/30 hover:bg-primary/5'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      </div>
                    )}
                    <div className={`flex items-center gap-2 font-bold text-sm ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                      {option.icon}
                      {option.label}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{option.description}</p>
                    <p className="text-[10px] text-muted-foreground/70 font-medium">{option.example}</p>
                  </button>
                )
              })}
            </div>
          </div>

        </CardContent>
      </Card>

      <Card className="glass-card overflow-hidden">
        <CardHeader className="bg-destructive/5 border-b border-border/50">
          <CardTitle className="text-xl flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" /> Maintenance & Advanced
          </CardTitle>
          <CardDescription>
            Advanced settings and maintenance actions for this trip.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border bg-background/50 hover:bg-background/80 transition-colors">
            <div>
              <h2 className="font-bold text-foreground">Resync Rounding Errors</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Fairly redistribute 1-paise rounding remainders across all expenses. Use this if you notice someone is accumulating a slightly higher balance over many expenses.
              </p>
            </div>
            <Button variant="outline" onClick={() => setIsResyncModalOpen(true)} disabled={resyncExpenses.isPending} className="shrink-0 bg-background shadow-sm hover:bg-accent">
              <RefreshCw className={`w-4 h-4 mr-2 ${resyncExpenses.isPending ? 'animate-spin' : ''}`} />
              Resync Rounding
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={openAddModal} onOpenChange={(o) => {
        setOpenAddModal(o)
        if (!o) setNewAdminEmail('')
      }}>
        <DialogContent className="glass border-border/50">
          <DialogHeader>
            <DialogTitle>Add Co-Admin</DialogTitle>
            <DialogDescription>
              Enter the full email address of the registered user you want to add as a co-admin.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddAdmin} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                required
                className="bg-background/50"
                placeholder="user@example.com"
                autoComplete="off"
                data-1p-ignore
              />
              <p className="text-xs text-muted-foreground">
                For security reasons, autocomplete is disabled. The user must already have an account on SplitSync.
              </p>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpenAddModal(false)} disabled={addAdmin.isPending}>Cancel</Button>
              <Button type="submit" disabled={addAdmin.isPending}>
                {addAdmin.isPending ? 'Adding...' : 'Add Admin'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openRemoveModal} onOpenChange={setOpenRemoveModal}>
        <DialogContent className="glass border-border/50">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" /> Remove Co-Admin
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{adminToRemove?.email}</strong> from this trip?
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground pt-2">
            They will instantly lose all access to view or manage this trip, including members, expenses, and funds.
          </div>
          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setOpenRemoveModal(false)} disabled={removeAdmin.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemoveAdmin} disabled={removeAdmin.isPending}>
              {removeAdmin.isPending ? 'Removing...' : 'Yes, Remove Admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={isResyncModalOpen}
        onClose={() => setIsResyncModalOpen(false)}
        onConfirm={handleResync}
        title="Resync Rounding Errors"
        description="This action will analyze all expenses in this trip and safely redistribute any rounding errors (1 paise) evenly across all involved members over time. It may take a few seconds."
        requiredText="resync"
        isDestructive={false}
      />

    </div>
  )
}
