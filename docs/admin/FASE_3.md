# Fase 3 · Operación

Documentación operativa de la Fase 3 del panel administrativo de Chat de
Compras: solicitudes de compra, ofertas, pedidos, disputas, entregas,
incidencias y evidencias.

> Estado: implementado y verificado **en modo demostración**. El modo InsForge
> está escrito, pero **no se ha probado contra un proyecto real** porque aún no
> hay credenciales ni migraciones aplicadas. El archivo SQL de esta fase
> (`migrations/20261106020000_operations.sql`) **no se ha ejecutado**.

Esta fase no cambia las rutas ni el diseño de la aplicación de
comprador/comercio. Sigue siendo una entrada separada en `admin.html`.

> **Importante sobre las reglas de negocio**: las máquinas de estados y los
> catálogos de motivos descritos aquí son una **política de implementación** de
> esta fase. El servidor y la demo aplican exactamente las mismas reglas, pero
> **no se presentan como verdad de negocio definitiva**. Deben confirmarse con
> el negocio antes de usarlas como contrato.

---

## 1. Qué incluye

| Módulo | Ruta | Permiso de acceso | Alcance |
|---|---|---|---|
| Solicitudes | `#/solicitudes` | `requests.view` | Bandeja, ficha, ocultar/restaurar, cerrar y cancelar |
| Ofertas | `#/ofertas` | `offers.view` | Bandeja, ficha, marcar/retirar marca y retirada administrativa |
| Pedidos | `#/pedidos` | `orders.view` | Bandeja, ficha con línea de tiempo, transiciones y disputas |
| Entregas | `#/entregas` | `deliveries.view` | Seguimiento, confirmación, incidencias y evidencias |

El panel (`#/`) incorpora indicadores de Fase 3 y avisos de atención filtrados
por los permisos del rol. Auditoría registra las nuevas acciones y
Configuración muestra el estado de los dos almacenamientos privados.

### Lo que no incluye

- Crear solicitudes, ofertas, pedidos o entregas desde el panel. Se supervisan
  y moderan; su creación pertenece a los flujos de comprador y comercio.
- Subir evidencias o documentos desde el panel. En InsForge solo se autoriza la
  ruta privada y se genera una URL firmada temporal.
- Pasarela de pagos, chats, reseñas y soporte (Fases 4–5).
- Búsqueda global de operaciones (Fase 5).
- Exportación de datos (Fase 5).

---

## 2. Cómo entrar y probar en demo

```bash
npm run dev
# Abrir http://localhost:5173/admin.html
```

Contraseña demo: `Demo1234!`

| Cuenta | Rol | Qué permite probar en Fase 3 |
|---|---|---|
| `superadmin@demo.local` | Superadministrador | Todo |
| `admin@demo.local` | Administrador general | Operación completa salvo personal/configuración |
| `comercios@demo.local` | Gestor de comercios | Solo lectura de solicitudes, ofertas, pedidos y entregas |
| `moderador@demo.local` | Moderador | Modera y cierra solicitudes, marca ofertas y consulta pedidos; sin entregas ni retirada administrativa |
| `soporte@demo.local` | Atención | Consulta operación y entregas; no registra ni resuelve incidencias con los permisos actuales |
| `analista@demo.local` | Analista | Consulta operación, métricas y auditoría |

Los datos de ejemplo de Fase 3 son:

- 7 solicitudes: 2 abiertas, 1 oculta, 2 cerradas, 1 cancelada y 1 vencida.
- 10 ofertas: 4 activas, 1 marcada, 3 aceptadas, 1 retirada por el comercio y 1
  vencida.
- 6 pedidos: 1 pendiente, 1 confirmado, 1 enviado, 1 entregado, 1 en disputa y
  1 completado, con 18 eventos de línea de tiempo y 2 disputas (1 abierta).
- 6 entregas: 1 pendiente, 1 en preparación, 1 en tránsito, 2 entregadas y 1
  fallida, con 2 incidencias (1 abierta) y 3 evidencias registradas **solo como
  metadatos**.
- 6 eventos de auditoría de Fase 3.

Todos son **datos ficticios**. No representan solicitudes, ofertas, pedidos,
entregas ni personas reales.

---

## 3. Reglas de negocio implementadas

### 3.1 Solicitudes de compra

Estados: `open`, `hidden`, `closed`, `cancelled`, `expired`.

Transiciones permitidas:

| Desde | Hacia |
|---|---|
| `open` | `hidden`, `closed`, `cancelled` |
| `hidden` | `open`, `closed`, `cancelled` |
| `expired` | `closed`, `cancelled` |
| `closed` | — |
| `cancelled` | — |

Permisos por acción:

- Ocultar y restaurar: `requests.moderate`.
- Cerrar y cancelar: `requests.close`.
- Ver la solicitud y sus ofertas: `requests.view`. Las ofertas de la ficha solo
  se incluyen con `offers.view`; si falta, la respuesta indica
  `offersRestricted: true`.

Toda transición exige motivo y queda auditada como `request.hide`,
`request.restore`, `request.close` o `request.cancel`, con estado anterior,
nuevo y código de motivo.

### 3.2 Ofertas

Estados: `active`, `flagged`, `accepted`, `withdrawn`, `withdrawn_admin`,
`expired`.

Transiciones administrativas permitidas:

| Desde | Hacia |
|---|---|
| `active` | `flagged`, `withdrawn_admin` |
| `flagged` | `active`, `withdrawn_admin` |
| `accepted`, `withdrawn`, `withdrawn_admin`, `expired` | — |

Permisos por acción:

- Marcar y retirar la marca: `offers.flag`.
- Retirar la oferta por administración: `offers.withdraw_admin`.

Marcar guarda `flaggedReason`, `flaggedAt` y el nombre del actor. Retirar la
marca limpia esos campos. La retirada administrativa guarda `withdrawnAt`. Las
transiciones del comercio (por ejemplo, retirar su propia oferta) no se ejecutan
desde este panel. Toda acción exige motivo y se audita como `offer.flag`,
`offer.unflag` o `offer.withdraw_admin`.

### 3.3 Pedidos y disputas

Estados: `pending`, `confirmed`, `preparing`, `shipped`, `delivered`,
`completed`, `disputed`, `cancelled`.

Transiciones permitidas:

| Desde | Hacia |
|---|---|
| `pending` | `confirmed`, `cancelled` |
| `confirmed` | `preparing`, `cancelled`, `disputed` |
| `preparing` | `shipped`, `cancelled`, `disputed` |
| `shipped` | `delivered`, `disputed` |
| `delivered` | `completed`, `disputed` |
| `completed` | `disputed` |
| `disputed` | `completed`, `cancelled` |
| `cancelled` | — |

Permisos por transición:

- Desde `disputed`: `orders.resolve_dispute`.
- Hacia `cancelled`: `orders.cancel`.
- Cualquier otra transición: `orders.transition`.

Reglas adicionales:

- Los ítems y el snapshot del pedido son **inmutables**. En InsForge un trigger
  (`admin_guard_order_snapshot`) rechaza cambios en ítems, snapshot, relaciones,
  importe, moneda u número de pedido. En demo se conservan sin modificarlos.
- Cada transición añade un evento a la línea de tiempo con actor, estado,
  motivo y metadatos.
- Abrir una disputa crea un registro `open` y audita `order.dispute`.
- Resolver una disputa exige una resolución válida (`favor_buyer`,
  `favor_commerce`, `partial`, `no_fault` u `other`) además del motivo. La
  disputa pasa a `resolved`, se guarda quién y cuándo, y se audita
  `order.resolve_dispute`.
- Los pedidos con disputa abierta se marcan con `hasOpenDispute`.
- Sin `deliveries.view`, la ficha del pedido oculta la entrega asociada
  (`deliveryRestricted: true`) y no devuelve su estado.

### 3.4 Entregas e incidencias

Estados: `pending`, `preparing`, `shipped`, `in_transit`, `delivered`, `failed`,
`returned`, `cancelled`.

Transiciones permitidas:

| Desde | Hacia |
|---|---|
| `pending` | `preparing`, `cancelled` |
| `preparing` | `shipped`, `cancelled` |
| `shipped` | `in_transit`, `delivered`, `failed` |
| `in_transit` | `delivered`, `failed` |
| `failed` | `in_transit`, `delivered`, `returned` |
| `delivered`, `returned`, `cancelled` | — |

Permisos:

- Confirmar la recepción (`delivered`): `deliveries.confirm`.
- Cualquier otra transición: `deliveries.update`.
- Registrar y resolver incidencias: `deliveries.update`.

Reglas adicionales:

- Cada transición exige motivo y se audita como `delivery.update` o
  `delivery.confirm`; también admite transportista, código de seguimiento y
  fecha estimada.
- Las incidencias tienen tipo (`not_received`, `damaged`, `delayed`,
  `wrong_address`, `carrier_issue`, `other`), descripción obligatoria y estado
  `open`/`resolved`. Registrar audita `delivery.incident`; resolver audita
  `delivery.incident.resolve`.
- Una incidencia ya resuelta no se puede volver a resolver.
- Las evidencias son metadatos (`evidenceType`, nombre, MIME, tamaño, nota) más
  una ruta privada. La lista y la ficha **nunca exponen `storagePath`**; solo
  indican `hasFile`.
- En demo no existe archivo ni bucket: la previsualización siempre falla con un
  mensaje explícito.

---

## 4. Arquitectura de datos

### Modo demostración

`src/admin/data/demoRepository.js` implementa Fase 3 sobre `localStorage` y
**también aplica los permisos**, para que la demo no permita acciones que el
servidor rechazaría.

- Clave: `chat_compras_admin_demo_v1`.
- Versión interna del almacén: **3**.
- Al abrir un almacén de Fase 1 (versión 1) o Fase 2 (versión 2) se conservan
  miembros, invitaciones, datos y auditoría previos; se añaden los datos de
  Fase 3 y se anteponen sus eventos de auditoría.
- Semilla: `src/admin/data/demoSeedPhase3.js`.
- Catálogo de estados, transiciones, permisos y motivos:
  `src/admin/constants/phase3.js`.

Borrar `chat_compras_admin_demo_v1` restaura los datos de ejemplo.

### Modo InsForge

`src/admin/data/insforgeRepository.js` no consulta tablas directamente: usa
funciones RPC con permisos y auditoría en servidor.

| RPC | Uso | Permiso comprobado en servidor |
|---|---|---|
| `admin_list_requests(p_search, p_status)` | Bandeja de solicitudes | `requests.view` |
| `admin_get_request(p_request_id)` | Ficha y ofertas | `requests.view`; ofertas con `offers.view` |
| `admin_set_request_status(p_request_id, p_status, p_reason, p_reason_code)` | Moderar, cerrar o cancelar | `requests.moderate` o `requests.close` |
| `admin_list_offers(p_search, p_status, p_request_id)` | Bandeja de ofertas | `offers.view` |
| `admin_get_offer(p_offer_id)` | Ficha de oferta | `offers.view` |
| `admin_set_offer_status(p_offer_id, p_status, p_reason, p_reason_code)` | Marcar o retirar oferta | `offers.flag` o `offers.withdraw_admin` |
| `admin_list_orders(p_search, p_status)` | Bandeja de pedidos | `orders.view` |
| `admin_get_order(p_order_id)` | Ficha, línea de tiempo y disputas | `orders.view`; entrega con `deliveries.view` |
| `admin_transition_order(p_order_id, p_status, p_reason, p_reason_code, p_resolution)` | Transición y resolución de disputa | `orders.transition`, `orders.cancel` o `orders.resolve_dispute` |
| `admin_list_deliveries(p_search, p_status)` | Bandeja de entregas | `deliveries.view` |
| `admin_get_delivery(p_delivery_id)` | Ficha, incidencias y evidencias | `deliveries.view` |
| `admin_update_delivery(p_delivery_id, p_status, p_reason, p_reason_code, p_carrier, p_tracking_code, p_estimated_at)` | Seguimiento | `deliveries.update` (o `deliveries.confirm` si el destino es `delivered`) |
| `admin_confirm_delivery(p_delivery_id, p_reason, p_reason_code)` | Confirmar recepción | `deliveries.confirm` |
| `admin_report_delivery_incident(p_delivery_id, p_incident_type, p_description)` | Registrar incidencia | `deliveries.update` |
| `admin_resolve_delivery_incident(p_incident_id, p_resolution_reason)` | Resolver incidencia | `deliveries.update` |
| `admin_delivery_evidence_path(p_evidence_id)` | Autorizar ruta privada | `deliveries.view` |
| `admin_dashboard_metrics()` | Indicadores y avisos | Filtra cada bloque según el permiso del rol |

La migración **revoca todo acceso directo** a las ocho tablas de operación para
`anon` y `authenticated`, activa RLS y concede `execute` solo a las RPC
anteriores.

---

## 5. Migración y almacenamiento

Archivo: `migrations/20261106020000_operations.sql`.

**No se ha ejecutado.** No se creó ninguna tabla remota.

### Qué crea

- `purchase_requests`
- `purchase_offers`
- `purchase_orders`
- `purchase_order_events`
- `purchase_order_disputes`
- `order_deliveries`
- `delivery_incidents`
- `delivery_evidence`
- Índices, trigger de inmutabilidad del snapshot, helpers de transición,
  funciones RPC, RLS y privilegios mínimos
- La versión ampliada de `admin_dashboard_metrics()` con las claves de Fase 3

Depende de las tablas de Fase 2 (`buyer_profiles`, `commerce_categories`,
`commerce_profiles`, `commerce_documents`) y de las funciones de permisos y
auditoría de Fase 1.

### Qué no crea

- Solicitudes, ofertas, pedidos, entregas, incidencias ni evidencias de ejemplo:
  son datos de negocio y deben crearse desde los flujos reales.
- Los buckets de almacenamiento.

### Buckets privados esperados

- Documentos de comercio: `commerce-documents`
  (`VITE_INSFORGE_DOCUMENTS_BUCKET`).
- Evidencias de entrega: `delivery-evidence`
  (`VITE_INSFORGE_EVIDENCE_BUCKET`).

### Cómo aplicarla (cuando haya proyecto)

```bash
npx @insforge/cli login
npx @insforge/cli link --project-id <project-id>
npx @insforge/cli db migrations up --all
```

Después:

1. Crear los buckets privados `commerce-documents` y `delivery-evidence` en
   InsForge Storage.
2. Configurar las políticas de Storage para que solo usuarios autorizados
   accedan a los objetos. La autorización de la ruta de evidencia la decide
   `admin_delivery_evidence_path()` y la de documentos
   `admin_document_storage_path()`.
3. Configurar `VITE_INSFORGE_DOCUMENTS_BUCKET` y
   `VITE_INSFORGE_EVIDENCE_BUCKET` si se usan otros nombres.
4. Crear el primer superadministrador siguiendo la Fase 1.

Comprobaciones sugeridas con sesión de un miembro administrativo:

```sql
select public.admin_dashboard_metrics();
select public.admin_list_requests(null, null);
select public.admin_list_offers(null, null, null);
select public.admin_list_orders(null, null);
select public.admin_list_deliveries(null, null);
```

Sin miembro administrativo o sin el permiso correspondiente, las funciones deben
devolver un error de autorización.

---

## 6. Interfaz

### Solicitudes

- Búsqueda por título, descripción, comprador o categoría; filtro por estado.
- Ficha con comprador, categoría, presupuesto, ítems, fechas y ofertas
  recibidas (si hay `offers.view`).
- Acciones de ocultar, restaurar, cerrar y cancelar con diálogo de motivo y
  código. Los botones se ocultan según permisos y el repositorio vuelve a
  validar.
- Aviso de que ocultar no elimina la solicitud: conserva trazabilidad.

### Ofertas

- Búsqueda por solicitud, comprador, comercio, condiciones o motivo; filtro por
  estado.
- Ficha con importe, plazo, ítems, condiciones, solicitud de origen y estado de
  revisión.
- Acciones de marcar irregularidad, retirar marca y retirar por administración
  con motivo. La retirada administrativa exige un permiso distinto.

### Pedidos

- Búsqueda por número, solicitud, comercio o comprador; filtro por estado.
- Ficha con snapshot, ítems, comprador, comercio, entrega asociada y línea de
  tiempo ordenada.
- Acciones de avance, cancelación y apertura de disputa con motivo.
- Diálogo específico para resolver disputas: exige resolución y motivo, y
  muestra el histórico de disputas.
- Los pedidos con disputa abierta se destacan en la bandeja.

### Entregas

- Búsqueda por pedido, comprador, comercio, transportista o código; filtro por
  estado.
- Ficha con pedido, transportista, seguimiento, fechas, incidencias y
  evidencias.
- Acciones de seguimiento y confirmación de recepción con motivo. Confirmar
  exige `deliveries.confirm`; el resto, `deliveries.update`.
- Registro y resolución de incidencias con tipo, descripción y motivo de
  resolución.
- Previsualización de evidencias solo en InsForge y solo si existe archivo. En
  demo se explica que no hay archivo ni bucket.

---

## 7. Qué es real, qué es demo y qué falta

### Real (código de producción)

- Rutas y pantallas de solicitudes, ofertas, pedidos y entregas.
- Reglas de transición de solicitudes, ofertas, pedidos y entregas validadas en
  cliente y servidor.
- Permisos por acción reutilizando el catálogo existente, sin permisos nuevos.
- Inmutabilidad del snapshot e ítems del pedido en SQL.
- Línea de tiempo de pedidos, disputas y resoluciones con motivo.
- Seguimiento de entregas, incidencias y evidencias como metadatos privados.
- Auditoría de cada acción con actor, motivo, estado anterior y nuevo.
- RPC con permisos, RLS y revocación de acceso directo (archivo escrito).
- Autorización de rutas de evidencia y URL firmadas cuando InsForge está
  configurado.
- Indicadores y avisos de Fase 3 filtrados por permisos.
- Migración SQL de Fase 3 (archivo listo, **no ejecutado**).

### Demo (no confiable)

- Solicitudes, ofertas, pedidos, entregas, incidencias y evidencias sembrados.
- Persistencia en `localStorage`; la versión 3 migra almacenes de Fase 1 y 2.
- Permisos simulados en el navegador.
- Auditoría alterable desde DevTools.
- Evidencias sin archivo real; la previsualización siempre falla de forma
  explícita.
- Indicadores calculados sobre datos ficticios.
- Las máquinas de estados y motivos son política de implementación, no verdad
  de negocio confirmada.

### Pendiente

- Probar el modo InsForge contra un proyecto real.
- Aplicar las migraciones de Fases 1, 2 y 3.
- Verificar el origen de los claims del JWT
  (`request.jwt.claims` frente a `request.jwt.claim.sub` o `auth.uid()`).
- Crear y verificar los buckets privados y las URLs firmadas de documentos y
  evidencias.
- Verificar las políticas de Storage del proyecto.
- Probar las transiciones con datos reales creados por los flujos de comprador
  y comercio.
- Confirmar con el negocio las máquinas de estados, los motivos y la política de
  vencimiento de solicitudes y ofertas.
- Definir quién puede registrar evidencias desde los flujos reales y con qué
  límites de tamaño y tipo.
- MFA: no disponible en el SDK 1.5.2; no se simuló.
- Envío de correo de invitaciones: requiere InsForge Messaging y dominio.
- Búsqueda global, pagos, chats, reseñas, soporte, exportación y edición de
  configuración: Fases 4–5.

---

## 8. Pruebas y verificación

```bash
npm run lint     # ESLint sin errores
npm test         # 96 pruebas (incluye Fases 1, 2 y 3)
npm run build    # genera dist/index.html y dist/admin.html
```

Pruebas añadidas en Fase 3:

- `src/admin/data/demoRepository.phase3.test.js` — 22 pruebas de moderación y
  cierre de solicitudes, visibilidad de ofertas, marca y retirada
  administrativa, transiciones y snapshot de pedidos, resolución de disputas con
  resolución obligatoria, permisos de cancelación, seguimiento y confirmación de
  entregas, incidencias, evidencias como metadatos, filtrado de métricas y
  migración del almacén a versión 3.
- `src/admin/data/demoRepository.phase2.test.js` — la prueba de migración ahora
  verifica la versión 3 y la presencia de los datos de Fase 3 sin perder
  miembros, invitaciones ni auditoría previa.
- `src/admin/AdminApp.test.jsx` — prueba adicional que navega a solicitudes,
  ofertas, pedidos y entregas y confirma que ya no aparece el aviso de módulo
  pendiente.

Verificación manual recomendada en demo:

1. Entrar con `superadmin@demo.local` y revisar los indicadores de operación del
   panel.
2. Con `moderador@demo.local`, ocultar y restaurar una solicitud, cerrar otra y
   marcar/retirar la marca de una oferta. Comprobar que no puede retirar una
   oferta por administración ni ver entregas.
3. Con `analista@demo.local`, confirmar que solo consulta operación, métricas y
   auditoría, y que no aparecen acciones de estado.
4. Con `admin@demo.local`, confirmar un pedido pendiente, abrir una disputa y
   resolverla exigiendo resolución y motivo; comprobar la línea de tiempo y la
   auditoría.
5. Con `admin@demo.local`, avanzar una entrega, confirmar la recepción de otra,
   registrar una incidencia y resolverla. Intentar resolverla dos veces.
6. Abrir una evidencia y comprobar el mensaje de que en demo solo hay metadatos.
7. Comprobar que `#/pagos`, `#/chats`, `#/moderacion`, `#/resenas`, `#/soporte`,
   `#/comunicaciones` y `#/analitica` siguen mostrando el aviso de módulo
   pendiente.

---

## 9. Seguridad y límites conocidos

- **Autorización real**: RLS y funciones `SECURITY DEFINER` en InsForge. Ocultar
  botones en React es solo presentación; cada RPC vuelve a validar permisos.
- **Permisos**: se reutiliza el catálogo existente. No se añadieron permisos
  nuevos en esta fase.
- **Snapshot de pedido**: inmutable a nivel de trigger en SQL. En demo se trata
  como inmutable por convención del repositorio.
- **Evidencias**: la ruta de almacenamiento nunca se envía al cliente sin
  autorización. La URL firmada es temporal (300 s) y no se cachea en la
  aplicación.
- **Auditoría**: en producción es append-only y la escribe el servidor. En demo
  es `localStorage` y puede alterarse.
- **Datos de negocio**: la migración no siembra operaciones, entregas ni
  evidencias.
- **Estados y motivos**: son política de implementación pendiente de confirmación
  por el negocio.
- **Modo InsForge**: escrito y revisado, pero no verificado en un proyecto real.

---

## 10. Criterios de aceptación de la Fase 3

- [x] Solicitudes con bandeja, ficha y moderación (ocultar/restaurar).
- [x] Cierre y cancelación de solicitudes con motivo y auditoría.
- [x] Ofertas con ficha, marca de irregularidad y retirada administrativa.
- [x] Retirada administrativa protegida con permiso propio.
- [x] Pedidos con línea de tiempo, snapshot e ítems inmutables.
- [x] Transiciones de pedido validadas en cliente y servidor.
- [x] Disputas con apertura, resolución obligatoria, motivo y auditoría.
- [x] Entregas con seguimiento, confirmación de recepción e incidencias.
- [x] Evidencias como metadatos privados; sin archivos inventados en demo.
- [x] Métricas y avisos de atención de operación filtrados por permisos.
- [x] Rutas `#/solicitudes`, `#/ofertas`, `#/pedidos` y `#/entregas`
      funcionales.
- [x] Migración SQL de Fase 3 escrita y **no ejecutada**.
- [x] Lint, 96 pruebas y build en verde.
- [ ] Modo InsForge probado contra un proyecto real (bloqueado por credenciales).
- [ ] Buckets privados creados y URLs firmadas verificadas.
- [ ] Claims del JWT verificados en el proyecto real.
- [ ] Máquinas de estados y motivos confirmados por el negocio.
- [ ] Operaciones reales creadas desde los flujos de comprador y comercio.

---

## 11. Próxima fase

La **Fase 4 · Comunicación y confianza** (chats, reseñas, moderación y soporte)
no se inicia hasta que la apruebes. Requiere relacionar conversaciones con
solicitudes y pedidos, acceso controlado al contenido, reseñas verificadas y
flujos de soporte con trazabilidad.
