"use client"

import type React from "react"
import { AuthInitializer } from '@/components/auth/auth-initializer'

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      <AuthInitializer />
      <div className="flex-1 relative">
        {children}
      </div>
    </>
  )
}
