# Chat de Compras

Prototipo de marketplace móvil-first para **repuestos y servicios automotrices**, con chat comprador–comercio simulado en tiempo real (5 minutos por conversación), flujo de ofertas, envío, cierre y calificación.

> Estado: **MVP/prototipo sin backend**. Toda la lógica de negocio es simulada con datos mock. Ver [DOCUMENTACION_TECNICA.md](./DOCUMENTACION_TECNICA.md) para el detalle completo.

## Stack

- React 18 + React Router 6 + Vite 5
- Tailwind CSS 3 + glassmorphism
- Lucide React + Framer Motion
- Capacitor 8 (Android e iOS)

## Inicio rápido

```bash
npm install
npm run dev
```

Build de producción:

```bash
npm run build
npm run preview
```

Calidad de código:

```bash
npm run lint
```

Móvil (Capacitor):

```bash
npm run cap:sync
npm run cap:open:android   # o cap:open:ios
```

> El `appId` nativo se mantiene como `com.chatexpress.app` por compatibilidad con los proyectos Android/iOS existentes. El nombre visible de la app es **Chat de Compras**.

## Roles

| Rol | Entrada | Navegación principal |
|---|---|---|
| Usuario | `/` → Categorías | `/chat-list`, `/history`, `/profile-user` |
| Comercio | `/dashboard` | `/sales-history`, `/niche-config`, `/profile` |

La sesión se simula y se persiste en `localStorage` desde `src/context/AuthContext.jsx`. Tras cerrar sesión, la app redirige a `/login` y no vuelve a iniciar la demo automáticamente.

Usuarios de prueba:

| Rol | Credenciales |
|---|---|
| Usuario | Cualquier correo sin `shop` (por defecto `Julia`) |
| Comercio | Cualquier correo que contenga `shop` |

## Flujo principal

1. Categorías → Solicitud automotriz (`/request`)
2. Ofertas recibidas (`/responses`)
3. Chat (`/chat/:id`) → datos de envío → confirmación de llegada
4. Calificación (`/closing/:id`) → historial
5. Seguimiento de pedidos (`/orders`) y notificaciones (`/notifications`)

## Contenido

- Repuestos y vehículos coherentes: pastillas de freno (Corolla), batería 12V (Civic), filtro de aceite, amortiguadores (Hilux), llantas.
- Ilustraciones SVG locales en `src/assets/` (`repuesto-frenos.svg`, `repuesto-bateria.svg`, `repuesto-filtro.svg`, `repuesto-amortiguador.svg`, `repuesto-llanta.svg`).
- Portada y avatares también locales (`hero-automotriz.svg`, `avatar-comercio.svg`, `avatar-cliente-1…4.svg`) con placeholder de respaldo (`image-placeholder.svg`).
- Favicon propio en `public/favicon.svg`.

## Estructura

```
src/
├── assets/       # Ilustraciones SVG (repuestos, avatares, portada y placeholder)
├── components/   # Button, Input, Logo, SafeImage, ErrorBoundary, navegación
├── context/      # AuthContext, ChatContext
├── pages/        # auth, user, commerce, common
├── App.jsx       # rutas y guardas por rol
├── main.jsx      # entry point
└── theme.config.js
public/
└── favicon.svg
```

## Documentación

- [Documentación técnica completa](./DOCUMENTACION_TECNICA.md): arquitectura, rutas, contextos, flujos, datos mock, deuda técnica y guías de extensión.

## Limitaciones conocidas

- Sin backend, autenticación real ni persistencia en servidor.
- Las conversaciones se guardan solo en el dispositivo (`localStorage`); no se sincronizan entre comprador y comercio en equipos distintos.
- Conviven dos sistemas de diseño (azul legacy y neón/glass).
- La accesibilidad básica está cubierta (zoom, foco, `aria-label`, teclado), pero falta auditar contraste WCAG.
- No hay tests automatizados ni sincronización verificada con Capacitor en dispositivo.

Consulta la sección 13 de la documentación técnica para el listado completo.
