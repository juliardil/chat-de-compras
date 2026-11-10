# Fase 1 · Fundación administrativa

Documentación operativa del panel de administración de Chat de Compras.
Esta fase **no modifica los flujos existentes de comprador/comercio**: el
administrador es una entrada separada.

> Estado: implementado y verificado en modo demostración. Las migraciones se
> aplicaron al proyecto InsForge «Go.go» el 2026-11-10, pero el modo InsForge
> **aún no se ha probado de extremo a extremo**: falta crear el primer usuario
> administrativo (ver el bloque de arranque al final de la migración).

---

## 1. Cómo entrar

| Entorno | URL |
|---|---|
| Desarrollo | `http://localhost:5173/admin.html` |
| Preview del build | `http://localhost:4173/admin.html` |
| Build estático | `dist/admin.html` |

El panel usa `HashRouter`, así que las rutas se ven como
`admin.html#/personal`, `admin.html#/auditoria`, etc. No necesita rewrites del
servidor. El enlace «Ir a la aplicación» vuelve a `./index.html`.

El build es multi-página: `index.html` (app actual) y `admin.html` (panel).

---

## 2. Modo demostración vs. InsForge

El adaptador se elige en `src/admin/data/index.js`:

- **demo** — no hay `VITE_INSFORGE_URL` / `VITE_INSFORGE_ANON_KEY`.
  Todo se guarda en `localStorage` de este navegador.
- **insforge** — ambas variables están definidas. Se usa
  `@insforge/sdk@1.5.2` y el servidor decide permisos con RLS + funciones.

Copia `.env.example` a `.env` y completa:

```env
VITE_INSFORGE_URL=https://tu-proyecto.insforge.app
VITE_INSFORGE_ANON_KEY=tu-anon-key-publica
```

El `anonKey` es público por diseño. El **API Key** (`ik_...`) es de acceso
total y no debe aparecer nunca en variables `VITE_*` ni en el navegador.

La interfaz muestra siempre un distintivo (`Demostración` o `InsForge`) y, en
modo demo, avisos explícitos en login, panel, personal, auditoría y
configuración.

---

## 3. Cuentas de demostración

Contraseña única: `Demo1234!`

| Correo | Rol | Qué puede probar |
|---|---|---|
| `superadmin@demo.local` | Superadministrador | Todo, incluido personal y auditoría |
| `admin@demo.local` | Administrador general | Operación, sin gestión de personal |
| `comercios@demo.local` | Gestor de comercios | Módulos de comercios/catálogo (Fase 2) |
| `moderador@demo.local` | Moderador | Moderación y chats (Fase 4) |
| `soporte@demo.local` | Atención al cliente | Tickets y pedidos (Fases 3–4) |
| `analista@demo.local` | Analista | Métricas y auditoría en lectura |

`finance` existe en el catálogo de roles, pero no tiene cuenta demo porque no
hay pasarela de pagos conectada.

Claves de almacenamiento local:

- `chat_compras_admin_demo_v1` — miembros, invitaciones y auditoría.
- `chat_compras_admin_demo_session_v1` — miembro con sesión.
- `chat_compras_admin_window_v1` — ventana de sesión (sessionStorage).
- `chat_compras_admin_sidebar_collapsed_v1` — preferencia de menú.

Borrar la primera clave restaura los datos de ejemplo.

---

## 4. Arquitectura

```
admin.html                          Entrada separada del panel
src/admin/
├── main.jsx                        HashRouter + montaje
├── AdminApp.jsx                    Providers, rutas y guardas
├── auth/
│   ├── permissions.js              Catálogo, 7 roles y matriz de permisos
│   ├── sessionPolicy.js            Inactividad (20 min) y límite (8 h)
│   ├── AdminAuthProvider.jsx       Login, restauración, expiración
│   ├── PermissionGate.jsx          Ocultar UI sin permiso
│   └── useAdminAuth.js             Hook de sesión
├── constants/navigation.js         Menú, fases y módulos pendientes
├── data/
│   ├── index.js                    Selección demo / insforge
│   ├── demoRepository.js           Datos de ejemplo en localStorage
│   └── insforgeRepository.js       RPC y consultas reales
├── layout/                         Sidebar, Topbar, AdminLayout
├── components/                     UI reutilizable (modal, avisos, KPIs…)
├── pages/                          Login, Dashboard, Staff, Audit, Settings…
└── utils/format.js                 Fechas, iniciales y truncado
migrations/
└── 20261106000000_admin-foundation.sql
```

### Rutas del panel

| Hash | Pantalla | Permiso | Estado |
|---|---|---|---|
| `#/` | Panel | `dashboard.view` | Funcional |
| `#/personal` | Personal y permisos | `staff.view` | Funcional |
| `#/auditoria` | Auditoría | `audit.view` | Funcional |
| `#/configuracion` | Configuración | `settings.view` | Solo lectura |
| `#/compradores`, `#/comercios`, … | Módulos futuros | Según módulo | Placeholder honesto con su fase |
| `#/sin-permiso` | 403 | — | Funcional |
| `#/*` | 404 | — | Funcional |

Los módulos futuros no simulan tablas ni datos: muestran alcance, dependencias
técnicas y la fase en la que se construirán.

---

## 5. Roles y permisos

El catálogo vive en `src/admin/auth/permissions.js` y la migración siembra
exactamente las mismas claves (hay una prueba que lo verifica).

| Rol | Enfoque | Límites destacados |
|---|---|---|
| `superadmin` | Control total | Único que asigna superadmins y gestiona configuración sensible |
| `admin` | Operación diaria | Sin `staff.*`, `settings.update`, `audit.export` ni reembolsos |
| `commerce_manager` | Comercios y catálogo | Sin personal, pagos ni auditoría |
| `moderator` | Contenido y confianza | Sin comercios aprobados, personal ni pagos |
| `support` | Atención | Sin acciones destructivas ni auditoría |
| `analyst` | Lectura | Solo métricas, exportación de informes y auditoría |
| `finance` | Pagos | Sin personal ni configuración; inactivo hasta la pasarela |

En **modo demo** los permisos se evalúan en el cliente para la navegación.
En **modo InsForge** la autoridad es el servidor: RLS en cada tabla y
comprobaciones dentro de funciones `SECURITY DEFINER`. Ocultar un botón nunca
sustituye esa validación.

La edición de la matriz de permisos por rol y los overrides individuales se
reservan para la Fase 5, con auditoría y aprobación.

---

## 6. Sesión

`src/admin/auth/sessionPolicy.js` define:

- **20 minutos** de inactividad → expira.
- **8 horas** desde el inicio → límite absoluto, aunque haya actividad.
- Aviso **1 minuto** antes, con botón «Extender sesión».
- Comprobación cada 15 s y actualización de actividad como máximo cada 5 s.

Al expirar se cierra la sesión del repositorio y se muestra una pantalla
dedicada. Esto mejora la experiencia, pero **la expiración real del token la
controla InsForge**.

---

## 7. Qué es real, qué es demo y qué falta

### Real (código de producción)

- Entrada administrativa separada y build multi-página.
- Autenticación por correo/contraseña contra InsForge cuando está configurado.
- Catálogo de permisos, 7 roles y guardas de ruta.
- Gestión de personal: listado, invitaciones, suspensión/reactivación con motivo.
- Auditoría de accesos y acciones, con filtros y detalle.
- Política de sesión y pantallas de error/expiración.
- Migración SQL con tablas, RLS, funciones y seeds (archivo listo, **no ejecutado**).

### Demo (no confiable)

- Miembros, invitaciones y eventos sembrados.
- Persistencia en `localStorage`.
- Permisos simulados en el navegador.
- KPIs calculados sobre datos de ejemplo.
- La auditoría demo puede alterarse desde DevTools.

### Pendiente

- Probar el modo InsForge contra un proyecto real.
- Aplicar la migración y crear el primer superadministrador.
- Verificar en el proyecto real cómo expone InsForge los claims del JWT
  (`request.jwt.claims`, `request.jwt.claim.sub` o `auth.uid()`).
- **MFA**: el SDK 1.5.2 no expone segundo factor. No se simuló.
- Envío real de invitaciones: requiere InsForge Messaging y dominio verificado.
- Restablecimiento de contraseña desde el panel: usar el flujo de InsForge.
- Exportación de auditoría: botón deshabilitado hasta la Fase 5.
- Edición de configuración: solo lectura hasta la Fase 5.
- Todos los módulos marcados Fase 2–5.

---

## 8. Migración de base de datos

Archivo: `migrations/20261106000000_admin-foundation.sql`.

**No se ha ejecutado.** No se creó ninguna tabla remota.

### Qué crea

- `admin_roles`, `admin_permissions`, `admin_role_permissions`
- `admin_members`, `admin_member_permission_overrides`
- `admin_invitations`
- `admin_audit_logs` (append-only desde el cliente)

### Qué protege

- RLS activado en las 7 tablas.
- `GRANT SELECT` solo a `authenticated`; sin `INSERT/UPDATE/DELETE` directos.
- Escrituras únicamente mediante funciones `SECURITY DEFINER` con comprobación
  de permiso, motivo obligatorio y auditoría.
- `admin_members` solo es visible para el propio miembro o para `staff.view`.
- La auditoría solo se lee con `audit.view`; no hay política de escritura.
- Se impide suspender al último superadministrador activo y a uno mismo.

### Cómo aplicarla (cuando haya proyecto)

```bash
npx @insforge/cli login
npx @insforge/cli link --project-id <project-id>
npx @insforge/cli db migrations up --all
```

Después, crear el usuario en InsForge Auth y vincularlo una sola vez:

```sql
insert into public.admin_members (user_id, email, display_name, role_id, status)
select u.id, u.email, coalesce(u.profile ->> 'name', u.email), r.id, 'active'
from auth.users u
cross join public.admin_roles r
where lower(u.email) = 'tu-correo@dominio.com'
  and r.key = 'superadmin'
on conflict (user_id) do nothing;
```

Comprobaciones sugeridas tras aplicar:

```sql
select key from public.admin_roles order by key;
select count(*) from public.admin_permissions;  -- debe coincidir con el catálogo
select public.admin_me();                        -- con sesión del superadmin
```

> Las migraciones SQL no conceden privilegios automáticamente; por eso el
> archivo incluye `GRANT SELECT` explícito. Sin él, RLS no llega a evaluarse.

---

## 9. Seguridad y límites conocidos

- **Autorización real**: RLS + funciones en el servidor. La comprobación en
  React es solo de presentación.
- **Auditoría**: en producción es append-only y la escribe el servidor. En demo
  es `localStorage` y no sirve como evidencia.
- **PII**: no hay datos personales reales en esta fase.
- **Chats**: el acceso excepcional a conversaciones es Fase 4; no existe aún.
- **Pagos**: no hay pasarela ni transacciones; el módulo está bloqueado.
- **MFA**: no disponible en el SDK actual; se documenta como pendiente, no se
  finge.
- **Búsqueda global**: en Fase 1 solo navega entre secciones; no busca usuarios,
  comercios ni pedidos.
- **Multi-pestaña**: la ventana de sesión vive en `sessionStorage`; cada pestaña
  mantiene su propio temporizador.
- **Cierre de sesión centralizado**: no hay revocación de sesiones remotas ni
  listado de dispositivos en esta fase.

---

## 10. Pruebas y verificación

```bash
npm run lint     # ESLint sin errores
npm test         # 39 pruebas (incluye Fase 1)
npm run build    # genera dist/index.html y dist/admin.html
```

Pruebas añadidas en esta fase:

- `src/admin/auth/permissions.test.js` — catálogo, roles, límites y
  consistencia con los seeds de la migración.
- `src/admin/auth/sessionPolicy.test.js` — inactividad, límite absoluto y
  expiración exacta.
- `src/admin/data/demoRepository.test.js` — login, sesión, invitaciones,
  suspensiones, último superadmin y auditoría.
- `src/admin/AdminApp.test.jsx` — login demo de extremo a extremo y menú
  filtrado por permisos.

> El build muestra un aviso de Vite: el SDK de InsForge importa `crypto` y Vite
> lo externaliza para el navegador. El build termina correctamente y el modo
> demo funciona; conviene revisarlo al conectar InsForge real.

Verificación manual recomendada en modo demo:

1. Abrir `admin.html` y entrar con cada una de las 6 cuentas.
2. Confirmar que el menú cambia según el rol.
3. Invitar un miembro, suspenderlo y revisar el evento en Auditoría.
4. Intentar suspender al único superadmin → debe fallar.
5. Abrir una ruta de una fase posterior (p. ej. `#/pagos`) → con las fases
   1 a 5 aplicadas carga el módulo correspondiente; antes de la Fase 5
   mostraba el aviso de módulo pendiente.
6. Dejar la pestaña inactiva y comprobar el aviso y la expiración.

---

## 11. Criterios de aceptación de la Fase 1

- [x] Entrada administrativa separada, sin tocar rutas de la app actual.
- [x] Autenticación real o demo claramente identificada.
- [x] Roles y permisos con guardas de navegación.
- [x] Gestión de personal con motivo y auditoría.
- [x] Auditoría consultable y declarada append-only en servidor.
- [x] Sesión con inactividad, límite absoluto y aviso.
- [x] Shell responsive con navegación por permisos.
- [x] Panel con estado honesto de la plataforma.
- [x] Migración escrita, revisada y **no ejecutada**.
- [x] Lint, pruebas y build en verde.
- [ ] Modo InsForge probado contra un proyecto real (bloqueado por credenciales).
- [ ] MFA (bloqueado por el SDK).
- [ ] Envío de invitaciones por correo (requiere Messaging).

---

## 12. Próxima fase

Las **Fases 2 y 3** ya están implementadas y verificadas en modo demostración:
consulta [FASE_2.md](./FASE_2.md) y [FASE_3.md](./FASE_3.md). Ambas mantienen
pendiente la verificación contra un proyecto InsForge real y la aplicación de
sus migraciones.
