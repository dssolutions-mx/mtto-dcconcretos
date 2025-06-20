"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RefreshCw, LogOut, AlertCircle } from "lucide-react"

interface SessionRecoveryProps {
  onRecovery?: () => void
}

export function SessionRecovery({ onRecovery }: SessionRecoveryProps) {
  const router = useRouter()
  const [isRecovering, setIsRecovering] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // Show recovery after 5 seconds of loading
    const timer = setTimeout(() => {
      setShowRecovery(true)
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  const handleRefreshSession = async () => {
    setIsRecovering(true)
    
    try {
      // Attempt to refresh the session
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error || !session) {
        // If refresh fails, sign out and redirect
        await handleForceLogout()
      } else {
        // Session refreshed successfully
        router.refresh()
        if (onRecovery) {
          onRecovery()
        }
      }
    } catch (error) {
      console.error('Session refresh error:', error)
      await handleForceLogout()
    } finally {
      setIsRecovering(false)
    }
  }

  const handleForceLogout = async () => {
    setIsRecovering(true)
    
    try {
      // Clear all storage
      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()
        
        // Clear all cookies
        document.cookie.split(";").forEach((c) => {
          document.cookie = c
            .replace(/^ +/, "")
            .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
        })
      }
      
      // Attempt to sign out
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Force logout error:', error)
    } finally {
      // Always redirect to login
      window.location.href = "/login"
    }
  }

  if (!showRecovery) {
    return null
  }

  return (
    <Card className="w-full max-w-md mx-auto mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          Problema de Sesión Detectado
        </CardTitle>
        <CardDescription>
          Parece que hay un problema con tu sesión. Puedes intentar recuperarla o cerrar sesión.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Si la página sigue cargando, es posible que tu sesión haya expirado o haya un problema de conexión.
          </AlertDescription>
        </Alert>
        
        <div className="flex flex-col gap-2">
          <Button
            onClick={handleRefreshSession}
            disabled={isRecovering}
            className="w-full"
          >
            {isRecovering ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Recuperando sesión...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Intentar Recuperar Sesión
              </>
            )}
          </Button>
          
          <Button
            onClick={handleForceLogout}
            disabled={isRecovering}
            variant="outline"
            className="w-full"
          >
            {isRecovering ? (
              <>
                <LogOut className="mr-2 h-4 w-4" />
                Cerrando sesión...
              </>
            ) : (
              <>
                <LogOut className="mr-2 h-4 w-4" />
                Forzar Cierre de Sesión
              </>
            )}
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground text-center">
          Si el problema persiste, intenta limpiar las cookies de tu navegador o contacta al soporte técnico.
        </p>
      </CardContent>
    </Card>
  )
} 