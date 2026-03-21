# Inventario, órdenes de trabajo y órdenes de compra — fuente de verdad

Este documento describe **cómo está implementado hoy** el flujo: orden de trabajo (OT) → orden de compra (OC) tipificada → aprobaciones (app y correo) → movimientos de inventario. Está pensado para **operación** y para **ingeniería**; las referencias a código y SQL permiten contrastar cualquier duda.

**Matriz de roles (quién hace qué en plataforma):** ver [docs/POL_OPE_ROLES_PLATFORM_MATRIX.md](POL_OPE_ROLES_PLATFORM_MATRIX.md) (resumen alineado a POL-OPE-001/002 v2.0).

**Alcance:** OC con `po_type` definido (“tipificadas”), que es el flujo principal. Al final hay una nota breve sobre OC legadas.

**Umbral GM:** 7.000 MXN (`GM_ESCALATION_THRESHOLD_MXN` en código; mismo valor replicado en SQL `process_po_email_action`).

---

## 1. Glosario (sin ambigüedad)


| Término                                    | Significado en este sistema                                                                                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `**po_purpose`**                           | Propósito de negocio de la OC: `work_order_inventory`, `work_order_cash`, `inventory_restock`, `mixed`. Determina la **política de aprobación** (vías A–D).                                             |
| `**po_type`**                              | Tipología de proceso: `direct_purchase`, `direct_service`, `special_order`, etc. Determina la **máquina de estados** (pasos `purchased`, `quoted`, …) cuando no aplica el atajo `work_order_inventory`. |
| `**work_order_type`**                      | `preventive` / `corrective` (también acepta `preventivo` / `correctivo` en normalización). Entra en la política junto con `po_purpose`.                                                                 |
| `**authorized_by` + `authorization_date**` | “Primera firma”: validación técnica / autorización inicial. La OC puede **seguir en** `pending_approval` después de esto (escalamiento a GM o espera de viabilidad).                                    |
| `**approved_by` + `approval_date`**        | Aprobación **final** que en base de datos acompaña al estado `**approved`** (función `advance_purchase_order_workflow` los fija al pasar a `approved`).                                                 |
| `**viability_state**`                      | Viabilidad administrativa; valores relevantes: pendiente implícito / `pending`, `viable`, `not_viable`. Rutas C y D exigen viabilidad antes del cierre según política.                                  |
| `**pending_approval**`                     | Estado operativo “en cola de aprobación”; puede representar etapa técnica, administrativa o final según qué campos ya estén llenos.                                                                     |
| **Movimiento `issue`**                     | Salida de inventario (cantidad negativa en el servicio de movimientos).                                                                                                                                 |
| **Movimiento `receipt`**                   | Entrada a inventario.                                                                                                                                                                                   |


---

## 2. Enlace OT ↔ OC en base de datos

1. **Enlace canónico (uno a muchos):** `purchase_orders.work_order_id` → `work_orders.id`. Las OC creadas desde una OT deben llevar este campo.
2. **Puntero opcional “OC principal” en la OT:** `work_orders.purchase_order_id`. Algunas pantallas y el flujo legado lo actualizan; la OT puede listar **todas** las OC con `work_order_id` aunque el puntero principal sea otro.
3. **Creación tipificada:** `POST /api/purchase-orders/create-typed` → `PurchaseOrderService.createTypedPurchaseOrder` (`lib/services/purchase-order-service.ts`).
4. **Creación legada:** formulario / RPC `generate_purchase_order` (p. ej. `components/work-orders/purchase-order-form.tsx`) puede además fijar `work_orders.purchase_order_id`.

**Regla práctica:** Para análisis y reportes, usar `**purchase_orders.work_order_id`** como verdad para “OC de esta OT”.

---

## 3. Política de workflow (vías A–D)

**Fuente en aplicación:** `lib/purchase-orders/workflow-policy.ts` — `resolveWorkflowPath()`, `resolveCurrentStage()`, `canActorApproveAtStage()`, `canActorRecordViabilityAtStage()`.

**Paridad en correo:** La función SQL `process_po_email_action` replica la misma lógica de umbrales y flags (`v_skip_gm`, `v_requires_viability`, `v_needs_gm_escalation`) para que aprobar desde enlace no contradiga la app. Si se cambia la política, hay que **actualizar ambos** y revisar el Edge Function de correo (umbrales de “requiere GM” para el *asunto* de destinatarios).

### 3.1 Tabla de vías


| Vía   | Condición                                                    | Viabilidad administrativa | GM si monto ≥ 7.000 MXN                                                                                    |
| ----- | ------------------------------------------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **A** | `po_purpose = work_order_inventory` y tipo OT **preventivo** | No                        | No                                                                                                         |
| **B** | `po_purpose = work_order_inventory` y tipo OT **correctivo** | No                        | Sí                                                                                                         |
| **C** | `po_purpose = inventory_restock`                             | Sí                        | Sí si monto ≥ umbral                                                                                       |
| **D** | `po_purpose = work_order_cash` o `mixed`                     | Sí                        | Correctivo: sí si ≥ umbral; preventivo: política marca `skipGM` (GM no requerido por umbral en preventivo) |


**Monto usado para política:** En app (`advance-workflow`) y en el correo se usa `approval_amount` si es > 0; si no, `total_amount`.

### 3.2 Etapas lógicas (`resolveCurrentStage`)

1. `**technical`** — `authorized_by` vacío: falta validación técnica (Gerente de Mantenimiento o GM con alcance).
2. `**viability**` — `authorized_by` lleno, la política exige viabilidad y `viability_state` no es `viable`.
3. `**final**` — Listo para aprobación final (GM escalado, o Administración con límite, o GM sin escalamiento según política).

---

## 4. Máquina de estados (`status`) por propósito y tipo

**Reglas en Postgres:** `get_valid_next_statuses(current_status, po_type, po_purpose)` — migración de referencia `migrations/sql/20260129_update_status_workflow_for_inventory.sql`.

### 4.1 `po_purpose = work_order_inventory` (uso de inventario para OT)

Flujo corto **sin compra**:

`draft` → `pending_approval` → `approved` → `**fulfilled`** → `validated` (y `rejected` donde aplica).

- Después de `**approved**`, el siguiente paso lógico de negocio es `**fulfilled**`, no `purchased`.
- `**fulfilled**` corresponde a “almacén surtió / liberó” vía proceso de cumplimiento (ver §6).
- `**validated**` cierra el ciclo administrativo de la OC de inventario.

### 4.2 `direct_purchase` / `direct_service` (y propósitos no inventario puro)

`draft` → `pending_approval` → `approved` → `purchased` → `receipt_uploaded` → `validated`.

### 4.3 `special_order`

Incluye `quoted`, `ordered`, `received` entre `approved` y comprobantes; detalle exacto en la misma función SQL.

### 4.4 Avance técnico en BD

`advance_purchase_order_workflow(p_purchase_order_id, p_new_status, p_user_id, p_notes)`:

- Valida transición con `get_valid_next_statuses`.
- Si `p_new_status = approved`: escribe `approved_by`, `approval_date`.
- Si `purchased`: `purchased_at`.
- Si `fulfilled`: `fulfilled_at`.

La **autorización previa** (`authorized_by`) la gestiona principalmente la **capa HTTP** y/o RPC de correo, no siempre este RPC.

---

## 5. Aprobación en la aplicación (HTTP)

**Ruta:** `PUT /api/purchase-orders/advance-workflow/[id]` — `app/api/purchase-orders/advance-workflow/[id]/route.ts`.

### 5.1 Cuando `new_status === 'approved'`

1. **Cotizaciones:** Si hay ≥ 2 cotizaciones y no hay `selected_quotation_id`, exige `quotation_id` en el body y llama RPC `select_quotation` antes de seguir.
2. **Resolución de planta / unidad de negocio:** Desde `plant_id` de la OC o, vía OT, `asset` → `plant` → `business_unit_id` para `checkScopeOverBusinessUnit`.
3. **Primera aprobación (`authorized_by` vacío):**
  - Debe ser **Gerente de Mantenimiento** (con alcance) o **Gerencia General** (con alcance); GM puede saltarse restricciones de etapa.
  - Si la política exige escalamiento GM (**vía B correctivo ≥ 7k**, u otras rutas con `requiresGMIfAboveThreshold` y monto ≥ umbral) y el actor **no** es GM: solo actualiza `authorized_by`, `authorization_date`, mantiene `pending_approval`, responde éxito con mensaje de escalamiento y llama `**notifyNextApprover(id)`** (correo al siguiente actor).
  - Si la política **exige viabilidad** (C/D) y el actor **no** es GM: igual: registra `authorized_by`, deja `pending_approval`, `**notifyNextApprover(id)`**.
  - Si no hay viabilidad requerida ni escalamiento (p. ej. vía A, o B bajo umbral): marca `recordAuthorizationAfterWorkflow` y después del RPC de avance también escribe `authorized_by` si aplica.
4. **Segunda / final aprobación (`authorized_by` lleno):**
  - No puede ser la misma persona que `authorized_by` **salvo GM** (regla de separación de funciones).
  - Si escalamiento GM: solo GM.
  - Si no hay escalamiento: GM o **Área Administrativa** con límite y monto dentro del límite.
  - Si política exige viabilidad y el actor es GM: exige `viability_state` viable antes de aprobar.

### 5.2 Cuando `new_status === 'validated'` (registrar viabilidad)

Usado como acción de workflow para **viabilidad administrativa** en rutas con `requiresViability`:

- Solo **Área Administrativa** o **GM**.
- Si **no** hace falta GM después de viabilidad (preventivo cash/mixed, o monto bajo según política): en una sola actualización pone `viability_state = viable`, `viability_checked_by`, y `**status = approved`** con `approved_by` / `approval_date`; llama `**notifyReadyToPay(id)**`.
- Si **sí** hace falta GM después (correctivo ≥ 7k): solo guarda viabilidad; llama `**notifyNextApprover(id)`** para que GM reciba correo.

### 5.3 Después de aprobar (`approved`)

Tras un avance exitoso con `new_status === 'approved'`, la ruta invoca `**notifyReadyToPay(id)**` (además, en BD puede existir trigger de “ready to pay”; ver §7.4 — posible doble canal).

---

## 6. Inventario: dónde y cuándo se mueve el stock

### 6.1 Salida ligada a OC (ruta esperada para `work_order_inventory`)

**API:** `POST /api/purchase-orders/[id]/fulfill-from-inventory`  
**Servicio:** `InventoryFulfillmentService.fulfillFromInventory` (`lib/services/inventory-fulfillment-service.ts`).

- Crea movimientos tipo `**issue`** con referencia a la OC.
- Comprueba disponible = `current_quantity - reserved_quantity` por parte y almacén.
- Actualiza banderas de OC (p. ej. `inventory_fulfilled`, `fulfillment_source` — ver columnas en BD).
- **No sustituye** el cambio de `status` a `fulfilled`: operación y workflow deben alinearse en UI/proceso (primero aprobación, luego surtido, luego validación según pantalla).

### 6.2 Entrada por compra recibida

**API:** `POST /api/purchase-orders/[id]/receive-to-inventory`  
**Servicio:** `InventoryReceiptService` (`lib/services/inventory-receipt-service.ts`).

- Crea movimientos `**receipt`**; exige estados de OC permitidos por esa ruta (compras reales, no el atajo solo-inventario).

### 6.3 Salida ad-hoc por OT (sin OC en el movimiento)

**API:** `POST /api/work-orders/[id]/issue-adhoc-parts`  
Referencia típica `reference_type: work_order`, no `purchase_order`.

### 6.4 Reservas

Rutas de reserva / actualización de partes en OT (`reserve-parts`, `update-parts`) ajustan reservados; son **anteriores o paralelos** al flujo de OC y no sustituyen `fulfill-from-inventory` cuando la política exige OC.

---

## 7. Correo electrónico y tokens (aprobación desde email)

Hay **dos mecanismos** que invocan el mismo Edge Function `purchase-order-approval-notification`:

1. **Trigger en Postgres** tras ciertos cambios en `purchase_orders` (cola `pg_net` → URL en `app_settings.edge_po_notify_url`).
2. **Llamada explícita desde Next.js** `notifyNextApprover(poId)` (`lib/purchase-orders/notify-approver.ts`) tras actualizaciones de workflow que no siempre disparan el trigger, o para reforzar el envío.

Ambos envían `POST` con cuerpo `{ "po_id": "<uuid>" }` al Edge Function (el trigger usa también header `Authorization: Bearer <edge_bearer>` desde `app_settings`).

### 7.1 Trigger `trg_notify_po_pending_approval`

**Definición en producción (Supabase mantenimiento):** `AFTER INSERT OR UPDATE OF status, authorized_by, viability_state` — ver [supabase-purchase-order-database-summary.md](./supabase-purchase-order-database-summary.md). El repo puede mostrar una definición distinta en `migrations/sql/20250730_po_email_actions_trigger.sql` si esa migración no se reaplicó con la columna extra.

**Condiciones en las que `notify_po_pending_approval()` encola el HTTP POST (cuerpo de función en BD):**


| Evento | Condición                                                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| INSERT | `new.status = 'pending_approval'`                                                                                                                |
| UPDATE | `authorized_by` pasa de NULL a NOT NULL, `status = 'pending_approval'` (ya **no** exige monto > 5000; eso corrigió viabilidad para montos bajos) |
| UPDATE | `viability_state` pasa a `viable`, con `authorized_by` NOT NULL y `status = 'pending_approval'`                                                  |
| UPDATE | `status` cambia **a** `pending_approval`                                                                                                         |


**Configuración obligatoria:** `app_settings.edge_po_notify_url` y `edge_bearer`. Si falta la URL, la función **lanza excepción** (fallo duro al insertar/actualizar la fila).

**Auditoría:** Inserciones en `notifications` con tipos `PURCHASE_ORDER_APPROVAL_ENQUEUE` / `PURCHASE_ORDER_APPROVAL_ERROR`.

#### 7.1.1 Trigger `trg_notify_po_pending_approval` y `viability_state`

En la base **Supabase mantenimiento** (`txapndpstzcspgxlybll`), el trigger está definido como  
`AFTER INSERT OR UPDATE OF status, authorized_by, viability_state` — así, un `UPDATE` que **solo** pasa `viability_state` a `viable` **sí dispara** el trigger y puede encolar el correo al siguiente aprobador cuando la función evalúa la rama correspondiente.

En el **repositorio**, el archivo `migrations/sql/20250730_po_email_actions_trigger.sql` aún muestra solo `status, authorized_by`; si otro entorno se creó solo desde esas migraciones, podría faltar `viability_state` en la definición del trigger. Contrastar con [supabase-purchase-order-database-summary.md](./supabase-purchase-order-database-summary.md) (metadatos vivos) o con `pg_get_triggerdef` en cada entorno.

### 7.2 Edge Function `purchase-order-approval-notification`

**Código:** `supabase/functions/purchase-order-approval-notification/index.ts`.

**Entrada:** JSON con `po_id` (o `record.id` en flujos antiguos). Modo prueba: `test_recipient`, `test_send_both`.

**Cálculo de monto y política (resumen):** Mismo umbral 7.000 y reglas de `skipGM` / `requiresViability` alineadas conceptualmente con `workflow-policy.ts` (inventory preventive skip GM, cash/mixed preventive skip GM por umbral, etc.).

**Resolución de destinatarios (orden):**

1. Si `**authorized_by` vacío (etapa técnica):**
  - Busca perfiles activos con rol / `business_role` **GERENTE_MANTENIMIENTO** (alcance global en la consulta actual).
  - Si **no** hay gerente de mantenimiento con email: destinatarios = **todos los GM** activos (`role = GERENCIA_GENERAL`, email en `profiles` o fallback `auth.admin.listUsers` paginado).
2. Si **requiere viabilidad** (`inventory_restock`, `work_order_cash`, `mixed`) y `viability_state !== 'viable'`: destinatarios = **Administración**:
  - Si existe `app_settings.po_admin_approval_email`: solo ese correo (perfil activo con ese email).
  - Si no: todos **AREA_ADMINISTRATIVA** activos con email.
  - Si no hay admin: fallback a GM si `requiresGMEscalation`, si no, lista vacía.
3. Si hace falta **escalamiento GM** (monto ≥ umbral y no `skipGM`): destinatarios = GM.
4. Si nada de lo anterior: **sin destinatarios** (respuesta JSON `No recipients`).

**Cotizaciones múltiples (≥ 2 en estado pending/selected):**

- Genera **un JWT por cotización** para acción `approve` (y uno para `reject`), guardados en `po_action_tokens` con `quotation_id`.
- Enlaces usan `**/api/purchase-order-actions/direct-action`** con `po`, `action`, `email`, `quotation` opcional.
- La plantilla HTML distingue “selección estilo BU” vs “confirmar / cambiar selección estilo GM” según variante de prueba o escalamiento.

**Tokens:**

- Generación HS256 en el Edge Function con `JWT_SECRET` = `SUPABASE_JWT_SECRET` o fallback service role.
- Inserción en `po_action_tokens`: `recipient_email`, `recipient_user_id` opcional, `action`, `jwt_token`, `expires_at` (~24 h), `quotation_id` si aplica.
- Evita duplicados: si ya hay token vigible mismo `purchase_order_id` + `recipient_email`, **no** reenvía (salvo modo test).

**Envío:** SendGrid; `click_tracking` y `open_tracking` desactivados para no romper URLs firmadas.

### 7.3 Resolución del clic: `direct-action` → `process`

1. `**GET /api/purchase-order-actions/direct-action`** (`app/api/purchase-order-actions/direct-action/route.ts`): Lee `po`, `action`, `email`, `quotation`; llama RPC `**get_po_action_token**` (`migrations/sql/20260211_add_po_action_tokens_quotation_and_user.sql`) para obtener el JWT almacenado; redirige a:
2. `**GET /api/purchase-order-actions/process?token=...**` (`app/api/purchase-order-actions/process/route.ts`): Llama RPC `**process_po_email_action(p_token)**`; redirige a `/compras/accion-po?action=...&po=...`.

**Tabla `po_action_tokens`:** RLS “deny all” a clientes; uso vía **SECURITY DEFINER** RPCs y service role en Edge Function.

### 7.4 RPC `process_po_email_action` (lógica por rol)

**Fuente:** `migrations/sql/20260318_fix_po_email_action_viability.sql` (versión actual en migraciones del repo).

**Validaciones comunes:**

- Token válido y no expirado.
- Actor = `recipient_user_id` o perfil por `recipient_email`.
- Idempotencia: si `status` ya `approved` o `rejected`, retorna éxito idempotente.
- Solo procesa si `status` está en conjunto compatible (`pending_approval`, `quoted`, variantes legacy `Pendiente`, etc.).

**Si `action = approve` y token trae `quotation_id`:** ejecuta `select_quotation` primero.

**Política interna (espejo de vías A–D):** mismos casos que §3.1 con `approval_amount` / `total_amount`.

**Por rol:**


| Rol                                                                                     | Efecto                                                                                                                                                |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AREA_ADMINISTRATIVA**                                                                 | Solo `**viability_state = viable`**, `viability_checked_by`. No aprueba la OC. Retorno `status: viability_recorded`. Si ya era viable, idempotente.   |
| **GERENCIA_GENERAL**                                                                    | **Siempre** pasa la OC a `approved` con `approved_by` / `approval_date` (vía atajo GM).                                                               |
| **GERENTE_MANTENIMIENTO** (u otro actor técnico en primer slot) si `authorized_by` NULL | Si escalamiento GM: solo llena `authorized_by`, deja `pending_approval`. Si requiere viabilidad: igual. Si no: `approved` completo con `approved_by`. |
| Cualquier otro con `authorized_by` ya lleno y no GM                                     | Error: requiere otro rol.                                                                                                                             |


Tras éxito, **borra tokens** del mismo `purchase_order_id` + `recipient_email` para evitar reuso.

### 7.5 Página de resultado

`**/compras/accion-po`** (`app/compras/accion-po/page.tsx`): Muestra mensajes para `approved`, `rejected`, `viability_recorded`, `error` (con `reason`).

### 7.6 Notificación “lista para pagar / comprar”

**Desde app:** `notifyReadyToPay(poId)` → Edge Function `po-ready-to-pay-notification` (`lib/purchase-orders/notify-approver.ts`).

**Desde BD (repo):** Trigger `notify_po_ready_to_pay` en transición **a** `status = 'approved'` — `migrations/sql/20260319_po_ready_to_pay_notification.sql` (cola HTTP a `edge_po_ready_to_pay_url`).

Puede haber **doble notificación** (app + trigger) en el mismo evento; ambas van dirigidas a operación administrativa.

### 7.7 Otro correo: selección de cotización

En **Supabase mantenimiento**, `trigger_notify_quotation_selection` llama a `**notify_quotation_selection_required()`** y, al llegar a **2** cotizaciones, hace POST a `edge_quotation_selection_url` (Edge Function `**quotation-selection-notification`**). También existe `**trigger_auto_select_single_quotation**` para la única cotización. Detalle y definiciones vivas: [supabase-purchase-order-database-summary.md](./supabase-purchase-order-database-summary.md).

### 7.8 Notificación in-app por cambio de `status`

Función `notify_purchase_order_update` (solo base de datos): notifica al `requested_by` en tabla `notifications` para transiciones como `pending_approval` / `approved` / `rejected`. **No envía email** por sí sola.

---

## 8. Mapa rápido de archivos


| Tema                         | Ubicación                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------- |
| Política A–D y etapas        | `lib/purchase-orders/workflow-policy.ts`                                      |
| Aprobación HTTP + viabilidad | `app/api/purchase-orders/advance-workflow/[id]/route.ts`                      |
| Llamadas a Edge desde app    | `lib/purchase-orders/notify-approver.ts`                                      |
| Procesar clic de correo      | `app/api/purchase-order-actions/direct-action/route.ts`, `process/route.ts`   |
| Edge aprobación OC           | `supabase/functions/purchase-order-approval-notification/index.ts`            |
| Transiciones de estado SQL   | `migrations/sql/20260129_update_status_workflow_for_inventory.sql`            |
| Trigger cola aprobación      | `migrations/sql/20260318_fix_po_admin_email_trigger.sql`                      |
| RPC email                    | `migrations/sql/20260318_fix_po_email_action_viability.sql`                   |
| Surtido inventario           | `lib/services/inventory-fulfillment-service.ts`, API `fulfill-from-inventory` |
| Recepción inventario         | `lib/services/inventory-receipt-service.ts`, API `receive-to-inventory`       |
| UI workflow tipificada       | `components/purchase-orders/workflow/WorkflowStatusDisplay.tsx`               |
| Resumen triggers/columnas    | `docs/supabase-purchase-order-database-summary.md`                            |
| Orquestador creación OC      | `components/purchase-orders/creation/EnhancedPurchaseOrderCreationForm.tsx`     |
| Selector tipo + copy política | `components/purchase-orders/creation/PurchaseOrderTypeSelector.tsx`            |
| Revisión pre-envío (modal)   | `components/purchase-orders/creation/PurchaseOrderCreationReviewDialog.tsx`   |
| Textos aprobación (creación) | `lib/purchase-orders/creation-workflow-copy.ts` → `workflow-policy.ts`        |
| Validación intención vs líneas | `lib/purchase-orders/wo-line-intent-validation.ts`                           |


### 8.1 Puntos de entrada a la creación tipificada

| Entrada | URL / flujo | ¿Omite el encuadre (tipo / origen)? |
| ------- | ----------- | ------------------------------------- |
| Módulo Compras (hub, drawer, móvil) | `/compras/crear-tipificada` | **No**: paso **Tipo** con confirmación explícita (**Continuar**). |
| Orden de trabajo → generar OC | `app/ordenes/[id]/generar-oc/page.tsx` redirige a `?workOrderId=&workOrderType=` | **No**: si el tipo es compra directa o pedido especial, aparece paso **Origen** (surtido almacén / combinado / compra). |
| Panel sugerencia de proveedor (OT) | `?workOrderId=&type=direct_service&prefillSupplier=` | **No**: el `type` en query solo **preselecciona** la tarjeta; el usuario debe **Continuar**; opción **Quitar tipo del enlace**. |
| Coordinador (legado) | `/compras/crear` | Flujo distinto; no es el orquestador tipificado de esta sección. |

**Parámetros de query admitidos en `/compras/crear-tipificada`:** `workOrderId`, `workOrderType`, `type` (también se acepta `initialType` por compatibilidad con enlaces antiguos), `prefillSupplier`.

### 8.2 UX ↔ `po_purpose` y `fulfill_from` (resumen)

La verdad de negocio al guardar sigue en `buildPurchaseOrderRoutingContext` (`lib/purchase-orders/routing-context.ts`). La UI orienta así:

| Elección en el asistente (con OT) | Efecto en partidas | `po_purpose` típico (no sustituye al código) |
| --------------------------------- | ------------------ | -------------------------------------------- |
| **Surtir todo desde almacén** (paso Origen) | Precarga `fulfill_from = inventory` donde aplica | Si todas las líneas quedan en inventario → `work_order_inventory` |
| **Todo por compra** | Precarga compra / proveedor | `work_order_cash` (directa / servicio) o lógica de pedido especial en `resolvePoPurpose` |
| **Combinado (almacén + proveedor)** | Mezcla por línea | `mixed` si hay al menos una línea inventario y una compra |
| **Servicio directo** con OT | El formulario de servicio **no** usa `fulfill_from` en partidas | **No** se muestra paso Origen; `po_purpose` lo resuelve el contexto de enrutado (p. ej. `work_order_cash` para gasto de servicio) |

Antes de crear, el usuario confirma en un **modal de revisión** con resumen de montos, conteo de líneas (inventario / compra) y **textos orientativos** de aprobación generados desde `resolveWorkflowPath` (`creation-workflow-copy.ts`), alineados con las vías A–D.

---

## 9. Flujos narrativos (operación)

### 9.1 OC inventario + OT preventiva (vía A)

1. Crear OC tipificada con `po_purpose = work_order_inventory`, OT preventiva.
2. Enviar a `pending_approval` según cotización/reglas.
3. Gerente de Mantenimiento (o GM si aplica) aprueba en app o por correo → `approved` (con `approved_by`; y `authorized_by` según ruta HTTP).
4. Almacén: `**fulfill-from-inventory`** y avanzar estado a `**fulfilled**` cuando corresponda.
5. Cierre: `**validated**`.

### 9.2 OC inventario + OT correctiva ≥ 7k (vía B)

1. Igual creación.
2. Primera aprobación técnica registra `authorized_by`, permanece `pending_approval` → correo a **GM**.
3. GM aprueba → `approved`.
4. Surtido → `fulfilled` → `validated`.

### 9.3 Reabastecimiento (vía C) o compra efectiva (vía D)

1. Tras aprobación técnica (`authorized_by`), correo a **Administración** para viabilidad (si aplica).
2. En **app**: acción `validated` en `advance-workflow` registra viabilidad; si hace falta GM, `notifyNextApprover`; si no, aprueba en el mismo paso.
3. En **correo (Admin)**: solo marca viabilidad; luego GM debe aprobar (en producción el trigger suele encolar el siguiente correo — ver §7.1.1 y el resumen de BD).
4. Sigue flujo de `**purchased` / comprobantes** o el que corresponda al `po_type`.

---

## 10. OC legadas (`po_type` NULL)

Pantallas pueden mostrar `LegacyActionCard` con rutas `/compras/[id]/pedido`, `/recibido`, enlaces de aprobar/rechazar. En el árbol actual **no** existen páginas `app/compras/[id]/aprobar` o `rechazar` (salvo **gastos adicionales**). Tratar enlaces legacy como **posiblemente rotos** o dependientes de rutas externas. Prioridad operativa: **migrar a OC tipificadas**.

---

## 11. Checklist al cambiar reglas de negocio

1. `lib/purchase-orders/workflow-policy.ts`
2. `app/api/purchase-orders/advance-workflow/[id]/route.ts` (autorización, viabilidad, GM)
3. `process_po_email_action` en SQL (paridad con política)
4. Edge Function `purchase-order-approval-notification` (destinatarios y `skipGM` / `requiresViability`)
5. Trigger `notify_po_pending_approval` (si nuevas columnas deben disparar correo)
6. `get_valid_next_statuses` / `advance_purchase_order_workflow` si cambian estados
7. Pruebas manuales: app + un clic de correo por rol (GM, Admin, Mantenimiento)
8. Actualizar **este documento**

---

## 12. Versión

- Generado a partir del código y migraciones en el repositorio `maintenance-dashboard`.
- Producción Supabase puede diferir si no se aplicaron todas las migraciones; contrastar con `migrations/sql/` desplegadas.

