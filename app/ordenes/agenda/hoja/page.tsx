"use client"

import { Suspense } from "react"
import { MechanicWorkSheet } from "@/components/agenda/mechanic-work-sheet"

export default function HojaTrabajoPage() {
  return (
    <Suspense fallback={<p className="p-8">Cargando hoja de trabajo…</p>}>
      <MechanicWorkSheet />
    </Suspense>
  )
}
