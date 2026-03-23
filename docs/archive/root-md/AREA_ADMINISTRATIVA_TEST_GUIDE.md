# 🧪 AREA_ADMINISTRATIVA - TESTING GUIDE

## 🎯 **Quick Testing Checklist**

Use this guide to verify that the **AREA_ADMINISTRATIVA** role is working correctly.

## 🔧 **Prerequisites**

1. **Database Setup**: Ensure you have a user in the profiles table with:
   ```sql
   role = 'AREA_ADMINISTRATIVA'
   can_authorize_up_to = 100000
   status = 'active'
   ```

2. **Login**: Log in with the AREA_ADMINISTRATIVA user account

## ✅ **Test Scenarios**

### **1. Dashboard Access**
- [ ] ✅ User should see **"Panel de Control - Área Administrativa"**
- [ ] ✅ Authorization limit shows **$100,000**
- [ ] ✅ Orange **"Panel Administrativo"** section visible
- [ ] ✅ Quick actions for Compras, Personal, Reportes

### **2. Module Access Matrix**

#### **✅ SHOULD HAVE ACCESS:**
- [ ] **Assets**: Badge shows "Solo Lectura" ✅
- [ ] **Maintenance**: Badge shows "Solo Lectura" ✅  
- [ ] **Work Orders**: Badge shows "Crear, Editar, Eliminar, Autorizar" ✅
- [ ] **Purchases**: Badge shows "Crear, Editar, Eliminar, Autorizar" ✅
- [ ] **Inventory**: Badge shows "Crear, Editar, Eliminar" ✅
- [ ] **Personnel**: Badge shows "Crear, Editar, Eliminar" ✅
- [ ] **Reports**: Badge shows "Crear, Editar, Eliminar" ✅

#### **❌ SHOULD NOT HAVE ACCESS:**
- [ ] **Checklists**: Badge shows "Sin Acceso" + blocked overlay ❌

### **3. Route Protection Tests**

#### **Accessible Routes:**
```bash
# These should work
/dashboard ✅
/activos ✅ (read-only)
/preventivo ✅ (read-only)
/ordenes ✅ (full access)
/compras ✅ (full access + auth)
/inventario ✅ (full access)
/gestion/personal ✅ (full access)
/reportes ✅ (admin level)
```

#### **Blocked Routes:**
```bash
# This should redirect to dashboard with error
/checklists ❌ → /dashboard?error=access_denied&module=checklists
```

### **4. UI Element Tests**

#### **In Purchase Orders Page:**
- [ ] ✅ "Crear Orden" button visible
- [ ] ✅ "Editar" buttons on existing orders
- [ ] ✅ "Autorizar" button for orders under $100,000
- [ ] ❌ "Autorizar" button disabled/hidden for orders over $100,000

#### **In Personnel Page:**
- [ ] ✅ "Crear Personal" button visible
- [ ] ✅ All CRUD operations available
- [ ] ✅ Can view all personnel (global scope)

#### **In Assets Page:**
- [ ] ❌ "Crear Activo" button hidden
- [ ] ❌ "Editar" buttons hidden
- [ ] ❌ "Eliminar" buttons hidden
- [ ] ✅ Can view all assets (read-only)

### **5. Authorization Limit Tests**

```tsx
// Test different amounts
canAuthorizeAmount(50000)   // ✅ Should return true
canAuthorizeAmount(100000)  // ✅ Should return true  
canAuthorizeAmount(150000)  // ❌ Should return false
```

### **6. Error Handling Tests**

#### **Checklist Access Attempt:**
1. Try to navigate to `/checklists`
2. ✅ Should redirect to `/dashboard`
3. ✅ Should show red alert: "Acceso denegado: Tu rol AREA_ADMINISTRATIVA no tiene permisos..."
4. ✅ Alert should auto-hide after 8 seconds

#### **Invalid Authorization:**
1. Try to authorize a $200,000 purchase order
2. ✅ Should show "Permisos Insuficientes" error
3. ✅ Should explain authorization limit exceeded

## 🧩 **Integration Tests**

### **With RLS Backend:**
- [ ] ✅ Can read assets from database
- [ ] ✅ Can create/edit personnel records
- [ ] ✅ Can create/edit purchase orders
- [ ] ❌ Cannot access checklist execution records

### **With API Endpoints:**
- [ ] ✅ `/api/purchase-orders` - Full access
- [ ] ✅ `/api/operators/register` - Can create personnel
- [ ] ❌ `/api/checklists/execution` - Should return 403

## 🎨 **Visual Verification**

### **Dashboard Appearance:**
- [ ] ✅ Orange administrative panel prominent
- [ ] ✅ Module cards show correct permission badges
- [ ] ✅ Checklist card has blocked overlay
- [ ] ✅ Authorization limit prominently displayed

### **Navigation:**
- [ ] ✅ Checklist menu items hidden/disabled
- [ ] ✅ Personnel menu visible and accessible
- [ ] ✅ Purchase menu shows authorization options

## 🚨 **Common Issues & Solutions**

### **Issue: User sees all modules**
**Solution**: Check profile.role in database, ensure it's exactly 'AREA_ADMINISTRATIVA'

### **Issue: Cannot authorize any purchases**
**Solution**: Check profile.can_authorize_up_to value in database

### **Issue: Can access checklists**
**Solution**: Verify middleware is running and profile.role is correct

### **Issue: No administrative panel**
**Solution**: Check AdminOnlyGuard component and ensure role is in allowed list

## 🔄 **Automation Script**

```javascript
// Browser console test script
const testAreaAdministrativa = () => {
  console.log('🧪 Testing AREA_ADMINISTRATIVA role...')
  
  // Check auth context
  const authContext = window.useAuth?.()
  if (!authContext?.profile) {
    console.error('❌ No profile found')
    return
  }
  
  const { profile, ui, canAuthorizeAmount, authorizationLimit } = authContext
  
  console.log('👤 Profile:', profile.role)
  console.log('💰 Authorization Limit:', authorizationLimit)
  
  // Test permissions
  const tests = [
    { module: 'assets', expected: true, write: false },
    { module: 'purchases', expected: true, write: true, auth: true },
    { module: 'personnel', expected: true, write: true },
    { module: 'checklists', expected: false },
  ]
  
  tests.forEach(test => {
    const hasAccess = ui.shouldShowInNavigation(test.module)
    const hasWrite = test.write ? ui.canShowEditButton(test.module) : null
    const hasAuth = test.auth ? ui.canShowAuthorizeButton(test.module) : null
    
    console.log(`${hasAccess === test.expected ? '✅' : '❌'} ${test.module}:`, 
      `Access=${hasAccess}`, 
      test.write ? `Write=${hasWrite}` : '',
      test.auth ? `Auth=${hasAuth}` : ''
    )
  })
  
  // Test authorization limits
  console.log('💰 Authorization Tests:')
  console.log('  $50,000:', canAuthorizeAmount(50000) ? '✅' : '❌')
  console.log('  $100,000:', canAuthorizeAmount(100000) ? '✅' : '❌') 
  console.log('  $150,000:', canAuthorizeAmount(150000) ? '❌' : '✅ (should be false)')
}

// Run test
testAreaAdministrativa()
```

## ✅ **Test Completion Checklist**

- [ ] Dashboard loads with correct role display
- [ ] All accessible modules work correctly
- [ ] Blocked modules properly protected
- [ ] Authorization limits enforced
- [ ] Error messages clear and helpful
- [ ] UI elements conditionally visible
- [ ] Route protection working in middleware
- [ ] Integration with backend RLS working

**🎉 When all tests pass, AREA_ADMINISTRATIVA role is fully functional!** 