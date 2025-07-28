import { useState, useEffect } from 'react'
import { useAuthZustand } from './use-auth-zustand'

interface OperatorChecklist {
  id: string
  scheduled_date: string
  status: string
  assignment_type: 'primary' | 'secondary' | 'unknown'
  assignment_start_date?: string
  checklists?: {
    id: string
    name: string
    description?: string
    frequency: string
    equipment_models?: {
      name: string
      manufacturer: string
    }
  }
  assets?: {
    id: string
    name: string
    asset_id: string
    location?: string
    status: string
  }
  assigned_asset?: {
    id: string
    name: string
    asset_id: string
    location?: string
    status: string
  }
}

interface OperatorDashboardData {
  operator: {
    id: string
    nombre: string
    apellido: string
    role: string
    plant_id?: string
  }
  assigned_assets: Array<{
    id: string
    name: string
    asset_id: string
    location?: string
    status: string
    assignment_type: 'primary' | 'secondary'
    assignment_start_date: string
    plants?: {
      id: string
      name: string
      code: string
    }
  }>
  today_checklists: OperatorChecklist[]
  overdue_checklists: OperatorChecklist[]
  upcoming_checklists: OperatorChecklist[]
  stats: {
    total_assets: number
    today_checklists: number
    overdue_checklists: number
    upcoming_checklists: number
    total_checklists: number
  }
}

export function useOperatorChecklists() {
  const { profile } = useAuthZustand()
  const [data, setData] = useState<OperatorDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isOperator = profile?.role && ['OPERADOR', 'DOSIFICADOR'].includes(profile.role)

  const fetchOperatorData = async () => {
    if (!isOperator) {
      setError('This hook is only for operators')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/checklists/operator-dashboard')
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch operator data')
      }

      const result = await response.json()
      setData(result.data)
    } catch (err) {
      console.error('Error fetching operator data:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const fetchAssignedChecklists = async (status: string = 'pendiente', type?: string) => {
    if (!isOperator) {
      setError('This hook is only for operators')
      return []
    }

    try {
      const params = new URLSearchParams({ status })
      if (type) {
        params.append('type', type)
      }

      const response = await fetch(`/api/checklists/operator-assigned?${params}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch assigned checklists')
      }

      const result = await response.json()
      return result.data || []
    } catch (err) {
      console.error('Error fetching assigned checklists:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      return []
    }
  }

  useEffect(() => {
    if (isOperator) {
      fetchOperatorData()
    }
  }, [isOperator])

  return {
    data,
    loading,
    error,
    isOperator,
    refetch: fetchOperatorData,
    fetchAssignedChecklists
  }
} 