'use client'

import { useRouter } from 'next/navigation'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import { Button } from '@/components/ui/button'
import { LogOut, Loader2 } from 'lucide-react'
import { useState } from 'react'

interface UnifiedLogoutButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  showIcon?: boolean
  showText?: boolean
  className?: string
  children?: React.ReactNode
}

export function UnifiedLogoutButton({
  variant = 'ghost',
  size = 'default',
  showIcon = true,
  showText = true,
  className = '',
  children
}: UnifiedLogoutButtonProps) {
  const router = useRouter()
  const { signOut, isLoading } = useAuthZustand()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleLogout = async () => {
    console.log('🚪 Unified logout initiated')
    setIsSigningOut(true)
    
    try {
      await signOut()
      console.log('✅ Logout successful, redirecting...')
      
      // Force immediate redirect
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('❌ Logout error:', error)
    } finally {
      setIsSigningOut(false)
    }
  }

  const isButtonLoading = isLoading || isSigningOut

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleLogout}
      disabled={isButtonLoading}
      className={className}
    >
      {isButtonLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          {showIcon && <LogOut className="h-4 w-4" />}
          {showText && (
            <span className={showIcon ? 'ml-2' : ''}>
              {children || 'Cerrar sesión'}
            </span>
          )}
        </>
      )}
    </Button>
  )
} 