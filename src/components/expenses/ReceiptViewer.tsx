import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { receiptPath } from '@/lib/receipts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

export function ReceiptViewer({ receipt, tripId, title }: { receipt: string; tripId: string; title: string }) {
  const [open, setOpen] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const query = useQuery({
    queryKey: ['receipt', tripId, receipt],
    enabled: open,
    retry: false,
    staleTime: 240000,
    gcTime: 300000,
    refetchInterval: open ? 240000 : false,
    queryFn: async () => {
      const path = receiptPath(receipt, tripId, import.meta.env.VITE_SUPABASE_URL)
      const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 300)
      if (error) throw error
      return data.signedUrl
    },
  })
  return (
    <Dialog open={open} onOpenChange={value => { setOpen(value); setImageFailed(false) }}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" aria-label={`View receipt for ${title}`} onClick={event => event.stopPropagation()}>View receipt</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl" onClick={event => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Receipt: {title}</DialogTitle>
          <DialogDescription>Available to this trip's owner and admins. Download links expire after five minutes.</DialogDescription>
        </DialogHeader>
        {query.isFetching && !query.data && <p role="status">Loading receipt...</p>}
        {(query.isError || imageFailed) ? (
          <div role="alert" className="space-y-3">
            <p>Could not load this receipt. Check your connection and trip access, then try again.</p>
            <Button onClick={() => { setImageFailed(false); void query.refetch() }} disabled={query.isFetching}>Retry receipt</Button>
          </div>
        ) : query.data && (
          <div className="space-y-3">
            <img key={query.dataUpdatedAt} src={query.data} alt={`Receipt for ${title}`} className="max-h-[60dvh] w-full object-contain" onError={() => setImageFailed(true)} />
            <a href={query.data} target="_blank" rel="noreferrer" className="text-primary underline">Open receipt in a new tab</a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
