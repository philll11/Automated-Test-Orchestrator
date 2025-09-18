// src/routes/test_plans.controller.ts

import { Request, Response } from 'express';
import { injectable, inject } from 'inversify';
import { TYPES } from '../inversify.types.js';
import { ITestPlanService } from '../ports/i_test_plan_service.js';
import { BadRequestError, NotFoundError } from '../utils/app_error.js';

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
     *     summary: Create a new Test Plan
     *     tags: [Test Plans]
     *     description: Creates a new test plan from a list of components. The creation process runs asynchronously. Set `discoverDependencies` to true to recursively find all dependencies for the provided components.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - componentIds
     *               - credentialProfile
     *             properties:
     *               componentIds:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: "An array of one or more component IDs to include in the plan."
     *                 example: ["2582515a-40fb-4d5d-bcc9-10817caa4fa2", "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6"]
     *               credentialProfile:
     *                 type: string
     *                 description: "The name of the credential profile to use."
     *                 example: "dev-account"
     *               discoverDependencies:
     *                 type: boolean
     *                 description: "If true, the system will discover all dependencies for the provided componentIds. Defaults to false."
     *                 example: false
     *     responses:
     *       '202':
     *         description: Accepted. The test plan creation process has been initiated.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse_TestPlan'
     *       '400':
     *         description: Bad Request. Missing or invalid required fields.
     */
    public async initiateDiscovery(req: Request, res: Response): Promise<void> {
        const { componentIds, credentialProfile, discoverDependencies } = req.body;

        if (!credentialProfile || !Array.isArray(componentIds) || componentIds.length === 0) {
            throw new BadRequestError('credentialProfile and a non-empty componentIds array are required');
        }

        const testPlan = await this.testPlanService.initiateDiscovery(
            componentIds,
            credentialProfile,
            discoverDependencies ?? false // Default to false if undefined
        );

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
     *     summary: Execute Tests for a Plan
     *     tags: [Test Plans]
     *     description: >
     *       Executes tests found in a specific test plan. 
     *       If the 'testsToRun' array is provided, only those tests will be run.
     *       If 'testsToRun' is omitted, all available tests in the plan will be executed.
     *     parameters:
     *       - in: path
     *         name: planId
     *         required: true
     *         schema: { type: string, format: uuid }
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - credentialProfile
     *             properties:
     *               testsToRun:
     *                 type: array
     *                 items:
     *                   type: string
     *                 description: "Optional. An array of specific test component IDs to run."
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

        if (!credentialProfile) {
            throw new BadRequestError('credentialProfile must be provided.');
        }

        if (testsToRun !== undefined && !Array.isArray(testsToRun)) {
            throw new BadRequestError('If provided, testsToRun must be an array.');
        }

        this.testPlanService.executeTests(planId, testsToRun, credentialProfile).catch(err => {
            console.error(`[Execution Error] Unhandled rejection for plan ${planId}:`, err);
        });

        res.status(202).json({
            metadata: { code: 202, message: 'Execution initiated' },
        });
    }
}