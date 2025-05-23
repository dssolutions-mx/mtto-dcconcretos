'use client';

import { useState, useMemo, useEffect, use } from "react";
import { useAsset } from "@/hooks/useSupabase";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { ArrowLeft, FileText, History, Wrench, Calendar, Edit, Camera, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Asset, AssetWithModel, EquipmentModel } from "@/types";

// Define category type
type CategoryInfo = {
  label: string;
  color: string;
  icon: string;
};

type CategoryMap = {
  [key: string]: CategoryInfo;
};

// Map of category codes to more readable names and styling
const PHOTO_CATEGORIES: CategoryMap = {
  'frontal': { label: 'Vista Frontal', color: 'bg-blue-500', icon: '🔍' },
  'trasera': { label: 'Vista Trasera', color: 'bg-green-500', icon: '🔍' },
  'lateral': { label: 'Vista Lateral', color: 'bg-yellow-500', icon: '🔍' },
  'interior': { label: 'Interior', color: 'bg-purple-500', icon: '🏠' },
  'motor': { label: 'Motor', color: 'bg-red-500', icon: '⚙️' },
  'placa': { label: 'Placa/Serial', color: 'bg-indigo-500', icon: '🔢' },
  'detalles': { label: 'Detalles', color: 'bg-orange-500', icon: '🔎' },
  'daños': { label: 'Daños/Problemas', color: 'bg-red-700', icon: '⚠️' },
  'otros': { label: 'Otros', color: 'bg-gray-500', icon: '📷' },
};

export default function AssetDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  // Unwrap params using React.use()
  const resolvedParams = use(params);
  const assetId = resolvedParams.id;
  
  const { asset: rawAsset, loading, error } = useAsset(assetId);
  const [activeTab, setActiveTab] = useState("general");
  
  // Map the asset with equipment_models to use model property
  const asset = useMemo(() => {
    if (!rawAsset) return null;
    
    const assetWithModel: AssetWithModel = {
      ...rawAsset,
      model: (rawAsset as any).equipment_models as EquipmentModel
    };
    
    return assetWithModel;
  }, [rawAsset]);
  
  // Función para mostrar el estado con un color adecuado
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "operational":
        return <Badge className="bg-green-500">Operativo</Badge>
      case "maintenance":
        return <Badge className="bg-yellow-500">En Mantenimiento</Badge>
      case "repair":
        return <Badge className="bg-red-500">En Reparación</Badge>
      case "inactive":
        return <Badge variant="outline">Inactivo</Badge>
      default:
        return <Badge variant="secondary">{status || "Desconocido"}</Badge>
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No disponible";
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", { locale: es });
  }

  return (
    <DashboardShell>
      <DashboardHeader
        heading={loading ? "Cargando activo..." : `${asset?.name || "Activo"}`}
        text={loading ? "" : `Detalles e información del activo ${asset?.asset_id || ""}`}
      >
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/activos">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
          {!loading && (
            <>
              <Button variant="outline" asChild>
                <Link href={`/activos/${assetId}/editar`}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/activos/${assetId}/mantenimiento`}>
                  <Wrench className="mr-2 h-4 w-4" />
                  Mantenimiento
                </Link>
              </Button>
            </>
          )}
        </div>
      </DashboardHeader>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>Error al cargar los datos del activo: {error.message}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-48" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <Tabs defaultValue="general" className="w-full" onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start mb-4">
              <TabsTrigger value="general">Información General</TabsTrigger>
              <TabsTrigger value="technical">Datos Técnicos</TabsTrigger>
              <TabsTrigger value="documentation">Documentación</TabsTrigger>
              <TabsTrigger value="financial">Información Financiera</TabsTrigger>
            </TabsList>
            
            <TabsContent value="general" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>Información General</CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Estado:</span>
                      {getStatusBadge(asset?.status || "")}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <dl className="space-y-4">
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">ID de Activo</dt>
                          <dd className="text-lg">{asset?.asset_id}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Nombre</dt>
                          <dd className="text-lg">{asset?.name}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Modelo</dt>
                          <dd className="text-lg">{asset?.model?.name || "No especificado"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Fabricante</dt>
                          <dd className="text-lg">{asset?.model?.manufacturer || "No especificado"}</dd>
                        </div>
                      </dl>
                    </div>
                    <div>
                      <dl className="space-y-4">
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Ubicación</dt>
                          <dd className="text-lg">{asset?.location || "No especificada"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Departamento</dt>
                          <dd className="text-lg">{asset?.department || "No especificado"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Fecha de Instalación</dt>
                          <dd className="text-lg">{formatDate(asset?.installation_date || null)}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Última Actualización</dt>
                          <dd className="text-lg">{formatDate(asset?.updated_at || null)}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col md:flex-row gap-4">
                <Card className="flex-1">
                  <CardHeader>
                    <CardTitle>Próximo Mantenimiento</CardTitle>
                    <CardDescription>Información sobre el próximo servicio programado</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-muted-foreground">Tipo:</p>
                        <p className="font-medium">Mantenimiento preventivo</p>
                      </div>
                      <Link href={`/activos/${assetId}/mantenimiento`}>
                        <Button variant="outline" size="sm">
                          <Calendar className="h-4 w-4 mr-2" />
                          Ver calendario
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="flex-1">
                  <CardHeader>
                    <CardTitle>Historial</CardTitle>
                    <CardDescription>Historial de mantenimientos e incidentes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-muted-foreground">Último mantenimiento:</p>
                        <p className="font-medium">{formatDate(asset?.last_maintenance_date || null)}</p>
                      </div>
                      <Link href={`/activos/${assetId}/historial`}>
                        <Button variant="outline" size="sm">
                          <History className="h-4 w-4 mr-2" />
                          Ver historial
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            <TabsContent value="technical" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Especificaciones Técnicas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <dl className="space-y-4">
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Número de Serie</dt>
                          <dd className="text-lg">{asset?.serial_number || "No especificado"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Unidad de Mantenimiento</dt>
                          <dd className="text-lg">{asset?.model?.maintenance_unit || "No especificada"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Horas Iniciales</dt>
                          <dd className="text-lg">{asset?.initial_hours !== null ? `${asset?.initial_hours} horas` : "No especificadas"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Horas Actuales</dt>
                          <dd className="text-lg">{asset?.current_hours !== null ? `${asset?.current_hours} horas` : "No especificadas"}</dd>
                        </div>
                      </dl>
                    </div>
                    <div>
                      <dl className="space-y-4">
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Kilómetros Iniciales</dt>
                          <dd className="text-lg">{asset?.initial_kilometers !== null ? `${asset?.initial_kilometers} km` : "No aplicable"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Kilómetros Actuales</dt>
                          <dd className="text-lg">{asset?.current_kilometers !== null ? `${asset?.current_kilometers} km` : "No aplicable"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Categoría</dt>
                          <dd className="text-lg">{asset?.model?.category || "No especificada"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Año de Introducción</dt>
                          <dd className="text-lg">{asset?.model?.year_introduced || "No especificado"}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                  
                  {asset?.notes && (
                    <>
                      <Separator className="my-6" />
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Notas Adicionales</h4>
                        <p className="text-sm">{asset.notes}</p>
                      </div>
                    </>
                  )}
                  
                  {asset?.photos && asset.photos.length > 0 && (
                    <>
                      <Separator className="my-6" />
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-4">Fotografías del Activo</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {asset.photos.map((photoUrl, index) => {
                            // Extract category from filename (if present)
                            const categoryMatch = photoUrl.match(/\/(\d+)-([^\/]+)-([^\/]+\.[^\/]+)$/);
                            const categoryCode = categoryMatch ? categoryMatch[2] : "otros";
                            const categoryInfo = PHOTO_CATEGORIES[categoryCode] || PHOTO_CATEGORIES.otros;
                            
                            // Extract original filename for additional context
                            const filename = categoryMatch ? categoryMatch[3] : photoUrl.split('/').pop() || "";
                            
                            return (
                              <div key={index} className="relative border rounded-lg overflow-hidden group">
                                <div className="absolute top-2 left-2 z-10">
                                  <Badge className={`${categoryInfo.color} text-white px-2 py-1`}>
                                    <span className="mr-1">{categoryInfo.icon}</span>
                                    {categoryInfo.label}
                                  </Badge>
                                </div>
                                <img 
                                  src={photoUrl} 
                                  alt={`${categoryInfo.label} - ${filename}`} 
                                  className="w-full h-40 object-cover"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="truncate">{filename}</span>
                                    <a 
                                      href={photoUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-white hover:text-blue-300 transition-colors"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </a>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="documentation" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Documentación</CardTitle>
                  <CardDescription>Manuales y documentación técnica relacionada</CardDescription>
                </CardHeader>
                <CardContent>
                  {asset?.insurance_documents && asset.insurance_documents.length > 0 ? (
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-muted-foreground">Documentos de Seguro</h4>
                      <div className="space-y-2">
                        {asset.insurance_documents.map((docUrl, index) => {
                          // Extract filename from URL
                          const filename = docUrl.split('/').pop() || `Documento ${index + 1}`;
                          
                          return (
                            <div key={index} className="flex items-center justify-between p-3 border rounded-md">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{filename}</span>
                              </div>
                              <a
                                href={docUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <Button variant="ghost" size="sm">
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  Ver
                                </Button>
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
                      <h3 className="mt-4 text-lg font-medium">No hay documentos disponibles</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Los documentos técnicos se encuentran asociados al modelo de equipo.
                      </p>
                      {asset?.model && (
                        <Button variant="outline" className="mt-4" asChild>
                          <Link href={`/modelos/${asset.model.id}`}>
                            Ver documentación del modelo
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="financial" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Información Financiera y Administrativa</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <dl className="space-y-4">
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Fecha de Compra</dt>
                          <dd className="text-lg">{formatDate(asset?.purchase_date || null)}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Costo de Adquisición</dt>
                          <dd className="text-lg">{asset?.purchase_cost || "No especificado"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Garantía Válida Hasta</dt>
                          <dd className="text-lg">{formatDate(asset?.warranty_expiration || null)}</dd>
                        </div>
                      </dl>
                    </div>
                    <div>
                      <dl className="space-y-4">
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Información de Registro</dt>
                          <dd className="text-lg">{asset?.registration_info || "No especificada"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Póliza de Seguro</dt>
                          <dd className="text-lg">{asset?.insurance_policy || "No especificada"}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-muted-foreground">Seguro Válido Hasta</dt>
                          <dd className="text-lg">{formatDate(asset?.insurance_end_date || null)}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end">
            <Button variant="outline" asChild>
              <Link href={`/activos/${assetId}/editar`}>
                <Edit className="mr-2 h-4 w-4" />
                Editar Activo
              </Link>
            </Button>
          </div>
        </div>
      )}
    </DashboardShell>
  );
} 