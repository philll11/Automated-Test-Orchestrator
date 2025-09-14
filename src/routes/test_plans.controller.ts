// src/routes/test_plans.controller.ts

import { Request, Response } from 'express';
import { injectable, inject } from 'inversify';
import { TYPES } from '../inversify.types.js';
import { ITestPlanService } from '../ports/i_test_plan_service.js';
import { BadRequestError, NotFoundError } from '../utils/app_error.js';
import { BoomiService } from '../infrastructure/boomi/boomi_service.js';

@injectable()
export class TestPlanController {
    constructor(
        @inject(TYPES.ITestPlanService) private testPlanService: ITestPlanService
    ) { }

    /**
     * @swagger
     * /api/v1/test-plans:
     *   post:
     *     summary: Initiate Discovery
     *     tags: [Test Plans]
     *     description: Initiates a new run by providing a root Component ID and credentials. The discovery process runs asynchronously.
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
     *               $ref: '#/components/schemas/ApiResponse_TestPlan'
     *       '400':
     *         description: Bad Request. Missing required fields.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    public async initiateDiscovery(req: Request, res: Response): Promise<void> {
        const { rootComponentId, integrationPlatformCredentials } = req.body;
        if (!rootComponentId || !integrationPlatformCredentials) {
            throw new BadRequestError('rootComponentId and integrationPlatformCredentials are required');
        }
        // The controller creates the concrete service
        const boomiService = new BoomiService(integrationPlatformCredentials);

        const testPlan = await this.testPlanService.initiateDiscovery(rootComponentId, boomiService);

        res.status(202).json({
            metadata: { code: 202, message: 'Accepted' },
            data: testPlan,
        });
    }

    /**
     * @swagger
     * /api/v1/test-plans/{planId}:
     *   get:
     *     summary: Get Test Plan Status & Results
     *     tags: [Test Plans]
     *     description: Retrieves the status and results of a test plan, including all discovered components.
     *     parameters:
     *       - in: path
     *         name: planId
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
     *           example: "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6"
     *     responses:
     *       '200':
     *         description: OK.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse_TestPlanWithComponents'
     *       '404':
     *         description: Test plan not found.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ErrorResponse'
     */
    public async getPlanAndComponents(req: Request, res: Response): Promise<void> {
        const { planId } = req.params;
        const testPlanWithComponents = await this.testPlanService.getPlanWithDetails(planId);

        if (!testPlanWithComponents) {
            throw new NotFoundError('Test plan not found');
        }

        res.status(200).json({
            metadata: { code: 200, message: 'OK' },
            data: testPlanWithComponents,
        });
    }

    /**
     * @swagger
     * /api/v1/test-plans/{planId}/execute:
     *   post:
     *     summary: Execute Selected Tests
     *     tags: [Test Plans]
     *     description: Executes the user-selected test components found in a specific test plan.
     *     parameters:
     *       - in: path
     *         name: planId
     *         required: true
     *         schema:
     *           type: string
     *           format: uuid
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
     *               integrationPlatformCredentials:
     *                 type: object
     *                 properties:
     *                   accountId:
     *                     type: string
     *                   username:
     *                     type: string
     *                   passwordOrToken:
     *                     type: string
     *               executionInstanceId:
     *                  type: string
     *                  example: "atom-12345"
     *     responses:
     *       '202':
     *         description: Accepted. The test execution has been initiated.
     *         content:
     *            application/json:
     *              schema:
     *                type: object
     *                properties:
     *                  metadata:
     *                    $ref: '#/components/schemas/ResponseMetadata'
     */
    public async executeTests(req: Request, res: Response): Promise<void> {
        const { planId } = req.params;
        const { testsToRun, integrationPlatformCredentials, executionInstanceId } = req.body;

        if (!testsToRun || !Array.isArray(testsToRun) || !integrationPlatformCredentials || !executionInstanceId) {
            throw new BadRequestError('testsToRun must be an array, and integrationPlatformCredentials and executionInstanceId must be provided.');
        }

        // The controller creates the concrete service
        const boomiService = new BoomiService(integrationPlatformCredentials);

        // We call the service without awaiting it, as before
        this.testPlanService.executeTests(planId, testsToRun, boomiService, executionInstanceId).catch(err => {
            console.error(`[Execution Error] for plan ${planId}:`, err);
        });

        res.status(202).json({
            metadata: { code: 202, message: 'Execution initiated' },
        });
    }
}