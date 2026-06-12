/**
 * Tipos para el módulo de Notificaciones
 */

export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

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
  /** ID de la app que envía la notificación ("baco", "crm", etc.) */
  appId: string;

  /** Título de la notificación */
  title: string;

  /** Mensaje/contenido de la notificación */
  message: string;

  /** Tipo de notificación (default: 'info') */
  type?: NotificationType;

  /** Prioridad (default: 'normal') */
  priority?: NotificationPriority;

  /** ID de usuario específico (null = todos los usuarios del tenant+app) */
  targetUserId?: string;

  /** Rol específico (null = todos los roles) */
  targetRole?: string;

  /** URL a la que navegar al hacer clic */
  actionUrl?: string;

  /** Datos adicionales (ej: { barricaId: "xxx" }) */
  metadata?: Record<string, unknown>;
}

/**
 * Filtros para obtener notificaciones
 */
export interface NotificationFilters {
  /** Filtrar por app específica */
  appId?: string;

  /** Solo notificaciones no leídas (default: true en backend) */
  unreadOnly?: boolean;

  /** Incluir notificaciones eliminadas (soft delete) - para historial */
  includeDeleted?: boolean;

  /** Offset para paginación */
  skip?: number;

  /** Límite de resultados */
  take?: number;
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
