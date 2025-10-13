// src/routes/test_execution_results.controller.ts

import { injectable, inject } from 'inversify';
import { Request, Response, NextFunction } from 'express';
import { ITestExecutionResultService, TestExecutionResultFilters } from '../ports/i_test_execution_result_service.js';
import { TYPES } from '../inversify.types.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     TestExecutionResult:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         testPlanId:
 *           type: string
 *           format: uuid
 *         planComponentId:
 *           type: string
 *           format: uuid
 *         componentName:
 *           type: string
 *           nullable: true
 *           description: The name of the component that was tested.
 *         testComponentId:
 *           type: string
 *           description: The ID of the test that was executed.
 *         testComponentName:
 *           type: string
 *           nullable: true
 *           description: The name of the test that was executed.
 *         status:
 *           type: string
 *           enum: [SUCCESS, FAILURE]
 *         log:
 *           type: string
 *           nullable: true
 *           description: The execution log, often containing error details for failures.
 *         executedAt:
 *           type: string
 *           format: date-time
 *     ApiResponse_TestExecutionResultList:
 *       type: object
 *       properties:
 *         metadata:
 *           $ref: '#/components/schemas/ResponseMetadata'
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TestExecutionResult'
 */
@injectable()
export class TestExecutionResultsController {
    constructor(
        @inject(TYPES.ITestExecutionResultService)
        private resultService: ITestExecutionResultService
    ) { }

    /**
     * @swagger
     * /test-execution-results:
     *   get:
     *     summary: Query Test Execution Results
     *     tags: [Test Execution Results]
     *     description: Retrieves a list of test execution results, with optional filters.
     *     parameters:
     *       - in: query
     *         name: testPlanId
     *         schema:
     *           type: string
     *           format: uuid
     *         description: Filter results by a specific Test Plan ID.
     *       - in: query
     *         name: planComponentId
     *         schema:
     *           type: string
     *           format: uuid
     *         description: Filter results by a specific Plan Component ID.
     *       - in: query
     *         name: testComponentId
     *         schema:
     *           type: string
     *         description: Filter results by a specific Test Component ID.
     *       - in: query
     *         name: status
     *         schema:
     *           type: string
     *           enum: [SUCCESS, FAILURE]
     *         description: Filter results by execution status.
     *     responses:
     *       '200':
     *         description: OK. A list of test execution results matching the filters.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ApiResponse_TestExecutionResultList'
     */
    async getResults(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { testPlanId, planComponentId, testComponentId, status } = req.query;

            const filters: TestExecutionResultFilters = {};

            if (testPlanId && typeof testPlanId === 'string') {
                filters.testPlanId = testPlanId;
            }
            if (planComponentId && typeof planComponentId === 'string') {
                filters.planComponentId = planComponentId;
            }
            if (testComponentId && typeof testComponentId === 'string') {
                filters.testComponentId = testComponentId;
            }
            if (status === 'SUCCESS' || status === 'FAILURE') {
                filters.status = status;
            }

            const results = await this.resultService.getResults(filters);
            res.status(200).json(results);
        } catch (error) {
            next(error);
        }
    }
}