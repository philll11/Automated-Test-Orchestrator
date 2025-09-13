// src/routes/test-plans.ts

import { Router, Request, Response, NextFunction } from 'express';
import { TestPlanService, IntegrationPlatformServiceFactory } from '../application/test_plan_service.js';
import { TestPlanRepository } from '../infrastructure/repositories/test_plan_repository.js';
import { DiscoveredComponentRepository } from '../infrastructure/repositories/discovered_component_repository.js';
import { ComponentTestMappingRepository } from '../infrastructure/repositories/component_test_mapping_repository.js';
import { BoomiService } from '../infrastructure/boomi/boomi_service.js';
import { BadRequestError, NotFoundError } from '../utils/app_error.js';

const router = Router();

const testPlanRepository = new TestPlanRepository();
const discoveredComponentRepository = new DiscoveredComponentRepository();
const componentTestMappingRepository = new ComponentTestMappingRepository();

const integrationPlatformServiceFactory: IntegrationPlatformServiceFactory = (credentials) => {
    return new BoomiService(credentials);
};

const testPlanService = new TestPlanService(
    testPlanRepository,
    discoveredComponentRepository,
    componentTestMappingRepository,
    integrationPlatformServiceFactory
);

// ----------------------------------------------------


const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
    (req: Request, res: Response, next: NextFunction) => {
        return Promise.resolve(fn(req, res, next)).catch(next);
    };

/**
 * @swagger
 * /api/v1/test-plans:
 *   post:
 *     summary: Initiate Discovery
 *     description: Initiates a new run by providing a root Component ID and selecting a connection profile. The discovery process runs asynchronously.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rootComponentId:
 *                 type: string
 *                 example: "2582515a-40fb-4d5d-bcc9-10817caa4fa2"
 *               integrationPlatformCredentials:
 *                 type: object
 *                 properties:
 *                   accountId:
 *                     type: string
 *                   username:
 *                     type: string
 *                   passwordOrToken:
 *                     type: string
 *     responses:
 *       '202':
 *         description: Accepted. The discovery process has been initiated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 metadata:
 *                   $ref: '#/components/schemas/ResponseMetadata'
 *                 data:
 *                   $ref: '#/components/schemas/TestPlan'
 *       '400':
 *         description: Bad Request. Missing required fields.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    console.log(`[ROUTE] POST /api/v1/test-plans received.`);
    console.log(`[ROUTE] Request Body:`, JSON.stringify(req.body, null, 2));
    
    const { rootComponentId, integrationPlatformCredentials } = req.body;
    if (!rootComponentId || !integrationPlatformCredentials) {
        throw new BadRequestError('rootComponentId and integrationPlatformCredentials are required');
    }
    const testPlan = await testPlanService.initiateDiscovery(rootComponentId, integrationPlatformCredentials);
    res.status(202).json({
        metadata: { code: 202, message: 'Accepted' },
        data: testPlan,
    });
}));

/**
 * @swagger
 * /api/v1/test-plans/{planId}:
 *   get:
 *     summary: Get Test Plan Status & Results
 *     description: Retrieves the status and results of a test plan, including all discovered components.
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *           example: "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6"
 *     responses:
 *       '200':
 *         description: OK.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 metadata:
 *                   $ref: '#/components/schemas/ResponseMetadata'
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/TestPlan'
 *                     - type: object
 *                       properties:
 *                         discoveredComponents:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/DiscoveredComponent'
 *       '404':
 *         description: Test plan not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:planId', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { planId } = req.params;
    const testPlan = await testPlanRepository.findById(planId);
    if (!testPlan) {
        throw new NotFoundError('Test plan not found');
    }

    const discoveredComponents = await discoveredComponentRepository.findByTestPlanId(planId);

    res.status(200).json({
        metadata: { code: 200, message: 'OK' },
        data: {
            ...testPlan,
            discoveredComponents,
        },
    });
}));

/**
 * @swagger
 * /api/v1/test-plans/{planId}/execute:
 *   post:
 *     summary: Execute Selected Tests
 *     description: Executes the user-selected test components.
 *     parameters:
 *       - in: path
 *         name: planId
 *         required: true
 *         schema:
 *           type: string
 *           example: "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               testsToRun:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["TEST-xyz-789"]
 *     responses:
 *       '202':
 *         description: Accepted. The test execution has been initiated.
 */
router.post('/:planId/execute', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { planId } = req.params;
    const { testsToRun, integrationPlatformCredentials, executionInstanceId } = req.body;

    if (!testsToRun || !Array.isArray(testsToRun) || !integrationPlatformCredentials || !executionInstanceId) {
        throw new BadRequestError('testsToRun must be an array of component IDs, integrationPlatformCredentials and executionInstanceId must be provided.');
    }

    testPlanService.executeTests(planId, testsToRun, integrationPlatformCredentials, executionInstanceId).catch(err => {
        console.error(`[Execution Error] for plan ${planId}:`, err);
    });

    res.status(202).json({
        metadata: { code: 202, message: 'Execution initiated' },
    });
}));

export default router;

/**
 * @swagger
 * components:
 *   schemas:
 *     ResponseMetadata:
 *       type: object
 *       properties:
 *         code:
 *           type: integer
 *         message:
 *           type: string
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         metadata:
 *           $ref: '#/components/schemas/ResponseMetadata'
 *     TestPlan:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         rootComponentId:
 *           type: string
 *         status:
 *           type: string
 *           enum: [PENDING, AWAITING_SELECTION, EXECUTING, COMPLETED, FAILED]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     DiscoveredComponent:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         testPlanId:
 *           type: string
 *           format: uuid
 *         componentId:
 *           type: string
 *         componentName:
 *           type: string
 *         componentType:
 *           type: string
 *         mappedTestId:
 *           type: string
 *         executionStatus:
 *           type: string
 *           enum: [PENDING, RUNNING, SUCCESS, FAILURE]
 *         executionLog:
 *           type: string
 */