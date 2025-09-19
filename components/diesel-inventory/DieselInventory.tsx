"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuthZustand } from "@/hooks/use-auth-zustand"

import { OverviewTab } from "./tabs/OverviewTab"
import { TransactionsTab } from "./tabs/TransactionsTab"
import { AssetMappingTab } from "./tabs/AssetMappingTab"
import { ReconciliationTab } from "./tabs/ReconciliationTab"
import { ImportMigrationTab } from "./tabs/ImportMigrationTab"
import { ReportsTab } from "./tabs/ReportsTab"

export default function DieselInventory() {
  const { profile } = useAuthZustand()
  const [activeTab, setActiveTab] = useState("overview")

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Inventario de Diesel</CardTitle>
          <CardDescription>
            Gestión de transacciones, conciliaciones, mapeo de activos y migración desde el sistema anterior
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-6">
              <TabsTrigger value="overview">General</TabsTrigger>
              <TabsTrigger value="transactions">Transacciones</TabsTrigger>
              <TabsTrigger value="mapping">Mapeo de Activos</TabsTrigger>
              <TabsTrigger value="reconciliation">Conciliación</TabsTrigger>
              <TabsTrigger value="import">Importación/Migración</TabsTrigger>
              <TabsTrigger value="reports">Reportes</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <OverviewTab plantId={profile?.plant_id || null} />
            </TabsContent>
            <TabsContent value="transactions">
              <TransactionsTab plantId={profile?.plant_id || null} />
            </TabsContent>
            <TabsContent value="mapping">
              <AssetMappingTab />
            </TabsContent>
            <TabsContent value="reconciliation">
              <ReconciliationTab />
            </TabsContent>
            <TabsContent value="import">
              <ImportMigrationTab />
            </TabsContent>
            <TabsContent value="reports">
              <ReportsTab />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}


