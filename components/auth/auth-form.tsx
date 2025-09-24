"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuthZustand } from "@/hooks/use-auth-zustand"

const USER_ROLES = [
  { value: "GERENCIA_GENERAL", label: "Gerencia General" },
  { value: "JEFE_UNIDAD_NEGOCIO", label: "Jefe de Unidad de Negocio" },
  { value: "ENCARGADO_MANTENIMIENTO", label: "Encargado de Mantenimiento" },
  { value: "JEFE_PLANTA", label: "Jefe de Planta" },
  { value: "DOSIFICADOR", label: "Dosificador" },
  { value: "OPERADOR", label: "Operador" },
  { value: "AUXILIAR_COMPRAS", label: "Auxiliar de Compras" },
  { value: "AREA_ADMINISTRATIVA", label: "Área Administrativa" },
  { value: "EJECUTIVO", label: "Ejecutivo" },
  { value: "VISUALIZADOR", label: "Visualizador" },
]

const loginSchema = z.object({
  email: z.string().email({ message: "Ingrese un correo electrónico válido" }),
  password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres" }),
})

const registerSchema = z.object({
  nombre: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres" }),
  apellido: z.string().min(2, { message: "El apellido debe tener al menos 2 caracteres" }),
  email: z.string().email({ message: "Ingrese un correo electrónico válido" }),
  role: z.string().min(1, { message: "Seleccione un rol" }),
  telefono: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres" }),
  passwordConfirm: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres" }),
}).refine((data) => data.password === data.passwordConfirm, {
  message: "Las contraseñas no coinciden",
  path: ["passwordConfirm"],
})

type LoginFormValues = z.infer<typeof loginSchema>
type RegisterFormValues = z.infer<typeof registerSchema>

export function AuthForm({ mode = "login" }: { mode: "login" | "register" }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  
  // Use Zustand store for authentication
  const { signIn } = useAuthZustand()

  const schema = mode === "login" ? loginSchema : registerSchema

  const form = useForm<LoginFormValues | RegisterFormValues>({
    resolver: zodResolver(schema),
    defaultValues:
      mode === "login" 
        ? { email: "", password: "" } 
        : { 
            nombre: "", 
            apellido: "", 
            email: "", 
            role: "",
            telefono: "",
            emergency_contact_name: "",
            emergency_contact_phone: "",
            password: "", 
            passwordConfirm: "" 
          },
  })

  async function onSubmit(values: LoginFormValues | RegisterFormValues) {
    setIsLoading(true)
    setError(null)

    try {
      if (mode === "login") {
        console.log('🔐 Attempting login with Zustand store...')
        
        // Use Zustand store's signIn method
        const result = await signIn(values.email, values.password)
        
        if (!result.success) {
          throw new Error(result.error || 'Login failed')
        }
        
        console.log('✅ Login successful, redirecting...')
        router.refresh()
        router.push("/dashboard")
      } else {
        // Registration disabled
        throw new Error('El registro público está deshabilitado. Contacte al administrador.')
      }
    } catch (error: any) {
      console.error(`❌ ${mode === 'login' ? 'Login' : 'Registration'} error:`, error)
      setError(error.message || "Ocurrió un error durante la autenticación")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{mode === "login" ? "Iniciar Sesión" : "Registro deshabilitado"}</CardTitle>
        <CardDescription>
          {mode === "login"
            ? "Ingrese sus credenciales para acceder al sistema"
            : "El registro público está deshabilitado. Contacte al administrador."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {mode === "register" && (
              <Alert variant="destructive">
                <AlertDescription>
                  El registro público está deshabilitado. Contacte al administrador.
                </AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo electrónico *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="correo@ejemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} placeholder="••••••••" {...field} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mode === "login" && (
              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  ¿Olvidó su contraseña?
                </Link>
              </div>
            )}

            {mode === "register" && null}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isLoading || mode === 'register'}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {mode === "login" ? "Iniciando sesión..." : "Registrando..."}
                </>
              ) : mode === "login" ? (
                "Iniciar Sesión"
              ) : (
                "Registro deshabilitado"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-center">
        {mode === "login" ? (
          <p className="text-sm text-muted-foreground">
            ¿Necesita una cuenta? Contacte al administrador.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            ¿Ya tiene una cuenta?{" "}
            <Button variant="link" className="p-0" onClick={() => router.push("/login")}>
              Iniciar Sesión
            </Button>
          </p>
        )}
      </CardFooter>
    </Card>
  )
}
