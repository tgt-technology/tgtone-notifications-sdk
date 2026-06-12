/**
 * @tgtone/notifications-sdk
 *
 * SDK para el sistema de notificaciones de TGT One.
 * Permite crear, listar, marcar como leídas y eliminar
 * notificaciones desde cualquier app del ecosistema.
 *
 * @example
 * ```typescript
 * import { NotificationsAPI } from '@tgtone/notifications-sdk';
 *
 * const notifications = new NotificationsAPI({
 *   apiUrl: 'https://tgtone-console-backend.run.app/api',
 *   getToken: () => localStorage.getItem('tgtone_auth_token'),
 * });
 *
 * // Crear notificación
 * await notifications.create({
 *   appId: 'baco',
 *   title: 'Trasiego completado',
 *   message: 'Barrica B-001 lista',
 *   type: 'success',
 * });
 *
 * // Obtener no leídas (con badge)
 * const { count } = await notifications.getUnreadCount('baco');
 *
 * // Marcar como leída
 * await notifications.markAsRead('notif-uuid');
 * ```
 */

export { NotificationsAPI } from './notifications';
export { NotificationsClient } from './client';
export { NotificationsError } from './errors';
export type { NotificationsSDKConfig } from './client';
export type {
  Notification,
  NotificationType,
  NotificationPriority,
  CreateNotificationDto,
  NotificationFilters,
  NotificationsResponse,
  UnreadCountResponse,
  MarkAllReadResponse,
  CleanupResponse,
} from './types';
