import type React from "react"

export default function PrintLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div style={{ 
      margin: 0, 
      padding: 0, 
      width: '100%', 
      height: '100%',
      overflow: 'hidden'
    }}>
      {children}
    </div>
  )
}

