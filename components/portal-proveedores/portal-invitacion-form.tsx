"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import Link from "next/link"

import { PortalProveedoresShell } from "@/components/portal-proveedores/portal-proveedores-shell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"

const acceptSchema = z
  .object({
    password: z
      .string()
      .min(8, { message: "Mínimo 8 caracteres" }),
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Las contraseñas no coinciden",
    path: ["passwordConfirm"],
  })

type AcceptFormValues = z.infer<typeof acceptSchema>

function InvitacionContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")?.trim() ?? ""
  const [loadingInvite, setLoadingInvite] = useState(true)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [rfc, setRfc] = useState("")
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<AcceptFormValues>({
    resolver: zodResolver(acceptSchema),
    defaultValues: { password: "", passwordConfirm: "" },
  })

  useEffect(() => {
    if (!token) {
      setInviteError("Enlace de invitación inválido.")
      setLoadingInvite(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/portal-proveedores/invitations/accept?token=${encodeURIComponent(token)}`
        )
        const payload = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (!cancelled) setInviteError(payload.error ?? "Invitación no válida")
          return
        }
        if (!cancelled) {
          setEmail(payload.email ?? "")
          setRfc(payload.rfc ?? "")
        }
      } catch {
        if (!cancelled) setInviteError("No se pudo validar la invitación.")
      } finally {
        if (!cancelled) setLoadingInvite(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token])

  async function onSubmit(values: AcceptFormValues) {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch("/api/portal-proveedores/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: values.password }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSubmitError(payload.error ?? "No se pudo aceptar la invitación.")
        return
      }
      router.replace(payload.next ?? "/portal-proveedores/login?accepted=1")
    } catch {
      setSubmitError("Error de red. Intente de nuevo.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadingInvite) {
    return (
      <div className="flex justify-center py-16 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      </div>
    )
  }

  if (inviteError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{inviteError}</AlertDescription>
      </Alert>
    )
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Aceptar invitación</CardTitle>
        <CardDescription>
          Configure su contraseña para acceder al portal de proveedores.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <p>
            <span className="text-muted-foreground">Correo:</span> {email}
          </p>
          <p>
            <span className="text-muted-foreground">RFC:</span> {rfc}
          </p>
        </div>
        {submitError ? (
          <Alert variant="destructive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="passwordConfirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar contraseña</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Activar acceso"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-muted-foreground">
        <Link href="/portal-proveedores/login" className="hover:underline">
          Ya tengo cuenta
        </Link>
      </CardFooter>
    </Card>
  )
}

export function PortalProveedoresInvitacionForm() {
  return (
    <PortalProveedoresShell>
      <Suspense
        fallback={
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          </div>
        }
      >
        <InvitacionContent />
      </Suspense>
    </PortalProveedoresShell>
  )
}
