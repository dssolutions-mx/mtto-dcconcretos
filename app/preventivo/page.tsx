'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";

export default function PreventiveMaintenancePage() {
  const router = useRouter();
  
  // Redirect to calendar page after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/calendario');
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [router]);
  
  return (
    <DashboardShell>
      <DashboardHeader
        heading="Mantenimiento Preventivo"
        text="Redirigiendo al Calendario de Mantenimientos..."
      />
      
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6 text-center space-y-6">
          <div className="flex justify-center">
            <div className="relative">
              <Calendar className="h-16 w-16 text-blue-500" />
              <div className="absolute -top-1 -right-1">
                <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Funcionalidad Unificada</h2>
            <p className="text-muted-foreground">
              El mantenimiento preventivo ahora está integrado con el calendario para una mejor experiencia de usuario.
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
              <h3 className="font-medium text-blue-900 mb-2">Nueva ubicación de funciones:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Visualización de mantenimientos programados</li>
                <li>• Calendario interactivo con indicadores de estado</li>
                <li>• Filtrado por vencidos, próximos y programados</li>
                <li>• Enlaces directos para registrar mantenimientos</li>
              </ul>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild>
                <Link href="/calendario">
                  <Calendar className="mr-2 h-4 w-4" />
                  Ir al Calendario
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              
              <Button variant="outline" asChild>
                <Link href="/dashboard">
                  Volver al Dashboard
                </Link>
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Serás redirigido automáticamente en unos segundos...
            </p>
          </div>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
