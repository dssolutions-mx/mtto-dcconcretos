import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies()
    const { id } = await params
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options)
              })
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )

    // Get current user for authorization with detailed error logging
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    console.log('🔍 Auth Debug Info:', {
      userError: userError?.message,
      userId: user?.id,
      userEmail: user?.email,
      hasUser: !!user
    })
    
    if (userError) {
      console.error('❌ Auth Error:', userError)
      return NextResponse.json({ 
        error: 'Authentication failed', 
        details: userError.message 
      }, { status: 401 })
    }
    
    if (!user) {
      console.error('❌ No user found in session')
      return NextResponse.json({ 
        error: 'No authenticated user found' 
      }, { status: 401 })
    }

    if (!id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      )
    }

    // Check user's profile and permissions
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .single()

    console.log('👤 User Profile:', {
      profileError: profileError?.message,
      userRole: profile?.role,
      userStatus: profile?.status
    })

    if (profileError || !profile) {
      console.error('❌ Profile Error:', profileError)
      return NextResponse.json({
        error: 'User profile not found',
        details: profileError?.message
      }, { status: 403 })
    }

    // Check if user has permission to delete templates
    const allowedRoles = [
      'GERENCIA_GENERAL',
      'JEFE_UNIDAD_NEGOCIO', 
      'ENCARGADO_MANTENIMIENTO',
      'JEFE_PLANTA',
      'AREA_ADMINISTRATIVA'
    ]

    if (!allowedRoles.includes(profile.role) || profile.status !== 'active') {
      console.error('❌ Insufficient permissions:', {
        userRole: profile.role,
        userStatus: profile.status,
        allowedRoles
      })
      return NextResponse.json({
        error: 'Insufficient permissions to delete checklist templates',
        details: `User role '${profile.role}' or status '${profile.status}' not authorized`
      }, { status: 403 })
    }

    // Check if template exists
    const { data: template, error: fetchError } = await supabase
      .from('checklists')
      .select('id, name')
      .eq('id', id)
      .single()

    if (fetchError || !template) {
      console.error('❌ Template Fetch Error:', fetchError)
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    // Check if template has completed checklists (these prevent deletion for audit purposes)
    const { data: completedChecklists } = await supabase
      .from('completed_checklists')
      .select('id')
      .eq('checklist_id', id)
      .limit(1)

    if (completedChecklists && completedChecklists.length > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete template: it has completed checklists',
          details: 'Templates with execution history cannot be deleted for audit purposes'
        },
        { status: 400 }
      )
    }

    // Get and delete any scheduled checklists for this template
    const { data: schedules } = await supabase
      .from('checklist_schedules')
      .select('id')
      .eq('template_id', id)

    let schedulesCount = 0
    if (schedules && schedules.length > 0) {
      schedulesCount = schedules.length
      console.log(`🗑️ Deleting ${schedulesCount} scheduled checklists for template ${id}`)
      
      const { error: schedulesDeleteError } = await supabase
        .from('checklist_schedules')
        .delete()
        .eq('template_id', id)

      if (schedulesDeleteError) {
        console.error('Error deleting scheduled checklists:', schedulesDeleteError)
        return NextResponse.json(
          { 
            error: 'Failed to delete scheduled checklists',
            details: schedulesDeleteError.message 
          },
          { status: 500 }
        )
      }
    }

    // Clean up any unresolved checklist issues associated with this template
    let issuesCount = 0
    try {
      const { data: deletedIssues, error: issuesError } = await supabase
        .from('checklist_issues')
        .delete()
        .eq('checklist_id', id)
        .eq('resolved', false)
        .select('id')

      if (issuesError) {
        console.warn('Could not delete checklist issues:', issuesError)
        // Continue with deletion even if issues cleanup fails
      } else {
        issuesCount = deletedIssues?.length || 0
        if (issuesCount > 0) {
          console.log(`🗑️ Cleaned up ${issuesCount} unresolved checklist issues for template`)
        }
      }
    } catch (error) {
      console.warn('Error during issues cleanup:', error)
      // Continue with deletion
    }

    // Delete template (cascade will handle sections and items)
    // Also clean up template versions if they exist
    try {
      // Delete template versions first (if versioning is enabled)
      const { error: versionsError } = await supabase
        .from('checklist_template_versions')
        .delete()
        .eq('template_id', id)

      if (versionsError) {
        console.warn('Could not delete template versions:', versionsError)
        // Continue with template deletion even if versions cleanup fails
      }

      // Delete the template (cascade will handle sections and items)
      const { error: deleteError } = await supabase
        .from('checklists')
        .delete()
        .eq('id', id)

      if (deleteError) {
        console.error('Error deleting template:', deleteError)
        return NextResponse.json(
          { error: 'Failed to delete template', details: deleteError.message },
          { status: 500 }
        )
      }

      const baseMessage = `Template "${template.name}" deleted successfully`
      
      const deletedItems = []
      if (schedulesCount > 0) {
        deletedItems.push(`${schedulesCount} scheduled checklist${schedulesCount > 1 ? 's' : ''}`)
      }
      if (issuesCount > 0) {
        deletedItems.push(`${issuesCount} unresolved issue${issuesCount > 1 ? 's' : ''}`)
      }
      
      const additionalMessage = deletedItems.length > 0 ? ` (${deletedItems.join(' and ')} also deleted)` : ''
      
      console.log(`✅ Successfully deleted template: ${baseMessage}${additionalMessage}`)
      
      return NextResponse.json({
        success: true,
        message: baseMessage + additionalMessage,
        deletedSchedules: schedulesCount,
        deletedIssues: issuesCount
      })

    } catch (error) {
      console.error('Error during template deletion:', error)
      return NextResponse.json(
        { error: 'Internal server error during deletion' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Error in template DELETE route:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 