'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Bell, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  X,
  ExternalLink,
  ChevronRight
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import type { ComplianceNotification } from '@/types/compliance'

interface ComplianceNotificationCenterProps {
  maxItems?: number
  showUnreadOnly?: boolean
}

export function ComplianceNotificationCenter({ 
  maxItems = 10,
  showUnreadOnly = false 
}: ComplianceNotificationCenterProps) {
  const [notifications, setNotifications] = useState<ComplianceNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    fetchNotifications()
    // Refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [showUnreadOnly])

  const fetchNotifications = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) return

      let query = supabase
        .from('compliance_notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(maxItems)

      if (showUnreadOnly) {
        query = query.eq('is_read', false)
      }

      const { data, error } = await query

      if (error) throw error

      setNotifications(data || [])
      
      // Count unread
      const { count } = await supabase
        .from('compliance_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .eq('is_dismissed', false)

      setUnreadCount(count || 0)
    } catch (error) {
      console.error('Error fetching compliance notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('compliance_notifications')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId)

      if (error) throw error

      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === notificationId 
          ? { ...n, is_read: true, read_at: new Date().toISOString() }
          : n
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const dismissNotification = async (notificationId: string) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('compliance_notifications')
        .update({ 
          is_dismissed: true,
          dismissed_at: new Date().toISOString()
        })
        .eq('id', notificationId)

      if (error) throw error

      // Remove from local state
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      if (!notifications.find(n => n.id === notificationId)?.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (error) {
      console.error('Error dismissing notification:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('compliance_notifications')
        .update({ 
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .eq('is_dismissed', false)

      if (error) throw error

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      case 'medium':
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <Bell className="h-4 w-4 text-blue-500" />
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical':
        return <Badge variant="destructive">Crítico</Badge>
      case 'high':
        return <Badge className="bg-orange-100 text-orange-800">Alto</Badge>
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800">Medio</Badge>
      default:
        return <Badge variant="outline">Bajo</Badge>
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificaciones de Cumplimiento
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Alertas y recordatorios sobre cumplimiento de políticas
          </CardDescription>
        </div>
        {unreadCount > 0 && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={markAllAsRead}
          >
            Marcar todas como leídas
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
            <p>No hay notificaciones pendientes</p>
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`
                    p-4 border rounded-lg transition-colors
                    ${!notification.is_read 
                      ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800' 
                      : 'bg-background'
                    }
                    hover:bg-accent
                  `}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-2">
                        {getPriorityIcon(notification.priority)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className={`font-semibold ${!notification.is_read ? 'text-blue-900 dark:text-blue-100' : ''}`}>
                              {notification.title}
                            </h4>
                            {getPriorityBadge(notification.priority)}
                            {!notification.is_read && (
                              <Badge variant="secondary" className="text-xs">
                                Nuevo
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>
                              {format(new Date(notification.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                            </span>
                            {notification.action_url && notification.action_label && (
                              <Link 
                                href={notification.action_url}
                                className="flex items-center gap-1 text-primary hover:underline"
                                onClick={() => markAsRead(notification.id)}
                              >
                                {notification.action_label}
                                <ChevronRight className="h-3 w-3" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!notification.is_read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsRead(notification.id)}
                          className="h-8 w-8 p-0"
                          title="Marcar como leída"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => dismissNotification(notification.id)}
                        className="h-8 w-8 p-0"
                        title="Descartar"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
        {notifications.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <Button variant="outline" className="w-full" asChild>
              <Link href="/compliance/notificaciones">
                Ver todas las notificaciones
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
