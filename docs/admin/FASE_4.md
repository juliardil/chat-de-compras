# Fase 4 · Confianza y atención

Documentación operativa de la Fase 4 del panel administrativo de Chat de
Compras: chats con acceso excepcional auditado, moderación, reseñas, soporte y
comunicaciones.

> Estado: implementado y verificado **en modo demostración**. Las migraciones
> se aplicaron al proyecto InsForge «Go.go» el 2026-11-10, pero el modo
> InsForge **aún no se ha probado de extremo a extremo**: falta crear el primer
> usuario administrativo. El archivo SQL de esta fase
> (`migrations/20261106030000_trust-care.sql`) no contiene datos de negocio.

Esta fase no cambia las rutas ni el diseño de la aplicación de
comprador/comercio. Sigue siendo una entrada separada en `admin.html`.

> **Importante sobre las reglas de negocio**: las máquinas de estados, los
> catálogos de motivos y la regla de lectura de chats descritas aquí son una
> **política de implementación** de esta fase. El servidor y la demo aplican
> exactamente las mismas reglas, pero **no se presentan como verdad de negocio
> definitiva**. Deben confirmarse con el negocio antes de usarlas como contrato.

---

## 1. Qué incluye

| Módulo | Ruta | Permiso de acceso | Alcance |
|---|---|---|---|
| Chats | `#/chats` | `chats.view_metadata` | Metadatos, solicitud y decisión de acceso, lectura auditada |
| Moderación | `#/moderacion` | `moderation.view` | Bandeja de reportes, asignación, resolución y descarte |
| Reseñas | `#/resenas` | `reviews.view` | Consulta y moderación de reseñas con motivo |
| Soporte | `#/soporte` | `support.view` | Bandeja, asignación, respuesta, notas internas y cierre |
| Comunicaciones | `#/comunicaciones` | `communications.view` | Plantillas y campañas **simuladas** |

El panel (`#/`) incorpora indicadores y avisos de atención de Fase 4 filtrados
por los permisos del rol. Auditoría registra las nuevas acciones y Configuración
muestra el estado del acceso a chats y del envío de comunicaciones.

### Lo que no incluye

- Leer mensajes de un chat sin una autorización aprobada, vigente y solicitada
  por el propio actor.
- Buscar texto dentro del contenido de los chats o exportarlo.
- Enviar correos, notificaciones o cualquier comunicación real. **No existe
  proveedor de mensajería**: poner en cola o marcar como enviada solo registra un
  estado simulado explícito.
- Editar plantillas, crear reportes o abrir tickets desde el panel. Se supervisan
  y moderan; su creación pertenece a los flujos de comprador y comercio.
- Pagos y analítica (Fase 5).
- Búsqueda global y exportación de datos (Fase 5).

---

## 2. Cómo entrar y probar en demo

```bash
npm run dev
# Abrir http://localhost:5173/admin.html
```

Contraseña demo: `Demo1234!`

| Cuenta | Rol | Qué permite probar en Fase 4 |
|---|---|---|
| `superadmin@demo.local` | Superadministrador | Todo, incluida la concesión de accesos y comunicados amplios |
| `admin@demo.local` | Administrador general | Fase 4 completa salvo personal/configuración y exportación de auditoría |
| `comercios@demo.local` | Gestor de comercios | Solo lectura de reseñas; sin chats, moderación, soporte ni comunicaciones |
| `moderador@demo.local` | Moderador | Solicita acceso a chats y lee contenido autorizado; modera reportes y reseñas; consulta soporte sin responder |
| `soporte@demo.local` | Atención | Gestiona tickets (asignar, responder, cerrar); sin chats, moderación ni comunicaciones |
| `analista@demo.local` | Analista | Consulta reseñas y auditoría; sin acciones de Fase 4 |

Los datos de ejemplo de Fase 4 son:

- 5 conversaciones: 3 activas, 1 marcada por moderación y 1 archivada, con 22
  mensajes en total.
- 5 solicitudes de acceso: 1 aprobada y vigente, 1 pendiente, 1 denegada, 1
  vencida y 1 revocada.
- 6 reportes de moderación: 2 abiertos, 1 en revisión, 2 resueltos y 1
  descartado.
- 6 reseñas: 3 publicadas, 1 oculta, 1 marcada y 1 pendiente.
- 6 tickets de soporte: 2 abiertos, 1 en curso, 1 esperando al usuario, 1 resuelto
  y 1 cerrado, con 12 mensajes y 1 ticket fuera de plazo.
- 4 plantillas: 2 activas, 1 borrador y 1 archivada.
- 4 campañas: 1 borrador, 1 en cola simulada, 1 marcada como enviada en la
  simulación y 1 cancelada.
- 8 eventos de auditoría de Fase 4.

Todos son **datos ficticios**. No representan conversaciones, reportes, reseñas,
tickets ni personas reales. Las campañas **no se han enviado**.

### Recorrido de demostración sugerido

1. Entrar con `moderador@demo.local` y abrir `#/chats`.
2. Comprobar que `demo-chat-2` aparece como legible porque tiene una autorización
   aprobada y vigente; abrir el contenido y verificar el aviso de lectura
   auditada.
3. Intentar leer `demo-chat-1`: el sistema exige una autorización. Solicitar
   acceso con un motivo.
4. Entrar con `superadmin@demo.local`, abrir la ficha de `demo-chat-1`, aprobar
   la solicitud con una vigencia (24 h por defecto, máximo 168 h) y volver a
   `moderador@demo.local` para leer el contenido.
5. Revisar Auditoría: cada lectura de contenido genera `chat.content.read`.
6. Con `soporte@demo.local`, responder un ticket abierto y comprobar que pasa a
   “en curso” y se asigna al actor. Resolver, cerrar y reabrir para ver el
   recálculo del SLA.
7. Con `admin@demo.local`, activar una plantilla y crear una campaña. Ponerla en
   cola: la interfaz debe mostrar “simulada” y “sin entrega real”.

---

## 3. Reglas de negocio implementadas

### 3.1 Chats y acceso excepcional

Estados de la conversación: `active`, `flagged`, `archived`.

| Desde | Hacia |
|---|---|
| `active` | `flagged`, `archived` |
| `flagged` | `active`, `archived` |
| `archived` | `active` |

Estados de una solicitud de acceso: `pending`, `approved`, `denied`, `expired`,
`revoked`.

| Desde | Hacia |
|---|---|
| `pending` | `approved`, `denied` |
| `approved` | `revoked`, `expired` |
| `denied`, `expired`, `revoked` | — |

Reglas de lectura:

- `chats.view_metadata` permite ver asunto, comprador, comercio, pedido, estado,
  número de mensajes y una vista previa del último mensaje. **Nunca** devuelve la
  conversación completa.
- `chats.request_access` permite crear una solicitud propia con motivo
  obligatorio.
- `chats.grant_access` permite aprobar, denegar o revocar solicitudes. La
  aprobación fija una vigencia de 24 horas por defecto, limitada entre 1 y 168
  horas.
- `chats.access_content` permite leer el contenido **solo si el propio actor
  tiene una solicitud aprobada y no vencida** para esa conversación.
- Cada lectura de contenido se audita como `chat.content.read`, incluso si la
  conversación no tiene mensajes.
- Un actor con `chats.grant_access` ve todas las solicitudes de la conversación;
  sin ese permiso solo ve las propias.
- Una solicitud vencida se calcula al vuelo (`expired`) aunque en la base siga
  como `approved`.

Acciones auditadas: `chat.access.request`, `chat.access.approved`,
`chat.access.denied`, `chat.access.revoked` y `chat.content.read`.

> **Política pendiente de confirmación**: la implementación actual no impide que
> una misma persona solicite y apruebe su propio acceso. Si el negocio exige
> separación de funciones (four-eyes), debe añadirse una regla adicional en
> cliente y servidor.

### 3.2 Moderación

Estados: `open`, `in_review`, `resolved`, `dismissed`.

| Desde | Hacia |
|---|---|
| `open` | `in_review`, `resolved`, `dismissed` |
| `in_review` | `resolved`, `dismissed`, `open` |
| `resolved`, `dismissed` | — |

Permisos por acción:

- Pasar a `in_review` (asignarse el reporte): `moderation.assign`.
- Resolver o descartar: `moderation.resolve`.
- Ver bandeja y ficha: `moderation.view`.

Toda transición exige motivo y queda auditada como `moderation.assign`,
`moderation.resolve` o `moderation.dismiss`, con estado anterior, nuevo y código
de motivo.

### 3.3 Reseñas

Estados: `published`, `hidden`, `flagged`, `pending`.

| Desde | Hacia |
|---|---|
| `published` | `hidden`, `flagged` |
| `flagged` | `published`, `hidden` |
| `hidden` | `published` |
| `pending` | `published`, `hidden` |

- Ver reseñas: `reviews.view`.
- Cualquier cambio de estado: `reviews.moderate`.
- El panel **no edita el texto ni la valoración**: solo cambia la visibilidad y
  deja trazabilidad.
- Acciones auditadas: `review.hide`, `review.restore`, `review.flag` y
  `review.publish`.
- La reputación pública debe recalcularse en el servidor a partir del estado; en
  esta fase no se modifica manualmente.

### 3.4 Soporte

Estados: `open`, `in_progress`, `waiting_user`, `resolved`, `closed`.

| Desde | Hacia |
|---|---|
| `open` | `in_progress`, `waiting_user`, `resolved`, `closed` |
| `in_progress` | `waiting_user`, `resolved`, `closed` |
| `waiting_user` | `in_progress`, `resolved`, `closed` |
| `resolved` | `closed`, `open` |
| `closed` | `open` |

Permisos y reglas:

- Ver tickets: `support.view`.
- Asignar: `support.assign`. No se puede asignar un ticket cerrado.
- Responder o añadir nota interna: `support.reply`.
- Resolver o cerrar: `support.close`.
- Cambiar a `in_progress` o `waiting_user`: `support.reply`.
- Reabrir (`resolved`/`closed` → `open`): `support.close`.
- Responder un ticket `open` lo pasa automáticamente a `in_progress` y asigna el
  ticket al actor si no tenía responsable.
- Reabrir limpia `resolvedAt`/`closedAt` y recalcula `dueAt` según el SLA:
  urgente 4 h, alta 12 h, normal 24 h, baja 72 h.
- Un ticket se considera fuera de plazo si está abierto, en curso o esperando al
  usuario y su `dueAt` ya pasó.
- Las respuestas y notas internas **no se envían por correo**: no hay proveedor.
  La auditoría registra `delivery: not_sent_no_provider` en InsForge.

Acciones auditadas: `support.assign`, `support.reply`, `support.resolve`,
`support.close`, `support.reopen` y `support.status`.

### 3.5 Comunicaciones simuladas

Estados de plantilla: `draft`, `active`, `archived`.

| Desde | Hacia |
|---|---|
| `draft` | `active`, `archived` |
| `active` | `archived` |
| `archived` | `draft` |

Estados de campaña: `draft`, `queued`, `sent`, `cancelled`, `failed`.

| Desde | Hacia |
|---|---|
| `draft` | `queued`, `cancelled` |
| `queued` | `sent`, `cancelled`, `failed` |
| `failed` | `draft`, `cancelled` |
| `sent`, `cancelled` | — |

Permisos:

- Ver plantillas y campañas: `communications.view`.
- Activar, archivar o devolver una plantilla a borrador:
  `communications.template`.
- Crear o cambiar campañas dirigidas (`active_buyers`, `active_commerces`,
  `support_contacts`): `communications.send`.
- Crear o cambiar campañas de audiencias amplias (`all_buyers`,
  `all_commerces`, `mixed`): `communications.broadcast`.
- Solo se pueden usar plantillas `active` al crear una campaña.

Simulación explícita:

- Toda campaña nace con `simulated: true`.
- `queued` fija `providerStatus: 'demo_pending'` y un motivo que indica que no
  existe proveedor de correo.
- `sent` fija `providerStatus: 'demo_simulated'` y un motivo que indica que no se
  entregó ningún mensaje real.
- La interfaz muestra “En cola (simulada)”, “Enviada (simulada)” y un aviso
  permanente de que los envíos no son reales.
- Nunca se afirma que un correo haya sido entregado.

Acciones auditadas: `communications.template.active`,
`communications.template.archived`, `communications.template.draft`,
`communications.campaign.create`, `communications.campaign.queue`,
`communications.campaign.send`, `communications.campaign.cancel`,
`communications.campaign.fail` y `communications.campaign.change`.

---

## 4. Modelo de datos (InsForge)

La migración `migrations/20261106030000_trust-care.sql` define:

- `chat_threads`, `chat_messages`, `chat_access_requests`.
- `moderation_reports`.
- `commerce_reviews`.
- `support_tickets`, `support_ticket_messages`.
- `communication_templates`, `communication_campaigns`.

Todas las tablas tienen RLS habilitado y **acceso directo revocado** para `anon`
y `authenticated`. El cliente solo puede usar funciones `SECURITY DEFINER` que
vuelven a comprobar permisos y escriben auditoría:

| Área | Funciones |
|---|---|
| Chats | `admin_list_chats`, `admin_get_chat`, `admin_request_chat_access`, `admin_decide_chat_access`, `admin_read_chat_content` |
| Moderación | `admin_list_moderation_reports`, `admin_get_moderation_report`, `admin_update_moderation_report` |
| Reseñas | `admin_list_reviews`, `admin_get_review`, `admin_set_review_status` |
| Soporte | `admin_list_support_tickets`, `admin_get_support_ticket`, `admin_assign_support_ticket`, `admin_update_support_status`, `admin_reply_support_ticket` |
| Comunicaciones | `admin_list_communication_templates`, `admin_set_communication_template_status`, `admin_list_communication_campaigns`, `admin_create_communication_campaign`, `admin_set_campaign_status` |
| Métricas | `admin_trust_metrics` |

La migración **no contiene datos de negocio ni secretos**.

---

## 5. Permisos utilizados

Se reutiliza el catálogo existente. **No se añadieron permisos nuevos.**

| Permiso | Uso |
|---|---|
| `chats.view_metadata` | Ver metadatos de conversaciones |
| `chats.request_access` | Solicitar acceso al contenido |
| `chats.grant_access` | Aprobar, denegar o revocar accesos |
| `chats.access_content` | Leer contenido con autorización vigente |
| `moderation.view` | Ver reportes |
| `moderation.assign` | Asignarse un reporte |
| `moderation.resolve` | Resolver o descartar reportes |
| `reviews.view` | Ver reseñas |
| `reviews.moderate` | Cambiar visibilidad de reseñas |
| `support.view` | Ver tickets |
| `support.assign` | Asignar tickets |
| `support.reply` | Responder o añadir notas internas |
| `support.close` | Resolver, cerrar y reabrir tickets |
| `communications.view` | Ver plantillas y campañas |
| `communications.template` | Gestionar estado de plantillas |
| `communications.send` | Campañas dirigidas |
| `communications.broadcast` | Campañas a audiencias amplias |

Ocultar botones en React es solo presentación: cada RPC vuelve a validar el
permiso en el servidor.

---

## 6. Privacidad y seguridad

- **Contenido de chats**: no se incluye en la bandeja ni en la ficha; requiere
  una RPC específica, autorización propia vigente y genera auditoría por lectura.
- **Sin búsqueda masiva**: no hay endpoint para buscar texto dentro de los
  mensajes.
- **PII**: en modo InsForge el enmascaramiento y la autorización ocurren en el
  servidor. La demo enmascara localmente y lo advierte.
- **Auditoría**: en producción es append-only y la escribe el servidor. En demo
  vive en `localStorage` y puede alterarse; no debe usarse como evidencia.
- **Correo**: no existe proveedor. Las campañas y respuestas de soporte no se
  entregan. Cualquier afirmación de entrega real sería falsa.
- **Retención**: la política de conservación de chats, tickets y campañas está
  pendiente de confirmación por el negocio.
- **Separación de funciones**: ver la nota sobre autoaprobación de accesos en la
  sección 3.1.

---

## 7. Verificación

```bash
npm run lint     # ESLint sin errores
npm test         # 120 pruebas (incluye Fases 1 a 4)
npm run build    # genera dist/index.html y dist/admin.html
```

Pruebas añadidas en Fase 4:

- `src/admin/data/demoRepository.phase4.test.js` — 23 pruebas de metadatos sin
  contenido, lectura auditada, solicitud/aprobación/revocación de acceso,
  duplicados y motivos obligatorios, moderación, reseñas, soporte con SLA,
  plantillas, campañas simuladas, permisos por segmento y métricas.
- `src/admin/data/demoRepository.phase2.test.js` — la migración ahora verifica la
  versión 4 y la presencia de los datos de Fases 3 y 4.
- `src/admin/AdminApp.test.jsx` — prueba adicional que navega a chats,
  moderación, reseñas, soporte y comunicaciones y confirma que ya no aparece el
  aviso de módulo pendiente.

Verificación manual recomendada en demo:

1. Confirmar que la bandeja de chats no muestra mensajes completos.
2. Comprobar que sin autorización la lectura falla y que con autorización queda
   registrada en Auditoría.
3. Verificar que una autorización vencida no permite leer.
4. Asignar, resolver y descartar reportes con motivo.
5. Ocultar, marcar, publicar y restaurar reseñas.
6. Responder, resolver, cerrar y reabrir tickets; comprobar el cambio de SLA.
7. Crear y poner en cola una campaña; verificar el aviso de simulación.
8. Confirmar que `#/pagos` y `#/analitica` ya no muestran el aviso de módulo
   pendiente (implementadas en la Fase 5; ver [FASE_5.md](./FASE_5.md)).

---

## 8. Criterios de aceptación de la Fase 4

- [x] Chats con metadatos separados del contenido.
- [x] Acceso al contenido con solicitud propia, aprobación, vigencia y revocación.
- [x] Lectura de contenido auditada en cada acceso.
- [x] Sin búsqueda masiva ni exposición de mensajes en la bandeja.
- [x] Moderación con asignación, resolución, descarte y motivos.
- [x] Reseñas con visibilidad moderada sin editar la opinión.
- [x] Soporte con asignación, respuesta, notas internas, cierre, reapertura y SLA.
- [x] Comunicaciones con plantillas y campañas **explícitamente simuladas**.
- [x] Métricas y avisos de atención de Fase 4 filtrados por permisos.
- [x] Rutas `#/chats`, `#/moderacion`, `#/resenas`, `#/soporte` y
      `#/comunicaciones` funcionales.
- [x] Migración SQL de Fase 4 escrita y **no ejecutada**.
- [x] Lint, 120 pruebas y build en verde.
- [ ] Modo InsForge probado contra un proyecto real (bloqueado por credenciales).
- [ ] Proveedor de correo y dominio verificado para envíos reales.
- [ ] Claims del JWT verificados en el proyecto real.
- [ ] Máquinas de estados, motivos y separación de funciones confirmados por el
      negocio.
