"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Lock, ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { createClient } from "@/lib/supabase"

const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "La contraseña debe contener al menos una mayúscula, una minúscula y un número"
    ),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
})

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>

export default function ResetPasswordPage() {
  const router = useRouter()
  const { updatePassword } = useAuthZustand()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isValidToken, setIsValidToken] = useState(false)
  const [checkingToken, setCheckingToken] = useState(true)

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  })

  useEffect(() => {
    const supabase = createClient()
    
    // Listen for the PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth event:", event, "Session:", session)
      
      if (event === "PASSWORD_RECOVERY") {
        console.log("Password recovery event detected")
        setIsValidToken(true)
        setCheckingToken(false)
      } else if (event === "SIGNED_IN" && session) {
        // This happens after successful password reset
        console.log("User signed in after password reset")
      }
    })

    // Check if we already have a session (user clicked the link and is authenticated)
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error("Error checking session:", error)
        setError("Enlace de recuperación inválido o expirado")
        setCheckingToken(false)
        return
      }

      if (session) {
        console.log("Valid session found")
        setIsValidToken(true)
        setCheckingToken(false)
      } else {
        // Check URL for error parameters
        const urlParams = new URLSearchParams(window.location.search)
        const errorCode = urlParams.get('error')
        const errorDescription = urlParams.get('error_description')
        
        if (errorCode) {
          console.error("URL error:", errorCode, errorDescription)
          setError(errorDescription || "Enlace de recuperación inválido o expirado")
        } else {
          setError("Enlace de recuperación inválido o expirado. Por favor solicite uno nuevo.")
        }
        setCheckingToken(false)
      }
    }

    checkSession()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function onSubmit(values: ResetPasswordFormValues) {
    setIsLoading(true)
    setError(null)

    try {
      const result = await updatePassword(values.password)
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update password')
      }
      
      setSuccess(true)
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/login")
      }, 3000)
    } catch (error: any) {
      console.error("Password reset error:", error)
      setError(error.message || "Ocurrió un error al actualizar la contraseña")
    } finally {
      setIsLoading(false)
    }
  }

  if (checkingToken) {
    return (
      <div className="container flex h-screen w-screen flex-col items-center justify-center">
        <Card className="mx-auto max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
            <p className="text-center mt-4 text-muted-foreground">Verificando enlace...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isValidToken) {
    return (
      <div className="container flex h-screen w-screen flex-col items-center justify-center">
        <Card className="mx-auto max-w-md w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Enlace inválido</CardTitle>
            <CardDescription>
              {error || "El enlace de recuperación es inválido o ha expirado"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Link href="/forgot-password">
                <Button className="w-full" variant="outline">
                  Solicitar nuevo enlace
                </Button>
              </Link>
              <Link href="/login">
                <Button className="w-full" variant="ghost">
                  Volver al inicio de sesión
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <Link
        href="/login"
        className="absolute left-4 top-4 md:left-8 md:top-8 flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver al inicio de sesión
      </Link>

      <Card className="mx-auto max-w-md w-full">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Restablecer contraseña</CardTitle>
          <CardDescription>
            Ingrese su nueva contraseña
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <Alert className="mb-4">
              <Lock className="h-4 w-4" />
              <AlertDescription>
                Su contraseña ha sido actualizada exitosamente. Será redirigido al inicio de sesión...
              </AlertDescription>
            </Alert>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nueva contraseña</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="••••••••"
                          type="password"
                          autoComplete="new-password"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Mínimo 6 caracteres, debe incluir mayúsculas, minúsculas y números
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar contraseña</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="••••••••"
                          type="password"
                          autoComplete="new-password"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? "Actualizando..." : "Actualizar contraseña"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 