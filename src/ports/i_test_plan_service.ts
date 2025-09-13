// src/ports/i_test_plan_service.ts
import { TestPlan } from "../domain/test_plan.js";
import { IntegrationPlatformCredentials } from "./i_integration_platform_service.js";

export interface ITestPlanService {
  initiateDiscovery(rootComponentId: string, credentials: IntegrationPlatformCredentials): Promise<TestPlan>;
  executeTests(planId: string, testsToRun: string[], credentials: IntegrationPlatformCredentials, executionInstanceId: string): Promise<void>;
}
