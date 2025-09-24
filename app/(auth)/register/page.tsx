import type { Metadata } from "next"
import Link from "next/link"

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
          <p className="text-sm text-muted-foreground mt-2">
            El registro público está deshabilitado. Por favor contacte al administrador.
          </p>
        </div>
        <div className="w-full rounded-md border bg-white p-6 text-center">
          <p className="text-sm text-gray-700">
            Si necesita acceso, envíe un correo a <span className="font-medium">soporte@su-dominio</span>.
          </p>
          <div className="mt-4">
            <Link href="/login" className="text-primary underline">Volver a iniciar sesión</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
