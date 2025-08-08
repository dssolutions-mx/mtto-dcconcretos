"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Menu, Info, User, MapPin, Calendar, Clipboard } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

type ChecklistSchedule = {
  id: string
  scheduled_date: string
  checklists: {
    id: string
    name: string
    description?: string
  }
  assets: {
    id: string
    name: string
    asset_id: string
    location: string
  }
  profiles?: {
    id: string
    nombre: string
    apellido: string
  }
}

export function MobileExecutionHeader({ schedule }: { schedule: ChecklistSchedule | null }) {
  const [open, setOpen] = useState(false)
  
  if (!schedule) return null
  
  const checklist = schedule.checklists
  const asset = schedule.assets
  
  return (
    <div className="lg:hidden sticky top-0 z-10 bg-background border-b py-2 px-4 flex justify-between items-center">
      <div className="flex items-center space-x-2">
        <Clipboard className="h-5 w-5 text-primary" />
        <div className="font-medium truncate max-w-[180px]">{checklist.name}</div>
      </div>
      
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Detalles de la Inspección</SheetTitle>
            <SheetDescription>
              Información sobre el activo y el checklist
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            <div className="flex items-start space-x-3">
              <Clipboard className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Checklist</div>
                <div className="text-sm text-muted-foreground">{checklist.name}</div>
                {checklist.description && (
                  <div className="text-sm mt-1">{checklist.description}</div>
                )}
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Info className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Activo</div>
                <div className="text-sm text-muted-foreground">{asset.name}</div>
                <div className="text-sm">{asset.asset_id}</div>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <MapPin className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Ubicación</div>
                <div className="text-sm">{(asset as any).plants?.name || asset.location || 'Sin planta'}</div>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Calendar className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <div className="font-medium">Fecha Programada</div>
                <div className="text-sm">
                  {format(new Date((schedule as any).scheduled_day || schedule.scheduled_date), "PPP", { locale: es })}
                </div>
              </div>
            </div>
            
            {schedule.profiles && (
              <div className="flex items-start space-x-3">
                <User className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <div className="font-medium">Técnico Asignado</div>
                  <div className="text-sm">
                    {schedule.profiles.nombre} {schedule.profiles.apellido}
                  </div>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
} 