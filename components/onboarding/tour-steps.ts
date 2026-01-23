import { Tour } from 'nextstepjs'

// Tour steps for Operators
export const operatorTourSteps: Tour[] = [
  {
    tour: 'operator-onboarding',
    steps: [
      {
        icon: '👋',
        title: '¡Bienvenido al Sistema de Mantenimiento!',
        content: 'Este sistema te ayudará a gestionar el mantenimiento de los activos. Vamos a mostrarte las funciones más importantes.',
        selector: '#dashboard-header',
        side: 'bottom',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
        scrollIntoView: true,
        scrollBehavior: 'smooth',
      },
      {
        icon: '📋',
        title: 'Checklists Diarios - ¡IMPORTANTE!',
        content: 'Los checklists diarios son OBLIGATORIOS según la Política POL-OPE-001. Si no completas tu checklist, NO recibirás el pago del día y las operaciones pueden bloquearse.',
        selector: '[data-tour="checklists-nav"]',
        side: 'right',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
        nextRoute: '/checklists',
        scrollIntoView: true,
        scrollBehavior: 'smooth',
      },
      {
        icon: '🚜',
        title: 'Tus Activos Asignados',
        content: 'Aquí encuentras todos los activos bajo tu responsabilidad. Cada activo necesita su checklist diario completado antes de operar.',
        selector: '[data-tour="assets-nav"]',
        side: 'right',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
        nextRoute: '/activos',
        scrollIntoView: true,
        scrollBehavior: 'smooth',
      },
      {
        icon: '✅',
        title: '¡Listo para Trabajar!',
        content: 'Ya conoces lo esencial. Recuerda: completa tus checklists diarios ANTES de operar cualquier equipo. ¡Éxito en tu trabajo!',
        selector: '#dashboard-header',
        side: 'bottom',
        showControls: true,
        showSkip: false,
        pointerPadding: 10,
        pointerRadius: 8,
        scrollIntoView: true,
        scrollBehavior: 'smooth',
      },
    ],
  },
]

// Tour steps for Managers (Jefe de Planta, Jefe de Unidad, Gerencia)
export const managerTourSteps: Tour[] = [
  {
    tour: 'manager-onboarding',
    steps: [
      {
        icon: '👋',
        title: '¡Bienvenido al Sistema de Gestión!',
        content: 'Este sistema te permitirá supervisar el cumplimiento de políticas, gestionar personal y monitorear activos. Vamos a mostrarte las herramientas clave.',
        selector: '#dashboard-header',
        side: 'bottom',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
        scrollIntoView: true,
        scrollBehavior: 'smooth',
      },
      {
        icon: '📊',
        title: 'Menú de Navegación',
        content: 'Usa el menú lateral para navegar entre módulos. Cada sección tiene funciones específicas para gestión y supervisión.',
        selector: '#sidebar-navigation-content',
        side: 'right',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
      },
      {
        icon: '🎯',
        title: 'Dashboard de Cumplimiento',
        content: 'Tu herramienta principal. Haz clic en "Siguiente" para ir al Dashboard de Cumplimiento y monitorear el cumplimiento de la Política POL-OPE-001, identificar activos sin operadores y checklists pendientes.',
        selector: '[data-tour="compliance-section"]',
        side: 'right',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
        nextRoute: '/compliance',
      },
      {
        icon: '📊',
        title: 'Dashboard de Cumplimiento',
        content: 'Este es tu dashboard principal de cumplimiento. Aquí puedes ver el estado de todos los activos, identificar problemas y tomar acciones correctivas.',
        selector: '#compliance-dashboard-header',
        side: 'bottom',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
      },
      {
        icon: '🚨',
        title: 'Semáforo de Cumplimiento',
        content: 'Los colores indican urgencia: Verde = OK, Amarillo = Advertencia, Naranja = Crítico, Rojo = Emergencia. Actúa sobre los rojos y naranjas inmediatamente.',
        selector: '[data-tour="compliance-widget"]',
        side: 'top',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
      },
      {
        icon: '⚠️',
        title: 'Activos Olvidados',
        content: 'El sistema identifica automáticamente activos sin checklists o sin operador. Haz clic en "Siguiente" para ver esta sección. Como jefe, eres responsable de resolver estos casos.',
        selector: '[data-tour="forgotten-assets-link"]',
        side: 'right',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
        nextRoute: '/compliance/activos-olvidados',
      },
      {
        icon: '📋',
        title: 'Página de Activos Olvidados',
        content: 'Aquí puedes ver todos los activos que requieren atención: sin operador asignado, sin checklists recientes, o con problemas de cumplimiento.',
        selector: '#forgotten-assets-header',
        side: 'bottom',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
      },
      {
        icon: '🏢',
        title: 'Gestión Organizacional',
        content: 'Gestiona la estructura organizacional de tu empresa: asigna personal a plantas, activos a plantas y operadores a activos. Haz clic en "Siguiente" para ver esta sección.',
        selector: '[data-tour="asignaciones-organizacionales-nav"]',
        side: 'right',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
        nextRoute: '/gestion/asignaciones',
      },
      {
        icon: '📋',
        title: 'Asignaciones Organizacionales',
        content: 'Este proceso guiado te permite organizar tu estructura completa: personal, activos y operadores. Sigue los pasos para asignar personal a plantas, activos a plantas y operadores a activos.',
        selector: '#asignaciones-organizacionales-header',
        side: 'bottom',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
      },
      {
        icon: '✅',
        title: '¡Listo para Gestionar!',
        content: 'Ya conoces las herramientas principales. Usa el dashboard de cumplimiento como tu punto de partida cada día. Revisa los semáforos, actúa sobre alertas y mantén a tu equipo en cumplimiento.',
        selector: '#asignaciones-organizacionales-header',
        side: 'bottom',
        showControls: true,
        showSkip: false,
        pointerPadding: 10,
        pointerRadius: 8,
      },
    ],
  },
]

// Tour steps for Maintenance Manager (Encargado Mantenimiento)
export const maintenanceManagerTourSteps: Tour[] = [
  {
    tour: 'maintenance-manager-onboarding',
    steps: [
      {
        icon: '👋',
        title: '¡Bienvenido al Sistema de Mantenimiento!',
        content: 'Este sistema te permitirá gestionar activos, órdenes de trabajo, checklists y mantenimiento. Vamos a mostrarte las herramientas clave.',
        selector: '#dashboard-header',
        side: 'bottom',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
      },
      {
        icon: '📊',
        title: 'Menú de Navegación',
        content: 'Usa el menú lateral para navegar entre módulos. Cada sección tiene funciones específicas para gestión de mantenimiento.',
        selector: '#sidebar-navigation-content',
        side: 'right',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
      },
      {
        icon: '🚜',
        title: 'Gestión de Activos',
        content: 'Gestiona todos los activos de tu planta: visualiza, edita y supervisa el estado de los equipos. Haz clic en "Siguiente" para ver esta sección.',
        selector: '[data-tour="assets-nav"]',
        side: 'right',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
        nextRoute: '/activos',
      },
      {
        icon: '📋',
        title: 'Página de Activos',
        content: 'Desde aquí puedes ver todos los activos, su estado, historial de mantenimiento y gestionar su información.',
        selector: '#activos-header',
        side: 'bottom',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
      },
      {
        icon: '📋',
        title: 'Checklists de Mantenimiento',
        content: 'Los checklists son fundamentales para el mantenimiento preventivo. Gestiona templates, horarios y monitorea el cumplimiento. Haz clic en "Siguiente" para ver esta sección.',
        selector: '[data-tour="checklists-nav"]',
        side: 'right',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
        nextRoute: '/checklists',
      },
      {
        icon: '✅',
        title: 'Página de Checklists',
        content: 'Gestiona todos los checklists: diarios, semanales, mensuales y preventivos. Crea templates y programa mantenimientos.',
        selector: '#checklists-header',
        side: 'bottom',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
      },
      {
        icon: '🛠️',
        title: 'Órdenes de Trabajo',
        content: 'Crea y gestiona órdenes de trabajo para mantenimiento correctivo y preventivo. Haz clic en "Siguiente" para ver esta sección.',
        selector: '[data-tour="work-orders-nav"]',
        side: 'right',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
        nextRoute: '/ordenes',
      },
      {
        icon: '📋',
        title: 'Página de Órdenes de Trabajo',
        content: 'Desde aquí puedes crear, gestionar y supervisar todas las órdenes de trabajo de mantenimiento.',
        selector: '#ordenes-header',
        side: 'bottom',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
      },
      {
        icon: '🛒',
        title: 'Órdenes de Compra',
        content: 'Crea órdenes de compra para repuestos y materiales de mantenimiento. Haz clic en "Siguiente" para ver esta sección.',
        selector: '[data-tour="purchases-nav"]',
        side: 'right',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
        nextRoute: '/compras',
      },
      {
        icon: '✅',
        title: '¡Listo para Trabajar!',
        content: 'Ya conoces las herramientas principales de mantenimiento. Gestiona activos, checklists, órdenes de trabajo y compras para mantener los equipos en óptimas condiciones.',
        selector: '#compras-header',
        side: 'bottom',
        showControls: true,
        showSkip: false,
        pointerPadding: 10,
        pointerRadius: 8,
      },
    ],
  },
]

// Tour steps for Administrative Area
export const adminTourSteps: Tour[] = [
  {
    tour: 'admin-onboarding',
    steps: [
      {
        icon: '👋',
        title: '¡Bienvenido al Sistema!',
        content: 'Este sistema te permitirá gestionar compras, inventario, proveedores y más. Vamos a mostrarte las secciones principales.',
        selector: '#dashboard-header',
        side: 'bottom',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
      },
      {
        icon: '📋',
        title: 'Menú de Navegación',
        content: 'Explora el menú lateral para acceder a todas las funciones administrativas del sistema.',
        selector: '#sidebar-navigation-content',
        side: 'right',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
      },
      {
        icon: '🛒',
        title: 'Módulo de Compras',
        content: 'Gestiona órdenes de compra, cotizaciones y aprobaciones desde esta sección. Haz clic en "Siguiente" para ver esta página.',
        selector: '[data-tour="purchases-nav"]',
        side: 'right',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
        nextRoute: '/compras',
      },
      {
        icon: '📋',
        title: 'Página de Compras',
        content: 'Aquí puedes gestionar todas las órdenes de compra, ver su estado y aprobar solicitudes.',
        selector: '#compras-header',
        side: 'bottom',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
      },
      {
        icon: '📦',
        title: 'Control de Inventario',
        content: 'Administra el inventario de productos, repuestos y materiales desde el módulo de almacén. Haz clic en "Siguiente" para ver esta página.',
        selector: '[data-tour="warehouse-nav"]',
        side: 'right',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
        nextRoute: '/inventario',
      },
      {
        icon: '📋',
        title: 'Página de Inventario',
        content: 'Desde aquí puedes gestionar todo el inventario, repuestos, consumibles y sus garantías asociadas.',
        selector: '#inventario-header',
        side: 'bottom',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
      },
      {
        icon: '✅',
        title: '¡Todo Listo!',
        content: 'Ya conoces las funciones principales. Explora cada módulo para descubrir más herramientas.',
        selector: '#inventario-header',
        side: 'bottom',
        showControls: true,
        showSkip: false,
        pointerPadding: 10,
        pointerRadius: 8,
      },
    ],
  },
]

// Tour steps for Purchasing Assistant
export const purchasingAssistantTourSteps: Tour[] = [
  {
    tour: 'purchasing-assistant-onboarding',
    steps: [
      {
        icon: '👋',
        title: '¡Bienvenido al Sistema de Compras!',
        content: 'Este sistema te permitirá gestionar órdenes de compra e inventario. Vamos a mostrarte las funciones principales.',
        selector: '#dashboard-header',
        side: 'bottom',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
      },
      {
        icon: '🛒',
        title: 'Módulo de Compras',
        content: 'Gestiona órdenes de compra, cotizaciones y aprobaciones desde esta sección. Haz clic en "Siguiente" para ver esta página.',
        selector: '[data-tour="purchases-nav"]',
        side: 'right',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
        nextRoute: '/compras',
      },
      {
        icon: '📋',
        title: 'Página de Compras',
        content: 'Aquí puedes gestionar todas las órdenes de compra, ver su estado y procesar aprobaciones.',
        selector: '#compras-header',
        side: 'bottom',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
      },
      {
        icon: '📦',
        title: 'Control de Inventario',
        content: 'Administra el inventario de productos, repuestos y materiales desde el módulo de almacén. Haz clic en "Siguiente" para ver esta página.',
        selector: '[data-tour="warehouse-nav"]',
        side: 'right',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 8,
        nextRoute: '/inventario',
      },
      {
        icon: '✅',
        title: '¡Todo Listo!',
        content: 'Ya conoces las funciones principales de compras e inventario. Gestiona órdenes y mantén el inventario actualizado.',
        selector: '#inventario-header',
        side: 'bottom',
        showControls: true,
        showSkip: false,
        pointerPadding: 10,
        pointerRadius: 8,
      },
    ],
  },
]

// Helper function to get tour steps based on role
export function getTourStepsForRole(role?: string): Tour[] {
  if (!role) return []

  // Operator roles - Simple tour focused on checklists
  if (['OPERADOR', 'DOSIFICADOR'].includes(role)) {
    return operatorTourSteps
  }

  // Maintenance Manager - Focused on maintenance, assets, work orders, checklists
  if (['ENCARGADO_MANTENIMIENTO'].includes(role)) {
    return maintenanceManagerTourSteps
  }

  // Management roles - Full management tour with compliance and organizational management
  if (['JEFE_PLANTA', 'JEFE_UNIDAD_NEGOCIO', 'GERENCIA_GENERAL'].includes(role)) {
    return managerTourSteps
  }

  // Administrative Area - Purchases and inventory
  if (['AREA_ADMINISTRATIVA'].includes(role)) {
    return adminTourSteps
  }

  // Purchasing Assistant - Purchases and inventory focused
  if (['AUXILIAR_COMPRAS'].includes(role)) {
    return purchasingAssistantTourSteps
  }

  // Default tour for other roles (EJECUTIVO, VISUALIZADOR, etc.)
  return [
    {
      tour: 'default-onboarding',
      steps: [
        {
          icon: '👋',
          title: '¡Bienvenido!',
          content: 'Bienvenido al sistema de gestión de mantenimiento. Usa el menú lateral para explorar las diferentes secciones.',
          selector: '#sidebar-navigation-content',
          side: 'right',
          showControls: true,
          showSkip: true,
          pointerPadding: 10,
          pointerRadius: 8,
        },
      ],
    },
  ]
}

