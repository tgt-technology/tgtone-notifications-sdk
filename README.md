# @tgtone/notifications-sdk

SDK para el sistema de notificaciones de TGT One.

Permite crear, listar, marcar como leídas y eliminar notificaciones desde cualquier app del ecosistema (Baco, CRM, POS, etc.).

---

## Stack

- **Runtime**: Node.js / Bun (compatible con ambos)
- **Formato**: ESM (`"type": "module"`)
- **Lenguaje**: TypeScript (tipos incluidos)
- **HTTP**: `fetch` nativo — **0 dependencias externas**
- **React hook**: export `@tgtone/notifications-sdk/react` (opcional, React 18+)

---

## Instalación

```bash
npm install @tgtone/notifications-sdk
```

---

## Quick Start

### 1. Desde un backend (BFF / API)

```typescript
import { NotificationsAPI } from '@tgtone/notifications-sdk';

// Instancia con el token JWT del usuario que hace la request
const api = new NotificationsAPI({
  apiUrl: 'https://tgtone-console-backend.run.app/api',
  getToken: () => req.headers.authorization?.replace('Bearer ', '') || null,
});

// Enviar notificación de éxito
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

function NotifBell() {
  const api = new NotificationsAPI({
    apiUrl: 'https://tgtone-console-backend.run.app/api',
    getToken: () => localStorage.getItem('tgtone_auth_token'),
  });

  const { unreadCount, notifications, markAsRead, isLoading } = useNotifications({
    api,
    appId: 'baco',               // ← tu appId
    unreadOnly: true,             // solo no leídas
    pollingInterval: 15000,       // actualizar cada 15s
  });

  return (
    <button onClick={() => markAllAsRead()}>
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
| `apiUrl` | `string` | **requerido** | URL base del Core API (ej: `https://tgtone-console-backend.run.app/api`) |
| `getToken` | `() => string \| null` | **requerido** | Función que retorna el JWT (sin "Bearer") |
| `timeout` | `number` | `30000` | Timeout por request en ms |
| `headers` | `Record<string, string>` | `{}` | Headers adicionales para todas las requests |
| `debug` | `boolean` | `false` | Logs de debug en consola |

---

### `create(data)` → `Notification`

Crear una notificación.

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `appId` | `string` | **requerido** | ID de la app ("baco", "crm", "pim", etc.) |
| `title` | `string` | **requerido** | Título visible |
| `message` | `string` | **requerido** | Mensaje |
| `type` | `'info' \| 'success' \| 'warning' \| 'error'` | `'info'` | Tipo visual |
| `priority` | `'low' \| 'normal' \| 'high' \| 'urgent'` | `'normal'` | Prioridad (afecta orden) |
| `targetUserId` | `string \| null` | `null` | null = broadcast a todo el tenant+app. String = solo ese usuario |
| `targetRole` | `string \| null` | `null` | null = todos los roles. String = solo ese rol (ej: "admin") |
| `actionUrl` | `string \| null` | `null` | Ruta a la que navegar al hacer clic (ej: "/barricas/B-001") |
| `metadata` | `Record<string, unknown>` | `null` | Datos adicionales (ej: `{ barricaId: "B-001" }`) |

**Notas:**
- `tenantId` y `createdBy` se toman del JWT automáticamente
- La notificación expira automáticamente a los 7 días (broadcast) o cuando el usuario la lea (targeted)
- El backend valida `appId`, `title` y `message` como strings no vacíos

**Ejemplo completo:**

```typescript
const notif = await api.create({
  appId: 'baco',
  title: 'Nivel bajo detectado',
  message: 'La barrica B-042 tiene menos del 20% de capacidad',
  type: 'warning',
  priority: 'high',
  targetRole: 'admin',
  actionUrl: '/barricas/B-042',
  metadata: { barricaId: 'B-042', nivel: 18 },
});
```

---

### `getNotifications(filters?)` → `NotificationsResponse`

Listar notificaciones. Por defecto retorna solo **no leídas** y **no eliminadas**, paginado de a 50.

| Filtro | Tipo | Default | Descripción |
|--------|------|---------|-------------|
| `appId` | `string` | — | Filtrar por app |
| `unreadOnly` | `boolean` | `true` | Solo no leídas |
| `includeDeleted` | `boolean` | `false` | Incluir eliminadas (para historial) |
| `skip` | `number` | `0` | Offset |
| `take` | `number` | `50` | Límite |

**Ejemplo:**

```typescript
const result = await api.getNotifications({
  appId: 'baco',
  unreadOnly: false,     // incluir leídas
  take: 20,              // primeras 20
});

console.log(`${result.total} notificaciones en total`);
for (const n of result.notifications) {
  console.log(`[${n.type}] ${n.title} — ${n.isRead ? 'leída' : 'no leída'}`);
}
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

### `getHistory(filters?)` → `NotificationsResponse`

Obtener historial completo (incluye leídas + eliminadas). Es un wrapper que fuerza `unreadOnly=false` e `includeDeleted=true`.

```typescript
const historial = await api.getHistory({
  appId: 'baco',
  take: 100,
});
```

---

### `getUnreadCount(appId?)` → `UnreadCountResponse`

Contador de notificaciones no leídas para el badge de la campana.

```typescript
const { count } = await api.getUnreadCount('baco');
// count → 3
```

---

### `markAsRead(notificationId)` → `{ success: boolean }`

Marcar una notificación como leída.

```typescript
await api.markAsRead('notif-uuid-123');
```

---

### `markAllAsRead(appId?)` → `MarkAllReadResponse`

Marcar todas las no leídas como leídas. Opcionalmente filtrado por app.

```typescript
const result = await api.markAllAsRead('baco');
console.log(`${result.markedCount} notificaciones marcadas`);
```

---

### `delete(notificationId)` → `{ success: boolean }`

Eliminar una notificación (soft delete). Solo el creador puede eliminar.
Las notificaciones eliminadas por el sistema (sin `createdBy`) solo pueden ser eliminadas por el usuario objetivo.

```typescript
await api.delete('notif-uuid-123');
```

---

### `cleanup()` → `CleanupResponse`

Limpiar notificaciones expiradas. **Requiere rol admin en "console"**.

Reglas de limpieza:
- **Notificaciones dirigidas** (targetUserId != null): se borran cuando ese usuario leyó hace +7 días
- **Notificaciones broadcast** (targetUserId = null): se borran cuando expira su fecha (7 días desde creación)
- **Soft-deleted**: se borran después de 7 días de retención
- **Las no leídas nunca se borran automáticamente**

```typescript
const result = await api.cleanup();
// { deletedCount: 5, readExpiredCount: 3, broadcastExpiredCount: 1, softDeletedCount: 1, ... }
```

---

## Hook React: `useNotifications`

**Export:** `@tgtone/notifications-sdk/react`

Hook que encapsula polling, badge count, mark read y delete para cualquier app.

### Props

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `api` | `NotificationsAPI` | **requerido** | Instancia del SDK |
| `appId` | `string` | **requerido** | appId a consultar |
| `useHistory` | `boolean` | `false` | true = historial completo |
| `includeDeleted` | `boolean` | `false` | true = incluir eliminadas |
| `unreadOnly` | `boolean` | `false` | true = solo no leídas |
| `pollingInterval` | `number` | `15000` | ms entre polls (solo en modo normal, no historial) |

### Retorno

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `notifications` | `UseNotificationItem[]` | Lista mapeada (`read` en vez de `isRead`, `createdAt` como Date) |
| `unreadCount` | `number` | Conteo de no leídas |
| `isLoading` | `boolean` | Cargando primera vez |
| `error` | `string \| null` | Mensaje de error |
| `markAsRead(id)` | `() => Promise<void>` | Marcar + optimistc update |
| `markAllAsRead()` | `() => Promise<void>` | Marcar todas + optimistc update |
| `deleteNotification(id)` | `() => Promise<void>` | Eliminar + optimistc update (oculta o marca isDeleted según modo) |
| `refresh()` | `() => Promise<void>` | Forzar recarga manual |

### Ejemplo — NotificationCenter (campana + popover + badge)

```typescript
import { useState } from 'react';
import { NotificationsAPI } from '@tgtone/notifications-sdk';
import { useNotifications } from '@tgtone/notifications-sdk/react';

const api = new NotificationsAPI({
  apiUrl: import.meta.env.VITE_CORE_API_URL || '/api',
  getToken: () => localStorage.getItem('tgtone_auth_token'),
});

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications({
    api,
    appId: 'baco',
    unreadOnly: true,
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
        <Popover>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead}>✓ Marcar todas</button>
          )}
          {notifications.map(n => (
            <div key={n.id} onClick={() => markAsRead(n.id)}>
              <Icon type={n.type} />
              <strong>{n.title}</strong>
              <p>{n.message}</p>
            </div>
          ))}
        </Popover>
      )}
    </div>
  );
}
```

---

## Integración desde backend (BFF)

Cada app necesita un servicio para enviar notificaciones desde su backend. Ejemplo para Express/Bun:

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
  await notifService.create({
    appId: 'baco',
    title: 'Trasiego completado',
    message: `Barrica ${trasiego.barricaId} lista`,
    type: 'success',
    actionUrl: `/barricas/${trasiego.barricaId}`,
  });

  res.json(trasiego);
});
```

> **Nota:** El token JWT debe pertenecer a un usuario del tenant donde se crea la notificación. Para notificaciones de sistema (sin usuario), se requiere una API Key. Contacta al equipo de core backend para habilitar esta opción.

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
        console.log('Token inválido o expirado');
        break;
      case 400:
        console.log('Error de validación:', err.details);
        break;
      case 404:
        console.log('No encontrado');
        break;
      default:
        console.log(`Error ${err.statusCode}: ${err.message}`);
    }
  }
}
```

### Métodos helper del error

| Método | Descripción |
|--------|-------------|
| `err.isUnauthorized()` | `statusCode === 401` |
| `err.isNotFound()` | `statusCode === 404` |
| `err.isValidationError()` | `statusCode === 400` |

---

## Targeting de notificaciones

### Broadcast (todos los usuarios del tenant+app)

```typescript
await api.create({
  appId: 'baco',
  title: 'Mantenimiento programado',
  message: 'El sistema estará fuera de servicio el sábado',
  type: 'info',
  // Sin targetUserId ni targetRole → broadcast
});
```

### Usuario específico

```typescript
await api.create({
  appId: 'baco',
  title: 'Barrica asignada',
  message: 'Te asignaron la barrica B-050',
  type: 'info',
  targetUserId: 'user-uuid-123',  // ← solo este usuario la ve
});
```

### Por rol

```typescript
await api.create({
  appId: 'baco',
  title: 'Reporte mensual',
  message: 'El reporte de inventario está listo',
  type: 'info',
  targetRole: 'admin',  // ← solo admins la ven
});
```

> ⚠️ `targetRole` filtra según los roles que el usuario tenga en el JWT para la app consultada. Si el JWT no tiene roles, se comporta como broadcast.

---

## Buenas prácticas

1. **Siempre pasar `appId`** en filtros — cada app tiene su propio espacio de notificaciones
2. **Usar `actionUrl`** para que el usuario pueda navegar al recurso relevante
3. **Usar `type` y `priority`** para que la UI muestre el icono y orden correctos
4. **No leer el `expiresAt`** — el backend lo maneja automáticamente (7 días)
5. **Mantener el polling** en el frontend (15s default) — es eficiente: ~1920 requests/día por usuario
6. **Para críticas**, considerar sonido/vibración en la UI cuando `type: 'error'` o `priority: 'urgent'`
7. **Para notificaciones de sistema** (sin JWT de usuario), contactar al equipo de core para habilitar API Key

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run build` | Compilar TypeScript a `dist/` |
| `npm run dev` | Compilar en modo watch |
| `npm run clean` | Eliminar `dist/` |
| `npm test` | Ejecutar tests (bun test) |

---

## ¿Cómo migrar desde @tgtone/core-sdk?

Si tu app actualmente usa `core.notifications.*` desde `@tgtone/core-sdk`:

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

## Licencia

MIT — TGT Technology
