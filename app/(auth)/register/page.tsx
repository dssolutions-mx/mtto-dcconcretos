import type { Metadata } from "next"
import Link from "next/link"
import { AuthForm } from "@/components/auth/auth-form"

export const metadata: Metadata = {
  title: "Registro | Sistema de Gestión de Mantenimiento",
  description: "Cree una cuenta en el sistema de gestión de mantenimiento",
}

export default function RegisterPage() {
  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Crear Cuenta</h1>
          <p className="text-sm text-muted-foreground">Ingrese sus datos para crear una cuenta</p>
        </div>
        <AuthForm mode="register" />
        <p className="px-8 text-center text-sm text-muted-foreground">
          ¿Ya tiene una cuenta?{" "}
          <Link href="/login" className="underline underline-offset-4 hover:text-primary">
            Iniciar Sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
