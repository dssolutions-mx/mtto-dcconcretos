"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Eye, EyeOff, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase"

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
        const supabase = createClient()
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        })

        if (error) throw error

        router.refresh()
        router.push("/")
      } else {
        // Register mode - call our custom registration API
        const registerValues = values as RegisterFormValues
        
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            nombre: registerValues.nombre,
            apellido: registerValues.apellido,
            email: registerValues.email,
            role: registerValues.role,
            telefono: registerValues.telefono || null,
            emergency_contact: registerValues.emergency_contact_name || registerValues.emergency_contact_phone 
              ? {
                  name: registerValues.emergency_contact_name || null,
                  phone: registerValues.emergency_contact_phone || null,
                }
              : null,
            password: registerValues.password,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Error en el registro')
        }

        // Registration successful
        router.refresh()
        router.push("/")
      }
    } catch (error: any) {
      setError(error.message || "Ocurrió un error durante la autenticación")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{mode === "login" ? "Iniciar Sesión" : "Registrarse"}</CardTitle>
        <CardDescription>
          {mode === "login"
            ? "Ingrese sus credenciales para acceder al sistema"
            : "Cree una nueva cuenta para acceder al sistema"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {mode === "register" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nombre" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="apellido"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apellido *</FormLabel>
                        <FormControl>
                          <Input placeholder="Apellido" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rol *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione su rol" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {USER_ROLES.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="telefono"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl>
                        <Input placeholder="Número de teléfono" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-700">Contacto de Emergencia (Opcional)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="emergency_contact_name"
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
                      name="emergency_contact_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono</FormLabel>
                          <FormControl>
                            <Input placeholder="Teléfono" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </>
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

            {mode === "register" && (
              <FormField
                control={form.control}
                name="passwordConfirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar contraseña *</FormLabel>
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
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {mode === "login" ? "Iniciando sesión..." : "Registrando..."}
                </>
              ) : mode === "login" ? (
                "Iniciar Sesión"
              ) : (
                "Registrarse"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex justify-center">
        {mode === "login" ? (
          <p className="text-sm text-muted-foreground">
            ¿No tiene una cuenta?{" "}
            <Button variant="link" className="p-0" onClick={() => router.push("/register")}>
              Registrarse
            </Button>
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
