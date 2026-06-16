# Módulo de Llantas v2 — UX/UI y Plan de Sprints

> **Estado:** Diseño greenfield (0 llantas → ~400 llantas)  
> **Audiencia:** Producto, diseño, agentes de implementación  
> **Stack UI:** Next.js App Router, shadcn/ui, patrones existentes (`DashboardShell`, `DashboardHeader`, `Card`, `Tabs`, `Badge`, `Alert`, `Dialog`, `KpiTile`)  
> **Base v1:** Catálogo, montaje/desmontaje, lecturas, checklist `tire_readings`, recepción PO, integración OT

---

## 1. Diagnóstico del estado actual (v1)

### 1.1 Rutas y navegación

| Ruta | Comportamiento actual | Problema |
|------|----------------------|----------|
| `/activos/llantas` | Catálogo global + reporte costo/desgaste | Empty state = celda de tabla "No hay llantas registradas." — **callejón sin salida** |
| `/activos/[id]/llantas` | Tabs: Mapa, Montadas, Historial, Eventos | Mapa = grid de `Card` con layout fijo 6 ruedas / 3 ejes (10 posiciones); no hay SVG interactivo |
| `/activos` | Botón "Llantas" en header | No hay acceso desde detalle del activo ni indicador de cobertura |
| Checklist | Sección `TireReadingsSection` | Si 0 montadas: card con "No hay llantas montadas en este activo." — informativo, no accionable |

### 1.2 Componentes existentes reutilizables

```
components/tires/
├── asset-tires-page.tsx      # Shell con Tabs — extender, no reescribir
├── tire-position-map.tsx     # Grid de cards — reemplazar por SVG en v2
├── create-tire-dialog.tsx    # Alta manual — mantener
├── mount-tire-dialog.tsx     # Montaje modal — evolucionar a sheet contextual
└── tire-reading-dialog.tsx   # Lectura puntual — mantener

lib/tires/
├── positions.ts              # TRUCK_6WHEEL + VEHICLE_4WHEEL hardcoded
├── checklist-readings.ts     # Persistencia desde checklist
├── inventory-integration.ts  # createTiresFromReceipt (PO)
└── cost-report.ts
```

### 1.3 Escala objetivo

- **~40 activos** × **~10 posiciones** = **~400 llantas montadas** + stock en almacén
- Onboarding debe ser **progresivo por planta/activo**, no big-bang de 400 registros en un día

---

## 2. Journey UX con CERO llantas

### 2.1 Principio rector

> **Nunca mostrar una tabla vacía como pantalla principal.**  
> En estado `empty`, la UI debe ser un **hub de configuración + checklist de progreso**, no un catálogo sin filas.

Estados del módulo (máquina de estados global):

```
EMPTY (0 llantas) → SETUP (config sin inventario) → PARTIAL (<80% cobertura) → OPERATIONAL (≥80%)
```

---

### 2.2 Primera visita: `/activos/llantas` (0 llantas globales)

#### Layout propuesto

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← Activos    Inventario de llantas                    [Configurar flota] │
│              Configure su estrategia de llantas antes de cargar datos.   │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ Activos con  │ │ Posiciones   │ │ Llantas en   │ │ Cobertura    │   │
│  │ layout       │ │ definidas    │ │ almacén      │ │ de flota     │   │
│  │   0 / 40     │ │   0          │ │   0          │ │   0%         │   │
│  │ sin captura  │ │ sin captura  │ │ sin captura  │ │ sin captura  │   │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  🛞  Comience la configuración de llantas                       │   │
│  │                                                                  │   │
│  │  Antes de registrar llantas, defina cómo se organizan en su     │   │
│  │  flota. Esto evita errores al montar y habilita el diagrama     │   │
│  │  interactivo por activo.                                        │   │
│  │                                                                  │   │
│  │  [Iniciar asistente de configuración]  [Ver guía rápida (PDF)]  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Próximos pasos recomendados:                                           │
│  ┌─ 1. Layouts por modelo ──────────────────────────── ○ Pendiente ─┐ │
│  ├─ 2. Reglas de identificación (DOT / ID interno) ─── ○ Pendiente ─┤ │
│  ├─ 3. Recepción inicial de inventario ─────────────── ○ Pendiente ─┤ │
│  └─ 4. Montaje piloto (1 activo) ──────────────────── ○ Pendiente ─┘ │
│                                                                         │
│  Acciones alternativas (colapsable "Ya tengo llantas en almacén"):      │
│  • Registrar llanta individual                                         │
│  • Importar desde recepción de OC                                      │
│  • Importar CSV (plantilla)                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Copy en español (empty state global)

| Elemento | Texto |
|----------|-------|
| Título hero | **Comience la configuración de llantas** |
| Subtítulo | Antes de registrar llantas, defina cómo se organizan en su flota. Esto evita errores al montar y habilita el diagrama interactivo por activo. |
| CTA primario | **Iniciar asistente de configuración** |
| CTA secundario | Ver guía rápida |
| KPI vacío | `emptyReason: 'awaiting-entry'` (patrón `KpiTile` existente) → badge ámbar **sin captura** |
| Acción rápida almacén | **Registrar llanta** / **Recepcionar desde OC** |

#### Rol: punto de entrada

| Rol | Vista por defecto | Acción destacada |
|-----|-------------------|------------------|
| **Supervisor / Jefe mantenimiento** | Hub empty + asistente | "Iniciar asistente de configuración" |
| **Almacén / Compras** | Misma pantalla, sección expandida "Inventario" | "Recepcionar desde OC" |
| **Mecánico** | Redirect suave a `/activos` con banner | "Aún no hay llantas configuradas. Pida a su supervisor iniciar la configuración." |

---

### 2.3 Primera visita: `/activos/[id]/llantas` (0 llantas en ese activo)

#### Detección de sub-estados

```
A) Activo sin modelo de layout asignado
B) Modelo con layout pero 0 llantas montadas y 0 en almacén compatible
C) Layout OK + llantas en almacén pero no montadas
D) Parcialmente montado (<100% posiciones)
```

#### Wireframe — sub-estado A (sin layout)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← Volver al activo    Llantas — Mixer SITRAK C7H #12                    │
├─────────────────────────────────────────────────────────────────────────┤
│  ⚠ Este activo no tiene layout de llantas definido.                     │
│                                                                         │
│  ┌───────────────────────────────┐  ┌──────────────────────────────┐   │
│  │  Silueta SVG (placeholder)    │  │  Asignar layout              │   │
│  │  contorno gris punteado       │  │                              │   │
│  │  "Sin configurar"             │  │  Modelo: SITRAK C7H Mixer    │   │
│  │                               │  │  Layout sugerido:            │   │
│  │                               │  │  ● Camión 6 ruedas (10 pos.) │   │
│  │                               │  │  ○ Camión 10 ruedas          │   │
│  │                               │  │                              │   │
│  │                               │  │  [Usar layout del modelo]    │   │
│  │                               │  │  [Personalizar posiciones]   │   │
│  └───────────────────────────────┘  └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Wireframe — sub-estado C (layout OK, almacén con stock)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Diagrama SVG — 10 posiciones, todas vacías (borde dashed, icono +)     │
│                                                                         │
│  Leyenda:  ○ Vacío   ● Montada   ⚠ Alerta   🔧 Acción pendiente        │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  0 de 10 posiciones ocupadas                                    │   │
│  │  Hay 24 llantas en almacén compatibles (11R22.5).               │   │
│  │                                                                  │   │
│  │  [Montaje rápido asistido]  [Montar posición por posición]      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Copy — empty state por activo

| Sub-estado | Título | Descripción | CTA |
|------------|--------|-------------|-----|
| A | **Configure el layout de llantas** | Asigne cuántas posiciones tiene este equipo y cómo se nombran. | Usar layout del modelo |
| B | **Sin llantas disponibles** | No hay llantas en almacén para este activo. Registre inventario o recepcione una OC. | Ir a inventario |
| C | **Listo para montar** | El layout está configurado. Seleccione una posición en el diagrama o use montaje asistido. | Montaje rápido asistido |
| D | **Montaje parcial** | {n} de {total} posiciones ocupadas. Complete el montaje para habilitar lecturas en checklist. | Ver posiciones vacías |

#### Interacción diagrama vacío

- Click en posición vacía → **Sheet lateral** (no dialog centrado) con:
  1. Posición seleccionada (ej. "Eje 2 — Izq. exterior")
  2. Selector de llanta (filtro: en almacén, medida compatible si configurada)
  3. Km/horómetro al montar (prellenado del activo)
  4. Notas + vínculo OT (si `?workOrderId=` presente)
  5. **[Montar]** / Cancelar

---

### 2.4 Asistente de onboarding (wizard)

**Ruta:** `/activos/llantas/configuracion` o modal full-screen en primera visita.

**Pasos (5 pantallas, progress bar superior):**

| Paso | Nombre | Contenido | Salida |
|------|--------|-----------|--------|
| 1 | **Alcance** | Seleccionar planta(s), categorías de activo (camiones, loaders), activos piloto (1–3) | `onboarding_scope` |
| 2 | **Layouts por modelo** | Tabla: Modelo → Layout template → Posiciones → Preview mini-SVG | `equipment_model_tire_layouts` |
| 3 | **Identificación** | Reglas ID: DOT obligatorio / prefijo interno / auto-generado secuencial | `tire_id_rules` |
| 4 | **Inventario inicial** | Elegir vía: OC existente / CSV / manual por lote | tires en `en_almacen` |
| 5 | **Piloto de montaje** | Elegir 1 activo → diagrama → montar ≥1 llanta → lectura de prueba | validación end-to-end |

**Comportamiento post-wizard:**

- Marcar `tire_module_onboarding_completed_at` (org o planta)
- Hub global pasa de `EMPTY` → `PARTIAL`
- Mostrar checklist persistente (Card colapsable) hasta ≥80% cobertura

**Guardar y continuar después:** cada paso persiste; el usuario puede salir y retomar.

---

### 2.5 Bootstrap de ~400 llantas sin abrumar

#### Estrategia: rollout progresivo en 4 oleadas

```
Oleada 0 — Configuración (0 llantas)
  └─ Layouts + reglas ID (sin montajes)

Oleada 1 — Piloto (1 activo, ~10 llantas)
  └─ Validar diagrama, montaje, checklist, OT

Oleada 2 — Planta piloto (~10 activos, ~100 llantas)
  └─ Recepción OC bulk + montaje por cuadrilla

Oleada 3 — Expansión (~40 activos, ~400 llantas)
  └─ CSV import + asignación masiva por plantilla

Oleada 4 — Operación continua
  └─ Dashboard excepciones + rotaciones
```

#### Vía A: Recepción masiva desde OC (existente, extender UI)

Flujo en `/compras` o desde hub de llantas:

1. Seleccionar OC con partidas tipo llanta (`isTireSkuLabel`)
2. Wizard post-recepción: capturar DOT por unidad o **escaneo en lote**
3. Preview: 40 llantas creadas → `[Confirmar e ir a almacén]`

#### Vía B: Import CSV (nuevo)

Plantilla descargable:

```csv
marca,medida,modelo,dot,condicion,costo_compra,fecha_compra,almacen_id
Michelin,11R22.5,XDA2,DOT1234567890,nueva,18500,2026-06-01,uuid-warehouse
```

- Validación inline: duplicados DOT, medidas no reconocidas
- Modo **dry-run** → tabla de errores → confirmar import
- Límite recomendado UI: 100 filas por lote (paginar lotes)

#### Vía C: Montaje masivo asistido (post-import)

Pantalla `/activos/llantas/montaje-masivo`:

1. Filtrar activos sin cobertura completa
2. Por activo: diagrama + drag-drop llantas desde panel lateral "Almacén"
3. Barra de progreso flota: `37/400 posiciones ocupadas`

---

### 2.6 Empty states accionables (patrón unificado)

Componente nuevo: `TireEmptyState` (similar a `SuppliersDataTable` emptyState)

```tsx
interface TireEmptyStateProps {
  variant: 'global' | 'asset-no-layout' | 'asset-no-stock' | 'asset-ready-to-mount' | 'checklist-no-tires'
  role: 'supervisor' | 'warehouse' | 'mechanic'
  onPrimaryAction: () => void
  onSecondaryAction?: () => void
}
```

**Reglas:**

- Siempre **1 CTA primario** + **1 secundario** máximo
- Icono contextual (`CircleDot`, `Settings`, `Package`, `Upload`)
- Nunca solo texto en `<TableCell colSpan={N}>`

---

### 2.7 Jerarquía visual al crecer (0 → 10 → 100 → 400)

| Escala | Hub global | Página activo | Dashboard excepciones |
|--------|------------|---------------|----------------------|
| **0** | Hero onboarding + checklist | SVG placeholder + wizard | Oculto (no aplica) |
| **1–10** | KPIs + tabla compacta + banner "Piloto" | Diagrama protagonista | Link "Ver alertas (n)" |
| **11–100** | Tabs: Resumen / Inventario / Cobertura | Diagrama + tabla lateral | KPI strip + tabla priorizada |
| **100–400** | Filtros planta/estado + paginación | Diagrama + panel detalle | Vista default supervisor |

**Densidad UI:**

- 0–10: cards grandes, mucho whitespace, copy educativo
- 100+: tablas densas, badges, filtros en `Sheet`, diagrama compacto

---

## 3. Arquitectura UX/UI v2 completa

### 3.1 Mapa de navegación

```
/activos
  └── /activos/llantas                    ← Hub flota (NEW v2)
        ├── /configuracion                ← Wizard onboarding
        ├── /excepciones                  ← Dashboard supervisor (NEW)
        ├── /importar                     ← CSV import (NEW)
        └── /llantas/[tireId]             ← Detalle llanta (NEW)

/activos/[id]
  └── /activos/[id]/llantas               ← Diagrama + montaje (EVOLVE)
        └── ?workOrderId=                 ← Contexto OT (EXISTING)

/modelos/[id]
  └── tab "Llantas"                       ← Layout editor (NEW)

/checklists/.../ejecutar
  └── sección tire_readings               ← Mobile-first (EVOLVE)

/configuracion (o /activos/llantas/ajustes)
  └── Reglas ID, umbrales PSI/mm          ← Settings (NEW)
```

---

### 3.2 Hub flota: `/activos/llantas`

#### Tres estados

**EMPTY** — ver sección 2.2  
**PARTIAL** — ver wireframe abajo  
**OPERATIONAL** — dashboard completo

#### Wireframe PARTIAL (<80% cobertura)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Inventario de llantas          [Importar] [Registrar] [Excepciones (3)] │
├─────────────────────────────────────────────────────────────────────────┤
│ KPI: En almacén 45 | Montadas 62 | Cobertura 62% | Alertas 3            │
├─────────────────────────────────────────────────────────────────────────┤
│ ⚠ Cobertura incompleta — 24 activos sin layout o montaje parcial       │
│ [Ver activos pendientes ▾]                                              │
├─────────────────────────────────────────────────────────────────────────┤
│ Tabs: [Resumen] [Inventario] [Cobertura por activo] [Costos]            │
│                                                                         │
│ Tab Cobertura:                                                          │
│ ┌────────────────┬──────────┬────────────┬─────────┐                   │
│ │ Activo         │ Layout   │ Montadas   │ Estado  │                   │
│ ├────────────────┼──────────┼────────────┼─────────┤                   │
│ │ Mixer #12      │ ✓ 10 pos │ 10/10      │ ✓ OK    │                   │
│ │ Camión #08     │ ✓ 10 pos │ 4/10       │ ⚠ Parcial│ → [Completar]   │
│ │ Loader #03     │ ✗        │ —          │ ○ Config │ → [Asignar layout]│
│ └────────────────┴──────────┴────────────┴─────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Wireframe OPERATIONAL

- KPI strip (4–6 tiles, estilo `KpiTile`)
- Tab **Excepciones** integrado o link a sub-ruta
- Tab **Inventario**: tabla con filtros (estado, planta, medida, alerta)
- Tab **Costos**: reporte existente mejorado con drill-down a `/llantas/[id]`
- Acciones header: Registrar | Importar | Rotación masiva (fase tardía)

---

### 3.3 Página activo con diagrama SVG

#### Wireframe — layout completo

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← Activo    Llantas — Camión #08                    [Montaje] [Rotar]   │
│             8/10 posiciones · Última lectura hace 3 días                │
├───────────────────────────────┬─────────────────────────────────────────┤
│                               │  Panel contextual (posición selecc.)    │
│     ┌─── EJE 1 ───┐           │  ─────────────────────────────────────  │
│     │ (●)   (●)   │           │  Eje 2 — Izq. exterior                  │
│     └─── EJE 2 ───┘           │  Michelin 11R22.5 · DOT …890            │
│   (●)(○)(○)(●)                │  Banda: 8.2 mm  Presión: 105 psi        │
│     └─── EJE 3 ───┘           │  Montada: 12 mar 2026                   │
│   (●)(●)(●)(●)                │                                         │
│                               │  [Registrar lectura]                    │
│  ○ Vacío  ● OK  ⚠ Alerta      │  [Desmontar]  [Rotar a…]               │
│                               │  [Ver historial de llanta →]            │
├───────────────────────────────┴─────────────────────────────────────────┤
│ Tabs: [Diagrama] [Tabla] [Historial] [Eventos]                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Comportamiento SVG

- Posiciones = `<g data-position="eje2_izq_ext">` clickeables
- Colores: vacío `#94a3b8` dashed, OK `#22c55e`, alerta `#f59e0b`, crítico `#ef4444`
- Hover: tooltip con label + última lectura
- Click vacío → Sheet montaje
- Click ocupado → panel lateral detalle
- Mobile: diagrama arriba, panel abajo en `Drawer`

#### Fuente de posiciones

```
equipment_model_tire_layouts (DB)
  └── JSON: { template: 'truck_6x4', positions: [...], svg_variant: 'v1' }
       ↓ fallback
lib/tires/positions.ts (hardcoded) — solo durante migración
```

---

### 3.4 Flujo montaje desde diagrama

```
Usuario click posición vacía
  → Sheet "Montar llanta en {label}"
  → Si sin stock: Alert inline + link "Recepcionar inventario"
  → Select llanta (Combobox con búsqueda DOT/marca)
  → Confirmar km/horómetro
  → POST /api/assets/[id]/tires
  → Toast "Montada en {label}"
  → Diagrama anima posición vacía → ocupada
  → Si OT vinculada: registrar evento + issue inventario (existente)
```

**Atajos:**

- Doble-click posición vacía → última llanta usada / misma medida
- Shift+click → montaje masivo modo (selección múltiple posiciones)

---

### 3.5 Dashboard excepciones (supervisor)

**Ruta:** `/activos/llantas/excepciones`  
**Usuario:** Supervisor, jefe de mantenimiento  
**Frecuencia:** revisión diaria (móvil + desktop)

#### Categorías de excepción (prioridad desc)

| Prioridad | Tipo | Criterio | Acción sugerida |
|-----------|------|----------|-----------------|
| P1 | Banda crítica | `tread_mm ≤ min_tread_mm` | Programar cambio |
| P1 | Presión crítica | fuera de rango ±20% | Verificar / ajustar |
| P2 | Sin lectura | >14 días sin lectura en posición montada | Solicitar checklist |
| P2 | Cobertura incompleta | activo operativo con <100% posiciones | Completar montaje |
| P3 | Rotación vencida | regla de km sin rotar (fase tardía) | Planificar rotación |
| P3 | Costo anómalo | $/km > percentil 90 flota | Revisar llanta |

#### Wireframe

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Excepciones de llantas — Flota              Filtro: [Planta ▾] [Hoy ▾]  │
├─────────────────────────────────────────────────────────────────────────┤
│ P1 Críticas (2)  P2 Atención (5)  P3 Informativas (8)                   │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ ⚠ Camión #08 · Eje 2 Izq. ext.                                      │ │
│ │   Banda 2.1 mm (mín. 3.0) · Sin OT abierta                          │ │
│ │   [Ver activo]  [Crear OT]  [Marcar revisado]                       │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ ○ Loader #03 · Sin layout configurado                               │ │
│ │   Activo operativo sin posiciones definidas                          │ │
│ │   [Asignar layout]                                                  │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 3.6 Checklist — ejecución campo (mobile)

**Componente:** evolución de `TireReadingsSection`

#### Configuración por plantilla (checklist template)

```typescript
type TireReadingMode = 'psi' | 'mm' | 'both' | 'none'
// En section config del template:
{ type: 'tire_readings', reading_mode: 'both', require_all_positions: true }
```

#### Wireframe mobile

```
┌─────────────────────────────┐
│ ← Checklist semanal         │
│   Mixer #12                 │
├─────────────────────────────┤
│ Llantas (10)    3/10 ✓      │
├─────────────────────────────┤
│ ┌─ Eje 1 Izq ─────────────┐ │
│ │ Michelin 11R22.5        │ │
│ │ Banda (mm) [____]       │ │
│ │ Presión   [____] psi    │ │
│ │ ⚠ Banda baja            │ │
│ └─────────────────────────┘ │
│ ┌─ Eje 1 Der ─────────────┐ │
│ │ ...                     │ │
│ └─────────────────────────┘ │
│ [Copiar lectura anterior]   │
└─────────────────────────────┘
```

**Empty en checklist (0 montadas):**

```
┌─────────────────────────────┐
│ Llantas                     │
│ Este activo no tiene llantas│
│ montadas.                   │
│                             │
│ [Ir a configurar llantas]   │  ← deep link /activos/[id]/llantas
│                             │
│ ☐ Omitir sección (supervisor│
│   habilitó skip)            │
└─────────────────────────────┘
```

**UX móvil:**

- Inputs numéricos grandes (`h-12`), teclado decimal
- Swipe entre posiciones
- Validación offline (patrón checklist existente)
- Badge progreso en header sección

---

### 3.7 Página detalle llanta

**Ruta:** `/activos/llantas/[tireId]`

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ← Inventario    Michelin 11R22.5 · DOT …890              [En almacén ▾] │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐  Historial de vida                                    │
│ │ Foto/DOT    │  ● Compra (OC #1234) — 01 jun 2026                    │
│ │ placeholder │  ● Montaje Camión #08 Eje2 Izq — 15 jun 2026          │
│ └─────────────┘  ○ Lecturas (sparkline banda)                          │
│                  ● Desmontaje → almacén                                 │
├─────────────────────────────────────────────────────────────────────────┤
│ Tabs: [Resumen] [Lecturas] [Eventos] [Costos]                         │
│ Costo acumulado: $18,500 + $1,200 reparación = $19,700                │
│ $/km: $2.45 (1,240 km en este ciclo)                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 3.8 Configuración (settings)

**Ruta:** `/activos/llantas/ajustes` (tab en hub, permiso admin)

| Sección | Campos | UI |
|---------|--------|-----|
| **Layouts por modelo** | template, posiciones[], svg_variant | Tabla modelos + editor visual |
| **Reglas ID** | DOT obligatorio, regex, prefijo auto | Form + preview "LL-2026-00421" |
| **Umbrales** | PSI min/max default, mm mín default | Inputs numéricos |
| **Checklist defaults** | reading_mode por categoría activo | Select |
| **Alertas** | días sin lectura, % presión | Sliders / inputs |

#### Wireframe layout editor (en modelo)

```
/modelos/[id] → Tab "Llantas"

┌─────────────────────────────────────────────────────────────────────────┐
│ Layout de llantas — SITRAK C7H Mixer                                    │
├───────────────────────────────┬─────────────────────────────────────────┤
│ Preview SVG                   │ Posiciones                              │
│ (drag to reorder)             │ ┌────┬───────────────┬─────┬──────────┐ │
│                               │ │ #  │ Código        │ Eje │ Lado     │ │
│                               │ ├────┼───────────────┼─────┼──────────┤ │
│                               │ │ 1  │ eje1_izq      │ 1   │ izq      │ │
│                               │ │ 2  │ eje1_der      │ 1   │ der      │ │
│                               │ └────┴───────────────┴─────┴──────────┘ │
│                               │ Plantilla: [Camión 6x4 (10) ▾]          │
│                               │ [Duplicar de otro modelo] [Guardar]     │
└───────────────────────────────┴─────────────────────────────────────────┘
```

---

## 4. Plan de sprints (6 sprints + Sprint 0)

> **Convención:** 1 sprint = 1 sesión de agente (~1–2 semanas calendario)  
> **Orden:** onboarding → layouts → diagrama → dashboard → checklist → rotación/bulk → KPIs

---

### Sprint 0 — Fundaciones (schema + tipos)

**Goal:** Preparar tablas y contratos API para v2 sin cambiar UX visible.

**User stories:**

- Como dev, necesito persistir layouts por modelo para no depender de constantes hardcoded.
- Como dev, necesito registrar progreso de onboarding por planta.

**Deliverables:**

- Migración SQL:
  - `equipment_model_tire_layouts` (model_id, template_key, positions JSONB, svg_variant)
  - `tire_fleet_settings` (plant_id nullable, id_rules JSONB, thresholds JSONB, checklist_defaults JSONB)
  - `tire_onboarding_progress` (plant_id, step, payload JSONB, completed_at)
  - Índices en `tires(plant_id, status)`, `asset_tire_installations(asset_id)` where removed_at IS NULL
- Tipos TS en `types/tires.ts`
- API stubs: `GET/PUT /api/tires/settings`, `GET/PUT /api/equipment-models/[id]/tire-layout`
- Helper `getPositionsForAsset(assetId)` con fallback a `DEFAULT_TIRE_POSITIONS`

**Archivos/áreas:**

```
supabase/migrations/20260617*_tire_v2_foundations.sql
types/tires.ts
lib/tires/positions.ts          # refactor: load from DB
lib/tires/layout-resolver.ts    # NEW
app/api/tires/settings/route.ts
app/api/equipment-models/[id]/tire-layout/route.ts
```

**Criterios de aceptación:**

- [ ] Migración aplica sin error en Supabase hosted
- [ ] Asset sin layout en DB usa fallback 6x4 sin crash
- [ ] Tests unitarios para `layout-resolver`

**Dependencias:** ninguna

**NO hacer en este sprint:**

- ❌ UI wizard
- ❌ SVG diagram
- ❌ CSV import
- ❌ Rotaciones

---

### Sprint 1 — Onboarding empty state (hub global + asset)

**Goal:** Reemplazar dead ends por empty states accionables y wizard pasos 1–2.

**User stories:**

- Como supervisor con 0 llantas, quiero ver qué hacer primero al entrar a Inventario de llantas.
- Como supervisor, quiero un asistente que me guíe a configurar layouts antes de cargar datos.
- Como mecánico, quiero un mensaje claro si aún no hay llantas configuradas.

**Deliverables:**

- `components/tires/tire-empty-state.tsx`
- `components/tires/fleet-hub-page.tsx` — reemplaza lógica inline de `app/activos/llantas/page.tsx`
- `components/tires/onboarding/` — wizard steps 1 (Alcance) y 2 (Layouts)
- Estado máquina: `empty | partial | operational` en hub
- KPI strip con `emptyReason: 'awaiting-entry'`
- Asset page: sub-estados A/B/C con `TireEmptyState`
- Link "Llantas" en `/activos/[id]/page.tsx` con badge cobertura

**Archivos/áreas:**

```
app/activos/llantas/page.tsx
app/activos/llantas/configuracion/page.tsx   # NEW
app/activos/[id]/page.tsx                    # add nav link
components/tires/asset-tires-page.tsx
components/tires/tire-empty-state.tsx
components/tires/onboarding/*
lib/tires/fleet-status.ts                    # NEW: compute empty/partial/operational
app/api/tires/fleet-status/route.ts
```

**Criterios de aceptación:**

- [ ] `/activos/llantas` con 0 llantas muestra hero + CTA asistente (no tabla vacía)
- [ ] Wizard paso 1–2 guarda progreso y retoma
- [ ] `/activos/[id]/llantas` sin layout muestra CTA "Usar layout del modelo"
- [ ] Mecánico ve banner informativo, no wizard admin
- [ ] Copy en español según tablas sección 2

**Dependencias:** Sprint 0

**NO hacer:**

- ❌ Diagrama SVG interactivo (mantener grid v1)
- ❌ Dashboard excepciones
- ❌ CSV import
- ❌ Config checklist por template

---

### Sprint 2 — Layouts por modelo + resolución por activo

**Goal:** Admin puede definir/editar layouts; activos heredan del modelo; posiciones dinámicas en mapa.

**User stories:**

- Como admin de flota, quiero asignar un layout de 10 posiciones al modelo SITRAK C7H.
- Como mecánico, quiero ver las posiciones correctas para un loader de 4 ruedas, no 10.

**Deliverables:**

- Tab "Llantas" en página de modelo (`/modelos/[id]`)
- Editor de posiciones: tabla editable + selector plantilla (`truck_6x4`, `vehicle_4wheel`, custom)
- Mini preview (grid simple, no SVG aún)
- `TirePositionMap` consume `getPositionsForAsset()`
- `MountTireDialog` posiciones dinámicas
- Tab "Cobertura por activo" en hub (estado PARTIAL)

**Archivos/áreas:**

```
app/modelos/[id]/page.tsx                    # add tab
components/models/tire-layout-tab.tsx        # NEW
components/tires/tire-position-map.tsx
components/tires/mount-tire-dialog.tsx
lib/tires/layout-resolver.ts
app/api/equipment-models/[id]/tire-layout/route.ts
app/api/tires/coverage/route.ts
```

**Criterios de aceptación:**

- [ ] Modelo con layout 4 ruedas → activo muestra 4 posiciones
- [ ] Cambio de layout no rompe instalaciones existentes (warning si posiciones huérfanas)
- [ ] Hub muestra tabla cobertura con filtros básicos
- [ ] Wizard paso 2 usa editor real

**Dependencias:** Sprint 0, Sprint 1

**NO hacer:**

- ❌ SVG interactivo
- ❌ Excepciones P1/P2
- ❌ Import CSV
- ❌ Rotación

---

### Sprint 3 — Diagrama SVG interactivo + montaje contextual

**Goal:** Diagrama es la UI principal del activo; click en posición → montaje/lectura.

**User stories:**

- Como mecánico, quiero clickear una posición vacía en el diagrama para montar ahí directamente.
- Como mecánico, quiero ver alertas visuales en el diagrama (banda/presión).

**Deliverables:**

- `components/tires/tire-diagram-svg.tsx` — SVG con posiciones clickeables
- `components/tires/tire-position-sheet.tsx` — Sheet montaje/detalle
- Layout asset page: diagrama + panel lateral (desktop) / drawer (mobile)
- Integración OT: query param `workOrderId` preservado
- Animación estado posición (vacío → montada)
- Wizard paso 5 (piloto montaje) con diagrama

**Archivos/áreas:**

```
components/tires/tire-diagram-svg.tsx
components/tires/tire-position-sheet.tsx
components/tires/asset-tires-page.tsx       # major refactor
lib/tires/diagram-geometry.ts               # NEW: SVG coords per template
public/tires/svg-templates/*.svg            # optional static assets
```

**Criterios de aceptación:**

- [ ] Click posición vacía abre sheet montaje con posición preseleccionada
- [ ] Click posición ocupada muestra detalle + acciones (lectura, desmontar)
- [ ] Alertas visuales consistentes con `isTreadLow` / `isPressureOutOfRange`
- [ ] Funciona en móvil (drawer, touch targets ≥44px)
- [ ] Grid v1 removido o como fallback "Vista tabla"

**Dependencias:** Sprint 2

**NO hacer:**

- ❌ Dashboard excepciones completo
- ❌ Rotación drag-drop entre posiciones
- ❌ CSV import
- ❌ Página detalle llanta completa

---

### Sprint 4 — Dashboard excepciones + detalle llanta

**Goal:** Supervisor tiene vista diaria de problemas; cualquier llanta tiene página de detalle.

**User stories:**

- Como supervisor, quiero ver todas las llantas con banda crítica sin abrir activo por activo.
- Como analista, quiero abrir una llanta y ver su historial de vida y $/km.

**Deliverables:**

- `/activos/llantas/excepciones` — lista priorizada P1/P2/P3
- `lib/tires/exceptions.ts` — query agregada
- KPI en hub: "Alertas (n)" con link
- `/activos/llantas/[tireId]` — detalle con tabs
- Acciones: Crear OT prellenada, marcar revisado
- Wizard pasos 3–4 (ID rules + inventario inicial via OC)

**Archivos/áreas:**

```
app/activos/llantas/excepciones/page.tsx
app/activos/llantas/[tireId]/page.tsx
components/tires/tire-detail-page.tsx
components/tires/exceptions-list.tsx
lib/tires/exceptions.ts
lib/tires/cost-report.ts                 # extend
app/api/tires/exceptions/route.ts
app/api/tires/[id]/route.ts
components/tires/onboarding/steps-id-rules.tsx
components/tires/onboarding/steps-inventory.tsx
```

**Criterios de aceptación:**

- [ ] Excepciones P1 (banda crítica) aparecen <24h después de lectura
- [ ] "Crear OT" navega a WO con contexto llanta/activo/posición
- [ ] Detalle llanta muestra timeline montajes/lecturas/eventos
- [ ] Hub OPERATIONAL cuando cobertura ≥80% y ≥1 lectura reciente

**Dependencias:** Sprint 3

**NO hacer:**

- ❌ Rotación UI
- ❌ CSV import completo
- ❌ Checklist config por template
- ❌ KPIs avanzados $/km flota

---

### Sprint 5 — Checklist configurable + lectura mobile

**Goal:** Plantillas checklist definen PSI/mm/both; ejecución campo optimizada.

**User stories:**

- Como admin checklist, quiero definir si este template pide solo presión o banda+y presión.
- Como operador en campo, quiero capturar lecturas rápido en checklist semanal.

**Deliverables:**

- Extender schema template section: `reading_mode`, `require_all_positions`
- UI en `template-editor` / `section-editor-body` para sección `tire_readings`
- `TireReadingsSection` respeta `reading_mode` (ocultar inputs no aplicables)
- Empty checklist accionable con deep link
- Validación: no completar si `require_all_positions` y faltan lecturas
- Progress indicator en checklist execution header

**Archivos/áreas:**

```
components/checklists/tire-readings-section.tsx
components/checklists/template-creation/section-editor-body.tsx
components/checklists/checklist-execution.tsx
lib/tires/checklist-readings.ts
lib/checklist/equipment-readings-validation.ts
app/api/checklists/schedules/[id]/complete-with-readings/route.ts
types/checklist*.ts
```

**Criterios de aceptación:**

- [ ] Template con `reading_mode: 'psi'` solo muestra presión
- [ ] Validación offline mantiene lecturas en cola
- [ ] Checklist en activo sin llantas muestra CTA (no dead end)
- [ ] Lecturas guardadas aparecen en diagrama activo

**Dependencias:** Sprint 3 (diagrama), Sprint 4 (alertas)

**NO hacer:**

- ❌ Rotación
- ❌ CSV import
- ❌ Reglas ID auto-generación compleja

---

### Sprint 6 — Bulk import, rotación, KPIs flota

**Goal:** Cargar 100–400 llantas eficientemente; rotación básica; KPIs operacionales.

**User stories:**

- Como almacén, quiero importar 50 llantas desde CSV con validación previa.
- Como mecánico, quiero registrar rotación entre posiciones con historial.
- Como gerente, quiero ver $/km promedio y cobertura de lecturas de la flota.

**Deliverables:**

- `/activos/llantas/importar` — CSV dry-run + confirm
- Plantilla CSV descargable
- `components/tires/rotation-dialog.tsx` — from/to position, misma llanta
- Evento `rotacion` en timeline
- Hub tab Costos/KPIs: cobertura lecturas 7d, $/km flota, llantas en stock
- Montaje masivo asistido (oleada 3) — versión mínima
- Wizard paso 4 completo (bulk PO + CSV)

**Archivos/áreas:**

```
app/activos/llantas/importar/page.tsx
components/tires/csv-import-wizard.tsx
components/tires/rotation-dialog.tsx
components/tires/bulk-mount-assistant.tsx
lib/tires/csv-import.ts
lib/tires/rotation.ts
app/api/tires/import/route.ts
app/api/assets/[id]/tires/route.ts          # add rotate action
components/tires/fleet-kpi-strip.tsx
```

**Criterios de aceptación:**

- [ ] CSV 100 filas importa en <30s con reporte errores
- [ ] Rotación crea evento + actualiza installation sin duplicar tire
- [ ] KPI strip muestra datos reales con filtro planta
- [ ] Flota 400 llantas: hub permanece usable (paginación, filtros)

**Dependencias:** Sprint 4, Sprint 5

**NO hacer:**

- ❌ ML predicción desgaste
- ❌ Integración telemática TPMS
- ❌ App nativa separada
- ❌ Multi-idioma

---

## 5. Matriz de roles × pantallas

| Pantalla | Supervisor | Almacén | Mecánico | Operador checklist |
|----------|:----------:|:-------:|:--------:|:------------------:|
| Hub global | ✓ admin | ✓ inventario | ○ lectura | — |
| Wizard config | ✓ | ○ | — | — |
| Diagrama activo | ✓ | ○ | ✓ | — |
| Excepciones | ✓ | — | ○ | — |
| Import CSV | ○ | ✓ | — | — |
| Checklist llantas | — | — | ○ | ✓ |
| Layout editor | ✓ | — | — | — |
| Ajustes umbrales | ✓ | — | — | — |

Leyenda: ✓ = acceso completo, ○ = lectura/limitado, — = no aplica

---

## 6. Componentes shadcn/ui a usar

| Componente | Uso en módulo llantas |
|------------|----------------------|
| `Card` | KPIs, empty states, panels |
| `Tabs` | Hub, detalle llanta, asset page |
| `Sheet` / `Drawer` | Montaje contextual mobile |
| `Dialog` | Confirmaciones desmonte/baja |
| `Badge` | Estado llanta, alertas |
| `Alert` | Banners onboarding, warnings layout |
| `Table` | Inventario, cobertura, excepciones |
| `Progress` | Wizard steps, cobertura flota |
| `Command` / `Combobox` | Búsqueda llanta por DOT |
| `Skeleton` | Loading states |
| `Sonner` toast | Feedback montaje/import |
| `KpiTile` | Hub operational |

---

## 7. Métricas de éxito post-implementación

| Métrica | Target |
|---------|--------|
| Tiempo onboarding 0 → piloto (1 activo montado) | < 2 horas supervisor |
| Cobertura flota | ≥80% en 30 días |
| Activos con layout asignado | 100% activos rodantes |
| Lecturas vía checklist vs manual | ≥70% checklist |
| Excepciones P1 atendidas <48h | ≥90% |

---

## 8. Referencias código v1

| Archivo | Relevancia |
|---------|------------|
| `app/activos/llantas/page.tsx` | Hub actual — reemplazar empty state |
| `components/tires/asset-tires-page.tsx` | Shell tabs — evolucionar |
| `components/tires/tire-position-map.tsx` | Grid — reemplazar por SVG |
| `lib/tires/positions.ts` | Layouts hardcoded — migrar a DB |
| `lib/tires/inventory-integration.ts` | PO receipt — extender UI bulk |
| `components/checklists/tire-readings-section.tsx` | Checklist — configurable |
| `components/suppliers/SupplierRegistry.tsx` | Patrón empty state con CTA |
| `components/reports/.../kpi-tile.tsx` | Patrón KPI `emptyReason` |

---

*Documento generado para implementación progresiva por agentes. Sprint 1 es el punto de entrada recomendado tras Sprint 0.*
