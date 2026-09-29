import { LoadError } from '@/components/layout/LoadError'
import { useEffect } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useTrips } from '@/features/trips/hooks/useTrips'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'

export default function TripsPage() {
  const { data: trips, isLoading, error, refetch } = useTrips()
  const navigate = useNavigate()

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const showAll = urlParams.get('all');

    if (!showAll) {
      const lastTrip = localStorage.getItem('lastSelectedTrip')
      if (lastTrip) {
        navigate({ to: "/trips/$tripId", params: { tripId: lastTrip } })
      }
    }
  }, [navigate])

  if (isLoading) return <div className="flex h-full items-center justify-center"><div className="animate-pulse text-primary font-medium">Loading your trips...</div></div>

  if (error) return <LoadError retry={refetch} />

  return (
    <div className="space-y-6 animate-in-up">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">My Trips</h1>
        <Button asChild className="rounded-full shadow-lg shadow-primary/20">
          <Link to="/trips/new">+ New Trip</Link>
        </Button>
      </div>

      {!trips?.length ? (
        <Card className="text-center py-12 glass-card">
          <CardHeader>
            <CardTitle className="text-2xl">No trips yet</CardTitle>
            <CardDescription className="text-lg mt-2">Create your first trip to start tracking expenses.</CardDescription>
          </CardHeader>
          <CardContent className="mt-4">
            <Button asChild size="lg" className="rounded-full font-bold">
              <Link to="/trips/new">Create Trip</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <Card key={trip.id} className="glass-card hover:-translate-y-1">
              <Link to="/trips/$tripId" params={{ tripId: trip.id }} className="block h-full">
                <CardHeader>
                  <CardTitle className="text-xl text-primary">{trip.name}</CardTitle>
                  <CardDescription className="flex justify-between items-center mt-2">
                    <span>{format(new Date(trip.created_at), 'MMM d, yyyy')}</span>
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-semibold">{trip.status}</span>
                  </CardDescription>
                </CardHeader>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
