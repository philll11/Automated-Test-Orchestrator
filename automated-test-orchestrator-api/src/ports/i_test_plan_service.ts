// src/ports/i_test_plan_service.ts

import { TestPlan, TestPlanType } from "../domain/test_plan.js";
import { PlanComponent } from '../domain/plan_component.js';
import { TestExecutionResult } from "../domain/test_execution_result.js";
import { AvailableTestInfo } from "./i_mapping_repository.js";

export type PlanComponentDetails = PlanComponent & {
  availableTests: AvailableTestInfo[];
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
   * @param name A descriptive name for the test plan.
   * @param planType The mode of operation (COMPONENT or TEST).
   * @param componentIds An array of one or more component IDs to seed the plan.
   * @param credentialProfile The name of the credential profile to use for authentication.
   * @param discoverDependencies If true, recursively finds all dependencies.
   * @returns A new TestPlan in a 'DISCOVERING' state.
   */
  initiateDiscovery(name: string, planType: TestPlanType, componentIds: string[], credentialProfile: string, discoverDependencies: boolean): Promise<TestPlan>;

  /**
   * Prepares a test plan for execution by validating its state, clearing previous results,
   * and setting its status to 'EXECUTING'. This must be awaited before triggering execution.
   * @param planId The ID of the test plan.
   */
  prepareForExecution(planId: string): Promise<void>;

  /**
   * Runs the actual test execution logic in the background.
   * @param planId The ID of the test plan.
   * @param testsToRun An optional array of test component IDs to execute.
   * @param credentialProfile The name of the credential profile to use for authentication and execution.
   */
  runTestExecution(planId: string, testsToRun: string[] | undefined, credentialProfile: string): Promise<void>;

  /**
   * Deletes a test plan and all of its associated data.
   * @param planId The ID of the test plan to delete.
   * @throws {NotFoundError} If no test plan with the given ID is found.
   */
  deletePlan(planId: string): Promise<void>;
}