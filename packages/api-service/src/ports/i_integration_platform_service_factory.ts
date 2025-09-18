// src/ports/i_integration_platform_service_factory.ts

import { IIntegrationPlatformService } from "./i_integration_platform_service.js";

/**
 * Defines the contract for a factory that creates instances of integration platform services.
 * This abstracts away the specific implementation details of how a service client is instantiated.
 */
export interface IIntegrationPlatformServiceFactory {
  /**
   * Creates an instance of an IIntegrationPlatformService based on a credential profile.
   *
   * @param profileName The name of the credential profile to use for configuration.
   * @returns A promise that resolves with a fully configured IIntegrationPlatformService instance.
   */
  create(profileName: string): Promise<IIntegrationPlatformService>;
}