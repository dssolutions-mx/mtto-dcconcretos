# Phase 1: Smart Deduplication Implementation Plan

## Overview

Implement intelligent duplicate detection during work order generation (AFTER checklist completion) to prevent duplicate work orders for recurring issues. This approach preserves existing checklist execution flow and offline functionality.

## Core Principle

**Deduplication happens at work order creation, NOT during checklist execution**

```
Checklist Execution (unchanged)
         ↓
Issue Detection (unchanged)  
         ↓
Work Order Generation (NEW LOGIC) ← Smart Deduplication Here
         ↓
Check for Similar Open Issues
         ↓
Consolidate or Create New
```

## Technical Implementation

### 1. Database Schema Changes

```sql
-- Add fingerprinting and recurrence tracking to checklist_issues
ALTER TABLE checklist_issues ADD COLUMN issue_fingerprint TEXT;
ALTER TABLE checklist_issues ADD COLUMN parent_issue_id UUID REFERENCES checklist_issues(id);
ALTER TABLE checklist_issues ADD COLUMN recurrence_count INTEGER DEFAULT 1;
ALTER TABLE checklist_issues ADD COLUMN similar_issues_found JSONB;

-- Add escalation tracking to work_orders  
ALTER TABLE work_orders ADD COLUMN original_priority TEXT;
ALTER TABLE work_orders ADD COLUMN escalation_count INTEGER DEFAULT 0;
ALTER TABLE work_orders ADD COLUMN consolidated_issues_count INTEGER DEFAULT 1;
ALTER TABLE work_orders ADD COLUMN issue_history JSONB;

-- Performance indexes
CREATE INDEX idx_checklist_issues_fingerprint ON checklist_issues(issue_fingerprint, resolved) WHERE resolved = false;
CREATE INDEX idx_checklist_issues_asset_unresolved ON checklist_issues(asset_id, resolved, created_at) WHERE resolved = false;
CREATE INDEX idx_work_orders_asset_status ON work_orders(asset_id, status) WHERE status IN ('Pendiente', 'En ejecución');
```

### 2. Issue Fingerprinting Service

```typescript
// lib/services/issue-fingerprinting.ts
export interface IssueFingerprint {
  asset_id: string;
  item_description: string;
  normalized_description: string;
  checklist_type?: string;
  fingerprint: string;
}

export class IssueFingerprintService {
  
  static generateFingerprint(issue: ChecklistIssue, asset_id: string): IssueFingerprint {
    // Normalize description to catch variations
    const normalized = this.normalizeDescription(issue.description);
    
    // Create fingerprint combining key identifiers
    const fingerprint = `${asset_id}_${normalized}_${issue.item_type || 'general'}`;
    
    return {
      asset_id,
      item_description: issue.description,
      normalized_description: normalized,
      checklist_type: issue.checklist_type,
      fingerprint: this.hashFingerprint(fingerprint)
    };
  }
  
  private static normalizeDescription(description: string): string {
    return description
      .toLowerCase()
      .trim()
      // Remove common variations
      .replace(/\b(verificar|revisar|inspeccionar|comprobar)\b/g, 'check')
      .replace(/\b(funcionamiento|funcionan|funciona)\b/g, 'function')
      .replace(/\b(ausencia de|sin|no hay)\b/g, 'no')
      // Remove extra whitespace and punctuation
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '_');
  }
  
  private static hashFingerprint(fingerprint: string): string {
    // Simple hash function (could use crypto.createHash in production)
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}
```

### 3. Similar Issues Detection Service

```typescript
// lib/services/similar-issues-detector.ts
export interface SimilarIssue {
  issue_id: string;
  work_order_id: string;
  work_order_number: string;
  priority: string;
  status: string;
  created_date: string;
  last_update: string;
  similarity_score: number;
  technician?: string;
  notes?: string;
}

export class SimilarIssuesDetector {
  
  static async findSimilarOpenIssues(
    supabase: any,
    fingerprint: IssueFingerprint,
    options: {
      maxAge?: number; // days
      minSimilarity?: number;
      includeInProgress?: boolean;
    } = {}
  ): Promise<SimilarIssue[]> {
    
    const {
      maxAge = 30,
      minSimilarity = 0.8,
      includeInProgress = true
    } = options;
    
    const maxAgeDate = new Date();
    maxAgeDate.setDate(maxAgeDate.getDate() - maxAge);
    
    // Query for similar unresolved issues
    const { data: similarIssues, error } = await supabase
      .from('checklist_issues')
      .select(`
        id,
        issue_fingerprint,
        description,
        notes,
        created_at,
        work_order_id,
        work_orders!inner(
          id,
          order_id,
          priority,
          status,
          assigned_to,
          updated_at,
          profiles(nombre, apellido)
        )
      `)
      .eq('asset_id', fingerprint.asset_id)
      .eq('resolved', false)
      .gte('created_at', maxAgeDate.toISOString())
      .in('work_orders.status', 
        includeInProgress 
          ? ['Pendiente', 'En ejecución', 'Cotizada', 'Aprobada']
          : ['Pendiente', 'Cotizada', 'Aprobada']
      );
    
    if (error || !similarIssues) {
      console.error('Error finding similar issues:', error);
      return [];
    }
    
    // Calculate similarity scores and filter
    const scoredIssues = similarIssues
      .map(issue => ({
        issue_id: issue.id,
        work_order_id: issue.work_order_id,
        work_order_number: issue.work_orders.order_id,
        priority: issue.work_orders.priority,
        status: issue.work_orders.status,
        created_date: issue.created_at,
        last_update: issue.work_orders.updated_at,
        technician: issue.work_orders.profiles ? 
          `${issue.work_orders.profiles.nombre} ${issue.work_orders.profiles.apellido}` : 
          undefined,
        notes: issue.notes,
        similarity_score: this.calculateSimilarity(fingerprint, issue)
      }))
      .filter(issue => issue.similarity_score >= minSimilarity)
      .sort((a, b) => b.similarity_score - a.similarity_score);
    
    return scoredIssues;
  }
  
  private static calculateSimilarity(
    fingerprint: IssueFingerprint, 
    existingIssue: any
  ): number {
    // Exact fingerprint match
    if (existingIssue.issue_fingerprint === fingerprint.fingerprint) {
      return 1.0;
    }
    
    // Fuzzy description matching
    const similarity = this.stringSimilarity(
      fingerprint.normalized_description,
      existingIssue.description.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '_')
    );
    
    return similarity;
  }
  
  private static stringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + substitutionCost
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}
```

### 4. Enhanced Work Order Generation API

```typescript
// app/api/checklists/generate-corrective-work-order-smart/route.ts
import { createClient } from "@/lib/supabase-server"
import { NextResponse } from "next/server"
import { IssueFingerprintService } from "@/lib/services/issue-fingerprinting"
import { SimilarIssuesDetector } from "@/lib/services/similar-issues-detector"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const { 
      checklist_id, 
      items_with_issues, 
      priority = "Media",
      description,
      asset_id,
      enable_deduplication = true,
      deduplication_options = {}
    } = body

    // Get checklist and asset information
    const { data: checklistData, error: checklistError } = await supabase
      .from('completed_checklists')
      .select(`
        id,
        checklist_id,
        assets!inner(id, name, asset_id, location),
        checklists!inner(name)
      `)
      .eq('id', checklist_id)
      .single()

    if (checklistError || !checklistData) {
      return NextResponse.json({ error: "No se pudo obtener información del checklist" }, { status: 500 })
    }

    const processedIssues = []
    const consolidatedIssues = []
    const newWorkOrders = []
    
    // Process each issue for deduplication
    for (const item of items_with_issues) {
      // Generate fingerprint for this issue
      const fingerprint = IssueFingerprintService.generateFingerprint(item, asset_id)
      
      let similarIssues = []
      if (enable_deduplication) {
        // Look for similar open issues
        similarIssues = await SimilarIssuesDetector.findSimilarOpenIssues(
          supabase, 
          fingerprint,
          {
            maxAge: deduplication_options.maxAge || 30,
            minSimilarity: deduplication_options.minSimilarity || 0.8,
            includeInProgress: deduplication_options.includeInProgress !== false
          }
        )
      }
      
      // Save the issue with fingerprint first
      const { data: savedIssue, error: issueError } = await supabase
        .from('checklist_issues')
        .insert({
          checklist_id: checklist_id,
          item_id: item.id,
          status: item.status,
          description: item.description,
          notes: item.notes || null,
          photo_url: item.photo || null,
          resolved: false,
          created_at: new Date().toISOString(),
          created_by: user.id,
          issue_fingerprint: fingerprint.fingerprint,
          similar_issues_found: similarIssues.length > 0 ? similarIssues : null
        })
        .select('id')
        .single()

      if (issueError) {
        console.error(`Error saving issue:`, issueError)
        continue
      }

      // Decide: consolidate or create new
      if (similarIssues.length > 0 && enable_deduplication) {
        // CONSOLIDATE: Link to existing work order
        const bestMatch = similarIssues[0] // Highest similarity score
        
        await this.consolidateIssueWithExisting(
          supabase, 
          savedIssue.id, 
          bestMatch, 
          item, 
          checklistData
        )
        
        consolidatedIssues.push({
          issue: savedIssue,
          consolidated_with: bestMatch,
          action: 'consolidated'
        })
        
      } else {
        // CREATE NEW: No similar issues found
        const workOrder = await this.createNewWorkOrder(
          supabase,
          savedIssue.id,
          item,
          checklistData,
          priority,
          description,
          asset_id,
          user.id
        )
        
        if (workOrder) {
          newWorkOrders.push(workOrder)
          processedIssues.push({
            issue: savedIssue,
            work_order: workOrder,
            action: 'created_new'
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      deduplication_enabled: enable_deduplication,
      new_work_orders: newWorkOrders.length,
      consolidated_issues: consolidatedIssues.length,
      work_orders: newWorkOrders,
      consolidations: consolidatedIssues,
      message: enable_deduplication 
        ? `Se crearon ${newWorkOrders.length} nuevas órdenes de trabajo y se consolidaron ${consolidatedIssues.length} problemas con órdenes existentes`
        : `Se crearon ${newWorkOrders.length} órdenes de trabajo correctivas`
    })

  } catch (error) {
    console.error('Error in smart work order generation:', error)
    return NextResponse.json(
      { error: `Error interno del servidor: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }

  // Helper methods
  private static async consolidateIssueWithExisting(
    supabase: any,
    newIssueId: string,
    existingIssue: SimilarIssue,
    itemData: any,
    checklistData: any
  ) {
    // Link new issue to existing work order
    await supabase
      .from('checklist_issues')
      .update({ 
        work_order_id: existingIssue.work_order_id,
        parent_issue_id: existingIssue.issue_id
      })
      .eq('id', newIssueId)

    // Update existing work order with new occurrence
    const { data: currentWO } = await supabase
      .from('work_orders')
      .select('description, consolidated_issues_count, issue_history')
      .eq('id', existingIssue.work_order_id)
      .single()

    if (currentWO) {
      const newDescription = this.appendNewOccurrenceToDescription(
        currentWO.description,
        itemData,
        checklistData
      )

      const updatedHistory = [
        ...(currentWO.issue_history || []),
        {
          date: new Date().toISOString(),
          checklist: checklistData.checklists.name,
          description: itemData.description,
          notes: itemData.notes,
          status: itemData.status
        }
      ]

      await supabase
        .from('work_orders')
        .update({
          description: newDescription,
          consolidated_issues_count: (currentWO.consolidated_issues_count || 1) + 1,
          issue_history: updatedHistory,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingIssue.work_order_id)

      // Check if we should escalate priority
      await this.checkAndEscalatePriority(supabase, existingIssue.work_order_id, updatedHistory.length)
    }
  }

  private static async createNewWorkOrder(
    supabase: any,
    issueId: string,
    item: any,
    checklistData: any,
    priority: string,
    additionalDescription: string,
    assetId: string,
    userId: string
  ) {
    // Create work order description (same as current logic)
    let workOrderDescription = `${item.description}

PROBLEMA: ${item.status === 'fail' ? 'FALLA DETECTADA' : 'REQUIERE REVISIÓN'}
${item.notes ? `Observaciones: ${item.notes}` : ''}${item.photo ? '\nEvidencia fotográfica disponible' : ''}

ORIGEN:
• Checklist: ${checklistData.checklists?.name || 'N/A'}
• Fecha: ${new Date().toLocaleDateString()}
• Activo: ${checklistData.assets?.name || 'N/A'} (${checklistData.assets?.asset_id || 'N/A'})
• Ubicación: ${checklistData.assets?.location || 'N/A'}`

    if (additionalDescription && additionalDescription.trim()) {
      workOrderDescription += `\n\nCONTEXTO ADICIONAL:\n${additionalDescription.trim()}`
    }

    // Create work order
    const { data: workOrder, error: workOrderError } = await supabase
      .from('work_orders')
      .insert({
        asset_id: assetId,
        description: workOrderDescription.trim(),
        type: 'corrective',
        priority: priority,
        status: 'Pendiente',
        checklist_id: checklistData.id,
        issue_items: [item],
        requested_by: userId,
        original_priority: priority,
        escalation_count: 0,
        consolidated_issues_count: 1,
        created_at: new Date().toISOString()
      })
      .select('id, order_id, description, status, priority')
      .single()

    if (!workOrderError) {
      // Link issue to work order
      await supabase
        .from('checklist_issues')
        .update({ work_order_id: workOrder.id })
        .eq('id', issueId)

      return workOrder
    }

    return null
  }

  private static appendNewOccurrenceToDescription(
    currentDescription: string,
    newItem: any,
    checklistData: any
  ): string {
    const newOccurrence = `

NUEVA OCURRENCIA - ${new Date().toLocaleDateString()}:
• Checklist: ${checklistData.checklists?.name || 'N/A'}
• Estado: ${newItem.status === 'fail' ? 'FALLA DETECTADA' : 'REQUIERE REVISIÓN'}
${newItem.notes ? `• Observaciones: ${newItem.notes}` : ''}
${newItem.photo ? '• Nueva evidencia fotográfica disponible' : ''}`

    return currentDescription + newOccurrence
  }

  private static async checkAndEscalatePriority(
    supabase: any,
    workOrderId: string,
    occurrenceCount: number
  ) {
    // Escalation rules
    const escalationRules = [
      { threshold: 3, priority: 'Alta' },
      { threshold: 5, priority: 'Crítica' }
    ]

    const rule = escalationRules.find(r => occurrenceCount >= r.threshold)
    if (!rule) return

    // Get current priority
    const { data: workOrder } = await supabase
      .from('work_orders')
      .select('priority, escalation_count')
      .eq('id', workOrderId)
      .single()

    if (workOrder && this.shouldEscalate(workOrder.priority, rule.priority)) {
      await supabase
        .from('work_orders')
        .update({
          priority: rule.priority,
          escalation_count: (workOrder.escalation_count || 0) + 1,
          last_escalation_date: new Date().toISOString()
        })
        .eq('id', workOrderId)
    }
  }

  private static shouldEscalate(currentPriority: string, newPriority: string): boolean {
    const priorityLevels = { 'Baja': 1, 'Media': 2, 'Alta': 3, 'Crítica': 4 }
    return (priorityLevels[newPriority] || 0) > (priorityLevels[currentPriority] || 0)
  }
}
```

### 5. Enhanced UI Component

```typescript
// components/checklists/smart-corrective-work-order-dialog.tsx
export function SmartCorrectiveWorkOrderDialog({
  open,
  onOpenChange,
  checklist,
  itemsWithIssues,
  onWorkOrderCreated
}: Props) {
  const [similarIssues, setSimilarIssues] = useState<SimilarIssue[]>([])
  const [deduplicationEnabled, setDeduplicationEnabled] = useState(true)
  const [loading, setLoading] = useState(false)
  const [showSimilarIssues, setShowSimilarIssues] = useState(false)

  // Check for similar issues when dialog opens
  useEffect(() => {
    if (open && itemsWithIssues.length > 0) {
      checkForSimilarIssues()
    }
  }, [open, itemsWithIssues])

  const checkForSimilarIssues = async () => {
    // Pre-check for similar issues to show user
    // This is just for UI preview, actual logic is in API
    const response = await fetch('/api/checklists/issues/check-similar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        asset_id: checklist.assetId,
        items: itemsWithIssues
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      setSimilarIssues(data.similar_issues || [])
      setShowSimilarIssues(data.similar_issues?.length > 0)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    
    try {
      const response = await fetch('/api/checklists/generate-corrective-work-order-smart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklist_id: checklist.id,
          items_with_issues: itemsWithIssues,
          priority,
          description: description.trim(),
          asset_id: checklist.assetId,
          enable_deduplication: deduplicationEnabled,
          deduplication_options: {
            maxAge: 30,
            minSimilarity: 0.8,
            includeInProgress: true
          }
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok || result.error) {
        throw new Error(result.error || 'Error al crear órdenes de trabajo')
      }
      
      toast.success(result.message)
      onWorkOrderCreated(result.work_orders[0]?.id)
      onOpenChange(false)
      
    } catch (error: any) {
      toast.error(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-[90vw] md:w-[80vw] max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Crear Órdenes de Trabajo Correctivas</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[70vh]">
          {/* Similar Issues Alert */}
          {showSimilarIssues && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Problemas Similares Encontrados</AlertTitle>
              <AlertDescription>
                Se encontraron {similarIssues.length} problema(s) similar(es) sin resolver.
                El sistema puede consolidar estos reportes automáticamente.
              </AlertDescription>
            </Alert>
          )}

          {/* Similar Issues List */}
          {showSimilarIssues && (
            <div className="mb-4 p-4 border rounded-lg">
              <h4 className="font-medium mb-2">Órdenes de Trabajo Abiertas Similares:</h4>
              <div className="space-y-2">
                {similarIssues.map((issue) => (
                  <div key={issue.issue_id} className="p-3 bg-gray-50 rounded border-l-4 border-blue-500">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{issue.work_order_number}</p>
                        <p className="text-sm text-gray-600">
                          {issue.priority} • {issue.status} • Creada hace {formatDistanceToNow(new Date(issue.created_date))}
                        </p>
                        {issue.technician && (
                          <p className="text-sm text-gray-600">Asignada a: {issue.technician}</p>
                        )}
                      </div>
                      <Badge variant={issue.priority === 'Alta' ? 'destructive' : 'secondary'}>
                        {Math.round(issue.similarity_score * 100)}% similar
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Deduplication Settings */}
          <div className="mb-4 p-4 border rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Checkbox 
                id="deduplication" 
                checked={deduplicationEnabled}
                onCheckedChange={setDeduplicationEnabled}
              />
              <label htmlFor="deduplication" className="text-sm font-medium">
                Habilitar detección inteligente de duplicados
              </label>
            </div>
            <p className="text-xs text-gray-600">
              {deduplicationEnabled 
                ? "Los problemas similares se vincularán a órdenes existentes automáticamente"
                : "Se creará una nueva orden de trabajo para cada problema"
              }
            </p>
          </div>

          {/* Rest of existing dialog content... */}
          {/* Asset info, issues list, priority selection, etc. */}
          
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Procesando..." : "Crear Órdenes de Trabajo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

## Key Benefits of This Approach

### ✅ **Preserves Current Functionality**
- Checklist execution remains unchanged
- Offline functionality unaffected  
- No impact on mobile performance
- Existing user workflows preserved

### ✅ **Smart Deduplication**
- Intelligent similarity detection
- Automatic consolidation of related issues
- Priority escalation for recurring problems
- Full audit trail maintained

### ✅ **User Control**
- Manual override options
- Configurable deduplication settings
- Clear visibility of consolidation decisions
- Preview of similar issues before creation

### ✅ **Gradual Implementation**
- Can be deployed alongside existing system
- Feature flag controlled
- Easy rollback if needed
- Non-breaking changes

## Next Steps

1. **Database Migration**: Apply schema changes
2. **Service Implementation**: Create fingerprinting and detection services  
3. **API Development**: Build smart work order generation endpoint
4. **UI Enhancement**: Update work order dialog with deduplication features
5. **Testing**: Comprehensive testing of deduplication logic
6. **Deployment**: Gradual rollout with feature flags

This approach gives us all the benefits of smart deduplication while keeping the checklist execution simple and offline-capable. We can always add issue history to checklist execution in a later phase if needed! 