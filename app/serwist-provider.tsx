"use client"

import { SerwistProvider } from "@serwist/next/react"
import { SwUpdatePrompt } from "@/components/sw-update-prompt"

export function AppSerwistProvider({ children }: { children: React.ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/sw.js"
      disable={process.env.NODE_ENV === "development"}
      reloadOnOnline={false}
      cacheOnNavigation={false}
      registerOptions={{ updateViaCache: "none" }}
    >
      {children}
      <SwUpdatePrompt />
    </SerwistProvider>
  )
}
