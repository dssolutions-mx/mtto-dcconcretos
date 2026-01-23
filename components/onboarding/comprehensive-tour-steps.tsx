'use client'

import React from 'react'
import { Shield, Home, Navigation, ClipboardList, Package, Wrench, BarChart3, ShoppingCart, Users, FileText, AlertTriangle, CheckCircle, Settings, HelpCircle, BookOpen, Target, TrendingUp, Calendar, UserCheck, Building2, Fuel, Droplet, Info } from 'lucide-react'

export interface ComprehensiveTourStep {
  id: string
  target?: string
  title: string
  description: string
  detailedExplanation?: string
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  action?: {
    label: string
    onClick?: () => void
    href?: string
  }
  icon?: React.ReactNode
  type?: 'info' | 'navigation' | 'feature' | 'warning' | 'tip'
  showSkip?: boolean
}

export function getComprehensiveTourSteps(userRole?: string): ComprehensiveTourStep[] {
  const baseSteps: ComprehensiveTourStep[] = [
    {
      id: 'welcome',
      title: '¡Bienvenido al Sistema de Mantenimiento!',
      description: 'Este sistema te ayudará a gestionar el mantenimiento preventivo y correctivo de todos los activos de la empresa.',
      detailedExplanation: 'Este sistema fue diseñado para cumplir con la Política POL-OPE-001 de Mantenimiento. Todas las funcionalidades están alineadas con los requisitos de la política para garantizar el cumplimiento y la seguridad operativa.',
      type: 'info',
      icon: <Home className="h-5 w-5 text-blue-500" />,
      position: 'center'
    },
    {
      id: 'navigation-explanation',
      title: 'Navegación del Sistema',
      description: 'La barra lateral izquierda es tu punto de acceso principal a todas las funcionalidades del sistema.',
      detailedExplanation: 'La navegación está organizada por módulos funcionales. Cada sección agrupa funciones relacionadas para facilitar el acceso. Los iconos y colores te ayudan a identificar rápidamente cada módulo.',
      type: 'navigation',
      icon: <Navigation className="h-5 w-5 text-blue-500" />,
      position: 'center',
      target: '[data-tour="sidebar"]'
    },
    {
      id: 'dashboard-overview',
      title: 'Dashboard Principal',
      description: 'El dashboard muestra un resumen de todas las actividades importantes del sistema.',
      detailedExplanation: 'Aquí puedes ver de un vistazo: activos asignados, checklists pendientes, órdenes de trabajo, y métricas clave. Esta vista te ayuda a priorizar tu trabajo diario y detectar problemas antes de que se conviertan en emergencias.',
      type: 'feature',
      icon: <Home className="h-5 w-5 text-green-500" />,
      position: 'bottom',
      target: '[data-tour="dashboard"]'
    }
  ]

  // Role-specific steps
  if (['OPERADOR', 'DOSIFICADOR'].includes(userRole || '')) {
    return [
      ...baseSteps,
      {
        id: 'checklists-importance',
        title: 'Checklists Diarios - Tu Responsabilidad Principal',
        description: 'Los checklists diarios son OBLIGATORIOS según la Política POL-OPE-001, sección 3.6.',
        detailedExplanation: 'La política establece que TODOS los activos deben tener un checklist diario completado. Si no completas tu checklist, el sistema puede bloquear operaciones como carga de combustible. Esto es para garantizar la seguridad y prevenir fallos en los equipos.',
        type: 'warning',
        icon: <AlertTriangle className="h-5 w-5 text-orange-500" />,
        position: 'bottom',
        target: '[data-tour="checklists"]'
      },
      {
        id: 'checklists-how-to',
        title: 'Cómo Completar Checklists',
        description: 'Ve a la sección "Checklists" en el menú lateral para ver tus checklists asignados.',
        detailedExplanation: 'Cada checklist tiene items específicos que debes verificar. Marca cada item como "OK" o "Con Observaciones". Si hay observaciones, el sistema creará automáticamente una orden de trabajo correctiva. Esto asegura que los problemas se documenten y resuelvan.',
        type: 'feature',
        icon: <ClipboardList className="h-5 w-5 text-green-500" />,
        position: 'bottom',
        action: {
          label: 'Ir a Checklists',
          href: '/checklists'
        }
      },
      {
        id: 'checklists-consequences',
        title: 'Consecuencias de No Completar Checklists',
        description: '⚠️ IMPORTANTE: No completar checklists tiene consecuencias según la política.',
        detailedExplanation: 'Según la Política POL-OPE-001 sección 3.6, si no completas tu checklist diario, NO recibirás el pago del día. Además, el sistema puede bloquear operaciones como carga de combustible hasta que el checklist esté completo. Esto es para proteger tu seguridad y la de tus compañeros.',
        type: 'warning',
        icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
        position: 'center'
      },
      {
        id: 'assets-assigned',
        title: 'Activos Asignados',
        description: 'En el dashboard puedes ver todos los activos que están bajo tu responsabilidad.',
        detailedExplanation: 'Cada activo debe tener un operador asignado según la Política POL-OPE-001 sección 3.1. Si un activo no tiene operador, el Jefe de Planta es responsable. El sistema rastrea automáticamente qué activos tienen operadores y cuáles no.',
        type: 'info',
        icon: <Package className="h-5 w-5 text-blue-500" />,
        position: 'bottom',
        target: '[data-tour="assets"]'
      },
      {
        id: 'work-orders',
        title: 'Órdenes de Trabajo',
        description: 'Las órdenes de trabajo se crean automáticamente cuando detectas problemas en los checklists.',
        detailedExplanation: 'Cuando marcas un item del checklist como "Con Observaciones", el sistema crea automáticamente una orden de trabajo correctiva. Esto asegura que los problemas se documenten, se asignen a técnicos, y se resuelvan. No puedes "olvidar" reportar un problema porque el sistema lo hace automáticamente.',
        type: 'feature',
        icon: <Wrench className="h-5 w-5 text-purple-500" />,
        position: 'bottom',
        action: {
          label: 'Ver Órdenes',
          href: '/ordenes'
        }
      },
      {
        id: 'mobile-access',
        title: 'Acceso Móvil',
        description: 'Puedes acceder al sistema desde tu teléfono móvil para completar checklists en campo.',
        detailedExplanation: 'El sistema está optimizado para móviles. Puedes completar checklists directamente en el lugar donde está el activo, tomar fotos como evidencia, y registrar lecturas de medidores. Todo se sincroniza automáticamente cuando tienes conexión a internet.',
        type: 'tip',
        icon: <HelpCircle className="h-5 w-5 text-purple-500" />,
        position: 'center'
      }
    ]
  }

  if (['GERENCIA_GENERAL', 'JEFE_UNIDAD_NEGOCIO', 'JEFE_PLANTA', 'AREA_ADMINISTRATIVA', 'ENCARGADO_MANTENIMIENTO'].includes(userRole || '')) {
    return [
      ...baseSteps,
      {
        id: 'compliance-overview',
        title: 'Sistema de Cumplimiento',
        description: 'El módulo de Cumplimiento te permite monitorear el cumplimiento de la Política POL-OPE-001.',
        detailedExplanation: 'Este módulo fue creado específicamente para hacer cumplir la Política POL-OPE-001. Te muestra qué activos no tienen operadores asignados, qué activos no tienen checklists recientes, y qué incidentes de cumplimiento han ocurrido. Esto te ayuda a identificar problemas antes de que se conviertan en sanciones.',
        type: 'feature',
        icon: <Shield className="h-5 w-5 text-green-500" />,
        position: 'bottom',
        target: '[data-tour="compliance-dashboard"]',
        action: {
          label: 'Ir a Cumplimiento',
          href: '/compliance'
        }
      },
      {
        id: 'forgotten-assets',
        title: 'Activos Olvidados',
        description: 'El sistema identifica automáticamente activos que no tienen checklists recientes o no tienen operador asignado.',
        detailedExplanation: 'Según la Política POL-OPE-001, todos los activos deben tener un operador asignado (sección 3.1) y checklists diarios completados (sección 3.6). El sistema rastrea esto automáticamente y te notifica cuando hay problemas. Si un activo no tiene operador, TÚ (Jefe de Planta) eres responsable según la política.',
        type: 'warning',
        icon: <AlertTriangle className="h-5 w-5 text-orange-500" />,
        position: 'bottom',
        action: {
          label: 'Ver Activos Olvidados',
          href: '/compliance/activos-olvidados'
        }
      },
      {
        id: 'incidents-management',
        title: 'Gestión de Incidentes',
        description: 'Los incidentes de cumplimiento se crean automáticamente cuando se detectan violaciones de la política.',
        detailedExplanation: 'El sistema crea incidentes automáticamente cuando: un activo no tiene operador, un checklist no se completa, o un activo se mueve sin operador. Los usuarios pueden disputar incidentes si creen que fueron creados incorrectamente. Tú puedes revisar y aprobar/rechazar disputas.',
        type: 'feature',
        icon: <FileText className="h-5 w-5 text-blue-500" />,
        position: 'bottom',
        action: {
          label: 'Ver Incidentes',
          href: '/compliance/incidentes'
        }
      },
      {
        id: 'reports-overview',
        title: 'Reportes y Análisis',
        description: 'Los reportes te permiten analizar el rendimiento y cumplimiento del mantenimiento.',
        detailedExplanation: 'Los reportes incluyen: cumplimiento de checklists, tiempo de respuesta a órdenes de trabajo, costos de mantenimiento, y análisis de tendencias. Estos reportes te ayudan a tomar decisiones informadas y demostrar cumplimiento con la política.',
        type: 'feature',
        icon: <BarChart3 className="h-5 w-5 text-green-500" />,
        position: 'bottom',
        target: '[data-tour="reports"]',
        action: {
          label: 'Ver Reportes',
          href: '/reportes'
        }
      },
      {
        id: 'work-orders-management',
        title: 'Gestión de Órdenes de Trabajo',
        description: 'Las órdenes de trabajo pueden ser preventivas (programadas) o correctivas (por problemas detectados).',
        detailedExplanation: 'Las órdenes preventivas se crean automáticamente según los intervalos de mantenimiento definidos. Las correctivas se crean cuando se detectan problemas en checklists o cuando se reportan fallos. El sistema rastrea el estado de cada orden y te notifica cuando hay retrasos.',
        type: 'feature',
        icon: <Wrench className="h-5 w-5 text-purple-500" />,
        position: 'bottom',
        action: {
          label: 'Ver Órdenes',
          href: '/ordenes'
        }
      },
      {
        id: 'purchases',
        title: 'Gestión de Compras',
        description: 'Las órdenes de compra se crean para adquirir repuestos y materiales necesarios para el mantenimiento.',
        detailedExplanation: 'Cuando una orden de trabajo requiere repuestos, puedes crear una orden de compra directamente desde la orden. El sistema rastrea el estado de aprobación y te notifica cuando los materiales están disponibles.',
        type: 'feature',
        icon: <ShoppingCart className="h-5 w-5 text-orange-500" />,
        position: 'bottom',
        action: {
          label: 'Ver Compras',
          href: '/compras'
        }
      },
      {
        id: 'assets-management',
        title: 'Gestión de Activos',
        description: 'Los activos son los equipos que requieren mantenimiento (bombas, plantas, vehículos, etc.).',
        detailedExplanation: 'Cada activo debe tener: un operador asignado (Política 3.1), un modelo de equipo asociado, y checklists programados. Si un activo se mueve a otra planta, el sistema detecta si el operador actual puede acceder a la nueva planta y te notifica si necesita reasignación.',
        type: 'info',
        icon: <Package className="h-5 w-5 text-blue-500" />,
        position: 'bottom',
        action: {
          label: 'Ver Activos',
          href: '/activos'
        }
      },
      {
        id: 'personnel-management',
        title: 'Gestión de Personal',
        description: 'Aquí puedes gestionar empleados, asignar operadores a activos, y ver credenciales.',
        detailedExplanation: 'La asignación de operadores es crítica según la Política POL-OPE-001. Si un activo no tiene operador, el Jefe de Planta es responsable. El sistema te ayuda a asegurar que todos los activos tengan operadores asignados y te alerta cuando hay cambios que podrían dejar activos sin operador.',
        type: 'info',
        icon: <Users className="h-5 w-5 text-indigo-500" />,
        position: 'bottom',
        action: {
          label: 'Ver Personal',
          href: '/gestion/personal'
        }
      },
      {
        id: 'system-settings',
        title: 'Configuración del Sistema',
        description: 'Solo administradores pueden acceder a la configuración del sistema.',
        detailedExplanation: 'La configuración permite habilitar/deshabilitar características como el bloqueo de operaciones sin checklist. Esto permite un despliegue gradual de nuevas funcionalidades. Todos los cambios se registran en un log de auditoría.',
        type: 'info',
        icon: <Settings className="h-5 w-5 text-gray-500" />,
        position: 'bottom',
        action: {
          label: 'Ver Configuración',
          href: '/compliance/configuracion'
        }
      },
      {
        id: 'policy-enforcement',
        title: 'Cumplimiento de Política',
        description: 'El sistema está diseñado para hacer cumplir automáticamente la Política POL-OPE-001.',
        detailedExplanation: 'La política establece requisitos claros: operadores asignados (3.1), checklists diarios (3.6), y sanciones por incumplimiento. El sistema rastrea todo esto automáticamente y crea incidentes cuando detecta violaciones. No puedes "olvidar" cumplir con la política porque el sistema lo detecta automáticamente.',
        type: 'warning',
        icon: <Shield className="h-5 w-5 text-red-500" />,
        position: 'center'
      }
    ]
  }

  // Default steps for other roles
  return [
    ...baseSteps,
    {
      id: 'general-info',
      title: 'Información General',
      description: 'Este sistema gestiona el mantenimiento preventivo y correctivo de todos los activos.',
      detailedExplanation: 'El sistema está diseñado para cumplir con la Política POL-OPE-001 de Mantenimiento. Todas las funcionalidades están alineadas con los requisitos de la política.',
      type: 'info',
      icon: <Info className="h-5 w-5 text-blue-500" />,
      position: 'center'
    }
  ]
}
