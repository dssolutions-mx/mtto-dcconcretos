# POL-OPE-002 — Gestión de Inventario y Activos
**v2.0 · Marzo 2026 · DC Concretos, S.A. de C.V.**

Plataforma: https://dcmantenimiento.app/

Coordina con POL-OPE-001 (Mantenimiento) — el equipo de Mantenimiento genera las OC y gestiona los activos de producción.

---

## Alcance

Plantas: León, Tijuana, Silao, Bajío y demás unidades activas.

**Inventario:** materiales, refacciones, consumibles.

**Activos:** equipos de producción, vehículos, maquinaria pesada, herramienta mayor (>$10,000). NO incluye repuestos/consumibles.

---

## Roles

| Rol | Responsabilidad clave |
|-----|----------------------|
| **Gerente General** | Autoriza OC compra externa ≥ $7,000 (tras viabilidad Administración). Bajas de inventario alto valor. Venta/baja definitiva de activos. Notificación de movimientos de activos y personal. |
| **Gerente de Mantenimiento** | Autoriza TODAS las OC (Nivel 1). Supervisa movimientos de activos y checklists. Padrón con Administración. Notificado de activos sin operador y equipos fuera de servicio. |
| **Coordinador de Mtto** | Genera OC vinculadas a OT (si involucra activo). Ejecuta movimientos físicos de activos. Genera checklists salida/recepción. Solicita materiales por OC. |
| **Jefe de Unidad de Negocio** | Supervisa Encargado de Almacén. Revisa inventario mensual. Investiga diferencias. Subsidiario si no hay JP. |
| **Jefe de Planta** | Registra asignación personal a activos. Justifica activos sin operador >48h. Si falta Encargado de Almacén: asume custodia temporal. |
| **Encargado de Almacén** | Custodia física. Entrega SOLO con OC aprobada (+ OT si involucra activo). Registra movimientos <2h. Conteos cíclicos. **Asume 100% del costo si entrega sin OC.** |
| **Dosificadores / Operadores** | Reciben materiales autorizados. Firma digital en plataforma. |
| **Administración** | Viabilidad solo para OC de compra externa (Tipo B). Las OC de consumo de inventario (Tipo A) NO requieren esta revisión. Padrón con Gerente de Mtto. CxP. Reclamos de garantía. |
| **RRHH** | Notificado de todo movimiento de personal (asignaciones, reasignaciones, bajas). Procesa movimientos. Notifica a GG. Alta de usuarios con JUN/JP (POL-OPE-001 §3.2.1). |

---

## Órdenes de Compra

**Regla: No OC aprobada = no se libera inventario. Las OC las genera SOLO el Coordinador o Gerente de Mantenimiento.**

Emergencias: autorización verbal Gerente de Mtto + OC formal en plataforma <2h.

### Flujo

1. **Creación:** Coordinador o Gerente de Mtto crea OC: código/descripción, cantidad, justificación (OT si involucra activo; reabastecimiento si es stock), fecha, centro de costo.
2. **Autorización:** según tabla (ver abajo).
3. **Liberación:** Encargado de Almacén recibe notificación, verifica OC aprobada (+ OT si aplica), entrega, registra salida con firma digital del receptor.
4. **Cierre:** automático al entregar. Inventario actualiza en tiempo real.

### Tipos de OC

**Tipo A — Consumo de inventario** (items ya en almacén):

| Monto | Autorizador | Condición |
|-------|-------------|-----------|
| Cualquier | Gerente de Mtto | Sin revisión de Administración. El inventario ya existe. Encargado de Almacén libera. |

**Tipo B — Compra externa** (adquisición a proveedor):

| Monto | Autorizador | Condición |
|-------|-------------|-----------|
| < $7,000 | Gerente Mtto → Administración | Administración confirma fondos/crédito → CxP |
| ≥ $7,000 | Gerente Mtto → Administración → GG | Administración confirma ANTES de escalar. 2 cotizaciones del Padrón. |

**OC en activo = vinculada a OT. OC reabastecimiento de consumibles = sin OT.**

### Suplencias de OC

- Sin Coordinador: Gerente de Mtto genera directamente.
- Sin Gerente de Mtto: Coordinador de mayor antigüedad escala a JUN/JP para Nivel 1. GG notificado.

---

## Administración de Almacén

- Código único y ubicación física para cada artículo.
- Conteo cíclico: 20% mensual. Inventario completo trimestral.
- Entradas con remisión o factura digital.
- Artículos >$2,000: fotografía en sistema.
- Registro de entradas <2h.

### Sanciones del Encargado de Almacén

| Falta | Sanción |
|-------|---------|
| Entrega sin OC | **100% del costo (empresa NO reconoce)** |
| Entrega sin OC (reincidencia) | 100% + baja inmediata |
| No registrar <2h | 20% bono mensual |
| Faltante sin justificación | 100% del faltante |
| 2 faltantes en un trimestre | Baja inmediata |

---

## Inventario Obsoleto

| Criterio | Acción |
|----------|--------|
| 12 meses sin movimiento | Marcar "lento", revisión trimestral |
| 24 meses sin movimiento | Clasificar "obsoleto" |
| Descontinuado | Marcar, evaluar sustituto |
| Dañado/vencido | Baja con evidencia foto |

**Baja:** Encargado de Almacén reporta → JP o JUN evalúa (transferir, vender, donar, disponer) → Gerente de Mtto valida baja técnica → GG autoriza si >$5,000 → baja en sistema.

Obsolescencia natural (>24 meses): sin responsabilidad. Daño por mal almacenamiento: 50% del costo.

---

## Inventario en Garantía

Registro obligatorio: fecha compra, proveedor, factura, periodo de garantía, fecha de instalación, equipo.

**Flujo:**
1. Falla → reportar en plataforma.
2. Coordinador/Gerente de Mtto valida garantía.
3. Retirar pieza, guardar con etiqueta.
4. Administración gestiona con proveedor.
5. Reemplazo con OC de garantía.
6. Sistema actualiza historial.

| Falta | Sanción |
|-------|---------|
| Pérdida de pieza en garantía | 100% del costo |
| No documentar instalación | Pierde garantía, paga reemplazo |
| Instalación incorrecta que anula garantía | 50% del costo |

---

## Movimientos de Activos

**Control operativo: Gerente de Mtto supervisa, Coordinador ejecuta. GG recibe notificación informativa de todos los movimientos.**

### Tipos

1. Físico entre plantas
2. Asignación de personal a equipo
3. Reasignación de operador
4. Transferencia temporal (con fecha retorno)

### Proceso: movimiento físico

**1. Checklist de salida** (Coordinador planta origen, supervisado por Gerente de Mtto)
- Estado del activo en plataforma
- Evidencia foto
- Firma digital

**⚠ INCIDENCIA DE SISTEMA** — Si no se genera checklist de salida antes del movimiento, incidencia contra Coordinador origen + Gerente de Mtto.

**2. Traslado** (Coordinador origen)
- Coordina logística, ejecuta traslado
- **Sin autorización previa adicional** — responde a necesidades operativas

**3. Checklist de recepción** (Coordinador planta destino)
- Compara vs. salida
- Evidencia foto
- Firmas de ambos Coordinadores

**Control automático:**
- ✅ Coinciden → exitoso
- ⚠️ No coinciden → incidencia (daño en origen, traslado, o error de registro)

### Registro en sistema: planta del activo y operadores (MantenPro)

Cuando el activo **cambia de planta en la plataforma**, la **planta del perfil del operador** debe mantenerse alineada con el equipo que opera; si no, el operador puede perder visibilidad (RLS) o quedar incoherente con inventario y checklists.

**Rutas en aplicación (referencia técnica):**

| Acción | ¿Actualiza operadores al mover planta del activo? |
|--------|---------------------------------------------------|
| Gestión → **Asignación de plantas** (drag-and-drop o diálogo “Mover activo”) | Sí: el sistema detecta conflictos y ofrece **transferir operadores** (misma unidad de negocio), **desasignar**, o **mantener** (solo si es intencional; riesgo de acceso). |
| **Flota** → edición masiva “Mover a planta…” | Alineado con la misma lógica: si el activo tiene operadores asignados y hace falta decisión explícita (p. ej. distinta unidad de negocio), el sistema **bloquea** y pide usar Asignación de plantas o desasignar antes. |
| Cambio de planta del **operador** (RRHH / registro de personal) con activos en otras plantas | Flujo distinto: resuelve conflictos sobre **activos** ligados al operador. |

**Criterio operativo:**

- Misma unidad de negocio: preferir **transferir operadores** con el movimiento del activo.
- Distinta unidad de negocio: **desasignar** operadores del activo en sistema y completar reasignación de personal según RRHH/JP/JUN; no depender de “mantener” salvo caso excepcional documentado.
- Tras cualquier movimiento físico, verificar en sistema que planta del activo, asignaciones `asset_operators` y planta del operador coinciden con la realidad operativa.

### Proceso: asignación de personal

Responsable: JP o JUN, con notificación a Gerente de Mtto y RRHH. Registrar <24h.

- Asignación: equipo, operador, número empleado, fecha, turno.
- Cambio: razón, fecha efectiva, saliente/entrante, evidencia entrega-recepción.
- Baja: motivo, fecha, estado equipo.
- Equipo sin operador: 48h máximo en "Inactividad".

### Notificaciones a GG

1. Checklist de salida generado
2. Activo >$100,000 cambia de operador
3. Activo fuera de servicio >7 días
4. Activo sin operador >48h
5. >3 cambios de operador en 1 mes

### Sanciones de activos

| Infracción | Responsable | Sanción |
|------------|-------------|---------|
| No checklist de salida | Coordinador origen + Gerente Mtto | 30% bono |
| No checklist de recepción | Coordinador destino | 30% bono |
| Daño en traslado (documentado) | Coordinador que trasladó | Hasta 30% reparación |
| Daño no documentado en salida, aparece en recepción | Coordinador origen | 50% reparación |
| Discrepancia sin justificación | Ambos Coordinadores | Investigación + 20% bono |
| No registrar asignación operador <24h | JP / JUN | 10% bono |
| Operador sin asignar operando | JP | 50% costo si hay incidente |
| Préstamo no devuelto a tiempo | Coordinador destino | Reporte a Gerente Mtto + GG |

---

## Suplencias

| Falta | Quién suple |
|-------|-------------|
| JUN | JP asume autorizaciones y supervisión |
| JP | JUN asume responsabilidades de inventario y activos |
| JUN + JP | Gerente de Mtto escala todo a GG |
| Gerente de Mtto | Coordinador de mayor antigüedad; escala a JUN/JP. GG notificado. |
| Coordinador | Gerente de Mtto asume funciones operativas |
| Encargado de Almacén | JP asume custodia temporal (con restricción de OC). Designar sustituto <48h. |

---

## Auditorías

| Frecuencia | Qué | Quién |
|------------|-----|-------|
| Mensual | Conteo cíclico 20% | Encargado Almacén + JP o Gerente Mtto |
| Trimestral | Inventario completo | Equipo externo o de otra planta |
| Anual | Auditoría externa | Contador certificado |

| Variación | Acción |
|-----------|--------|
| ±2% | Tolerancia, ajuste contable |
| 2%–5% | Investigación interna → JP, JUN, Gerente Mtto |
| >5% | Auditoría extraordinaria + investigación + reporte a GG |

---

## KPIs Mensuales

| KPI | Meta |
|-----|------|
| Exactitud inventario | ≥98% |
| Días de inventario | 30–60 |
| Salidas sin OC | 0% |
| OC con OT (consumo activos) | 100% |
| Activos con operador asignado | 100% |
| Registro de asignación | <24h |
| Movimientos con checklists completos | 100% |
| Utilización de activos | ≥85% |
| Devolución de préstamos | 100% |

---

## Implementación

**Mes 1:** Encargados de Almacén por planta. Inventario físico. Capacitación. Vincular OC con OT. Alta de usuarios (POL-OPE-001 §3.2.1).

**Mes 2:** Auditoría de cumplimiento. Ajustes. v2.1 si necesario.

---

## Vigencia

Inmediata tras firma. Versiones anteriores de POL-OPE-002 sin efecto. Revisión trimestral de KPIs, semestral de política, anual con auditoría externa.

---

*DC Concretos — "Ayudando a concretar ideas"*
