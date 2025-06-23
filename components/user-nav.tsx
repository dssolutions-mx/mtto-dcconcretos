"use client"

import { useEffect, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation"
import { useAuthZustand } from "@/hooks/use-auth-zustand"

export function UserNav() {
  const router = useRouter()
  const { user, signOut } = useAuthZustand()
  const [userInitials, setUserInitials] = useState("US")
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    if (user?.email) {
      // Get initials from email or name if available
      if (user.user_metadata?.name) {
        const nameParts = user.user_metadata.name.split(" ")
        setUserInitials(
          nameParts.length > 1
            ? `${nameParts[0][0]}${nameParts[1][0]}`
            : nameParts[0].substring(0, 2)
        )
      } else {
        setUserInitials(user.email.substring(0, 2).toUpperCase())
      }
    }
  }, [user])

  const handleSignOut = async () => {
    if (isSigningOut) return
    
    setIsSigningOut(true)
    
    try {
      console.log('🚪 User nav logout initiated...')
      
      // Use Zustand store's signOut method
      await signOut()
      
      console.log('✅ Logout successful, redirecting...')
      
      // Clear any local storage or session storage
      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()
      }
      
      // Force a hard redirect to clear any stale state
      window.location.href = "/login"
    } catch (error) {
      console.error('❌ Sign out error:', error)
      // Even on error, redirect to login
      window.location.href = "/login"
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.user_metadata?.avatar_url || "/placeholder.svg"} alt="Avatar" />
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user?.user_metadata?.name || "Usuario"}</p>
            <p className="text-xs leading-none text-muted-foreground">{user?.email || "usuario@ejemplo.com"}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            Perfil
            <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            Configuración
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} disabled={isSigningOut}>
          {isSigningOut ? "Cerrando sesión..." : "Cerrar sesión"}
          <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
