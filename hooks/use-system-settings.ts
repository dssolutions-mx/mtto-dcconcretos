'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

interface SystemSettings {
  enable_onboarding_tour: boolean
  enable_policy_acknowledgment: boolean
  enable_compliance_system?: boolean
  [key: string]: boolean | number | string | Record<string, unknown> | undefined
}

/**
 * Hook to fetch and cache system settings (feature flags)
 * Settings are cached in memory to avoid repeated queries
 * Cache duration: 1 minute
 */
let settingsCache: SystemSettings | null = null
let settingsCacheTime: number = 0
const CACHE_DURATION = 60000 // 1 minute cache

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings | null>(settingsCache)
  const [loading, setLoading] = useState(!settingsCache)

  useEffect(() => {
    const fetchSettings = async () => {
      // Use cache if still valid
      const now = Date.now()
      if (settingsCache && (now - settingsCacheTime) < CACHE_DURATION) {
        setSettings(settingsCache)
        setLoading(false)
        return
      }

      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('system_settings')
          .select('key, value')
          .in('key', [
            'enable_onboarding_tour',
            'enable_policy_acknowledgment',
            'enable_compliance_system'
          ])

        if (error) throw error

        // Transform to object with safe defaults (all false = disabled)
        const settingsObj: SystemSettings = {
          enable_onboarding_tour: false,
          enable_policy_acknowledgment: false,
          enable_compliance_system: false,
        }

        if (data) {
          data.forEach((item: { key: string; value: unknown }) => {
            // Parse JSONB value - handle different formats
            let boolValue = false
            
            if (typeof item.value === 'boolean') {
              boolValue = item.value
            } else if (typeof item.value === 'string') {
              // Handle string values like "true" or '"true"'
              boolValue = item.value === 'true' || item.value === '"true"'
            } else if (typeof item.value === 'object' && item.value !== null) {
              // Handle JSONB string values like '"false"' or '"true"'
              const strValue = JSON.stringify(item.value)
              boolValue = strValue === '"true"' || strValue === 'true'
            }
            
            settingsObj[item.key] = boolValue
          })
        }

        // Update cache
        settingsCache = settingsObj
        settingsCacheTime = now
        setSettings(settingsObj)
      } catch (error) {
        console.error('Error fetching system settings:', error)
        // On error, use safe defaults (all disabled)
        const safeDefaults: SystemSettings = {
          enable_onboarding_tour: false,
          enable_policy_acknowledgment: false,
          enable_compliance_system: false,
        }
        setSettings(safeDefaults)
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  return {
    settings,
    loading,
    // Convenience getters with safe defaults (false = disabled)
    isOnboardingTourEnabled: settings?.enable_onboarding_tour ?? false,
    isPolicyAcknowledgmentEnabled: settings?.enable_policy_acknowledgment ?? false,
    isComplianceSystemEnabled: settings?.enable_compliance_system ?? false,
  }
}
