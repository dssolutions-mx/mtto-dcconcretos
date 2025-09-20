import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import { 
  DieselImportState, 
  DieselExcelRow,
  ImportBatch,
  AssetMappingEntry,
  AssetResolution,
  ProcessingError,
  ProcessingNotification,
  ValidationResult 
} from '@/types/diesel'
import { createClient } from '@/lib/supabase'

// Define the complete store interface
interface DieselStore extends DieselImportState {
  // Core user info needed for diesel operations
  user: { id: string } | null
  setUser: (user: { id: string } | null) => void
  
  // File Upload Actions
  setUploadedFile: (file: File | null) => void
  setUploadProgress: (progress: number) => void
  setUploading: (isUploading: boolean) => void
  
  // Parsing Actions
  setParsedData: (data: DieselExcelRow[]) => void
  setParsingErrors: (errors: string[]) => void
  setParsing: (isParsing: boolean) => void
  clearParsedData: () => void
  
  // Batch Management Actions
  createBatch: (filename: string, rowCount: number) => Promise<string>
  updateBatch: (batch: Partial<ImportBatch>) => void
  completeBatch: () => void
  
  // Asset Mapping Actions
  setUnmappedAssets: (assets: AssetMappingEntry[]) => void
  addPendingMapping: (originalName: string, resolution: AssetResolution) => void
  removePendingMapping: (originalName: string) => void
  setMappingProgress: (progress: number) => void
  submitAssetMappings: () => Promise<boolean>
  
  // Processing Status Actions
  setProcessingStatus: (status: DieselImportState['processingStatus']) => void
  setCurrentStep: (step: string) => void
  setOverallProgress: (progress: number) => void
  
  // Error & Notification Management
  addError: (error: ProcessingError) => void
  removeError: (errorId: string) => void
  clearErrors: () => void
  addNotification: (notification: Omit<ProcessingNotification, 'id' | 'timestamp' | 'dismissed'>) => void
  dismissNotification: (notificationId: string) => void
  clearNotifications: () => void
  
  // Data Processing Actions
  validateExcelData: (data: DieselExcelRow[]) => ValidationResult
  processDataBatch: () => Promise<boolean>
  
  // Utility Actions
  reset: () => void
  getProcessingSummary: () => {
    totalRows: number
    processedRows: number
    errorCount: number
    successRate: number
    currentBatch: ImportBatch | null
  }
}

// Initial state
const initialState: DieselImportState = {
  // File upload state
  uploadedFile: null,
  uploadProgress: 0,
  isUploading: false,
  
  // Parsing state
  parsedData: [],
  parsingErrors: [],
  isParsing: false,
  
  // Batch processing
  currentBatch: null,
  batchHistory: [],
  
  // Asset mapping state
  unmappedAssets: [],
  pendingMappings: new Map(),
  mappingProgress: 0,
  
  // Processing status
  processingStatus: 'idle',
  currentStep: '',
  overallProgress: 0,
  
  // Errors and notifications
  errors: [],
  notifications: []
}

// **SOLUTION: Create the diesel-specific store directly**
export const useDieselStore = create<DieselStore>()(
  devtools(
    subscribeWithSelector(
      (set, get) => ({
        // Initial state
        ...initialState,
        
        // User context (minimal for diesel operations)
        user: null,
        setUser: (user: { id: string } | null) => set({ user }),
        
        // File Upload Actions
        setUploadedFile: (file: File | null) => set({ uploadedFile: file }),
        
        setUploadProgress: (progress: number) => set({ uploadProgress: Math.max(0, Math.min(100, progress)) }),
        
        setUploading: (isUploading: boolean) => set(state => ({ 
          isUploading,
          uploadProgress: isUploading ? 0 : state.uploadProgress
        })),
        
        // Parsing Actions
        setParsedData: (data: DieselExcelRow[]) => set({ 
          parsedData: data,
          parsingErrors: [],
          isParsing: false 
        }),
        
        setParsingErrors: (errors: string[]) => set({ parsingErrors: errors }),
        
        setParsing: (isParsing: boolean) => set({ isParsing }),
        
        clearParsedData: () => set({ 
          parsedData: [],
          parsingErrors: [],
          isParsing: false
        }),
        
        // Batch Management Actions
        createBatch: async (filename: string, rowCount: number) => {
          const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          const state = get()
          
          const newBatch: ImportBatch = {
            batch_id: batchId,
            original_filename: filename,
            total_rows: rowCount,
            processed_rows: 0,
            successful_rows: 0,
            error_rows: 0,
            status: 'uploading',
            progress_percentage: 0,
            created_at: new Date().toISOString(),
            completed_at: null,
            created_by: state.user?.id || 'unknown',
            processing_summary: null
          }
          
          set({ currentBatch: newBatch })
          
          get().addNotification({
            type: 'info',
            title: 'Batch Created',
            message: `New import batch created for ${filename}`
          })
          
          return batchId
        },
        
        updateBatch: (batchUpdate: Partial<ImportBatch>) => {
          set(state => ({
            currentBatch: state.currentBatch 
              ? { ...state.currentBatch, ...batchUpdate }
              : null
          }))
        },
        
        completeBatch: () => {
          const { currentBatch } = get()
          if (currentBatch) {
            const completedBatch: ImportBatch = {
              ...currentBatch,
              status: 'completed',
              completed_at: new Date().toISOString(),
              progress_percentage: 100
            }
            
            set(state => ({
              currentBatch: null,
              batchHistory: [completedBatch, ...state.batchHistory],
              processingStatus: 'completed'
            }))
            
            get().addNotification({
              type: 'success',
              title: 'Batch Completed',
              message: `Successfully processed ${completedBatch.successful_rows}/${completedBatch.total_rows} rows`
            })
          }
        },
        
        // Asset Mapping Actions
        setUnmappedAssets: (assets: AssetMappingEntry[]) => set({ unmappedAssets: assets }),
        
        addPendingMapping: (originalName: string, resolution: AssetResolution) => {
          set(state => {
            const newPendingMappings = new Map(state.pendingMappings)
            newPendingMappings.set(originalName, resolution)
            return { pendingMappings: newPendingMappings }
          })
        },
        
        removePendingMapping: (originalName: string) => {
          set(state => {
            const newPendingMappings = new Map(state.pendingMappings)
            newPendingMappings.delete(originalName)
            return { pendingMappings: newPendingMappings }
          })
        },
        
        setMappingProgress: (progress: number) => set({ mappingProgress: Math.max(0, Math.min(100, progress)) }),
        
        submitAssetMappings: async () => {
          // Implementation would go here
          return true
        },
        
        // Processing Status Actions
        setProcessingStatus: (status: DieselImportState['processingStatus']) => set({ processingStatus: status }),
        
        setCurrentStep: (step: string) => set({ currentStep: step }),
        
        setOverallProgress: (progress: number) => set({ overallProgress: Math.max(0, Math.min(100, progress)) }),
        
        // Error & Notification Management
        addError: (error: ProcessingError) => {
          set(state => ({ 
            errors: [...state.errors, error]
          }))
        },
        
        removeError: (errorId: string) => {
          set(state => ({ 
            errors: state.errors.filter(error => error.id !== errorId)
          }))
        },
        
        clearErrors: () => set({ errors: [] }),
        
        addNotification: (notification: Omit<ProcessingNotification, 'id' | 'timestamp' | 'dismissed'>) => {
          const fullNotification: ProcessingNotification = {
            ...notification,
            id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            timestamp: new Date().toISOString(),
            dismissed: false
          }
          
          set(state => ({ 
            notifications: [...state.notifications, fullNotification]
          }))
        },
        
        dismissNotification: (notificationId: string) => {
          set(state => ({
            notifications: state.notifications.map(notification =>
              notification.id === notificationId
                ? { ...notification, dismissed: true }
                : notification
            )
          }))
        },
        
        clearNotifications: () => set({ notifications: [] }),
        
        // Data Processing Actions
        validateExcelData: (data: DieselExcelRow[]): ValidationResult => {
          const errors: Array<{field: string; message: string; value: any; rowNumber: number}> = []
          const warnings: Array<{field: string; message: string; value: any; rowNumber: number; suggestion?: string}> = []
          
          data.forEach((row, index) => {
            const rowNumber = index + 1
            
            // Required field validation
            if (!row.planta?.trim()) {
              errors.push({
                field: 'planta',
                message: 'Plant code is required',
                value: row.planta,
                rowNumber
              })
            }
            
            if (!row.litros_cantidad || isNaN(parseFloat(row.litros_cantidad))) {
              errors.push({
                field: 'litros_cantidad',
                message: 'Valid quantity in liters is required',
                value: row.litros_cantidad,
                rowNumber
              })
            }
            
            if (!['Entrada', 'Salida'].includes(row.tipo)) {
              errors.push({
                field: 'tipo',
                message: 'Transaction type must be "Entrada" or "Salida"',
                value: row.tipo,
                rowNumber
              })
            }
          })
          
          return {
            isValid: errors.length === 0,
            errors,
            warnings
          }
        },
        
        processDataBatch: async () => {
          // Implementation would call actual Supabase functions
          await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate processing
          return true
        },
        
        // Utility Actions
        reset: () => {
          set(state => ({
            ...initialState,
            batchHistory: state.batchHistory // Keep history
          }))
        },
        
        getProcessingSummary: () => {
          const state = get()
          return {
            totalRows: state.parsedData.length,
            processedRows: state.currentBatch?.processed_rows || 0,
            errorCount: state.errors.length,
            successRate: state.parsedData.length > 0 
              ? ((state.parsedData.length - state.errors.length) / state.parsedData.length) * 100 
              : 0,
            currentBatch: state.currentBatch
          }
        }
      })
    ),
    {
      name: 'DieselStore',
      trace: true,
      anonymousActionType: 'diesel-action',
    }
  )
)

// Store utilities for non-hook access
export const dieselStore = {
  getState: useDieselStore.getState,
  setState: useDieselStore.setState,
  subscribe: useDieselStore.subscribe,
  destroy: useDieselStore.destroy,
}

// **SOLUTION: Diesel-specific utilities**
export const dieselUtils = {
  // Initialize store with user context from auth store
  initializeWithUser: (userId: string) => {
    dieselStore.setState({ user: { id: userId } })
  },
  
  // Reset all diesel data (useful for dev/testing)
  resetAll: () => {
    const store = dieselStore.getState()
    store.reset()
    store.clearNotifications()
    store.clearErrors()
  },
  
  // Get processing statistics
  getProcessingStats: () => {
    const store = dieselStore.getState()
    return store.getProcessingSummary()
  },
  
  // Check if store is ready for operations
  isReady: () => {
    const { user, processingStatus } = dieselStore.getState()
    return user !== null && processingStatus !== 'processing'
  },
  
  // Advanced error handling
  handleCriticalError: (error: Error, context: string) => {
    console.error(`🚨 Critical Diesel Store Error [${context}]:`, error)
    
    const store = dieselStore.getState()
    store.addError({
      id: `critical-${Date.now()}`,
      batch_id: store.currentBatch?.batch_id || '',
      row_number: 0,
      error_type: 'database',
      error_message: `Critical error in ${context}: ${error.message}`,
      field_name: null,
      suggested_fix: 'Contact system administrator',
      severity: 'error',
      resolved: false,
      resolved_at: null,
      resolved_by: null
    })
    
    store.addNotification({
      type: 'error',
      title: 'Critical Error',
      message: `System error in ${context}. Please try again or contact support.`,
      action: {
        label: 'Reset',
        callback: () => dieselUtils.resetAll()
      }
    })
  },
  
  // Batch operation helpers
  canStartNewBatch: () => {
    const { processingStatus, currentBatch } = dieselStore.getState()
    return processingStatus === 'idle' && currentBatch === null
  },
  
  getCurrentBatchProgress: () => {
    const { currentBatch, overallProgress } = dieselStore.getState()
    if (!currentBatch) return null
    
    return {
      batchId: currentBatch.batch_id,
      filename: currentBatch.original_filename,
      totalRows: currentBatch.total_rows,
      processedRows: currentBatch.processed_rows,
      successfulRows: currentBatch.successful_rows,
      errorRows: currentBatch.error_rows,
      progress: overallProgress,
      status: currentBatch.status
    }
  },
  
  // Validation helpers
  validateStoreState: (): { isValid: boolean; issues: string[] } => {
    const state = dieselStore.getState()
    const issues: string[] = []
    
    if (!state.user) {
      issues.push('No user context set')
    }
    
    if (state.processingStatus === 'error' && state.errors.length === 0) {
      issues.push('Error status but no error records')
    }
    
    if (state.parsedData.length > 0 && !state.currentBatch) {
      issues.push('Parsed data exists but no batch created')
    }
    
    if (state.currentBatch && state.parsedData.length === 0) {
      issues.push('Batch exists but no parsed data')
    }
    
    return {
      isValid: issues.length === 0,
      issues
    }
  }
}

// **SOLUTION: Development utilities (only available in dev mode)**
if (process.env.NODE_ENV === 'development') {
  // Add to window for debugging
  if (typeof window !== 'undefined') {
    (window as any).dieselStore = dieselStore
    (window as any).dieselUtils = dieselUtils
  }
  
  // Add logging subscription for debugging
  useDieselStore.subscribe(
    (state) => state.processingStatus,
    (status, prevStatus) => {
      if (status !== prevStatus) {
        console.log(`🔄 Diesel Processing Status: ${prevStatus} → ${status}`)
      }
    }
  )
  
  useDieselStore.subscribe(
    (state) => state.errors,
    (errors) => {
      if (errors.length > 0) {
        console.log(`❌ Diesel Errors: ${errors.length} total`)
        errors.forEach(error => {
          if (!error.resolved) {
            console.error(`  • ${error.error_type}: ${error.error_message}`)
          }
        })
      }
    }
  )
}

// **SOLUTION: Cleanup on page unload**
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    // Save critical state before unload if needed
    const { currentBatch, processingStatus } = dieselStore.getState()
    
    if (currentBatch && processingStatus === 'processing') {
      console.warn('🚨 Page unloading during active processing')
      // In a real app, you might want to save state to localStorage
    }
  })
}

// Type-safe hooks for common operations
export const useDieselProcessingStatus = () => {
  return useDieselStore((state) => ({
    status: state.processingStatus,
    step: state.currentStep,
    progress: state.overallProgress
  }))
}

export const useDieselBatch = () => {
  return useDieselStore((state) => ({
    currentBatch: state.currentBatch,
    canStart: dieselUtils.canStartNewBatch(),
    progress: dieselUtils.getCurrentBatchProgress()
  }))
}

export const useDieselErrors = () => {
  return useDieselStore((state) => ({
    errors: state.errors.filter(e => !e.resolved),
    hasErrors: state.errors.some(e => !e.resolved),
    errorCount: state.errors.filter(e => !e.resolved).length
  }))
}

export const useDieselNotifications = () => {
  return useDieselStore((state) => ({
    notifications: state.notifications.filter(n => !n.dismissed),
    hasUnread: state.notifications.some(n => !n.dismissed),
    unreadCount: state.notifications.filter(n => !n.dismissed).length
  }))
}
