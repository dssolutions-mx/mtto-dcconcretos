"use client"
import { useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

function ResultContent() {
  const params = useSearchParams()
  const action = params.get('action')
  const po = params.get('po')
  const reason = params.get('reason')
  const attempt = params.get('attempt')

  const { title, subtitle, icon, color } = useMemo(() => {
    if (action === 'approved') {
      return {
        title: 'Orden de compra aprobada',
        subtitle: `La orden${po ? ` ${po}` : ''} fue aprobada correctamente.`,
        icon: <CheckCircle size={48} className="text-green-600" />,
        color: 'border-green-200 bg-green-50'
      }
    }
    if (action === 'rejected') {
      return {
        title: 'Orden de compra rechazada',
        subtitle: `La orden${po ? ` ${po}` : ''} fue rechazada.`,
        icon: <XCircle size={48} className="text-red-600" />,
        color: 'border-red-200 bg-red-50'
      }
    }
    if (action === 'error') {
      const attemptedText = attempt === 'approve' ? 'aprobar' : attempt === 'reject' ? 'rechazar' : 'procesar'
      return {
        title: `La acción no pudo completarse`,
        subtitle: reason ? `Intentamos ${attemptedText} la OC${po ? ` ${po}` : ''}. Motivo: ${reason}` : `Intentamos ${attemptedText} la OC${po ? ` ${po}` : ''}, pero ocurrió un error inesperado.`,
        icon: <AlertTriangle size={48} className="text-amber-600" />,
        color: 'border-amber-200 bg-amber-50'
      }
    }
    return {
      title: 'Acción procesada',
      subtitle: po ? `Estado actualizado para la OC ${po}.` : 'El estado fue actualizado.',
      icon: <CheckCircle size={48} className="text-sky-600" />,
      color: 'border-sky-200 bg-sky-50'
    }
  }, [action, po, reason, attempt])

  return (
    <div className="min-h-[60vh] w-full flex items-center justify-center px-4">
      <div className={`w-full max-w-xl border rounded-lg p-8 text-center ${color}`}>
        <div className="flex justify-center mb-4">{icon}</div>
        <h1 className="text-2xl font-semibold mb-2">{title}</h1>
        <p className="text-slate-600 mb-6">{subtitle}</p>
        <div className="flex gap-3 justify-center">
          <Link href="/login" className="px-4 py-2 rounded-md bg-slate-900 text-white">Iniciar sesión</Link>
        </div>
      </div>
    </div>
  )
}

export default function PurchaseOrderActionResultPage() {
  return (
    <Suspense fallback={<div className="min-h-[60vh] w-full flex items-center justify-center px-4"><div className="text-slate-500">Cargando...</div></div>}>
      <ResultContent />
    </Suspense>
  )
}


