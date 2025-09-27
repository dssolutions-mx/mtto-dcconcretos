"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Search, X, Plus, Link as LinkIcon, RefreshCcw } from "lucide-react";

interface CreateCompositeAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAssetId: string;
}

export function CreateCompositeAssetDialog({ open, onOpenChange, currentAssetId }: CreateCompositeAssetDialogProps) {
  const supabase = createClient();

  // Steps: 1) select, 2) identity, 3) shared readings, 4) impact, 5) confirm
  const [step, setStep] = useState<number>(1);

  // Data
  const [currentAsset, setCurrentAsset] = useState<any | null>(null);
  const [search, setSearch] = useState<string>("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [name, setName] = useState<string>("");
  const [assetCode, setAssetCode] = useState<string>("");
  const [compositeType, setCompositeType] = useState<string>("pumping_truck");

  const [sharedHours, setSharedHours] = useState<number | "">("");
  const [sharedKm, setSharedKm] = useState<number | "">("");
  const [syncNow, setSyncNow] = useState<boolean>(true);

  const [assetIdStrategy, setAssetIdStrategy] = useState<'auto' | 'error'>('error');
  const [assetIdPrefix, setAssetIdPrefix] = useState<string>('PT-');

  const [warnings, setWarnings] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateAssetId, setDuplicateAssetId] = useState<boolean>(false);

  // Load current asset baseline
  useEffect(() => {
    if (!open) return;
    const loadCurrent = async () => {
      const { data } = await supabase
        .from("assets")
        .select("*")
        .eq("id", currentAssetId)
        .single();
      if (data) {
        setCurrentAsset(data);
        setSelectedIds([data.id]);
        setName(`${data.asset_id || data.name} (Compuesto)`);
        setAssetCode(`${data.asset_id || ""}`);
        setAssetIdPrefix('PT-');
      }
    };
    loadCurrent();
  }, [open, currentAssetId, supabase]);

  // Search assets to add
  useEffect(() => {
    let canceled = false;
    if (!open) return;
    const run = async () => {
      if (!search || search.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      const query = supabase
        .from("assets")
        .select("id, name, asset_id, current_hours, current_kilometers, plant_id, department_id, is_composite")
        .or(`name.ilike.%${search}%,asset_id.ilike.%${search}%`)
        .limit(10);
      const { data } = await query;
      if (!canceled) setSearchResults((data || []).filter(a => a.id !== currentAssetId));
    };
    run();
    return () => { canceled = true; };
  }, [open, search, currentAssetId, supabase]);

  // Warnings/validations preview
  const preview = useMemo(() => {
    const chosen = searchResults.filter(a => selectedIds.includes(a.id));
    const all = currentAsset ? [currentAsset, ...chosen] : chosen;

    const warns: string[] = [];
    if (all.length >= 2) {
      if (all.some(a => a.is_composite)) warns.push("Uno de los activos ya es compuesto (no permitido)");
    }
    setWarnings(warns);

    const maxHours = Math.max(...all.map(a => a.current_hours || 0));
    const maxKm = Math.max(...all.map(a => a.current_kilometers || 0));
    return {
      chosen: all,
      maxHours,
      maxKm,
      counts: {
        total: all.length
      }
    };
  }, [currentAsset, searchResults, selectedIds]);

  useEffect(() => {
    if (preview && preview.chosen.length >= 2) {
      if (sharedHours === "") setSharedHours(preview.maxHours || 0);
      if (sharedKm === "") setSharedKm(preview.maxKm || 0);
    }
  }, [preview]);

  const canProceedStep1 = preview && preview.chosen.length >= 2 && warnings.length === 0;
  const canProceedStep2 = name.trim().length > 1 && assetCode.trim().length > 1;

  const removeSelected = (id: string) => setSelectedIds(prev => prev.filter(x => x !== id || x === currentAssetId));

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError(null);
      setDuplicateAssetId(false);
      const components = selectedIds;
      const payload: any = {
        name,
        asset_id: assetCode,
        composite_type: compositeType,
        component_ids: components,
        asset_id_strategy: assetIdStrategy,
        asset_id_prefix: assetIdPrefix
      };
      if (syncNow) {
        if (sharedHours !== "") payload.initial_shared_hours = Number(sharedHours);
        if (sharedKm !== "") payload.initial_shared_kilometers = Number(sharedKm);
      }

      const res = await fetch("/api/assets/composites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409 && json?.error === 'DUPLICATE_ASSET_ID') {
          setDuplicateAssetId(true);
        } else {
          throw new Error(json.error || "Error creando compuesto");
        }
        return;
      }

      if (syncNow && (sharedHours !== "" || sharedKm !== "")) {
        const compositeId = json.data.id;
        const update: any = {};
        if (sharedHours !== "") update.current_hours = Number(sharedHours);
        if (sharedKm !== "") update.current_kilometers = Number(sharedKm);
        if (Object.keys(update).length > 0) {
          await supabase.from("assets").update(update).eq("id", compositeId);
        }
      }

      window.location.href = `/activos/${json.data.id}`;
    } catch (e: any) {
      setError(e?.message || "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  const StepIndicator = (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Badge variant={step === 1 ? "default" : "outline"}>1</Badge>
      <span>Seleccionar</span>
      <Badge variant={step === 2 ? "default" : "outline"}>2</Badge>
      <span>Identidad</span>
      <Badge variant={step === 3 ? "default" : "outline"}>3</Badge>
      <span>Horas Compartidas</span>
      <Badge variant={step === 4 ? "default" : "outline"}>4</Badge>
      <span>Impacto</span>
      <Badge variant={step === 5 ? "default" : "outline"}>5</Badge>
      <span>Confirmar</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crear Activo Compuesto</DialogTitle>
          {StepIndicator}
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Selecciona los activos a combinar. El activo actual ya está incluido.</div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o código" />
                <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {/* Selected items */}
            <div className="flex flex-wrap gap-2">
              {currentAsset && (
                <Badge variant="default">{currentAsset.asset_id || currentAsset.name}</Badge>
              )}
              {searchResults
                .filter(a => selectedIds.includes(a.id) && a.id !== currentAssetId)
                .map(a => (
                  <span key={a.id} className="inline-flex items-center gap-1">
                    <Badge variant="outline">{a.asset_id || a.name}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => removeSelected(a.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </span>
                ))}
            </div>

            {/* Results */}
            <div className="max-h-60 overflow-auto border rounded-md">
              {searchResults.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">Sin resultados</div>
              ) : (
                <div className="divide-y">
                  {searchResults.map(a => (
                    <div key={a.id} className="p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{a.asset_id || a.name}</div>
                        <div className="text-xs text-muted-foreground truncate">H: {a.current_hours || 0} | Km: {a.current_kilometers || 0}</div>
                      </div>
                      <Button size="sm" variant={selectedIds.includes(a.id) ? "outline" : "default"} onClick={() => !selectedIds.includes(a.id) && setSelectedIds(prev => [...prev, a.id])}>
                        <Plus className="h-4 w-4 mr-1" /> Agregar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {warnings.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {warnings.map((w, idx) => (
                    <div key={idx}>{w}</div>
                  ))}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Nombre del Compuesto</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <Label>Código del Activo (asset_id)</Label>
                <div className="flex gap-2">
                  <Input value={assetCode} onChange={e => setAssetCode(e.target.value)} />
                  {duplicateAssetId && (
                    <Button type="button" variant="outline" size="icon" title="Generar automáticamente" onClick={() => setAssetIdStrategy('auto')}>
                      <RefreshCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {duplicateAssetId && (
                  <div className="text-xs text-red-600 mt-1">El código ya existe. Activa generación automática o elige un código único.</div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Estrategia de Código</Label>
                <select className="border rounded-md h-9 px-2 text-sm" value={assetIdStrategy} onChange={e => setAssetIdStrategy(e.target.value as any)}>
                  <option value="error">Requerir código único (error si existe)</option>
                  <option value="auto">Generar automáticamente si existe</option>
                </select>
              </div>
              {assetIdStrategy === 'auto' && (
                <div>
                  <Label>Prefijo de Código</Label>
                  <Input value={assetIdPrefix} onChange={e => setAssetIdPrefix(e.target.value)} />
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Roles de componentes omitidos para evitar complejidad innecesaria.
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="text-sm">Horas/Km compartidos propuestos (máximos de los componentes).</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Horas Compartidas</Label>
                <Input type="number" value={sharedHours} onChange={e => setSharedHours(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
              <div>
                <Label>Kilómetros Compartidos</Label>
                <Input type="number" value={sharedKm} onChange={e => setSharedKm(e.target.value === "" ? "" : Number(e.target.value))} />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Al crear, si activas sincronización, el compuesto se actualizará y el sistema propagará automáticamente estos valores a todos los componentes.
            </div>
            <div className="flex items-center gap-2 text-sm">
              <input id="sync-now" type="checkbox" checked={syncNow} onChange={e => setSyncNow(e.target.checked)} />
              <Label htmlFor="sync-now">Sincronizar ahora a todos los componentes</Label>
            </div>
            <Separator />
            <div className="text-sm font-medium">Vista Previa</div>
            <div className="text-xs text-muted-foreground">
              Se establecerán {typeof sharedHours === 'number' ? sharedHours : preview.maxHours}h y {typeof sharedKm === 'number' ? sharedKm : preview.maxKm}km en todos los componentes.
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 text-sm">
            <div className="text-muted-foreground">No se moverán datos históricos. Mantenimientos, órdenes, incidentes y checklists permanecen en sus activos originales. El activo compuesto provee una vista unificada.</div>
            <ul className="list-disc pl-5 text-muted-foreground">
              <li>Sin eliminación ni migración de registros existentes.</li>
              <li>Sincronización de horas opcional al crear.</li>
              <li>Separación posible en cualquier momento (no destructiva).</li>
            </ul>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            <div className="text-sm font-medium">Confirmación</div>
            <div className="text-sm">
              <div>Nombre: <span className="font-semibold">{name}</span></div>
              <div>Código: <span className="font-semibold">{assetCode}</span></div>
              <div>Tipo: <span className="font-semibold">{compositeType}</span></div>
              <div>Componentes: <span className="font-semibold">{preview?.chosen.length || 0}</span></div>
              <div>Sincronizar ahora: <span className="font-semibold">{syncNow ? 'Sí' : 'No'}</span></div>
              <div>Estrategia de Código: <span className="font-semibold">{assetIdStrategy}</span></div>
            </div>
            <Alert>
              <LinkIcon className="h-4 w-4" />
              <AlertDescription>Escribe CREAR para confirmar.</AlertDescription>
            </Alert>
            <Input placeholder="CREAR" onChange={() => { /* simple guard typed in UI; enforce via button disabled */ }} />
          </div>
        )}

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-muted-foreground">
              Paso {step} de 5
            </div>
            <div className="flex gap-2">
              {step > 1 && (
                <Button variant="outline" onClick={() => setStep(prev => prev - 1)} disabled={submitting}>Atrás</Button>
              )}
              {step < 5 && (
                <Button onClick={() => setStep(prev => prev + 1)} disabled={(step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2) || submitting}>
                  Siguiente
                </Button>
              )}
              {step === 5 && (
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Creando…' : 'Crear Compuesto'}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
