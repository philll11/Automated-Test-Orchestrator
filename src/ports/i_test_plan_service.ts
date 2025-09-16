// src/ports/i_test_plan_service.ts

import { TestPlan } from "../domain/test_plan.js";
import { DiscoveredComponent } from '../domain/discovered_component.js';
import { TestExecutionResult } from "../domain/test_execution_result.js";

export type DiscoveredComponentDetails = DiscoveredComponent & {
  availableTests: string[];
  executionResults: TestExecutionResult[];
};

export type TestPlanWithDetails = TestPlan & {
  discoveredComponents: DiscoveredComponentDetails[];
};

export interface ITestPlanService {
  /**
   * Retrieves a summary of all test plans.
   * @returns A promise that resolves to an array of TestPlan objects.
   */
  getAllPlans(): Promise<TestPlan[]>;
  
  /**
   * Retrieves a TestPlan and all of its associated discovered components.
   * @param planId The ID of the test plan to retrieve.
   * @returns The complete test plan with components, or null if not found.
   */
  getPlanWithDetails(planId: string): Promise<TestPlanWithDetails | null>;

  /**
   * Initiates the asynchronous discovery of a component's dependency tree.
   * @param rootComponentId The starting component ID.
   * @param credentialProfile The name of the credential profile to use for authentication.
   * @returns A new TestPlan in a 'DISCOVERING' state.
   */
  initiateDiscovery(rootComponentId: string, credentialProfile: string): Promise<TestPlan>;

  /**
   * Executes a selected list of tests for a given test plan.
   * @param planId The ID of the test plan.
   * @param testsToRun An array of test component IDs to execute.
   * @param credentialProfile The name of the credential profile to use for authentication and execution.
   */
  executeTests(planId: string, testsToRun: string[], credentialProfile: string): Promise<void>;
}