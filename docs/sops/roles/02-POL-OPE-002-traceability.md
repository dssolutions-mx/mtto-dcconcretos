# POL-OPE-002 v2.0 — traceability extract

**Source:** [../policies/POL-OPE-002_v2.0_SOP.md](../policies/POL-OPE-002_v2.0_SOP.md)  
**Purpose:** Stable IDs for cross-links from [INDEX.md](./INDEX.md), matrix traceability, and [role-sop-index.yaml](./role-sop-index.yaml).

---

## POL002-HEADER

- Title: POL-OPE-002 — Gestión de Inventario y Activos  
- Version line: **v2.0 · Marzo 2026 · DC Concretos, S.A. de C.V.**  
- Plataforma: https://dcmantenimiento.app/  
- Coordina con POL-OPE-001 — Mantenimiento genera OC y gestiona activos de producción.

---

## POL002-##-Alcance

- Plantas: León, Tijuana, Silao, Bajío y demás unidades activas.  
- **Inventario:** materiales, refacciones, consumibles.  
- **Activos:** equipos de producción, vehículos, maquinaria pesada, herramienta mayor (>$10,000). NO incluye repuestos/consumibles.

---

## POL002-##-Roles

| Rol | Responsabilidad clave (from source table) |
|-----|-------------------------------------------|
| Gerente General | Autoriza OC compra externa ≥ $7,000 (tras viabilidad Administración). Bajas de inventario alto valor. Venta/baja definitiva de activos. Notificación de movimientos de activos y personal. |
| Gerente de Mantenimiento | Autoriza TODAS las OC (Nivel 1). Supervisa movimientos de activos y checklists. Padrón con Administración. Notificado de activos sin operador y equipos fuera de servicio. |
| Coordinador de Mtto | Genera OC vinculadas a OT (si involucra activo). Ejecuta movimientos físicos de activos. Genera checklists salida/recepción. Solicita materiales por OC. |
| Jefe de Unidad de Negocio | Supervisa Encargado de Almacén. Revisa inventario mensual. Investiga diferencias. Subsidiario si no hay JP. |
| Jefe de Planta | Registra asignación personal a activos. Justifica activos sin operador >48h. Si falta Encargado de Almacén: asume custodia temporal. |
| Encargado de Almacén | Custodia física. Entrega SOLO con OC aprobada (+ OT si involucra activo). Registra movimientos <2h. Conteos cíclicos. **Asume 100% del costo si entrega sin OC.** |
| Dosificadores / Operadores | Reciben materiales autorizados. Firma digital en plataforma. |
| Administración | Viabilidad solo para OC de compra externa (Tipo B). Las OC de consumo de inventario (Tipo A) NO requieren esta revisión. Padrón con Gerente de Mtto. CxP. Reclamos de garantía. |
| RRHH | Notificado de todo movimiento de personal (asignaciones, reasignaciones, bajas). Procesa movimientos. Notifica a GG. Alta de usuarios con JUN/JP (POL-OPE-001 §3.2.1). |

---

## POL002-##-Órdenes-de-Compra

**SOP-FLOW-OC** (inventory emphasis).

**Regla (bold in source):** No OC aprobada = no se libera inventario. Las OC las genera SOLO el Coordinador o Gerente de Mantenimiento.

**Emergencias:** autorización verbal Gerente de Mtto + OC formal en plataforma <2h.

### POL002-###-Flujo (numbered)

1. **Creación:** Coordinador o Gerente de Mtto crea OC: código/descripción, cantidad, justificación (OT si involucra activo; reabastecimiento si es stock), fecha, centro de costo.  
2. **Autorización:** según tabla (ver abajo).  
3. **Liberación:** Encargado de Almacén recibe notificación, verifica OC aprobada (+ OT si aplica), entrega, registra salida con firma digital del receptor.  
4. **Cierre:** automático al entregar. Inventario actualiza en tiempo real.

### POL002-###-Tipos-de-OC

**Tipo A — Consumo de inventario:** table (Cualquier monto → Gerente de Mtto; sin Administración; Encargado libera).

**Tipo B — Compra externa:** table (< $7,000 and ≥ $7,000 paths; 2 cotizaciones; Administración confirma ANTES de escalar).

**Rule (bold in source):** OC en activo = vinculada a OT. OC reabastecimiento de consumibles = sin OT.

### POL002-###-Suplencias-de-OC

- Sin Coordinador: Gerente de Mtto genera directamente.  
- Sin Gerente de Mtto: Coordinador de mayor antigüedad escala a JUN/JP para Nivel 1. GG notificado.

---

## POL002-##-Administración-de-Almacén

- Código único y ubicación física para cada artículo.  
- Conteo cíclico: 20% mensual. Inventario completo trimestral.  
- Entradas con remisión o factura digital.  
- Artículos >$2,000: fotografía en sistema.  
- Registro de entradas <2h.  

### POL002-###-Sanciones-del-Encargado-de-Almacén

Table: entrega sin OC; reincidencia; no registrar <2h; faltante; 2 faltantes trimestre — see source.

---

## POL002-##-Inventario-Obsoleto

Criteria table: 12 meses; 24 meses; descontinuado; dañado/vencido — see source.

**Baja cadena:** Encargado de Almacén reporta → JP o JUN evalúa → Gerente de Mtto valida baja técnica → GG autoriza si >$5,000 → baja en sistema.

Obsolescencia natural (>24 meses): sin responsabilidad. Daño por mal almacenamiento: 50% del costo.

---

## POL002-##-Inventario-en-Garantía

Registro obligatorio fields and **Flujo** steps 1–6 — see source. Sanciones table — see source.

---

## POL002-##-Movimientos-de-Activos

**SOP-FLOW-AST-MOV** / **SOP-FLOW-AST-ASG**

**Control (bold in source):** Gerente de Mtto supervisa, Coordinador ejecuta. GG recibe notificación informativa de todos los movimientos.

### POL002-###-Tipos (numbered)

1. Físico entre plantas  
2. Asignación de personal a equipo  
3. Reasignación de operador  
4. Transferencia temporal (con fecha retorno)

### POL002-###-Proceso:-movimiento-físico

1. Checklist de salida (Coordinador origen, supervisado por GM) — estado, foto, firma. **INCIDENCIA DE SISTEMA** si no hay checklist antes del movimiento (Coordinador origen + Gerente de Mtto).  
2. Traslado (Coordinador origen) — sin autorización previa adicional.  
3. Checklist de recepción (Coordinador destino) — comparar, foto, firmas ambos coordinadores. **Control automático:** coinciden → exitoso; no coinciden → incidencia.

### POL002-###-Proceso:-asignación-de-personal

JP o JUN; notificación GM y RRHH; registrar <24h. Fields for asignación, cambio, baja; 48h máximo Inactividad — see source.

### POL002-###-Notificaciones-a-GG (numbered)

1. Checklist de salida generado  
2. Activo >$100,000 cambia de operador  
3. Activo fuera de servicio >7 días  
4. Activo sin operador >48h  
5. >3 cambios de operador en 1 mes  

### POL002-###-Sanciones-de-activos

Full table in source (checklists, traslado, asignación, préstamo, etc.).

---

## POL002-##-Suplencias

Full table — see [00-sources-and-conventions.md](./00-sources-and-conventions.md) for side-by-side with POL-001.

---

## POL002-##-Auditorías

Frequency table (mensual / trimestral / anual) and variación table (±2%, 2–5%, >5%) — see source.

---

## POL002-##-KPIs-Mensuales

Table with KPI and Meta columns — see source (Exactitud ≥98%, Salidas sin OC 0%, etc.).

---

## POL002-##-Implementación

**Mes 1:** Encargados de Almacén por planta. Inventario físico. Capacitación. Vincular OC con OT. Alta de usuarios (POL-OPE-001 §3.2.1).  
**Mes 2:** Auditoría de cumplimiento. Ajustes. v2.1 si necesario.

*This is a business rollout description; app completeness vs. Mes 1/2 is tracked in [07-gaps-drift-and-open-questions.md](./07-gaps-drift-and-open-questions.md) only when verified against code.*

---

## POL002-##-Vigencia

Inmediata tras firma. Versiones anteriores sin efecto. Revisión trimestral KPIs, semestral política, anual auditoría externa.
