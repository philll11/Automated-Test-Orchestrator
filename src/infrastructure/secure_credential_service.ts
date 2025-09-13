// src/infrastructure/secure_credential_service.ts

import keytar from 'keytar';
import { ISecureCredentialService, CredentialProfile, } from '../ports/i_secure_credential_service.js';
import {IntegrationPlatformCredentials } from '../domain/integration_platform_credentials.js';
import { AppError } from '../utils/app_error.js';


export class SecureCredentialService implements ISecureCredentialService {
  private readonly serviceName = 'automated-test-orchestrator';

  async addCredentials(profileName: string, credentials: IntegrationPlatformCredentials): Promise<void> {
    const serializedCredentials = JSON.stringify(credentials);
    await keytar.setPassword(this.serviceName, profileName, serializedCredentials);
  }

  async getCredentials(profileName: string): Promise<IntegrationPlatformCredentials | null> {
    const serializedCredentials = await keytar.getPassword(this.serviceName, profileName);

    if (!serializedCredentials) {
      return null;
    }

    try {
      const credentials = JSON.parse(serializedCredentials) as IntegrationPlatformCredentials;
      return credentials;
    } catch (error) {
      throw new AppError(
        `Failed to parse stored credentials for profile "${profileName}". The data may be corrupt.`,
        500
      );
    }
  }

  async getAllCredentials(): Promise<CredentialProfile[]> {
    const allFoundCredentials = await keytar.findCredentials(this.serviceName);
    const profiles: CredentialProfile[] = [];

    for (const found of allFoundCredentials) {
      try {
        const fullCreds = JSON.parse(found.password) as IntegrationPlatformCredentials;
        profiles.push({
          profileName: found.account, // keytar uses 'account' for the profile name
          credentials: {
            accountId: fullCreds.accountId,
            username: fullCreds.username,
            executionInstanceId: fullCreds.executionInstanceId,
          },
        });
      } catch (e) {
        // Log a warning but continue, in case one profile is corrupt
        console.warn(`Could not parse stored profile "${found.account}". It may be corrupt. Skipping.`);
      }
    }
    return profiles;
  }

  async deleteCredentials(profileName: string): Promise<boolean> {
    return keytar.deletePassword(this.serviceName, profileName);
  }
}