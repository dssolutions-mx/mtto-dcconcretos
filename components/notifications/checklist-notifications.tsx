"use client"

import { useEffect, useState } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { createBrowserClient } from "@supabase/ssr"

type Notification = {
  id: string
  user_id: string
  title: string
  message: string
  type: string
  related_entity: string
  entity_id: string
  status: 'unread' | 'read'
  priority: 'low' | 'medium' | 'high'
  created_at: string
  read_at: string | null
}

export function ChecklistNotifications() {
  const [user, setUser] = useState<any>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    // Obtener el usuario actual
    const fetchUser = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    
    fetchUser()
  }, [])
  
  useEffect(() => {
    if (!user) return
    
    async function loadNotifications() {
      try {
        setLoading(true)
        
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        
        // Obtener notificaciones del usuario
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20)
        
        if (error) throw error
        
        setNotifications(data || [])
        
        // Contar notificaciones no leídas
        const unread = data?.filter(n => n.status === 'unread').length || 0
        setUnreadCount(unread)
      } catch (error) {
        console.error('Error cargando notificaciones:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadNotifications()
    
    // Suscripción a nuevas notificaciones
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    const subscription = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // Actualizar estado con la nueva notificación
          setNotifications(prev => [payload.new as Notification, ...prev])
          setUnreadCount(prev => prev + 1)
        }
      )
      .subscribe()
      
    return () => {
      subscription.unsubscribe()
    }
  }, [user])
  
  async function handleMarkAsRead(notificationId: string) {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      
      // Actualizar en la base de datos
      const { error } = await supabase
        .from('notifications')
        .update({ 
          status: 'read', 
          read_at: new Date().toISOString() 
        })
        .eq('id', notificationId)
      
      if (error) throw error
      
      // Actualizar la UI
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId 
            ? { ...notif, status: 'read', read_at: new Date().toISOString() } 
            : notif
        )
      )
      
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marcando notificación como leída:', error)
    }
  }
  
  if (!user) return null
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 px-1 min-w-[1.25rem] h-5 flex items-center justify-center"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <h4 className="font-medium">Notificaciones</h4>
          {unreadCount > 0 && (
            <Badge variant="outline">{unreadCount} sin leer</Badge>
          )}
        </div>
        
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Cargando notificaciones...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No hay notificaciones nuevas
            </div>
          ) : (
            notifications.slice(0, 5).map((notification) => (
              <DropdownMenuItem 
                key={notification.id}
                className={`p-3 cursor-pointer ${notification.status === 'unread' ? 'bg-muted/50' : ''}`}
                onClick={() => handleMarkAsRead(notification.id)}
              >
                <div className="flex flex-col space-y-1 w-full">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{notification.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(notification.created_at).toLocaleString([], { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit'
                      })}
                    </span>
                  </div>
                  <p className="text-sm">{notification.message}</p>
                  {notification.related_entity === 'checklist_issue' && (
                    <Link 
                      href={`/checklists/problemas/${notification.entity_id}`}
                      className="text-xs text-blue-600 hover:underline mt-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Ver detalles
                    </Link>
                  )}
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
        
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer justify-center text-center py-2">
              <Link href="/notificaciones">Ver todas las notificaciones</Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 