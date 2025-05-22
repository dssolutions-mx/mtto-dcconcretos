"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, Loader2, Save, Settings } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { createBrowserClient } from '@supabase/ssr'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"

export function ChecklistScheduleForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const assetId = searchParams.get('asset')
  const maintenanceIntervalId = searchParams.get('maintenanceInterval')
  const templateId = searchParams.get('template')
  
  const [activeTab, setActiveTab] = useState("manual")
  const [isLoading, setIsLoading] = useState(false)
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [loadingAssets, setLoadingAssets] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingIntervals, setLoadingIntervals] = useState(false)
  const [loadingPlans, setLoadingPlans] = useState(false)
  
  const [templates, setTemplates] = useState<any[]>([])
  const [assets, setAssets] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [maintenanceIntervals, setMaintenanceIntervals] = useState<any[]>([])
  const [maintenancePlans, setMaintenancePlans] = useState<any[]>([])
  
  const [formData, setFormData] = useState({
    template_id: templateId || "",
    asset_id: assetId || "",
    scheduled_date: new Date(),
    assigned_to: "",
  })
  
  const [maintenanceFormData, setMaintenanceFormData] = useState({
    asset_id: assetId || "",
    model_id: "",
    frequency: "mensual",
    assigned_to: "",
    maintenance_interval_id: maintenanceIntervalId || "",
    maintenance_plan_id: "",
  })

  // Load asset model when asset is selected
  useEffect(() => {
    if (maintenanceFormData.asset_id) {
      const fetchAssetModel = async () => {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )
        
        try {
          const { data, error } = await supabase
            .from('assets')
            .select('model_id')
            .eq('id', maintenanceFormData.asset_id)
            .single()
          
          if (error) throw error
          
          if (data && data.model_id) {
            setMaintenanceFormData(prev => ({
              ...prev,
              model_id: data.model_id
            }))
            
            // Load maintenance intervals for this model
            fetchMaintenanceIntervals(data.model_id)
            
            // Load maintenance plans for this asset
            fetchMaintenancePlans(maintenanceFormData.asset_id)
          }
        } catch (error: any) {
          console.error('Error loading asset model:', error)
        }
      }
      
      fetchAssetModel()
    }
  }, [maintenanceFormData.asset_id])
  
  const fetchMaintenanceIntervals = async (modelId: string) => {
    if (!modelId) return
    
    setLoadingIntervals(true)
    
    try {
      const response = await fetch(`/api/models/${modelId}/maintenance-intervals`)
      
      if (!response.ok) {
        throw new Error(`Error fetching maintenance intervals: ${response.status}`)
      }
      
      const data = await response.json()
      setMaintenanceIntervals(data || [])
    } catch (error: any) {
      console.error('Error loading maintenance intervals:', error)
      toast.error('Error al cargar los intervalos de mantenimiento')
    } finally {
      setLoadingIntervals(false)
    }
  }
  
  const fetchMaintenancePlans = async (assetId: string) => {
    if (!assetId) return
    
    setLoadingPlans(true)
    
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      
      const { data, error } = await supabase
        .from('maintenance_plans')
        .select(`
          *,
          maintenance_intervals(name, type)
        `)
        .eq('asset_id', assetId)
        .order('next_due', { ascending: true })
      
      if (error) throw error
      
      setMaintenancePlans(data || [])
    } catch (error: any) {
      console.error('Error loading maintenance plans:', error)
      toast.error('Error al cargar los planes de mantenimiento')
    } finally {
      setLoadingPlans(false)
    }
  }
  
  useEffect(() => {
    const fetchTemplates = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      
      try {
        const { data, error } = await supabase
          .from('checklists')
          .select('id, name, frequency, equipment_models(name)')
          .order('name')
        
        if (error) throw error
        
        setTemplates(data || [])
      } catch (error: any) {
        console.error('Error loading templates:', error)
        toast.error('Error al cargar las plantillas')
      } finally {
        setLoadingTemplates(false)
      }
    }
    
    const fetchAssets = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      
      try {
        const { data, error } = await supabase
          .from('assets')
          .select('id, name, asset_id, location')
          .order('name')
        
        if (error) throw error
        
        setAssets(data || [])
      } catch (error: any) {
        console.error('Error loading assets:', error)
        toast.error('Error al cargar los activos')
      } finally {
        setLoadingAssets(false)
      }
    }
    
    const fetchUsers = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, nombre, apellido')
          .order('nombre')
        
        if (error) throw error
        
        setUsers(data || [])
      } catch (error: any) {
        console.error('Error loading users:', error)
        toast.error('Error al cargar los técnicos')
      } finally {
        setLoadingUsers(false)
      }
    }
    
    fetchTemplates()
    fetchAssets()
    fetchUsers()
  }, [])
  
  const handleFormChange = (field: string, value: any) => {
    setFormData({
      ...formData,
      [field]: value
    })
  }
  
  const handleMaintenanceFormChange = (field: string, value: any) => {
    // Convert "none" values to empty string/null for these specific fields
    if ((field === 'maintenance_plan_id' || field === 'maintenance_interval_id') && value === 'none') {
      setMaintenanceFormData({
        ...maintenanceFormData,
        [field]: ''
      })
    } else {
      setMaintenanceFormData({
        ...maintenanceFormData,
        [field]: value
      })
    }
  }
  
  const validateForm = () => {
    if (activeTab === "manual") {
      if (!formData.template_id) {
        toast.error('Debe seleccionar una plantilla')
        return false
      }
      
      if (!formData.asset_id) {
        toast.error('Debe seleccionar un activo')
        return false
      }
      
      if (!formData.assigned_to) {
        toast.error('Debe asignar un técnico')
        return false
      }
    } else {
      if (!maintenanceFormData.asset_id) {
        toast.error('Debe seleccionar un activo')
        return false
      }
      
      if (!maintenanceFormData.model_id) {
        toast.error('No se pudo determinar el modelo del activo')
        return false
      }
      
      if (!maintenanceFormData.assigned_to) {
        toast.error('Debe asignar un técnico')
        return false
      }
    }
    
    return true
  }
  
  const handleSubmit = async () => {
    if (!validateForm()) return
    
    setIsLoading(true)
    
    try {
      let response;
      let result;
      
      if (activeTab === "manual") {
        // Manual checklist creation
        response = await fetch('/api/checklists/schedules', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            schedule: {
              ...formData,
              scheduled_date: formData.scheduled_date.toISOString(),
            }
          }),
        })
        
        result = await response.json()
        
        if (!response.ok) {
          throw new Error(result.error || 'Error al programar checklist');
        }
      } else {
        // From maintenance interval
        console.log('Sending to API:', {
          assetId: maintenanceFormData.asset_id,
          modelId: maintenanceFormData.model_id,
          frequency: maintenanceFormData.frequency,
          assignedTo: maintenanceFormData.assigned_to,
          maintenanceIntervalId: maintenanceFormData.maintenance_interval_id || null,
          maintenancePlanId: maintenanceFormData.maintenance_plan_id || null
        });
        
        // Obtener el puerto actual para asegurarnos de que usamos el puerto correcto
        const currentPort = window.location.port;
        const baseUrl = `${window.location.protocol}//${window.location.hostname}${currentPort ? `:${currentPort}` : ''}`;
        
        response = await fetch(`${baseUrl}/api/checklists/schedules/from-maintenance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            assetId: maintenanceFormData.asset_id,
            modelId: maintenanceFormData.model_id,
            frequency: maintenanceFormData.frequency,
            assignedTo: maintenanceFormData.assigned_to,
            maintenanceIntervalId: maintenanceFormData.maintenance_interval_id || null,
            maintenancePlanId: maintenanceFormData.maintenance_plan_id || null
          }),
        })
        
        result = await response.json()
        
        if (!response.ok) {
          if (response.status === 404 && result.details) {
            // Handle the specific case where no templates are found
            console.error('Error details:', result.details);
            
            // Create a more user-friendly message
            let errorMessage = `No existen plantillas de checklist para ${maintenanceFormData.frequency}`;
            
            // If there are templates for this model but with different frequencies
            if (result.details.templatesForModel && result.details.templatesForModel.length > 0) {
              const frequencies = result.details.templatesForModel
                .map((t: any) => t.frequency)
                .filter((f: string, i: number, arr: string[]) => arr.indexOf(f) === i)
                .join(', ');
              
              errorMessage += `\nHay plantillas para este modelo con frecuencias: ${frequencies}`;
            }
            
            throw new Error(errorMessage);
          }
          throw new Error(result.error || 'Error al programar checklist');
        }
      }
      
      toast.success(activeTab === "manual" 
        ? 'Checklist programado exitosamente' 
        : `${result.count} checklists programados exitosamente`)
      
      // Determine where to redirect based on frequency
      let redirectPath = '/checklists'
      
      if (activeTab === "manual") {
        const selectedTemplate = templates.find(t => t.id === formData.template_id)
        
        if (selectedTemplate) {
          switch (selectedTemplate.frequency) {
            case 'semanal':
              redirectPath = '/checklists/semanales'
              break
            case 'mensual':
              redirectPath = '/checklists/mensuales'
              break
            case 'diario':
              redirectPath = '/checklists/diarios'
              break
          }
        }
      } else {
        // For maintenance-based checklists, redirect based on the selected frequency
        switch (maintenanceFormData.frequency) {
          case 'semanal':
            redirectPath = '/checklists/semanales'
            break
          case 'mensual':
            redirectPath = '/checklists/mensuales'
            break
          case 'diario':
            redirectPath = '/checklists/diarios'
            break
        }
      }
      
      router.push(redirectPath)
    } catch (error: any) {
      console.error('Error scheduling checklist:', error)
      toast.error(`Error al programar el checklist: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }
  
  const isLoaded = !loadingTemplates && !loadingAssets && !loadingUsers
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Programación de Checklist</CardTitle>
          <CardDescription>Programe un nuevo checklist para un activo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isLoaded ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="mb-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="manual">Manual</TabsTrigger>
                    <TabsTrigger value="maintenance">Desde Mantenimiento</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="manual" className="pt-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="templateSelection">Plantilla de Checklist</Label>
                      <Select 
                        value={formData.template_id} 
                        onValueChange={(value) => handleFormChange('template_id', value)}
                      >
                        <SelectTrigger id="templateSelection">
                          <SelectValue placeholder="Seleccionar plantilla" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((template) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name} - {template.frequency} 
                              {template.equipment_models ? ` (${template.equipment_models.name})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="assetSelection">Activo</Label>
                      <Select 
                        value={formData.asset_id} 
                        onValueChange={(value) => handleFormChange('asset_id', value)}
                      >
                        <SelectTrigger id="assetSelection">
                          <SelectValue placeholder="Seleccionar activo" />
                        </SelectTrigger>
                        <SelectContent>
                          {assets.map((asset) => (
                            <SelectItem key={asset.id} value={asset.id}>
                              {asset.name} - {asset.asset_id} ({asset.location})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="dateSelection">Fecha Programada</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            id="dateSelection"
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !formData.scheduled_date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.scheduled_date ? (
                              format(formData.scheduled_date, "PPP", { locale: es })
                            ) : (
                              <span>Seleccionar fecha</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={formData.scheduled_date}
                            onSelect={(date) => handleFormChange('scheduled_date', date)}
                            initialFocus
                            locale={es}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="technicianSelection">Técnico Asignado</Label>
                      <Select 
                        value={formData.assigned_to} 
                        onValueChange={(value) => handleFormChange('assigned_to', value)}
                      >
                        <SelectTrigger id="technicianSelection">
                          <SelectValue placeholder="Seleccionar técnico" />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.nombre} {user.apellido}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="maintenance" className="pt-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="maintenanceAssetSelection">Activo</Label>
                      <Select 
                        value={maintenanceFormData.asset_id} 
                        onValueChange={(value) => handleMaintenanceFormChange('asset_id', value)}
                      >
                        <SelectTrigger id="maintenanceAssetSelection">
                          <SelectValue placeholder="Seleccionar activo" />
                        </SelectTrigger>
                        <SelectContent>
                          {assets.map((asset) => (
                            <SelectItem key={asset.id} value={asset.id}>
                              {asset.name} - {asset.asset_id} ({asset.location})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {maintenanceFormData.model_id && maintenancePlans.length > 0 && (
                      <div className="space-y-2">
                        <Label htmlFor="maintenancePlanSelection">Plan de Mantenimiento</Label>
                        <Select 
                          value={maintenanceFormData.maintenance_plan_id || "none"} 
                          onValueChange={(value) => handleMaintenanceFormChange('maintenance_plan_id', value)}
                        >
                          <SelectTrigger id="maintenancePlanSelection">
                            <SelectValue placeholder="Seleccionar plan de mantenimiento (opcional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Ninguno (crear checklist independiente)</SelectItem>
                            {loadingPlans ? (
                              <SelectItem value="loading" disabled>Cargando planes...</SelectItem>
                            ) : (
                              maintenancePlans.map((plan) => (
                                <SelectItem key={plan.id} value={plan.id}>
                                  {plan.name} - {plan.maintenance_intervals?.name || 'Plan personalizado'}
                                  {plan.next_due ? ` (Próx: ${new Date(plan.next_due).toLocaleDateString()})` : ''}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <Label htmlFor="frequencySelection">Frecuencia</Label>
                      <Select 
                        value={maintenanceFormData.frequency} 
                        onValueChange={(value) => handleMaintenanceFormChange('frequency', value)}
                      >
                        <SelectTrigger id="frequencySelection">
                          <SelectValue placeholder="Seleccionar frecuencia" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="diario">Diario</SelectItem>
                          <SelectItem value="semanal">Semanal</SelectItem>
                          <SelectItem value="mensual">Mensual</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        La frecuencia determina qué tipo de plantillas se utilizarán. Se buscarán plantillas que coincidan con el modelo, la frecuencia y el intervalo de mantenimiento.
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="maintenanceIntervalSelection">Intervalo de Mantenimiento</Label>
                      <Select 
                        value={maintenanceFormData.maintenance_interval_id || "none"} 
                        onValueChange={(value) => handleMaintenanceFormChange('maintenance_interval_id', value)}
                        disabled={loadingIntervals || maintenanceIntervals.length === 0}
                      >
                        <SelectTrigger id="maintenanceIntervalSelection">
                          <SelectValue placeholder={
                            loadingIntervals 
                              ? "Cargando intervalos..." 
                              : maintenanceIntervals.length === 0 
                                ? "No hay intervalos disponibles para este modelo" 
                                : "Seleccionar intervalo"
                          } />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Ninguno (crear checklist independiente)</SelectItem>
                          {loadingIntervals ? (
                            <SelectItem value="loading" disabled>Cargando intervalos...</SelectItem>
                          ) : (
                            maintenanceIntervals.map((interval) => (
                              <SelectItem key={interval.id} value={interval.id}>
                                {interval.name} ({interval.interval_value} horas)
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        Seleccionando un intervalo específico, se buscarán plantillas asociadas a ese intervalo. Si no hay plantillas con el intervalo específico, se usarán plantillas genéricas con la misma frecuencia.
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="maintenanceTechnicianSelection">Técnico Asignado</Label>
                      <Select 
                        value={maintenanceFormData.assigned_to} 
                        onValueChange={(value) => handleMaintenanceFormChange('assigned_to', value)}
                      >
                        <SelectTrigger id="maintenanceTechnicianSelection">
                          <SelectValue placeholder="Seleccionar técnico" />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.nombre} {user.apellido}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <Card className="bg-blue-50 border-blue-200 mt-4">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base text-blue-700">Programación Automática</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-blue-700">
                          Al programar desde mantenimiento, el sistema buscará todas las plantillas de checklist aplicables para:
                        </p>
                        <ul className="text-sm text-blue-700 list-disc pl-5 pt-2 space-y-1">
                          <li>El modelo del activo seleccionado</li>
                          <li>La frecuencia especificada (diario, semanal, mensual)</li>
                          {maintenanceFormData.maintenance_interval_id && <li>El intervalo de mantenimiento seleccionado</li>}
                        </ul>
                        <p className="text-sm text-blue-700 mt-2">
                          Si selecciona un plan de mantenimiento, las fechas se alinearán con el próximo mantenimiento programado.
                        </p>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleSubmit} disabled={isLoading || !isLoaded}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Programando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Programar Checklist
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 