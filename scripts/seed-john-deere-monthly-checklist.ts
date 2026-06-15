/**
 * Seed monthly checklist templates for John Deere front loaders (524 P, 524K, 524K II).
 *
 * Usage:
 *   npx tsx scripts/seed-john-deere-monthly-checklist.ts          # dry-run
 *   npx tsx scripts/seed-john-deere-monthly-checklist.ts --import # real import
 */

import { createClient } from '@supabase/supabase-js'

require('dotenv').config({ path: '.env.local' })

const DRY_RUN = !process.argv.includes('--import')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const TEMPLATE_DESCRIPTION =
  'REVISIÓN MENSUAL DE CARGADOR FRONTAL JOHN DEERE. ESTACIONAR EN SUPERFICIE NIVELADA, BAJAR CUCHARÓN AL SUELO, APLICAR FRENO DE ESTACIONAMIENTO Y APAGAR MOTOR ANTES DE INSPECCIONAR.'

const FREQUENCY = 'mensual'

interface ChecklistSectionDef {
  title: string
  items: string[]
}

const SECTIONS: ChecklistSectionDef[] = [
  {
    title: 'Motor',
    items: [
      'REVISAR NIVEL DE ACEITE DE MOTOR CON VARILLA MEDIDORA (ENTRE MARCAS ADD Y FULL)',
      'INSPECCIONAR FILTRO DE ACEITE (FILTRO VERTICAL ENROSCABLE); REEMPLAZAR SI CORRESPONDE AL INTERVALO DE 500 H',
      'REVISAR NIVEL Y ESTADO DEL REFRIGERANTE DEL SISTEMA DE ENFRIAMIENTO (CAPACIDAD: 23 L)',
      'INSPECCIONAR MANGUERAS DEL SISTEMA DE ENFRIAMIENTO POR FUGAS, FISURAS O DESGASTE',
      'VERIFICAR ESTADO DEL FILTRO DE AIRE DOBLE (DEBAJO DEL CAPÓ); LIMPIAR O REEMPLAZAR SI EL INDICADOR DE RESTRICCIÓN DEL MONITOR LCD LO SEÑALA',
      'VERIFICAR AUSENCIA DE FUGAS DE ACEITE, COMBUSTIBLE Y REFRIGERANTE EN TODO EL BLOQUE',
      'INSPECCIONAR CORREAS DEL ALTERNADOR Y TENSOR',
      'REVISAR NIVEL DE COMBUSTIBLE Y ESTADO DE TAPA CON CERRADURA DEL TANQUE (CAPACIDAD: 242 L)',
    ],
  },
  {
    title: 'Sistema Hidráulico',
    items: [
      'VERIFICAR NIVEL DE ACEITE HIDRÁULICO EN DEPÓSITO (CAPACIDAD: 92 L / 24.3 GAL) MEDIANTE MIRILLA TRANSLÚCIDA',
      'INSPECCIONAR FILTRO HIDRÁULICO VERTICAL ENROSCABLE; REEMPLAZAR SEGÚN INTERVALO DE 2,000 H O SI HAY CONTAMINACIÓN VISIBLE',
      'REVISAR MANGUERAS, CILINDROS DE LEVANTAMIENTO Y ACOUPLES RÁPIDOS POR FUGAS O DAÑOS',
      'VERIFICAR FUNCIONAMIENTO SUAVE DE PLUMA Y CUCHARÓN EN TODO SU RECORRIDO (ELEVACIÓN ~6.1 S, DESCARGA ~1.4 S, DESCENSO ~3.0 S)',
      'REVISAR PRESIÓN DE ALIVIO DEL SISTEMA (REFERENCIA: 24,994 KPA / 3,625 PSI) CON AYUDA DEL MONITOR DE DIAGNÓSTICO A BORDO',
      'VERIFICAR PUERTOS DE MUESTREO DE FLUIDOS CON CÓDIGO DE COLORES PARA ANÁLISIS DE ACEITE CONTAMINADO',
    ],
  },
  {
    title: 'Transmisión y Tren de Potencia',
    items: [
      'REVISAR NIVEL DE ACEITE EN DEPÓSITO DE TRANSMISIÓN (18.5 L) MEDIANTE MIRILLA DE NIVEL',
      'VERIFICAR FILTRO VERTICAL DE TRANSMISIÓN; REEMPLAZAR SEGÚN INTERVALO DE 2,000 H',
      'REVISAR ACEITE DE EJES DELANTERO Y TRASERO (17 L CADA UNO)',
      'VERIFICAR ACEITE DEL FRENO DE ESTACIONAMIENTO DE DISCO HÚMEDO (0.3 L)',
      'COMPROBAR CORRECTO FUNCIONAMIENTO DEL CONVERTIDOR DE PAR POWERSHIFT MEDIANTE CAMBIOS PROGRESIVOS DE MARCHA (1ª A 4ª)',
      'INSPECCIONAR MANDOS FINALES PLANETARIOS POR FUGAS O RUIDOS INUSUALES',
    ],
  },
  {
    title: 'Neumáticos y Ejes',
    items: [
      'VERIFICAR PRESIÓN DE INFLADO DE LOS 4 NEUMÁTICOS (20.5 R25 ESTÁNDAR) SEGÚN ESPECIFICACIONES DEL FABRICANTE',
      'INSPECCIONAR DESGASTE UNIFORME DE LAS BANDAS DE RODAMIENTO',
      'REVISAR PERNOS DE FIJACIÓN DE LLANTAS (LLANTAS DE 3 PIEZAS) Y VERIFICAR TORQUE CORRECTO',
      'INSPECCIONAR EJES DELANTERO Y TRASERO POR FISURAS EN CARCASAS O FUGAS DE ACEITE DE DIFERENCIAL',
      'VERIFICAR OSCILACIÓN DEL EJE TRASERO (24° DE TOPE A TOPE) SIN TRABAS O RUIDOS',
    ],
  },
  {
    title: 'Sistema de Frenos',
    items: [
      'PROBAR FRENOS DE SERVICIO HIDRÁULICOS DE DISCO HÚMEDO EN ZONA SEGURA',
      'VERIFICAR FUNCIONAMIENTO AUTOMÁTICO DEL FRENO DE ESTACIONAMIENTO (ACCIONADO POR RESORTE, LIBERADO HIDRÁULICAMENTE)',
      'INSPECCIONAR NIVEL DE FLUIDO EN CIRCUITO DE FRENOS POR POSIBLES FUGAS',
    ],
  },
  {
    title: 'Sistema Eléctrico y Cabina',
    items: [
      'REVISAR CARGA Y ESTADO DE LAS DOS BATERÍAS DE 12V (750 CCA C/U) Y TERMINALES POR CORROSIÓN',
      'VERIFICAR FUNCIONAMIENTO DEL ALTERNADOR (80 A ESTÁNDAR / 100 A OPCIONAL)',
      'COMPROBAR TODAS LAS LUCES: CONDUCCIÓN, TRABAJO DELANTERAS (2) Y TRASERAS (2), INTERMITENTES, FRENO',
      'PROBAR BOCINA, CINTURÓN DE SEGURIDAD Y SISTEMA DE ARRANQUE SIN LLAVE',
      'REVISAR MONITOR LCD A COLOR: VERIFICAR QUE NO HAYA CÓDIGOS DE FALLA ACTIVOS NI MENSAJES DIAGNÓSTICOS PENDIENTES',
      'INSPECCIONAR CÁMARA TRASERA OPCIONAL (SI APLICA) Y SISTEMA DE DETECCIÓN DE OBJETOS',
      'VERIFICAR ESTADO DEL MÓDULO DE INTERRUPTORES SELLADO (PROTECCIÓN CONTRA POLVO Y HUMEDAD)',
    ],
  },
  {
    title: 'Sistema de Enfriamiento Quad-Cool',
    items: [
      'LIMPIAR NÚCLEOS DEL SISTEMA QUAD-COOL (RADIADOR, CONDENSADOR A/C, INTERENFRIADOR, ENFRIADORES HIDRÁULICO Y DE TRANSMISIÓN) POR AMBOS LADOS CON AIRE A PRESIÓN',
      'VERIFICAR FUNCIONAMIENTO DEL VENTILADOR DE INVERSIÓN AUTOMÁTICA (SI LA MÁQUINA TIENE ESTA OPCIÓN)',
      'INSPECCIONAR ALETAS DEL RADIADOR POR OBSTRUCCIÓN CON SUCIEDAD O RESIDUOS DE MATERIAL',
    ],
  },
  {
    title: 'Estructura, Cucharón y Articulación',
    items: [
      'INSPECCIONAR CUCHARÓN (ANCHO: 2.54 M) POR DESGASTE DE CUCHILLA, GRIETAS EN SOLDADURAS Y PERNOS SUELTOS',
      'REVISAR ESTADO DE DIENTES/BORDE EMPERNABLE Y REEMPLAZAR SI HAY DESGASTE EXCESIVO',
      'LUBRICAR TODOS LOS PASADORES DE ARTICULACIÓN DE PLUMA Y CUCHARÓN (GRASA SEGÚN ESPECIFICACIÓN DEERE)',
      'INSPECCIONAR PUNTO DE ARTICULACIÓN CENTRAL DEL CHASIS POR HOLGURA O DESGASTE EN COJINETES DE RODILLOS CÓNICOS DE DOS HILERAS',
      'REVISAR CILINDROS DE LEVANTAMIENTO POR FUGAS EN SELLOS Y VÁSTAGOS RAYADOS',
      'INSPECCIONAR PROTECTORES DE BASTIDOR LATERAL DE TRANSMISIÓN Y PROTECTORES INFERIORES',
    ],
  },
]

const MODEL_TEMPLATES = [
  {
    modelId: '638340f5-094e-439e-b7f4-ec942bb83f5d',
    modelName: 'CARGADOR FRONTAL 524 P',
    templateName: 'CHECKLIST MENSUAL John Deer',
  },
  {
    modelId: '70749b04-ea69-4163-a2cb-2635f7ade208',
    modelName: 'CARGADOR FRONTAL 524K',
    templateName: 'CHECKLIST MENSUAL John Deer K',
  },
  {
    modelId: '95c910cc-4937-40fc-8b45-40ede090740e',
    modelName: 'CARGADOR FRONTAL 524K II',
    templateName: 'CHECKLIST MENSUAL John Deer (II)',
  },
] as const

const TOTAL_ITEMS = SECTIONS.reduce((sum, s) => sum + s.items.length, 0)

async function templateExists(modelId: string, templateName: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('checklists')
    .select('id')
    .eq('model_id', modelId)
    .eq('frequency', FREQUENCY)
    .eq('name', templateName)
    .maybeSingle()

  if (error) throw new Error(`Error checking template: ${error.message}`)
  return data?.id ?? null
}

async function createTemplateVersion(templateId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_template_version', {
    p_template_id: templateId,
    p_change_summary: 'Versión inicial - checklist mensual John Deere',
    p_migration_notes: null,
  })

  if (error) throw new Error(`Error creating template version: ${error.message}`)
  return data as string
}

async function seedTemplate(
  modelId: string,
  modelName: string,
  templateName: string
): Promise<'created' | 'skipped'> {
  const existingId = await templateExists(modelId, templateName)
  if (existingId) {
    console.log(`  SKIP  ${templateName} (${modelName}) — already exists (${existingId})`)
    return 'skipped'
  }

  if (DRY_RUN) {
    console.log(`  WOULD CREATE  ${templateName} (${modelName})`)
    console.log(`    sections: ${SECTIONS.length}, items: ${TOTAL_ITEMS}`)
    return 'created'
  }

  const { data: checklist, error: checklistError } = await supabase
    .from('checklists')
    .insert({
      name: templateName,
      description: TEMPLATE_DESCRIPTION,
      model_id: modelId,
      frequency: FREQUENCY,
      interval_id: null,
    })
    .select('id')
    .single()

  if (checklistError || !checklist) {
    throw new Error(`Error creating checklist for ${modelName}: ${checklistError?.message}`)
  }

  const checklistId = checklist.id
  console.log(`  CREATED checklist ${checklistId} — ${templateName}`)

  for (let sectionIndex = 0; sectionIndex < SECTIONS.length; sectionIndex++) {
    const sectionDef = SECTIONS[sectionIndex]

    const { data: section, error: sectionError } = await supabase
      .from('checklist_sections')
      .insert({
        checklist_id: checklistId,
        title: sectionDef.title,
        order_index: sectionIndex,
        section_type: 'checklist',
      })
      .select('id')
      .single()

    if (sectionError || !section) {
      throw new Error(`Error creating section "${sectionDef.title}": ${sectionError?.message}`)
    }

    const itemsToInsert = sectionDef.items.map((description, itemIndex) => ({
      section_id: section.id,
      description,
      required: true,
      item_type: 'check' as const,
      order_index: itemIndex,
    }))

    const { error: itemsError } = await supabase.from('checklist_items').insert(itemsToInsert)
    if (itemsError) {
      throw new Error(`Error creating items for "${sectionDef.title}": ${itemsError.message}`)
    }
  }

  const versionId = await createTemplateVersion(checklistId)
  console.log(`    version: ${versionId}`)

  const { count: scheduleCount } = await supabase
    .from('checklist_schedules')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', checklistId)

  console.log(`    schedules (auto-created by trigger): ${scheduleCount ?? 0}`)

  return 'created'
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== IMPORT ===')
  console.log(`Sections: ${SECTIONS.length}, items per template: ${TOTAL_ITEMS}`)
  console.log(`Models: ${MODEL_TEMPLATES.length}\n`)

  let created = 0
  let skipped = 0

  for (const { modelId, modelName, templateName } of MODEL_TEMPLATES) {
    const result = await seedTemplate(modelId, modelName, templateName)
    if (result === 'created') created++
    else skipped++
  }

  console.log(`\nSummary: ${created} created/would-create, ${skipped} skipped`)
  if (DRY_RUN) {
    console.log('Run with --import to apply changes.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
