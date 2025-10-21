# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e5]:
    - generic [ref=e6]:
      - heading "Iniciar Sesión" [level=1] [ref=e7]
      - paragraph [ref=e8]: Ingrese sus credenciales para acceder al sistema
    - generic [ref=e9]:
      - generic [ref=e10]:
        - heading "Iniciar Sesión" [level=3] [ref=e11]
        - paragraph [ref=e12]: Ingrese sus credenciales para acceder al sistema
      - generic [ref=e14]:
        - generic [ref=e15]:
          - text: Correo electrónico *
          - textbox "Correo electrónico *" [ref=e16]:
            - /placeholder: correo@ejemplo.com
        - generic [ref=e17]:
          - text: Contraseña *
          - generic [ref=e18]:
            - textbox "••••••••" [ref=e19]
            - button [ref=e20] [cursor=pointer]:
              - img [ref=e21]
        - link "¿Olvidó su contraseña?" [ref=e25] [cursor=pointer]:
          - /url: /forgot-password
        - button "Iniciar Sesión" [ref=e26] [cursor=pointer]
      - paragraph [ref=e28]: ¿Necesita una cuenta? Contacte al administrador.
  - region "Notifications (F8)":
    - list
  - alert [ref=e29]
  - button "Open Next.js Dev Tools" [ref=e35] [cursor=pointer]:
    - img [ref=e36]
```