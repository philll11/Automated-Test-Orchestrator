// src/ports/i_test_execution_result_service.ts

import { TestExecutionResult } from '../domain/test_execution_result.js';
import { TestExecutionResultFilters } from './i_test_execution_result_repository.js';

export { TestExecutionResultFilters };

export interface ITestExecutionResultService {
  /**
   * Retrieves test execution results based on a set of filters.
   * @param filters The criteria to filter the results by.
   */
  getResults(filters: TestExecutionResultFilters): Promise<TestExecutionResult[]>;
}