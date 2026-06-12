/**
 * Hook de React para consumir notificaciones desde cualquier app del ecosistema TGT One.
 *
 * @example
 * ```typescript
 * import { NotificationsAPI } from '@tgtone/notifications-sdk';
 * import { useNotifications } from '@tgtone/notifications-sdk/react';
 *
 * function NotifBell() {
 *   const { unreadCount } = useNotifications({
 *     api: new NotificationsAPI({
 *       apiUrl: 'https://tgtone-console-backend.run.app/api',
 *       getToken: () => localStorage.getItem('tgtone_auth_token'),
 *     }),
 *     appId: 'baco',
 *     filter: {
 *       metadata: { teamId: ['soporte', 'ti'] }, // app-specific
 *     },
 *     limit: 5,
 *   });
 *   return <Badge>{unreadCount}</Badge>;
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { NotificationsAPI } from '../notifications';
import type { Notification as SDKNotification, MetadataFilter } from '../types';

// ── Tipos exportados ────────────────

export interface UseNotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  read: boolean;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  isDeleted?: boolean;
  deletedAt?: Date | null;
}

export interface UseNotificationsFilter {
  /** Filtro por metadata (app-specific: teamId, projectId, etc.) */
  metadata?: MetadataFilter;
}

export interface UseNotificationsOptions {
  /** Instancia del SDK ya configurada */
  api: NotificationsAPI;
  /** appId a consultar */
  appId: string;
  /** Filtro de targeting (metadata app-specific) */
  filter?: UseNotificationsFilter;
  /** Cantidad de notificaciones a mostrar (default: 5) */
  limit?: number;
  /** Intervalo de polling en ms (default: 15000) */
  pollingInterval?: number;
  /** true = mostrar historial completo (incluye leídas + eliminadas) */
  useHistory?: boolean;
}

export interface UseNotificationsReturn {
  notifications: UseNotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

// ── Hook ────────────────────────────

export function useNotifications(options: UseNotificationsOptions): UseNotificationsReturn {
  const {
    api,
    appId,
    filter,
    limit = 5,
    pollingInterval = 15000,
    useHistory = false,
  } = options;

  const [notifications, setNotifications] = useState<UseNotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mapItem = (n: SDKNotification): UseNotificationItem => ({
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type || 'info',
    priority: n.priority || 'normal',
    read: n.isRead || false,
    actionUrl: n.actionUrl,
    metadata: n.metadata,
    createdAt: new Date(n.createdAt),
    isDeleted: n.isDeleted || false,
    deletedAt: n.deletedAt ? new Date(n.deletedAt) : null,
  });

  const fetchNotifications = useCallback(async () => {
    try {
      let response;

      if (useHistory) {
        response = await api.getNotifications({
          appId,
          unreadOnly: false,
          includeDeleted: true,
          metadata: filter?.metadata,
          take: limit * 2, // traer un poco más para filtrar en cliente
        });
      } else {
        response = await api.getNotifications({
          appId,
          unreadOnly: true,
          metadata: filter?.metadata,
          take: limit * 2,
        });
      }

      const mapped: UseNotificationItem[] = (response.notifications || []).map(mapItem);
      setNotifications(mapped.slice(0, limit));
      setError(null);
    } catch (err) {
      const errMsg = (err as Error).message || '';
      if (errMsg.includes('Invalid or expired token') || errMsg.includes('Unauthorized')) {
        return;
      }
      console.error('[Notifications] Error fetching:', err);
      setError('Error al cargar notificaciones');
    } finally {
      setIsLoading(false);
    }
  }, [api, appId, useHistory, filter?.metadata, limit]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await api.markAsRead(id);
      setNotifications((prev: UseNotificationItem[]) =>
        prev.map((n: UseNotificationItem) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.warn('[Notifications] Error marking as read:', err);
    }
  }, [api]);

  const markAllAsRead = useCallback(async () => {
    try {
      await api.markAllAsRead(appId);
      setNotifications((prev: UseNotificationItem[]) =>
        prev.map((n: UseNotificationItem) => ({ ...n, read: true }))
      );
    } catch (err) {
      console.warn('[Notifications] Error marking all as read:', err);
    }
  }, [api, appId]);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      await api.delete(id);
      if (useHistory) {
        setNotifications((prev: UseNotificationItem[]) =>
          prev.map((n: UseNotificationItem) =>
            n.id === id ? { ...n, isDeleted: true, deletedAt: new Date() } : n
          )
        );
      } else {
        setNotifications((prev: UseNotificationItem[]) =>
          prev.filter((n: UseNotificationItem) => n.id !== id)
        );
      }
    } catch (err) {
      console.warn('[Notifications] Error deleting:', err);
    }
  }, [api, useHistory]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (useHistory) return;
    const interval = setInterval(fetchNotifications, pollingInterval);
    return () => clearInterval(interval);
  }, [fetchNotifications, useHistory, pollingInterval]);

  const unreadCount = notifications.filter((n: UseNotificationItem) => !n.read && !n.isDeleted).length;

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: fetchNotifications,
  };
}
