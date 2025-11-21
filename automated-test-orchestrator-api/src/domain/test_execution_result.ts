// src/domain/test_execution_result.ts

export interface TestCaseResult {
  testCaseId?: string;
  testDescription: string;
  status: 'PASSED' | 'FAILED';
  details?: string;
}

export interface TestExecutionResult {
  id: string;
  testPlanId: string; // FK to TestPlan
  testPlanName?: string; // From the joined TestPlan
  planComponentId: string; // FK to PlanComponent
  componentName?: string; // From the joined PlanComponent
  testComponentId: string;
  testComponentName?: string; // From a joined Mapping
  status: 'SUCCESS' | 'FAILURE';
  message?: string;
  testCases?: TestCaseResult[]; 
  executedAt: Date;
}