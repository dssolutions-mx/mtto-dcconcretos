"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

type Cluster = {
  key: string
  kind: "name_bu" | "tax_id"
  rows: Array<{
    id: string
    name: string
    business_unit_id: string | null
    tax_id: string | null
    status: string | null
  }>
}

export function SupplierDuplicatesPanel() {
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [aliasTarget, setAliasTarget] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch("/api/suppliers/duplicates?min=2")
      if (!r.ok) throw new Error("fetch")
      const j = (await r.json()) as { clusters: Cluster[] }
      setClusters(j.clusters || [])
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar duplicados", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const setAlias = async (rowId: string, targetId: string) => {
    if (!targetId) return
    const r = await fetch(`/api/suppliers/${rowId}/alias`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alias_of: targetId }),
    })
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      toast({ title: "No se pudo marcar como alias", description: d.error || "Error", variant: "destructive" })
      return
    }
    toast({ title: "Alias actualizado" })
    void load()
  }

  const rename = (s: Cluster["rows"][0]) => {
    const next = window.prompt("Nuevo nombre comercial", s.name)
    if (next == null || !next.trim() || next.trim() === s.name) return
    void (async () => {
      const r = await fetch(`/api/suppliers/${s.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: next.trim() }),
      })
      if (!r.ok) {
        toast({ title: "Error al renombrar", variant: "destructive" })
        return
      }
      toast({ title: "Renombrado" })
      void load()
    })()
  }

  const deactivate = (s: Cluster["rows"][0]) => {
    if (!window.confirm(`¿Desactivar “${s.name}”?`)) return
    void (async () => {
      const r = await fetch(`/api/suppliers/${s.id}`, { method: "DELETE" })
      if (!r.ok) {
        toast({ title: "Error", variant: "destructive" })
        return
      }
      toast({ title: "Desactivado" })
      void load()
    })()
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (clusters.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No se detectaron grupos duplicados (mismo nombre+UN o mismo RFC) en el padrón.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Grupos con 2+ registros. Usa acciones para corregir sin fusionar automáticamente.
      </p>
      {clusters.map((c, i) => (
        <Card key={`${c.kind}-${c.key}-${i}`}>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">
              {c.kind === "tax_id" ? "RFC" : "Nombre + UN"} · {c.key.slice(0, 40)}
              {c.key.length > 40 ? "…" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
              {c.rows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-md border p-3 space-y-2 text-sm"
                >
                  <div>
                    <Link className="font-medium hover:underline" href={`/suppliers/${row.id}`}>
                      {row.name}
                    </Link>
                    <div className="text-xs text-muted-foreground font-mono">{row.id}</div>
                    <div className="text-xs">Estado: {row.status || "—"}</div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => rename(row)}>
                      Renombrar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => deactivate(row)}
                    >
                      Desactivar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => router.push(`/suppliers/${row.id}`)}
                    >
                      Editar
                    </Button>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Alias de (ID o abrir otra ficha y pegar ID)</Label>
                    <div className="flex gap-1">
                      <Input
                        className="h-8 text-xs"
                        placeholder="UUID canónico"
                        value={aliasTarget[row.id] || ""}
                        onChange={(e) =>
                          setAliasTarget((prev) => ({ ...prev, [row.id]: e.target.value }))
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setAlias(row.id, (aliasTarget[row.id] || "").trim())}
                      >
                        Marcar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
