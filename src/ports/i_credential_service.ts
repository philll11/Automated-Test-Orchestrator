// src/ports/i_credential_service.ts

import { IntegrationPlatformCredentials } from '../domain/integration_platform_credentials.js';
import { CredentialProfile } from './i_secure_credential_service.js';

/**
 * Defines the contract for the application service that manages credential profiles.
 * This interface is the primary entry point for any driving adapter (e.g., REST API, CLI)
 * to interact with credential business logic.
 */
export interface ICredentialService {
  /**
   * Adds or updates a credential profile.
   *
   * @param profileName The name of the profile.
   * @param credentials The full credentials to be stored securely.
   * @returns A promise that resolves when the operation is complete.
   */
  add(profileName: string, credentials: IntegrationPlatformCredentials): Promise<void>;

  /**
   * Retrieves a list of all saved credential profiles in a display-safe format.
   *
   * @returns A promise that resolves with an array of all saved profiles.
   */
  list(): Promise<CredentialProfile[]>;

  /**
   * Deletes a credential profile by its name.
   *
   * @param profileName The name of the profile to delete.
   * @returns A promise that resolves with true if deletion was successful, false otherwise.
   */
  delete(profileName: string): Promise<boolean>;
}