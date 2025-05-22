import { useCallback, useState } from 'react'

export interface Checklist {
  id: string
  name: string
  description: string
  model_id: string
  interval_id?: string
  frequency: string
  hours_interval: number
  created_at: string
  updated_at: string
  equipment_models?: {
    name: string
    manufacturer: string
    id: string
  }
  maintenance_intervals?: {
    name: string
    interval_value: number
    type: string
    id: string
  }
  checklist_sections?: ChecklistSection[]
}

interface ChecklistSection {
  id: string
  checklist_id: string
  name: string
  order: number
  created_at: string
  updated_at: string
}

interface ChecklistItem {
  id: string
  section_id: string
  name: string
  description: string
  order: number
  item_type: 'check' | 'value' | 'range' | 'text'
  expected_value: string
  tolerance: string
  created_at: string
  updated_at: string
}

interface ChecklistSchedule {
  id: string
  template_id: string
  asset_id: string
  scheduled_date: string
  status: 'pendiente' | 'en_progreso' | 'completed' | 'cancelado'
  assigned_to: string
  maintenance_plan_id?: string
  checklists?: Checklist
  assets?: {
    name: string
    asset_id: string
    location: string
  }
  profiles?: {
    nombre: string
    apellido: string
  }
}

interface ChecklistExecution {
  id: string
  schedule_id: string
  executed_by: string
  execution_date: string
  status: 'completed' | 'incomplete'
  notes: string
  created_at: string
  checklist_execution_items?: ChecklistExecutionItem[]
}

interface ChecklistExecutionItem {
  id: string
  execution_id: string
  item_id: string
  value: string
  notes: string
  status: 'completed' | 'failed' | 'skipped'
  created_at: string
  checklist_items?: ChecklistItem
}

export function useChecklistTemplates() {
  const [templates, setTemplates] = useState<Checklist[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplates = useCallback(async (modelId?: string) => {
    setLoading(true)
    setError(null)
    try {
      const url = modelId 
        ? `/api/checklists/templates?model_id=${modelId}`
        : '/api/checklists/templates'
      
      const response = await fetch(url)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }
      
      const result = await response.json()
      
      // Check various response formats to handle possible API structure differences
      let templatesData: Checklist[] = [];
      
      if (Array.isArray(result)) {
        templatesData = result;
      } else if (result.data && Array.isArray(result.data)) {
        templatesData = result.data;
      } else if (result.templates && Array.isArray(result.templates)) {
        templatesData = result.templates;
      } else {
        console.error('Unexpected response structure:', result)
        throw new Error('Invalid response format from API')
      }
      
      setTemplates(templatesData)
    } catch (err) {
      console.error('Error fetching checklist templates:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setTemplates([]) // Reset templates on error to avoid showing stale data
    } finally {
      setLoading(false)
    }
  }, [])

  const getTemplatesByFrequency = useCallback((frequency: string) => {
    return templates.filter(template => template.frequency === frequency)
  }, [templates])
  
  const getTemplatesByInterval = useCallback((intervalId: string) => {
    return templates.filter(template => template.interval_id === intervalId)
  }, [templates])
  
  const getTemplatesByModel = useCallback((modelId: string) => {
    return templates.filter(template => template.model_id === modelId)
  }, [templates])
  
  const getTemplatesWithIntervals = useCallback(() => {
    return templates.filter(template => template.interval_id !== null && template.interval_id !== undefined)
  }, [templates])

  return { 
    templates, 
    loading, 
    error, 
    fetchTemplates, 
    getTemplatesByFrequency,
    getTemplatesByInterval,
    getTemplatesByModel,
    getTemplatesWithIntervals,
    dailyTemplates: getTemplatesByFrequency('diario'),
    weeklyTemplates: getTemplatesByFrequency('semanal'),
    monthlyTemplates: getTemplatesByFrequency('mensual')
  }
}

export function useChecklistSchedules() {
  const [schedules, setSchedules] = useState<ChecklistSchedule[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSchedules = useCallback(async (status?: string, type?: string) => {
    setLoading(true)
    setError(null)
    try {
      let url = '/api/checklists/schedules'
      const params = new URLSearchParams()
      
      if (status) params.append('status', status)
      if (type) params.append('type', type)
      
      if (params.toString()) {
        url += `?${params.toString()}`
      }
      
      const response = await fetch(url)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }
      
      const result = await response.json()
      
      // Check various response formats to handle possible API structure differences
      let schedulesData: ChecklistSchedule[] = [];
      
      if (Array.isArray(result)) {
        schedulesData = result;
      } else if (result.data && Array.isArray(result.data)) {
        schedulesData = result.data;
      } else if (result.schedules && Array.isArray(result.schedules)) {
        schedulesData = result.schedules;
      } else {
        console.error('Unexpected response structure:', result)
        throw new Error('Invalid response format from API')
      }
      
      setSchedules(schedulesData)
    } catch (err) {
      console.error('Error fetching checklist schedules:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setSchedules([]) // Reset schedules on error to avoid showing stale data
    } finally {
      setLoading(false)
    }
  }, [])

  const createSchedule = useCallback(async (scheduleData: Partial<ChecklistSchedule>) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/checklists/schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ schedule: scheduleData }),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }
      
      const data = await response.json()
      return data.data
    } catch (err) {
      console.error('Error creating checklist schedule:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { schedules, loading, error, fetchSchedules, createSchedule }
}

export function useChecklistExecution() {
  const [execution, setExecution] = useState<ChecklistExecution | null>(null)
  const [schedule, setSchedule] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchExecution = useCallback(async (scheduleId: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/checklists/execution?id=${scheduleId}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }
      
      const data = await response.json()
      setExecution(data.execution || null)
      setSchedule(data.data || null)
    } catch (err) {
      console.error('Error fetching checklist execution:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }, [])

  const saveExecution = useCallback(async (executionData: Partial<ChecklistExecution>, executionItems: any[]) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/checklists/execution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          execution: executionData,
          items: executionItems 
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }
      
      const data = await response.json()
      return data.data
    } catch (err) {
      console.error('Error saving checklist execution:', err)
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { execution, schedule, loading, error, fetchExecution, saveExecution }
} 