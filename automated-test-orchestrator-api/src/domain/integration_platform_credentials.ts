// src/domain/integration_platform_credentials.ts

export interface IntegrationPlatformCredentials {
  accountId: string;
  username: string;
  passwordOrToken: string;
  executionInstanceId: string;
}