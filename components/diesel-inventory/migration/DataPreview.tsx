"use client"

import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { 
  Eye,
  Filter,
  AlertTriangle,
  CheckCircle,
  Search,
  BarChart3,
  Fuel,
  Building,
  Calendar,
  Truck
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useDieselStore } from '@/store/diesel-store'
import { DieselExcelRow } from '@/types/diesel'

interface DataPreviewProps {
  onProceedToMapping?: () => void
}

const ROWS_PER_PAGE = 50

export function DataPreview({ onProceedToMapping }: DataPreviewProps) {
  const { parsedData, validateExcelData } = useDieselStore()
  
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPlant, setFilterPlant] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [showValidation, setShowValidation] = useState(false)

  // Validation results
  const validationResults = useMemo(() => {
    if (parsedData.length === 0) return null
    return validateExcelData(parsedData)
  }, [parsedData, validateExcelData])

  // Get unique plants and types for filtering
  const { uniquePlants, uniqueTypes } = useMemo(() => {
    const plants = [...new Set(parsedData.map(row => row.planta).filter(Boolean))].sort()
    const types = [...new Set(parsedData.map(row => row.tipo).filter(Boolean))].sort()
    return { uniquePlants: plants, uniqueTypes: types }
  }, [parsedData])

  // Filter and search data
  const filteredData = useMemo(() => {
    let filtered = parsedData

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(row => 
        Object.values(row).some(value => 
          value?.toString().toLowerCase().includes(term)
        )
      )
    }

    // Apply plant filter
    if (filterPlant !== 'all') {
      filtered = filtered.filter(row => row.planta === filterPlant)
    }

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(row => row.tipo === filterType)
    }

    return filtered
  }, [parsedData, searchTerm, filterPlant, filterType])

  // Pagination
  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE)
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE
  const endIndex = startIndex + ROWS_PER_PAGE
  const paginatedData = filteredData.slice(startIndex, endIndex)

  // Data statistics
  const stats = useMemo(() => {
    const totalQuantity = parsedData.reduce((sum, row) => {
      const quantity = parseFloat(row.litros_cantidad) || 0
      return sum + quantity
    }, 0)

    const entriesCount = parsedData.filter(row => row.tipo === 'Entrada').length
    const consumptionCount = parsedData.filter(row => row.tipo === 'Salida').length
    const uniqueAssets = new Set(parsedData.map(row => row.unidad).filter(Boolean)).size

    return {
      totalRows: parsedData.length,
      totalQuantity: totalQuantity.toFixed(2),
      entriesCount,
      consumptionCount,
      uniqueAssets,
      plantsCount: uniquePlants.length
    }
  }, [parsedData, uniquePlants.length])

  // Get validation status for a row
  const getRowValidationStatus = (rowIndex: number) => {
    if (!validationResults) return 'valid'
    
    const hasError = validationResults.errors.some(error => error.rowNumber === rowIndex + 1)
    const hasWarning = validationResults.warnings.some(warning => warning.rowNumber === rowIndex + 1)
    
    if (hasError) return 'error'
    if (hasWarning) return 'warning'
    return 'valid'
  }

  if (parsedData.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center space-y-2">
            <Eye className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">No hay datos para previsualizar</p>
            <p className="text-sm text-muted-foreground">Sube un archivo Excel primero</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Data Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{stats.totalRows}</div>
                <div className="text-xs text-muted-foreground">Registros</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Fuel className="h-4 w-4 text-orange-600" />
              <div>
                <div className="text-2xl font-bold">{stats.totalQuantity}</div>
                <div className="text-xs text-muted-foreground">Litros</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{stats.uniqueAssets}</div>
                <div className="text-xs text-muted-foreground">Activos</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-purple-600" />
              <div>
                <div className="text-2xl font-bold">{stats.plantsCount}</div>
                <div className="text-xs text-muted-foreground">Plantas</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Type Breakdown */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-green-600">{stats.entriesCount}</div>
                <div className="text-sm text-muted-foreground">Entradas</div>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {((stats.entriesCount / stats.totalRows) * 100).toFixed(1)}%
              </Badge>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-red-600">{stats.consumptionCount}</div>
                <div className="text-sm text-muted-foreground">Salidas</div>
              </div>
              <Badge variant="secondary" className="bg-red-100 text-red-800">
                {((stats.consumptionCount / stats.totalRows) * 100).toFixed(1)}%
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Validation Results */}
      {validationResults && (validationResults.errors.length > 0 || validationResults.warnings.length > 0) && (
        <div className="space-y-2">
          {validationResults.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Errores de Validación ({validationResults.errors.length})</AlertTitle>
              <AlertDescription>
                Se encontraron errores que deben corregirse antes del procesamiento
              </AlertDescription>
            </Alert>
          )}
          
          {validationResults.warnings.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Advertencias ({validationResults.warnings.length})</AlertTitle>
              <AlertDescription>
                Se encontraron advertencias que podrían afectar la calidad de los datos
              </AlertDescription>
            </Alert>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowValidation(!showValidation)}
          >
            {showValidation ? 'Ocultar' : 'Mostrar'} Detalles de Validación
          </Button>
        </div>
      )}

      {/* Validation Details */}
      {showValidation && validationResults && (
        <Card>
          <CardHeader>
            <CardTitle>Detalles de Validación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {validationResults.errors.length > 0 && (
              <div>
                <h4 className="font-medium text-red-600 mb-2">Errores:</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {validationResults.errors.map((error, index) => (
                    <div key={index} className="text-sm p-2 bg-red-50 rounded">
                      <span className="font-medium">Fila {error.rowNumber}:</span> {error.message}
                      {error.value && (
                        <span className="text-muted-foreground"> (valor: "{error.value}")</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {validationResults.warnings.length > 0 && (
              <div>
                <h4 className="font-medium text-yellow-600 mb-2">Advertencias:</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {validationResults.warnings.map((warning, index) => (
                    <div key={index} className="text-sm p-2 bg-yellow-50 rounded">
                      <span className="font-medium">Fila {warning.rowNumber}:</span> {warning.message}
                      {warning.suggestion && (
                        <div className="text-muted-foreground mt-1">
                          Sugerencia: {warning.suggestion}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros y Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Buscar en datos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Planta</Label>
              <Select value={filterPlant} onValueChange={setFilterPlant}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las plantas</SelectItem>
                  {uniquePlants.map(plant => (
                    <SelectItem key={plant} value={plant}>
                      {plant}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {uniqueTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm('')
                  setFilterPlant('all')
                  setFilterType('all')
                  setCurrentPage(1)
                }}
              >
                Limpiar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Preview de Datos</CardTitle>
              <CardDescription>
                Mostrando {startIndex + 1}-{Math.min(endIndex, filteredData.length)} de {filteredData.length} registros
                {filteredData.length !== parsedData.length && ` (filtrado de ${parsedData.length} total)`}
              </CardDescription>
            </div>
            {validationResults?.isValid && (
              <Button onClick={onProceedToMapping}>
                Continuar con Mapeo
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Planta</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Litros</TableHead>
                  <TableHead>Horómetro</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.map((row, index) => {
                  const globalIndex = startIndex + index
                  const validationStatus = getRowValidationStatus(globalIndex)
                  
                  return (
                    <TableRow
                      key={globalIndex}
                      className={cn(
                        validationStatus === 'error' && "bg-red-50",
                        validationStatus === 'warning' && "bg-yellow-50"
                      )}
                    >
                      <TableCell className="font-medium">
                        {globalIndex + 1}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.planta}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={row.tipo === 'Entrada' ? 'default' : 'secondary'}
                          className={
                            row.tipo === 'Entrada' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }
                        >
                          {row.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {row.unidad || (
                          <span className="text-muted-foreground italic">Sin especificar</span>
                        )}
                      </TableCell>
                      <TableCell>{row.fecha_}</TableCell>
                      <TableCell className="font-mono">
                        {parseFloat(row.litros_cantidad || '0').toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono">
                        {row.horometro || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.responsable_unidad || (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {validationStatus === 'valid' && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Válido
                          </Badge>
                        )}
                        {validationStatus === 'warning' && (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Advertencia
                          </Badge>
                        )}
                        {validationStatus === 'error' && (
                          <Badge variant="destructive">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Error
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink 
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  })}
                  
                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
