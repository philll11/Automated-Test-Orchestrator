// src/ports/i_test_plan_entry_point_repository.ts

import { TestPlanEntryPoint } from '../domain/test_plan_entry_point.js';

export interface ITestPlanEntryPointRepository {
  saveAll(entryPoints: TestPlanEntryPoint[]): Promise<void>;
}