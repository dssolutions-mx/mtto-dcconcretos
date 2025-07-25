import { StateCreator } from 'zustand'
// TEMPORARILY DISABLED: import { createEnhancedClient } from '@/lib/supabase-enhanced'

export interface OfflineOperation {
  id: string
  type: 'auth' | 'profile_update' | 'session_refresh' | 'sign_out'
  payload: any
  timestamp: number
  retryCount: number
  maxRetries: number
}

export interface OfflineState {
  queue: OfflineOperation[]
  isOnline: boolean
  isSyncing: boolean
  lastSyncTime: number | null
  failedOperations: OfflineOperation[]
}

export interface OfflineSlice extends OfflineState {
  // Actions
  addToQueue: (operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount'>) => void
  removeFromQueue: (id: string) => void
  processQueue: () => Promise<void>
  setOnlineStatus: (isOnline: boolean) => void
  incrementRetryCount: (id: string) => void
  clearQueue: () => void
  getQueueStats: () => { pending: number; failed: number; total: number }
}

export const createOfflineSlice: StateCreator<OfflineSlice> = (set, get) => ({
  // Initial state
  queue: [],
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isSyncing: false,
  lastSyncTime: null,
  failedOperations: [],

  // Actions
  addToQueue: (operation) => {
    const id = `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    set((state) => ({
      ...state,
      queue: [...state.queue, {
        ...operation,
        id,
        timestamp: Date.now(),
        retryCount: 0,
      }]
    }))

    console.log(`🔄 Added offline operation to queue: ${operation.type}`, { id, payload: operation.payload })
  },

  removeFromQueue: (id) => {
    set((state) => ({
      ...state,
      queue: state.queue.filter(op => op.id !== id)
    }))
  },

  processQueue: async () => {
    const { queue, isOnline, isSyncing } = get()
    
    if (!isOnline || isSyncing || queue.length === 0) {
      console.log('⏸️ Queue processing skipped:', { isOnline, isSyncing, queueLength: queue.length })
      return
    }
    
    console.log(`🚀 Processing ${queue.length} offline operations...`)
    set((state) => ({ ...state, isSyncing: true }))
    
    const processedOperations: string[] = []
    const failedOperations: OfflineOperation[] = []
    
    for (const operation of queue) {
      try {
        console.log(`⚡ Processing operation: ${operation.type}`, operation.payload)
        
        // Process operation based on type
        switch (operation.type) {
          case 'auth':
            // Handle auth operations (sign in/out)
            console.log('🔐 Processing queued auth operation')
            
            if (operation.payload.action === 'signIn') {
              // Import auth store functions dynamically to avoid circular dependency
              const { useAuthStore } = await import('../index')
              const authStore = useAuthStore.getState()
              
              const result = await authStore.signIn(
                operation.payload.email, 
                operation.payload.password
              )
              
              if (!result.success) {
                throw new Error(result.error || 'Sign in failed')
              }
            } else if (operation.payload.action === 'signOut') {
              const { useAuthStore } = await import('../index')
              const authStore = useAuthStore.getState()
              
              await authStore.signOut()
            }
            break
            
          case 'profile_update':
            // Handle profile updates
            console.log('👤 Processing profile update')
            // This would integrate with actual profile update logic
            await new Promise(resolve => setTimeout(resolve, 300))
            break
            
          case 'session_refresh':
            // Handle session refresh
            console.log('🔄 Processing session refresh')
            const { useAuthStore } = await import('../index')
            const authStore = useAuthStore.getState()
            await authStore.refreshSession()
            break
            
          case 'sign_out':
            // Handle sign out (legacy - same as auth with signOut action)
            console.log('🚪 Processing sign out')
            const { useAuthStore: authStoreSignOut } = await import('../index')
            const authStoreInstance = authStoreSignOut.getState()
            await authStoreInstance.signOut()
            break
        }
        
        // Mark as processed
        processedOperations.push(operation.id)
        console.log(`✅ Successfully processed: ${operation.type}`)
        
      } catch (error) {
        console.error(`❌ Failed to process operation ${operation.id}:`, error)
        
        // Increment retry count
        const updatedOperation = { ...operation, retryCount: operation.retryCount + 1 }
        
        if (updatedOperation.retryCount >= updatedOperation.maxRetries) {
          console.error(`💀 Operation ${operation.id} exceeded max retries, moving to failed`)
          failedOperations.push(updatedOperation)
          processedOperations.push(operation.id) // Remove from queue
        } else {
          console.warn(`🔄 Retrying operation ${operation.id} (attempt ${updatedOperation.retryCount}/${updatedOperation.maxRetries})`)
          // Update retry count in queue
          set((state) => ({
            ...state,
            queue: state.queue.map(op => 
              op.id === operation.id 
                ? { ...op, retryCount: updatedOperation.retryCount }
                : op
            )
          }))
        }
      }
    }
    
    // Update state
    set((state) => ({
      ...state,
      // Remove processed operations
      queue: state.queue.filter(op => !processedOperations.includes(op.id)),
      // Add failed operations
      failedOperations: [...state.failedOperations, ...failedOperations],
      isSyncing: false,
      lastSyncTime: Date.now()
    }))
    
    console.log(`🏁 Queue processing complete. Processed: ${processedOperations.length}, Failed: ${failedOperations.length}`)
  },

  setOnlineStatus: (isOnline) => {
    const wasOffline = !get().isOnline
    
    set((state) => ({ ...state, isOnline }))
    
    console.log(`🌐 Network status changed: ${isOnline ? 'ONLINE' : 'OFFLINE'}`)
    
    // Auto-process queue when coming online
    if (isOnline && wasOffline) {
      console.log('🔄 Network restored, processing offline queue...')
      setTimeout(() => get().processQueue(), 1000) // Small delay to ensure connection stability
    }
  },

  incrementRetryCount: (id) => {
    set((state) => {
      const operation = state.queue.find(op => op.id === id)
      if (operation) {
        const updatedOperation = { ...operation, retryCount: operation.retryCount + 1 }
        
        if (updatedOperation.retryCount >= updatedOperation.maxRetries) {
          // Move to failed operations and remove from queue
          return {
            ...state,
            queue: state.queue.filter(op => op.id !== id),
            failedOperations: [...state.failedOperations, updatedOperation]
          }
        } else {
          // Update retry count in queue
          return {
            ...state,
            queue: state.queue.map(op => 
              op.id === id ? updatedOperation : op
            )
          }
        }
      }
      return state
    })
  },

  clearQueue: () => {
    set((state) => ({
      ...state,
      queue: [],
      failedOperations: []
    }))
    console.log('🗑️ Offline queue cleared')
  },

  getQueueStats: () => {
    const state = get()
    return {
      pending: state.queue.length,
      failed: state.failedOperations.length,
      total: state.queue.length + state.failedOperations.length
    }
  }
})

// Setup online/offline listeners
export function setupOfflineListeners() {
  if (typeof window === 'undefined') return () => {}

  const handleOnline = () => {
    console.log('Network connection restored')
    // This will be used by the store
  }

  const handleOffline = () => {
    console.log('Network connection lost')
    // This will be used by the store
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
} 