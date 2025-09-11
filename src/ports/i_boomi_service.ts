// src/ports/i_boomi_service.ts

export interface BoomiCredentials {
    accountId: string;
    username: string;
    password_or_token: string;
}

export interface TestExecutionOptions {
  atomId: string;
}

export interface TestExecutionResult {
  status: 'SUCCESS' | 'FAILURE';
  message: string;
  executionLogUrl?: string;
}

export interface ComponentInfoAndDependencies {
  name: string;
  dependencyIds: string[];
}

export interface IBoomiService {
  getComponentInfoAndDependencies(componentId: string): Promise<ComponentInfoAndDependencies | null>;
  executeTestProcess(componentId: string, options: TestExecutionOptions): Promise<TestExecutionResult>;
}