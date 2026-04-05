"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useSuppliersList } from "@/hooks/use-suppliers-list"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import type { Supplier } from "@/types/suppliers"
import type { SupplierVerificationAction } from "@/types/suppliers"
import { SupplierForm } from "./SupplierForm"
import { SuppliersDataTable } from "./suppliers-data-table"
import { SuppliersFilterBar } from "./suppliers-filter-bar"
import { SuppliersKpiStrip } from "./suppliers-kpi-strip"
import type { KpiKey } from "./supplier-registry-constants"

interface SupplierRegistryProps {
  onSupplierSelect?: (supplier: Supplier) => void
  selectedSupplierId?: string
  showSelection?: boolean
  filterByType?: string
}

type SortField = "name" | "total_orders" | "created_at"
type SortDirection = "asc" | "desc"

const PAGE_SIZE = 50

export function SupplierRegistry({
  onSupplierSelect,
  selectedSupplierId,
  showSelection = false,
  filterByType,
}: SupplierRegistryProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { hasCreateAccess, hasWriteAccess } = useAuthZustand()
  const canCreate = hasCreateAccess("purchases")
  const canWrite = hasWriteAccess("purchases")

  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>(filterByType || "all")
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null)
  const [changingStatusFor, setChangingStatusFor] = useState<string | null>(null)

  const listStatus =
    statusFilter === "issues" ? "issues" : statusFilter === "all" ? "all" : statusFilter

  const {
    suppliers: rawSuppliers,
    loading,
    error,
    total,
    offset,
    setOffset,
    hasMore,
    searchTerm,
    setSearchTerm,
    reload,
    statusCounts,
  } = useSuppliersList({
    typeFilter,
    statusFilter: listStatus,
    limit: PAGE_SIZE,
  })

  const suppliers = useMemo(() => {
    const list = [...rawSuppliers]
    list.sort((a, b) => {
      let av: string | number
      let bv: string | number
      switch (sortField) {
        case "name":
          av = a.name.toLowerCase()
          bv = b.name.toLowerCase()
          break
        case "total_orders":
          av = a.total_orders ?? 0
          bv = b.total_orders ?? 0
          break
        case "created_at":
          av = new Date(a.created_at).getTime()
          bv = new Date(b.created_at).getTime()
          break
        default:
          return 0
      }
      if (av < bv) return sortDirection === "asc" ? -1 : 1
      if (av > bv) return sortDirection === "asc" ? 1 : -1
      return 0
    })
    return list
  }, [rawSuppliers, sortField, sortDirection])

  const counts = statusCounts ?? {
    total: 0,
    certified: 0,
    active: 0,
    pending: 0,
    issues: 0,
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const onKpiChange = (key: KpiKey) => {
    if (key === "issues") setStatusFilter("issues")
    else setStatusFilter(key)
  }

  const getEmptyMessage = () => {
    if (searchTerm) return { title: "Sin resultados", desc: `No hay proveedores que coincidan con "${searchTerm}".` }
    const msgs: Record<string, { title: string; desc: string }> = {
      pending: { title: "Sin proveedores pendientes", desc: "No hay proveedores esperando verificación." },
      active: { title: "Sin proveedores activos", desc: "No hay proveedores activos actualmente." },
      active_certified: {
        title: "Sin proveedores certificados",
        desc: "Certifica proveedores activos desde el menú de acciones.",
      },
      issues: { title: "Sin registros con problemas", desc: "No hay proveedores suspendidos ni bloqueados." },
      suspended: { title: "Sin suspensiones", desc: "No hay proveedores suspendidos." },
      blacklisted: { title: "Sin bloqueados", desc: "No hay proveedores bloqueados." },
    }
    return msgs[statusFilter] || { title: "Sin proveedores", desc: "Agrega tu primer proveedor." }
  }

  const handleVerification = async (supplierId: string, action: SupplierVerificationAction) => {
    setChangingStatusFor(supplierId)
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({
          title: "No se pudo actualizar",
          description: data.error || "Error al cambiar estado",
          variant: "destructive",
        })
        return
      }
      toast({ title: "Estado actualizado", description: "El proveedor se actualizó correctamente." })
      reload()
    } catch {
      toast({ title: "Error", description: "Error de red", variant: "destructive" })
    } finally {
      setChangingStatusFor(null)
    }
  }

  return (
    <div className="space-y-5">
      {canCreate && (
        <div className="hidden md:flex justify-end">
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Agregar proveedor
          </Button>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <SuppliersKpiStrip
        loading={loading && !statusCounts}
        statusFilter={statusFilter}
        onStatusChange={onKpiChange}
        counts={counts}
      />

      <SuppliersFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        statusFilter={statusFilter}
        onClearStatus={() => setStatusFilter("all")}
        onClearSearch={() => setSearchTerm("")}
        onClearAll={() => {
          setStatusFilter("all")
          setSearchTerm("")
        }}
      />

      {loading && rawSuppliers.length === 0 ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <SuppliersDataTable
          suppliers={suppliers}
          loading={loading && rawSuppliers.length === 0}
          selectedSupplierId={selectedSupplierId}
          showSelection={showSelection}
          canWrite={canWrite}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortToggle={toggleSort}
          onSelectSupplier={showSelection ? onSupplierSelect : undefined}
          onNavigateToSupplier={(s) => {
            if (showSelection) onSupplierSelect?.(s)
            else router.push(`/suppliers/${s.id}`)
          }}
          onEdit={(supplier) => {
            setSupplierToEdit(supplier)
            setShowEditDialog(true)
          }}
          onVerification={handleVerification}
          changingStatusFor={changingStatusFor}
          emptyState={getEmptyMessage()}
          showEmptyCreate={canCreate && statusFilter === "all" && !searchTerm}
          onCreate={() => setShowCreateDialog(true)}
        />
      )}

      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setOffset((o) => o + PAGE_SIZE)}>
            Cargar más
            {total > suppliers.length ? ` (${suppliers.length} de ${total})` : ""}
          </Button>
        </div>
      )}

      {canCreate && (
        <button
          type="button"
          className="fixed z-50 flex md:hidden items-center justify-center w-14 h-14 rounded-full bg-sky-700 text-white shadow-lg hover:bg-sky-800 transition-colors right-4 bottom-[max(1.5rem,env(safe-area-inset-bottom))] min-h-[56px] min-w-[56px]"
          onClick={() => setShowCreateDialog(true)}
          aria-label="Agregar proveedor"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {canCreate && (
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Agregar Nuevo Proveedor</DialogTitle>
              <DialogDescription>Registra un nuevo proveedor en el sistema</DialogDescription>
            </DialogHeader>
            <SupplierForm
              onSuccess={() => {
                setShowCreateDialog(false)
                reload()
              }}
              onCancel={() => setShowCreateDialog(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {canWrite && (
        <Dialog open={showEditDialog} onOpenChange={(open) => {
          setShowEditDialog(open)
          if (!open) setSupplierToEdit(null)
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Proveedor</DialogTitle>
              <DialogDescription>Modifica la información del proveedor</DialogDescription>
            </DialogHeader>
            {supplierToEdit && (
              <SupplierForm
                supplier={supplierToEdit}
                onSuccess={() => {
                  setShowEditDialog(false)
                  setSupplierToEdit(null)
                  reload()
                }}
                onCancel={() => {
                  setShowEditDialog(false)
                  setSupplierToEdit(null)
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
