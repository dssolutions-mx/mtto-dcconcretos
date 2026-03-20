# Configuración de Plantillas de Email en Supabase

## ¿Quién envía el correo de recuperación?

- **No** hay envío desde el servidor de esta aplicación (no existe ruta `/api/...` ni proveedor SMTP propio para reset).
- El flujo **«Olvidé mi contraseña»** en la app solo llama a `supabase.auth.resetPasswordForEmail()` desde el cliente ([`store/slices/auth-slice.ts`](store/slices/auth-slice.ts)).
- **Supabase Auth** es quien genera y envía el correo, usando la plantilla **Reset Password** y la configuración SMTP del proyecto en el dashboard de Supabase.

Si el correo no llega o el enlace falla, la causa está en **Supabase** (plantilla, URL de redirección, SMTP, límites, spam), no en un “mailer” interno de la app.

## 🚨 Importante: Configuración Requerida

Para que el sistema de recuperación de contraseña funcione correctamente, necesitas configurar las plantillas de email en tu proyecto de Supabase.

## 📧 Configuración de la Plantilla de Recuperación de Contraseña

### Paso 1: Acceder al Dashboard de Supabase

1. Ve a [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. En el menú lateral, navega a **Authentication** → **Email Templates**

### Paso 2: Configurar la Plantilla "Reset Password"

Selecciona la plantilla **"Reset Password"** y reemplaza el contenido con:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Restablecer Contraseña</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .container {
            background-color: #f4f4f4;
            padding: 30px;
            border-radius: 10px;
        }
        .button {
            display: inline-block;
            padding: 12px 30px;
            background-color: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
        }
        .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Restablecer tu Contraseña</h2>
        <p>Hola,</p>
        <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente botón para continuar:</p>
        
        <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery" class="button">
            Restablecer Contraseña
        </a>
        
        <p>O copia y pega este enlace en tu navegador:</p>
        <p style="word-break: break-all; font-size: 12px;">
            {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
        </p>
        
        <div class="footer">
            <p>Este enlace expirará en 1 hora por razones de seguridad.</p>
            <p>Si no solicitaste este cambio, puedes ignorar este email de forma segura.</p>
        </div>
    </div>
</body>
</html>
```

### Paso 3: Configurar URLs de Redirección

1. En el mismo dashboard, ve a **Authentication** → **URL Configuration**
2. En **Site URL**, asegúrate de que esté configurado tu dominio de producción (ej: `https://tu-dominio.com`)
3. En **Redirect URLs**, agrega las siguientes URLs:
   - `http://localhost:3000/**` (para desarrollo local)
   - `https://tu-dominio.com/**` (para producción)
   - Específicamente: `https://tu-dominio.com/auth/confirm`
   - Específicamente: `https://tu-dominio.com/auth/reset-password`

## 🔧 Configuración Alternativa (Sin Personalizar Plantilla)

Si prefieres no personalizar la plantilla de email, puedes usar el flujo predeterminado de Supabase actualizando el código:

### Opción 1: Usar el Flujo Hash en el Cliente

La app ya aplica `setSession` desde el fragmento `#access_token=...&refresh_token=...&type=recovery` cuando el usuario abre el enlace en `/auth/reset-password` (plantilla por defecto de Supabase). Si el correo lleva solo al **Site URL** raíz, configure la plantilla para apuntar a `/auth/reset-password` o use el flujo `token_hash` recomendado arriba.

Si necesita referencia histórica, el patrón era:

```typescript
useEffect(() => {
  // Verificar si hay un hash en la URL (flujo predeterminado de Supabase)
  if (window.location.hash) {
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const access_token = hashParams.get('access_token')
    const type = hashParams.get('type')
    
    if (access_token && type === 'recovery') {
      setIsValidToken(true)
      setCheckingToken(false)
    }
  }
}, [])
```

## 📝 Verificación

Para verificar que la configuración está funcionando:

1. Ve a la página de login de tu aplicación
2. Haz clic en "¿Olvidó su contraseña?"
3. Ingresa tu email
4. Revisa tu bandeja de entrada
5. El enlace en el email debe llevarte a `/auth/confirm` que luego te redirigirá a `/auth/reset-password`

## 🐛 Solución de Problemas

### El enlace redirige al login en lugar de reset password

**Causa**: La plantilla de email no está configurada correctamente o el redirect URL no está en la lista de permitidos.

**Solución**: 
1. Verifica que la plantilla use el formato correcto con `/auth/confirm`
2. Asegúrate de que las URLs estén en la lista de permitidos en Supabase

### Error "Token inválido o expirado"

**Causa**: El token ha expirado (después de 1 hora) o ya fue usado.

**Solución**: Solicita un nuevo enlace de recuperación.

### El email no llega

**Causa**: 
- Límite de rate limit alcanzado (3 emails por hora en el plan gratuito)
- Email en spam
- Configuración SMTP personalizada incorrecta

**Solución**:
1. Revisa la carpeta de spam
2. Espera una hora si alcanzaste el límite
3. Considera configurar un servidor SMTP personalizado para producción

## 🚀 Mejoras para Producción

1. **Configurar SMTP Personalizado**: Ve a **Project Settings** → **Auth** → **SMTP Settings** para usar tu propio servidor de email
2. **Personalizar el Diseño**: Adapta el HTML de la plantilla para que coincida con tu marca
3. **Agregar Logging**: Implementa logging en el endpoint `/auth/confirm` para monitorear problemas
4. **Rate Limiting**: Implementa rate limiting adicional en tu aplicación para prevenir abuso 