import { createClient } from '@/lib/supabase-server'
import { createBrowserClient } from '@supabase/ssr'

// Client-side Supabase instance for real-time subscriptions
const createBrowserSupabase = () => {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export const notificationService = {
  async getNotifications(userId: string) {
    const supabase = await createClient()
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
      
    if (error) {
      throw new Error(`Error obteniendo notificaciones: ${error.message}`)
    }
    
    return data
  },
  
  async markAsRead(notificationId: string) {
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('notifications')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('id', notificationId)
      
    if (error) {
      throw new Error(`Error marcando notificación como leída: ${error.message}`)
    }
  },
  
  async getUnreadCount(userId: string) {
    const supabase = await createClient()
    
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'unread')
      
    if (error) {
      throw new Error(`Error contando notificaciones: ${error.message}`)
    }
    
    return count
  },
  
  // Cliente
  // Suscribirse a nuevas notificaciones en tiempo real
  subscribeToNewNotifications(userId: string, callback: (notification: any) => void) {
    const supabase = createBrowserSupabase()
    
    const subscription = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          callback(payload.new)
        }
      )
      .subscribe()
      
    return () => {
      subscription.unsubscribe()
    }
  },
  
  // Marcar todas las notificaciones como leídas
  async markAllAsRead(userId: string) {
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('notifications')
      .update({ 
        status: 'read', 
        read_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('status', 'unread')
      
    if (error) {
      throw new Error(`Error marcando todas las notificaciones como leídas: ${error.message}`)
    }
  },
  
  // Eliminar una notificación
  async deleteNotification(notificationId: string) {
    const supabase = await createClient()
    
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      
    if (error) {
      throw new Error(`Error eliminando notificación: ${error.message}`)
    }
  }
} 