# Guía de Importación de Gastos de Octubre

## Correcciones Realizadas

### 1. IMSS, RCV, Infonavit, 3% s/nom → Categoría 9: PERSONAL
- **Subcategoría**: "NOMINA - Obligaciones Patronales"
- **Razón**: Son obligaciones patronales que la empresa paga independiente del salario
- **Nota**: NO son parte de Nómina base, pero tampoco son gastos financieros

### 2. Comisiones Vales Despensa → Categoría 9: PERSONAL
- **Subcategoría**: "Atención al Personal (Comidas, Almuerzo)"
- **Razón**: Es un beneficio al personal, no un gasto financiero

## Tipos de Asignación

### DIRECTO (92 gastos)
Gastos asignados directamente a una planta específica.
- **Plantas**: 1, 2, 3, 4, 5
- **Acción**: Crear entrada con `plantId` = planta específica
- **Sin distribución requerida**

**Ejemplo**:
```
Urea Costo Vtas P4 → Planta 4, $360.9
Categoría: 1. OPERACIÓN DE PLANTA
Subcategoría: Materiales de Producción
```

### DISTRIBUIR_VOLUMEN (20 gastos)
Gastos a nivel empresa ("gen") que deben distribuirse por volumen entre TODAS las plantas.
- **Identificador**: "gen"
- **Acción**: Crear entrada con:
  - `businessUnitId` = null (o toda la empresa)
  - `plantId` = null
  - `distributionMethod` = "volume"
  - El sistema distribuirá automáticamente según volumen de concreto de cada planta

**Ejemplos**:
```
Imss Admon P1 → $27,184.23
Dominio Correo P1 → $4,680
Licencias de Sistemas P1 → $13,156.14
Telefonia e Internet P1 → $13,787.46
Auditoria P1 → $60,000
```

### DISTRIBUIR_BU (63 gastos)
Gastos a nivel de Unidad de Negocio que deben distribuirse por volumen entre plantas de esa BU.
- **Identificadores**: 
  - "tj" = Tijuana Business Unit
  - "bj" o "BJ" = Baja California Business Unit
- **Acción**: Crear entrada con:
  - `businessUnitId` = ID de la unidad de negocio correspondiente
  - `plantId` = null
  - `distributionMethod` = "volume"
  - El sistema distribuirá automáticamente según volumen de concreto de plantas en esa BU

**Ejemplos Tijuana (tj)**:
```
Imss Admon P2 → $9,633 (Tijuana BU)
Gastos Admon P2 → $316,433.38 (Tijuana BU)
```

**Ejemplos Baja California (bj/BJ)**:
```
MANO DE OBRA LABORATORIO → $6,450 (Baja California BU)
ABONO A DUEÑAS → $20,000 (Baja California BU)
```

## Mapeo de Unidades de Negocio

Necesitas identificar los IDs de las Business Units:
- **Tijuana (tj)** → Buscar en `business_units` tabla
- **Baja California (bj)** → Buscar en `business_units` tabla

## Proceso de Importación

### Para DIRECTO:
```typescript
{
  plantId: "uuid-planta-X",
  month: "2024-10",
  category: "otros_indirectos",
  expenseCategory: "1", // ID de categoría 1-14
  expenseSubcategory: "Materiales de Producción...",
  department: "PRODUCCION",
  description: "Urea Costo Vtas P4",
  amount: 360.9,
  distributionMethod: null,
  distributions: []
}
```

### Para DISTRIBUIR_VOLUMEN:
```typescript
{
  businessUnitId: null, // O ID de empresa completa
  plantId: null,
  month: "2024-10",
  category: "otros_indirectos",
  expenseCategory: "9",
  expenseSubcategory: "NOMINA - Obligaciones Patronales",
  department: "ADMINISTRACION",
  description: "Imss Admon P1",
  amount: 27184.23,
  distributionMethod: "volume",
  distributions: [] // Sistema calcula automáticamente
}
```

### Para DISTRIBUIR_BU:
```typescript
{
  businessUnitId: "uuid-tijuana-bu",
  plantId: null,
  month: "2024-10",
  category: "otros_indirectos",
  expenseCategory: "9",
  expenseSubcategory: "NOMINA - Obligaciones Patronales",
  department: "ADMINISTRACION",
  description: "Imss Admon P2",
  amount: 9633,
  distributionMethod: "volume",
  distributions: [] // Sistema calcula automáticamente basado en plantas de la BU
}
```

## Resumen de Gastos

| Tipo | Cantidad | Monto Total |
|------|----------|-------------|
| DIRECTO | 92 gastos | ~$2,087,000 |
| DISTRIBUIR_VOLUMEN | 20 gastos | ~$378,000 |
| DISTRIBUIR_BU (tj) | 27 gastos | ~$681,000 |
| DISTRIBUIR_BU (bj/BJ) | 16 gastos | ~$145,000 |
| **TOTAL** | **175 gastos** | **~$4,291,000** |

## Nueva Subcategoría Creada

**Categoría 9. PERSONAL**
- Subcategoría nueva: **"NOMINA - Obligaciones Patronales"**
  - Incluye: IMSS, RCV, Infonavit, 3% s/nom, Premios, Comisiones
  - Razón: Son obligaciones patronales que la empresa paga independiente del salario base

## Validaciones Importantes

1. ✅ Verificar que las categorías 1-14 existen en el sistema
2. ✅ Agregar subcategoría "NOMINA - Obligaciones Patronales" a categoría 9
3. ✅ Identificar correctamente los IDs de Business Units (tj, bj)
4. ✅ Verificar que el mes "2024-10" es correcto (octubre 2024 o octubre 2025?)
5. ✅ El sistema calculará automáticamente las distribuciones basadas en volumen de concreto del mes

## Notas Especiales

- **Gastos negativos** (devoluciones): Se mantienen con valor negativo
- **Departamentos**: Se mantienen tal como están en el CSV
- **Categoría vs Subcategoría**: La categoría es el número 1-14, la subcategoría es el texto descriptivo


