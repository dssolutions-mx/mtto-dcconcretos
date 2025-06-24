"use client"

import React, { useState, useRef, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/use-mobile'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: React.ReactNode
  disabled?: boolean
  className?: string
}

export function PullToRefresh({ 
  onRefresh, 
  children, 
  disabled = false,
  className 
}: PullToRefreshProps) {
  const isMobile = useIsMobile()
  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const touchStartY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const threshold = 60 // Distance needed to trigger refresh
  const maxPull = 120 // Maximum pull distance

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile || disabled || isRefreshing) return
    
    // Only start pull if we're at the top of the page
    if (window.scrollY > 0) return
    
    touchStartY.current = e.touches[0].clientY
    setIsPulling(true)
  }, [isMobile, disabled, isRefreshing])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || !isMobile || disabled || isRefreshing) return
    
    const currentY = e.touches[0].clientY
    const distance = Math.max(0, currentY - touchStartY.current)
    
    if (distance > 0 && window.scrollY === 0) {
      e.preventDefault()
      const cappedDistance = Math.min(distance * 0.5, maxPull)
      setPullDistance(cappedDistance)
    }
  }, [isPulling, isMobile, disabled, isRefreshing])

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || !isMobile || disabled) return
    
    setIsPulling(false)
    
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true)
      try {
        await onRefresh()
      } catch (error) {
        console.error('Refresh failed:', error)
      } finally {
        setIsRefreshing(false)
      }
    }
    
    setPullDistance(0)
  }, [isPulling, isMobile, disabled, pullDistance, threshold, isRefreshing, onRefresh])

  const refreshOpacity = Math.min(pullDistance / threshold, 1)
  const iconRotation = pullDistance * 2

  return (
    <div 
      ref={containerRef}
      className={cn("relative", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      {isMobile && (isPulling || isRefreshing) && (
        <div 
          className="absolute top-0 left-0 right-0 flex items-center justify-center bg-background/80 backdrop-blur-sm border-b transition-all duration-200 z-50"
          style={{ 
            height: Math.max(pullDistance, isRefreshing ? 60 : 0),
            opacity: isRefreshing ? 1 : refreshOpacity 
          }}
        >
          <div className="flex flex-col items-center gap-1">
            <RefreshCw 
              className={cn(
                "h-5 w-5 text-primary transition-transform duration-200",
                isRefreshing && "animate-spin"
              )}
              style={{ 
                transform: `rotate(${isRefreshing ? 0 : iconRotation}deg)` 
              }}
            />
            <span className="text-xs text-muted-foreground">
              {isRefreshing 
                ? 'Actualizando...' 
                : pullDistance >= threshold 
                  ? 'Suelta para actualizar' 
                  : 'Desliza para actualizar'
              }
            </span>
          </div>
        </div>
      )}
      
      {/* Content */}
      <div 
        style={{ 
          transform: isMobile && (isPulling || isRefreshing) 
            ? `translateY(${Math.max(pullDistance, isRefreshing ? 60 : 0)}px)` 
            : 'none',
          transition: isPulling ? 'none' : 'transform 0.2s ease-out'
        }}
      >
        {children}
      </div>
    </div>
  )
} 