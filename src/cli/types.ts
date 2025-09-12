// src/cli/types.ts

export interface CliDiscoveredComponent {
  id: string;
  test_plan_id: string;
  component_id: string;
  component_name: string | null;
  mapped_test_id: string | null;
  execution_status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILURE' | null;
  execution_log: string | null;
}

export interface CliTestPlan {
  id: string;
  root_component_id: string;
  status: 'PENDING' | 'AWAITING_SELECTION' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
  failure_reason: string | null;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
  discoveredComponents: CliDiscoveredComponent[];
}