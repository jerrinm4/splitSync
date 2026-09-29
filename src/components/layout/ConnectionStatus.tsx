import { useSyncExternalStore } from 'react'

const subscribe = (notify: () => void) => {
  window.addEventListener('online', notify)
  window.addEventListener('offline', notify)
  return () => { window.removeEventListener('online', notify); window.removeEventListener('offline', notify) }
}

export function ConnectionStatus() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
  if (online) return null
  return <div role="status" className="fixed top-0 inset-x-0 z-[100] bg-amber-100 text-amber-950 px-4 py-2 text-center text-sm shadow">
    You’re offline. Reconnect to load trips and save changes.
  </div>
}
