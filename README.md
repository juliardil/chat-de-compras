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

## Administración (Fases 1, 2 y 3)

El panel administrativo es una entrada separada: `admin.html` (en desarrollo,
`http://localhost:5173/admin.html`). No cambia las rutas ni el diseño de la app
de comprador/comercio.

- Sin `VITE_INSFORGE_URL` y `VITE_INSFORGE_ANON_KEY`, arranca en **modo
  demostración** con datos de ejemplo en `localStorage`.
- Contraseña demo: `Demo1234!`. Cuentas: `superadmin@demo.local`,
  `admin@demo.local`, `comercios@demo.local`, `moderador@demo.local`,
  `soporte@demo.local`, `analista@demo.local`.
- Fase 1: autenticación, personal, permisos, auditoría, sesión y panel.
- Fase 2: compradores con PII enmascarada, verificación de comercios y
  documentos, y categorías de dos niveles. Incluye
  `#/compradores`, `#/comercios` y `#/categorias`.
- Fase 3: operación de solicitudes, ofertas, pedidos y entregas. Incluye
  `#/solicitudes`, `#/ofertas`, `#/pedidos` y `#/entregas`, con moderación,
  retirada administrativa, línea de tiempo de pedidos, disputas, seguimiento de
  entregas, incidencias y evidencias como metadatos.
- Con InsForge configurado usa autenticación real y permisos en servidor
  (RLS + funciones). Requiere aplicar las migraciones
  `migrations/20261106000000_admin_foundation.sql`,
  `migrations/20261106010000_people_catalog.sql` y
  `migrations/20261106020000_operations.sql`, además de dos buckets privados:
  documentos (`VITE_INSFORGE_DOCUMENTS_BUCKET`, por defecto
  `commerce-documents`) y evidencias de entrega
  (`VITE_INSFORGE_EVIDENCE_BUCKET`, por defecto `delivery-evidence`).

Documentación:

- [Fase 1 · Fundación administrativa](./docs/admin/FASE_1.md)
- [Fase 2 · Personas y catálogo](./docs/admin/FASE_2.md)
- [Fase 3 · Operación](./docs/admin/FASE_3.md)

Las tres fases están verificadas en modo demostración. El modo InsForge está
escrito pero **no probado contra un proyecto real** todavía.

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

## Pruebas

```bash
npm test        # Vitest + Testing Library
npm run lint    # ESLint
npm run build   # Build de producción
```

Cubren creación/envío/persistencia/cierre del chat, las guardas de ruta por rol
y la fundación administrativa (permisos, sesión, repositorio demo y reglas de
Fase 2 para compradores, comercios, documentos y categorías, y reglas de Fase 3
para solicitudes, ofertas, pedidos, entregas y evidencias).

## Limitaciones conocidas

- Sin backend, autenticación real ni persistencia en servidor.
- Las conversaciones se guardan solo en el dispositivo (`localStorage`); no se sincronizan entre comprador y comercio en equipos distintos.
- Conviven dos sistemas de diseño (azul legacy y neón/glass).
- Se corrigió el contraste AA de textos secundarios (gray-600), badges de estado y errores; el neón se reserva para fondos y bordes.
- La copia web a Android/iOS (`npm run cap:sync`) funciona, pero falta instalar y probar en un dispositivo/emulador.

Consulta la sección 13 de la documentación técnica para el listado completo.
