import { NotificationsClient, NotificationsSDKConfig } from './client';
import type {
  Notification,
  CreateNotificationDto,
  NotificationFilters,
  NotificationsResponse,
  UnreadCountResponse,
  MarkAllReadResponse,
  CleanupResponse,
} from './types';

/**
 * API para gestión de Notificaciones
 *
 * ENDPOINTS DISPONIBLES EN BACKEND:
 * - POST   /api/v1/notifications            - Crear notificación
 * - GET    /api/v1/notifications            - Listar notificaciones (no leídas por defecto)
 * - GET    /api/v1/notifications/unread-count - Contador para badge
 * - PUT    /api/v1/notifications/:id/read   - Marcar como leída
 * - PUT    /api/v1/notifications/read-all   - Marcar todas como leídas
 * - DELETE /api/v1/notifications/:id        - Eliminar notificación (soft)
 * - POST   /api/v1/notifications/cleanup    - Limpiar notificaciones expiradas (admin)
 *
 * NOTA: tenantId y createdBy se toman del JWT automáticamente.
 * NO se deben enviar en los métodos del SDK.
 */
export class NotificationsAPI extends NotificationsClient {
  private readonly BASE = '/api/v1/notifications';

  constructor(config: NotificationsSDKConfig) {
    super(config);
  }

  /**
   * Crear una nueva notificación
   *
   * Backend: POST /api/v1/notifications
   *
   * @example
   * ```typescript
   * const notif = await notifications.create({
   *   appId: 'baco',
   *   title: 'Trasiego completado',
   *   message: 'El trasiego de la barrica B-001 ha sido completado',
   *   type: 'success',
   *   actionUrl: '/barricas/B-001',
   *   metadata: { barricaId: 'uuid-xxx' }
   * });
   * ```
   */
  async create(data: CreateNotificationDto): Promise<Notification> {
    return this.fetchPost<Notification>(this.BASE, data);
  }

  /**
   * Obtener notificaciones del usuario
   *
   * Backend: GET /api/v1/notifications
   *
   * @param filters - Filtros opcionales (appId, unreadOnly, includeDeleted, skip, take)
   *
   * @example
   * ```typescript
   * const result = await notifications.getNotifications({
   *   appId: 'baco',
   *   unreadOnly: true,
   *   take: 20
   * });
   * ```
   */
  async getNotifications(filters?: NotificationFilters): Promise<NotificationsResponse> {
    const params: Record<string, string> = {};

    if (filters?.appId !== undefined) params.appId = filters.appId;
    if (filters?.unreadOnly !== undefined) params.unreadOnly = filters.unreadOnly.toString();
    if (filters?.includeDeleted !== undefined) params.includeDeleted = filters.includeDeleted.toString();
    if (filters?.skip !== undefined) params.skip = filters.skip.toString();
    if (filters?.take !== undefined) params.take = filters.take.toString();

    return this.fetchGet<NotificationsResponse>(this.BASE, params);
  }

  /**
   * Obtener historial completo de notificaciones (incluye leídas y eliminadas)
   *
   * Backend: GET /api/v1/notifications con includeDeleted=true, unreadOnly=false
   *
   * @param filters - Filtros opcionales (sin unreadOnly/includeDeleted — se fuerzan)
   *
   * @example
   * ```typescript
   * const result = await notifications.getHistory({ appId: 'baco', take: 100 });
   * ```
   */
  async getHistory(filters?: Omit<NotificationFilters, 'unreadOnly' | 'includeDeleted'>): Promise<NotificationsResponse> {
    return this.getNotifications({
      ...filters,
      unreadOnly: false,
      includeDeleted: true,
    });
  }

  /**
   * Obtener contador de notificaciones no leídas (para badge)
   *
   * Backend: GET /api/v1/notifications/unread-count
   *
   * @param appId - Filtrar por app (opcional)
   *
   * @example
   * ```typescript
   * const { count } = await notifications.getUnreadCount('baco');
   * ```
   */
  async getUnreadCount(appId?: string): Promise<UnreadCountResponse> {
    const params: Record<string, string> = {};
    if (appId !== undefined) params.appId = appId;

    return this.fetchGet<UnreadCountResponse>(`${this.BASE}/unread-count`, params);
  }

  /**
   * Marcar una notificación como leída
   *
   * Backend: PUT /api/v1/notifications/:id/read
   *
   * @param notificationId - ID de la notificación
   */
  async markAsRead(notificationId: string): Promise<{ success: boolean }> {
    return this.fetchPut<{ success: boolean }>(`${this.BASE}/${notificationId}/read`, {});
  }

  /**
   * Marcar todas las notificaciones como leídas
   *
   * Backend: PUT /api/v1/notifications/read-all
   *
   * @param appId - Filtrar por app (opcional)
   *
   * @example
   * ```typescript
   * const result = await notifications.markAllAsRead('baco');
   * ```
   */
  async markAllAsRead(appId?: string): Promise<MarkAllReadResponse> {
    const params: Record<string, string> = {};
    if (appId) params.appId = appId;

    const query = Object.keys(params).length > 0 ? `?${new URLSearchParams(params).toString()}` : '';
    return this.fetchPut<MarkAllReadResponse>(`${this.BASE}/read-all${query}`, {});
  }

  /**
   * Eliminar una notificación (solo el creador puede eliminar)
   *
   * Backend: DELETE /api/v1/notifications/:id
   *
   * @param notificationId - ID de la notificación
   */
  async delete(notificationId: string): Promise<{ success: boolean }> {
    return this.fetchDelete<{ success: boolean }>(`${this.BASE}/${notificationId}`);
  }

  /**
   * Limpiar notificaciones expiradas (admin/maintenance)
   *
   * Backend: POST /api/v1/notifications/cleanup
   *
   * Elimina notificaciones leídas hace más de 7 días
   * y notificaciones soft-deleted hace más de 7 días.
   * Las notificaciones NO LEÍDAS nunca se borran.
   */
  async cleanup(): Promise<CleanupResponse> {
    return this.fetchPost<CleanupResponse>(`${this.BASE}/cleanup`);
  }
}
