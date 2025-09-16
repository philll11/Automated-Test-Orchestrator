// src/application/credential_service.ts

import { injectable, inject } from 'inversify';
import { TYPES } from '../inversify.types.js';
import { ICredentialService } from '../ports/i_credential_service.js';
import { ISecureCredentialService, CredentialProfile } from '../ports/i_secure_credential_service.js';
import { IntegrationPlatformCredentials } from '../domain/integration_platform_credentials.js';

@injectable()
export class CredentialService implements ICredentialService {
  private secureCredentialService: ISecureCredentialService;

  constructor(
    @inject(TYPES.ISecureCredentialService) secureCredentialService: ISecureCredentialService
  ) {
    this.secureCredentialService = secureCredentialService;
  }

  /**
   * Delegates the addition of a new credential profile to the underlying secure storage adapter.
   */
  public async add(profileName: string, credentials: IntegrationPlatformCredentials): Promise<void> {
    // In a more complex application, this is where business logic (e.g., validation,
    // logging, checks for existing profiles) would go. For now, it's a direct pass-through.
    return this.secureCredentialService.addCredentials(profileName, credentials);
  }

  /**
   * Delegates the listing of all profiles to the underlying secure storage adapter.
   */
  public async list(): Promise<CredentialProfile[]> {
    return this.secureCredentialService.getAllCredentials();
  }

  /**
   * Delegates the deletion of a profile to the underlying secure storage adapter.
   */
  public async delete(profileName: string): Promise<boolean> {
    return this.secureCredentialService.deleteCredentials(profileName);
  }
}