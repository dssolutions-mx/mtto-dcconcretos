"use client"

import type React from "react"

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <div className="flex-1">{children}</div>
}
