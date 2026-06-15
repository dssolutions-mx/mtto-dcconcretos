# 🛡️ ROLE GUARD - SISTEMA DE PERMISOS

## 📋 MATRIZ DE ROLES Y MÓDULOS

| Rol | Activos | Mantenimiento | Órdenes Trabajo | Compras | Inventario | Personal | Checklists | Reportes | Config |
|-----|---------|---------------|-----------------|---------|------------|----------|------------|----------|--------|
| **GERENCIA_GENERAL** | ✅ Full | ✅ Full | ✅ Full + Auth | ✅ Full + Auth | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **JEFE_UNIDAD_NEGOCIO** | ✅ Read/Write | ✅ Full | ✅ Full + Auth | ✅ Read + Auth | ✅ Read/Write | ✅ Su Unidad | ✅ Full | ✅ Full | ❌ No |
| **AREA_ADMINISTRATIVA** | ✅ Read | ✅ Read | ✅ Full + Auth | ✅ Full + Auth | ✅ Full | ✅ Full | ❌ No | ✅ Admin | ✅ Básica |
| **ENCARGADO_MANTENIMIENTO** | ✅ Read/Write | ✅ Full | ✅ Full | ✅ Read/Write | ✅ Read/Write | ❌ No | ✅ Full | ✅ Mant | ❌ No |
| **JEFE_PLANTA** | ✅ Su Planta | ✅ Su Planta | ✅ Su Planta | ✅ Read | ✅ Su Planta | ✅ Su Planta | ✅ Su Planta | ✅ Su Planta | ❌ No |
| **AUXILIAR_COMPRAS** | ❌ No | ❌ No | ❌ No | ✅ Full | ✅ Full | ❌ No | ❌ No | ✅ Compras | ❌ No |
| **DOSIFICADOR** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Solo Ejecutar | ❌ No | ❌ No |
| **OPERADOR** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ✅ Solo Ejecutar | ❌ No | ❌ No |
| **VISUALIZADOR** | ✅ Read | ✅ Read | ✅ Read | ✅ Read | ✅ Read | ❌ No | ✅ Read | ✅ Read | ❌ No |

## 🔐 NIVELES DE ACCESO

### **✅ Full (Acceso Completo)**
- Create, Read, Update, Delete
- Todas las operaciones permitidas

### **✅ Read/Write (Lectura y Escritura)**
- Create, Read, Update
- No puede eliminar registros

### **✅ Read (Solo Lectura)**
- Solo puede visualizar información
- No puede modificar datos

### **✅ + Auth (Con Autorización)**
- Acceso completo + poder de autorización
- Puede aprobar/rechazar operaciones según límites

### **❌ No (Sin Acceso)**
- No puede acceder al módulo
- Oculto en navegación

## 🏢 CONTEXTO ORGANIZACIONAL

### **Alcance por Rol:**

#### **🌍 GLOBAL (Sin restricción)**
- `GERENCIA_GENERAL`
- `AREA_ADMINISTRATIVA` 
- `AUXILIAR_COMPRAS`
- `VISUALIZADOR`

#### **🏭 POR UNIDAD DE NEGOCIO**
- `JEFE_UNIDAD_NEGOCIO` → Solo su unidad de negocio

#### **🏗️ POR PLANTA**
- `JEFE_PLANTA` → Solo su planta
- `ENCARGADO_MANTENIMIENTO` → Solo su planta
- `DOSIFICADOR` → Solo su planta  
- `OPERADOR` → Solo su planta

## 💰 LÍMITES DE AUTORIZACIÓN

### **Autorización de Purchase Orders:**
```
GERENCIA_GENERAL: Sin límite
JEFE_UNIDAD_NEGOCIO: Hasta $500,000
AREA_ADMINISTRATIVA: Hasta $100,000  
JEFE_PLANTA: Hasta $50,000
Otros roles: Sin autorización
```

### **Flujo de Autorización:**
1. **Creación** → Cualquier rol con acceso a compras
2. **Revisión** → Jefe inmediato o Auxiliar de Compras
3. **Autorización** → Según límites monetarios
4. **Ejecución** → Auxiliar de Compras o Administración

## 📱 MÓDULOS ESPECÍFICOS

### **🔧 MANTENIMIENTO**
- **ENCARGADO_MANTENIMIENTO**: Gestión completa de mantenimiento + creación y gestión de órdenes de compra
- **JEFE_PLANTA**: Supervisión de mantenimiento en su planta
- **OPERADOR**: Solo ejecución de checklists asignados
- **DOSIFICADOR**: Solo ejecución de checklists asignados

### **🛒 COMPRAS E INVENTARIO** 
- **ENCARGADO_MANTENIMIENTO**: Creación y gestión de órdenes de compra relacionadas con mantenimiento
- **AUXILIAR_COMPRAS**: Acceso exclusivo a gestión de compras (cuando exista el rol)
- **AREA_ADMINISTRATIVA**: Autorización y supervisión
- **Otros roles**: Solo lectura según necesidades o sin acceso

### **👥 GESTIÓN DE PERSONAL**
- **GERENCIA_GENERAL**: Gestión completa
- **JEFE_UNIDAD_NEGOCIO**: Su unidad de negocio
- **AREA_ADMINISTRATIVA**: Gestión administrativa
- **JEFE_PLANTA**: Personal de su planta
- **ENCARGADO_MANTENIMIENTO**: Sin acceso (como solicitaste)

### **📋 CHECKLISTS**
- **OPERADOR**: Solo ejecutar checklists asignados
- **DOSIFICADOR**: Solo ejecutar checklists asignados
- **JEFE_PLANTA**: Supervisar checklists de su planta
- **ENCARGADO_MANTENIMIENTO**: Gestión completa de checklists

## 🚨 CASOS ESPECIALES

### **Estados de Emergency/Override:**
- Permitir acceso temporal elevado con justificación
- Log de accesos especiales
- Notificación a superiores

### **Delegación de Autoridad:**
- Jefes pueden delegar autorización temporalmente
- Límites de tiempo y monto para delegaciones
- Registro de delegaciones activas

### **Multi-Rol (Usuario con múltiples plantas/unidades):**
- Agregación de permisos por contexto
- Selector de contexto en interfaz
- Auditoría por contexto específico