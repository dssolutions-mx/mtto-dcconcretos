import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { VersionComparison } from './version-comparison'
import { QATestingPanel } from './qa-testing-panel'
import { 
  FileEdit, 
  GitBranch, 
  TestTube, 
  History,
  Settings,
  CheckCircle
} from 'lucide-react'

interface DemoProps {
  templateId?: string
}

export function TemplateVersioningDemo({ templateId = '20233388-79b2-40e3-99ae-eff682d6e693' }: DemoProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'comparison' | 'qa'>('overview')
  const [showComparison, setShowComparison] = useState(false)
  const [showQA, setShowQA] = useState(false)

  const features = [
    {
      icon: <FileEdit className="h-5 w-5" />,
      title: "Template Editor",
      description: "Editar plantillas con vista previa en tiempo real",
      status: "implemented",
      details: "Sistema completo de edición con validación y preview"
    },
    {
      icon: <GitBranch className="h-5 w-5" />,
      title: "Version Management", 
      description: "Gestión completa de versiones con historial",
      status: "implemented",
      details: "Versionado inmutable con snapshots JSONB completos"
    },
    {
      icon: <History className="h-5 w-5" />,
      title: "Version Comparison",
      description: "Comparación visual entre versiones",
      status: "implemented", 
      details: "Detección granular de cambios con interfaz intuitiva"
    },
    {
      icon: <Settings className="h-5 w-5" />,
      title: "Offline Compatibility",
      description: "Compatibilidad total con funcionalidad offline",
      status: "implemented",
      details: "Zero downtime con upgrade automático de datos legacy"
    }
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'implemented':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Implemented</Badge>
      default:
        return <Badge variant="outline">Pending</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-6 w-6" />
            Template Versioning System - Phase 2 & 3 Demo
          </CardTitle>
          <CardDescription>
            Sistema completo de versionado de plantillas con funcionalidad offline preservada
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button 
              variant={activeTab === 'overview' ? 'default' : 'outline'}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </Button>
            <Button 
              variant={activeTab === 'comparison' ? 'default' : 'outline'}
              onClick={() => {
                setActiveTab('comparison')
                setShowComparison(true)
              }}
            >
              Version Comparison
            </Button>
            <Button 
              variant={activeTab === 'qa' ? 'default' : 'outline'}
              onClick={() => {
                setActiveTab('qa')
                setShowQA(true)
              }}
              className="flex items-center gap-2"
            >
              <TestTube className="h-4 w-4" />
              QA Testing
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Feature Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((feature, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {feature.icon}
                    <h3 className="font-semibold">{feature.title}</h3>
                  </div>
                  {getStatusBadge(feature.status)}
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  {feature.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {feature.details}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Implementation Highlights */}
      {activeTab === 'overview' && (
        <Card>
          <CardHeader>
            <CardTitle>Implementation Highlights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-semibold text-green-800 mb-2">Database Layer</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>✓ JSONB version snapshots</li>
                  <li>✓ Database functions for versioning</li>
                  <li>✓ Zero-downtime migration</li>
                  <li>✓ RLS security policies</li>
                </ul>
              </div>
              
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">API Layer</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>✓ Version creation endpoints</li>
                  <li>✓ Version restoration APIs</li>
                  <li>✓ Input validation & error handling</li>
                  <li>✓ RESTful design patterns</li>
                </ul>
              </div>

              <div className="p-4 bg-purple-50 rounded-lg">
                <h4 className="font-semibold text-purple-800 mb-2">Frontend Layer</h4>
                <ul className="text-sm text-purple-700 space-y-1">
                  <li>✓ Template editor component</li>
                  <li>✓ Version comparison interface</li>
                  <li>✓ QA testing panel</li>
                  <li>✓ Offline service enhancements</li>
                </ul>
              </div>
            </div>

            <div className="p-4 bg-yellow-50 rounded-lg">
              <h4 className="font-semibold text-yellow-800 mb-2">🔄 Offline Functionality Preserved</h4>
              <p className="text-sm text-yellow-700">
                La funcionalidad offline existente ha sido completamente preservada y mejorada con awareness de versiones. 
                Los métodos legacy funcionan sin cambios, mientras que los nuevos métodos ofrecen capacidades de versionado.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Version Comparison Modal */}
      <VersionComparison
        templateId={templateId}
        isOpen={showComparison}
        onClose={() => {
          setShowComparison(false)
          setActiveTab('overview')
        }}
      />

      {/* QA Testing Panel */}
      <QATestingPanel
        isOpen={showQA}
        onClose={() => {
          setShowQA(false)
          setActiveTab('overview')
        }}
      />
    </div>
  )
} 