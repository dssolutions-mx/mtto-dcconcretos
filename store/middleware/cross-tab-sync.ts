import { StateCreator, StoreApi } from 'zustand'

export interface CrossTabConfig {
  channelName?: string
  syncKeys?: string[]
  enabled?: boolean
  maxTabs?: number
}

interface CrossTabMessage {
  type: 'STATE_UPDATE' | 'PING' | 'PONG' | 'TAB_REGISTER' | 'TAB_UNREGISTER'
  payload?: any
  timestamp: number
  source?: string
  tabId?: string
}

// **SOLUTION: Generate unique tab ID to prevent conflicts**
const generateTabId = () => `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

export const crossTabSync = <T extends object>(
  config: CrossTabConfig = {}
) => <S extends T>(
  stateCreator: StateCreator<S, [], [], S>
): StateCreator<S, [], [], S> => (set, get, api) => {
  const { 
    channelName = 'zustand-auth-sync', 
    syncKeys = ['user', 'profile', 'session'],
    enabled = true,
    maxTabs = 10
  } = config

  if (typeof window === 'undefined' || !enabled) {
    return stateCreator(set, get, api)
  }

  let channel: BroadcastChannel | null = null
  let ignoreNextUpdate = false
  let isInitializing = false
  const tabId = generateTabId()
  const activeTabs = new Set<string>()

  console.log(`🆔 Tab registered with ID: ${tabId}`)

  try {
    channel = new BroadcastChannel(channelName)

    // **SOLUTION: Register this tab and ping existing tabs**
    const registerTab = () => {
      if (channel) {
        activeTabs.add(tabId)
        channel.postMessage({
          type: 'TAB_REGISTER',
          timestamp: Date.now(),
          source: window.location.href,
          tabId
        } as CrossTabMessage)
        
        // Ping existing tabs to discover them
        channel.postMessage({
          type: 'PING',
          timestamp: Date.now(),
          source: window.location.href,
          tabId
        } as CrossTabMessage)
      }
    }

    // Listen for messages from other tabs
    channel.addEventListener('message', (event: MessageEvent<CrossTabMessage>) => {
      const { type, payload, timestamp, source, tabId: senderTabId } = event.data

      // **SOLUTION: Ignore messages from this tab**
      if (senderTabId === tabId) return

      switch (type) {
        case 'STATE_UPDATE':
          if (payload && source !== window.location.href && !isInitializing) {
            ignoreNextUpdate = true
            
            // Only update specified keys
            const filteredPayload = syncKeys.reduce((acc, key) => {
              if (key in payload) {
                acc[key] = payload[key]
              }
              return acc
            }, {} as any)

            // **SOLUTION: Only sync if we have meaningful data**
            const hasData = Object.values(filteredPayload).some(value => value !== null && value !== undefined)
            if (hasData) {
              api.setState(filteredPayload, false)
              console.log(`🔄 Cross-tab sync received from ${senderTabId}:`, filteredPayload)
            }
          }
          break

        case 'TAB_REGISTER':
          if (senderTabId) {
            activeTabs.add(senderTabId)
            console.log(`📝 Tab registered: ${senderTabId} (Total: ${activeTabs.size})`)
            
            // **SOLUTION: Limit number of tabs to prevent conflicts**
            if (activeTabs.size > maxTabs) {
              console.warn(`⚠️ Too many tabs (${activeTabs.size}), some features may be limited`)
            }
            
            // Send current state to new tab if we have data
            const state = get()
            const hasAuthData = state && (state as any).user && (state as any).session
            if (hasAuthData && channel) {
              const stateToSync = syncKeys.reduce((acc, key) => {
                if (key in state) {
                  acc[key] = state[key as keyof S]
                }
                return acc
              }, {} as any)
              
              setTimeout(() => {
                channel?.postMessage({
                  type: 'STATE_UPDATE',
                  payload: stateToSync,
                  timestamp: Date.now(),
                  source: window.location.href,
                  tabId
                } as CrossTabMessage)
              }, 100) // Small delay to ensure new tab is ready
            }
          }
          break

        case 'TAB_UNREGISTER':
          if (senderTabId) {
            activeTabs.delete(senderTabId)
            console.log(`📝 Tab unregistered: ${senderTabId} (Total: ${activeTabs.size})`)
          }
          break

        case 'PING':
          // Respond with PONG to let sender know we exist
          if (channel && senderTabId) {
            channel.postMessage({
              type: 'PONG',
              timestamp: Date.now(),
              source: window.location.href,
              tabId
            } as CrossTabMessage)
          }
          break

        case 'PONG':
          if (senderTabId) {
            activeTabs.add(senderTabId)
            console.log(`🏓 Received PONG from ${senderTabId}`)
          }
          break
      }
    })

    // Broadcast state changes
    const originalSet: typeof set = (...args) => {
      set(...args)
      
      if (!ignoreNextUpdate && channel && !isInitializing) {
        // Get updated state
        const state = get()
        
        // Filter state to only include sync keys
        const stateToSync = syncKeys.reduce((acc, key) => {
          if (key in state) {
            acc[key] = state[key as keyof S]
          }
          return acc
        }, {} as any)

        // **SOLUTION: Only broadcast if we have meaningful changes**
        const hasData = Object.values(stateToSync).some(value => value !== null && value !== undefined)
        if (hasData) {
          try {
            channel.postMessage({
              type: 'STATE_UPDATE',
              payload: stateToSync,
              timestamp: Date.now(),
              source: window.location.href,
              tabId
            } as CrossTabMessage)
          } catch (error) {
            console.warn('Failed to broadcast state update:', error)
          }
        }
      }
      
      ignoreNextUpdate = false
    }

    // **SOLUTION: Enhanced cleanup with proper tab unregistration**
    const cleanup = () => {
      if (channel) {
        // Notify other tabs that this tab is closing
        try {
          channel.postMessage({
            type: 'TAB_UNREGISTER',
            timestamp: Date.now(),
            source: window.location.href,
            tabId
          } as CrossTabMessage)
        } catch (error) {
          console.warn('Failed to send unregister message:', error)
        }
        
        channel.close()
        channel = null
      }
      activeTabs.clear()
      console.log(`🚪 Tab ${tabId} cleanup completed`)
    }

    // **SOLUTION: Set initialization flag during initial setup**
    const wrappedStateCreator = stateCreator(originalSet, get, api)
    
    // Register this tab after a short delay to ensure everything is set up
    setTimeout(() => {
      isInitializing = true
      registerTab()
      
      // Clear initialization flag after setup
      setTimeout(() => {
        isInitializing = false
        console.log(`✅ Tab ${tabId} initialization completed`)
      }, 1000)
    }, 100)

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', cleanup)
      window.addEventListener('unload', cleanup)
      window.addEventListener('pagehide', cleanup)
    }

    return wrappedStateCreator
  } catch (error) {
    console.warn('BroadcastChannel not supported or failed to initialize:', error)
    return stateCreator(set, get, api)
  }
}

// **SOLUTION: Enhanced hook for cross-tab communication with tab management**
export function useCrossTabSync() {
  if (typeof window === 'undefined') {
    return {
      sendPing: () => {},
      isSupported: false,
      tabCount: 0
    }
  }

  const channel = new BroadcastChannel('zustand-auth-sync')
  const activeTabs = new Set<string>()

  // Listen for tab registration messages to count active tabs
  channel.addEventListener('message', (event: MessageEvent<CrossTabMessage>) => {
    const { type, tabId } = event.data
    
    if (type === 'TAB_REGISTER' && tabId) {
      activeTabs.add(tabId)
    } else if (type === 'TAB_UNREGISTER' && tabId) {
      activeTabs.delete(tabId)
    }
  })

  const sendPing = () => {
    try {
      channel.postMessage({
        type: 'PING',
        timestamp: Date.now(),
        source: window.location.href,
        tabId: generateTabId()
      } as CrossTabMessage)
    } catch (error) {
      console.warn('Failed to send ping:', error)
    }
  }

  return {
    sendPing,
    isSupported: 'BroadcastChannel' in window,
    tabCount: activeTabs.size
  }
} 