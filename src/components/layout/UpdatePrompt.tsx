import { useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { ToastAction } from '@/components/ui/toast'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function UpdatePrompt() {
  const { toast } = useToast()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('Service worker registration failed', error)
    },
  })

  useEffect(() => {
    if (needRefresh) {
      toast({
        title: 'Update Available',
        description: 'A new version of SplitSync is ready.',
        duration: 30000,
        action: (
          <ToastAction
            altText="Reload"
            onClick={() => {
              updateServiceWorker(true)
              setNeedRefresh(false)
            }}
          >
            Reload
          </ToastAction>
        ),
      })
    }
  }, [needRefresh, toast, setNeedRefresh, updateServiceWorker])

  return null
}
