// src/ports/i_integration_platform_service.ts

export interface IntegrationPlatformCredentials {
  accountId: string;
  username: string;
  passwordOrToken: string;
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
  /**
 * Retrieves metadata for a single component, without its dependencies.
 * @param componentId The ID of the component to look up.
 */
  getComponentInfo(componentId: string): Promise<ComponentInfo | null>;

  /**
   * Retrieves metadata for a component AND the IDs of its direct dependencies.
   * @param componentId The ID of the component to look up.
   */
  getComponentInfoAndDependencies(componentId: string): Promise<ComponentInfo | null>;

  /**
   * Executes a test process and polls for the result.
   * @param componentId The ID of the test process component to execute.
   */
  executeTestProcess(componentId: string): Promise<TestExecutionResult>;
}