"use client"

import { useState } from "react"
import { Control, useWatch } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DateInput } from "@/components/ui/date-input"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ModelSelector } from "../model-selector"
import { PlantSelectorField } from "@/components/ui/plant-selector"
import { DepartmentSelectorField } from "@/components/ui/department-selector"
import { cn } from "@/lib/utils"
import { EquipmentModelWithIntervals } from "@/types"

interface FormValues {
  assetId: string
  name: string
  serialNumber: string
  plantId: string
  departmentId: string
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
  setIsNewEquipment: (isNew: boolean) => void
}

export function GeneralInfoTab({
  control,
  selectedModel,
  onModelSelect,
  isNewEquipment,
  setIsNewEquipment,
}: GeneralInfoTabProps) {
  // Watch plantId to pass it to department selector
  const plantId = useWatch({ control, name: "plantId" })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Información General</CardTitle>
        <CardDescription>
          Datos básicos de identificación del activo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center space-x-2">
          <Switch
            id="is-new"
            checked={isNewEquipment}
            onCheckedChange={setIsNewEquipment}
          />
          <Label htmlFor="is-new">
            {isNewEquipment ? "Equipo nuevo" : "Equipo usado"}
          </Label>
        </div>

        {!isNewEquipment && (
          <div className="p-4 border rounded-md bg-yellow-50">
            <h4 className="font-medium text-yellow-800 mb-2">Equipo Usado</h4>
            <p className="text-sm text-yellow-700">
              Para equipos usados, asegúrese de registrar el historial de mantenimiento 
              e incidentes previos en las pestañas correspondientes.
            </p>
          </div>
        )}

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
                {selectedModel.maintenanceIntervals && selectedModel.maintenanceIntervals.length > 0 && (
                  <div className="col-span-2">
                    <span className="font-medium">Intervalos de Mantenimiento:</span>
                    <div className="mt-1 space-y-1">
                      {selectedModel.maintenanceIntervals.slice(0, 3).map((interval: any, index: number) => (
                        <div key={index} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {interval.description || interval.type} - {interval.interval_value}h
                        </div>
                      ))}
                      {selectedModel.maintenanceIntervals.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{selectedModel.maintenanceIntervals.length - 3} más...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <FormField
          control={control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del Activo</FormLabel>
              <FormControl>
                <Input placeholder="Excavadora CAT 320" {...field} />
              </FormControl>
              <FormDescription>Nombre descriptivo del activo</FormDescription>
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
                <Input placeholder="ABC123456789" {...field} />
              </FormControl>
              <FormDescription>Número de serie del fabricante</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={control}
            name="plantId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Planta</FormLabel>
                <FormControl>
                  <PlantSelectorField
                    control={control}
                    name="plantId"
                    label=""
                    description=""
                    required={true}
                    placeholder="Seleccionar planta"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="departmentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Departamento</FormLabel>
                <FormControl>
                  <DepartmentSelectorField
                    control={control}
                    name="departmentId"
                    label=""
                    description=""
                    required={true}
                    placeholder="Seleccionar departamento"
                    plantId={plantId}
                  />
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
      </CardContent>
    </Card>
  )
} 