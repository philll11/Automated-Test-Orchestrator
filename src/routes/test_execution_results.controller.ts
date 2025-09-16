// src/routes/test_execution_results.controller.ts

import { injectable, inject } from 'inversify';
import { Request, Response, NextFunction } from 'express';
import { ITestExecutionResultService, TestExecutionResultFilters } from '../ports/i_test_execution_result_service.js';
import { TYPES } from '../inversify.types.js';

@injectable()
export class TestExecutionResultsController {
    constructor(
        @inject(TYPES.ITestExecutionResultService)
        private resultService: ITestExecutionResultService
    ) {}

    async getResults(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const { testPlanId, discoveredComponentId, testComponentId, status } = req.query;

            const filters: TestExecutionResultFilters = {};

            if (testPlanId && typeof testPlanId === 'string') {
                filters.testPlanId = testPlanId;
            }
            if (discoveredComponentId && typeof discoveredComponentId === 'string') {
                filters.discoveredComponentId = discoveredComponentId;
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