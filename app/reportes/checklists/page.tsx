import { Metadata } from "next"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChecklistCompletionChart } from "@/components/checklists/checklist-completion-chart"
import { CommonIssuesTable } from "@/components/checklists/common-issues-table"
import { AssetInspectionTable } from "@/components/checklists/asset-inspection-table"

export const metadata: Metadata = {
  title: "Informes de Checklists | Sistema de Mantenimiento",
  description: "Análisis e informes sobre inspecciones y detección de problemas",
}

export default async function ChecklistReportsPage() {
  const cookieStore = cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Ignorar errores en componentes del servidor
          }
        },
      },
    }
  )
  
  // Obtener estadísticas de completado mensual
  const { data: completionRates } = await supabase
    .from('checklist_completion_rate')
    .select('*')
    .order('month', { ascending: false })
    .limit(12)
  
  // Obtener problemas más comunes
  const { data: commonIssues } = await supabase
    .from('common_checklist_issues')
    .select('*')
    .limit(10)
  
  // Obtener activos sin inspección reciente
  const { data: assetsWithoutInspection } = await supabase
    .from('active_assets_without_recent_inspection')
    .select('*')
    .order('days_since_last_inspection', { ascending: false })
    .limit(20)
    
  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-3xl font-bold">Informes de Checklists</h1>
      
      <Tabs defaultValue="completion" className="w-full">
        <TabsList className="grid w-full md:w-[600px] grid-cols-3">
          <TabsTrigger value="completion">Tasa de Completado</TabsTrigger>
          <TabsTrigger value="issues">Problemas Comunes</TabsTrigger>
          <TabsTrigger value="assets">Activos sin Inspección</TabsTrigger>
        </TabsList>
        
        <TabsContent value="completion" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Tasa de Completado de Checklists</CardTitle>
            </CardHeader>
            <CardContent>
              <ChecklistCompletionChart data={completionRates || []} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="issues" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Problemas Más Comunes Detectados</CardTitle>
            </CardHeader>
            <CardContent>
              <CommonIssuesTable issues={commonIssues || []} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="assets" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Activos sin Inspección Reciente</CardTitle>
            </CardHeader>
            <CardContent>
              <AssetInspectionTable assets={assetsWithoutInspection || []} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 