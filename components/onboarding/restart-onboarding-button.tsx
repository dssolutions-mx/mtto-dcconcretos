'use client'

import { Button } from '@/components/ui/button'
import { HelpCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export function RestartOnboardingButton() {
  const { toast } = useToast()
  
  const handleRestart = () => {
    if (typeof window !== 'undefined') {
      // Clear tour completion flag
      localStorage.removeItem('interactive_tour_completed')
      
      toast({
        title: 'Tour Reiniciado',
        description: 'El tour interactivo se mostrará ahora.',
      })
      
      // Reload to trigger tour
      setTimeout(() => {
        window.location.reload()
      }, 500)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRestart}
      className="gap-2"
    >
      <HelpCircle className="h-4 w-4" />
      Reiniciar Tour
    </Button>
  )
}
