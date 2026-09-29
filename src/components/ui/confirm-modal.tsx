import { useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  confirmLabel?: string
  title: string
  description?: string
  requiredText?: string
  isDestructive?: boolean
}

export function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  description, 
  requiredText,
  isDestructive = true,
  confirmLabel = 'Confirm'
}: ConfirmModalProps) {
  const [inputText, setInputText] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)

  const handleConfirm = async () => {
    if (busy.current) return
    if (!requiredText || inputText.toLowerCase() === requiredText.toLowerCase()) {
      busy.current = true
      setPending(true)
      setError('')
      try {
        await onConfirm()
        setInputText('')
        onClose()
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Something went wrong. Please try again.')
      } finally {
        busy.current = false
        setPending(false)
      }
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (busy.current) return
    if (!open) {
      setInputText('')
      setError('')
      onClose()
    }
  }

  const isValid = !requiredText || inputText.toLowerCase() === requiredText.toLowerCase()

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" aria-busy={pending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {requiredText && (
          <div className="flex flex-col space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              To proceed, please type <strong>{requiredText}</strong> below.
            </p>
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="confirm-text" className="sr-only">Confirm Text</Label>
              <Input 
                id="confirm-text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isValid) {
                    handleConfirm()
                  }
                }}
                placeholder={requiredText}
                autoComplete="off"
              />
            </div>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="sm:justify-end">
          <Button type="button" variant="outline" disabled={pending} onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            type="button" 
            variant={isDestructive ? 'destructive' : 'default'}
            disabled={!isValid || pending}
            onClick={handleConfirm}
          >
            {pending ? 'Preparing...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
