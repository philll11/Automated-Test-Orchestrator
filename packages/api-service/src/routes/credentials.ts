// src/routes/credentials.ts

import { Router, Request, Response, NextFunction } from 'express';
import container from '../inversify.config.js';
import { TYPES } from '../inversify.types.js';
import { CredentialsController } from './credentials.controller.js';

// A utility to wrap async route handlers and catch errors, ensuring consistency.
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
  };

const router = Router();

// Resolve the controller from the DI container
const credentialsController = container.get<CredentialsController>(TYPES.CredentialsController);

router.post('/', asyncHandler(credentialsController.addCredential.bind(credentialsController)));
router.get('/', asyncHandler(credentialsController.listCredentials.bind(credentialsController)));
router.delete('/:profileName', asyncHandler(credentialsController.deleteCredential.bind(credentialsController)));

export default router;