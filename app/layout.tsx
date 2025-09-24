import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SidebarWrapper } from "@/components/sidebar"
import { AuthInitializer } from "@/components/auth/auth-initializer"
import { RoleProvider } from "@/components/auth/role-provider"
import { SessionMonitor } from "@/components/auth/session-monitor"
import { Toaster } from "@/components/ui/toaster"
import { CacheConsoleLoader } from "@/components/cache-console-loader"
import { Analytics } from "@vercel/analytics/next"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Sistema de Mantenimiento",
  description: "Sistema de gestión de mantenimiento preventivo y correctivo",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthInitializer />
          <SessionMonitor />
          <RoleProvider>
            <SidebarWrapper>{children}</SidebarWrapper>
          </RoleProvider>
          <Toaster />
          <CacheConsoleLoader />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}
