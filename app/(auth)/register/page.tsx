import type { Metadata } from "next"
import { AuthForm } from "@/components/auth/auth-form"

export const metadata: Metadata = {
  title: "Registro | Sistema de Gestión de Mantenimiento",
  description: "Cree una cuenta en el sistema de gestión de mantenimiento",
}

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Crear Cuenta</h1>
          <p className="text-sm text-muted-foreground mt-2">Ingrese sus datos para crear una cuenta</p>
        </div>
        <AuthForm mode="register" />
      </div>
    </div>
  )
}
