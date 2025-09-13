// src/cli/types.ts

export interface CliDiscoveredComponent {
  id: string;
  testPlanId: string;
  componentId: string;
  componentName: string | null;
  componentType: string | null;
  mappedTestId: string | null;
  executionStatus: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILURE' | null;
  executionLog: string | null;
}

export interface CliTestPlan {
  id: string;
  rootComponentId: string;
  status: 'PENDING' | 'AWAITING_SELECTION' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
  failureReason: string | null;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  discoveredComponents: CliDiscoveredComponent[];
}