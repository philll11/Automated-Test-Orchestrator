// src/routes/test_plans.controller.ts

import { Request, Response } from 'express';
import { injectable, inject } from 'inversify';
import { TYPES } from '../inversify.types.js';
import { ITestPlanService } from '../ports/i_test_plan_service.js';
import { BadRequestError, NotFoundError } from '../utils/app_error.js';
// REMOVED: The controller no longer has knowledge of the specific integration platform implementation.

@injectable()
export class TestPlanController {
    constructor(
        @inject(TYPES.ITestPlanService) private testPlanService: ITestPlanService
    ) { }

    /**
     * @swagger
     * /api/v1/test-plans:
     *   get:
     *     summary: Get All Test Plans
     *     tags: [Test Plans]
     *     description: Retrieves a list of all test plans that have been initiated.
     *     responses:
     *       '200':
     *         description: OK. An array of test plan summary objects.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 metadata:
     *                   type: object
     *                   properties:
     *                     code:
     *                       type: integer
     *                       example: 200
     *                     message:
     *                       type: string
     *                       example: OK
     *                 data:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/TestPlan'
     */
    public async getAllPlans(req: Request, res: Response): Promise<void> {
        const testPlans = await this.testPlanService.getAllPlans();
        res.status(200).json({
            metadata: { code: 200, message: 'OK' },
            data: testPlans,
        });
    }

    /**
     * @swagger
     * /api/v1/test-plans:
     *   post:
     *     summary: Initiate Discovery
     *     tags: [Test Plans]
     *     description: Initiates a new run by providing a root Component ID and a credential profile name. The discovery process runs asynchronously.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - rootComponentId
     *               - credentialProfile
     *             properties:
     *               rootComponentId:
     *                 type: string
     *                 example: "2582515a-40fb-4d5d-bcc9-10817caa4fa2"
     *               credentialProfile:
     *                 type: string
     *                 example: "dev-account"
     *     responses:
     *       '202':
     *         description: Accepted. The discovery process has been initiated.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse_TestPlan'
     *       '400':
     *         description: Bad Request. Missing required fields.
     */
    public async initiateDiscovery(req: Request, res: Response): Promise<void> {
        const { rootComponentId, credentialProfile } = req.body;
        if (!rootComponentId || !credentialProfile) {
            throw new BadRequestError('rootComponentId and credentialProfile are required');
        }

        const testPlan = await this.testPlanService.initiateDiscovery(rootComponentId, credentialProfile);

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
     *     description: Executes the user-selected test components found in a specific test plan using a credential profile.
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
     *             required:
     *               - testsToRun
     *               - credentialProfile
     *             properties:
     *               testsToRun:
     *                 type: array
     *                 items:
     *                   type: string
     *                 example: ["TEST-xyz-789"]
     *               credentialProfile:
     *                 type: string
     *                 example: "dev-account"
     *     responses:
     *       '202':
     *         description: Accepted. The test execution has been initiated.
     */
    public async executeTests(req: Request, res: Response): Promise<void> {
        const { planId } = req.params;
        const { testsToRun, credentialProfile } = req.body;

        if (!testsToRun || !Array.isArray(testsToRun) || !credentialProfile) {
            throw new BadRequestError('testsToRun (as an array) and credentialProfile must be provided.');
        }

        this.testPlanService.executeTests(planId, testsToRun, credentialProfile).catch(err => {
            console.error(`[Execution Error] Unhandled rejection for plan ${planId}:`, err);
        });

        res.status(202).json({
            metadata: { code: 202, message: 'Execution initiated' },
        });
    }
}