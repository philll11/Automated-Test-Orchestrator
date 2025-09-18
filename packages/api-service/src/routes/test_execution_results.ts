// src/routes/test_execution_results.ts

import { Router } from 'express';
import container from '../inversify.config.js';
import { TYPES } from '../inversify.types.js';
import { TestExecutionResultsController } from './test_execution_results.controller.js';

const router = Router();
const controller = container.get<TestExecutionResultsController>(TYPES.TestExecutionResultsController);

// Define the route for GET /api/v1/test-execution-results
router.get('/', controller.getResults.bind(controller));

export default router;