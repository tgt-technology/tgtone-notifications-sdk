# Changelog

Todas las versiones notables de `@tgtone/notifications-sdk` serán documentadas en este archivo.

## [1.1.0] — 2026-08-09

### Added

- **Auto-refresh de token en 401**: nuevo callback opcional `onUnauthorized?: () => Promise<string | null>` en la config.
  - Si una petición devuelve 401 y hay `onUnauthorized` configurado, el SDK llama al callback (típicamente conectado a `authClient.refreshAccessToken()` del auth-sdk), renueva el token y **reintenta la petición una vez** con el token nuevo.
  - El polling de notificaciones (cada 15s) sigue funcionando aunque el access token expire con la app abierta (p. ej. durante la noche), renovándolo sobre la marcha.
  - Retro-compatible: sin `onUnauthorized` configurado, el SDK mantiene el comportamiento previo (lanza `NotificationsError` en 401).
- 3 tests nuevos de auto-refresh (27 tests totales).

## [1.0.1] — 2026-07-08

### Fixed

- Compilación CJS en lugar de ESM: cambiado `"module": "ESNext"` → `"commonjs"` en tsconfig.json
  - Resuelve `ERR_MODULE_NOT_FOUND` al usar `require()` desde apps que compilan a CommonJS

## [1.0.0] — 2026-06-11

### Added

- SDK standalone con 7 métodos de API:
  - `create()` — crear notificaciones
  - `getNotifications()` — listar con filtros (paginado, appId, unreadOnly, includeDeleted)
  - `getHistory()` — historial completo (incluye leídas + eliminadas)
  - `getUnreadCount()` — contador para badge de campana
  - `markAsRead()` — marcar individual como leída
  - `markAllAsRead()` — marcar todas como leídas (con/sin filtro appId)
  - `delete()` — eliminar notificación (soft delete)
  - `cleanup()` — limpiar expiradas (admin)
- HTTP client nativo (fetch) con autenticación Bearer, timeout y manejo de errores
- Hook React `useNotifications` (export `@tgtone/notifications-sdk/react`) con polling automático
- Sistema de targeting: broadcast, usuario específico, por rol
- Validación `t.Object` en backend para creación de notificaciones
- Filtro `targetRole` funcional en queries de backend
- Cleanup inteligente:
  - Notificaciones dirigidas: se borran cuando el usuario leyó +7d
  - Notificaciones broadcast: se borran cuando expira su TTL (7d)
  - Soft-deleted: se borran después de retención (7d)
  - Admin guard: solo admin de console puede gatillar cleanup
- Protección de eliminación para notificaciones de sistema (sin createdBy)
- 22 tests unitarios del SDK
- 7 tests de targetRole en backend (total backend: 628 tests)
