"use client"

import { useState, useMemo, useCallback } from "react"
import { DollarSign } from "lucide-react"

import { Button } from "@/components/ui/button"
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface PartDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddPart: (name: string, partNumber: string, quantity: number, cost: string) => void
}

export function PartDialog({
  open,
  onOpenChange,
  onAddPart
}: PartDialogProps) {
  const [name, setName] = useState("")
  const [partNumber, setPartNumber] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [cost, setCost] = useState("")

  const handleSubmit = useCallback(() => {
    if (name && quantity > 0) {
      onAddPart(name, partNumber, quantity, cost)
      resetForm()
      onOpenChange(false)
    }
  }, [name, partNumber, quantity, cost, onAddPart, onOpenChange])

  const resetForm = useCallback(() => {
    setName("")
    setPartNumber("")
    setQuantity(1)
    setCost("")
  }, [])

  const isFormValid = useMemo(() => {
    return name.trim() !== '' && quantity > 0
  }, [name, quantity])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm()
      onOpenChange(isOpen)
    }}>
      <DialogContent className="max-w-[500px]" style={{ touchAction: 'pan-y' }}>
        <DialogHeader>
          <DialogTitle>Agregar Repuesto</DialogTitle>
          <DialogDescription>Ingrese la información del repuesto utilizado</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="partName">Nombre del Repuesto</Label>
            <Input
              id="partName"
              placeholder="Ej: Filtro de aceite"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="partNumber">Número de Parte</Label>
            <Input
              id="partNumber"
              placeholder="Ej: FO-1234"
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="partQuantity">Cantidad</Label>
              <Input
                id="partQuantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Number.parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="partCost">Costo</Label>
              <div className="relative">
                <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="partCost"
                  placeholder="0.00"
                  className="pl-8"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isFormValid}>
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 