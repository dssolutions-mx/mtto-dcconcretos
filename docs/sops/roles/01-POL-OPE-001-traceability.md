# POL-OPE-001 v2.0 — traceability extract

**Source:** [../policies/POL-OPE-001_v2.0_SOP.md](../policies/POL-OPE-001_v2.0_SOP.md)  
**Purpose:** Stable IDs for cross-links from [INDEX.md](./INDEX.md), [06-html-matrix-to-code-matrix.md](./06-html-matrix-to-code-matrix.md), and [role-sop-index.yaml](./role-sop-index.yaml).  
**Rule:** Wording below is aligned to the source file; do not treat this file as a legal substitute for the policy PDF/original if those exist.

---

## POL001-HEADER

- Title: POL-OPE-001 — Mantenimiento  
- Version line: **v2.0 · Marzo 2026 · DC Concretos, S.A. de C.V.**  
- Plataforma: https://dcmantenimiento.app/

---

## POL001-##-Estructura-del-Departamento

**SOP-ROLE mapping:** Each row maps to `SOP-ROLE-*` in [INDEX.md](./INDEX.md).

| Rol (policy) | Qué hace (verbatim summary from source table) |
|--------------|-----------------------------------------------|
| Gerente General | Aprueba OC correctivo ≥ $7,000 (tras viabilidad Administración). Cambios a esta política. Revisa KPIs mensuales. |
| Gerente de Mantenimiento | Dirige el depto. Autoriza TODAS las OC (Nivel 1). Programa preventivos. Incidencias + conciliación con RRHH. Padrón de proveedores con Administración. Reporta a GG. |
| Coordinador de Mantenimiento | Operativo por zona. Crea OT y OC. Supervisa mecánicos. Checklist semanal. Formaliza WhatsApp <2h. Reporta a Gerente de Mtto. |
| Mecánicos / Auxiliares | Ejecutan intervenciones. Evidencia foto antes/después. Sin OT aprobada no inician. |
| Jefe de Unidad de Negocio | Autoridad operativa/presupuestal de la unidad. Subsidiario de checklist/diésel si no hay JP. Alta de usuarios a RH. |
| Jefe de Planta | Supervisión operativa. Verifica checklist diario. Registra asignación operador–equipo. Alta de usuarios a RH. Puede no existir (ver suplencias). |
| Dosificadores / Operadores | Checklist antes de operar. Reportar fallas. Registrar diésel. Confirmar cierre de OT. |
| Administración | Viabilidad presupuestal/ crédito proveedor antes de pagar OC. CxP. Padrón con Gerente de Mtto. Comparte responsabilidad si paga OC sin cadena correcta. |
| RRHH | Alta de usuarios. Movimientos de personal. Conciliación de incidencias. |

---

## POL001-##-Suplencias

Intro: *Ausencia nunca justifica omisión del proceso.*

| Falta | Quién suple |
|-------|---------------|
| Jefe de Planta | JUN |
| JUN | Jefe de Planta |
| JUN + Jefe de Planta | Gerente de Mtto → directo a GG |
| Coordinador | Gerente de Mtto asume funciones operativas |
| Gerente de Mtto | Coordinador de mayor antigüedad escala a JUN/JP. GG notificado. |

**Cross-ref:** Compare to POL-OPE-002 `## Suplencias` in [00-sources-and-conventions.md](./00-sources-and-conventions.md).

---

## POL001-##-Alta-de-Usuarios-y-Asignación-Operador–Equipo

- Alta en plataforma: RRHH a solicitud de JUN o JP. Sin usuario activo = **incidencia de sistema** contra JP o JUN.  
- Cada equipo debe tener operador asignado en sistema. Cambios informados a RRHH y Gerente de Mtto.  
- Equipo sin operador = "Inactividad". Máximo 48h para justificar o reasignar.

**Note:** POL-OPE-002 cites “POL-OPE-001 §3.2.1” for onboarding; this repo’s markdown uses this `##` heading as the matching section.

---

## POL001-##-Preventivo

**SOP-FLOW-PREV** (summary):

- Todo equipo con código único y ficha técnica. Respetar matrices e intervalos. Revisión anual de matrices por Gerente de Mtto.  
- **Programación:** Coordinador agenda **antes** de llegar a 100h o 1,000 km del siguiente intervalo. Gerente de Mtto supervisa. Alerta de plataforma ≠ sustituto de acción.

**Flujo (numbered in source):**

1. Coordinador genera OT + OC vinculada (insumos, proveedor).  
2. Gerente de Mtto autoriza (Nivel 1).  
3. Administración revisa viabilidad → CxP.  
4. Mecánico ejecuta con evidencia foto.  
5. Coordinador cierra OT.

**POL001-PREV-OC-NO-GG:** *OC preventivas NO requieren GG.*

---

## POL001-##-Correctivo-—-Protocolo-PAT

**SOP-FLOW-INC** / **SOP-FLOW-OC** (overlapping).

**Orígenes:** Checklist, reporte directo, inspección, alerta de sistema.

**Omisión:** Si la incidencia no la registra el operador y tiene que intervenir el Coordinador = omisión en la línea de reporte → conciliación.

**Flujo (numbered in source):**

1. Incidencia registrada → sistema genera OT automáticamente.  
2. Coordinador revisa OT: cierra con justificación, o genera OC.  
3. Gerente de Mtto autoriza (Nivel 1).  
4. Administración revisa viabilidad.  
   - No viable → alternativa.  
   - Viable, < $7,000 → CxP.  
   - Viable, ≥ $7,000 → GG (requiere 2 cotizaciones del padrón).  
5. Mecánico ejecuta con evidencia foto.  
6. Coordinador cierra OT. Operador confirma.

**POL001-PAT-MONTOS** (table in source):

| Monto | Autorización |
|-------|-------------|
| < $7,000 | Gerente Mtto → Administración → CxP |
| ≥ $7,000 | Gerente Mtto → Administración → GG → CxP (2 cotizaciones) |

**Additional rule (paragraph in source):** OC en activo = vinculada a OT. OC reabastecimiento de inventario = sin OT.

---

## POL001-##-Diésel

**SOP-FLOW-DIE**

- Cada carga se registra con foto. Obligatorio: equipo, responsable, horómetro/odómetro, litros, proveedor, fecha, hora.  
- Quien carga lo registra. Si no disponible ni dosificador ni Coordinador, otro usuario registra (queda a conciliación).

**Sanciones (table in source):** see policy file (Dosificador 30%; JP 35%; JUN 35%; sin JP JUN 70%; sin JUN Gerente de Mtto reporta a GG).

---

## POL001-##-Checklists

### POL001-###-Diario

**SOP-FLOW-CHK-D**

- Dosificador/operador. **Completar antes de operar.** Sistema notifica al inicio.  
- Anomalía → registrar incidencia, notificar Coordinador o JP/JUN. No operar con falla crítica sin autorización del Coordinador. Si Coordinador no disponible, escala a JP/JUN (jerarquía flexible).  
- Sanciones table: no completar; no reportar falla; permitir operar sin checklist — see source.

### POL001-###-Semanal

**SOP-FLOW-CHK-W**

- Coordinador (cada lunes). Suplencia: Dosificador → JP → JUN. Registrar con evidencia si hay anomalías.  
- Sanciones table: 1 semana; 2 semanas; 4 semanas — see source.

---

## POL001-##-Servicios-Externos-y-Padrón-de-Proveedores

- Solo proveedores del Padrón (Administración + Gerente de Mtto). Emergencia fuera de padrón: autorización Gerente de Mtto + alta en 72h. Servicio supervisado por Coordinador con evidencia foto y reporte técnico.  
- Sanciones table: fuera de padrón; servicio sin supervisión — see source.

---

## POL001-##-Grupo-WhatsApp

**SOP-FLOW-WA**

- Fallas correctivas graves, falta de conectividad, coordinación urgente. **No sustituye registro en sistema.**  
- Todo se formaliza en plataforma en **<2h hábiles**. Omisión = **incidencia de sistema** contra Coordinador.  
- Miembros: Gerente de Mtto, Coordinadores, JPs, JUN, GG.

---

## POL001-##-Incidencias-de-Sistema

**SOP-FLOW-CON**

**Triggers (numbered in source):**

1. Operador inicia sin checklist.  
2. Diésel no registrado.  
3. Incidencia no reportada <2h hábiles.  
4. Equipo sin responsable asignado.  
5. WhatsApp no formalizado <2h.

### POL001-###-Conciliación-(RRHH)

1. Notificación en app a afectados.  
2. Cada parte presenta versión + evidencia.  
3. RRHH resuelve: sanción, levantamiento o causa raíz.  
4. Resolución en módulo de sanciones.

**Additional:** Discrepancias checklist vs. incidencias se revisan en conciliación. **Semana 1 tras firma:** tolerancia por causas técnicas. Después, sin excepción.

---

## POL001-##-Reembolsos

Solo si incidencia y gasto están en plataforma con OT y OC. **Sin registro = no se reconoce.**

---

## POL001-##-KPIs-Mensuales-(Gerente-de-Mtto)

- % checklists completados  
- % OT cerradas a tiempo  
- Diésel registrado vs. cargado  
- Incidencias de sistema activas  
- % preventivos en intervalo  

---

## POL001-##-Vigencia

- Inmediata tras firma. Semana 1: tolerancia. Versiones anteriores de POL-OPE-001 sin efecto.  
- Revisión semestral. Actualizaciones como nueva versión con aprobación GG.
