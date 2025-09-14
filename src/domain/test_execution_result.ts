// src/domain/test_execution_result.ts

export interface TestExecutionResult {
  id: string;
  discoveredComponentId: string; // FK to DiscoveredComponent
  testComponentId: string;
  status: 'SUCCESS' | 'FAILURE';
  log?: string;
  executedAt: Date;
}