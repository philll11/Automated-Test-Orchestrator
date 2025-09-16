// src/utils/app_error.ts

export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request') {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not Found') {
    super(message, 404);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication Failed') {
    super(message, 401);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict') {
    super(message, 409);
  }
}

// Custom error for integration platform issues
export class IntegrationPlatformError extends Error {
  constructor(
    message: string,
    public readonly externalStatusCode?: number,
    public readonly attempts?: number
  ) {
    super(message);
    this.name = 'IntegrationPlatformError';
  }
}