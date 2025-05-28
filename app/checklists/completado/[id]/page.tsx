'use client';

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, FileText, Camera, User, Calendar, Clock, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type CompletedItem = {
  id: string;
  item_id: string;
  status: 'pass' | 'flag' | 'fail';
  notes?: string;
  photo_url?: string;
};

type ChecklistIssue = {
  id: string;
  checklist_id: string;
  item_id: string;
  status: string;
  description: string;
  notes: string | null;
  photo_url: string | null;
  work_order_id: string | null;
  resolved: boolean | null;
  resolution_date: string | null;
  created_at: string | null;
};

type CompletedChecklistData = {
  id: string;
  checklist_id: string;
  asset_id: string;
  completed_items: CompletedItem[];
  technician: string;
  completion_date: string;
  notes: string | null;
  status: string;
  signature_data: string | null;
  created_by: string | null;
  checklists: {
    id: string;
    name: string;
    checklist_sections: Array<{
      id: string;
      title: string;
      order_index: number;
      checklist_items: Array<{
        id: string;
        description: string;
        required: boolean;
        order_index: number;
      }>;
    }>;
  };
  assets: {
    id: string;
    name: string;
    asset_id: string;
    location: string;
    department: string;
  };
  profile: {
    id: string;
    nombre: string | null;
    apellido: string | null;
    role: string | null;
    telefono: string | null;
    avatar_url: string | null;
    departamento: string | null;
  } | null;
  issues: ChecklistIssue[];
};

export default function CompletedChecklistDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const checklistId = resolvedParams.id;
  const router = useRouter();
  
  const [data, setData] = useState<CompletedChecklistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompletedChecklist = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/checklists/completed/${checklistId}`);
        
        if (!response.ok) {
          throw new Error('Error al cargar los detalles del checklist');
        }
        
        const result = await response.json();
        setData(result.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (checklistId) {
      fetchCompletedChecklist();
    }
  }, [checklistId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'flag':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass':
        return <Badge className="bg-green-500">Correcto</Badge>;
      case 'flag':
        return <Badge className="bg-yellow-500">Atención</Badge>;
      case 'fail':
        return <Badge className="bg-red-500">Falla</Badge>;
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  const getItemCompletionData = (itemId: string): CompletedItem | null => {
    return data?.completed_items.find(item => item.item_id === itemId) || null;
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy 'a las' HH:mm", { locale: es });
  };

  if (loading) {
    return (
      <DashboardShell>
        <DashboardHeader
          heading="Cargando checklist..."
          text="Obteniendo detalles del checklist completado"
        >
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </DashboardHeader>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-64" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  if (error || !data) {
    return (
      <DashboardShell>
        <DashboardHeader
          heading="Error"
          text="No se pudo cargar el checklist"
        >
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>
        </DashboardHeader>
        <Alert variant="destructive">
          <AlertDescription>{error || "Checklist no encontrado"}</AlertDescription>
        </Alert>
      </DashboardShell>
    );
  }

  const totalItems = data.checklists.checklist_sections.reduce(
    (total, section) => total + section.checklist_items.length, 0
  );
  
  const completedItems = data.completed_items.length;
  const passedItems = data.completed_items.filter(item => item.status === 'pass').length;
  const flaggedItems = data.completed_items.filter(item => item.status === 'flag').length;
  const failedItems = data.completed_items.filter(item => item.status === 'fail').length;

  return (
    <DashboardShell>
      <DashboardHeader
        heading={`Checklist: ${data.checklists.name}`}
        text={`Detalles del checklist completado el ${formatDate(data.completion_date)}`}
      >
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
      </DashboardHeader>

      <div className="space-y-6">
        {/* Información General */}
        <Card>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Activo</dt>
                  <dd className="text-lg">{data.assets.name} ({data.assets.asset_id})</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Ubicación</dt>
                  <dd className="text-lg">{data.assets.location}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Departamento</dt>
                  <dd className="text-lg">{data.assets.department}</dd>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Técnico</dt>
                  <dd className="text-lg">
                    <div className="flex items-center gap-3">
                      {data.profile?.avatar_url ? (
                        <img 
                          src={data.profile.avatar_url} 
                          alt={`Avatar de ${data.technician}`}
                          className="w-8 h-8 rounded-full object-cover border"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium">
                          {data.profile?.nombre && data.profile?.apellido 
                            ? `${data.profile.nombre} ${data.profile.apellido}` 
                            : data.technician}
                        </div>
                        {data.profile?.role && (
                          <div className="text-sm text-muted-foreground">{data.profile.role}</div>
                        )}
                      </div>
                    </div>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Fecha de Completado</dt>
                  <dd className="text-lg flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDate(data.completion_date)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Estado</dt>
                  <dd className="text-lg">
                    <Badge 
                      variant={data.status === 'Completado' ? 'default' : 'destructive'}
                      className="text-sm"
                    >
                      {data.status}
                    </Badge>
                  </dd>
                </div>
              </div>
            </div>

            {data.notes && (
              <>
                <Separator className="my-4" />
                <div>
                  <dt className="text-sm font-medium text-muted-foreground mb-2">Notas Generales</dt>
                  <dd className="text-sm bg-muted p-3 rounded-md">{data.notes}</dd>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Resumen de Resultados */}
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Resultados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{totalItems}</div>
                <div className="text-sm text-muted-foreground">Total de ítems</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{passedItems}</div>
                <div className="text-sm text-muted-foreground">Correctos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{flaggedItems}</div>
                <div className="text-sm text-muted-foreground">Con atención</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{failedItems}</div>
                <div className="text-sm text-muted-foreground">Fallidos</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detalles por Sección */}
        <div className="space-y-4">
          {data.checklists.checklist_sections
            .sort((a, b) => a.order_index - b.order_index)
            .map((section) => (
              <Card key={section.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {section.checklist_items
                      .sort((a, b) => a.order_index - b.order_index)
                      .map((item) => {
                        const completionData = getItemCompletionData(item.id);
                        return (
                          <div key={item.id} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  {completionData && getStatusIcon(completionData.status)}
                                  <span className="font-medium">{item.description}</span>
                                  {item.required && (
                                    <Badge variant="outline" className="text-xs">
                                      Obligatorio
                                    </Badge>
                                  )}
                                </div>
                                
                                {completionData && (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-muted-foreground">Estado:</span>
                                      {getStatusBadge(completionData.status)}
                                    </div>
                                    
                                    {completionData.notes && (
                                      <div>
                                        <span className="text-sm text-muted-foreground">Notas:</span>
                                        <p className="text-sm mt-1 bg-muted p-2 rounded">
                                          {completionData.notes}
                                        </p>
                                      </div>
                                    )}
                                    
                                    {completionData.photo_url && (
                                      <div>
                                        <span className="text-sm text-muted-foreground mb-2 block">
                                          Fotografía:
                                        </span>
                                        <div className="relative inline-block">
                                          <img 
                                            src={completionData.photo_url} 
                                            alt={`Evidencia: ${item.description}`}
                                            className="w-32 h-32 object-cover rounded border"
                                          />
                                          <a 
                                            href={completionData.photo_url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="absolute top-1 right-1 bg-black/70 text-white p-1 rounded"
                                          >
                                            <ExternalLink className="h-3 w-3" />
                                          </a>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {!completionData && (
                                  <Badge variant="outline" className="text-xs">
                                    No completado
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>

        {/* Issues/Problemas detectados */}
        {data.issues && data.issues.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-red-600">Problemas Detectados</CardTitle>
              <CardDescription>Issues que requieren atención o generaron órdenes de trabajo</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.issues.map((issue) => (
                  <div key={issue.id} className="border-l-4 border-red-500 pl-4 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <Badge variant="destructive" className="text-xs">
                        {issue.status === 'flag' ? 'Atención' : 'Falla'}
                      </Badge>
                      {issue.resolved && (
                        <Badge variant="outline" className="text-xs">
                          Resuelto
                        </Badge>
                      )}
                    </div>
                    <p className="font-medium">{issue.description}</p>
                    {issue.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{issue.notes}</p>
                    )}
                    {issue.work_order_id && (
                      <p className="text-sm text-blue-600 mt-1">
                        Orden de trabajo generada: {issue.work_order_id}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Información de Ejecución */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Información de Ejecución</CardTitle>
            <CardDescription>Detalles del técnico que ejecutó el checklist</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {data.profile?.avatar_url ? (
                    <img 
                      src={data.profile.avatar_url} 
                      alt={`Avatar de ${data.technician}`}
                      className="w-16 h-16 rounded-full object-cover border-2 border-muted"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-muted">
                      <User className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold">
                      {data.profile?.nombre && data.profile?.apellido 
                        ? `${data.profile.nombre} ${data.profile.apellido}` 
                        : data.technician}
                    </h3>
                    {data.profile?.role && (
                      <p className="text-sm text-muted-foreground">{data.profile.role}</p>
                    )}
                    {data.profile?.departamento && (
                      <p className="text-sm text-muted-foreground">
                        Departamento: {data.profile.departamento}
                      </p>
                    )}
                  </div>
                </div>
                
                {data.profile?.telefono && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground">Teléfono</dt>
                    <dd className="text-sm">{data.profile.telefono}</dd>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Fecha y Hora de Ejecución</dt>
                  <dd className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDate(data.completion_date)}
                  </dd>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Nombre registrado</dt>
                  <dd className="text-sm">{data.technician}</dd>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Estado de ejecución</dt>
                  <dd className="text-sm">
                    <Badge 
                      variant={data.status === 'Completado' ? 'default' : 'destructive'}
                      className="text-xs"
                    >
                      {data.status}
                    </Badge>
                  </dd>
                </div>
                
                {/* Firma digital si existe */}
                {data.signature_data && (
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-2">Firma Digital</dt>
                    <dd>
                      <img 
                        src={data.signature_data} 
                        alt="Firma del técnico"
                        className="max-w-48 h-16 object-contain border rounded bg-white"
                      />
                    </dd>
                  </div>
                )}
              </div>
            </div>
            
            {/* Información adicional */}
            <div className="mt-6 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Checklist ejecutado y validado</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Este checklist fue completado por {data.profile?.nombre && data.profile?.apellido 
                  ? `${data.profile.nombre} ${data.profile.apellido}` 
                  : data.technician} el {formatDate(data.completion_date)} 
                {data.signature_data ? ' con firma digital verificada' : ' con identificación registrada'}.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
} 