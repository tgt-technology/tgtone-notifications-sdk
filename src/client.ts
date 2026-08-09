import { NotificationsError } from './errors';

/**
 * Configuración del SDK de Notificaciones
 */
export interface NotificationsSDKConfig {
  /**
   * URL base del Core API
   * @example 'https://tgtone-console-backend.run.app/api'
   */
  apiUrl: string;

  /**
   * Función para obtener el token JWT de autenticación
   * Debe retornar el token sin el prefijo "Bearer"
   */
  getToken: () => string | null;

  /**
   * Callback opcional para renovar el token cuando una petición devuelve 401.
   * Debe retornar el token renovado (o null si no se pudo renovar).
   * Típicamente conecta a `authClient.refreshAccessToken()` del auth-sdk.
   */
  onUnauthorized?: () => Promise<string | null>;

  /**
   * Timeout para requests en milisegundos
   * @default 30000
   */
  timeout?: number;

  /**
   * Headers adicionales para todas las requests
   */
  headers?: Record<string, string>;

  /**
   * Habilitar logs de debug en consola
   * @default false
   */
  debug?: boolean;
}

/**
 * Cliente HTTP base para el SDK de Notificaciones
 */
export class NotificationsClient {
  protected baseUrl: string;
  protected getToken: () => string | null;
  protected onUnauthorized: (() => Promise<string | null>) | undefined;
  protected debug: boolean;
  protected timeout: number;
  protected headers: Record<string, string>;

  constructor(config: NotificationsSDKConfig) {
    this.baseUrl = config.apiUrl.replace(/\/$/, '');
    this.getToken = config.getToken;
    this.onUnauthorized = config.onUnauthorized;
    this.debug = config.debug ?? false;
    this.timeout = config.timeout ?? 30000;
    this.headers = config.headers ?? {};
  }

  /**
   * Realiza una request HTTP al backend. Ante 401 y con `onUnauthorized`
   * configurado, renueva el token y reintenta una vez.
   */
  protected async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    let token = this.getToken();
    let response = await this.doFetch(endpoint, options, token);

    // Si 401 y hay mecanismo de refresh, renovar token y reintentar UNA vez.
    if (response.status === 401 && this.onUnauthorized) {
      const refreshed = await this.onUnauthorized();
      if (refreshed) {
        token = refreshed;
        response = await this.doFetch(endpoint, options, token);
      }
    }

    clearTimeout((response as any).__timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetails: unknown;
      try {
        errorDetails = JSON.parse(errorText);
      } catch {
        errorDetails = errorText;
      }
      throw new NotificationsError(
        (errorDetails as any)?.message || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorDetails
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    const data = await response.json();

    if (this.debug) {
      console.log(`[TGT Notifications SDK] Response:`, data);
    }

    return data as T;
  }

  private async doFetch(
    endpoint: string,
    options: RequestInit | undefined,
    token: string | null
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;

    if (this.debug) {
      console.log(`[TGT Notifications SDK] ${options?.method || 'GET'} ${url}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { [`Authorization`]: `Bearer ${token}` }),
          ...this.headers,
          ...options?.headers,
        },
      });
      (response as any).__timeoutId = timeoutId;
      return response;
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof NotificationsError) throw error;

      if (error instanceof Error && error.name === 'AbortError') {
        throw new NotificationsError(
          `Request timeout after ${this.timeout}ms`,
          408
        );
      }

      throw new NotificationsError(
        error instanceof Error ? error.message : 'Network error',
        0,
        error
      );
    }
  }

  protected async fetchGet<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const hasParams = params && Object.keys(params).length > 0
    const url = hasParams
      ? `${endpoint}?${new URLSearchParams(params).toString()}`
      : endpoint;
    return this.request<T>(url, { method: 'GET' });
  }

  protected async fetchPost<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  protected async fetchPut<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  protected async fetchDelete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}
