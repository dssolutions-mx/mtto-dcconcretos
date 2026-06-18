import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Sistema de Mantenimiento",
    short_name: "Mantenimiento",
    description: "Sistema de gestión de mantenimiento preventivo y correctivo",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "es",
    icons: [
      {
        src: "/placeholder-logo.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
    ],
  }
}
