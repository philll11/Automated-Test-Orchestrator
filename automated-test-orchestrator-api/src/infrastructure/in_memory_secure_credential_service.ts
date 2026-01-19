// src/infrastructure/in_memory_secure_credential_service.ts

import { injectable } from 'inversify';
import { ISecureCredentialService, CredentialProfile } from '../ports/i_secure_credential_service.js';
import { IntegrationPlatformCredentials } from '../domain/integration_platform_credentials.js';

@injectable()
export class InMemorySecureCredentialService implements ISecureCredentialService {
  private store = new Map<string, IntegrationPlatformCredentials>();

  constructor() {
    // Adapter initialized
  }

  async addCredentials(profileName: string, credentials: IntegrationPlatformCredentials): Promise<void> {
    this.store.set(profileName, credentials);
  }

  async getCredentials(profileName: string): Promise<IntegrationPlatformCredentials | null> {
    return this.store.get(profileName) || null;
  }

  async getAllCredentials(): Promise<CredentialProfile[]> {
    return Array.from(this.store.entries()).map(([profileName, creds]) => ({
      profileName,
      credentials: {
        accountId: creds.accountId,
        username: creds.username,
        executionInstanceId: creds.executionInstanceId,
      },
    }));
  }

  async deleteCredentials(profileName: string): Promise<boolean> {
    return this.store.delete(profileName);
  }
}