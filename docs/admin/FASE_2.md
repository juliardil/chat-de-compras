# Fase 2 · Personas y catálogo

Documentación operativa de la Fase 2 del panel administrativo de Chat de Compras:
compradores, comercios, documentos de verificación y categorías.

> Estado: implementado y verificado **en modo demostración**. El modo InsForge
> está escrito, pero **no se ha probado contra un proyecto real** porque aún no
> hay credenciales ni migraciones aplicadas. El archivo SQL de esta fase
> (`migrations/20261106010000_people_catalog.sql`) **no se ha ejecutado**.

Esta fase no cambia las rutas ni el diseño de la aplicación de
comprador/comercio. Sigue siendo una entrada separada en `admin.html`.

---

## 1. Qué incluye

| Módulo | Ruta | Permiso de acceso | Alcance |
|---|---|---|---|
| Compradores | `#/compradores` | `users.view` | Directorio, ficha, PII enmascarada y cambios de estado |
| Comercios | `#/comercios` | `commerce.view` | Bandeja de verificación, ficha, documentos y decisiones |
| Categorías y datos | `#/categorias` | `catalog.view` | Árbol de dos niveles, alta/edición y activación/desactivación |

El panel (`#/`) incorpora indicadores de Fase 2 y avisos de atención filtrados
por los permisos del rol. Auditoría y Configuración muestran los nuevos eventos
y el estado del almacenamiento privado.

### Lo que no incluye

- Alta o edición de compradores desde el panel (solo consulta y estado).
- Alta o edición de comercios desde el panel (solo verificación y estado).
- Subida de archivos: los documentos se registran por procesos de alta; el
  panel solo revisa metadatos y, con InsForge, previsualiza el archivo existente.
- Pedidos, ofertas, chats, reportes y pagos (Fases 3–5).
- Búsqueda global de personas/comercios (Fase 3).
- Exportación de datos (Fase 5).

---

## 2. Cómo entrar y probar en demo

```bash
npm run dev
# Abrir http://localhost:5173/admin.html
```

Contraseña demo: `Demo1234!`

| Cuenta | Rol | Qué permite probar en Fase 2 |
|---|---|---|
| `superadmin@demo.local` | Superadministrador | Todo, incluida PII visible y bloqueo |
| `admin@demo.local` | Administrador general | Fase 2 completa salvo personal/configuración |
| `comercios@demo.local` | Gestor de comercios | Comercios, documentos y catálogo; no bloquea compradores |
| `moderador@demo.local` | Moderador | Ve compradores y suspende; no ve documentos ni bloquea |
| `soporte@demo.local` | Atención | Consulta compradores/comercios sin documentos |
| `analista@demo.local` | Analista | Consulta y auditoría; sin documentos, catálogo ni PII |

Los datos de ejemplo de Fase 2 son:

- 6 compradores: 3 activos, 1 limitado, 1 suspendido y 1 bloqueado.
- 7 comercios: 1 pendiente, 1 en revisión, 3 aprobados, 1 suspendido y 1 rechazado.
- 28 documentos: 8 pendientes, 18 verificados y 2 rechazados.
- 11 categorías: 10 activas y 1 inactiva, en dos niveles.

Todos son **datos ficticios**. No representan personas, comercios ni documentos
reales.

---

## 3. Reglas de negocio implementadas

### 3.1 Compradores

Estados: `active`, `limited`, `suspended`, `blocked`.

Transiciones permitidas:

| Desde | Hacia |
|---|---|
| `active` | `suspended`, `blocked` |
| `limited` | `active`, `suspended`, `blocked` |
| `suspended` | `active`, `blocked` |
| `blocked` | `active` |

Permisos:

- Suspender y reactivar (incluye limitar/activar): `users.suspend`.
- Bloquear y desbloquear: `users.block`.
- Ver PII completa: `users.view_pii`. Sin ese permiso, correo y teléfono se
  enmascaran.
- Toda acción exige motivo y queda auditada.

En modo demo el enmascarado se hace en el repositorio. En modo InsForge se hace
**en el servidor**, dentro de `admin_list_buyers`.

### 3.2 Comercios

Estados: `pending`, `in_review`, `approved`, `rejected`, `suspended`.

Transiciones permitidas:

| Desde | Hacia |
|---|---|
| `pending` | `in_review`, `rejected` |
| `in_review` | `approved`, `rejected` |
| `approved` | `suspended` |
| `suspended` | `approved` |
| `rejected` | `in_review` |

Permisos por decisión:

- Pasar a `rejected`: `commerce.reject`.
- Pasar a `suspended`: `commerce.suspend`.
- Pasar a `in_review` o `approved` (incluida la reactivación): `commerce.approve`.
- Ver documentos y generar URL firmada: `commerce.documents.view`.
- Revisar documentos (verificar/rechazar): `commerce.approve`.

Toda transición exige motivo y queda auditada con el estado anterior y el nuevo.

### 3.3 Documentos

- Los documentos son **metadatos más una ruta privada de almacenamiento**.
- La lista y la ficha no exponen `storage_path`; solo indican `hasFile`.
- Sin `commerce.documents.view`, la ficha devuelve `documentsRestricted: true` y
  una lista vacía. El resumen (totales por estado) sigue visible para
  `commerce.view`.
- Los requisitos documentales **no están codificados como verdad de negocio**.
  La interfaz avisa cuando hay documentos pendientes o rechazados, pero **no
  bloquea** aprobar un comercio: la decisión y su motivo quedan auditados.
- En demo no existe ningún archivo: la previsualización está deshabilitada y el
  repositorio lanza un error explícito.
- En InsForge, la URL firmada se genera solo después de que
  `admin_document_storage_path()` autorice el documento. La URL dura 300 s.

### 3.4 Categorías

- Máximo **dos niveles**: una categoría principal y sus subcategorías.
- El padre debe ser de nivel principal; una subcategoría no puede tener hijas.
- Una categoría con subcategorías no se puede mover de nivel.
- No se puede desactivar un padre mientras tenga subcategorías activas.
- Las categorías **no se eliminan**: se activan o desactivan para conservar el
  historial y las relaciones con comercios.
- El identificador (`slug`) se genera a partir del nombre y debe ser único.
- Crear requiere `catalog.create`; editar, `catalog.update`; activar o
  desactivar, `catalog.deactivate`. Toda acción exige motivo cuando cambia el
  estado y queda auditada.

---

## 4. Arquitectura de datos

### Modo demostración

`src/admin/data/demoRepository.js` implementa Fase 2 sobre `localStorage` y
**también aplica los permisos**, para que la demo no permita acciones que el
servidor rechazaría.

- Clave: `chat_compras_admin_demo_v1`.
- Versión interna del almacén: **2**.
- Al abrir un almacén de Fase 1 (versión 1), se conservan miembros,
  invitaciones y auditoría, se añaden los datos de Fase 2 y se anteponen los
  eventos de auditoría de la fase.
- Semilla: `src/admin/data/demoSeedPhase2.js`.
- Enmascarado y `slugify`: `src/admin/utils/mask.js`.
- Catálogo de estados, transiciones, tipos de documento y motivos:
  `src/admin/constants/phase2.js`.

Borrar `chat_compras_admin_demo_v1` restaura los datos de ejemplo.

### Modo InsForge

`src/admin/data/insforgeRepository.js` no consulta tablas directamente: usa
funciones RPC con permisos y auditoría en servidor.

| RPC | Uso | Permiso comprobado en servidor |
|---|---|---|
| `admin_list_buyers(p_search, p_status)` | Listado de compradores | `users.view`; enmascara sin `users.view_pii` |
| `admin_set_buyer_status(p_buyer_id, p_status, p_reason, p_reason_code)` | Cambio de estado | `users.suspend` o `users.block` según la acción |
| `admin_list_commerces(p_search, p_status)` | Bandeja de comercios | `commerce.view` |
| `admin_get_commerce(p_commerce_id)` | Ficha y documentos | `commerce.view`; documentos con `commerce.documents.view` |
| `admin_review_commerce_document(p_document_id, p_status, p_reason, p_reason_code)` | Verificar/rechazar documento | `commerce.approve` |
| `admin_set_commerce_status(p_commerce_id, p_status, p_reason, p_reason_code)` | Transición de comercio | `commerce.reject`, `commerce.suspend` o `commerce.approve` |
| `admin_document_storage_path(p_document_id)` | Autorizar ruta privada | `commerce.documents.view` |
| `admin_list_categories(p_search, p_status)` | Árbol de categorías | `catalog.view` |
| `admin_create_category(p_name, p_parent_id, p_description, p_sort_order)` | Alta | `catalog.create` |
| `admin_update_category(p_category_id, p_name, p_parent_id, p_description, p_sort_order)` | Edición | `catalog.update` |
| `admin_set_category_status(p_category_id, p_status, p_reason, p_reason_code)` | Activar/desactivar | `catalog.deactivate` |
| `admin_dashboard_metrics()` | Indicadores y avisos | Filtra cada bloque según el permiso del rol |

Las migraciones **revocan todo acceso directo** a `buyer_profiles`,
`commerce_categories`, `commerce_profiles` y `commerce_documents` para `anon` y
`authenticated`, activan RLS y conceden `execute` solo a las RPC anteriores.

---

## 5. Migración y almacenamiento

Archivo: `migrations/20261106010000_people_catalog.sql`.

**No se ha ejecutado.** No se creó ninguna tabla remota.

### Qué crea

- `buyer_profiles`
- `commerce_categories`
- `commerce_profiles`
- `commerce_documents`
- Funciones de enmascarado, listado, transición, revisión y métricas
- Índices, RLS y privilegios mínimos

### Qué no crea

- Categorías, compradores, comercios ni documentos de ejemplo: son datos de
  negocio y deben crearse desde procesos reales.
- El bucket de almacenamiento. La aplicación espera un bucket **privado**
  llamado `commerce-documents` (configurable con
  `VITE_INSFORGE_DOCUMENTS_BUCKET`).

### Cómo aplicarla (cuando haya proyecto)

```bash
npx @insforge/cli login
npx @insforge/cli link --project-id <project-id>
npx @insforge/cli db migrations up --all
```

Después:

1. Crear el bucket privado `commerce-documents` en InsForge Storage.
2. Configurar las políticas de Storage para que solo usuarios autorizados
   accedan a los objetos; la autorización de la ruta la decide
   `admin_document_storage_path()`.
3. Configurar `VITE_INSFORGE_DOCUMENTS_BUCKET` si se usa otro nombre.
4. Crear el primer superadministrador siguiendo la Fase 1.
5. Crear categorías desde el panel y registrar comercios/documentos desde los
   procesos de alta reales.

Comprobaciones sugeridas con sesión de un miembro administrativo:

```sql
select public.admin_dashboard_metrics();
select public.admin_list_categories(null, null);
select public.admin_list_buyers(null, null);
```

Sin miembro administrativo o sin el permiso correspondiente, las funciones deben
devolver un error de autorización.

---

## 6. Interfaz

### Compradores

- Búsqueda por nombre, correo o teléfono; filtro por estado.
- Aviso explícito cuando la PII está enmascarada.
- Ficha con estado, motivo del último cambio, actividad y fechas.
- Acciones de suspender, reactivar, bloquear y desbloquear con diálogo de
  motivo. Los botones se ocultan según permisos; el repositorio vuelve a
  validar.

### Comercios

- Bandeja con filtros por estado y búsqueda.
- Ficha con datos fiscales, categoría, ciudad, revisor y resumen documental.
- Documentos con tipo, estado, revisor y motivo.
- Aviso de documentos pendientes/rechazados que **no impide** aprobar.
- Previsualización con URL firmada solo en InsForge y si el documento tiene
  archivo. En demo se explica que no hay archivo.
- Acciones de revisión, aprobación, rechazo, suspensión y reactivación con
  motivo.

### Categorías

- Árbol de dos niveles con conteo de subcategorías, subcategorías activas y
  comercios asociados.
- Alta de categoría principal o subcategoría.
- Edición con vista previa del `slug`.
- Bloqueo del selector de padre cuando la categoría ya tiene hijas.
- Activación/desactivación con motivo; el botón de desactivar un padre con hijas
  activas está deshabilitado y el repositorio lo impide igualmente.

---

## 7. Qué es real, qué es demo y qué falta

### Real (código de producción)

- Rutas y pantallas de compradores, comercios y categorías.
- Enmascarado de PII en servidor para InsForge y en repositorio para demo.
- Reglas de transición de compradores, comercios y documentos.
- Reglas de jerarquía y activación de categorías.
- Auditoría de cada acción con actor, motivo, estado anterior y nuevo.
- RPC con permisos, RLS y revocación de acceso directo (archivo escrito).
- URL firmadas para documentos privados cuando InsForge está configurado.
- Indicadores y avisos filtrados por permisos.
- Migración SQL de Fase 2 (archivo listo, **no ejecutado**).

### Demo (no confiable)

- Compradores, comercios, documentos y categorías sembrados.
- Persistencia en `localStorage`; la versión 2 migra almacenes de Fase 1.
- Permisos simulados en el navegador.
- Enmascarado de PII en el cliente.
- Documentos sin archivo real; la previsualización siempre falla de forma
  explícita.
- Auditoría alterable desde DevTools.
- Indicadores calculados sobre datos ficticios.

### Pendiente

- Probar el modo InsForge contra un proyecto real.
- Aplicar la migración de Fase 1 y la de Fase 2.
- Verificar el origen de los claims del JWT
  (`request.jwt.claims` frente a `request.jwt.claim.sub` o `auth.uid()`).
- Crear el bucket privado y comprobar la generación de URLs firmadas.
- Verificar las políticas de Storage del proyecto.
- Probar la migración con datos reales de compradores y comercios.
- Cargar documentos desde el flujo de alta del comercio (fuera del panel).
- MFA: no disponible en el SDK 1.5.2; no se simuló.
- Envío de correo de invitaciones: requiere InsForge Messaging y dominio.
- Búsqueda global de personas/comercios: Fase 3.
- Exportación y edición de configuración: Fase 5.

---

## 8. Pruebas y verificación

```bash
npm run lint     # ESLint sin errores
npm test         # 73 pruebas (incluye Fase 1 y Fase 2)
npm run build    # genera dist/index.html y dist/admin.html
```

Pruebas añadidas en Fase 2:

- `src/admin/data/demoRepository.phase2.test.js` — 24 pruebas de enmascarado y
  permisos de compradores, transiciones de comercios, visibilidad y revisión de
  documentos, reglas de categorías, métricas por permisos y migración del
  almacén de versión 1 a 2.
- `src/admin/utils/mask.test.js` — 9 pruebas de enmascarado de correo, teléfono,
  identificador fiscal, texto y generación de `slug`.
- `src/admin/AdminApp.test.jsx` — prueba adicional que navega a compradores,
  comercios y categorías y confirma que ya no aparece el aviso de módulo
  pendiente.

Verificación manual recomendada en demo:

1. Entrar con `superadmin@demo.local` y comprobar que se ven correo y teléfono
   completos en Compradores.
2. Entrar con `analista@demo.local` y comprobar el enmascarado y que no aparecen
   documentos, catálogo ni acciones de estado.
3. Con `moderador@demo.local`, suspender un comprador y confirmar que no puede
   bloquearlo.
4. Con `comercios@demo.local`, pasar un comercio pendiente a revisión, aprobarlo,
   suspenderlo y reactivarlo; revisar los eventos en Auditoría.
5. Abrir un comercio con `moderador@demo.local` y comprobar el aviso de
   documentos restringidos.
6. Intentar desactivar `Repuestos`: debe bloquearse porque tiene subcategorías
   activas. Desactivar una categoría hoja y volver a activarla.
7. Comprobar que `#/solicitudes` sigue mostrando el placeholder de Fase 3.

---

## 9. Seguridad y límites conocidos

- **Autorización real**: RLS y funciones `SECURITY DEFINER` en InsForge. Ocultar
  botones en React es solo presentación.
- **PII**: en InsForge el enmascarado ocurre en SQL antes de devolver el JSON. En
  demo ocurre en el repositorio del navegador y no debe considerarse seguro.
- **Documentos**: las rutas de almacenamiento nunca se envían al cliente sin
  autorización. La URL firmada es temporal y no se cachea en la aplicación.
- **Auditoría**: en producción es append-only y la escribe el servidor. En demo
  es `localStorage`.
- **Categorías**: no existe borrado; desactivar conserva las relaciones.
- **Aprobación con documentos pendientes**: se permite a propósito, con aviso y
  motivo auditado. La política documental definitiva debe decidirse antes de
  exigirla como bloqueo.
- **Datos de negocio**: la migración no siembra compradores, comercios,
  documentos ni categorías.
- **MFA y correo**: pendientes por limitaciones del SDK y de Messaging.
- **Búsqueda global**: sigue navegando solo entre secciones.
- **Modo InsForge**: escrito y revisado, pero no verificado en un proyecto real.

---

## 10. Criterios de aceptación de la Fase 2

- [x] Directorio de compradores con PII enmascarada salvo `users.view_pii`.
- [x] Suspensión, reactivación, bloqueo y desbloqueo con motivo y auditoría.
- [x] Bandeja de comercios y ficha de verificación.
- [x] Documentos como metadatos privados; sin archivos inventados en demo.
- [x] Revisión de documentos con `commerce.approve`.
- [x] Transiciones de comercio validadas en cliente y servidor.
- [x] Aviso de documentos pendientes sin bloquear la aprobación.
- [x] Categorías de dos niveles, sin borrado y con reglas de jerarquía.
- [x] Activación/desactivación de categorías con motivo.
- [x] Métricas y avisos de atención filtrados por permisos.
- [x] Rutas `#/compradores`, `#/comercios` y `#/categorias` funcionales.
- [x] Migración SQL de Fase 2 escrita y **no ejecutada**.
- [x] Lint, 73 pruebas y build en verde.
- [ ] Modo InsForge probado contra un proyecto real (bloqueado por credenciales).
- [ ] Bucket privado creado y URL firmadas verificadas.
- [ ] Claims del JWT verificados en el proyecto real.
- [ ] Alta de comercios y carga de documentos desde el flujo real.

---

## 11. Próxima fase

La **Fase 3 · Operación** (solicitudes, ofertas, pedidos y entregas) ya está
implementada y verificada en modo demostración. Consulta
[FASE_3.md](./FASE_3.md). Las máquinas de estados y los motivos de operación
siguen pendientes de confirmación por el negocio.
