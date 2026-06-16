'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'
import type { TireIdRules } from '@/types/tires'
import { previewInternalCode } from '@/lib/tires/identifier'

interface StepIdRulesProps {
  initialRules?: TireIdRules
  saving?: boolean
  onBack: () => void
  onSave: (rules: TireIdRules, complete: boolean) => Promise<void>
}

export function StepIdRules({
  initialRules,
  saving,
  onBack,
  onSave,
}: StepIdRulesProps) {
  const [dotRequired, setDotRequired] = useState(initialRules?.dot_required ?? false)
  const [internalPrefix, setInternalPrefix] = useState(initialRules?.internal_prefix ?? '')
  const [autoGenerate, setAutoGenerate] = useState(initialRules?.auto_generate ?? false)

  useEffect(() => {
    setDotRequired(initialRules?.dot_required ?? false)
    setInternalPrefix(initialRules?.internal_prefix ?? '')
    setAutoGenerate(initialRules?.auto_generate ?? false)
  }, [initialRules])

  const previewId = previewInternalCode({
    rules: {
      dot_required: dotRequired,
      internal_prefix: internalPrefix,
      auto_generate: autoGenerate,
    },
    plantCode: 'P1',
    sequence: 421,
  })

  const buildRules = (): TireIdRules => ({
    dot_required: dotRequired,
    internal_prefix: internalPrefix.trim() || undefined,
    auto_generate: autoGenerate,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reglas de identificación</CardTitle>
        <CardDescription>
          Defina cómo se identificarán las llantas: DOT obligatorio, prefijo interno o
          numeración automática.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-2">
          <Checkbox
            id="dot-required"
            checked={dotRequired}
            onCheckedChange={(v) => setDotRequired(v === true)}
          />
          <Label htmlFor="dot-required">DOT / serial obligatorio al registrar</Label>
        </div>

        <div className="space-y-1">
          <Label htmlFor="prefix">Prefijo interno (opcional)</Label>
          <Input
            id="prefix"
            value={internalPrefix}
            onChange={(e) => setInternalPrefix(e.target.value)}
            placeholder="LL"
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="auto-gen"
            checked={autoGenerate}
            onCheckedChange={(v) => setAutoGenerate(v === true)}
          />
          <Label htmlFor="auto-gen">Auto-generar ID secuencial con prefijo</Label>
        </div>

        <div className="rounded-lg border bg-muted/40 px-4 py-3">
          <p className="text-sm text-muted-foreground">Vista previa</p>
          <p className="font-mono text-sm font-medium">{previewId}</p>
        </div>

        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="outline" onClick={onBack}>
            Anterior
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => onSave(buildRules(), false)}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar borrador
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => onSave(buildRules(), true)}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continuar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
