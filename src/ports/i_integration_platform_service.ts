// src/ports/i_integration_platform_service.ts

export interface IntegrationPlatformCredentials {
    accountId: string;
    username: string;
    passwordOrToken: string;
}

export interface TestExecutionOptions {
  executionInstanceId: string;
}

export interface TestExecutionResult {
  status: 'SUCCESS' | 'FAILURE';
  message: string;
  executionLogUrl?: string;
}

export interface ComponentInfo {
  id: string;
  name: string;
  type: string;
  dependencyIds: string[];
}

export interface IIntegrationPlatformService {
  getComponentInfoAndDependencies(componentId: string): Promise<ComponentInfo | null>;
  executeTestProcess(componentId: string, options: TestExecutionOptions): Promise<TestExecutionResult>;
}