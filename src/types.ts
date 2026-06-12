/**
 * Tipos para el módulo de Notificaciones
 */

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Filtro por metadata. Cada key puede ser:
 * - string: coincide exactamente con ese valor
 * - string[]: OR entre los valores (metadata.campo IN valores)
 *
 * @example
 * ```typescript
 * // Una notificación con { teamId: 'soporte' } matchea ambos:
 * const filter1: MetadataFilter = { teamId: 'soporte' };
 * const filter2: MetadataFilter = { teamId: ['soporte', 'ti'] }; // OR
 * ```
 */
export interface MetadataFilter {
  [key: string]: string | string[];
}

/**
 * Notificación completa (respuesta del backend)
 */
export interface Notification {
  id: string;
  appId: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  isRead: boolean;
  readAt?: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
}

/**
 * DTO para crear notificaciones
 */
export interface CreateNotificationDto {
  appId: string;
  title: string;
  message: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  targetUserId?: string;
  targetRole?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Filtros para obtener notificaciones
 */
export interface NotificationFilters {
  appId?: string;
  unreadOnly?: boolean;
  includeDeleted?: boolean;
  skip?: number;
  take?: number;
  /** Filtrar broadcasts por metadata (JSON indexado con GIN) */
  metadata?: MetadataFilter;
}

/**
 * Parámetros para historial paginado
 */
export interface GetHistoryParams {
  appId: string;
  /** Filtro por metadata */
  metadata?: MetadataFilter;
  /** Número de página (default: 1) */
  page?: number;
  /** Items por página (default: 50) */
  pageSize?: number;
  /** Incluir eliminadas (default: false) */
  includeDeleted?: boolean;
}

/**
 * Respuesta paginada de notificaciones
 */
export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  skip: number;
  take: number;
}

/**
 * Respuesta del contador de no leídas
 */
export interface UnreadCountResponse {
  count: number;
}

/**
 * Respuesta de marcar todas como leídas
 */
export interface MarkAllReadResponse {
  success: boolean;
  markedCount: number;
}

/**
 * Respuesta de limpieza de notificaciones expiradas
 */
export interface CleanupResponse {
  success: boolean;
  deletedCount: number;
  readExpiredCount: number;
  broadcastExpiredCount: number;
  softDeletedCount: number;
  timestamp: string;
}
