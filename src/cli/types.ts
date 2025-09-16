// src/cli/types.ts

// The new, more descriptive workflow statuses
export type CliTestPlanStatus =
  | 'DISCOVERING'
  | 'AWAITING_SELECTION'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'DISCOVERY_FAILED'
  | 'EXECUTION_FAILED';

// Represents a single test execution result
export interface CliTestExecutionResult {
  id: string;
  testComponentId: string;
  status: 'SUCCESS' | 'FAILURE';
  log?: string;
}

// Represents a discovered component, enriched with its available tests and results
export interface CliDiscoveredComponent {
  id: string;
  testPlanId: string;
  componentId: string;
  componentName?: string;
  componentType?: string;
  availableTests: string[];
  executionResults: CliTestExecutionResult[];
}

// Represents the entire Test Plan object returned by the API
export interface CliTestPlan {
  id: string;
  rootComponentId: string;
  status: CliTestPlanStatus;
  failureReason?: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  discoveredComponents: CliDiscoveredComponent[];
}

// Represents a single mapping record for the new mappings commands
export interface CliMapping {
    id: string;
    mainComponentId: string;
    testComponentId: string;
    testComponentName?: string;
    isDeployed?: boolean;
    isPackage?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// Represents the display-safe credential data returned by the API
export interface CliDisplayCredential {
  accountId: string;
  username: string;
  executionInstanceId: string;
}

// Represents a full credential profile as returned by the API
export interface CliCredentialProfile {
  profileName: string;
  credentials: CliDisplayCredential;
}