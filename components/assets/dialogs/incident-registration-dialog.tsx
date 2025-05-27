'use client';

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, Loader2, Plus, Minus, Trash2, Camera, FileText } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase";
import { EvidenceUpload, type EvidencePhoto } from "@/components/ui/evidence-upload";

interface IncidentPart {
  name: string;
  partNumber?: string;
  quantity: number;
  cost?: string;
}

interface IncidentRegistrationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  assetId: string;
  onSuccess: () => void;
}

export function IncidentRegistrationDialog({
  isOpen,
  onClose,
  assetId,
  onSuccess
}: IncidentRegistrationDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [date, setDate] = useState<Date>(new Date());
  const [type, setType] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState("");
  const [resolution, setResolution] = useState("");
  const [downtime, setDowntime] = useState("");
  const [laborHours, setLaborHours] = useState("");
  const [laborCost, setLaborCost] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [workOrder, setWorkOrder] = useState("");
  const [status, setStatus] = useState("Pendiente");
  const [parts, setParts] = useState<IncidentPart[]>([]);
  
  // Evidence state
  const [incidentEvidence, setIncidentEvidence] = useState<EvidencePhoto[]>([]);
  const [showEvidenceDialog, setShowEvidenceDialog] = useState(false);
  
  // New part form
  const [newPartName, setNewPartName] = useState("");
  const [newPartNumber, setNewPartNumber] = useState("");
  const [newPartQuantity, setNewPartQuantity] = useState("1");
  const [newPartCost, setNewPartCost] = useState("");

  const resetForm = () => {
    setDate(new Date());
    setType("");
    setReportedBy("");
    setDescription("");
    setImpact("");
    setResolution("");
    setDowntime("");
    setLaborHours("");
    setLaborCost("");
    setTotalCost("");
    setWorkOrder("");
    setStatus("Pendiente"); // Cambiado a Pendiente por defecto
    setParts([]);
    setIncidentEvidence([]);
    setNewPartName("");
    setNewPartNumber("");
    setNewPartQuantity("1");
    setNewPartCost("");
  };

  const addPart = () => {
    if (!newPartName || !newPartQuantity) return;
    
    const quantity = parseInt(newPartQuantity);
    if (isNaN(quantity) || quantity <= 0) return;
    
    setParts([
      ...parts,
      {
        name: newPartName,
        partNumber: newPartNumber || undefined,
        quantity,
        cost: newPartCost || undefined
      }
    ]);
    
    // Clear form
    setNewPartName("");
    setNewPartNumber("");
    setNewPartQuantity("1");
    setNewPartCost("");
  };

  const removePart = (index: number) => {
    setParts(parts.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // Validar campos obligatorios básicos
    if (!date || !type || !reportedBy || !description) {
      toast({
        title: "Campos incompletos",
        description: "Por favor complete todos los campos obligatorios marcados con *",
        variant: "destructive",
      });
      return;
    }
    
    // Validar que si está resuelto, tenga una resolución
    if (status === "Resuelto" && !resolution) {
      toast({
        title: "Resolución requerida",
        description: "Para marcar un incidente como resuelto, debe proporcionar una descripción de la resolución aplicada",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const supabase = createClient();
      
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        throw new Error("Usuario no autenticado");
      }

      // Calcular costos totales
      const partsData = parts.length > 0 ? parts : null;
      const laborCostNum = laborCost ? parseFloat(laborCost) : 0;
      const totalCostNum = totalCost ? parseFloat(totalCost) : laborCostNum;

      // Registrar incidente directamente en incident_history
      const incidentData = {
        asset_id: assetId,
        date: date.toISOString(),
        type: type,
        reported_by: reportedBy,
        reported_by_id: user.id,
        description: description,
        impact: impact || null,
        resolution: resolution || null,
        downtime: downtime ? parseFloat(downtime) : null,
        labor_hours: laborHours ? parseFloat(laborHours) : null,
        labor_cost: laborCost || null,
        parts: partsData ? JSON.stringify(partsData) : null,
        total_cost: totalCostNum > 0 ? totalCostNum.toString() : null,
        work_order_text: workOrder || null,
        status: status,
        documents: incidentEvidence.length > 0 
          ? incidentEvidence.map(evidence => evidence.url)
          : null,
        created_by: user.id
      };

      console.log("Registering incident:", incidentData);

      const { data: insertedIncident, error: incidentError } = await supabase
        .from('incident_history')
        .insert(incidentData)
        .select('id')
        .single();

      if (incidentError) {
        console.error("Error registering incident:", incidentError);
        throw new Error(`Error al registrar incidente: ${incidentError.message}`);
      }

      console.log("Incident registered successfully with ID:", insertedIncident.id);

      // Generar orden de trabajo automáticamente si el incidente lo amerita
      // Genera OT cuando: es una falla, está pendiente, en progreso, o es un accidente
      if (type.toLowerCase().includes('falla') || 
          status === 'Pendiente' || 
          status === 'En progreso' || 
          type.toLowerCase().includes('accidente')) {
        try {
          console.log("Generating work order from incident...");
          
          // Llamar a la API para generar la orden de trabajo
          const workOrderResponse = await fetch('/api/work-orders/generate-from-incident', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              incident_id: insertedIncident.id,
              priority: type.toLowerCase().includes('crítica') || 
                       type.toLowerCase().includes('falla') || 
                       type.toLowerCase().includes('accidente') ? 'Alta' : 'Media'
            }),
          });

          if (!workOrderResponse.ok) {
            const errorData = await workOrderResponse.json();
            throw new Error(errorData.error || 'Error generando orden de trabajo');
          }

          const { work_order_id } = await workOrderResponse.json();
          console.log("Work order generated successfully:", work_order_id);
          
          let message = "El incidente ha sido registrado y se generó automáticamente la orden de trabajo.";
          
          // Añadir mensaje sobre orden de compra si hay repuestos o costos
          if ((parts && parts.length > 0) || (totalCostNum > 0)) {
            message += " Se han transferido los repuestos y costos para generar una orden de compra.";
          }
          
          toast({
            title: "¡Incidente registrado y orden de trabajo creada!",
            description: message,
          });
        } catch (workOrderErr) {
          console.error("Error in work order generation:", workOrderErr);
          toast({
            title: "Incidente registrado",
            description: "El incidente fue registrado pero hubo un problema al generar la orden de trabajo.",
            variant: "default",
          });
        }
      } else {
                  toast({
            title: "¡Incidente registrado exitosamente!",
            description: "El incidente ha sido registrado en el historial del activo sin generar orden de trabajo.",
          });
      }

      resetForm();
      onSuccess();
    } catch (err) {
      console.error("Error al procesar incidente:", err);
      toast({
        title: "Error al procesar incidente",
        description: err instanceof Error ? err.message : "Ha ocurrido un error inesperado",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Nuevo Incidente</DialogTitle>
          <DialogDescription>
            Complete la información del incidente o falla reportada
          </DialogDescription>
          <div className="mt-2 text-sm text-muted-foreground bg-muted p-2 rounded">
            <p><strong>Nota:</strong> Los incidentes con estado "Pendiente", "En progreso", de tipo "Falla" o "Accidente" 
            generarán automáticamente una orden de trabajo correctiva.</p>
            <p className="mt-1"><strong>Importante:</strong> Los repuestos, costos y gastos registrados en el incidente 
            se transferirán automáticamente a la orden de trabajo y podrán ser utilizados para generar órdenes de compra.</p>
          </div>
        </DialogHeader>
        
        <div className="grid gap-6 py-4">
          {/* Información básica */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Fecha del Incidente *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full pl-3 text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    {date ? (
                      format(date, "PPP", { locale: es })
                    ) : (
                      <span>Seleccionar fecha</span>
                    )}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(date) => date && setDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="type">Tipo de Incidente *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione un tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Falla eléctrica">Falla eléctrica</SelectItem>
                  <SelectItem value="Falla mecánica">Falla mecánica</SelectItem>
                  <SelectItem value="Falla hidráulica">Falla hidráulica</SelectItem>
                  <SelectItem value="Falla de software">Falla de software</SelectItem>
                  <SelectItem value="Accidente">Accidente</SelectItem>
                  <SelectItem value="Alerta">Alerta</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reportedBy">Reportado por *</Label>
              <Input
                id="reportedBy"
                value={reportedBy}
                onChange={(e) => setReportedBy(e.target.value)}
                placeholder="Nombre de quien reporta"
                required
              />
            </div>
          </div>

          {/* Descripción e impacto */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="description">Descripción del Incidente *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describa detalladamente el incidente..."
                rows={3}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="impact">Impacto en la Operación</Label>
              <Textarea
                id="impact"
                value={impact}
                onChange={(e) => setImpact(e.target.value)}
                placeholder="Describa el impacto en la producción u operación..."
                rows={3}
              />
            </div>
          </div>

          {/* Estado del incidente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Estado del Incidente *</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendiente">Pendiente</SelectItem>
                  <SelectItem value="En progreso">En progreso</SelectItem>
                  <SelectItem value="Resuelto">Resuelto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {(status === "En progreso" || status === "Resuelto") && (
              <div className="space-y-2">
                <Label htmlFor="resolution">Resolución Aplicada</Label>
                <Textarea
                  id="resolution"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  placeholder="Describa cómo se resolvió el incidente..."
                  rows={2}
                  required={status === "Resuelto"}
                />
              </div>
            )}
          </div>

          {/* Información de tiempo y costos - solo visible si está en progreso o resuelto */}
          {(status === "En progreso" || status === "Resuelto") && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="downtime">Tiempo Inactivo (horas)</Label>
                <Input
                  id="downtime"
                  type="number"
                  step="0.5"
                  value={downtime}
                  onChange={(e) => setDowntime(e.target.value)}
                  placeholder="0.0"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="laborHours">Horas de Trabajo</Label>
                <Input
                  id="laborHours"
                  type="number"
                  step="0.5"
                  value={laborHours}
                  onChange={(e) => setLaborHours(e.target.value)}
                  placeholder="0.0"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="laborCost">Costo de Mano de Obra ($)</Label>
                <Input
                  id="laborCost"
                  type="number"
                  step="0.01"
                  value={laborCost}
                  onChange={(e) => setLaborCost(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="totalCost">Costo Total ($)</Label>
                <Input
                  id="totalCost"
                  type="number"
                  step="0.01"
                  value={totalCost}
                  onChange={(e) => setTotalCost(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="workOrder">Orden de Trabajo</Label>
            <Input
              id="workOrder"
              value={workOrder}
              onChange={(e) => setWorkOrder(e.target.value)}
              placeholder="Número de orden de trabajo (opcional)"
            />
          </div>

          {/* Evidencia del incidente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Evidencia del Incidente
              </CardTitle>
              <CardDescription>
                Añada fotografías, documentos o cualquier evidencia visual del incidente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Incluya fotos del daño, condiciones del área, estado del equipo, y documentación relevante
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEvidenceDialog(true)}
                  className="flex items-center gap-2"
                >
                  <Camera className="h-4 w-4" />
                  Agregar Evidencia
                </Button>
              </div>

              {incidentEvidence.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {incidentEvidence.map((evidence) => (
                    <Card key={evidence.id} className="overflow-hidden">
                      <div className="aspect-video relative bg-muted">
                        {evidence.url.includes('image') || evidence.url.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                          <img
                            src={evidence.url}
                            alt={evidence.description}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText className="h-8 w-8 text-muted-foreground" />
                          </div>
                        )}
                        <Badge 
                          variant="secondary" 
                          className="absolute top-2 left-2 text-xs"
                        >
                          {evidence.category}
                        </Badge>
                      </div>
                      <CardContent className="p-3">
                        <p className="text-sm font-medium truncate">
                          {evidence.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(evidence.uploaded_at).toLocaleDateString()}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Repuestos utilizados - solo se muestra si está en progreso o resuelto */}
          {(status === "En progreso" || status === "Resuelto") && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Repuestos Utilizados</Label>
              </div>
              
              {parts.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium">Repuesto</th>
                        <th className="text-left py-2 px-3 font-medium">Número de Parte</th>
                        <th className="text-left py-2 px-3 font-medium">Cantidad</th>
                        <th className="text-left py-2 px-3 font-medium">Costo</th>
                        <th className="text-left py-2 px-3 font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parts.map((part, index) => (
                        <tr key={index} className="border-t">
                          <td className="py-2 px-3">{part.name}</td>
                          <td className="py-2 px-3 text-muted-foreground">{part.partNumber || "-"}</td>
                          <td className="py-2 px-3">{part.quantity}</td>
                          <td className="py-2 px-3">{part.cost ? `$${part.cost}` : "-"}</td>
                          <td className="py-2 px-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removePart(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              {/* Formulario para agregar repuesto */}
              <div className="p-4 border rounded-lg bg-gray-50">
                <h4 className="font-medium mb-3">Agregar Repuesto</h4>
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                  <div>
                    <Label htmlFor="newPartName">Nombre</Label>
                    <Input
                      id="newPartName"
                      value={newPartName}
                      onChange={(e) => setNewPartName(e.target.value)}
                      placeholder="ej: Filtro de aceite"
                    />
                  </div>
                  <div>
                    <Label htmlFor="newPartNumber">Número de Parte</Label>
                    <Input
                      id="newPartNumber"
                      value={newPartNumber}
                      onChange={(e) => setNewPartNumber(e.target.value)}
                      placeholder="ej: ABC123"
                    />
                  </div>
                  <div>
                    <Label htmlFor="newPartQuantity">Cantidad</Label>
                    <Input
                      id="newPartQuantity"
                      type="number"
                      min="1"
                      value={newPartQuantity}
                      onChange={(e) => setNewPartQuantity(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="newPartCost">Costo ($)</Label>
                    <Input
                      id="newPartCost"
                      type="number"
                      step="0.01"
                      value={newPartCost}
                      onChange={(e) => setNewPartCost(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Button
                      type="button"
                      onClick={addPart}
                      disabled={!newPartName || !newPartQuantity}
                      size="sm"
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Agregar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              "Registrar Incidente"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
      
      <EvidenceUpload
        open={showEvidenceDialog}
        onOpenChange={setShowEvidenceDialog}
        evidence={incidentEvidence}
        setEvidence={setIncidentEvidence}
        context="incident"
        assetId={assetId}
        title="Evidencia del Incidente"
        description="Suba fotografías del daño, condiciones del área, estado del equipo, causas del incidente y cualquier documentación relevante"
      />
    </Dialog>
  );
} 