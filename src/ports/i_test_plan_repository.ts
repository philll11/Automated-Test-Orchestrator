// src/ports/i_test_plan_repository.ts
import { TestPlan } from "../domain/test_plan";

export interface ITestPlanRepository {
  save(testPlan: TestPlan): Promise<TestPlan>;
  findById(id: string): Promise<TestPlan | null>;
  update(testPlan: TestPlan): Promise<TestPlan>;
}
