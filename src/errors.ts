/**
 * Error personalizado para errores de API del SDK de Notificaciones
 */
export class NotificationsError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'NotificationsError';
    Object.setPrototypeOf(this, NotificationsError.prototype);
  }

  isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  isNotFound(): boolean {
    return this.statusCode === 404;
  }

  isValidationError(): boolean {
    return this.statusCode === 400;
  }
}
