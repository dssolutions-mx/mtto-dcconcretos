import type { Metadata } from "next"
import Link from "next/link"
import { AuthForm } from "@/components/auth/auth-form"

export const metadata: Metadata = {
  title: "Iniciar Sesión | Sistema de Gestión de Mantenimiento",
  description: "Inicie sesión en el sistema de gestión de mantenimiento",
}

export default function LoginPage() {
  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Iniciar Sesión</h1>
          <p className="text-sm text-muted-foreground">Ingrese sus credenciales para acceder al sistema</p>
        </div>
        <AuthForm mode="login" />
        <p className="px-8 text-center text-sm text-muted-foreground">
          ¿No tiene una cuenta?{" "}
          <Link href="/register" className="underline underline-offset-4 hover:text-primary">
            Registrarse
          </Link>
        </p>
      </div>
    </div>
  )
}
