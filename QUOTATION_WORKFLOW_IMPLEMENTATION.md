# Sistema de Cotizaciones Multi-Proveedor - Implementación Completa

## Resumen Ejecutivo

Sistema completo de gestión de cotizaciones multi-proveedor con flujo de aprobación y notificaciones por email integrado.

---

## Flujo de Trabajo Completo

### 1. Creación de Purchase Order (PO)
**Status Inicial:** `draft`

- Usuario crea PO con múltiples cotizaciones
- PO se guarda en `purchase_orders` con `status = 'draft'`
- Cotizaciones se guardan en `purchase_order_quotations` con `status = 'pending'`

### 2. Notificación de Selección (Solo si >1 cotización)

**Trigger:** Cuando se crea la **2da cotización**

**Email enviado a:** Solicitante del PO (requested_by)

**Contenido del email:**
- Tabla comparativa de cotizaciones
- Indicador de mejor precio (💰)
- Indicador de entrega más rápida (⚡)
- Botón: "Revisar y Seleccionar Cotización"

**Edge Function:** `quotation-selection-notification`

### 3. Auto-selección (Solo si 1 cotización)

**Trigger:** Cuando se crea la **1ra y única cotización**

**Acciones automáticas:**
1. Cotización marcada como `selected`
2. Razón: "Auto-seleccionada (única cotización)"
3. PO actualizado con proveedor/monto de cotización
4. **PO avanza a `pending_approval`**
5. Se dispara email de aprobación automáticamente

### 4. Selección Manual (>1 cotización)

**Usuario selecciona cotización ganadora desde UI**

**Acciones:**
1. Cotización seleccionada → `status = 'selected'`
2. Otras cotizaciones → `status = 'rejected'`
3. PO actualizado con:
   - `supplier` = proveedor seleccionado
   - `total_amount` = monto cotizado
   - `selected_quotation_id` = ID de cotización
   - `items` = items de cotización (con precios)
4. **PO avanza a `pending_approval`**
5. Se dispara email de aprobación

### 5. Email de Aprobación

**Trigger:** Cuando PO cambia a `pending_approval`

**Email enviado a:** 
- Business Unit Manager (1ra aprobación)
- Gerencia General (si monto > $5,000 después de BU aprobación)

**Contenido del email:**
- Tabla de comparación de cotizaciones
- Cotización seleccionada marcada con ✓
- Razón de selección
- Botones de acción (Aprobar/Rechazar/Ver)

**Edge Function:** `purchase-order-approval-notification`

### 6. Aprobación

**Usuario aprueba desde email o sistema**

**Validaciones:**
- ✅ Cotización debe estar seleccionada (`status = 'selected'`)
- ✅ Usuario debe tener límite de autorización suficiente
- ✅ Status debe ser válido para transición

**Resultado:**
- PO → `status = 'approved'`
- Se puede proceder con compra y subir comprobante

---

## Componentes Técnicos

### Funciones de Base de Datos

#### 1. `requires_quotation(po_type, amount, po_purpose)`
```sql
-- Retorna TRUE si requiere cotización:
-- - DIRECT_PURCHASE >= $5,000
-- - DIRECT_SERVICE >= $5,000
-- - SPECIAL_ORDER: siempre
-- - Excepto si po_purpose = 'work_order_inventory'
```

#### 2. `has_quotations(purchase_order_id)`
```sql
-- Verifica si hay cotizaciones:
-- 1. Tabla purchase_order_quotations (nuevo)
-- 2. quotation_url (legacy)
-- 3. quotation_urls (legacy array)
```

#### 3. `select_quotation(quotation_id, user_id, reason)`
```sql
-- Acciones:
-- 1. Marca cotización como 'selected'
-- 2. Rechaza otras cotizaciones
-- 3. Actualiza PO con proveedor/items/monto
-- 4. Avanza PO a 'pending_approval' → dispara email aprobación
```

#### 4. `auto_select_single_quotation()`
```sql
-- Trigger en INSERT de quotation
-- Si es la única cotización:
--   - Auto-selecciona
--   - Avanza PO a 'pending_approval'
--   - Dispara email de aprobación
```

#### 5. `validate_po_status()`
```sql
-- Trigger en UPDATE de purchase_orders
-- pending_approval: requiere >= 1 cotización (cualquier status)
-- approved: requiere 1 cotización con status = 'selected'
```

### Triggers

#### 1. `trigger_auto_select_single_quotation`
- **Tabla:** `purchase_order_quotations`
- **Evento:** AFTER INSERT
- **Función:** `auto_select_single_quotation()`

#### 2. `trigger_notify_quotation_selection`
- **Tabla:** `purchase_order_quotations`
- **Evento:** AFTER INSERT
- **Función:** `notify_quotation_selection_required()`
- **Condición:** Solo cuando hay exactamente 2 cotizaciones

#### 3. `trigger_validate_po_status`
- **Tabla:** `purchase_orders`
- **Evento:** BEFORE UPDATE
- **Función:** `validate_po_status()`

#### 4. `trg_notify_po_pending_approval`
- **Tabla:** `purchase_orders`
- **Evento:** AFTER INSERT OR UPDATE
- **Función:** `notify_po_pending_approval()`
- **Condición:** Status cambia a 'pending_approval'

### Edge Functions

#### 1. `quotation-selection-notification`
**Propósito:** Notificar al solicitante que debe seleccionar entre múltiples cotizaciones

**Input:** `{ po_id: uuid }`

**Condición:** Solo si hay >= 2 cotizaciones

**Destinatario:** Solicitante del PO (requested_by)

**Subject:** `🔍 Seleccionar Cotización: OC {order_id} ({N} proveedores)`

#### 2. `purchase-order-approval-notification`
**Propósito:** Solicitar aprobación de PO con cotización seleccionada

**Input:** `{ po_id: uuid }`

**Destinatarios:** 
- BU Manager (1ra aprobación)
- GM (si monto > $5k después de BU)

**Subject:** `💵 Aprobación OC {order_id}`

---

## Configuración

### App Settings (tabla `app_settings`)
```sql
edge_po_notify_url = https://txapndpstzcspgxlybll.supabase.co/functions/v1/purchase-order-approval-notification
edge_quotation_selection_url = https://txapndpstzcspgxlybll.supabase.co/functions/v1/quotation-selection-notification
edge_bearer = {JWT token}
```

### Environment Variables (Edge Functions)
```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SENDGRID_API_KEY
FRONTEND_URL
SENDGRID_FROM
```

---

## Componentes Frontend

### Formularios de Creación
- `DirectPurchaseForm.tsx` - Crea PO en `draft` con cotizaciones
- `DirectServiceForm.tsx` - Crea PO en `draft` con cotizaciones
- `SpecialOrderForm.tsx` - Crea PO en `draft` (siempre requiere cotizaciones)

### Visualización y Selección
- `QuotationComparisonManager.tsx` - Vista principal de comparación
- `QuotationComparisonTable.tsx` - Vista de tabla
- `QuotationComparisonCard.tsx` - Vista de tarjetas
- `QuotationSelectionDialog.tsx` - Dialog de confirmación de selección

### Workflow
- `WorkflowStatusDisplay.tsx` - Valida cotización antes de permitir aprobar
- `ReceiptDisplaySection.tsx` - Solo visible después de aprobación

---

## Matriz de Estados

| Status | Requiere Cotización | Cotización Seleccionada | Email Enviado | Puede Aprobar |
|--------|-------------------|------------------------|---------------|---------------|
| draft | Si `requires_quote = true` | No | No | No |
| draft | Si | 1 cotización | Auto-selección → pending_approval | - |
| draft | Si | >1 cotizaciones | Email "Seleccionar" | No |
| pending_approval | Si | Si | Email "Aprobar" | Si (con auth) |
| approved | - | - | - | - |

---

## Migraciones Aplicadas

1. `update_direct_purchase_requires_quotation.sql`
2. `update_validate_po_status_trigger.sql`
3. `fix_validate_po_status_trigger_timing.sql`
4. `require_selected_quotation_before_approval.sql`
5. `refine_quotation_validation_by_status.sql`
6. `update_has_quotations_check_new_table.sql`
7. `update_select_quotation_advance_to_pending_approval.sql`
8. `auto_select_single_quotation.sql`
9. `trigger_quotation_selection_notification.sql`

---

## Casos de Uso

### Caso 1: PO con 1 Cotización
```
1. Usuario crea PO con 1 cotización
2. Sistema auto-selecciona cotización
3. PO → pending_approval
4. Email de aprobación enviado a BU Manager
5. BU Manager aprueba desde email
6. PO → approved
```

### Caso 2: PO con Múltiples Cotizaciones
```
1. Usuario crea PO con cotización A
2. PO → draft (sin emails)
3. Usuario agrega cotización B
4. Email enviado a solicitante: "Seleccionar Cotización"
5. Solicitante compara y selecciona cotización A
6. PO → pending_approval
7. Email de aprobación enviado a BU Manager
8. BU Manager aprueba desde email
9. PO → approved
```

### Caso 3: PO que no Requiere Cotización (<$5k)
```
1. Usuario crea PO de $3,000
2. requires_quote = false
3. PO → pending_approval
4. Email de aprobación enviado inmediatamente
5. BU Manager aprueba
6. PO → approved
```

---

## Validaciones Implementadas

### En Creación
- ✅ Threshold correcto ($5,000 para DIRECT_PURCHASE y DIRECT_SERVICE)
- ✅ Excepciones para `work_order_inventory`
- ✅ Items opcionales si hay cotizaciones

### En Selección
- ✅ Solo una cotización puede estar `selected`
- ✅ Otras se marcan como `rejected` automáticamente
- ✅ PO se actualiza con datos de cotización seleccionada
- ✅ Status avanza a `pending_approval`

### En Aprobación
- ✅ No puede aprobar si `requires_quote = true` y no hay cotización seleccionada
- ✅ Límite de autorización del usuario
- ✅ Transiciones de status válidas

---

## Próximos Pasos (Opcional)

1. **Dashboard de Cotizaciones:** Vista agregada de todas las cotizaciones pending
2. **Historial de Selección:** Log de por qué se seleccionó/rechazó cada cotización
3. **Métricas:** Análisis de proveedores (precios promedio, tiempos de entrega)
4. **Negociación:** Permitir contra-ofertas antes de seleccionar
5. **Aprobación Multi-nivel:** Lógica más compleja para montos muy altos

---

## Pruebas Realizadas

✅ Crear PO con 1 cotización → Auto-selección → Email aprobación  
✅ Crear PO con 2 cotizaciones → Email selección  
✅ Seleccionar cotización → PO avanza → Email aprobación  
✅ Aprobar sin cotización seleccionada → Bloqueado  
✅ Aprobar con cotización seleccionada → Exitoso  
✅ UI deshabilita botón aprobar hasta que haya cotización seleccionada  
✅ ReceiptDisplaySection solo visible después de aprobación  

---

## Archivos Modificados

### Backend
- `/lib/services/purchase-order-service.ts` - Status inicial `draft`
- `/lib/services/quotation-service.ts` - Query simplificado
- `/app/api/purchase-orders/quotations/route.ts` - GET usa servidor directo
- `/app/api/purchase-orders/quotations/[id]/select/route.ts` - POST usa RPC directo
- `/app/api/purchase-orders/[id]/receipts/route.ts` - Await params

### Frontend
- `/components/purchase-orders/creation/DirectPurchaseForm.tsx` - Cotizaciones siempre visibles
- `/components/purchase-orders/workflow/WorkflowStatusDisplay.tsx` - Valida cotización
- `/components/purchase-orders/quotations/QuotationComparisonCard.tsx` - Layout corregido
- `/components/purchase-orders/quotations/QuotationSelectionDialog.tsx` - Comparación precios
- `/components/purchase-orders/quotations/QuotationComparisonManager.tsx` - Event system
- `/app/compras/[id]/page.tsx` - ReceiptDisplaySection condicional

### Edge Functions
- `/supabase/functions/quotation-selection-notification/index.ts` - NUEVO
- `/supabase/functions/purchase-order-approval-notification/index.ts` - Existente (ya incluye cotizaciones)

### Migraciones
- 9 nuevas migraciones en `/migrations/sql/`

---

## Configuración Requerida

### Supabase App Settings
```sql
INSERT INTO app_settings (key, value) VALUES
  ('edge_quotation_selection_url', 'https://txapndpstzcspgxlybll.supabase.co/functions/v1/quotation-selection-notification'),
  ('edge_po_notify_url', 'https://txapndpstzcspgxlybll.supabase.co/functions/v1/purchase-order-approval-notification');
```

### Edge Function Secrets
```bash
supabase secrets set \
  SUPABASE_URL="https://txapndpstzcspgxlybll.supabase.co" \
  SENDGRID_API_KEY="..." \
  FRONTEND_URL="https://your-domain.com"
```

---

## Estado Actual del Sistema

✅ **Implementación Completa**  
✅ **Edge Functions Desplegados**  
✅ **Triggers Configurados**  
✅ **UI Actualizada**  
✅ **Validaciones Activas**  

**Sistema listo para producción.**
