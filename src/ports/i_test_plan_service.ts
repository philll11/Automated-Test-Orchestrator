// src/ports/i_test_plan_service.ts
import { TestPlan } from "../domain/test_plan.js";
import { BoomiCredentials } from "./i_boomi_service.js";

export interface ITestPlanService {
  initiateDiscovery(rootComponentId: string, credentials: BoomiCredentials): Promise<TestPlan>;
  executeTests(planId: string, testsToRun: string[], credentials: BoomiCredentials, atomId: string): Promise<void>;
}
