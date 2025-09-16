// src/domain/test_execution_result.ts

export interface TestExecutionResult {
  id: string;
  testPlanId: string; // FK to TestPlan
  rootComponentId: string; // From the joined TestPlan
  discoveredComponentId: string; // FK to DiscoveredComponent
  componentName?: string; // From the joined DiscoveredComponent
  testComponentId: string;
  testComponentName?: string; // From a joined Mapping
  status: 'SUCCESS' | 'FAILURE';
  log?: string;
  executedAt: Date;
}