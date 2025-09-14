// src/routes/test_plans.ts

import { Router, Request, Response, NextFunction } from 'express';
import container from '../inversify.config.js';
import { TYPES } from '../inversify.types.js';
import { TestPlanController } from './test_plans.controller.js';

// This is a simple utility to wrap async route handlers and catch errors
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
    (req: Request, res: Response, next: NextFunction) => {
        return Promise.resolve(fn(req, res, next)).catch(next);
    };

const router = Router();

// Resolve the controller from the DI container
const testPlanController = container.get<TestPlanController>(TYPES.TestPlanController);

// Define the routes and bind them to the controller methods
// .bind() is crucial to ensure 'this' is correctly set inside the controller methods
router.post('/', asyncHandler(testPlanController.initiateDiscovery.bind(testPlanController)));
router.get('/:planId', asyncHandler(testPlanController.getPlanAndComponents.bind(testPlanController)));
router.post('/:planId/execute', asyncHandler(testPlanController.executeTests.bind(testPlanController)));

export default router;