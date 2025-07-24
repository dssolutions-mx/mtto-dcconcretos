import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { 
      checklist_id, 
      items_with_issues, 
      priority = 'Media', 
      description = '',
      asset_id,
      enable_smart_deduplication = true,
      consolidation_window_days = 30,
      allow_manual_override = false,
      consolidation_choices = {}
    } = body

    if (!checklist_id || !items_with_issues || !Array.isArray(items_with_issues) || items_with_issues.length === 0) {
      return NextResponse.json(
        { error: 'checklist_id e items_with_issues son requeridos' },
        { status: 400 }
      )
    }

    if (!asset_id) {
      return NextResponse.json(
        { error: 'asset_id es requerido' },
        { status: 400 }
      )
    }

    // Get checklist and asset data
    const { data: checklistData, error: checklistError } = await supabase
      .from('completed_checklists')
      .select(`
        id,
        asset_id,
        technician,
        completion_date,
        checklists:checklist_id(name),
        assets:asset_id(name, asset_id, location)
      `)
      .eq('id', checklist_id)
      .single()

    if (checklistError || !checklistData) {
      return NextResponse.json(
        { error: 'Checklist no encontrado' },
        { status: 404 }
      )
    }

    const createdWorkOrders = []
    const consolidatedIssues = []
    const newWorkOrders = []
    const similarIssuesFound = []

    // Process each issue with smart deduplication
    for (const issue of items_with_issues) {
      try {
        // First save the issue
        const { data: savedIssue, error: issueError } = await supabase
          .from('checklist_issues')
          .insert({
            checklist_id,
            item_id: issue.id,
            status: issue.status,
            description: issue.description,
            notes: issue.notes,
            photo_url: issue.photo_url
          })
          .select('id')
          .single()

        if (issueError) {
          console.error(`Error saving issue ${issue.id}:`, issueError)
          continue
        }

        // Generate fingerprint for this issue
        const { data: fingerprint, error: fingerprintError } = await supabase
          .rpc('generate_issue_fingerprint', {
            p_asset_id: asset_id,
            p_item_description: issue.description,
            p_status: issue.status,
            p_notes: issue.notes
          })

        if (fingerprintError) {
          console.error('Error generating fingerprint:', fingerprintError)
          // Continue without deduplication
        }

        // Update the saved issue with fingerprint
        await supabase
          .from('checklist_issues')
          .update({ issue_fingerprint: fingerprint })
          .eq('id', savedIssue.id)

        let workOrderCreated = false
        let consolidatedInto = null

        // Check for similar issues if smart deduplication is enabled
        // Also check user's consolidation choice for this item
        console.log('🎯 Consolidation choices received:', consolidation_choices)
        console.log('🔍 Looking for choice for issue ID:', issue.id)
        const userChoice = consolidation_choices[issue.id] || 'consolidate'
        console.log('✅ User choice for this issue:', userChoice)
        const shouldCheckSimilar = enable_smart_deduplication && fingerprint && userChoice !== 'create_new'
        console.log('🔎 Should check similar?', shouldCheckSimilar, '(enable_smart_deduplication:', enable_smart_deduplication, ', userChoice !== create_new:', userChoice !== 'create_new', ')')
        
        if (shouldCheckSimilar) {
          const { data: similarIssues, error: similarError } = await supabase
            .rpc('find_similar_open_issues', {
              p_fingerprint: fingerprint,
              p_asset_id: asset_id,
              p_consolidation_window: `${consolidation_window_days} days`
            })

          if (!similarError && similarIssues && similarIssues.length > 0) {
            // Found similar open issues
            const existingIssue = similarIssues[0]
            console.log('🔗 Found similar issue, user choice is:', userChoice)
            console.log('📋 Existing work order ID:', existingIssue.work_order_id)
            
            similarIssuesFound.push({
              issue: issue,
              existing_issue_id: existingIssue.issue_id,
              existing_work_order_id: existingIssue.work_order_id,
              recurrence_count: existingIssue.recurrence_count + 1,
              item_description: existingIssue.item_description,
              priority: existingIssue.priority
            })

            // Only consolidate if user chose 'consolidate' or default
            if (userChoice === 'consolidate') {
              console.log('✅ Consolidating with existing work order')
              
              // Get current work order details to check priority
              const { data: currentWorkOrder, error: woError } = await supabase
                .from('work_orders')
                .select('id, priority, description, escalation_count, issue_history, related_issues_count')
                .eq('id', existingIssue.work_order_id)
                .single()

              if (woError || !currentWorkOrder) {
                console.error('❌ Error fetching work order for consolidation:', woError)
                continue // Skip this consolidation and create new work order instead
              }

              // Determine if we need to update priority
              const currentPriority = currentWorkOrder.priority
              const newIssuePriority = issue.priority || priority || 'Media'
              
              // Priority hierarchy: Alta > Media > Baja
              const priorityOrder: Record<string, number> = { 'Alta': 3, 'Media': 2, 'Baja': 1 }
              const shouldUpdatePriority = (priorityOrder[newIssuePriority] || 2) > (priorityOrder[currentPriority] || 2)
              
              console.log(`🔧 Priority comparison: Current=${currentPriority}, New=${newIssuePriority}, ShouldUpdate=${shouldUpdatePriority}`)

              // Prepare updated history with SMART deduplication check
              const currentHistory = currentWorkOrder.issue_history || []
              const currentTime = new Date()
              const checklistName = (checklistData.checklists as any)?.name || 'N/A'
              
              // SMART duplicate detection: only prevent if EXACT same entry within last 30 minutes
              const historyEntryExists = currentHistory.some((entry: any) => {
                if (!entry.date) return false
                
                const entryTime = new Date(entry.date)
                const timeDiffMinutes = Math.abs(currentTime.getTime() - entryTime.getTime()) / (1000 * 60)
                
                // Only consider duplicate if within 30 minutes AND exact same content
                return timeDiffMinutes < 30 &&
                       entry.checklist === checklistName &&
                       entry.notes === (issue.notes || '') &&
                       entry.description === issue.description &&
                       entry.status === issue.status
              })
              
              let updatedHistory = currentHistory
              
              if (!historyEntryExists) {
                updatedHistory = [
                  ...currentHistory,
                  {
                    date: currentTime.toISOString(),
                    checklist: checklistName,
                    description: issue.description,
                    notes: issue.notes || '',
                    status: issue.status,
                    priority: newIssuePriority
                  }
                ]
                console.log('✅ Adding new entry to issue history')
              } else {
                console.log('⚠️ Duplicate history entry detected - skipping history update')
              }

              // Prepare updated description with SMART deduplication check
              const todayString = new Date().toLocaleDateString()
              const now = new Date()
              const timeSignature = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`
              const occurrenceSignature = `NUEVA OCURRENCIA - ${todayString}`
              const checklistSignature = `Checklist: ${(checklistData.checklists as any)?.name || 'N/A'}`
              
              // SMART duplicate detection: only prevent if EXACT same checklist, notes, and within 30 minutes
              const recentOccurrences = currentWorkOrder.description.split('NUEVA OCURRENCIA').slice(1)
              let isDuplicateWithinWindow = false
              
              if (recentOccurrences.length > 0) {
                for (const occurrence of recentOccurrences) {
                  // Check if this occurrence has the same checklist and notes
                  const hasSameChecklist = occurrence.includes(checklistSignature)
                  const hasSameNotes = issue.notes ? occurrence.includes(issue.notes) : true
                  
                  // Extract time from occurrence (if available)
                  const timeMatch = occurrence.match(/(\d{1,2}):(\d{2})/)
                  if (timeMatch && hasSameChecklist && hasSameNotes) {
                    const occurrenceHour = parseInt(timeMatch[1])
                    const occurrenceMinute = parseInt(timeMatch[2])
                    const occurrenceTime = new Date()
                    occurrenceTime.setHours(occurrenceHour, occurrenceMinute, 0, 0)
                    
                    const timeDiffMinutes = Math.abs(now.getTime() - occurrenceTime.getTime()) / (1000 * 60)
                    
                    // Only consider duplicate if within 30 minutes
                    if (timeDiffMinutes < 30) {
                      isDuplicateWithinWindow = true
                      console.log(`⚠️ Duplicate occurrence detected within 30-minute window (${Math.round(timeDiffMinutes)} min ago)`)
                      break
                    }
                  }
                }
              }
              
              let updatedDescription = currentWorkOrder.description
              
              if (!isDuplicateWithinWindow) {
                const newOccurrence = `

NUEVA OCURRENCIA - ${todayString} ${timeSignature}:
• Checklist: ${(checklistData.checklists as any)?.name || 'N/A'}
• Estado: ${issue.status === 'fail' ? 'FALLA DETECTADA' : 'REQUIERE REVISIÓN'}
• Prioridad: ${newIssuePriority}
${issue.notes ? `• Observaciones: ${issue.notes}` : ''}
${issue.photo_url ? '• Evidencia fotográfica disponible' : ''}`

                updatedDescription = currentWorkOrder.description + newOccurrence
                console.log(`✅ Adding new occurrence to work order description (${timeSignature})`)
              } else {
                console.log('⚠️ Recent duplicate occurrence detected - skipping description update')
              }

              // Only update work order if there are actual changes
              const hasDescriptionChange = !isDuplicateWithinWindow
              const hasHistoryChange = !historyEntryExists
              const needsUpdate = hasDescriptionChange || hasHistoryChange || shouldUpdatePriority
              
              if (needsUpdate) {
                // Update work order with consolidation info and potentially new priority
                const updateData: any = {
                  description: updatedDescription,
                  issue_history: updatedHistory,
                  escalation_count: (currentWorkOrder.escalation_count || 0) + (hasDescriptionChange ? 1 : 0),
                  related_issues_count: (currentWorkOrder.related_issues_count || 1) + (hasDescriptionChange ? 1 : 0),
                  updated_at: new Date().toISOString()
                }

                // Update priority if new issue has higher priority
                if (shouldUpdatePriority) {
                  updateData.priority = newIssuePriority
                  console.log(`🔥 Escalating work order priority from ${currentPriority} to ${newIssuePriority}`)
                }

                console.log(`🔄 Updating work order with changes: description=${hasDescriptionChange}, history=${hasHistoryChange}, priority=${shouldUpdatePriority}`)

                // Update the work order
                const { error: updateError } = await supabase
                  .from('work_orders')
                  .update(updateData)
                  .eq('id', existingIssue.work_order_id)
              
                if (!updateError) {
                  // Link the new issue to the existing work order
                  await supabase
                    .from('checklist_issues')
                    .update({ 
                      work_order_id: existingIssue.work_order_id,
                      parent_issue_id: existingIssue.issue_id
                    })
                    .eq('id', savedIssue.id)

                  console.log('🎉 Successfully consolidated issue with updates')
                  consolidatedIssues.push({
                    new_issue_id: savedIssue.id,
                    consolidated_into: existingIssue.work_order_id,
                    recurrence_count: existingIssue.recurrence_count + 1,
                    escalated: (existingIssue.recurrence_count + 1) >= 2,
                    priority_updated: shouldUpdatePriority,
                    old_priority: currentPriority,
                    new_priority: shouldUpdatePriority ? newIssuePriority : currentPriority,
                    changes_made: {
                      description_updated: hasDescriptionChange,
                      history_updated: hasHistoryChange,
                      priority_updated: shouldUpdatePriority
                    }
                  })
                  workOrderCreated = true
                  consolidatedInto = existingIssue.work_order_id
                } else {
                  console.error('❌ Error updating work order during consolidation:', updateError)
                }
              } else {
                // No changes needed, just link the issue
                console.log('ℹ️ No changes needed - issue already consolidated (duplicate)')
                await supabase
                  .from('checklist_issues')
                  .update({ 
                    work_order_id: existingIssue.work_order_id,
                    parent_issue_id: existingIssue.issue_id
                  })
                  .eq('id', savedIssue.id)

                consolidatedIssues.push({
                  new_issue_id: savedIssue.id,
                  consolidated_into: existingIssue.work_order_id,
                  recurrence_count: existingIssue.recurrence_count,
                  escalated: false,
                  priority_updated: false,
                  old_priority: currentPriority,
                  new_priority: currentPriority,
                  changes_made: {
                    description_updated: false,
                    history_updated: false,
                    priority_updated: false
                  },
                  duplicate_detected: true
                })
                workOrderCreated = true
                consolidatedInto = existingIssue.work_order_id
              }
            } else {
              console.log('⚠️ User chose not to consolidate, will create new work order')
            }
          }
        }

        // If no similar issue found or deduplication disabled, create new work order
        if (!workOrderCreated) {
          // Create individual work order description using new clean format
          let workOrderDescription = `${issue.description}

 ${issue.status === 'fail' ? 'FALLA DETECTADA' : 'REQUIERE REVISIÓN'}
${issue.notes ? `Observaciones: ${issue.notes}` : ''}${issue.photo_url ? '\nEvidencia fotográfica disponible' : ''}

ORIGEN:
• Checklist: ${(checklistData.checklists as any)?.name || 'N/A'}
• Fecha: ${new Date(checklistData.completion_date).toLocaleDateString()}
• Activo: ${(checklistData.assets as any)?.name || 'N/A'} (${(checklistData.assets as any)?.asset_id || 'N/A'})
• Ubicación: ${(checklistData.assets as any)?.location || 'N/A'}`

          // Note: User notes are no longer added as additional context to keep descriptions concise
          // The description will only contain the individual item information and origin data

          // Determine priority based on individual item priority or fallback
          let workOrderPriority = issue.priority || priority || 'Media'
          
          // Auto-adjust priority based on issue status if no specific priority set
          if (!issue.priority && issue.status === 'fail') {
            workOrderPriority = priority === 'Baja' ? 'Media' : priority
          }
          
          // Escalate priority if user chose 'escalate' option
          if (userChoice === 'escalate') {
            workOrderPriority = 'Alta'
          }

          // Create work order (order_id will be generated automatically by trigger)
          const { data: workOrder, error: workOrderError } = await supabase
            .from('work_orders')
            .insert({
              asset_id: asset_id,
              description: workOrderDescription.trim(),
              type: 'corrective',
              priority: workOrderPriority,
              status: 'Pendiente',
              checklist_id: checklist_id,
              issue_items: [issue],
              requested_by: user.id,
              original_priority: workOrderPriority,
              related_issues_count: 1,
              created_at: new Date().toISOString()
            })
            .select('id, order_id, description, status, priority')
            .single()

          if (workOrderError) {
            console.error(`Error creating work order for issue ${issue.id}:`, workOrderError)
            continue
          }

          newWorkOrders.push(workOrder)
          createdWorkOrders.push(workOrder)

          // Update checklist issue with work order ID
          await supabase
            .from('checklist_issues')
            .update({ work_order_id: workOrder.id })
            .eq('id', savedIssue.id)

          // Create individual incident
          const { data: incident, error: incidentError } = await supabase
            .from('incident_history')
            .insert({
              asset_id: asset_id,
              date: new Date().toISOString(),
              type: 'Mantenimiento',
              description: `${issue.description} - ${issue.notes || 'Problema detectado en checklist'}`,
              impact: workOrderPriority === 'Alta' ? 'Alto' : (workOrderPriority === 'Media' ? 'Medio' : 'Bajo'),
              status: 'Abierto',
              reported_by: user.id,
              created_by: user.id,
              work_order_id: workOrder.id,
              created_at: new Date().toISOString()
            })
            .select('id')
            .single()

          if (!incidentError && incident) {
            // Update checklist issue with incident ID
            await supabase
              .from('checklist_issues')
              .update({ incident_id: incident.id })
              .eq('id', savedIssue.id)
          }
        }

      } catch (itemError) {
        console.error(`Error processing issue ${issue.id}:`, itemError)
        continue
      }
    }

    // Update asset status to maintenance if priority is high
    if (priority === 'Alta' && createdWorkOrders.length > 0) {
      await supabase
        .from('assets')
        .update({ status: 'maintenance' })
        .eq('id', asset_id)
    }

    // Prepare response message
    let message = ''
    const totalCreated = newWorkOrders.length
    const totalConsolidated = consolidatedIssues.length
    
    if (enable_smart_deduplication) {
      if (totalCreated > 0 && totalConsolidated > 0) {
        message = `✅ Órdenes de trabajo procesadas: ${totalCreated} nuevas creadas, ${totalConsolidated} consolidadas con existentes`
      } else if (totalCreated > 0) {
        message = `✅ ${totalCreated} órdenes de trabajo correctivas creadas con prioridad ${priority.toLowerCase()}`
      } else if (totalConsolidated > 0) {
        message = `🔄 Todos los problemas fueron consolidados con órdenes existentes (${totalConsolidated} issues recurring)`
      } else {
        message = 'No se pudieron procesar las órdenes de trabajo'
      }
    } else {
      message = `Se crearon ${totalCreated} órdenes de trabajo correctivas (una por cada problema detectado) con prioridad ${priority.toLowerCase()}`
    }

    return NextResponse.json({
      success: true,
      smart_deduplication_enabled: enable_smart_deduplication,
      work_orders_created: totalCreated,
      work_orders: createdWorkOrders,
      new_work_orders: newWorkOrders,
      consolidated_issues: consolidatedIssues,
      similar_issues_found: similarIssuesFound,
      issues_processed: items_with_issues.length,
      deduplication_stats: {
        new_work_orders: totalCreated,
        consolidated_issues: totalConsolidated,
        total_similar_found: similarIssuesFound.length,
        consolidation_window_days: consolidation_window_days
      },
      message: message
    })

  } catch (error) {
    console.error('Error in enhanced corrective work order generation:', error)
    return NextResponse.json(
      { error: `Error interno del servidor: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
} 