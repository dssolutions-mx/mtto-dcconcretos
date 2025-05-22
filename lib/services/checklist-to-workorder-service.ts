import { createClient } from '@/lib/supabase-server'

export const checklistToWorkorderService = {
  // Convertir un problema de checklist en una orden de trabajo
  async createWorkOrderFromIssue(issueId: string, priority: string = 'media') {
    const supabase = await createClient()
    
    // Obtener la información del problema
    const { data: issue, error: issueError } = await supabase
      .from('checklist_issues')
      .select(`
        *,
        checklist:checklist_id(
          *,
          asset:asset_id(*)
        ),
        item:item_id(*)
      `)
      .eq('id', issueId)
      .single()
    
    if (issueError) {
      throw new Error(`Error obteniendo información del problema: ${issueError.message}`)
    }
    
    // Crear la orden de trabajo
    const { data: workOrder, error: workOrderError } = await supabase
      .from('work_orders')
      .insert({
        title: `Problema en ${issue.item.description}`,
        description: issue.notes || issue.description,
        asset_id: issue.checklist.asset_id,
        priority,
        status: 'pendiente',
        type: 'correctivo',
        reported_issue: `Problema detectado durante checklist: ${issue.description}`,
        photo_url: issue.photo_url
      })
      .select()
      .single()
    
    if (workOrderError) {
      throw new Error(`Error creando orden de trabajo: ${workOrderError.message}`)
    }
    
    // Actualizar el problema con el ID de la orden de trabajo
    const { error: updateError } = await supabase
      .from('checklist_issues')
      .update({ work_order_id: workOrder.id })
      .eq('id', issueId)
    
    if (updateError) {
      throw new Error(`Error actualizando problema: ${updateError.message}`)
    }
    
    return workOrder
  },
  
  // Obtener problemas pendientes que no tienen órdenes de trabajo asociadas
  async getPendingIssues() {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('checklist_issues')
      .select(`
        *,
        checklist:checklist_id(
          completion_date,
          asset:asset_id(name, asset_id, location)
        )
      `)
      .is('work_order_id', null)
      .eq('resolved', false)
      .order('created_at', { ascending: false })
    
    if (error) {
      throw new Error(`Error obteniendo problemas pendientes: ${error.message}`)
    }
    
    return data
  },
  
  // Actualizar el estado de un problema
  async updateIssueStatus(issueId: string, resolved: boolean, resolution?: string) {
    const supabase = await createClient()
    
    const updateData: any = {
      resolved,
      updated_at: new Date().toISOString()
    }
    
    if (resolved) {
      updateData.resolution_date = new Date().toISOString()
      updateData.resolution = resolution || 'Resuelto mediante orden de trabajo'
    }
    
    const { error } = await supabase
      .from('checklist_issues')
      .update(updateData)
      .eq('id', issueId)
    
    if (error) {
      throw new Error(`Error actualizando estado del problema: ${error.message}`)
    }
  },
  
  // Obtener problemas por activo
  async getIssuesByAsset(assetId: string) {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('checklist_issues')
      .select(`
        *,
        checklist:checklist_id(*),
        item:item_id(*),
        work_order:work_order_id(*)
      `)
      .eq('checklist.asset_id', assetId)
      .order('created_at', { ascending: false })
    
    if (error) {
      throw new Error(`Error obteniendo problemas por activo: ${error.message}`)
    }
    
    return data
  }
} 