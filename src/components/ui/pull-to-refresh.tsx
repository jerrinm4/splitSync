import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react'
import { RefreshCw } from 'lucide-react'

export interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: React.ReactNode
}

export const PullToRefresh = forwardRef<HTMLDivElement, PullToRefreshProps>(({ onRefresh, children }, ref) => {
  const [startY, setStartY] = useState(0)
  const [currentY, setCurrentY] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [pulling, setPulling] = useState(false)
  
  const internalRef = useRef<HTMLDivElement>(null)
  
  useImperativeHandle(ref, () => internalRef.current as HTMLDivElement)

  
  const pullDistance = currentY - startY
  const MAX_PULL = 100
  const THRESHOLD = 60
  
  const translateY = pulling ? Math.min(Math.max(pullDistance, 0), MAX_PULL) : 0
  const rotation = pulling ? Math.min((translateY / THRESHOLD) * 360, 360) : 0
  const opacity = pulling ? Math.min(translateY / THRESHOLD, 1) : 0

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only allow pull to refresh if we are at the top of the scroll container
    if (internalRef.current && internalRef.current.scrollTop === 0) {
      setStartY((e.touches[0]?.clientY ?? 0))
      setCurrentY((e.touches[0]?.clientY ?? 0))
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY === 0 || refreshing) return

    const y = (e.touches[0]?.clientY ?? 0)
    if (y > startY) {
      if (!pulling) setPulling(true)
      setCurrentY(y)
      
    }
  }

  const handleTouchEnd = async () => {
    if (startY === 0 || refreshing) return

    if (translateY >= THRESHOLD) {
      setRefreshing(true)
      setPulling(false)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
      }
    } else {
      setPulling(false)
    }
    setStartY(0)
    setCurrentY(0)
  }

  return (
    <div 
      className="relative w-full h-full overflow-hidden flex flex-col overscroll-y-none"
    >
      <div 
        className="absolute top-0 left-0 right-0 flex justify-center items-center z-50 pointer-events-none transition-all duration-200 ease-out"
        style={{ 
          height: `${MAX_PULL}px`,
          transform: `translateY(${refreshing ? 0 : translateY - MAX_PULL}px)`,
          opacity: refreshing ? 1 : opacity
        }}
      >
        <div className="bg-background rounded-full p-2 shadow-lg border border-border/50">
          <RefreshCw 
            className={`w-5 h-5 text-primary ${refreshing ? 'animate-spin' : ''}`}
            style={!refreshing ? { transform: `rotate(${rotation}deg)` } : {}} 
          />
        </div>
      </div>

      <div 
        ref={internalRef}
        className={`flex-1 overflow-y-auto w-full h-full transition-transform duration-200 ease-out ${refreshing ? 'translate-y-[60px]' : ''}`}
        style={!refreshing && pulling ? { transform: `translateY(${translateY}px)` } : {}}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  )
})
