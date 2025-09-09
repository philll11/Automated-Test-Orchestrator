// src/ports/i_test_plan_service.ts
import { TestPlan } from "../domain/test_plan";
import { BoomiCredentials } from "./i_boomi_service";

export interface ITestPlanService {
  initiateDiscovery(rootComponentId: string, credentials: BoomiCredentials): Promise<TestPlan>;
}
