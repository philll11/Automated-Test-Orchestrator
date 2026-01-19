// src/infrastructure/integration_platform_service_factory.ts

import { injectable, inject } from 'inversify';
import { TYPES } from '../inversify.types.js';
import { IIntegrationPlatformServiceFactory } from '../ports/i_integration_platform_service_factory.js';
import { IIntegrationPlatformService } from '../ports/i_integration_platform_service.js';
import { ISecureCredentialService } from '../ports/i_secure_credential_service.js';
import { BoomiService } from './boomi/boomi_service.js';
import { NotFoundError } from '../utils/app_error.js';
import { IPlatformConfig } from './config.js';

@injectable()
export class IntegrationPlatformServiceFactory implements IIntegrationPlatformServiceFactory {
  constructor(
    @inject(TYPES.ISecureCredentialService) private secureCredentialService: ISecureCredentialService,
    @inject(TYPES.IPlatformConfig) private config: IPlatformConfig
  ) { }

  public async createService(profileName: string): Promise<IIntegrationPlatformService> {
    const credentials = await this.secureCredentialService.getCredentials(profileName);
    if (!credentials) {
      throw new NotFoundError(`Credential profile "${profileName}" not found.`);
    }

    // For now, we only have BoomiService. Pass the options to the constructor.
    return new BoomiService(credentials, this.config);
  }
}