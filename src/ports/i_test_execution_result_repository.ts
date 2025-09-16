// src/ports/i_test_execution_result_repository.ts

import { TestExecutionResult } from "../domain/test_execution_result.js";

// This type is for creating a new record. The enriched fields are for reading.
export type NewTestExecutionResult = Omit<TestExecutionResult, 'id' | 'executedAt' | 'rootComponentId' | 'componentName' | 'testComponentName'>;

export interface TestExecutionResultFilters {
  testPlanId?: string;
  discoveredComponentId?: string;
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
   * Finds all test execution results for a given set of discovered component IDs.
   * @param discoveredComponentIds An array of discovered component UUIDs.
   */
  findByDiscoveredComponentIds(discoveredComponentIds: string[]): Promise<TestExecutionResult[]>;

  /**
   * Finds all test execution results matching the provided filters.
   * @param filters An object containing optional filter criteria.
   */
  findByFilters(filters: TestExecutionResultFilters): Promise<TestExecutionResult[]>;
}