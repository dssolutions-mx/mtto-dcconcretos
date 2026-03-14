import type { EvidenceItem } from "@/components/ui/evidence-viewer"

export function getIncidentEvidence(incident: { documents?: unknown; id?: string; created_at?: string }): EvidenceItem[] {
  if (!incident.documents) return []

  try {
    if (Array.isArray(incident.documents)) {
      if (typeof (incident.documents as unknown[])[0] === "string") {
        return (incident.documents as string[]).map((url, index) => ({
          id: `${incident.id ?? "inc"}_${index}`,
          url,
          description: `Evidencia del incidente ${index + 1}`,
          category: "documentacion_soporte",
          uploaded_at: incident.created_at || new Date().toISOString(),
        }))
      }
      return incident.documents as EvidenceItem[]
    }
    return []
  } catch {
    return []
  }
}
