import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { router } from './router'
import { Toaster } from '@/components/ui/toaster'
import { UpdatePrompt } from '@/components/layout/UpdatePrompt'
import { ConnectionStatus } from '@/components/layout/ConnectionStatus'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } })

export function Providers() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
      <UpdatePrompt />
      <ConnectionStatus />
    </QueryClientProvider>
  )
}
