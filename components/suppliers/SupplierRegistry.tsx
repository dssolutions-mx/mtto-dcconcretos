"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShieldCheck,
  ShieldOff,
  Ban,
  RotateCcw,
  X,
  Building2,
  Package,
  Users,
} from "lucide-react"
import { Supplier } from "@/types/suppliers"
import { createClient } from "@/lib/supabase"
import { SupplierForm } from "./SupplierForm"
import { SupplierDetails } from "./SupplierDetails"

interface SupplierRegistryProps {
  onSupplierSelect?: (supplier: Supplier) => void
  selectedSupplierId?: string
  showSelection?: boolean
  filterByType?: string
}

type SortField = 'name' | 'total_orders' | 'created_at'
type SortDirection = 'asc' | 'desc'

const TYPE_COLORS: Record<string, string> = {
  individual: "bg-blue-500",
  company: "bg-green-500",
  distributor: "bg-purple-500",
  manufacturer: "bg-orange-500",
  service_provider: "bg-cyan-500",
}

const TYPE_LABELS: Record<string, string> = {
  individual: "Individual",
  company: "Empresa",
  distributor: "Distribuidor",
  manufacturer: "Fabricante",
  service_provider: "Servicios",
  all: "Todos",
}

function SupplierAvatar({ supplier }: { supplier: Supplier }) {
  const initials = supplier.name
    .split(" ")
    .slice(0, 2)
    .map(w => w[0])
    .join("")
    .toUpperCase()
  const color = TYPE_COLORS[supplier.supplier_type] || "bg-gray-500"
  return (
    <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
      {initials}
    </div>
  )
}


export function SupplierRegistry({
  onSupplierSelect,
  selectedSupplierId,
  showSelection = false,
  filterByType,
}: SupplierRegistryProps) {
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>(filterByType || "all")
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  // Dialog state
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null)
  const [changingStatusFor, setChangingStatusFor] = useState<string | null>(null)

  useEffect(() => {
    loadSuppliers()
  }, [typeFilter])

  const loadSuppliers = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      let query = supabase.from("suppliers").select(`
        id, name, business_name, contact_person, supplier_type, status,
        rating, total_orders, avg_order_amount, reliability_score,
        tax_id, bank_account_info, industry, city, state, created_at
      `)

      if (typeFilter !== "all") {
        query = query.eq("supplier_type", typeFilter)
      }

      const { data, error } = await query
        .order("name", { ascending: true })

      if (error) {
        console.error("Error loading suppliers:", error)
        setAllSuppliers([])
        return
      }
      setAllSuppliers(data || [])
    } catch (error) {
      console.error("Error loading suppliers:", error)
      setAllSuppliers([])
    } finally {
      setLoading(false)
    }
  }

  // KPI counts from all loaded suppliers
  const counts = useMemo(() => ({
    total: allSuppliers.length,
    certified: allSuppliers.filter(s => s.status === "active_certified").length,
    active: allSuppliers.filter(s => s.status === "active").length,
    pending: allSuppliers.filter(s => s.status === "pending").length,
    issues: allSuppliers.filter(s => s.status === "suspended" || s.status === "blacklisted").length,
  }), [allSuppliers])

  const filteredAndSorted = useMemo(() => {
    let list = allSuppliers.filter(s => {
      const matchesStatus = statusFilter === "all" || s.status === statusFilter
      const matchesSearch =
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.tax_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.contact_person?.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesStatus && matchesSearch
    })

    list.sort((a, b) => {
      let av: any, bv: any
      switch (sortField) {
        case "name": av = a.name.toLowerCase(); bv = b.name.toLowerCase(); break
        case "total_orders": av = a.total_orders ?? 0; bv = b.total_orders ?? 0; break
        case "created_at": av = new Date(a.created_at).getTime(); bv = new Date(b.created_at).getTime(); break
        default: return 0
      }
      return sortDirection === "asc" ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
    })
    return list
  }, [allSuppliers, statusFilter, searchTerm, sortField, sortDirection])

  const isIncomplete = (s: Supplier) =>
    !s.tax_id || !(s.bank_account_info as any)?.account_number

  // Status configuration
  const STATUS_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
    pending:          { label: "Pendiente",    className: "bg-yellow-50 text-yellow-700 border-yellow-300",  icon: Clock },
    active:           { label: "Activo",       className: "bg-blue-50 text-blue-700 border-blue-300",        icon: CheckCircle },
    active_certified: { label: "Certificado",  className: "bg-green-50 text-green-700 border-green-300",     icon: ShieldCheck },
    inactive:         { label: "Inactivo",     className: "bg-gray-50 text-gray-600 border-gray-300",        icon: Clock },
    suspended:        { label: "Suspendido",   className: "bg-red-50 text-red-700 border-red-300",           icon: AlertTriangle },
    blacklisted:      { label: "Bloqueado",    className: "bg-red-100 text-red-800 border-red-400",          icon: Ban },
  }

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
      individual:       "bg-blue-50 text-blue-700 border-blue-200",
      company:          "bg-green-50 text-green-700 border-green-200",
      distributor:      "bg-purple-50 text-purple-700 border-purple-200",
      manufacturer:     "bg-orange-50 text-orange-700 border-orange-200",
      service_provider: "bg-cyan-50 text-cyan-700 border-cyan-200",
    }
    return <Badge className={`text-xs border ${colors[type] || colors.company}`}>{TYPE_LABELS[type] || type}</Badge>
  }

  const handleRowClick = (supplier: Supplier) => {
    if (showSelection) {
      onSupplierSelect?.(supplier)
    } else {
      setSelectedSupplier(supplier)
      setShowDetailsDialog(true)
    }
  }

  const handleEditFromDetails = () => {
    setShowDetailsDialog(false)
    setSupplierToEdit(selectedSupplier)
    setTimeout(() => setShowEditDialog(true), 100)
  }

  const handleChangeStatus = async (supplierId: string, newStatus: string) => {
    setChangingStatusFor(supplierId)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("suppliers")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", supplierId)
      if (!error) {
        setAllSuppliers(prev =>
          prev.map(s => s.id === supplierId ? { ...s, status: newStatus as any } : s)
        )
      } else {
        console.error("Error changing status:", error)
        alert("Error al cambiar el estado: " + error.message)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setChangingStatusFor(null)
    }
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDirection(d => d === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDirection("asc") }
  }

  const SortIndicator = ({ field }: { field: SortField }) =>
    sortField === field ? <span className="ml-1 text-primary">{sortDirection === "asc" ? "↑" : "↓"}</span> : null

  const getEmptyMessage = () => {
    if (searchTerm) return { title: "Sin resultados", desc: `No hay proveedores que coincidan con "${searchTerm}".` }
    const msgs: Record<string, { title: string; desc: string }> = {
      pending:          { title: "Sin proveedores pendientes", desc: "No hay proveedores esperando verificación." },
      active:           { title: "Sin proveedores activos", desc: "No hay proveedores activos actualmente." },
      active_certified: { title: "Sin proveedores certificados", desc: "Certifica proveedores activos desde el menú de acciones." },
      suspended:        { title: "Sin suspensiones", desc: "No hay proveedores suspendidos." },
      blacklisted:      { title: "Sin bloqueados", desc: "No hay proveedores bloqueados." },
    }
    return msgs[statusFilter] || { title: "Sin proveedores", desc: "Agrega tu primer proveedor." }
  }

  const renderStatusActions = (supplier: Supplier) => {
    const items = []
    if (supplier.status === "active") {
      items.push(
        <DropdownMenuItem key="certify" onSelect={() => handleChangeStatus(supplier.id, "active_certified")}>
          <ShieldCheck className="mr-2 h-4 w-4 text-green-600" />
          <span className="text-green-700">Promover a Certificado</span>
        </DropdownMenuItem>
      )
    }
    if (supplier.status === "active_certified") {
      items.push(
        <DropdownMenuItem key="uncertify" onSelect={() => handleChangeStatus(supplier.id, "active")}>
          <ShieldOff className="mr-2 h-4 w-4 text-yellow-600" />
          <span className="text-yellow-700">Revocar Certificación</span>
        </DropdownMenuItem>
      )
    }
    if (supplier.status === "pending") {
      items.push(
        <DropdownMenuItem key="activate" onSelect={() => handleChangeStatus(supplier.id, "active")}>
          <CheckCircle className="mr-2 h-4 w-4 text-blue-600" />
          <span className="text-blue-700">Marcar como Activo</span>
        </DropdownMenuItem>
      )
    }
    if (supplier.status !== "suspended" && supplier.status !== "blacklisted" && supplier.status !== "inactive") {
      items.push(
        <DropdownMenuItem key="suspend" onSelect={() => handleChangeStatus(supplier.id, "suspended")}>
          <AlertTriangle className="mr-2 h-4 w-4 text-red-600" />
          <span className="text-red-700">Suspender</span>
        </DropdownMenuItem>
      )
    }
    if (supplier.status === "suspended" || supplier.status === "inactive") {
      items.push(
        <DropdownMenuItem key="reactivate" onSelect={() => handleChangeStatus(supplier.id, "active")}>
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
        onClick={(e) => {
          e.stopPropagation()
          setSelectedSupplier(supplier)
          setShowDetailsDialog(true)
        }}
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        title="Editar"
        onClick={(e) => {
          e.stopPropagation()
          setSupplierToEdit(supplier)
          setShowEditDialog(true)
        }}
      >
        <Edit className="h-4 w-4" />
      </Button>
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
        {/* modal={false} prevents the Radix pointer-events bug when opening Dialogs from dropdowns */}
        <DropdownMenuContent modal={false} align="end">
          <DropdownMenuLabel>Cambiar Estado</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {renderStatusActions(supplier)}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  const KPI_CARDS = [
    { key: "all",              label: "Total",        count: counts.total,      color: "border-gray-200 hover:border-gray-400",     textColor: "text-gray-900",    icon: Users },
    { key: "active_certified", label: "Certificados", count: counts.certified,  color: "border-green-200 hover:border-green-400",   textColor: "text-green-700",   icon: ShieldCheck },
    { key: "active",           label: "Activos",      count: counts.active,     color: "border-blue-200 hover:border-blue-400",     textColor: "text-blue-700",    icon: CheckCircle },
    { key: "pending",          label: "Pendientes",   count: counts.pending,    color: "border-yellow-200 hover:border-yellow-400", textColor: "text-yellow-700",  icon: Clock },
    { key: "issues",           label: "Con Problemas",count: counts.issues,     color: "border-red-200 hover:border-red-400",       textColor: "text-red-700",     icon: AlertTriangle },
  ]

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Padrón de Proveedores</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestiona, evalúa y certifica tus proveedores</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Agregar Proveedor
        </Button>
      </div>

      {/* ── KPI Summary Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {KPI_CARDS.map(card => {
          const Icon = card.icon
          const isActive = statusFilter === card.key || (card.key === "issues" && (statusFilter === "suspended" || statusFilter === "blacklisted"))
          return (
            <button
              key={card.key}
              onClick={() => setStatusFilter(card.key === "issues" ? "suspended" : card.key)}
              className={`
                text-left p-3 rounded-lg border-2 transition-all cursor-pointer bg-card
                ${card.color}
                ${isActive ? "ring-2 ring-primary ring-offset-1" : ""}
              `}
            >
              <div className="flex items-center justify-between mb-1">
                <Icon className={`w-4 h-4 ${card.textColor}`} />
                <span className={`text-2xl font-bold ${card.textColor}`}>{loading ? "—" : card.count}</span>
              </div>
              <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
            </button>
          )
        })}
      </div>

      {/* ── Search & Type Filter ── */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, RFC o contacto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-8"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Type filter pills */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key)}
              className={`
                px-3 py-1 rounded-full text-sm border transition-all
                ${typeFilter === key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-foreground/40 hover:text-foreground"
                }
              `}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Active filters display */}
        {(statusFilter !== "all" || searchTerm) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Filtros activos:</span>
            {statusFilter !== "all" && (
              <Badge variant="secondary" className="flex items-center gap-1">
                {STATUS_CONFIG[statusFilter]?.label || statusFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setStatusFilter("all")} />
              </Badge>
            )}
            {searchTerm && (
              <Badge variant="secondary" className="flex items-center gap-1">
                "{searchTerm}"
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchTerm("")} />
              </Badge>
            )}
            <button className="text-xs underline hover:no-underline" onClick={() => { setStatusFilter("all"); setSearchTerm("") }}>
              Limpiar todos
            </button>
          </div>
        )}
      </div>

      {/* ── Main Table ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              {loading ? "Cargando..." : `${filteredAndSorted.length} proveedor${filteredAndSorted.length !== 1 ? "es" : ""}`}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
              <span className="ml-3 text-muted-foreground text-sm">Cargando proveedores...</span>
            </div>
          ) : filteredAndSorted.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Package className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-medium text-muted-foreground">{getEmptyMessage().title}</p>
              <p className="text-sm text-muted-foreground/70 mt-1">{getEmptyMessage().desc}</p>
              {statusFilter === "all" && !searchTerm && (
                <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Agregar primer proveedor
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* ── Desktop Table ── */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[280px] cursor-pointer select-none" onClick={() => toggleSort("name")}>
                        Proveedor <SortIndicator field="name" />
                      </TableHead>
                      <TableHead>RFC</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("total_orders")}>
                        Órdenes <SortIndicator field="total_orders" />
                      </TableHead>
                      <TableHead className="w-[100px] text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSorted.map(supplier => (
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
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" title="Perfil incompleto: falta RFC o datos bancarios" />
                                )}
                              </div>
                              {supplier.business_name && (
                                <div className="text-xs text-muted-foreground truncate">{supplier.business_name}</div>
                              )}
                              {supplier.industry && (
                                <div className="text-xs text-muted-foreground/60">{supplier.industry.replace(/_/g, " ")}</div>
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

              {/* ── Mobile Cards ── */}
              <div className="lg:hidden divide-y">
                {filteredAndSorted.map(supplier => (
                  <div
                    key={supplier.id}
                    className={`p-4 cursor-pointer active:bg-muted/50 transition-colors ${
                      selectedSupplierId === supplier.id ? "bg-primary/5" : ""
                    }`}
                    onClick={() => handleRowClick(supplier)}
                  >
                    {/* Header */}
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
                      <div onClick={(e) => e.stopPropagation()}>
                        {renderRowActions(supplier)}
                      </div>
                    </div>

                    {/* RFC + Industry */}
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

                    {/* Metrics */}
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{supplier.total_orders ?? 0}</span> órdenes
                      {supplier.avg_order_amount != null && supplier.avg_order_amount > 0 && (
                        <span>· Prom. ${supplier.avg_order_amount.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Create Dialog ── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agregar Nuevo Proveedor</DialogTitle>
            <DialogDescription>Registra un nuevo proveedor en el sistema</DialogDescription>
          </DialogHeader>
          <SupplierForm
            onSuccess={() => { setShowCreateDialog(false); loadSuppliers() }}
            onCancel={() => setShowCreateDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { setShowEditDialog(open); if (!open) setSupplierToEdit(null) }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Proveedor</DialogTitle>
            <DialogDescription>Modifica la información del proveedor</DialogDescription>
          </DialogHeader>
          {supplierToEdit && (
            <SupplierForm
              supplier={supplierToEdit}
              onSuccess={() => { setShowEditDialog(false); setSupplierToEdit(null); loadSuppliers() }}
              onCancel={() => { setShowEditDialog(false); setSupplierToEdit(null) }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Details Dialog ── */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles del Proveedor</DialogTitle>
            <DialogDescription>Información completa y métricas de rendimiento</DialogDescription>
          </DialogHeader>
          {selectedSupplier && (
            <SupplierDetails
              supplier={selectedSupplier}
              onClose={() => setShowDetailsDialog(false)}
              onEdit={handleEditFromDetails}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
