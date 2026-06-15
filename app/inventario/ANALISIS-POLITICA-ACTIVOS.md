# ANÁLISIS: POLÍTICA DE ASIGNACIÓN Y MOVIMIENTOS DE ACTIVOS
## POL-OPE-002 Sección 3.8

**Fecha:** Febrero 2026
**Preparado para:** DC Concretos - Gerencia General

---

## RESUMEN EJECUTIVO

La nueva **Política de Asignación y Movimientos de Activos** (Sección 3.8) establece un marco de control completo para los movimientos de equipos, vehículos y maquinaria entre plantas, así como la asignación de personal a estos activos.

### Objetivos principales:
1. ✅ **Visibilidad total:** Gerencia General notificada de todos los movimientos
2. ✅ **Trazabilidad:** Historial completo de ubicación y operadores
3. ✅ **Responsabilidad:** Roles claros para ejecución y registro
4. ✅ **Control de pérdidas:** Reducir daños y uso no autorizado
5. ✅ **Optimización:** Mejor utilización de activos entre plantas

---

## CÓMO FUNCIONA LA POLÍTICA

### Flujo completo de movimiento de activo:

```
┌─────────────────────────────────────────────────────────────┐
│ PASO 1: SOLICITUD Y AUTORIZACIÓN (Sistema)                 │
└─────────────────────────────────────────────────────────────┘
   │
   │ Jefe de Planta Origen
   │ ↓ Crea solicitud en sistema
   │   • Código de activo
   │   • Planta destino
   │   • Motivo/duración
   │
   │ Jefe de Unidad de Negocio Destino
   │ ↓ Acepta/Rechaza
   │
   │ ⚠️ Gerencia General
   │ ↓ Recibe notificación automática
   │   Puede VETAR en 24 horas
   │
   │ Si no hay veto → APROBADO
   │
┌─────────────────────────────────────────────────────────────┐
│ PASO 2: EJECUCIÓN FÍSICA (Encargado de Mantenimiento)      │
└─────────────────────────────────────────────────────────────┘
   │
   │ Encargado de Mantenimiento Origen
   │ ↓ Prepara equipo para traslado
   │   • Checklist de estado
   │   • Fotos del equipo
   │   • Ejecuta traslado físico
   │   • Tiempo máximo: 72 horas
   │
   │ Encargado de Mantenimiento Destino
   │ ↓ Recibe equipo
   │   • Verifica checklist
   │   • Confirma estado
   │   • Reporta daños si existen
   │   • Firma recepción digital
   │
┌─────────────────────────────────────────────────────────────┐
│ PASO 3: REGISTRO EN SISTEMA (Ambos Mantenimientos)         │
└─────────────────────────────────────────────────────────────┘
   │
   │ Sistema actualiza:
   │ ✅ Ubicación del activo
   │ ✅ Historial de movimientos
   │ ✅ Evidencia fotográfica
   │ ✅ Firmas digitales
   │
   └──→ Dashboard de Gerencia actualizado en tiempo real
```

---

## ASIGNACIÓN DE PERSONAL A ACTIVOS

### Proceso:

**RESPONSABLE:** Jefe de Planta o Jefe de Unidad de Negocio

**Cuándo registrar:**
- ✅ Nuevo operador contratado → Asignar a equipo
- ✅ Cambio de operador → Reasignar equipo
- ✅ Operador da de baja → Liberar equipo
- ✅ Equipo nuevo → Asignar operador

**Tiempo máximo:** 24 horas desde el evento real

**Sistema registra:**
- Operador actual
- Historial de operadores
- Razón de cambios
- Fecha de asignación/cambio

---

## NOTIFICACIONES A GERENCIA GENERAL

El sistema envía **notificación automática** cuando:

| Evento | Criticidad | Acción esperada |
|--------|------------|-----------------|
| Solicitud de movimiento entre plantas | 🟡 Media | Puede vetar en 24h |
| Activo >$100K cambia de operador | 🟠 Alta | Solo informativo |
| Activo fuera de servicio >7 días | 🔴 Crítica | Investigar causa |
| Activo sin operador >48 horas | 🟠 Alta | Exigir justificación |
| Activo con >3 cambios de operador en 1 mes | 🔴 Crítica | Bandera roja - investigar |

**Beneficio:** Gerencia tiene visibilidad total sin necesidad de solicitar reportes.

---

## VENTAJAS DE ESTA POLÍTICA

### 1. **Control y Visibilidad**
- ✅ Gerencia General sabe dónde está cada activo en tiempo real
- ✅ Puede vetar movimientos que no tengan sentido
- ✅ Detecta patrones anormales (muchos cambios de operador)

### 2. **Trazabilidad Completa**
- ✅ Historial de dónde ha estado cada equipo
- ✅ Historial de quién ha operado cada equipo
- ✅ Evidencia fotográfica de estado en cada movimiento
- ✅ Reducción de "no sé dónde está el equipo"

### 3. **Responsabilidad Clara**
- ✅ Encargado de Mantenimiento ejecuta físicamente
- ✅ Jefe de Planta/UN registra asignación de personal
- ✅ No hay "zona gris" de responsabilidades

### 4. **Reducción de Pérdidas**
- ✅ Checklist de estado antes/después reduce disputas
- ✅ Fotos documentan condición real
- ✅ Sanciones claras por daños no reportados

### 5. **Optimización de Uso**
- ✅ Préstamos temporales formalizados
- ✅ Equipos sin operador detectados rápidamente
- ✅ Posibilidad de redistribuir activos subutilizados

---

## DESAFÍOS POTENCIALES Y SOLUCIONES

### ⚠️ **DESAFÍO 1: Resistencia al registro**

**Problema:** Jefes de Planta pueden olvidar o evitar registrar asignaciones

**Solución implementada:**
- ✅ Sanción de 10% de bono mensual por no registrar en <24h
- ✅ Sistema envía recordatorios automáticos
- ✅ KPI mensual de cumplimiento de registro

---

### ⚠️ **DESAFÍO 2: Proceso percibido como "burocrático"**

**Problema:** Personal puede sentir que es "mucho trámite"

**Solución:**
- ✅ Proceso digitalizado (no papeles)
- ✅ Aprobación automática si no hay veto en 24h
- ✅ Tiempo máximo claro: 72 horas para ejecución
- ✅ Beneficio comunicado: reduce conflictos sobre estado de equipos

---

### ⚠️ **DESAFÍO 3: Movimientos urgentes**

**Problema:** "Necesito el equipo YA, no puedo esperar 24 horas"

**Solución:**
- ✅ Sistema permite autorización verbal + registro inmediato
- ✅ Gerencia puede aprobar de inmediato si está disponible
- ✅ Aprobación automática en 24h si no hay veto
- ✅ Emergencias reales se registran post-facto con justificación

---

### ⚠️ **DESAFÍO 4: Equipos sin operador asignado**

**Problema:** Equipos "disponibles" pueden quedar sin registro

**Solución:**
- ✅ Máximo 48 horas sin operador
- ✅ Después de 48h: Jefe de Planta debe justificar o liberar
- ✅ Alerta automática a Gerencia
- ✅ KPI de "Activos con operador asignado" = 100%

---

### ⚠️ **DESAFÍO 5: Daños durante traslado**

**Problema:** "El equipo llegó dañado" vs "Ya estaba dañado"

**Solución:**
- ✅ Checklist de estado en origen
- ✅ Fotos antes del traslado
- ✅ Checklist de recepción en destino
- ✅ Fotos al llegar
- ✅ Reporte inmediato de daños
- ✅ Si no hay evidencia: Encargado de Mantenimiento que trasladó paga hasta 30%

---

## INTEGRACIÓN CON SISTEMA DIGITAL

### Módulos necesarios en dcmantenimiento.app:

**1. Módulo de Activos:**
- ✅ Catálogo de activos (código único por equipo)
- ✅ Ficha de activo con:
  - Ubicación actual
  - Operador actual
  - Historial de movimientos
  - Historial de operadores
  - Historial de mantenimientos
  - Consumos asociados (órdenes de compra)
  - Documentación (facturas, pólizas)

**2. Módulo de Movimientos de Activos:**
- ✅ Solicitud de movimiento (origen, destino, motivo)
- ✅ Workflow de autorización
- ✅ Notificaciones a Gerencia General
- ✅ Función de veto con plazo de 24h
- ✅ Checklist de entrega/recepción
- ✅ Carga de fotos
- ✅ Firmas digitales

**3. Módulo de Asignación de Personal:**
- ✅ Registro de operador asignado
- ✅ Historial de asignaciones
- ✅ Razones de cambio
- ✅ Alertas de activos sin operador

**4. Dashboard Ejecutivo para Gerencia:**
- ✅ Mapa de ubicación de activos por planta
- ✅ Movimientos pendientes de aprobación
- ✅ Movimientos en tránsito
- ✅ Alertas de activos sin operador
- ✅ Alertas de activos fuera de servicio
- ✅ KPIs de utilización

---

## CASOS DE USO REALES

### **CASO 1: Transferencia permanente de camión mezclador**

**Situación:** León tiene 3 camiones, solo usa 2. Tijuana necesita uno más.

**Flujo:**
1. Jefe de Planta León solicita transferencia a Tijuana en sistema
2. Jefe UN Tijuana acepta
3. Gerencia General recibe notificación, no veta
4. Después de 24h → Aprobado automáticamente
5. Encargado de Mantenimiento León:
   - Hace checklist del camión
   - Toma fotos
   - Coordina traslado con un operador
   - Registra salida en sistema
6. Encargado de Mantenimiento Tijuana:
   - Recibe camión
   - Verifica checklist
   - Toma fotos de recepción
   - Firma recepción digital
7. Jefe de Planta Tijuana:
   - Asigna operador al camión en sistema <24h
8. Sistema actualiza:
   - Ubicación del camión: Tijuana
   - Operador asignado: José López
   - Historial: Transferencia desde León

**Resultado:** Trazabilidad completa, sin conflictos.

---

### **CASO 2: Préstamo temporal de bomba**

**Situación:** Bajío necesita bomba por 15 días para proyecto urgente. León puede prestarla.

**Flujo:**
1. Jefe de Planta Bajío solicita préstamo temporal en sistema
   - Fecha de retorno: 15 días
2. Jefe de Planta León acepta
3. Gerencia recibe notificación, no veta
4. Proceso de traslado (igual que Caso 1)
5. Sistema programa alerta 48h antes del vencimiento
6. Sistema envía recordatorio a Jefe de Planta Bajío
7. Si no se devuelve a tiempo:
   - Sanción: $500 MXN por día de retraso
   - Gerencia recibe alerta

**Resultado:** Préstamos formalizados, sin "olvidos".

---

### **CASO 3: Cambio frecuente de operadores (Bandera Roja)**

**Situación:** Camión X ha tenido 4 operadores diferentes en 1 mes.

**Flujo:**
1. Sistema detecta patrón anormal
2. Envía alerta a Gerencia General
3. Gerencia investiga:
   - ¿Problema con el camión?
   - ¿Problemas de RH (rotación)?
   - ¿Mal uso del equipo?
4. Se toman medidas correctivas

**Resultado:** Detección temprana de problemas operativos.

---

## SANCIONES Y DISUASIÓN

### Filosofía de sanciones:

**Principio:** Las sanciones deben ser suficientemente altas para disuadir, pero no tan altas que paralicen la operación.

| Infracción | Sanción | Justificación |
|------------|---------|---------------|
| Movimiento sin autorización | 20% bono + acta | Grave: evade controles |
| No registrar asignación <24h | 10% bono | Moderada: afecta trazabilidad |
| No registrar movimiento | 20% bono | Grave: pérdida de control |
| Daño en traslado sin evidencia | Hasta 30% reparación | Grave: posible negligencia |
| Operador no asignado operando | 50% costo si hay incidente | Muy grave: riesgo legal |
| Préstamo no devuelto | $500/día | Moderada: incentivo a devolver |

---

## MÉTRICAS DE ÉXITO

### Indicadores para evaluar efectividad de la política:

**Mes 1-3 (Implementación):**
- ✅ 100% de activos codificados y registrados
- ✅ 100% de activos con ubicación definida
- ✅ 100% de activos con operador asignado
- ✅ 0 movimientos sin autorización

**Mes 4-6 (Adopción):**
- ✅ ≥95% de asignaciones registradas <24h
- ✅ ≥90% de traslados ejecutados <72h
- ✅ 100% de préstamos devueltos a tiempo
- ✅ 0 pérdidas de activos

**Mes 7-12 (Optimización):**
- ✅ Tasa de utilización de activos ≥85%
- ✅ Reducción del 50% en disputas sobre estado de equipos
- ✅ Reducción del 30% en tiempo de búsqueda de equipos
- ✅ Gerencia con visibilidad 100% en tiempo real

---

## RIESGOS Y MITIGACIONES

### RIESGO 1: Personal no capacitado en sistema

**Probabilidad:** Alta
**Impacto:** Medio
**Mitigación:**
- ✅ Capacitación obligatoria Mes 1
- ✅ Manuales de usuario en sistema
- ✅ Soporte técnico disponible
- ✅ Sesiones de refuerzo mensuales

---

### RIESGO 2: Sistema no disponible (downtime)

**Probabilidad:** Media
**Impacto:** Alto
**Mitigación:**
- ✅ Proceso manual de respaldo (Excel)
- ✅ Registro post-facto cuando sistema regrese
- ✅ SLA de 99.5% uptime con proveedor
- ✅ Notificaciones de mantenimiento programado

---

### RIESGO 3: Resistencia cultural ("siempre lo hemos hecho así")

**Probabilidad:** Alta
**Impacto:** Alto
**Mitigación:**
- ✅ Comunicación de beneficios (reduce conflictos)
- ✅ Liderazgo desde Gerencia General
- ✅ Sanciones claras pero justas
- ✅ Casos de éxito documentados
- ✅ Bonos de cumplimiento

---

### RIESGO 4: Información incorrecta en sistema

**Probabilidad:** Media
**Impacto:** Medio
**Mitigación:**
- ✅ Auditorías trimestrales de activos
- ✅ Comparación física vs sistema
- ✅ Corrección inmediata de discrepancias
- ✅ Sanción por información falsa

---

## RECOMENDACIONES DE IMPLEMENTACIÓN

### FASE 1: PREPARACIÓN (Semanas 1-2)

**Actividades:**
1. ✅ Codificar todos los activos (código único)
2. ✅ Tomar fotos de estado actual de cada activo
3. ✅ Registrar ubicación actual en sistema
4. ✅ Registrar operador actual asignado
5. ✅ Configurar notificaciones a Gerencia General
6. ✅ Capacitar a Encargados de Mantenimiento
7. ✅ Capacitar a Jefes de Planta/UN

**Entregables:**
- Base de datos completa de activos
- Módulo de movimientos configurado
- Personal capacitado

---

### FASE 2: PILOTO (Semanas 3-4)

**Actividades:**
1. ✅ Probar con 2-3 movimientos controlados
2. ✅ Validar workflow de autorización
3. ✅ Validar notificaciones a Gerencia
4. ✅ Identificar problemas de UX
5. ✅ Ajustar proceso según feedback

**Entregables:**
- Proceso validado
- Bugs corregidos
- Feedback documentado

---

### FASE 3: LANZAMIENTO (Semana 5)

**Actividades:**
1. ✅ Comunicado oficial de Gerencia General
2. ✅ Política publicada y firmada
3. ✅ Sistema activo para todas las plantas
4. ✅ Soporte técnico disponible 24/7

**Entregables:**
- Política oficial en vigor
- Sistema 100% operativo

---

### FASE 4: SEGUIMIENTO (Semanas 6-12)

**Actividades:**
1. ✅ Revisión semanal de cumplimiento
2. ✅ Aplicación de sanciones si aplica
3. ✅ Corrección de desvíos
4. ✅ Ajustes menores a la política

**Entregables:**
- Reportes semanales de cumplimiento
- Ajustes documentados

---

## COSTOS DE IMPLEMENTACIÓN

### Costos directos:

| Concepto | Costo estimado |
|----------|----------------|
| Desarrollo de módulo en sistema | $30,000 - $50,000 MXN |
| Codificación de activos (placas/etiquetas) | $5,000 MXN |
| Capacitación (4 sesiones) | $10,000 MXN |
| Fotos y checklist inicial | $2,000 MXN |
| **TOTAL** | **$47,000 - $67,000 MXN** |

### Costos indirectos:

| Concepto | Costo |
|----------|-------|
| Tiempo de personal en capacitación | 40 horas-hombre |
| Tiempo de registro inicial | 80 horas-hombre |
| **TOTAL** | **120 horas-hombre** |

---

## RETORNO DE INVERSIÓN (ROI)

### Ahorros estimados anuales:

| Concepto | Ahorro anual |
|----------|--------------|
| Reducción de disputas sobre daños (tiempo legal) | $50,000 MXN |
| Reducción de pérdida de activos (1 activo = $500K+) | $100,000 MXN |
| Mejor utilización de activos (evitar rentas) | $200,000 MXN |
| Reducción de tiempo buscando equipos | $30,000 MXN |
| **TOTAL** | **$380,000 MXN** |

### ROI:
```
ROI = (Ahorro anual - Costo) / Costo × 100
ROI = ($380,000 - $67,000) / $67,000 × 100
ROI = 467%
```

**Payback period:** 2-3 meses

---

## CONCLUSIÓN

La **Política de Asignación y Movimientos de Activos** es una adición estratégica a POL-OPE-002 que:

✅ **Cierra una brecha crítica:** Control sobre movimientos de activos
✅ **Empodera a Gerencia General:** Visibilidad y poder de veto
✅ **Clarifica responsabilidades:** Mantenimiento ejecuta, Planta/UN registra
✅ **Reduce pérdidas:** Trazabilidad y evidencia fotográfica
✅ **Optimiza recursos:** Mejor utilización de activos entre plantas
✅ **ROI alto:** 467% de retorno en primer año

### Recomendación: **APROBACIÓN INMEDIATA**

**Siguiente paso:** Iniciar Fase 1 de implementación.

---

**Preparado por:** Claude (Análisis)
**Fecha:** Febrero 2026
**Versión:** 1.0

---

**DC Concretos, S.A. de C.V.**
📧 rh@dcconcretos.com.mx
🌐 www.dcconcretos.com.mx

*"Ayudando a concretar ideas"*
