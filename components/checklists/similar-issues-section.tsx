"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { 
  AlertTriangle, 
  Clock, 
  Link2, 
  Plus, 
  TrendingUp, 
  User, 
  Calendar,
  Wrench
} from "lucide-react"

interface SimilarIssue {
  issue_id: string
  work_order_id: string
  item_description: string
  priority: string
  recurrence_count: number
  work_order?: {
    id: string
    order_id: string
    description: string
    priority: string
    status: string
    created_at: string
    updated_at: string
  }
  assignee_name?: string
}

interface SimilarIssueResult {
  item: {
    id: string
    description: string
    notes: string
    status: "flag" | "fail"
  }
  similar_issues: SimilarIssue[]
  consolidation_recommended: boolean
  recurrence_count: number
}

interface SimilarIssuesSectionProps {
  similarIssuesResults: SimilarIssueResult[]
  onConsolidationChoiceChange: (choices: Record<string, 'consolidate' | 'create_new' | 'escalate'>) => void
}

export function SimilarIssuesSection({ 
  similarIssuesResults, 
  onConsolidationChoiceChange 
}: SimilarIssuesSectionProps) {
  const [consolidationChoices, setConsolidationChoices] = useState<Record<string, 'consolidate' | 'create_new' | 'escalate'>>({})

  const issuesWithSimilar = similarIssuesResults.filter(result => result.similar_issues.length > 0)
  
  if (issuesWithSimilar.length === 0) {
    return null
  }

  const handleChoiceChange = (itemId: string, choice: 'consolidate' | 'create_new' | 'escalate') => {
    const newChoices = { ...consolidationChoices, [itemId]: choice }
    setConsolidationChoices(newChoices)
    onConsolidationChoiceChange(newChoices)
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "Alta":
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case "Media":
        return <Clock className="h-4 w-4 text-orange-500" />
      default:
        return <Clock className="h-4 w-4 text-green-500" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Alta":
        return "bg-red-100 text-red-800 border-red-300"
      case "Media":
        return "bg-orange-100 text-orange-800 border-orange-300"
      default:
        return "bg-green-100 text-green-800 border-green-300"
    }
  }

  return (
    <div className="space-y-4">
      <Alert>
        <TrendingUp className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>⚡ Problemas Recurrentes Detectados</strong><br />
          Se encontraron {issuesWithSimilar.length} problema(s) que ya tienen órdenes de trabajo abiertas. 
          <span className="hidden sm:inline">Puede elegir consolidar con las órdenes existentes o crear nuevas.</span>
          <span className="sm:hidden">Seleccione la acción para cada problema.</span>
        </AlertDescription>
      </Alert>

      {issuesWithSimilar.map((result, index) => {
        const similarIssue = result.similar_issues[0] // Best match
        const workOrder = similarIssue.work_order
        const currentChoice = consolidationChoices[result.item.id] || 'consolidate'

        return (
          <Card key={result.item.id} className="border-orange-200">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm font-medium text-orange-900">
                    🔄 Problema Recurrente #{index + 1}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    <strong className="block text-ellipsis overflow-hidden whitespace-nowrap">{result.item.description}</strong>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge 
                        variant={result.item.status === "fail" ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {result.item.status === "fail" ? "Falla" : "Revisar"}
                      </Badge>
                      <Badge variant="outline" className="text-xs sm:hidden">
                        {result.recurrence_count}ª vez
                      </Badge>
                    </div>
                  </CardDescription>
                </div>
                <div className="text-right hidden sm:block">
                  <Badge variant="outline" className="text-xs">
                    {result.recurrence_count}ª ocurrencia
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Existing Work Order Info */}
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <div className="flex items-start gap-2 sm:gap-3">
                  <Wrench className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                      <span className="font-medium text-blue-900 text-sm">
                        {workOrder?.order_id || 'N/A'}
                      </span>
                      <div className="flex items-center gap-1 sm:gap-2">
                        <Badge className={`text-xs ${getPriorityColor(similarIssue.priority)}`}>
                          {getPriorityIcon(similarIssue.priority)}
                          <span className="hidden sm:inline ml-1">{similarIssue.priority}</span>
                          <span className="sm:hidden ml-1">{similarIssue.priority.charAt(0)}</span>
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {workOrder?.status}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="text-sm text-blue-800 space-y-1">
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">Creada: {workOrder?.created_at ? new Date(workOrder.created_at).toLocaleDateString() : 'N/A'}</span>
                      </div>
                      {similarIssue.assignee_name && similarIssue.assignee_name !== 'Sin asignar' && (
                        <div className="flex items-center gap-2 text-xs sm:text-sm">
                          <User className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">Asignada a: {similarIssue.assignee_name}</span>
                        </div>
                      )}
                      <div className="text-xs bg-white p-2 rounded border">
                        <strong>Recurrencias anteriores:</strong> {result.recurrence_count - 1}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Choice */}
              <div>
                <Label className="text-sm font-medium">¿Qué acción tomar?</Label>
                <RadioGroup 
                  value={currentChoice} 
                  onValueChange={(value: 'consolidate' | 'create_new' | 'escalate') => 
                    handleChoiceChange(result.item.id, value)
                  }
                  className="mt-2"
                >
                  <div className="space-y-2">
                    {/* Consolidate Option */}
                    <div className="flex items-start space-x-2 p-2 rounded border hover:bg-gray-50 touch-manipulation">
                      <RadioGroupItem value="consolidate" id={`consolidate-${result.item.id}`} className="mt-1 flex-shrink-0" />
                      <Label 
                        htmlFor={`consolidate-${result.item.id}`} 
                        className="flex-1 cursor-pointer min-w-0"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <Link2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                            <span className="font-medium text-sm">Consolidar con orden existente</span>
                          </div>
                          <Badge variant="outline" className="text-xs bg-blue-50 self-start sm:self-auto">Recomendado</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Agregar esta ocurrencia a <span className="font-medium">{workOrder?.order_id}</span>. 
                          <span className="hidden sm:inline"> Actualiza la descripción y cuenta de recurrencias.</span>
                        </p>
                      </Label>
                    </div>

                    {/* Create New Option */}
                    <div className="flex items-start space-x-2 p-2 rounded border hover:bg-gray-50 touch-manipulation">
                      <RadioGroupItem value="create_new" id={`new-${result.item.id}`} className="mt-1 flex-shrink-0" />
                      <Label 
                        htmlFor={`new-${result.item.id}`} 
                        className="flex-1 cursor-pointer min-w-0"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Plus className="h-4 w-4 text-green-600 flex-shrink-0" />
                          <span className="font-medium text-sm">Crear nueva orden de trabajo</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Generar una orden independiente. 
                          <span className="hidden sm:inline">Útil si requiere diferente enfoque o técnico.</span>
                        </p>
                      </Label>
                    </div>

                    {/* Escalate Option (if 3+ recurrences) */}
                    {result.recurrence_count >= 3 && (
                      <div className="flex items-start space-x-2 p-2 rounded border hover:bg-red-100 border-red-200 bg-red-50 touch-manipulation">
                        <RadioGroupItem value="escalate" id={`escalate-${result.item.id}`} className="mt-1 flex-shrink-0" />
                        <Label 
                          htmlFor={`escalate-${result.item.id}`} 
                          className="flex-1 cursor-pointer min-w-0"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                              <span className="font-medium text-sm text-red-800">Escalar prioridad y consolidar</span>
                            </div>
                            <Badge variant="destructive" className="text-xs self-start sm:self-auto">Crítico</Badge>
                          </div>
                          <p className="text-xs text-red-700">
                            {result.recurrence_count}ª ocurrencia. Escalar a prioridad ALTA 
                            <span className="hidden sm:inline"> y consolidar con orden existente</span>.
                          </p>
                        </Label>
                      </div>
                    )}
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>
        )
      })}

      <Separator />
    </div>
  )
} 