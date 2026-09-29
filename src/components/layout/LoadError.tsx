import { Button } from '@/components/ui/button'

export function LoadError({ retry }: { retry: () => unknown }) {
  return (
    <section role="alert" className="mx-auto max-w-md space-y-4 p-6 text-center">
      <h1 className="text-2xl font-bold">Could not load this page</h1>
      <p className="text-muted-foreground">Check your connection and try again. The trip may also have been removed or your access changed.</p>
      <Button onClick={() => { void retry() }}>Try again</Button>
    </section>
  )
}
