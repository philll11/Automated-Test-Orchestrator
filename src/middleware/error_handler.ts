import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app_error';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      metadata: {
        code: err.statusCode,
        message: err.message,
      },
    });
  }

  console.error('UNHANDLED ERROR:', err);
  return res.status(500).json({
    metadata: {
      code: 500,
      message: 'Internal Server Error',
    },
  });
};
