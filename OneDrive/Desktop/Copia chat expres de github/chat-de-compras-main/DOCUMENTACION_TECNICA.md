
# Documentación Técnica Oficial - Chat Express

**Fecha de creación**: Junio 2026  
**Versión de la aplicación**: 0.0.0  
**Autor**: Equipo de Desarrollo Chat Express

---

## 0. Índice Interactivo

1. [Resumen Ejecutivo de la Arquitectura](#1-resumen-ejecutivo-de-la-arquitectura)
2. [Análisis de `ChatContext.jsx`](#2-análisis-de-chatcontextjsx)
3. [Análisis de `theme.config.js`](#3-análisis-de-themeconfigjs)
4. [Mantenimiento del Documento](#4-mantenimiento-del-documento)

---

## 1. Resumen Ejecutivo de la Arquitectura

Chat Express es una aplicación de marketplace móvil-first de chat en tiempo real (simulado) desarrollada con React + Vite + Tailwind CSS + Capacitor. La arquitectura se basa en:

- **Contexto centralizado**: `ChatContext.jsx` gestiona toda la lógica y estados compartidos de los chats para evitar prop drilling.
- **Sistema de diseño unificado**: `theme.config.js` centraliza tokens de diseño (colores, espaciados, sombras, etc.) para garantizar coherencia visual.
- **Estructura modular**: Separación clara entre vistas de usuario final y vistas de comercio.

---

## 2. Análisis de `ChatContext.jsx`

### 2.1 Propósito Fundamental

`ChatContext.jsx` es el **nervio central de la aplicación** que implementa el patrón Context API de React para:
- Eliminar el prop drilling de estados y funciones relacionadas con los chats.
- Centralizar la lógica de negocio compartida entre vistas de usuario y comercio.
- Garantizar la consistencia de datos en toda la experiencia de chat.

### 2.2 Estados Centralizados

| Estado | Tipo | Descripción |
|--------|------|-------------|
| `messages` | Array | Historial de mensajes del chat (incluye remitente: `buyer`, `seller`, `system`). |
| `inputText` | String | Valor del input de texto del chat. |
| `timeLeft` | Number | Contador regresivo en segundos para cierre automático del chat (inicial: 300s = 5min). |
| `showHistory` | Boolean | Controla la visibilidad del modal de historial del comprador (solo para comercio). |
| `showDeliveryOptions` | Boolean | Controla la visibilidad de la pregunta "Ya llegó tu producto?". |
| `showShippingForm` | Boolean | Controla la visibilidad del formulario de envío (solo para usuario). |
| `sellerStep` | String | Estado del flujo del vendedor: `initial`, `confirmed`, `shipped`. |
| `buyerHistory` | Object | Datos mock de reputación del comprador (rating, total de compras, reviews). |
| `shippingData` | Object | Datos del formulario de envío (nombre, teléfono, dirección, foto, etc.). |
| `messagesEndRef` | Ref | Referencia para scroll automático al final del chat. |

### 2.3 Implementación del Proveedor y Consumo

#### Proveedor (`ChatProvider`)
Envuelve las rutas de chat para exponer el contexto a todos los componentes hijos.

#### Hook de Consumo (`useChat`)
Hook personalizado que simplifica el acceso al contexto.

**Ejemplo de uso en página de usuario**:
```jsx
import { useChat } from '../../context/ChatContext';

export const UserChatPage = () => {
  const { messages, sendMessage, shippingData, setShippingData } = useChat();
  // Usa los estados y funciones
};
```

**Ejemplo de uso en página de comercio**:
```jsx
import { useChat } from '../../context/ChatContext';

export const CommerceChatPage = () => {
  const { buyerHistory, showHistory, setShowHistory, handleSellerAction } = useChat();
  // Usa los estados y funciones
};
```

### 2.4 Funciones de Actualización de Estado y Flujo de Datos

| Función | Propósito |
|---------|-----------|
| `sendMessage(senderRole, autoReplyRole)` | Añade un nuevo mensaje al historial y simula respuesta automática si se especifica el rol. |
| `handleSellerAction()` | Gestiona el flujo del vendedor (marcar como vendido, marcar como enviado). |
| `handleProductArrivedYes(navigateFunction, chatId)` | Redirige a la página de cierre para calificar al vendedor. |
| `handleProductArrivedNo(navigateFunction)` | Redirige al chat de soporte. |
| `handleShippingSubmit(e)` | Envía el formulario de envío y muestra la pregunta de llegada del producto. |
| `handleFileChange(e)` | Gestiona la carga de la foto del domicilio en base64. |
| `formatTime(seconds)` | Formatea el contador regresivo a `MM:SS`. |
| `scrollToBottom()` | Hace scroll automático al final del chat cuando se añaden mensajes. |

---

## 3. Análisis de `theme.config.js`

### 3.1 Definición de la Paleta de Colores

La paleta se selecciona para cumplir con **WCAG 2.1 AA** (alto contraste y legibilidad) y seguir una estética tech-futurista con glassmorphism:

| Color | Código Hex | Tipo | Uso Principal |
|-------|------------|------|---------------|
| Fondo Principal | `#E7E7E7` | Base | Fondo de toda la aplicación. |
| Deep Purple | `#4B227A` | Secundario | Bordes, gradientes y estados activos. |
| Steel Blue | `#0197AF` | Acento Técnico | Iconos, elementos destacados y estados focus. |
| Neon Mint | `#00EED0` | CTA (Call to Action) | Botones principales y sombras neon. |

### 3.2 Estructura del Sistema de Diseño

El archivo centraliza todos los tokens de diseño para mantener la coherencia:

#### 3.2.1 Redondeos (`BORDER_RADIUS`)
Valores predefinidos para `border-radius` de elementos.

#### 3.2.2 Sombras (`SHADOWS`)
Incluye sombras sutiles y la sombra neon especial para botones CTA.

#### 3.2.3 Espaciados (`SPACING`)
Valores predefinidos para `padding` y `margin`.

#### 3.2.4 Transiciones (`TRANSITIONS`)
Duraciones estándar para animaciones suaves.

#### 3.2.5 Estilos Base de Componentes (`THEME`)
Configuración predefinida para:
- **Botones**: Base, primario (neon), secundario (glassmorphism), éxito.
- **Tarjetas**: Base con glassmorphism y bordes sutiles.
- **Inputs**: Base con glassmorphism y estados focus.

### 3.3 Mecanismo de Aplicación del Estilo Global

1. Los tokens se exportan desde `theme.config.js`.
2. Los componentes importan y utilizan estos tokens.
3. Los tokens se integran con Tailwind CSS para una implementación rápida.

**Ejemplo de uso en un componente**:
```jsx
import { THEME, COLORS } from '../../theme.config';

const MyButton = () => (
  <button className={`${THEME.button.base} ${THEME.button.primary}`}>
    Hacer Pedido
  </button>
);
```

### 3.4 Compatibilidad y Relación con Estilos Globales

- `theme.config.js` complementa los estilos globales de Tailwind CSS definidos en `src/index.css`.
- Actualmente no hay modo claro/oscuro implementado, pero la estructura está lista para añadirlo en el futuro.

---

## 4. Mantenimiento del Documento

| Fecha | Cambio Realizado | Autor |
|-------|-------------------|-------|
| Junio 2026 | Documentación inicial completa | Equipo de Desarrollo Chat Express |

### 4.1 Instrucciones para Actualizaciones

1. Modifica el documento **solo si hay cambios significativos en la arquitectura**.
2. Añade una nueva fila a la tabla de mantenimiento con la fecha y el cambio.
3. Si creas nuevos archivos clave, añade una sección nueva al índice y al cuerpo del documento.

