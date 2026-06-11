"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type FleetDiagnosticAsset = {
  asset_id: string;
  asset_code: string;
  asset_name: string;
  excluded_history_count: number;
  excluded_reasons: Record<string, number>;
  overdue_interval_count: number;
  has_issues: boolean;
};

type FleetDiagnosticResponse = {
  scanned: number;
  with_issues: number;
  assets: FleetDiagnosticAsset[];
};

export default function MantenimientoDiagnosticosPage() {
  const [data, setData] = useState<FleetDiagnosticResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/maintenance/fleet-diagnostics");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Error al cargar diagnósticos");
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild>
            <Link href="/gestion">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Diagnósticos de mantenimiento cíclico</h1>
            <p className="text-muted-foreground text-sm">
              Calidad de datos preventivos en toda la flota (historial excluido, vencidos)
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-destructive">{error}</CardContent>
        </Card>
      )}

      {data && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Activos escaneados</CardDescription>
              <CardTitle className="text-3xl">{data.scanned}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Con incidencias</CardDescription>
              <CardTitle className="text-3xl text-amber-600">{data.with_issues}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Motor</CardDescription>
              <CardTitle className="text-lg font-medium">due-engine + preprocess</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Activos con problemas
          </CardTitle>
          <CardDescription>
            Historial excluido (medidor nulo, id huérfano) o intervalos vencidos según el ledger
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-muted-foreground">Cargando…</p>}
          {!loading && data && data.assets.length === 0 && (
            <p className="text-muted-foreground">No se detectaron incidencias en la muestra escaneada.</p>
          )}
          {!loading && data && data.assets.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activo</TableHead>
                  <TableHead>Historial excluido</TableHead>
                  <TableHead>Motivos</TableHead>
                  <TableHead>Vencidos</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.assets.map((row) => (
                  <TableRow key={row.asset_id}>
                    <TableCell>
                      <div className="font-medium">{row.asset_code}</div>
                      <div className="text-xs text-muted-foreground">{row.asset_name}</div>
                    </TableCell>
                    <TableCell>
                      {row.excluded_history_count > 0 ? (
                        <Badge variant="destructive">{row.excluded_history_count}</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {Object.entries(row.excluded_reasons).map(([k, v]) => (
                        <span key={k} className="mr-2">
                          {k}: {v}
                        </span>
                      ))}
                      {Object.keys(row.excluded_reasons).length === 0 && "—"}
                    </TableCell>
                    <TableCell>
                      {row.overdue_interval_count > 0 ? (
                        <Badge variant="outline">{row.overdue_interval_count}</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="link" size="sm" asChild>
                        <Link href={`/activos/${row.asset_id}/mantenimiento?debugCycles=1`}>
                          Ver debug
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
