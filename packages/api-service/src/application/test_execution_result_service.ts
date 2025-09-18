// src/application/test_execution_result_service.ts

import { injectable, inject } from 'inversify';
import { ITestExecutionResultService } from '../ports/i_test_execution_result_service.js';
import { ITestExecutionResultRepository, TestExecutionResultFilters } from '../ports/i_test_execution_result_repository.js';
import { TestExecutionResult } from '../domain/test_execution_result.js';
import { TYPES } from '../inversify.types.js';

@injectable()
export class TestExecutionResultService implements ITestExecutionResultService {
    constructor(
        @inject(TYPES.ITestExecutionResultRepository)
        private resultRepository: ITestExecutionResultRepository
    ) {}

    async getResults(filters: TestExecutionResultFilters): Promise<TestExecutionResult[]> {
        // The service's primary role here is to orchestrate,
        // delegating the filter logic to the repository layer.
        return this.resultRepository.findByFilters(filters);
    }
}