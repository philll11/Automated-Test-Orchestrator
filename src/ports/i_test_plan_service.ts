// src/ports/i_test_plan_service.ts

import { TestPlan } from "../domain/test_plan.js";
import { PlanComponent } from '../domain/plan_component.js';
import { TestExecutionResult } from "../domain/test_execution_result.js";

export type PlanComponentDetails = PlanComponent & {
  availableTests: string[];
  executionResults: TestExecutionResult[];
};

export type TestPlanWithDetails = TestPlan & {
  planComponents: PlanComponentDetails[];
};

export interface ITestPlanService {
  /**
   * Retrieves a summary of all test plans.
   * @returns A promise that resolves to an array of TestPlan objects.
   */
  getAllPlans(): Promise<TestPlan[]>;
  
  /**
   * Retrieves a TestPlan and all of its associated components.
   * @param planId The ID of the test plan to retrieve.
   * @returns The complete test plan with components, or null if not found.
   */
  getPlanWithDetails(planId: string): Promise<TestPlanWithDetails | null>;

  /**
   * Initiates the asynchronous creation of a new test plan.
   * @param componentIds An array of one or more component IDs to seed the plan.
   * @param credentialProfile The name of the credential profile to use for authentication.
   * @param discoverDependencies If true, recursively finds all dependencies.
   * @returns A new TestPlan in a 'DISCOVERING' state.
   */
  initiateDiscovery(componentIds: string[], credentialProfile: string, discoverDependencies: boolean): Promise<TestPlan>;

  /**
   * Executes a selected list of tests for a given test plan.
   * @param planId The ID of the test plan.
   * @param testsToRun An array of test component IDs to execute.
   * @param credentialProfile The name of the credential profile to use for authentication and execution.
   */
  executeTests(planId: string, testsToRun: string[], credentialProfile: string): Promise<void>;
}