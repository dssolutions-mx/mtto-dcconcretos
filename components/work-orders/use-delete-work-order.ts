"use client"

import { useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { WorkOrderWithAsset } from "@/types"

const cleanupModalState = (callback: () => void, delay: number = 100) => {
  setTimeout(() => {
    callback()
    const modalOverlays = document.querySelectorAll(
      "[data-radix-focus-guard], [data-radix-scroll-lock-wrapper]"
    )
    modalOverlays.forEach((overlay) => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay)
      }
    })
    if (document.activeElement && document.activeElement !== document.body) {
      (document.activeElement as HTMLElement).blur()
    }
    document.body.focus()
    document.body.removeAttribute("aria-hidden")
    document.body.style.removeProperty("pointer-events")
  }, delay)
}

export interface UseDeleteWorkOrderOptions {
  onDeleted?: (order: WorkOrderWithAsset) => void
}

export function useDeleteWorkOrder(options: UseDeleteWorkOrderOptions = {}) {
  const { onDeleted } = options
  const { toast } = useToast()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<WorkOrderWithAsset | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const openDelete = useCallback((order: WorkOrderWithAsset) => {
    setOrderToDelete(order)
    setDeleteDialogOpen(true)
  }, [])

  const confirmDelete = useCallback(async () => {
    if (!orderToDelete) return

    setIsDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("work_orders")
        .delete()
        .eq("id", orderToDelete.id)

      if (error) {
        console.error("Error al eliminar orden de trabajo:", error)
        toast({
          title: "Error",
          description:
            "No se pudo eliminar la orden de trabajo. Por favor, intente nuevamente.",
          variant: "destructive",
        })
        setIsDeleting(false)
      } else {
        toast({
          title: "Orden eliminada",
          description: `La orden de trabajo ${orderToDelete.order_id} ha sido eliminada exitosamente.`,
        })
        onDeleted?.(orderToDelete)
        setIsDeleting(false)
        setDeleteDialogOpen(false)
        cleanupModalState(() => {
          setOrderToDelete(null)
        }, 100)
      }
    } catch (error) {
      console.error("Error al eliminar orden de trabajo:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado. Por favor, intente nuevamente.",
        variant: "destructive",
      })
      setIsDeleting(false)
    }
  }, [orderToDelete, onDeleted, toast])

  return {
    openDelete,
    orderToDelete,
    deleteDialogOpen,
    setDeleteDialogOpen,
    confirmDelete,
    isDeleting,
  }
}
