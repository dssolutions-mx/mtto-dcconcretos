"use client"

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import type {
  LearnedRoutingSuggestion,
  RoutingLearningStats,
} from "@/lib/incidents/incident-routing-learning"
import { Brain, Loader2, RefreshCw, Sparkles } from "lucide-react"

type LearningResponse = {
  stats: RoutingLearningStats
  suggestions: (LearnedRoutingSuggestion & { already_promoted?: boolean })[]
  pending_promotion: (LearnedRoutingSuggestion & { already_promoted?: boolean })[]
}

export function RoutingLearningTab() {
  const { toast } = useToast()
  const [data, setData] = useState<LearningResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/incidents/routing-learning")
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const promotePatterns = async () => {
    setRefreshing(true)
    try {
      const res = await fetch("/api/incidents/routing-learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload.error || "Error al actualizar")
      toast({
        title: "Patrones actualizados",
        description: `${payload.promoted ?? 0} regla(s) aprendida(s) promovida(s).`,
      })
      await load()
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo actualizar",
        variant: "destructive",
      })
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const stats = data?.stats
  const pending = data?.pending_promotion ?? []
  const suggestions = data?.suggestions ?? []

  const automationRate =
    stats && stats.auto_routed_last_30d != null && stats.manual_routed_last_30d != null
      ? Math.round(
          (stats.auto_routed_last_30d /
            Math.max(1, stats.auto_routed_last_30d + stats.manual_routed_last_30d)) *
            100,
        )
      : null

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Aprendizaje por decisiones
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Cada reasignación manual alimenta el motor. Con 3+ decisiones consistentes se crean
            reglas aprendidas que enrutan automáticamente incidentes similares.
          </p>
        </div>
        <Button onClick={() => void promotePatterns()} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          Promover patrones
        </Button>
      </div>

      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Señales capturadas (180d)</CardDescription>
              <CardTitle className="text-2xl">{stats.total_signals}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Reglas aprendidas activas</CardDescription>
              <CardTitle className="text-2xl">{stats.learned_rules}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Correcciones humanas</CardDescription>
              <CardTitle className="text-2xl">{stats.corrections}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ruteo automático (30d)</CardDescription>
              <CardTitle className="text-2xl">
                {automationRate != null ? `${automationRate}%` : "—"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Patrones listos para promover</CardTitle>
          <CardDescription>
            Aparecen cuando el equipo repite la misma decisión al menos 3 veces con alta
            consistencia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay patrones nuevos. Sigue clasificando incidentes manualmente — el sistema
              aprenderá de tus decisiones.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo / palabra clave</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Muestras</TableHead>
                  <TableHead>Confianza</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((row) => (
                  <TableRow key={row.pattern_key}>
                    <TableCell>
                      <div className="font-medium">{row.incident_type}</div>
                      {row.description_keyword && (
                        <div className="text-xs text-muted-foreground">
                          {row.description_keyword}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{row.department_name ?? "—"}</TableCell>
                    <TableCell>{row.sample_count}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {Math.round(row.confidence * 100)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Todos los patrones detectados</CardTitle>
            <CardDescription>Incluye patrones en aprendizaje y ya promovidos.</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {suggestions.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">Sin patrones todavía.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patrón</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Muestras</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suggestions.slice(0, 20).map((row) => (
                  <TableRow key={row.pattern_key}>
                    <TableCell>
                      <div className="text-sm">{row.incident_type}</div>
                      {row.description_keyword && (
                        <div className="text-xs text-muted-foreground truncate max-w-xs">
                          {row.description_keyword}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{row.department_name ?? "—"}</TableCell>
                    <TableCell>{row.sample_count}</TableCell>
                    <TableCell>
                      {row.already_promoted ? (
                        <Badge>Promovida</Badge>
                      ) : row.ready_to_promote ? (
                        <Badge variant="default">Lista</Badge>
                      ) : (
                        <Badge variant="outline">Acumulando</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
