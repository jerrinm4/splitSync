import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm font-semibold text-muted-foreground">404</p>
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="text-muted-foreground">This address may be incorrect or the page may have moved.</p>
      <Button asChild><Link to="/trips" search={{ all: true }}>Go to my trips</Link></Button>
    </main>
  )
}
