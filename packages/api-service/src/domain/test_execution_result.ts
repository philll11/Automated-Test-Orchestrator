// src/domain/test_execution_result.ts

export interface TestExecutionResult {
  id: string;
  testPlanId: string; // FK to TestPlan
  planComponentId: string; // FK to PlanComponent
  componentName?: string; // From the joined PlanComponent
  testComponentId: string;
  testComponentName?: string; // From a joined Mapping
  status: 'SUCCESS' | 'FAILURE';
  log?: string;
  executedAt: Date;
}