"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import type { Supplier } from "@/types/suppliers"
import { Copy, Loader2, Mail } from "lucide-react"

interface SupplierPortalInvitePanelProps {
  supplier: Supplier
  canInvite: boolean
}

export function SupplierPortalInvitePanel({
  supplier,
  canInvite,
}: SupplierPortalInvitePanelProps) {
  const { toast } = useToast()
  const [email, setEmail] = useState(supplier.email?.trim().toLowerCase() ?? "")
  const [pending, setPending] = useState(false)
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null)

  if (!canInvite) return null

  const rfc = supplier.tax_id?.trim()
  if (!rfc) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Portal de proveedores</CardTitle>
          <CardDescription>
            Registre el RFC del proveedor en el padrón antes de enviar una invitación.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const handleInvite = async () => {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      toast({ title: "Correo requerido", variant: "destructive" })
      return
    }

    setPending(true)
    try {
      const res = await fetch("/api/portal-proveedores/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          rfc,
          mtto_supplier_id: supplier.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({
          title: "No se pudo crear la invitación",
          description: data.error ?? "Error desconocido",
          variant: "destructive",
        })
        return
      }

      setInvitationUrl(data.invitation_url ?? null)
      toast({
        title: "Invitación creada",
        description: "Copie el enlace y envíelo al proveedor por correo o mensaje.",
      })
    } catch {
      toast({ title: "Error de red", variant: "destructive" })
    } finally {
      setPending(false)
    }
  }

  const copyUrl = async () => {
    if (!invitationUrl) return
    try {
      await navigator.clipboard.writeText(invitationUrl)
      toast({ title: "Enlace copiado" })
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Portal de proveedores
        </CardTitle>
        <CardDescription>
          Genere un enlace de invitación para que el proveedor consulte OC, envíe facturas y
          vea pagos. El correo no se envía automáticamente desde el sistema.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="portal-invite-email">Correo del proveedor</Label>
          <Input
            id="portal-invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="facturacion@proveedor.com"
            autoComplete="off"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          RFC vinculado: <span className="font-medium">{rfc}</span>
        </p>
        <Button type="button" onClick={handleInvite} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Generar enlace de invitación
        </Button>
        {invitationUrl ? (
          <div className="rounded-md border bg-muted/40 p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Enlace (válido 7 días)</p>
            <p className="text-sm break-all">{invitationUrl}</p>
            <Button type="button" variant="outline" size="sm" onClick={copyUrl}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar enlace
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
