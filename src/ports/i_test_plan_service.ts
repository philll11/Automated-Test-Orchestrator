// src/ports/i_test_plan_service.ts

import { TestPlan } from "../domain/test_plan.js";
import { DiscoveredComponent } from '../domain/discovered_component.js';
import { IIntegrationPlatformService } from "./i_integration_platform_service.js";
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
   * Retrieves a TestPlan and all of its associated discovered components.
   * @param planId The ID of the test plan to retrieve.
   * @returns The complete test plan with components, or null if not found.
   */
  getPlanWithDetails(planId: string): Promise<TestPlanWithDetails | null>;

  /**
   * Initiates the asynchronous discovery of a component's dependency tree.
   * @param rootComponentId The starting component ID.
   * @param integrationPlatformService An initialized service for communicating with the integration platform.
   * @returns A new TestPlan in a 'PENDING' state.
   */
  initiateDiscovery(rootComponentId: string, integrationPlatformService: IIntegrationPlatformService): Promise<TestPlan>;

  /**
   * Executes a selected list of tests for a given test plan.
   * @param planId The ID of the test plan.
   * @param testsToRun An array of test component IDs to execute.
   * @param integrationPlatformService An initialized service for communicating with the integration platform.
   * @param executionInstanceId An identifier for the specific execution environment (e.g., an Atom ID).
   */
  executeTests(planId: string, testsToRun: string[], integrationPlatformService: IIntegrationPlatformService, executionInstanceId: string): Promise<void>;
}