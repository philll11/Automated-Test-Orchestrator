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

export interface IBoomiService {
  getComponentDependencies(rootComponentId: string): Promise<string[]>;
  executeTestProcess(componentId: string, options: TestExecutionOptions): Promise<TestExecutionResult>;
}
