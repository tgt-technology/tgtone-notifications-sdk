# @tgtone/notifications-sdk

SDK para el sistema de notificaciones de TGT One.

Permite crear, listar, marcar como leídas y eliminar notificaciones desde cualquier app del ecosistema.

## Stack

- **Runtime**: Node.js / Bun (compatible con ambos)
- **Formato**: ESM (`"type": "module"`)
- **Lenguaje**: TypeScript (tipos incluidos)
- **HTTP**: `fetch` nativo (no dependencies externas)

## Instalación

```bash
npm install @tgtone/notifications-sdk
```

## Uso básico

```typescript
import { NotificationsAPI } from '@tgtone/notifications-sdk';

const notifications = new NotificationsAPI({
  apiUrl: 'https://tgtone-console-backend.run.app/api',
  getToken: () => localStorage.getItem('tgtone_auth_token'),
});

// Crear notificación
await notifications.create({
  appId: 'baco',
  title: 'Trasiego completado',
  message: 'Barrica B-001 lista',
  type: 'success',
  actionUrl: '/barricas/B-001',
});

// Obtener no leídas
const result = await notifications.getNotifications({
  appId: 'baco',
  unreadOnly: true,
});

// Contador para badge
const { count } = await notifications.getUnreadCount('baco');

// Marcar como leída
await notifications.markAsRead('notif-uuid');

// Marcar todas como leídas
await notifications.markAllAsRead('baco');

// Eliminar
await notifications.delete('notif-uuid');

// Limpieza de expiradas (admin)
await notifications.cleanup();
```

## API

### `create(data)`
Crear una nueva notificación. `tenantId` y `createdBy` se toman del JWT automáticamente.

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| appId | string | requerido | ID de la app ("baco", "crm", etc.) |
| title | string | requerido | Título de la notificación |
| message | string | requerido | Mensaje |
| type | string | "info" | info / success / warning / error |
| priority | string | "normal" | low / normal / high / urgent |
| targetUserId | string? | null | null = broadcast al tenant+app |
| targetRole | string? | null | null = todos los roles |
| actionUrl | string? | null | Link al hacer clic |
| metadata | object? | null | Datos extra |

### `getNotifications(filters?)`
Listar notificaciones (paginado, default: no leídas).

### `getHistory(filters?)`
Obtener historial completo (incluye leídas + eliminadas).

### `getUnreadCount(appId?)`
Contador de no leídas (para badge).

### `markAsRead(notificationId)`
Marcar como leída.

### `markAllAsRead(appId?)`
Marcar todas como leídas (opcionalmente filtrado por app).

### `delete(notificationId)`
Eliminar notificación (soft delete, solo creador).

### `cleanup()`
Limpiar notificaciones expiradas (admin/maintenance).

## Configuración

```typescript
interface NotificationsSDKConfig {
  apiUrl: string;          // URL base del Core API
  getToken: () => string | null;  // Función que retorna el JWT
  timeout?: number;        // Timeout en ms (default: 30000)
  headers?: Record<string, string>;  // Headers adicionales
  debug?: boolean;         // Logs de debug (default: false)
}
```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run build` | Compilar TypeScript a `dist/` |
| `npm run dev` | Compilar en modo watch |
| `npm run clean` | Eliminar `dist/` |

## Licencia

MIT — TGT Technology
