"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertTriangle,
  CheckCircle,
  Edit,
  Eye,
  MoreHorizontal,
  Package,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
} from "lucide-react"
import type { Supplier } from "@/types/suppliers"
import type { SupplierVerificationAction } from "@/types/suppliers"
import { SupplierAvatar } from "./supplier-avatar"
import { STATUS_CONFIG, TYPE_LABELS } from "./supplier-registry-constants"

type SortField = "name" | "total_orders" | "created_at"
type SortDirection = "asc" | "desc"

interface SuppliersDataTableProps {
  suppliers: Supplier[]
  loading: boolean
  selectedSupplierId?: string
  showSelection?: boolean
  canWrite: boolean
  sortField: SortField
  sortDirection: SortDirection
  onSortToggle: (field: SortField) => void
  onSelectSupplier?: (supplier: Supplier) => void
  onNavigateToSupplier: (supplier: Supplier) => void
  onEdit: (supplier: Supplier) => void
  onVerification: (supplierId: string, action: SupplierVerificationAction) => Promise<void>
  changingStatusFor: string | null
  emptyState: { title: string; desc: string }
  showEmptyCreate: boolean
  onCreate: () => void
}

function isIncomplete(s: Supplier) {
  return !s.tax_id || !(s.bank_account_info as { account_number?: string } | null)?.account_number
}

export function SuppliersDataTable({
  suppliers,
  loading,
  selectedSupplierId,
  showSelection,
  canWrite,
  sortField,
  sortDirection,
  onSortToggle,
  onSelectSupplier,
  onNavigateToSupplier,
  onEdit,
  onVerification,
  changingStatusFor,
  emptyState,
  showEmptyCreate,
  onCreate,
}: SuppliersDataTableProps) {
  const getStatusBadge = (status: string) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.active
    const Icon = cfg.icon
    return (
      <Badge className={`flex items-center gap-1 border text-xs ${cfg.className}`}>
        <Icon className="w-3 h-3" />
        {cfg.label}
      </Badge>
    )
  }

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      individual: "bg-blue-50 text-blue-700 border-blue-200",
      company: "bg-green-50 text-green-700 border-green-200",
      distributor: "bg-purple-50 text-purple-700 border-purple-200",
      manufacturer: "bg-orange-50 text-orange-700 border-orange-200",
      service_provider: "bg-cyan-50 text-cyan-700 border-cyan-200",
    }
    return <Badge className={`text-xs border ${colors[type] || colors.company}`}>{TYPE_LABELS[type] || type}</Badge>
  }

  const SortIndicator = ({ field }: { field: SortField }) =>
    sortField === field ? (
      <span className="ml-1 text-primary">{sortDirection === "asc" ? "↑" : "↓"}</span>
    ) : null

  const renderStatusActions = (supplier: Supplier) => {
    if (!canWrite) return []
    const items: ReactNode[] = []
    if (supplier.status === "active") {
      items.push(
        <DropdownMenuItem key="certify" onSelect={() => onVerification(supplier.id, "certify")}>
          <ShieldCheck className="mr-2 h-4 w-4 text-green-600" />
          <span className="text-green-700">Promover a Certificado</span>
        </DropdownMenuItem>
      )
    }
    if (supplier.status === "active_certified") {
      items.push(
        <DropdownMenuItem key="uncertify" onSelect={() => onVerification(supplier.id, "revoke_certification")}>
          <ShieldOff className="mr-2 h-4 w-4 text-yellow-600" />
          <span className="text-yellow-700">Revocar Certificación</span>
        </DropdownMenuItem>
      )
    }
    if (supplier.status === "pending") {
      items.push(
        <DropdownMenuItem key="activate" onSelect={() => onVerification(supplier.id, "activate")}>
          <CheckCircle className="mr-2 h-4 w-4 text-blue-600" />
          <span className="text-blue-700">Marcar como Activo</span>
        </DropdownMenuItem>
      )
    }
    if (supplier.status !== "suspended" && supplier.status !== "blacklisted" && supplier.status !== "inactive") {
      items.push(
        <DropdownMenuItem key="suspend" onSelect={() => onVerification(supplier.id, "suspend")}>
          <AlertTriangle className="mr-2 h-4 w-4 text-red-600" />
          <span className="text-red-700">Suspender</span>
        </DropdownMenuItem>
      )
    }
    if (supplier.status === "suspended" || supplier.status === "inactive") {
      items.push(
        <DropdownMenuItem key="reactivate" onSelect={() => onVerification(supplier.id, "reactivate")}>
          <RotateCcw className="mr-2 h-4 w-4 text-blue-600" />
          <span className="text-blue-700">Reactivar</span>
        </DropdownMenuItem>
      )
    }
    return items
  }

  const renderRowActions = (supplier: Supplier) => (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        title="Ver detalles"
        asChild
      >
        <Link href={`/suppliers/${supplier.id}`} onClick={(e) => e.stopPropagation()}>
          <Eye className="h-4 w-4" />
        </Link>
      </Button>
      {canWrite && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          title="Editar"
          onClick={(e) => {
            e.stopPropagation()
            onEdit(supplier)
          }}
        >
          <Edit className="h-4 w-4" />
        </Button>
      )}
      {canWrite && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent modal={false} align="end">
            <DropdownMenuLabel>Cambiar Estado</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {renderStatusActions(supplier)}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )

  const handleRowClick = (supplier: Supplier) => {
    if (showSelection) {
      onSelectSupplier?.(supplier)
    } else {
      onNavigateToSupplier(supplier)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            {loading ? "Cargando..." : `${suppliers.length} proveedor${suppliers.length !== 1 ? "es" : ""}`}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
            <span className="ml-3 text-muted-foreground text-sm">Cargando proveedores...</span>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-16 px-4">
            <Package className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-medium text-muted-foreground">{emptyState.title}</p>
            <p className="text-sm text-muted-foreground/70 mt-1">{emptyState.desc}</p>
            {showEmptyCreate && canWrite && (
              <Button className="mt-4" onClick={onCreate}>
                <Plus className="w-4 h-4 mr-2" /> Agregar primer proveedor
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[280px] cursor-pointer select-none" onClick={() => onSortToggle("name")}>
                      Proveedor <SortIndicator field="name" />
                    </TableHead>
                    <TableHead>RFC</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => onSortToggle("total_orders")}>
                      Órdenes <SortIndicator field="total_orders" />
                    </TableHead>
                    <TableHead className="w-[100px] text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow
                      key={supplier.id}
                      className={`cursor-pointer group ${selectedSupplierId === supplier.id ? "bg-primary/5" : ""}`}
                      onClick={() => handleRowClick(supplier)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <SupplierAvatar supplier={supplier} />
                          <div className="min-w-0">
                            <div className="font-medium truncate flex items-center gap-1.5">
                              {supplier.name}
                              {isIncomplete(supplier) && (
                                <AlertTriangle
                                  className="w-3.5 h-3.5 text-amber-500 flex-shrink-0"
                                  title="Perfil incompleto: falta RFC o datos bancarios"
                                />
                              )}
                            </div>
                            {supplier.business_name && (
                              <div className="text-xs text-muted-foreground truncate">{supplier.business_name}</div>
                            )}
                            {supplier.industry && (
                              <div className="text-xs text-muted-foreground/60">
                                {supplier.industry.replace(/_/g, " ")}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {supplier.tax_id ? (
                          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                            {supplier.tax_id.slice(0, 4)}···{supplier.tax_id.slice(-3)}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600 font-medium">Sin RFC</span>
                        )}
                      </TableCell>
                      <TableCell>{getTypeBadge(supplier.supplier_type)}</TableCell>
                      <TableCell>{getStatusBadge(supplier.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="font-medium">{supplier.total_orders ?? 0}</span>
                          {supplier.avg_order_amount != null && supplier.avg_order_amount > 0 && (
                            <div className="text-xs text-muted-foreground">
                              ~${supplier.avg_order_amount.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        {changingStatusFor === supplier.id ? (
                          <div className="flex justify-end">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                          </div>
                        ) : (
                          renderRowActions(supplier)
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="lg:hidden divide-y">
              {suppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  role={showSelection ? "button" : "link"}
                  className={`block p-4 cursor-pointer active:bg-muted/50 transition-colors ${
                    selectedSupplierId === supplier.id ? "bg-primary/5" : ""
                  }`}
                  onClick={() => handleRowClick(supplier)}
                >
                  <div className="flex items-start gap-3 mb-2">
                    <SupplierAvatar supplier={supplier} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold">{supplier.name}</span>
                        {isIncomplete(supplier) && (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        )}
                      </div>
                      {supplier.business_name && (
                        <p className="text-xs text-muted-foreground mt-0.5">{supplier.business_name}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {getStatusBadge(supplier.status)}
                        {getTypeBadge(supplier.supplier_type)}
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                      {changingStatusFor === supplier.id ? (
                        <div className="flex justify-end p-1">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                        </div>
                      ) : (
                        renderRowActions(supplier)
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                    {supplier.tax_id ? (
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded">
                        {supplier.tax_id.slice(0, 4)}···{supplier.tax_id.slice(-3)}
                      </span>
                    ) : (
                      <span className="text-amber-600 font-medium">Sin RFC</span>
                    )}
                    {supplier.industry && <span>• {supplier.industry.replace(/_/g, " ")}</span>}
                    {supplier.city && <span>• {supplier.city}</span>}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{supplier.total_orders ?? 0}</span> órdenes
                    {supplier.avg_order_amount != null && supplier.avg_order_amount > 0 && (
                      <span>
                        · Prom. ${supplier.avg_order_amount.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
