"use client"

import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

type ChecklistCompletionData = {
  month: string
  checklist_name: string
  total_scheduled: number
  completed: number
  completion_rate: number
}

export function ChecklistCompletionChart({ data }: { data: ChecklistCompletionData[] }) {
  const [chartData, setChartData] = useState<any[]>([])
  
  useEffect(() => {
    if (!data) return
    
    // Transformar los datos para agruparlos por mes
    const transformedData: any[] = []
    const monthGroups: Record<string, any> = {}
    
    data.forEach(item => {
      const monthKey = item.month
      if (!monthGroups[monthKey]) {
        monthGroups[monthKey] = {
          month: monthKey,
          monthLabel: format(parseISO(monthKey), 'MMMM yyyy', { locale: es }),
          total: 0,
          completed: 0
        }
      }
      
      monthGroups[monthKey].total += item.total_scheduled
      monthGroups[monthKey].completed += item.completed
    })
    
    Object.values(monthGroups).forEach(monthData => {
      const completionRate = (monthData.completed / monthData.total) * 100
      transformedData.push({
        ...monthData,
        completionRate: Math.round(completionRate * 100) / 100
      })
    })
    
    // Ordenar por fecha (más reciente primero)
    transformedData.sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())
    
    // Limitar a los últimos 6 meses
    setChartData(transformedData.slice(0, 6).reverse())
  }, [data])
  
  if (chartData.length === 0) {
    return <div className="flex justify-center items-center h-60">No hay datos disponibles</div>
  }
  
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="monthLabel" />
          <YAxis yAxisId="left" orientation="left" domain={[0, 100]} />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip formatter={(value, name) => {
            if (name === 'Tasa Completado') return [`${value}%`, name]
            return [value, name]
          }} />
          <Legend />
          <Bar yAxisId="right" dataKey="total" name="Total Programados" fill="#8884d8" />
          <Bar yAxisId="right" dataKey="completed" name="Completados" fill="#82ca9d" />
          <Bar yAxisId="left" dataKey="completionRate" name="Tasa Completado" fill="#ff7300" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
} 