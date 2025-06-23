"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuthZustand } from "@/hooks/use-auth-zustand"
import { createClient } from "@/lib/supabase"

const profileSchema = z.object({
  name: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres" }),
  email: z.string().email({ message: "Ingrese un correo electrónico válido" }).optional(),
})

type ProfileFormValues = z.infer<typeof profileSchema>

export function UserProfile() {
  const { user, signOut } = useAuthZustand()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.user_metadata?.name || "",
      email: user?.email || "",
    },
  })

  async function onSubmit(values: ProfileFormValues) {
    setIsLoading(true)
    setError(null)
    setSuccess(null)

    const supabase = createClient()

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          name: values.name,
        },
      })

      if (error) throw error

      setSuccess("Perfil actualizado correctamente")
      router.refresh()
    } catch (error: any) {
      setError(error.message || "Ocurrió un error al actualizar el perfil")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSignOut() {
    setIsLoading(true)
    setError(null)

    try {
      console.log('🚪 User profile logout initiated...')
      await signOut()
      console.log('✅ Logout successful, redirecting...')
      router.push("/login")
      router.refresh()
    } catch (error: any) {
      console.error('❌ Logout error:', error)
      setError(error.message || "Ocurrió un error al cerrar sesión")
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Perfil de Usuario</CardTitle>
        <CardDescription>Actualice su información de perfil</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre completo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo electrónico</FormLabel>
                  <FormControl>
                    <Input type="email" disabled {...field} />
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

            {success && (
              <Alert className="bg-green-50 border-green-200">
                <AlertDescription className="text-green-800">{success}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Actualizando...
                </>
              ) : (
                "Actualizar Perfil"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full" onClick={handleSignOut} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cerrando sesión...
            </>
          ) : (
            "Cerrar Sesión"
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
