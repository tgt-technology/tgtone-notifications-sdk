# @tgtone/notifications-sdk

SDK para el sistema de notificaciones de TGT One.

Crea, lista, marca como leídas y elimina notificaciones desde cualquier app del ecosistema.

**Modelo:** 1 notificación en BD, filtro en lectura. Broadcast (1:N) por defecto. Targeting app-specific via metadata JSON.

---

## Stack

- **Runtime**: Node.js / Bun
- **Formato**: CommonJS (`require()`) — ~~ESM~~ corregido en v1.0.1
- **Lenguaje**: TypeScript (tipos incluidos)
- **HTTP**: `fetch` nativo — **0 dependencias externas**
- **React hook**: export `@tgtone/notifications-sdk/react` (opcional, React 18+)

---

## Instalación

### npm

```bash
npm install @tgtone/notifications-sdk
```

### Bun

```bash
bun add @tgtone/notifications-sdk
```

### Yarn

```bash
yarn add @tgtone/notifications-sdk
```

---

## Quick Start

### 1. Desde un backend (BFF / API)

```typescript
import { NotificationsAPI } from '@tgtone/notifications-sdk';

// Instancia con el JWT del usuario que hace la request
const api = new NotificationsAPI({
  apiUrl: 'https://tgtone-console-backend.run.app',
  getToken: () => req.headers.authorization?.replace('Bearer ', '') || null,
});

// Crear notificación (broadcast 1:N)
await api.create({
  appId: 'baco',
  title: 'Trasiego completado',
  message: 'Barrica B-001 lista para el siguiente proceso',
  type: 'success',
  actionUrl: '/barricas/B-001',
  metadata: { barricaId: 'B-001' },
});
```

### 2. Desde el frontend (React)

```typescript
import { NotificationsAPI } from '@tgtone/notifications-sdk';
import { useNotifications } from '@tgtone/notifications-sdk/react';
import { TGTAuthClient } from '@tgtone/auth-sdk';

const api = new NotificationsAPI({
  apiUrl: import.meta.env.VITE_CORE_API_URL || '/api',
  getToken: () => TGTAuthClient.getStoredToken(),
});

function NotifBell() {
  const { unreadCount, markAllAsRead } = useNotifications({
    api,
    appId: 'baco',
    limit: 5,
  });

  return (
    <button onClick={markAllAsRead}>
      Campana ({unreadCount})
    </button>
  );
}
```

---

## API completa

### `new NotificationsAPI(config)`

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `apiUrl` | `string` | **requerido** | URL base del Core API. ⚠️ **Sin `/api` al final** — el SDK agrega `/api/v1/notifications` automáticamente. Ej: `https://tgtone-console-backend.run.app` |
| `getToken` | `() => string \| null` | **requerido** | Función que retorna el JWT (sin "Bearer") |
| `onUnauthorized` | `() => Promise<string \| null>` | `undefined` | **(Opcional)** Callback para renovar el token cuando una petición devuelve 401. Típicamente conecta a `authClient.refreshAccessToken()` del auth-sdk y retorna el token renovado. Sin él, el SDK lanza `NotificationsError` en 401 (comportamiento legacy). |
| `timeout` | `number` | `30000` | Timeout por request en ms |
| `headers` | `Record<string, string>` | `{}` | Headers adicionales |
| `debug` | `boolean` | `false` | Logs de debug en consola |

---

### `create(data)` → `Notification`

Crear una notificación. **Siempre es 1 registro en BD** (broadcast 1:N). No se multiplica por destinatarios.

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `appId` | `string` | **requerido** | ID de la app ("baco", "nexo", "crm", etc.) |
| `title` | `string` | **requerido** | Título visible |
| `message` | `string` | **requerido** | Mensaje |
| `type` | `'info' \| 'success' \| 'warning' \| 'error'` | `'info'` | Tipo visual |
| `priority` | `'low' \| 'normal' \| 'high' \| 'urgent'` | `'normal'` | Prioridad (afecta orden) |
| `targetUserId` | `string \| null` | `null` | null = broadcast. String = solo ese usuario (caso raro) |
| `targetRole` | `string \| null` | `null` | Deprecado. Usar `metadata` para targeting app-specific |
| `actionUrl` | `string \| null` | `null` | Ruta al hacer clic (ej: "/barricas/B-001") |
| `metadata` | `Record<string, unknown>` | `null` | Targeting app-specific. Indexado con GIN. Ver sección **Targeting** |

**Notas:**
- `tenantId` y `createdBy` se toman del JWT automáticamente
- La notificación expira a los 7 días (broadcast) o cuando el usuario lea (targeted)
- El backend valida `appId`, `title` y `message` como strings no vacíos

**Ejemplo completo:**

```typescript
const notif = await api.create({
  appId: 'nexo',
  title: 'Nivel bajo detectado',
  message: 'La barrica B-042 tiene menos del 20% de capacidad',
  type: 'warning',
  priority: 'high',
  actionUrl: '/barricas/B-042',
  metadata: { barricaId: 'B-042', nivel: 18 },
});
```

---

### `getNotifications(filters?)` → `NotificationsResponse`

Listar notificaciones del usuario. Por defecto retorna solo **no leídas** y **no eliminadas**.

| Filtro | Tipo | Default | Descripción |
|--------|------|---------|-------------|
| `appId` | `string` | — | Filtrar por app |
| `unreadOnly` | `boolean` | `true` | Solo no leídas |
| `includeDeleted` | `boolean` | `false` | Incluir eliminadas |
| `skip` | `number` | `0` | Offset |
| `take` | `number` | `50` | Límite |
| `metadata` | `MetadataFilter` | — | Filtrar broadcasts por metadata. Ver **Targeting** |

**Ejemplo con metadata:**

```typescript
const result = await api.getNotifications({
  appId: 'nexo',
  metadata: { teamId: ['soporte', 'ti'] }, // OR: soporte O ti
  unreadOnly: true,
  take: 20,
});
```

**Respuesta:**

```typescript
{
  notifications: [{
    id: string,
    appId: string,
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'error',
    priority: 'low' | 'normal' | 'high' | 'urgent',
    actionUrl: string | null,
    metadata: Record<string, unknown> | null,
    createdAt: string,            // ISO 8601
    isRead: boolean,
    readAt: string | null,
    isDeleted: boolean,
    deletedAt: string | null,
  }],
  total: number,
  skip: number,
  take: number,
}
```

---

### `getHistory(params)` → `NotificationsResponse`

Historial paginado de notificaciones. Endpoint separado del backend (no confundir con `getNotifications`).

```typescript
const history = await api.getHistory({
  appId: 'nexo',
  metadata: { teamId: 'soporte' },
  page: 1,
  pageSize: 50,
  includeDeleted: false,
});
```

---

### `getUnreadCount(appId?, metadata?)` → `UnreadCountResponse`

Contador de no leídas para badge. Soporta metadata filter.

```typescript
const { count } = await api.getUnreadCount('nexo', { teamId: 'soporte' });
// count → 3 (no leídas del equipo soporte)
```

---

### `markAsRead(notificationId)` → `{ success: boolean }`

```typescript
await api.markAsRead('notif-uuid-123');
```

---

### `markAllAsRead(appId?)` → `MarkAllReadResponse`

Marca TODAS las no leídas como leídas. Opcionalmente filtrado por app (no por metadata — es intencional).

```typescript
const result = await api.markAllAsRead('nexo');
console.log(`${result.markedCount} notificaciones marcadas`);
```

---

### `delete(notificationId)` → `{ success: boolean }`

Soft delete. Solo el creador o el usuario objetivo pueden eliminar.

```typescript
await api.delete('notif-uuid-123');
```

---

### `cleanup()` → `CleanupResponse`

Limpia notificaciones expiradas. Solo requiere autenticación (JWT válido).

**Reglas:**
- **Targeted** (targetUserId != null): se borran cuando ese usuario leyó hace +7 días
- **Broadcast** (targetUserId = null): se borran cuando expira su fecha (7 días)
- **Soft-deleted**: se borran después de 7 días de retención
- **Las no leídas nunca se borran automáticamente**

```typescript
const result = await api.cleanup();
// { deletedCount: 5, readExpiredCount: 3, broadcastExpiredCount: 1, ... }
```

---

## Targeting de notificaciones

El sistema usa **1 registro en BD por acción** (broadcast 1:N). El filtro se aplica en lectura, no en creación.

### Broadcast (todos los usuarios del tenant+app)

```typescript
await api.create({
  appId: 'nexo',
  title: 'Mantenimiento programado',
  // Sin metadata → visible para todos los usuarios del tenant+app
});
```

### Usuario específico (caso raro 1:1)

```typescript
await api.create({
  appId: 'nexo',
  title: 'Te asignaron el ticket SUP-001',
  targetUserId: 'user-uuid-123',  // solo este usuario
});
```

### Por equipo (metadata app-specific)

```typescript
// Creación: la app agrega metadata con el ID del equipo
await api.create({
  appId: 'nexo',
  title: 'Ticket SUP-001 asignado',
  message: 'El ticket fue asignado al equipo Soporte',
  metadata: { teamId: 'soporte' },  // ← app-specific
});

// Lectura: el usuario pasa sus equipos al filtro
const result = await api.getNotifications({
  appId: 'nexo',
  metadata: { teamId: ['soporte', 'ti'] },  // OR: soporte O ti
});
```

**¿Cómo funciona?**

```
CREACIÓN: 1 notif en BD con metadata: { teamId: 'soporte' }
LECTURA:  El backend filtra:
  WHERE targetUserId = 'pedro'           → personales
     OR (targetUserId IS NULL AND (       → broadcasts
          metadata IS NULL                → sin metadata = todos ven
          OR metadata->'teamId' = 'soporte'  → coincide con equipo
          OR metadata->'teamId' = 'ti'
        ))
```

**Reglas:**
- Broadcasts sin metadata → visibles para todos (legacy)
- Broadcasts con metadata → visibles solo si coinciden con al menos un valor del filtro
- Notificaciones personales (targetUserId) → siempre visibles sin importar metadata
- La metadata puede tener cualquier estructura: `{ teamId, projectId, priority, etc. }`

### Metadata multi-valor (OR)

```typescript
// Un usuario puede pertenecer a varios equipos
const result = await api.getNotifications({
  appId: 'nexo',
  metadata: {
    teamId: ['soporte', 'ti'],      // OR: teamId = soporte O ti
    projectId: ['proyecto-alfa'],    // OR plano con teamId
  },
  // El OR es plano entre todos los valores de todas las keys
});
```

---

## Hook React: `useNotifications`

**Export:** `@tgtone/notifications-sdk/react`

Hook que encapsula polling, badge count, mark read y delete. **No depende de ningún contexto de app** — recibe la instancia del SDK ya configurada.

### Props

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `api` | `NotificationsAPI` | **requerido** | Instancia del SDK (ya configurada con apiUrl + getToken) |
| `appId` | `string` | **requerido** | appId a consultar |
| `filter` | `UseNotificationsFilter` | — | Filtro de targeting: `{ metadata: { teamId: [...] } }` |
| `limit` | `number` | `5` | Cantidad de notificaciones a mostrar |
| `useHistory` | `boolean` | `false` | true = historial completo (incluye leídas + eliminadas) |
| `pollingInterval` | `number` | `15000` | ms entre polls (solo en modo normal) |

### Retorno

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `notifications` | `UseNotificationItem[]` | Lista mapeada (`read` en vez de `isRead`, `createdAt` como Date) |
| `unreadCount` | `number` | Conteo de no leídas |
| `isLoading` | `boolean` | Cargando primera vez |
| `error` | `string \| null` | Mensaje de error |
| `markAsRead(id)` | `() => Promise<void>` | Marcar + optimistc update local |
| `markAllAsRead()` | `() => Promise<void>` | Marcar todas + optimistc update local |
| `deleteNotification(id)` | `() => Promise<void>` | Eliminar + optimistc update local |
| `refresh()` | `() => Promise<void>` | Forzar recarga manual |

### Ejemplo — NotificationCenter por equipo

```typescript
import { useState } from 'react';
import { NotificationsAPI } from '@tgtone/notifications-sdk';
import { useNotifications } from '@tgtone/notifications-sdk/react';
import { TGTAuthClient } from '@tgtone/auth-sdk';

// La app crea la instancia del SDK (una vez, al cargar)
const api = new NotificationsAPI({
  apiUrl: import.meta.env.VITE_CORE_API_URL || '/api',
  getToken: () => TGTAuthClient.getStoredToken(),
});

export function NotificationCenter({ userId, teams }: { userId: string; teams: string[] }) {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } = useNotifications({
    api,
    appId: 'nexo',
    filter: {
      metadata: { teamId: teams },  // ← la app pasa sus equipos
    },
    limit: 5,
  });

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative">
        <BellIcon />
        {unreadCount > 0 && (
          <Badge variant="destructive" className="absolute -top-1 -right-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </button>

      {open && (
        <div className="w-80">
          {unreadCount > 0 && (
            <button onClick={markAllAsRead}>✓ Marcar todas</button>
          )}
          {isLoading ? (
            <p>Cargando...</p>
          ) : notifications.length === 0 ? (
            <p>No tienes notificaciones</p>
          ) : (
            notifications.map(n => (
              <div key={n.id} onClick={() => markAsRead(n.id)}
                   className={!n.read ? 'bg-muted/30' : ''}>
                <strong>{n.title}</strong>
                <p className="text-sm text-muted-foreground">{n.message}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

---

## Integración desde backend (BFF)

Cada app necesita un servicio para enviar notificaciones:

```typescript
// services/notifications.service.ts
import { NotificationsAPI } from '@tgtone/notifications-sdk';

const CORE_API_URL = process.env.CORE_API_URL!;

export function createNotificationsService(req: { headers: { authorization?: string } }) {
  const token = req.headers.authorization?.replace('Bearer ', '') || null;
  return new NotificationsAPI({
    apiUrl: CORE_API_URL,
    getToken: () => token,
  });
}
```

**Uso en un controller:**

```typescript
import { createNotificationsService } from '../services/notifications.service';

app.post('/api/trasiegos', async (req, res) => {
  const trasiego = await crearTrasiego(req.body);
  const notifService = createNotificationsService(req);

  // 1 notif en BD, toda la app la ve (broadcast)
  await notifService.create({
    appId: 'baco',
    title: 'Trasiego completado',
    message: `Barrica ${trasiego.barricaId} lista`,
    type: 'success',
    actionUrl: `/barricas/${trasiego.barricaId}`,
    metadata: { barricaId: trasiego.barricaId },
  });

  res.json(trasiego);
});
```

> **Nota:** El token JWT debe pertenecer a un usuario del tenant. Para notificaciones de sistema (sin usuario), se requiere API Key. Contacta al equipo de core.

---

## Manejo de errores

Toda llamada puede lanzar `NotificationsError`:

```typescript
import { NotificationsAPI, NotificationsError } from '@tgtone/notifications-sdk';

try {
  await api.create({ appId: 'baco', title: '', message: '' });
} catch (err) {
  if (err instanceof NotificationsError) {
    switch (err.statusCode) {
      case 401:
        console.log('Token inválido o expirado'); break;
      case 400:
        console.log('Error de validación:', err.details); break;
      case 404:
        console.log('No encontrado'); break;
      default:
        console.log(`Error ${err.statusCode}: ${err.message}`);
    }
  }
}
```

| Método helper | Descripción |
|---------------|-------------|
| `err.isUnauthorized()` | `statusCode === 401` |
| `err.isNotFound()` | `statusCode === 404` |
| `err.isValidationError()` | `statusCode === 400` |

---

## Buenas prácticas

1. **Usar `TGTAuthClient.getStoredToken()`** en lugar de `localStorage.getItem('tgtone_auth_token')` para obtener el token — si auth-sdk cambia la key o mecanismo de storage, tu app se adapta automáticamente sin cambios
2. **Siempre pasar `appId`** en filtros — cada app tiene su espacio de notificaciones
3. **Usar `actionUrl`** para que el usuario navegue al recurso
4. **Metadata para targeting app-specific** — cada app define sus propios filtros
5. **No abusar de `targetUserId`** — el sistema es 1:N, no 1:1. Preferir broadcast + metadata
6. **Polling 15s default** — eficiente (~1920 requests/día por usuario con badge)
7. **Para estados vacíos**, mostrar mensaje claro ("No tienes notificaciones")
8. **Para críticas**, considerar sonido/vibración cuando `type: 'error'` o `priority: 'urgent'`

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run build` | Compilar TypeScript a `dist/` |
| `npm run dev` | Compilar en modo watch |
| `npm run clean` | Eliminar `dist/` |
| `npm test` | Ejecutar tests (bun test) |

---

## Migración desde @tgtone/core-sdk

```typescript
// ANTES
import { TGTCoreSDK } from '@tgtone/core-sdk';
const core = new TGTCoreSDK({ apiUrl, getToken });
await core.notifications.create({ appId, title, message });

// DESPUÉS
import { NotificationsAPI } from '@tgtone/notifications-sdk';
const api = new NotificationsAPI({ apiUrl, getToken });
await api.create({ appId, title, message });
```

---

## Arquitectura: ¿qué va en backend y qué en frontend?

El SDK se usa **en ambos lados**, pero con responsabilidades distintas.

### Backend (BFF) → Crear notificaciones

Las notificaciones que representan **eventos de negocio** (trasiego completado, stock bajo, ticket asignado) se crean **exclusivamente desde el backend** de cada app. El frontend no decide ni ejecuta la creación de notificaciones de negocio.

**¿Por qué no desde el frontend?**

| Motivo | Explicación |
|--------|-------------|
| **Seguridad** | El backend inyecta `tenantId` y `createdBy` desde el JWT ya verificado. Si el frontend creara notificaciones, un usuario con DevTools podría forjar notificaciones falsas cambiando title, type, message. |
| **Atomicidad** | La notificación se crea si y solo si la operación de negocio se completó. Sin ventana de inconsistencia entre "el dato se guardó" y "aviso a los usuarios". |
| **Eventos async** | Muchas notificaciones (suscripción expiró, integración caída, stock mínimo) se originan en **workers, schedulers o webhooks** donde no hay frontend presente. |
| **Trazabilidad** | `createdBy` se registra con el usuario que ejecutó la acción. Si el frontend creara la notif, sería el token del usuario actual, no de quien originó el evento. |

**Flujo correcto:**

```
Frontend            Backend (BFF)                   Core API
   │                    │                              │
   │  POST /api/accion  │                              │
   │───────────────────>│                              │
   │                    │  Ejecuta operación           │
   │                    │  api.create({ appId, ... })  │
   │                    │─────────────────────────────>│
   │                    │                              1 registro en BD
   │  200 OK            │                              │
   │<───────────────────│                              │
```

El backend llama al SDK **después** de ejecutar la operación, como parte del mismo handler.

### Frontend (React) → Leer y mostrar

El frontend usa el SDK **solo para lectura y acciones del usuario sobre sus propias notificaciones**:

| Operación | Método del SDK | ¿Por qué acá? |
|-----------|---------------|---------------|
| Badge con conteo | `getUnreadCount()` | El usuario quiere ver cuántas notis tiene sin recargar |
| Listar últimas N | `getNotifications()` | Campana/popover con las últimas 5 notificaciones |
| Marcar como leída | `markAsRead()` | Acción del usuario sobre su propia notificación |
| Marcar todas leídas | `markAllAsRead()` | Acción del usuario, no afecta a otros |
| Eliminar (soft delete) | `delete()` | El usuario elimina su propia notificación |
| Historial paginado | `getHistory()` | Página dedicada con todo el historial |

**No se usa en frontend para crear notificaciones de negocio.**

### Configuración de CORE_API_URL

El SDK necesita la URL del Core API. Dónde se configura depende del lado:

**En backend (BFF):**
```typescript
const CORE_API_URL = process.env.CORE_API_URL!;     // Node.js
// o
const CORE_API_URL = Bun.env.CORE_API_URL!;          // Bun
```

Configurar como variable de entorno en el servidor. Ejemplo `.env`:
```bash
CORE_API_URL=https://tgtone-console-backend.run.app
```

> ⚠️ `apiUrl` del SDK **no debe incluir `/api`** al final. El SDK concatena `/api/v1/notifications` automáticamente. Ej: con `CORE_API_URL=https://tgtone-console-backend.run.app`, la URL final será `https://tgtone-console-backend.run.app/api/v1/notifications`.

**En frontend (React):**
```typescript
const apiUrl = import.meta.env.VITE_CORE_API_URL || '/api';
```

Usar el prefijo `VITE_` (Vite) o `REACT_APP_` (CRA). Si el frontend se sirve desde el mismo dominio que el backend (proxy inverso), se puede usar `'/api'` como ruta relativa.

> **Frontend y CORS:** Si el frontend apunta directamente al Core API (sin pasar por un proxy BFF), el Core API debe tener CORS habilitado para el dominio del frontend. Verificar con el equipo de infra si es necesario.

---

## Tipos exportados

```typescript
import type {
  Notification,           // Notificación completa (respuesta del backend)
  CreateNotificationDto,  // DTO para crear
  NotificationFilters,    // Filtros para listar (incluye metadata)
  GetHistoryParams,       // Parámetros para historial paginado
  NotificationsResponse,  // Respuesta paginada
  UnreadCountResponse,    // { count: number }
  MarkAllReadResponse,    // { success, markedCount }
  CleanupResponse,        // { success, deletedCount, ... }
  MetadataFilter,         // { [key: string]: string | string[] }
  NotificationType,       // 'info' | 'success' | 'warning' | 'error'
  NotificationPriority,   // 'low' | 'normal' | 'high' | 'urgent'
} from '@tgtone/notifications-sdk';
```

---

## Publicar en npm

```bash
# 1. Build
npm run build

# 2. Verificar que empaqueta solo lo necesario
npm pack --dry-run

# 3. Publicar
npm publish

# Para publicar una nueva versión:
# 1. Cambiar version en package.json (patch | minor | major)
# 2. Actualizar CHANGELOG.md
# 3. npm run build
# 4. npm publish
```

> ⚠️ Requiere `npm login` previo con una cuenta que tenga acceso al paquete `@tgtone/notifications-sdk`.

---

## Licencia

MIT — TGT Technology
