// src/middleware/error_handler.ts

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app_error.js';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {

  console.log(`[ERROR HANDLER] Global error handler triggered.`);

  if (err instanceof AppError) {
    
    console.log(`[ERROR HANDLER] Caught a known AppError: ${err.constructor.name}, Status Code: ${err.statusCode}`);
    console.log(`[ERROR HANDLER] Error Message: ${err.message}`);

    return res.status(err.statusCode).json({
      metadata: {
        code: err.statusCode,
        message: err.message,
      },
    });
  }

  console.error('[ERROR HANDLER] UNHANDLED ERROR:', err);
  return res.status(500).json({
    metadata: {
      code: 500,
      message: 'Internal Server Error',
    },
  });
};