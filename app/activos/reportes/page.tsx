'use client';

import { useState, useEffect } from 'react';
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  FileSpreadsheet, 
  Download, 
  BarChart3, 
  Calendar as CalendarIcon,
  Plus,
  Minus,
  AlertCircle,
  Loader2,
  Filter,
  Search,
  TrendingUp,
  Activity
} from "lucide-react";
import { format, subDays, subMonths, subYears } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase";
import { AssetReportAnalytics } from "@/components/assets/asset-report-analytics";

interface Asset {
  id: string;
  name: string;
  asset_id: string;
  current_hours: number | null;
  current_kilometers: number | null;
  status: string;
  location: string;
  department: string;
  model: string;
  plants?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface CustomParameter {
  id: string;
  name: string;
  unit: string;
  description: string;
}

interface AssetParameter {
  assetId: string;
  parameterId: string;
  value: string;
}

interface ReportFilters {
  dateFrom: Date | null;
  dateTo: Date | null;
  includeCompletedChecklists: boolean;
  includeMaintenanceHistory: boolean;
  includeCurrentReadings: boolean;
  fuelCost: number; // Cost per liter of fuel
}

const PREDEFINED_PARAMETERS = [
  { name: 'Producción Total', unit: 'm³', description: 'Metros cúbicos producidos por este activo' },
  { name: 'Consumo de Diesel', unit: 'L', description: 'Litros de diesel consumidos por este activo' },
  { name: 'Material Procesado', unit: 'ton', description: 'Toneladas de material procesado' },
  { name: 'Carga Transportada', unit: 'ton', description: 'Toneladas de carga transportada' },
  { name: 'Productos Manufacturados', unit: 'unidades', description: 'Cantidad de productos o piezas producidas' },
  { name: 'Consumo de Energía', unit: 'kWh', description: 'Kilovatios-hora consumidos' },
];

export default function AssetReportsPage() {
  const { toast } = useToast();
  
  // Data state
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [customParameters, setCustomParameters] = useState<CustomParameter[]>([]);
  const [assetParameters, setAssetParameters] = useState<AssetParameter[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [reportFilters, setReportFilters] = useState<ReportFilters>({
    dateFrom: subMonths(new Date(), 3), // Last 3 months by default
    dateTo: new Date(),
    includeCompletedChecklists: true,
    includeMaintenanceHistory: true,
    includeCurrentReadings: true,
    fuelCost: 4.5, // Default fuel cost per liter
  });
  
  // UI state
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  // Fetch assets on component mount
  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('assets')
        .select(`
          id,
          name,
          asset_id,
          current_hours,
          current_kilometers,
          status,
          location,
          department,
          equipment_models(name, manufacturer),
          plants(name, code)
        `)
        .order('name');

      if (error) throw error;

      const formattedAssets = data.map((asset: any) => ({
        ...asset,
        model: asset.equipment_models?.name || 'Sin modelo',
        plant: asset.plants?.name || 'Sin planta'
      }));

      setAssets(formattedAssets);
    } catch (err) {
      console.error('Error fetching assets:', err);
      setError('Error al cargar los activos');
      toast({
        title: "Error",
        description: "No se pudieron cargar los activos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter assets based on search and filters
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.asset_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || asset.status === statusFilter;
    const matchesLocation = locationFilter === 'all' || asset.plants?.code === locationFilter;
    
    return matchesSearch && matchesStatus && matchesLocation;
  });

  // Handle asset selection
  const toggleAssetSelection = (assetId: string) => {
    const newSelection = new Set(selectedAssets);
    if (newSelection.has(assetId)) {
      newSelection.delete(assetId);
    } else {
      newSelection.add(assetId);
    }
    setSelectedAssets(newSelection);
  };

  const selectAllAssets = () => {
    setSelectedAssets(new Set(filteredAssets.map(asset => asset.id)));
  };

  const selectAllAssetsInSystem = () => {
    setSelectedAssets(new Set(assets.map(asset => asset.id)));
  };

  const clearSelection = () => {
    setSelectedAssets(new Set());
  };

  // Handle custom parameters
  const addCustomParameter = (predefined?: typeof PREDEFINED_PARAMETERS[0]) => {
    const newParam: CustomParameter = {
      id: Math.random().toString(36).substr(2, 9),
      name: predefined?.name || '',
      unit: predefined?.unit || '',
      description: predefined?.description || ''
    };
    setCustomParameters([...customParameters, newParam]);
  };

  const updateCustomParameter = (id: string, field: keyof CustomParameter, value: string) => {
    setCustomParameters(params => 
      params.map(param => 
        param.id === id ? { ...param, [field]: value } : param
      )
    );
  };

  const removeCustomParameter = (id: string) => {
    setCustomParameters(params => params.filter(param => param.id !== id));
    // Also remove all asset parameters for this parameter
    setAssetParameters(assetParams => 
      assetParams.filter(assetParam => assetParam.parameterId !== id)
    );
  };

  // Handle asset-specific parameter values
  const updateAssetParameter = (assetId: string, parameterId: string, value: string) => {
    setAssetParameters(params => {
      const existingIndex = params.findIndex(p => p.assetId === assetId && p.parameterId === parameterId);
      if (existingIndex >= 0) {
        const newParams = [...params];
        newParams[existingIndex] = { assetId, parameterId, value };
        return newParams;
      } else {
        return [...params, { assetId, parameterId, value }];
      }
    });
  };

  const getAssetParameterValue = (assetId: string, parameterId: string): string => {
    const param = assetParameters.find(p => p.assetId === assetId && p.parameterId === parameterId);
    return param?.value || '';
  };

  // Generate Excel report
  const generateExcelReport = async () => {
    if (selectedAssets.size === 0) {
      toast({
        title: "Sin selección",
        description: "Debe seleccionar al menos un activo para generar el reporte",
        variant: "destructive"
      });
      return;
    }

    try {
      setGenerating(true);
      
      const requestBody = {
        assetIds: Array.from(selectedAssets),
        dateFrom: reportFilters.dateFrom?.toISOString(),
        dateTo: reportFilters.dateTo?.toISOString(),
        filters: reportFilters,
        customParameters: customParameters.filter(p => p.name),
        assetParameters: assetParameters,
        fuelCost: reportFilters.fuelCost
      };

      const response = await fetch('/api/assets/reports/excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Error al generar el reporte');
      }

      // Download the Excel file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `reporte-activos-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Reporte generado",
        description: "El archivo Excel se ha descargado exitosamente",
      });

    } catch (err) {
      console.error('Error generating report:', err);
      toast({
        title: "Error",
        description: "No se pudo generar el reporte Excel",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  // Generate analytics report
  const generateAnalytics = async () => {
    if (selectedAssets.size === 0) {
      toast({
        title: "Sin selección",
        description: "Debe seleccionar al menos un activo para generar el análisis",
        variant: "destructive"
      });
      return;
    }

    try {
      setGenerating(true);
      
      const requestBody = {
        assetIds: Array.from(selectedAssets),
        dateFrom: reportFilters.dateFrom?.toISOString(),
        dateTo: reportFilters.dateTo?.toISOString(),
        filters: reportFilters,
        customParameters: customParameters.filter(p => p.name),
        assetParameters: assetParameters,
        fuelCost: reportFilters.fuelCost
      };

      const response = await fetch('/api/assets/reports/analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error('Error al generar el análisis');
      }

      const data = await response.json();
      setReportData(data);
      setShowAnalytics(true);

      toast({
        title: "Análisis generado",
        description: "Los datos de análisis están listos para visualizar",
      });

    } catch (err) {
      console.error('Error generating analytics:', err);
      toast({
        title: "Error",
        description: "No se pudo generar el análisis",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  // Get unique values for filters
  const uniqueStatuses = [...new Set(assets.map(asset => asset.status))];
  const uniqueLocations = [...new Set(assets.map(asset => asset.plants?.code).filter((code): code is string => Boolean(code)))];

  if (loading) {
    return (
      <DashboardShell>
        <DashboardHeader
          heading="Reportes de Activos"
          text="Cargando activos..."
        />
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardShell>
    );
  }

  if (showAnalytics && reportData) {
    return (
      <AssetReportAnalytics
        data={reportData}
        onBack={() => setShowAnalytics(false)}
        customParameters={customParameters}
        assetParameters={assetParameters}
      />
    );
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading="Reportes de Activos"
        text="Genere reportes personalizados de horas, kilómetros y parámetros operacionales"
      />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Asset Selection Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros y Selección
              </CardTitle>
              <CardDescription>
                Filtre y seleccione los activos para incluir en el reporte
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Buscar activos</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Nombre o ID del activo..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      {uniqueStatuses.map(status => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Planta</Label>
                  <Select value={locationFilter} onValueChange={setLocationFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las plantas</SelectItem>
                      {uniqueLocations.map(location => (
                        <SelectItem key={location} value={location}>
                          {location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {selectedAssets.size} de {assets.length} activos seleccionados
                </div>
                <div className="space-x-2">
                  <Button variant="outline" size="sm" onClick={selectAllAssets}>
                    Seleccionar filtrados ({filteredAssets.length})
                  </Button>
                  <Button variant="outline" size="sm" onClick={selectAllAssetsInSystem}>
                    Seleccionar todos ({assets.length})
                  </Button>
                  <Button variant="outline" size="sm" onClick={clearSelection}>
                    Limpiar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Asset List */}
          <Card>
            <CardHeader>
              <CardTitle>Lista de Activos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className={cn(
                      "flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedAssets.has(asset.id) 
                        ? "border-blue-500 bg-blue-50" 
                        : "border-gray-200 hover:bg-gray-50"
                    )}
                    onClick={() => toggleAssetSelection(asset.id)}
                  >
                    <Checkbox
                      checked={selectedAssets.has(asset.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {asset.name}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {asset.asset_id}
                        </Badge>
                      </div>
                                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{asset.model}</span>
                          <span>{asset.plants?.code || 'Sin planta'}</span>
                          <span>{asset.current_hours || 0}h</span>
                          <span>{asset.current_kilometers || 0}km</span>
                        </div>
                    </div>
                    <Badge 
                      variant={asset.status === 'Operativo' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {asset.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Configuration Panel */}
        <div className="space-y-6">
          {/* Automatic Data Info */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800">
                <Activity className="h-5 w-5" />
                Datos Automáticos Incluidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-blue-700 space-y-1">
                <p>✅ <strong>Horas de operación:</strong> Desde lecturas de checklists y mantenimientos</p>
                <p>✅ <strong>Kilómetros recorridos:</strong> Calculado automáticamente por período</p>
                <p>✅ <strong>Mantenimientos realizados:</strong> Cantidad y costos del sistema</p>
                <p>✅ <strong>Eficiencia y disponibilidad:</strong> Métricas calculadas automáticamente</p>
              </div>
            </CardContent>
          </Card>

          {/* Date Range */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Rango de Fechas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Fecha desde</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !reportFilters.dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {reportFilters.dateFrom ? (
                        format(reportFilters.dateFrom, "dd/MM/yyyy", { locale: es })
                      ) : (
                        "Seleccionar fecha"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={reportFilters.dateFrom || undefined}
                      onSelect={(date) => setReportFilters(prev => ({ ...prev, dateFrom: date || null }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Fecha hasta</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !reportFilters.dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {reportFilters.dateTo ? (
                        format(reportFilters.dateTo, "dd/MM/yyyy", { locale: es })
                      ) : (
                        "Seleccionar fecha"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={reportFilters.dateTo || undefined}
                      onSelect={(date) => setReportFilters(prev => ({ ...prev, dateTo: date || null }))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Costo de combustible por litro ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={reportFilters.fuelCost}
                  onChange={(e) => setReportFilters(prev => ({ 
                    ...prev, 
                    fuelCost: parseFloat(e.target.value) || 0 
                  }))}
                  placeholder="4.50"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Este valor se utilizará para calcular los costos operacionales por unidad de producción
                </p>
              </div>

              <div className="space-y-3">
                <Label>Fuentes de datos</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeChecklists"
                      checked={reportFilters.includeCompletedChecklists}
                      onCheckedChange={(checked) => 
                        setReportFilters(prev => ({ ...prev, includeCompletedChecklists: !!checked }))
                      }
                    />
                    <Label htmlFor="includeChecklists" className="text-sm">
                      Checklists completados
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeMaintenance"
                      checked={reportFilters.includeMaintenanceHistory}
                      onCheckedChange={(checked) => 
                        setReportFilters(prev => ({ ...prev, includeMaintenanceHistory: !!checked }))
                      }
                    />
                    <Label htmlFor="includeMaintenance" className="text-sm">
                      Historial de mantenimiento
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeCurrent"
                      checked={reportFilters.includeCurrentReadings}
                      onCheckedChange={(checked) => 
                        setReportFilters(prev => ({ ...prev, includeCurrentReadings: !!checked }))
                      }
                    />
                    <Label htmlFor="includeCurrent" className="text-sm">
                      Lecturas actuales
                    </Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Custom Parameters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Parámetros Personalizados
              </CardTitle>
              <CardDescription>
                Agregue métricas adicionales para análisis completo. 
                <strong>Nota:</strong> Las horas de operación y kilómetros recorridos se incluyen automáticamente desde el sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Predefined parameters quick add */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Parámetros comunes</Label>
                <div className="grid grid-cols-1 gap-2">
                  {PREDEFINED_PARAMETERS.map((param, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="justify-start text-left h-auto p-2"
                      onClick={() => addCustomParameter(param)}
                    >
                      <Plus className="h-3 w-3 mr-2 flex-shrink-0" />
                      <div className="text-left">
                        <div className="text-xs font-medium">{param.name}</div>
                        <div className="text-xs text-muted-foreground">{param.description}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

                        {/* Custom parameters list */}
          <div className="space-y-4">
            {customParameters.map((param) => (
              <Card key={param.id} className="p-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2 flex-1">
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Nombre del parámetro"
                          value={param.name}
                          onChange={(e) => updateCustomParameter(param.id, 'name', e.target.value)}
                          className="text-sm font-medium"
                        />
                        <Input
                          placeholder="Unidad"
                          value={param.unit}
                          onChange={(e) => updateCustomParameter(param.id, 'unit', e.target.value)}
                          className="text-sm"
                        />
                      </div>
                      <Input
                        placeholder="Descripción (opcional)"
                        value={param.description}
                        onChange={(e) => updateCustomParameter(param.id, 'description', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCustomParameter(param.id)}
                      className="ml-2 text-red-600 hover:text-red-700"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Values per asset */}
                  {param.name && selectedAssets.size > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Valores por activo:
                      </Label>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {Array.from(selectedAssets).map(assetId => {
                          const asset = assets.find(a => a.id === assetId);
                          return asset ? (
                            <div key={assetId} className="flex items-center gap-2 text-sm">
                              <span className="min-w-0 flex-1 truncate">
                                {asset.asset_id}:
                              </span>
                              <Input
                                placeholder={`${param.unit || 'valor'}`}
                                value={getAssetParameterValue(assetId, param.id)}
                                onChange={(e) => updateAssetParameter(assetId, param.id, e.target.value)}
                                className="w-24 h-7 text-xs"
                              />
                              <span className="text-xs text-muted-foreground min-w-8">
                                {param.unit}
                              </span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>

              <Button
                variant="outline"
                onClick={() => addCustomParameter()}
                className="w-full"
                size="sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Agregar parámetro personalizado
              </Button>
            </CardContent>
          </Card>

          {/* Generate Reports */}
          <Card>
            <CardHeader>
              <CardTitle>Generar Reportes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={generateExcelReport}
                disabled={generating || selectedAssets.size === 0}
                className="w-full"
                size="lg"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Generar Excel
                  </>
                )}
              </Button>

              <Button
                onClick={generateAnalytics}
                disabled={generating || selectedAssets.size === 0}
                variant="outline"
                className="w-full"
                size="lg"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Ver Análisis
                  </>
                )}
              </Button>

              {selectedAssets.size === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Seleccione al menos un activo para generar reportes
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}