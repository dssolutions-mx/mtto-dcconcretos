'use client'

import { useState } from 'react'
import { useAuthZustand } from '@/hooks/use-auth-zustand'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function OfflineTestPage() {
  const { user, profile, isAuthenticated, isLoading, signOut } = useAuthZustand()
  const [offlineStatus, setOfflineStatus] = useState(navigator?.onLine ?? true)
  
  // Listen to online/offline events
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => setOfflineStatus(true))
    window.addEventListener('offline', () => setOfflineStatus(false))
  }

  const simulateOfflineWork = () => {
    alert('Simulating offline work completion...\n\nIn a real scenario, this would:\n1. Queue the operation\n2. Show success message\n3. Sync when online')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🧪 Offline Authentication Test
            <Badge variant={offlineStatus ? "default" : "destructive"}>
              {offlineStatus ? "🌐 Online" : "📱 Offline"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Test the offline authentication and work completion capabilities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Authentication Status */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Authentication Status</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">User Status:</p>
                <Badge variant={isAuthenticated ? "default" : "destructive"}>
                  {isLoading ? "Loading..." : isAuthenticated ? "✅ Authenticated" : "❌ Not Authenticated"}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-600">User Email:</p>
                <p className="font-mono text-sm">{user?.email || "No user"}</p>
              </div>
            </div>
          </div>

          {/* Profile Information */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Profile Information</h3>
            <div className="bg-gray-100 p-4 rounded">
              <pre className="text-sm overflow-x-auto">
                {profile ? JSON.stringify({
                  nombre: profile.nombre,
                  apellido: profile.apellido,
                  role: profile.role,
                  plant: profile.plants?.name || 'N/A',
                  businessUnit: profile.business_units?.name || 'N/A'
                }, null, 2) : "No profile loaded"}
              </pre>
            </div>
          </div>

          {/* Test Actions */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Test Actions</h3>
            <div className="grid grid-cols-2 gap-4">
              <Button 
                onClick={simulateOfflineWork} 
                disabled={!isAuthenticated}
                className="w-full"
              >
                🔧 Simulate Offline Work
              </Button>
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline"
                className="w-full"
              >
                🔄 Refresh Page
              </Button>
              <Button 
                onClick={() => signOut()} 
                variant="destructive"
                className="w-full"
                disabled={!isAuthenticated}
              >
                🚪 Sign Out
              </Button>
              <Button 
                onClick={() => window.location.href = '/checklists/assets'} 
                variant="outline"
                className="w-full"
              >
                📋 Go to Checklists
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Test Instructions</h3>
            <div className="bg-blue-50 p-4 rounded space-y-2 text-sm">
              <p><strong>1. Test Normal Flow:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Ensure you're logged in</li>
                <li>Click "Go to Checklists" - should work normally</li>
              </ul>
              
              <p><strong>2. Test Offline Flow:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Disconnect your internet (or use browser dev tools)</li>
                <li>Refresh this page - should still load</li>
                <li>Click "Go to Checklists" - should still work</li>
                <li>Click "Simulate Offline Work" - should queue operation</li>
                <li>Reconnect internet - operations should sync</li>
              </ul>
              
              <p><strong>3. Test Session Persistence:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>While offline, refresh multiple times</li>
                <li>Authentication should persist across refreshes</li>
                <li>Work routes should remain accessible</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 