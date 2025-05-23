"use client"

import { useState } from "react"
import { Control } from "react-hook-form"


import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DateInput } from "@/components/ui/date-input"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ModelSelector } from "../model-selector"
import { cn } from "@/lib/utils"
import { EquipmentModelWithIntervals } from "@/types"

interface FormValues {
  assetId: string
  name: string
  serialNumber: string
  location: string
  department: string
  purchaseDate: Date
  installationDate?: Date
  initialHours: string
  currentHours: string
  status: string
  notes?: string
  warrantyExpiration?: Date
  isNew: boolean
  registrationInfo?: string
}

interface GeneralInfoTabProps {
  control: Control<FormValues>
  selectedModel: EquipmentModelWithIntervals | null
  onModelSelect: (model: EquipmentModelWithIntervals | null) => void
  isNewEquipment: boolean
  setIsNewEquipment: (value: boolean) => void
}

export function GeneralInfoTab({
  control,
  selectedModel,
  onModelSelect,
  isNewEquipment,
  setIsNewEquipment,
}: GeneralInfoTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Información General del Activo</CardTitle>
        <CardDescription>
          Ingrese la información básica del activo y seleccione el modelo de equipo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <FormField
              control={control}
              name="isNew"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked)
                        setIsNewEquipment(checked)
                      }}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Equipo nuevo</FormLabel>
                    <FormDescription>
                      {field.value
                        ? "El equipo es nuevo y no tiene historial de mantenimiento previo"
                        : "El equipo es usado y tiene historial de mantenimiento previo"}
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={control}
            name="assetId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ID del Activo</FormLabel>
                <FormControl>
                  <Input placeholder="EQ-0001" {...field} />
                </FormControl>
                <FormDescription>Identificador único para este activo</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-2">
            <Label>Modelo de Equipo</Label>
            <ModelSelector onModelSelect={onModelSelect} />
            <p className="text-sm text-muted-foreground">Seleccione un modelo de equipo existente</p>

            {selectedModel && (
              <div className="mt-4 p-4 border rounded-md bg-muted/50">
                <h4 className="font-medium mb-2">Información del Modelo Seleccionado</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium">ID:</span> {selectedModel.id}
                  </div>
                  <div>
                    <span className="font-medium">Nombre:</span> {selectedModel.name}
                  </div>
                  <div>
                    <span className="font-medium">Fabricante:</span> {selectedModel.manufacturer}
                  </div>
                  <div>
                    <span className="font-medium">Categoría:</span> {selectedModel.category}
                  </div>
                </div>
                <div className="mt-2">
                  <span className="font-medium text-sm">Intervalos de Mantenimiento:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedModel.maintenanceIntervals && selectedModel.maintenanceIntervals.length > 0 ? (
                      selectedModel.maintenanceIntervals.map((interval, index) => (
                        <div key={index} className="text-xs px-2 py-1 bg-primary/10 rounded-md">
                          {interval.hours}h ({interval.type})
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        {selectedModel.maintenanceIntervals ? 'No hay intervalos configurados' : 'Cargando intervalos...'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Activo</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre del activo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="serialNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número de Serie</FormLabel>
                  <FormControl>
                    <Input placeholder="SN-12345678" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ubicación</FormLabel>
                  <FormControl>
                    <Input placeholder="Planta 1, Área de Producción" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="department"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Departamento</FormLabel>
                  <FormControl>
                    <Input placeholder="Producción" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={control}
              name="purchaseDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha de Adquisición</FormLabel>
                  <FormControl>
                    <DateInput
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="dd/mm/aaaa"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar estado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="operational">Operativo</SelectItem>
                      <SelectItem value="maintenance">En Mantenimiento</SelectItem>
                      <SelectItem value="repair">En Reparación</SelectItem>
                      <SelectItem value="inactive">Inactivo</SelectItem>
                      <SelectItem value="retired">Retirado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={control}
            name="registrationInfo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Información de Registro</FormLabel>
                <FormControl>
                  <Input placeholder="Placa, matrícula, etc." {...field} />
                </FormControl>
                <FormDescription>Información de registro del activo (placa de vehículo, etc.)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  )
} 