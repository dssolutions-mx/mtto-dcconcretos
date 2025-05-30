'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TemplateVersioningDemo } from '@/components/checklists/template-versioning-demo'
import { QATestingPanel } from '@/components/checklists/qa-testing-panel'
import { Badge } from '@/components/ui/badge'
import { 
  TestTube, 
  GitBranch, 
  CheckCircle, 
  Database,
  FileEdit,
  History
} from 'lucide-react'

export default function TestVersioningPage() {
  const [showQA, setShowQA] = useState(false)

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">
          ✅ Phase 2 & 3 Implementation Complete
        </h1>
        <p className="text-lg text-muted-foreground">
          Checklist Template Versioning System
        </p>
        <div className="flex justify-center gap-2">
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Phase 2 Complete
          </Badge>
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Phase 3 Complete
          </Badge>
          <Badge className="bg-blue-500">
            <Database className="h-3 w-3 mr-1" />
            Database Updated
          </Badge>
        </div>
      </div>

      {/* Quick Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Implementation Status
          </CardTitle>
          <CardDescription>
            Overview of completed features and infrastructure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <FileEdit className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-800">Template Editor</h3>
              </div>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• Real-time editing interface</li>
                <li>• Live preview capabilities</li>
                <li>• Change tracking system</li>
                <li>• Validation & error handling</li>
              </ul>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <History className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-blue-800">Version Management</h3>
              </div>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Immutable version history</li>
                <li>• Visual comparison tools</li>
                <li>• One-click restoration</li>
                <li>• Complete audit trails</li>
              </ul>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold text-purple-800">Infrastructure</h3>
              </div>
              <ul className="text-sm text-purple-700 space-y-1">
                <li>• Database migrations applied</li>
                <li>• API endpoints functional</li>
                <li>• Offline compatibility preserved</li>
                <li>• TypeScript types updated</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-center gap-4">
        <Button 
          onClick={() => setShowQA(true)}
          className="flex items-center gap-2"
          size="lg"
        >
          <TestTube className="h-4 w-4" />
          Run QA Tests
        </Button>
      </div>

      {/* Demo Component */}
      <TemplateVersioningDemo />

      {/* QA Testing Panel */}
      <QATestingPanel
        isOpen={showQA}
        onClose={() => setShowQA(false)}
      />
    </div>
  )
} 