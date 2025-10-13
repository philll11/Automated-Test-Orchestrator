// src/ports/i_test_execution_result_repository.ts

import { TestExecutionResult } from "../domain/test_execution_result.js";

// This type is for creating a new record. The enriched fields are for reading.
export type NewTestExecutionResult = Omit<TestExecutionResult, 'id' | 'executedAt' | 'componentName' | 'testComponentName'>;

export interface TestExecutionResultFilters {
  testPlanId?: string;
  planComponentId?: string;
  testComponentId?: string;
  status?: 'SUCCESS' | 'FAILURE';
}

export interface ITestExecutionResultRepository {
  /**
   * Saves a new test execution result to the datastore.
   * @param newResult The data for the new test execution result.
   */
  save(newResult: NewTestExecutionResult): Promise<TestExecutionResult>;

  /**
   * Finds all test execution results for a given set of plan component IDs.
   * @param planComponentIds An array of plan component UUIDs.
   */
  findByPlanComponentIds(planComponentIds: string[]): Promise<TestExecutionResult[]>;

  /**
   * Finds all test execution results matching the provided filters.
   * @param filters An object containing optional filter criteria.
   */
  findByFilters(filters: TestExecutionResultFilters): Promise<TestExecutionResult[]>;
}