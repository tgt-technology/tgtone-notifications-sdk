import { NotificationsClient, NotificationsSDKConfig } from './client';
import type {
  Notification,
  CreateNotificationDto,
  NotificationFilters,
  NotificationsResponse,
  UnreadCountResponse,
  MarkAllReadResponse,
  CleanupResponse,
  GetHistoryParams,
  MetadataFilter,
} from './types';

/**
 * Convierte MetadataFilter a query params planos.
 *
 * Para arrays usa coma-separado: { teamId: ['soporte', 'ti'] }
 * → metadata.teamId=soporte,ti
 * El backend parsea separando por coma.
 */
function serializeMetadata(metadata?: MetadataFilter): Record<string, string> {
  if (!metadata) return {};
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const prefix = `metadata.${key}`;
    if (Array.isArray(value)) {
      params[prefix] = value.join(',');  // coma-separado
    } else {
      params[prefix] = value;
    }
  }
  return params;
}

/**
 * API para gestión de Notificaciones
 *
 * ENDPOINTS DISPONIBLES EN BACKEND:
 * - POST   /api/v1/notifications            - Crear notificación
 * - GET    /api/v1/notifications            - Listar notificaciones
 * - GET    /api/v1/notifications/history    - Historial paginado
 * - GET    /api/v1/notifications/unread-count - Contador para badge
 * - PUT    /api/v1/notifications/:id/read   - Marcar como leída
 * - PUT    /api/v1/notifications/read-all   - Marcar todas como leídas
 * - DELETE /api/v1/notifications/:id        - Eliminar notificación
 * - POST   /api/v1/notifications/cleanup    - Limpiar expiradas (admin)
 *
 * NOTA: tenantId y createdBy se toman del JWT automáticamente.
 */
export class NotificationsAPI extends NotificationsClient {
  private readonly BASE = '/api/v1/notifications';

  constructor(config: NotificationsSDKConfig) {
    super(config);
  }

  /**
   * Crear una nueva notificación (broadcast 1:N)
   *
   * Usar metadata para targeting app-specific:
   * ```typescript
   * await api.create({
   *   appId: 'nexo',
   *   title: 'Ticket asignado',
   *   metadata: { teamId: 'soporte' }, // app-specific
   * });
   * ```
   */
  async create(data: CreateNotificationDto): Promise<Notification> {
    return this.fetchPost<Notification>(this.BASE, data);
  }

  /**
   * Obtener notificaciones para el usuario.
   *
   * El filtro por metadata permite targeting app-specific:
   * ```typescript
   * const result = await api.getNotifications({
   *   appId: 'nexo',
   *   metadata: { teamId: ['soporte', 'ti'] }, // OR
   *   unreadOnly: true,
   *   take: 5,
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

    // Serializar metadata filter
    const metaParams = serializeMetadata(filters?.metadata);
    Object.assign(params, metaParams);

    return this.fetchGet<NotificationsResponse>(this.BASE, params);
  }

  /**
   * Obtener historial paginado de notificaciones.
   *
   ```typescript
   const history = await api.getHistory({
     appId: 'nexo',
     metadata: { teamId: 'soporte' },
     page: 1,
     pageSize: 50,
   });
   ```
   */
  async getHistory(params: GetHistoryParams): Promise<NotificationsResponse> {
    const query: Record<string, string> = {};

    query.appId = params.appId;
    if (params.page !== undefined) query.page = params.page.toString();
    if (params.pageSize !== undefined) query.pageSize = params.pageSize.toString();
    if (params.includeDeleted !== undefined) query.includeDeleted = params.includeDeleted.toString();

    // Serializar metadata filter
    const metaParams = serializeMetadata(params.metadata);
    Object.assign(query, metaParams);

    return this.fetchGet<NotificationsResponse>(`${this.BASE}/history`, query);
  }

  /**
   * Obtener contador de notificaciones no leídas (para badge)
   *
   * @param appId - Filtrar por app
   * @param metadata - Filtro adicional por metadata (opcional)
   */
  async getUnreadCount(appId?: string, metadata?: MetadataFilter): Promise<UnreadCountResponse> {
    const params: Record<string, string> = {};
    if (appId) params.appId = appId;

    const metaParams = serializeMetadata(metadata);
    Object.assign(params, metaParams);

    return this.fetchGet<UnreadCountResponse>(`${this.BASE}/unread-count`, params);
  }

  /**
   * Marcar una notificación como leída
   */
  async markAsRead(notificationId: string): Promise<{ success: boolean }> {
    return this.fetchPut<{ success: boolean }>(`${this.BASE}/${notificationId}/read`, {});
  }

  /**
   * Marcar todas las notificaciones como leídas
   *
   * @param appId - Filtrar por app (opcional)
   */
  async markAllAsRead(appId?: string): Promise<MarkAllReadResponse> {
    const params: Record<string, string> = {};
    if (appId) params.appId = appId;

    const query = Object.keys(params).length > 0 ? `?${new URLSearchParams(params).toString()}` : '';
    return this.fetchPut<MarkAllReadResponse>(`${this.BASE}/read-all${query}`, {});
  }

  /**
   * Eliminar una notificación (solo el creador puede eliminar)
   */
  async delete(notificationId: string): Promise<{ success: boolean }> {
    return this.fetchDelete<{ success: boolean }>(`${this.BASE}/${notificationId}`);
  }

  /**
   * Limpiar notificaciones expiradas (admin/maintenance)
   */
  async cleanup(): Promise<CleanupResponse> {
    return this.fetchPost<CleanupResponse>(`${this.BASE}/cleanup`);
  }
}
