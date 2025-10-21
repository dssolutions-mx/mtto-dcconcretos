"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Camera, 
  Eye, 
  Image as ImageIcon,
  Download,
  ZoomIn,
  Calendar,
  User,
  MapPin,
  ExternalLink
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { createBrowserClient } from '@supabase/ssr'

interface Evidence {
  id: string
  section_id: string
  category: string
  description: string | null
  photo_url: string
  sequence_order: number
  metadata: any
  created_at: string
}

interface EvidenceSection {
  section_id: string
  section_title: string
  evidences: Evidence[]
}

interface CompletedChecklistEvidenceViewerProps {
  completedChecklistId: string
  checklistName: string
  completionDate: string
  technician: string
  assetName: string
  trigger?: React.ReactNode
}

export function CompletedChecklistEvidenceViewer({
  completedChecklistId,
  checklistName,
  completionDate,
  technician,
  assetName,
  trigger
}: CompletedChecklistEvidenceViewerProps) {
  const [evidenceSections, setEvidenceSections] = useState<EvidenceSection[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [totalEvidences, setTotalEvidences] = useState(0)

  // Cargar evidencias del checklist completado
  const loadEvidences = async () => {
    if (!completedChecklistId) return
    
    setLoading(true)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      
      const { data: evidencesData, error } = await supabase
        .from('checklist_evidence')
        .select(`
          *,
          checklist_sections (
            id,
            title
          )
        `)
        .eq('completed_checklist_id', completedChecklistId)
        .order('sequence_order', { ascending: true })

      if (error) {
        console.error('Error loading evidences:', error)
        return
      }

      if (!evidencesData || evidencesData.length === 0) {
        setEvidenceSections([])
        setTotalEvidences(0)
        return
      }

      // Agrupar evidencias por sección
      const sectionsMap = new Map<string, EvidenceSection>()
      
      evidencesData.forEach((evidence: any) => {
        const sectionId = evidence.section_id
        const sectionTitle = evidence.checklist_sections?.title || 'Evidencias Generales'
        
        if (!sectionsMap.has(sectionId)) {
          sectionsMap.set(sectionId, {
            section_id: sectionId,
            section_title: sectionTitle,
            evidences: []
          })
        }
        
        sectionsMap.get(sectionId)!.evidences.push(evidence)
      })

      const sections = Array.from(sectionsMap.values())
      setEvidenceSections(sections)
      setTotalEvidences(evidencesData.length)
    } catch (error) {
      console.error('Error loading evidences:', error)
    } finally {
      setLoading(false)
    }
  }

  // Agrupar evidencias por categoría dentro de cada sección
  const groupEvidencesByCategory = (evidences: Evidence[]) => {
    const categoriesMap = new Map<string, Evidence[]>()
    
    evidences.forEach(evidence => {
      const category = evidence.category || 'General'
      if (!categoriesMap.has(category)) {
        categoriesMap.set(category, [])
      }
      categoriesMap.get(category)!.push(evidence)
    })
    
    return Array.from(categoriesMap.entries())
  }

  // Descargar imagen
  const downloadImage = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading image:', error)
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button 
            variant="outline" 
            size="sm"
            onClick={loadEvidences}
          >
            <Camera className="h-4 w-4 mr-2" />
            Ver Evidencias
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-blue-600" />
            Evidencias Fotográficas del Checklist
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1">
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(completionDate), "PPP", { locale: es })}
                </span>
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {technician}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {assetName}
                </span>
              </div>
              <div className="text-lg font-medium text-gray-900">
                {checklistName}
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mr-3"></div>
              Cargando evidencias...
            </div>
          ) : evidenceSections.length === 0 ? (
            <div className="text-center py-8">
              <Camera className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 font-medium mb-2">Sin evidencias fotográficas</p>
              <p className="text-sm text-gray-500">
                Este checklist se completó sin capturar evidencias fotográficas
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Resumen */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-900">
                      {totalEvidences} evidencias capturadas
                    </span>
                  </div>
                  <Badge variant="outline" className="bg-white">
                    {evidenceSections.length} secciones
                  </Badge>
                </div>
              </div>

              {/* Secciones con evidencias */}
              <Tabs defaultValue={evidenceSections[0]?.section_id} className="w-full">
                <TabsList className="grid w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
                  {evidenceSections.map(section => (
                    <TabsTrigger 
                      key={section.section_id} 
                      value={section.section_id}
                      className="text-xs"
                    >
                      <div className="flex items-center gap-1">
                        <span className="truncate">{section.section_title}</span>
                        <Badge variant="secondary" className="text-xs">
                          {section.evidences.length}
                        </Badge>
                      </div>
                    </TabsTrigger>
                  ))}
                </TabsList>

                {evidenceSections.map(section => (
                  <TabsContent key={section.section_id} value={section.section_id} className="mt-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{section.section_title}</CardTitle>
                        <CardDescription>
                          {section.evidences.length} evidencia(s) capturada(s)
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {/* Agrupar por categorías */}
                        {groupEvidencesByCategory(section.evidences).map(([category, categoryEvidences]) => (
                          <div key={category} className="mb-6 last:mb-0">
                            <div className="flex items-center gap-2 mb-3">
                              <Badge variant="outline" className="bg-gray-50">
                                {category}
                              </Badge>
                              <span className="text-sm text-gray-600">
                                ({categoryEvidences.length} foto{categoryEvidences.length !== 1 ? 's' : ''})
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {categoryEvidences.map(evidence => (
                                <Card key={evidence.id} className="overflow-hidden">
                                  <div className="relative aspect-video group">
                                    <img
                                      src={evidence.photo_url}
                                      alt={`Evidencia ${category}`}
                                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <div className="flex gap-1">
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          className="h-8 w-8 p-0 bg-white/90 hover:bg-white"
                                          onClick={() => setSelectedImage(evidence.photo_url)}
                                        >
                                          <ZoomIn className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          className="h-8 w-8 p-0 bg-white/90 hover:bg-white"
                                          onClick={() => downloadImage(
                                            evidence.photo_url, 
                                            `evidencia-${category}-${evidence.sequence_order}.jpg`
                                          )}
                                        >
                                          <Download className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          className="h-8 w-8 p-0 bg-white/90 hover:bg-white"
                                          onClick={() => window.open(evidence.photo_url, '_blank')}
                                        >
                                          <ExternalLink className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                  {evidence.description && (
                                    <CardContent className="p-3">
                                      <p className="text-sm text-gray-600 line-clamp-2">
                                        {evidence.description}
                                      </p>
                                    </CardContent>
                                  )}
                                </Card>
                              ))}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Modal para ver imagen en tamaño completo */}
      {selectedImage && (
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-2">
            <div className="relative">
              <img
                src={selectedImage}
                alt="Evidencia completa"
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              />
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => setSelectedImage(null)}
              >
                ✕
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  )
} 