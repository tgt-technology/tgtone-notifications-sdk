/**
 * Hook de React para consumir notificaciones desde cualquier app del ecosistema TGT One.
 *
 * Reemplaza la necesidad de que cada app implemente su propio hook con polling.
 *
 * @example
 * ```typescript
 * import { NotificationsAPI } from '@tgtone/notifications-sdk';
 * import { useNotifications } from '@tgtone/notifications-sdk/react';
 *
 * function NotifBell() {
 *   const api = new NotificationsAPI({
 *     apiUrl: 'https://tgtone-console-backend.run.app/api',
 *     getToken: () => localStorage.getItem('tgtone_auth_token'),
 *   });
 *
 *   const { notifications, unreadCount, isLoading } = useNotifications({
 *     api,
 *     appId: 'baco',
 *   });
 *
 *   return <Badge>{unreadCount}</Badge>;
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { NotificationsAPI } from '../notifications';
import type { Notification as SDKNotification } from '../types';

// ── Tipos exportados ────────────────

export interface UseNotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  /** Mapeado desde isRead del backend para compatibilidad */
  read: boolean;
  actionUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  isDeleted?: boolean;
  deletedAt?: Date | null;
}

export interface UseNotificationsOptions {
  /** Instancia del SDK ya configurada con apiUrl + getToken */
  api: NotificationsAPI;

  /** appId a filtrar (ej: "baco", "crm") */
  appId: string;

  /** true = mostrar historial completo (incluye leídas + eliminadas) */
  useHistory?: boolean;

  /** true = incluir eliminadas en getNotifications */
  includeDeleted?: boolean;

  /** true = solo no leídas (default en modo normal) */
  unreadOnly?: boolean;

  /** Intervalo de polling en ms (default: 15000, solo en modo normal) */
  pollingInterval?: number;
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
    useHistory = false,
    includeDeleted = false,
    unreadOnly = false,
    pollingInterval = 15000,
  } = options;

  const [notifications, setNotifications] = useState<UseNotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Mapea respuesta del backend al tipo del hook */
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
        });
      } else {
        response = await api.getNotifications({
          appId,
          unreadOnly,
          includeDeleted,
        });
      }

      const mapped: UseNotificationItem[] = (response.notifications || []).map(mapItem);
      setNotifications(mapped);
      setError(null);
    } catch (err) {
      const errMsg = (err as Error).message || '';
      // Si es error de token, no mostrar error visual (el auth flow lo maneja)
      if (errMsg.includes('Invalid or expired token') || errMsg.includes('Unauthorized')) {
        return;
      }
      console.error('[Notifications] Error fetching:', err);
      setError('Error al cargar notificaciones');
    } finally {
      setIsLoading(false);
    }
  }, [api, appId, useHistory, includeDeleted, unreadOnly]);

  // ── Actions ──

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
      setNotifications((prev: UseNotificationItem[]) => prev.map((n: UseNotificationItem) => ({ ...n, read: true })));
    } catch (err) {
      console.warn('[Notifications] Error marking all as read:', err);
    }
  }, [api, appId]);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      await api.delete(id);
      if (useHistory) {
        setNotifications((prev: UseNotificationItem[]) =>
          prev.map((n: UseNotificationItem) => (n.id === id ? { ...n, isDeleted: true, deletedAt: new Date() } : n))
        );
      } else {
        setNotifications((prev: UseNotificationItem[]) => prev.filter((n: UseNotificationItem) => n.id !== id));
      }
    } catch (err) {
      console.warn('[Notifications] Error deleting:', err);
    }
  }, [api, useHistory]);

  // ── Initial fetch ──
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ── Polling ──
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
