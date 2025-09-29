"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  MapPin,
  Phone,
  Mail,
  Building,
  Star,
  Award,
  Clock,
  DollarSign,
  TrendingUp,
  Users,
  Package,
  CheckCircle,
  AlertTriangle,
  Calendar,
  ExternalLink,
  Edit,
  MessageSquare,
  History,
  BarChart3
} from "lucide-react"
import { Supplier, SupplierContact, SupplierService, SupplierWorkHistory, SupplierPerformanceHistory } from "@/types/suppliers"
import { SupplierPerformanceChart } from "./SupplierPerformanceChart"

interface SupplierDetailsProps {
  supplier: Supplier
  onClose?: () => void
  onEdit?: (supplier: Supplier) => void
  showWorkHistory?: boolean
  showPerformanceHistory?: boolean
}

export function SupplierDetails({
  supplier,
  onClose,
  onEdit,
  showWorkHistory = true,
  showPerformanceHistory = true
}: SupplierDetailsProps) {
  const [contacts, setContacts] = useState<SupplierContact[]>([])
  const [services, setServices] = useState<SupplierService[]>([])
  const [workHistory, setWorkHistory] = useState<SupplierWorkHistory[]>([])
  const [performanceHistory, setPerformanceHistory] = useState<SupplierPerformanceHistory[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadSupplierDetails()
  }, [supplier.id])

  const loadSupplierDetails = async () => {
    setLoading(true)
    try {
      // Load contacts
      const contactsResponse = await fetch(`/api/suppliers/${supplier.id}/contacts`)
      const contactsData = await contactsResponse.json()
      setContacts(contactsData.contacts || [])

      // Load services
      const servicesResponse = await fetch(`/api/suppliers/${supplier.id}/services`)
      const servicesData = await servicesResponse.json()
      setServices(servicesData.services || [])

      // Load work history
      if (showWorkHistory) {
        const workHistoryResponse = await fetch(`/api/suppliers/${supplier.id}/work-history`)
        const workHistoryData = await workHistoryResponse.json()
        setWorkHistory(workHistoryData.history || [])
      }

      // Load performance history
      if (showPerformanceHistory) {
        const performanceResponse = await fetch(`/api/suppliers/${supplier.id}/performance`)
        const performanceData = await performanceResponse.json()
        setPerformanceHistory(performanceData.history || [])
      }
    } catch (error) {
      console.error('Error loading supplier details:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { variant: "default" as const, icon: CheckCircle, label: "Activo", color: "text-green-600" },
      inactive: { variant: "secondary" as const, icon: Clock, label: "Inactivo", color: "text-gray-600" },
      suspended: { variant: "destructive" as const, icon: AlertTriangle, label: "Suspendido", color: "text-red-600" },
      blacklisted: { variant: "destructive" as const, icon: AlertTriangle, label: "Bloqueado", color: "text-red-600" }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className={`w-3 h-3 ${config.color}`} />
        {config.label}
      </Badge>
    )
  }

  const getTypeBadge = (type: string) => {
    const typeConfig = {
      individual: { color: "bg-blue-50 text-blue-700 border-blue-200", label: "Individual" },
      company: { color: "bg-green-50 text-green-700 border-green-200", label: "Empresa" },
      distributor: { color: "bg-purple-50 text-purple-700 border-purple-200", label: "Distribuidor" },
      manufacturer: { color: "bg-orange-50 text-orange-700 border-orange-200", label: "Fabricante" },
      service_provider: { color: "bg-cyan-50 text-cyan-700 border-cyan-200", label: "Proveedor de Servicios" }
    }

    const config = typeConfig[type as keyof typeof typeConfig] || typeConfig.company

    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    )
  }

  const primaryContact = contacts.find(contact => contact.is_primary)
  const activeServices = services.filter(service => service.is_active)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">{supplier.name}</h2>
            {getStatusBadge(supplier.status)}
            {getTypeBadge(supplier.supplier_type)}
          </div>
          {supplier.business_name && (
            <p className="text-lg text-muted-foreground">{supplier.business_name}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {supplier.industry && (
              <div className="flex items-center gap-1">
                <Building className="w-4 h-4" />
                {supplier.industry}
              </div>
            )}
            {supplier.city && supplier.state && (
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {supplier.city}, {supplier.state}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onEdit?.(supplier)}>
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Calificación</p>
                <p className="text-2xl font-bold">{supplier.rating?.toFixed(1) || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Confiabilidad</p>
                <p className="text-2xl font-bold">{supplier.reliability_score?.toFixed(0) || 'N/A'}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Órdenes Totales</p>
                <p className="text-2xl font-bold">{supplier.total_orders || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Monto Promedio</p>
                <p className="text-2xl font-bold">
                  ${supplier.avg_order_amount?.toLocaleString() || 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Información General</TabsTrigger>
          <TabsTrigger value="contacts">Contactos</TabsTrigger>
          <TabsTrigger value="services">Servicios</TabsTrigger>
          {showWorkHistory && <TabsTrigger value="work-history">Historial de Trabajo</TabsTrigger>}
          {showPerformanceHistory && <TabsTrigger value="performance">Rendimiento</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Información de Contacto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {primaryContact ? (
                  <>
                    <div>
                      <p className="text-sm font-medium">Contacto Principal</p>
                      <p className="font-semibold">{primaryContact.name}</p>
                      {primaryContact.position && (
                        <p className="text-sm text-muted-foreground">{primaryContact.position}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      {primaryContact.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <a href={`mailto:${primaryContact.email}`} className="text-blue-600 hover:underline">
                            {primaryContact.email}
                          </a>
                        </div>
                      )}
                      {primaryContact.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <a href={`tel:${primaryContact.phone}`} className="text-blue-600 hover:underline">
                            {primaryContact.phone}
                          </a>
                        </div>
                      )}
                      {primaryContact.mobile_phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <a href={`tel:${primaryContact.mobile_phone}`} className="text-blue-600 hover:underline">
                            {primaryContact.mobile_phone}
                          </a>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">No hay contacto principal asignado</p>
                )}
              </CardContent>
            </Card>

            {/* Business Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Información Empresarial
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Tipo de Proveedor</p>
                  <p className="capitalize">{supplier.supplier_type.replace('_', ' ')}</p>
                </div>
                {supplier.industry && (
                  <div>
                    <p className="text-sm font-medium">Industria</p>
                    <p>{supplier.industry}</p>
                  </div>
                )}
                {supplier.specialties && supplier.specialties.length > 0 && (
                  <div>
                    <p className="text-sm font-medium">Especialidades</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {supplier.specialties.map((specialty, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {supplier.payment_terms && (
                  <div>
                    <p className="text-sm font-medium">Términos de Pago</p>
                    <p className="capitalize">{supplier.payment_terms.replace('_', ' ')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Address */}
          {supplier.address && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Dirección
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p>{supplier.address}</p>
                  {supplier.city && supplier.state && (
                    <p>{supplier.city}, {supplier.state} {supplier.postal_code}</p>
                  )}
                  {supplier.country && supplier.country !== 'México' && (
                    <p>{supplier.country}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle>Contactos</CardTitle>
              <CardDescription>
                Todos los contactos registrados para este proveedor
              </CardDescription>
            </CardHeader>
            <CardContent>
              {contacts.length > 0 ? (
                <div className="space-y-4">
                  {contacts.map((contact) => (
                    <div key={contact.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{contact.name}</h4>
                            {contact.is_primary && (
                              <Badge variant="default" className="text-xs">Principal</Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {contact.contact_type}
                            </Badge>
                          </div>
                          {contact.position && (
                            <p className="text-sm text-muted-foreground">{contact.position}</p>
                          )}
                          <div className="flex gap-4 text-sm">
                            {contact.email && (
                              <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                                <Mail className="w-3 h-3" />
                                {contact.email}
                              </a>
                            )}
                            {contact.phone && (
                              <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                                <Phone className="w-3 h-3" />
                                {contact.phone}
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <MessageSquare className="w-3 h-3 mr-1" />
                            Contactar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No hay contactos registrados
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <Card>
            <CardHeader>
              <CardTitle>Servicios Ofrecidos</CardTitle>
              <CardDescription>
                Servicios y productos disponibles de este proveedor
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeServices.length > 0 ? (
                <div className="space-y-4">
                  {activeServices.map((service) => (
                    <div key={service.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{service.service_name}</h4>
                            <Badge variant="outline">{service.service_category}</Badge>
                          </div>
                          {service.description && (
                            <p className="text-sm text-muted-foreground">{service.description}</p>
                          )}
                          <div className="flex gap-4 text-sm text-muted-foreground">
                            {service.unit_cost && (
                              <div className="flex items-center gap-1">
                                <DollarSign className="w-3 h-3" />
                                ${service.unit_cost} / {service.unit_of_measure}
                              </div>
                            )}
                            {service.lead_time_days && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {service.lead_time_days} días de entrega
                              </div>
                            )}
                            {service.warranty_period && (
                              <div className="flex items-center gap-1">
                                <Award className="w-3 h-3" />
                                Garantía: {service.warranty_period}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No hay servicios registrados
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {showWorkHistory && (
          <TabsContent value="work-history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Historial de Trabajo
                </CardTitle>
                <CardDescription>
                  Trabajos realizados por este proveedor
                </CardDescription>
              </CardHeader>
              <CardContent>
                {workHistory.length > 0 ? (
                  <div className="space-y-4">
                    {workHistory.slice(0, 10).map((work) => (
                      <div key={work.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{work.work_type}</Badge>
                              <span className="text-sm text-muted-foreground">
                                {new Date(work.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            {work.problem_description && (
                              <p className="text-sm">{work.problem_description}</p>
                            )}
                            {work.solution_description && (
                              <p className="text-sm text-green-600">{work.solution_description}</p>
                            )}
                            <div className="flex gap-4 text-sm text-muted-foreground">
                              {work.total_cost && (
                                <span>Costo: ${work.total_cost.toLocaleString()}</span>
                              )}
                              {work.labor_hours && (
                                <span>Horas: {work.labor_hours}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {work.completed_on_time && (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                            {work.quality_satisfaction && (
                              <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-yellow-500" />
                                <span className="text-sm">{work.quality_satisfaction}/5</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {workHistory.length > 10 && (
                      <p className="text-center text-sm text-muted-foreground">
                        Mostrando 10 de {workHistory.length} trabajos
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No hay historial de trabajo registrado
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {showPerformanceHistory && (
          <TabsContent value="performance">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Métricas de Rendimiento
                  </CardTitle>
                  <CardDescription>
                    Análisis del rendimiento histórico del proveedor
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SupplierPerformanceChart
                    supplierId={supplier.id}
                    timeRange="1y"
                    metrics={['rating', 'reliability', 'delivery_time', 'cost_accuracy']}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Historial de Rendimiento</CardTitle>
                  <CardDescription>
                    Evaluaciones individuales de cada orden completada
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {performanceHistory.length > 0 ? (
                    <div className="space-y-4">
                      {performanceHistory.slice(0, 10).map((performance) => (
                        <div key={performance.id} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {new Date(performance.order_date).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="flex gap-4 text-sm">
                                {performance.quality_rating && (
                                  <div className="flex items-center gap-1">
                                    <Star className="w-3 h-3 text-yellow-500" />
                                    <span>Calidad: {performance.quality_rating}/5</span>
                                  </div>
                                )}
                                {performance.delivery_rating && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-blue-500" />
                                    <span>Entrega: {performance.delivery_rating}/5</span>
                                  </div>
                                )}
                                {performance.service_rating && (
                                  <div className="flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3 text-green-500" />
                                    <span>Servicio: {performance.service_rating}/5</span>
                                  </div>
                                )}
                              </div>
                              {performance.quoted_cost && performance.actual_cost && (
                                <div className="text-sm">
                                  <span className="text-muted-foreground">Presupuesto: </span>
                                  <span className="font-medium">
                                    ${performance.quoted_cost.toLocaleString()}
                                  </span>
                                  <span className="text-muted-foreground"> | Real: </span>
                                  <span className="font-medium">
                                    ${performance.actual_cost.toLocaleString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      No hay historial de rendimiento registrado
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
