'use client'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

type DistributionMethod = 'percentage' | 'volume' | null

interface DistributionMethodToggleProps {
  value: DistributionMethod
  onChange: (value: DistributionMethod) => void
  disabled?: boolean
}

export function DistributionMethodToggle({
  value,
  onChange,
  disabled = false
}: DistributionMethodToggleProps) {
  return (
    <Tabs
      value={value || 'percentage'}
      onValueChange={(val) => onChange(val as DistributionMethod)}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="percentage" disabled={disabled}>
          Porcentaje
        </TabsTrigger>
        <TabsTrigger value="volume" disabled={disabled}>
          Por Volumen
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

