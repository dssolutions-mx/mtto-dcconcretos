"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { canAccessRoute } from "@/lib/auth/role-permissions"

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { profile, isLoading: loading, user } = useAuthZustand()

  useEffect(() => {
    // Skip checking during loading or if no user
    if (loading || !user) return

    // Skip checking for public routes
    const publicRoutes = ["/login", "/register", "/auth/callback"]
    if (publicRoutes.some(route => pathname.startsWith(route))) return

    // If we have a user but no profile, there's an issue
    if (user && !profile) {
      console.log("User exists but no profile found")
      router.push("/login?error=profile_not_found")
      return
    }

    // Check role-based access
    if (profile && !canAccessRoute(profile.role, pathname)) {
      console.log(`Access denied for role ${profile.role} to ${pathname}`)
      router.push(`/dashboard?error=access_denied&module=${pathname.split('/')[1]}`)
    }
  }, [pathname, profile, loading, user, router])

  return <>{children}</>
} 