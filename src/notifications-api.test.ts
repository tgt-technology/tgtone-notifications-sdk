// ═══════════════════════════════════════════════════════════════════
// notifications-api.test.ts — SDK unit tests
// Tests all 7 NotificationsAPI methods with mocked fetch
// ═══════════════════════════════════════════════════════════════════

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { NotificationsAPI } from './notifications'
import { NotificationsError } from './errors'

const BASE_URL = 'https://test-api.test/api'

// ── Mock fetch ──────────────────────────────────────────────────

type FetchCall = { method: string; url: string; body?: any }
let fetchCalls: FetchCall[] = []
let mockResponse: any = { id: 'notif-1' }
let mockStatus = 200

function setupMock() {
  fetchCalls = []
  mockResponse = null
  mockStatus = 200

  globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    const reqUrl = typeof url === 'string' ? url : url.toString()
    fetchCalls.push({
      method: (init?.method as string) || 'GET',
      url: reqUrl,
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    })

    return {
      ok: mockStatus >= 200 && mockStatus < 300,
      status: mockStatus,
      statusText: mockStatus === 200 ? 'OK' : 'Error',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockResponse,
      text: async () => JSON.stringify(mockResponse),
    } as Response
  }
}

// ── SDK instance ────────────────────────────────────────────────

function createAPI(): NotificationsAPI {
  return new NotificationsAPI({
    apiUrl: BASE_URL,
    getToken: () => 'test-token',
  })
}

// ── Tests ───────────────────────────────────────────────────────

describe('NotificationsAPI', () => {
  beforeAll(() => setupMock())
  afterAll(() => { delete (globalThis as any).fetch })

  // ── create ────────────────────────────────────────────────────
  describe('create', () => {
    test('sends POST with correct body and returns notification', async () => {
      setupMock()
      mockResponse = { id: 'n-1', appId: 'baco', title: 'Test', message: 'Msg', type: 'success' }

      const api = createAPI()
      const result = await api.create({
        appId: 'baco',
        title: 'Test notification',
        message: 'Hello world',
        type: 'success',
      })

      expect(fetchCalls.length).toBe(1)
      expect(fetchCalls[0].method).toBe('POST')
      expect(fetchCalls[0].url).toBe(`${BASE_URL}/api/v1/notifications`)
      expect(fetchCalls[0].body.appId).toBe('baco')
      expect(fetchCalls[0].body.title).toBe('Test notification')
      expect(result.id).toBe('n-1')
      expect(result.type).toBe('success')
    })

    test('sends optional fields correctly', async () => {
      setupMock()

      const api = createAPI()
      await api.create({
        appId: 'baco',
        title: 'Priority test',
        message: 'Urgent',
        priority: 'urgent',
        type: 'error',
        targetUserId: 'user-1',
        targetRole: 'admin',
        actionUrl: '/details',
        metadata: { ref: 'abc' },
      })

      expect(fetchCalls[0].body.priority).toBe('urgent')
      expect(fetchCalls[0].body.targetUserId).toBe('user-1')
      expect(fetchCalls[0].body.metadata).toEqual({ ref: 'abc' })
    })
  })

  // ── getNotifications ──────────────────────────────────────────
  describe('getNotifications', () => {
    test('sends GET with default params', async () => {
      setupMock()
      mockResponse = { notifications: [], total: 0, skip: 0, take: 50 }

      const api = createAPI()
      await api.getNotifications()

      expect(fetchCalls[0].method).toBe('GET')
      expect(fetchCalls[0].url).toBe(`${BASE_URL}/api/v1/notifications`)
    })

    test('sends query params for filters', async () => {
      setupMock()

      const api = createAPI()
      await api.getNotifications({ appId: 'baco', unreadOnly: true, skip: 10, take: 20 })

      const url = fetchCalls[0].url
      expect(url).toContain('appId=baco')
      expect(url).toContain('unreadOnly=true')
      expect(url).toContain('skip=10')
      expect(url).toContain('take=20')
    })

    test('does not send undefined filters', async () => {
      setupMock()

      const api = createAPI()
      await api.getNotifications({})

      const url = fetchCalls[0].url
      expect(url).not.toContain('unreadOnly')
      expect(url).not.toContain('skip')
    })

    test('maps response correctly', async () => {
      setupMock()
      mockResponse = {
        notifications: [
          { id: 'n-1', appId: 'baco', title: 'A', message: 'Msg', type: 'info', priority: 'normal', isRead: false, createdAt: '2026-06-11T00:00:00Z', readReceipts: [] },
          { id: 'n-2', appId: 'baco', title: 'B', message: 'Msg2', type: 'warning', priority: 'high', isRead: true, createdAt: '2026-06-10T00:00:00Z', readReceipts: [{ readAt: '2026-06-10T12:00:00Z' }] },
        ],
        total: 2, skip: 0, take: 50,
      }

      const api = createAPI()
      const result = await api.getNotifications()

      expect(result.total).toBe(2)
      expect(result.notifications[0].isRead).toBe(false)
      expect(result.notifications[1].isRead).toBe(true)
    })

    test('includeDeleted filter', async () => {
      setupMock()

      const api = createAPI()
      await api.getNotifications({ includeDeleted: true })

      expect(fetchCalls[0].url).toContain('includeDeleted=true')
    })
  })

  // ── getHistory ────────────────────────────────────────────────
  describe('getHistory', () => {
    test('sends GET to /history with appId and page params', async () => {
      setupMock()

      const api = createAPI()
      await api.getHistory({ appId: 'baco', page: 1, pageSize: 50 })

      const url = fetchCalls[0].url
      expect(url).toContain('/history')
      expect(url).toContain('appId=baco')
      expect(url).toContain('page=1')
      expect(url).toContain('pageSize=50')
    })

    test('includes metadata filter in history query', async () => {
      setupMock()

      const api = createAPI()
      await api.getHistory({ appId: 'baco', metadata: { teamId: 'soporte' } })

      const url = fetchCalls[0].url
      expect(url).toContain('metadata.teamId=soporte')
    })

    test('multi-value metadata in history query', async () => {
      setupMock()

      const api = createAPI()
      await api.getHistory({ appId: 'baco', metadata: { teamId: ['soporte', 'ti'] } })

      const url = fetchCalls[0].url
      expect(url).toContain('metadata.teamId=soporte%2Cti') // coma-separado URL-encoded
    })
  })

  // ── getUnreadCount ────────────────────────────────────────────
  describe('getUnreadCount', () => {
    test('sends GET to unread-count', async () => {
      setupMock()
      mockResponse = { count: 5 }

      const api = createAPI()
      const result = await api.getUnreadCount()

      expect(fetchCalls[0].method).toBe('GET')
      expect(fetchCalls[0].url).toBe(`${BASE_URL}/api/v1/notifications/unread-count`)
      expect(result.count).toBe(5)
    })

    test('filters by appId', async () => {
      setupMock()

      const api = createAPI()
      await api.getUnreadCount('baco')

      expect(fetchCalls[0].url).toContain('appId=baco')
    })

    test('no appId param when not provided', async () => {
      setupMock()

      const api = createAPI()
      await api.getUnreadCount()

      expect(fetchCalls[0].url).not.toContain('appId')
    })
  })

  // ── markAsRead ────────────────────────────────────────────────
  describe('markAsRead', () => {
    test('sends PUT with notification ID', async () => {
      setupMock()
      mockResponse = { success: true }

      const api = createAPI()
      const result = await api.markAsRead('notif-123')

      expect(fetchCalls[0].method).toBe('PUT')
      expect(fetchCalls[0].url).toBe(`${BASE_URL}/api/v1/notifications/notif-123/read`)
      expect(result.success).toBe(true)
    })
  })

  // ── markAllAsRead ─────────────────────────────────────────────
  describe('markAllAsRead', () => {
    test('sends PUT to read-all', async () => {
      setupMock()
      mockResponse = { success: true, markedCount: 3 }

      const api = createAPI()
      const result = await api.markAllAsRead()

      expect(fetchCalls[0].method).toBe('PUT')
      expect(fetchCalls[0].url).toBe(`${BASE_URL}/api/v1/notifications/read-all`)
      expect(result.markedCount).toBe(3)
    })

    test('includes appId when provided', async () => {
      setupMock()

      const api = createAPI()
      await api.markAllAsRead('baco')

      expect(fetchCalls[0].url).toContain('?appId=baco')
    })

    test('skips appId param when appId is empty string (already sanitized)', async () => {
      setupMock()

      const api = createAPI()
      await api.markAllAsRead('')

      expect(fetchCalls[0].url).not.toContain('appId')
    })
  })

  // ── delete ────────────────────────────────────────────────────
  describe('delete', () => {
    test('sends DELETE with notification ID', async () => {
      setupMock()
      mockResponse = { success: true }

      const api = createAPI()
      const result = await api.delete('notif-456')

      expect(fetchCalls[0].method).toBe('DELETE')
      expect(fetchCalls[0].url).toBe(`${BASE_URL}/api/v1/notifications/notif-456`)
      expect(result.success).toBe(true)
    })
  })

  // ── cleanup ───────────────────────────────────────────────────
  describe('cleanup', () => {
    test('sends POST to cleanup', async () => {
      setupMock()
      mockResponse = { success: true, deletedCount: 5, readExpiredCount: 3, broadcastExpiredCount: 1, softDeletedCount: 1, timestamp: '2026-06-11T00:00:00Z' }

      const api = createAPI()
      const result = await api.cleanup()

      expect(fetchCalls[0].method).toBe('POST')
      expect(fetchCalls[0].url).toBe(`${BASE_URL}/api/v1/notifications/cleanup`)
      expect(result.deletedCount).toBe(5)
      expect(result.broadcastExpiredCount).toBe(1)
    })
  })

  // ── Auth header ───────────────────────────────────────────────
  describe('auth', () => {
    test('sends Authorization header from getToken', async () => {
      setupMock()

      let capturedHeaders: any = null
      globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
        capturedHeaders = init?.headers
        return { ok: true, status: 200, json: async () => ({}), text: async () => '{}', headers: new Headers() } as Response
      }

      const api = createAPI()
      await api.getUnreadCount()

      expect(capturedHeaders).toBeDefined()
      expect((capturedHeaders as any)['Authorization']).toBe('Bearer test-token')
    })
  })

  // ── Errors ────────────────────────────────────────────────────
  describe('error handling', () => {
    test('throws NotificationsError on 401', async () => {
      setupMock()
      mockStatus = 401
      mockResponse = { message: 'Unauthorized' }

      const api = createAPI()
      try {
        await api.getUnreadCount()
        expect('should have thrown').toBe(false)
      } catch (err) {
        expect(err).toBeInstanceOf(NotificationsError)
        expect((err as NotificationsError).statusCode).toBe(401)
        expect((err as NotificationsError).isUnauthorized()).toBe(true)
      }
    })

    test('throws NotificationsError on 404', async () => {
      setupMock()
      mockStatus = 404

      const api = createAPI()
      try {
        await api.markAsRead('nonexistent')
        expect('should have thrown').toBe(false)
      } catch (err) {
        expect(err).toBeInstanceOf(NotificationsError)
        expect((err as NotificationsError).statusCode).toBe(404)
        expect((err as NotificationsError).isNotFound()).toBe(true)
      }
    })

    test('throws NotificationsError on 400', async () => {
      setupMock()
      mockStatus = 400

      const api = createAPI()
      try {
        await api.create({ appId: '', title: '', message: '' })
        expect('should have thrown').toBe(false)
      } catch (err) {
        expect(err).toBeInstanceOf(NotificationsError)
        expect((err as NotificationsError).isValidationError()).toBe(true)
      }
    })

    test('handles network error gracefully', async () => {
      setupMock()
      globalThis.fetch = async () => { throw new Error('Network error') }

      const api = createAPI()
      try {
        await api.getNotifications()
        expect('should have thrown').toBe(false)
      } catch (err) {
        expect(err).toBeInstanceOf(NotificationsError)
        expect((err as NotificationsError).statusCode).toBe(0)
      }
    })
  })
})
