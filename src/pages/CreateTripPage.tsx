import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createTripSchema } from '@/lib/validation'
import { useCreateTrip } from '@/features/trips/hooks/useTrips'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { z } from 'zod'

type CreateTripValues = z.infer<typeof createTripSchema>

export default function CreateTripPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const createTrip = useCreateTrip()

  const form = useForm<CreateTripValues>({
    resolver: zodResolver(createTripSchema),
    defaultValues: {
      name: '',
      note: '',
      currency: 'INR',
    }
  })

  const onSubmit = async (data: CreateTripValues) => {
    try {
      const trip = await createTrip.mutateAsync(data)
      toast({ title: 'Trip created successfully' })
      navigate({ to: "/trips/$tripId", params: { tripId: trip.id } })
    } catch (error: any) {
      toast({
        title: 'Error creating trip',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Create a New Trip</h1>
      <Card>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle>Trip Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trip Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter Trip Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Any details..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="justify-end space-x-2">
              <Button variant="outline" type="button" onClick={() => navigate({ to: '/trips' })}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTrip.isPending}>
                {createTrip.isPending ? 'Creating...' : 'Create Trip'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  )
}
