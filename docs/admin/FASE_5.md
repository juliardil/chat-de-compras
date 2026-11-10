# Fase 5 · Analítica y pagos

Documentación operativa de la Fase 5 del panel administrativo de Chat de
Compras: informes agregados, libro interno de movimientos de pago,
conciliación manual, liquidaciones simuladas, exportaciones auditadas y
búsqueda global de metadatos.

> Estado: implementado y verificado **en modo demostración**. El modo InsForge
> está escrito, pero **no se ha probado contra un proyecto real** porque aún no
> hay credenciales ni migraciones aplicadas. El archivo SQL de esta fase
> (`migrations/20261106040000_analytics_payments.sql`) **no se ha ejecutado**.

Esta fase no cambia las rutas ni el diseño de la aplicación de
comprador/comercio. Sigue siendo una entrada separada en `admin.html`.

> **Importante sobre las reglas de negocio**: las máquinas de estados, los
> catálogos de motivos, la tarifa de comisión de referencia (10 %) y qué
> estados cuentan como «cobrado» descritas aquí son una **política de
> implementación** de esta fase. El servidor y la demo aplican exactamente las
> mismas reglas, pero **no se presentan como verdad de negocio definitiva**.
> Deben confirmarse con el negocio antes de usarlas como contrato.

> **Importante sobre el dinero**: **no existe pasarela de pagos conectada**.
> Esta fase no cobra, no reembolsa y no transfiere fondos: define el libro
> interno de movimientos y su única mutación operativa, la conciliación manual
> auditada. Las tablas de pagos se llenarán desde una integración futura con
> una pasarela real.

---

## 1. Qué incluye

| Módulo | Ruta | Permiso de acceso | Alcance |
|---|---|---|---|
| Analítica | `#/analitica` | `analytics.view` | Informes agregados por rango (7/30/90 días), serie diaria, top comercios y mezcla de métodos |
| Pagos | `#/pagos` | `payments.view` | Libro interno de movimientos, filtros, detalle y liquidaciones **simuladas** |
| Conciliación manual | `#/pagos` | `payments.reconcile` | Marcar/desmarcar un movimiento como conciliado con motivo obligatorio |
| Exportar analítica | `#/analitica` | `analytics.export` | CSV agregado sin datos personales, auditado |
| Exportar auditoría | `#/auditoria` | `audit.export` | CSV del registro de auditoría, auditado |
| Búsqueda global | Barra superior | Según el permiso de cada tipo | Metadatos de compradores, comercios, solicitudes, ofertas, pedidos, entregas, chats y tickets |

El panel (`#/`) incorpora indicadores de pagos (cobrado, comisión, reembolsos,
sin conciliar y liquidaciones pendientes) filtrados por los permisos del rol.
Auditoría registra las nuevas acciones. La barra superior incluye la búsqueda
global.

### Lo que no incluye

- Cobrar, autorizar, reembolsar, cancelar o transferir dinero: **no hay
  pasarela conectada**. El estado de cada movimiento solo refleja el registro
  interno.
- Emitir reembolsos desde el panel. Los roles con `payments.refund` ven un
  aviso de que la acción no está disponible sin pasarela.
- Crear, editar o eliminar movimientos y liquidaciones: el libro se llena
  desde una integración futura. La única mutación es la conciliación.
- Datos personales en la analítica: los informes son agregados
  (`piiIncluded: false`). El permiso `analytics.pii` existe en el catálogo pero
  **no se usa** en esta fase.
- Configurar pasarelas o credenciales de pago (`payments.configure` está en el
  catálogo sin función activa).
- Buscar texto dentro del contenido de los chats o de los mensajes de soporte:
  la búsqueda global solo usa metadatos.

---

## 2. Cómo entrar y probar en demo

```bash
npm run dev
# Abrir http://localhost:5173/admin.html
```

Contraseña demo: `Demo1234!`

| Cuenta | Rol | Qué permite probar en Fase 5 |
|---|---|---|
| `superadmin@demo.local` | Superadministrador | Todo: analítica, exportaciones, pagos, conciliación y exportación de auditoría |
| `admin@demo.local` | Administrador general | Ve pagos y analítica y exporta analítica; **no** concilia ni exporta auditoría |
| `comercios@demo.local` | Gestor de comercios | Solo lectura de analítica agregada; sin pagos |
| `moderador@demo.local` | Moderador | Sin pagos ni analítica |
| `soporte@demo.local` | Atención | Sin pagos ni analítica |
| `analista@demo.local` | Analista | Ve pagos y analítica y exporta analítica; **no** concilia |

El rol `finance` existe en el catálogo (pagos, reembolsos y conciliación,
pensado para activarse con la pasarela), pero **no tiene cuenta demo**.

Los datos de ejemplo de Fase 5 son:

- 6 movimientos internos: 1 pendiente, 1 autorizado, 3 cobrados y 1 con
  reembolso parcial de 40 USD. Tres ya conciliados por «Ana Torres».
- GMV cobrado 623 USD, comisión estimada 58.30 USD, neto a comercios
  524.70 USD, reembolsos registrados 40 USD, 1 cobro sin conciliar.
- 3 liquidaciones **simuladas** por comercio: 1 liquidada, 1 programada y
  1 pendiente.
- 3 eventos de auditoría de Fase 5 (2 conciliaciones y 1 exportación de
  analítica del analista).

Todos son **datos ficticios** marcados como simulados. No representan cobros,
reembolsos ni liquidaciones reales. La comisión de referencia del 10 % es una
estimación interna pendiente de confirmar, no una tarifa contractual.

### Recorrido de demostración sugerido

1. Entrar con `analista@demo.local` y abrir `#/analitica`. Cambiar el rango
   entre 7, 30 y 90 días y comprobar que la serie diaria y los KPI cambian.
2. Exportar CSV: el aviso recuerda que no hay datos personales. En Auditoría
   aparece `analytics.export`.
3. Abrir `#/pagos` con el mismo usuario: el libro carga, pero los botones de
   conciliar no aparecen (el analista no tiene `payments.reconcile`).
4. Entrar con `superadmin@demo.local`, abrir `#/pagos` y filtrar «Sin
   conciliar»: solo queda el movimiento con reembolso parcial.
5. Conciliar ese movimiento con el motivo «Coincide con el extracto
   bancario». Verificar en Auditoría la entrada `payment.reconcile` con estado
   anterior y nuevo.
6. Volver a `#/pagos`, abrir el detalle de un movimiento y comprobar las
   liquidaciones simuladas del comercio y el aviso de «Sin pasarela
   conectada».
7. Con `admin@demo.local`, abrir `#/auditoria`: el botón de exportar no
   aparece (falta `audit.export`). Con `superadmin@demo.local`, exportar y
   comprobar que la propia exportación queda registrada como `audit.export`.
8. Escribir en la búsqueda global de la barra superior: mínimo 2 caracteres,
   máximo 20 resultados, y cada resultado abre su módulo con el término
   precargado.
9. Entrar con `soporte@demo.local`: no ve `#/analitica` ni `#/pagos` en el
   menú, y la búsqueda global solo devuelve tickets y entidades permitidas
   para su rol.

---

## 3. Reglas de negocio implementadas

### 3.1 Analítica agregada

- Rangos: 7, 30 (por defecto) o 90 días en la interfaz. El servidor ajusta
  cualquier valor entre 1 y 365 días.
- Cuentan como «cobrados» los estados `paid`, `partially_refunded` y
  `refunded`. El GMV, la comisión y el neto solo suman esos movimientos.
- Un pago se fecha por `paidAt` y, si no existe, por `createdAt`. Los pedidos
  se miden por `placedAt` dentro del rango.
- KPI del resumen: GMV cobrado, comisión estimada, neto a comercios,
  reembolsos registrados, pagos registrados y cobrados, pedidos (totales,
  completados, en disputa y cancelados), ticket promedio y pagos sin
  conciliar.
- Serie diaria: un punto por día con GMV, pedidos y pagos cobrados.
- Top comercios y mezcla de métodos: solo agregados por comercio y por método
  de pago, con porcentaje de participación.
- El informe **nunca incluye datos personales** (`piiIncluded: false`).
- Ver y refrescar: `analytics.view`. Exportar: además `analytics.export`.
- Cada exportación queda auditada como `analytics.export` con rango, recuento
  de filas y `piiIncluded: false`. El CSV usa las columnas
  `seccion,periodo,comercio,metrica,valor`.

### 3.2 Libro interno de pagos

Estados de un movimiento: `pending`, `authorized`, `paid`,
`partially_refunded`, `refunded`, `failed`, `cancelled`.

**No hay transiciones de estado desde el panel**: el libro se llena desde una
pasarela futura. La única mutación es la conciliación (campo `reconciled`).

- Ver el libro, el detalle, las métricas y las liquidaciones: `payments.view`.
- Filtros: búsqueda por número de pedido, comprador, comercio, referencia o
  etiquetas de estado/método; filtro por estado; filtro por conciliación
  (todos, sin conciliar, conciliados). «Sin conciliar» solo incluye
  movimientos conciliables.
- El detalle añade el pedido asociado y las liquidaciones del comercio.
- Liquidaciones: estimaciones internas **simuladas** por comercio con periodo,
  bruto, comisión y neto. Estados: `pending`, `scheduled`, `paid`, `failed`.
  Nunca se presentan como transferencias reales.
- La página muestra permanentemente el aviso «Sin pasarela de pagos» y, en
  demo, el aviso de movimientos ficticios.

### 3.3 Conciliación manual

- Permiso: `payments.reconcile`.
- Solo se pueden conciliar movimientos en `paid`, `partially_refunded` o
  `refunded`. El resto falla con un error explícito.
- Motivo obligatorio con código del catálogo: `statement_match`
  (coincide con el extracto bancario), `manual_review` (revisión manual
  completada), `correction` (corrección de registro interno) u `other`.
- Conciliar fija fecha y responsable; retirar la conciliación limpia ambos.
- Cada acción queda auditada como `payment.reconcile` con estado anterior,
  nuevo, código de motivo y `gatewayConnected: false`.
- **No mueve dinero ni ejecuta reembolsos**: es un registro interno.

### 3.4 Búsqueda global

- Disponible en la barra superior para todos los roles autenticados; el
  mínimo son 2 caracteres.
- Tipos indexados y permiso que los habilita: compradores (`users.view`),
  comercios (`commerce.view`), solicitudes (`requests.view`), ofertas
  (`offers.view`), pedidos (`orders.view`), entregas (`deliveries.view`),
  chats (`chats.view_metadata`, **solo metadatos**) y tickets
  (`support.view`).
- Los correos de compradores se enmascaran salvo con `users.view_pii`.
- **Nunca se indexa el contenido de los mensajes** de chat ni de soporte.
- Devuelve como máximo 20 resultados y avisa con `truncated` si hubo más.
- Cada resultado abre su módulo con `?q=` precargado, reutilizando la
  búsqueda local de cada página.

### 3.5 Exportación de auditoría

- Requiere `audit.view` y `audit.export` (en la política actual de roles,
  solo superadministrador).
- Exporta el mismo filtro visible en `#/auditoria` (búsqueda y módulo) como
  CSV con `fecha,actor,rol,accion,modulo,entidad,entidad_id,motivo,metadata`.
- La propia exportación queda registrada como `audit.export` con recuento,
  filtro de módulo y término de búsqueda.

---

## 4. Modelo de datos (InsForge)

La migración `migrations/20261106040000_analytics_payments.sql` define:

- `payment_transactions` (libro interno de movimientos, con conciliación).
- `payment_payouts` (liquidaciones estimadas por comercio).

Ambas referencian `purchase_orders`, `buyer_profiles`, `commerce_profiles` y
`auth.users`. Tienen RLS habilitado y **acceso directo revocado** para `anon` y
`authenticated`. El cliente solo puede usar funciones `SECURITY DEFINER` que
vuelven a comprobar permisos y escriben auditoría:

| Área | Funciones |
|---|---|
| Analítica | `admin_analytics_report`, `admin_export_analytics` |
| Pagos | `admin_list_payments`, `admin_get_payment`, `admin_payment_metrics`, `admin_list_payment_payouts`, `admin_reconcile_payment` |
| Auditoría | `admin_export_audit` |
| Búsqueda | `admin_global_search` |
| Métricas | `admin_phase5_metrics` |

Helpers internos (ejecución revocada a `public`): `admin_payment_is_reconcilable`,
`admin_payment_counts_as_collected`, `admin_payment_status_label`,
`admin_payment_method_label`, `admin_payment_provider_label`,
`admin_payout_status_label`, `admin_mask_email`, `admin_url_encode`,
`admin_payment_summary` y `admin_payout_summary`.

La migración **no contiene datos de negocio ni secretos**: las tablas se
llenarán desde una pasarela real en una fase posterior.

---

## 5. Permisos utilizados

Se reutiliza el catálogo existente. **No se añadieron permisos nuevos**; esta
fase activa los que estaban reservados.

| Permiso | Uso |
|---|---|
| `payments.view` | Ver el libro, el detalle, las métricas y las liquidaciones |
| `payments.reconcile` | Conciliar y retirar conciliaciones |
| `payments.refund` | Definido; solo muestra el aviso de «no disponible sin pasarela» |
| `payments.configure` | Definido; sin función activa en esta fase |
| `analytics.view` | Ver la analítica |
| `analytics.export` | Exportar la analítica |
| `analytics.pii` | Definido; los informes de esta fase nunca incluyen PII |
| `audit.export` | Exportar la auditoría |

Reparto por rol (Fase 5):

| Rol | Pagos | Analítica | Conciliar | Exportar |
|---|---|---|---|---|
| Superadministrador | Ver | Ver + exportar | Sí | Analítica y auditoría |
| Administrador general | Ver | Ver + exportar | No | Solo analítica |
| Gestor de comercios | No | Ver | No | No |
| Moderador | No | No | No | No |
| Atención | No | No | No | No |
| Analista | Ver | Ver + exportar | No | Solo analítica |
| Finanzas | Ver | Ver | Sí | No |

Ocultar botones en React es solo presentación: cada RPC vuelve a validar el
permiso en el servidor.

---

## 6. Privacidad y seguridad

- **Analítica sin PII**: los informes solo contienen agregados; nunca filas por
  persona. Cada exportación queda auditada.
- **Búsqueda global acotada**: solo metadatos permitidos por los permisos del
  actor, correos enmascarados sin `users.view_pii` y cero indexado de
  contenido de mensajes.
- **Sin pasarela**: ninguna acción de esta fase mueve dinero. La conciliación
  es un registro interno auditado; afirmar que un pago «se ejecutó» sería
  falso.
- **Auditoría**: en producción es append-only y la escribe el servidor. En demo
  vive en `localStorage` y puede alterarse; no debe usarse como evidencia.
- **Acceso a tablas revocado**: todo pasa por funciones `SECURITY DEFINER` con
  comprobación de permisos y `search_path` acotado.
- **Retención**: la política de conservación de movimientos y liquidaciones
  está pendiente de confirmación por el negocio.
- **Comisión**: el 10 % es una referencia de implementación, no una tarifa
  contractual.

---

## 7. Verificación

```bash
npm run lint     # ESLint sin errores
npm test         # 144 pruebas (incluye Fases 1 a 5)
npm run build    # genera dist/index.html y dist/admin.html
```

Pruebas añadidas en Fase 5:

- `src/admin/data/demoRepository.phase5.test.js` — 21 pruebas de analítica
  (rangos, KPIs, serie, top comercios, mezcla de métodos, permisos y
  exportación CSV auditada), pagos (listado, filtros, detalle, métricas,
  conciliación con motivo obligatorio y límites de estado), exportación de
  auditoría, búsqueda global con permisos y enmascaramiento, y métricas del
  panel.
- `src/admin/data/demoRepository.phase2.test.js` — la migración ahora verifica
  la versión 5 del almacén y la presencia de los datos de Fase 5.
- `src/admin/AdminApp.test.jsx` — tres pruebas nuevas: navegación a analítica
  y pagos sin el aviso de módulo pendiente, acceso del analista a ambos
  módulos y bloqueo del rol de soporte.

Verificación manual recomendada en demo:

1. Confirmar que la analítica solo muestra agregados y que el cambio de rango
   recalcula la serie.
2. Exportar analítica y verificar la entrada `analytics.export` en Auditoría.
3. Comprobar que el analista ve pagos pero no puede conciliar.
4. Conciliar y retirar conciliación con `superadmin@demo.local`; revisar la
   trazabilidad en Auditoría.
5. Intentar conciliar un movimiento pendiente y verificar el error explícito.
6. Verificar los avisos permanentes de «Sin pasarela» y de datos simulados.
7. Exportar la auditoría con `superadmin@demo.local` y comprobar que la
   exportación queda registrada.
8. Probar la búsqueda global con distintos roles y verificar que los
   resultados respetan los permisos y enmascaran correos.

---

## 8. Criterios de aceptación de la Fase 5

- [x] Analítica agregada con rangos, serie diaria, top comercios y métodos.
- [x] Informes sin datos personales y exportación CSV auditada.
- [x] Libro interno de pagos de solo lectura con filtros y detalle.
- [x] Conciliación manual con motivo obligatorio, trazabilidad y límites de
      estado.
- [x] Liquidaciones simuladas nunca presentadas como transferencias reales.
- [x] Avisos explícitos y permanentes de «sin pasarela» y de simulación.
- [x] Exportación de auditoría auditada y restringida a `audit.export`.
- [x] Búsqueda global de metadatos que respeta permisos, enmascara PII y no
      indexa contenido de mensajes.
- [x] Métricas y avisos de atención de Fase 5 en el panel filtrados por
      permisos.
- [x] Rutas `#/analitica` y `#/pagos` funcionales; sin módulos pendientes.
- [x] Migración SQL de Fase 5 escrita y **no ejecutada**.
- [x] Lint, 144 pruebas y build en verde.
- [ ] Modo InsForge probado contra un proyecto real (bloqueado por
      credenciales).
- [ ] Pasarela de pagos conectada y política de comisiones confirmada.
- [ ] Máquinas de estados, motivos y catálogo de comisión confirmados por el
      negocio.
