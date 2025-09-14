// src/routes/mappings.ts

import { Router, Request, Response, NextFunction } from 'express';
import container from '../inversify.config.js';
import { TYPES } from '../inversify.types.js';
import { MappingsController } from './mappings.controller.js';

// Async error handling wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

const router = Router();
const mappingsController = container.get<MappingsController>(TYPES.MappingsController);

// --- RESTful API Endpoints for Mappings ---

// Create a new mapping
router.post('/', asyncHandler(mappingsController.createMapping.bind(mappingsController)));

// Get all mappings
router.get('/', asyncHandler(mappingsController.getAllMappings.bind(mappingsController)));

// Get a single mapping by its unique UUID
router.get('/:mappingId', asyncHandler(mappingsController.getMappingById.bind(mappingsController)));

// Get all mappings for a specific main component
router.get('/component/:mainComponentId', asyncHandler(mappingsController.getMappingsByMainComponentId.bind(mappingsController)));

// Update a mapping by its unique UUID
router.put('/:mappingId', asyncHandler(mappingsController.updateMapping.bind(mappingsController)));

// Delete a mapping by its unique UUID
router.delete('/:mappingId', asyncHandler(mappingsController.deleteMapping.bind(mappingsController)));

export default router;