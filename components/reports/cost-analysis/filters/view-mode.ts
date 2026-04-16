export type ViewMode = 'absolute' | 'perM3' | 'percentSales'

export const VIEW_MODE_LABEL: Record<ViewMode, string> = {
  absolute: 'Absoluto',
  perM3: 'Por m³',
  percentSales: '% ventas',
}

export type RangePreset = 'ytd' | '6m' | '12m' | 'custom'

export function computePresetRange(preset: Exclude<RangePreset, 'custom'>, today = new Date()): { from: string; to: string } {
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const to = `${yyyy}-${mm}`
  if (preset === 'ytd') return { from: `${yyyy}-01`, to }
  if (preset === '6m') {
    const d = new Date(today.getFullYear(), today.getMonth() - 5, 1)
    return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, to }
  }
  // 12m
  const d = new Date(today.getFullYear(), today.getMonth() - 11, 1)
  return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, to }
}
