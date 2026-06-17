"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { SupplierPortalProfile } from "@/lib/portal-proveedores/profile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type PortalPerfilFormProps = {
  initialProfile: SupplierPortalProfile
}

export function PortalPerfilForm({ initialProfile }: PortalPerfilFormProps) {
  const router = useRouter()
  const [contactName, setContactName] = useState(initialProfile.contactName ?? "")
  const [contactPhone, setContactPhone] = useState(initialProfile.contactPhone ?? "")
  const [notificationEmail, setNotificationEmail] = useState(
    initialProfile.notificationEmail ?? ""
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const res = await fetch("/api/portal-proveedores/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_name: contactName,
          contact_phone: contactPhone,
          notification_email: notificationEmail,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar el perfil.")
        return
      }
      setMessage("Datos de contacto actualizados.")
      router.refresh()
    } catch {
      setError("Error de red al guardar.")
    } finally {
      setSaving(false)
    }
  }

  const supplier = initialProfile.supplier

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos fiscales</CardTitle>
          <CardDescription>
            Información registrada en el padrón de proveedores (solo lectura).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">RFC del portal</p>
            <p className="font-medium">{initialProfile.rfc}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Correo de acceso</p>
            <p className="font-medium">{initialProfile.email ?? "—"}</p>
          </div>
          {supplier ? (
            <>
              <div>
                <p className="text-muted-foreground">Razón social</p>
                <p className="font-medium">{supplier.businessName ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">RFC en padrón</p>
                <p className="font-medium">{supplier.taxId ?? initialProfile.rfc}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-muted-foreground">Domicilio fiscal</p>
                <p className="font-medium">
                  {[supplier.address, supplier.city, supplier.state, supplier.postalCode]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Condiciones de pago</p>
                <p className="font-medium">{supplier.paymentTerms ?? "—"}</p>
              </div>
            </>
          ) : (
            <p className="text-amber-700 sm:col-span-2">
              No hay un registro de proveedor vinculado en mantenimiento para este RFC.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contacto del portal</CardTitle>
          <CardDescription>
            Puede actualizar su contacto operativo y un correo alterno para avisos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="contact_name">Nombre de contacto</Label>
              <Input
                id="contact_name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Ej. María López — Cuentas por cobrar"
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">Teléfono</Label>
              <Input
                id="contact_phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="Ej. 55 1234 5678"
                autoComplete="tel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notification_email">Correo para notificaciones</Label>
              <Input
                id="notification_email"
                type="email"
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
                placeholder={initialProfile.email ?? "mismo correo de acceso"}
                autoComplete="email"
              />
              <p className="text-xs text-muted-foreground">
                Las notificaciones in-app aparecen en la campana del portal. El envío por
                correo queda pendiente de integrar con el servicio de email de la empresa.
              </p>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {message ? <p className="text-sm text-green-700">{message}</p> : null}
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
