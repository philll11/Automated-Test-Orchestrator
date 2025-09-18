// src/ports/i_secure_credential_service.ts

import { IntegrationPlatformCredentials } from '../domain/integration_platform_credentials.js';

/**
 * A type representing the credentials in a safe-to-display format,
 * omitting the sensitive password or token.
 */
export type DisplayCredential = Omit<IntegrationPlatformCredentials, 'passwordOrToken'>;

/**
 * A type representing a saved profile, containing its name and the
 * display-safe credential data.
 */
export type CredentialProfile = {
    profileName: string;
    credentials: DisplayCredential;
};

/**
 * Defines the contract for a service that securely stores and retrieves
 * Integration Platform credentials, abstracting the underlying storage mechanism (e.g.,
 * OS keychain, cloud vault).
 */
export interface ISecureCredentialService {
    /**
     * Securely saves a set of Integration Platform credentials under a specific profile name.
     *
     * @param profileName The alias for the credentials (e.g., 'dev-account').
     * @param credentials The Integration Platform credentials to store.
     * @returns A promise that resolves when the operation is complete.
     */
    addCredentials(profileName: string, credentials: IntegrationPlatformCredentials): Promise<void>;

    /**
     * Retrieves a set of Integration Platform credentials for a given profile name.
     *
     * @param profileName The alias of the credentials to retrieve.
     * @returns A promise that resolves with the credentials, or null if not found.
     */
    getCredentials(profileName: string): Promise<IntegrationPlatformCredentials | null>;

    /**
     * Retrieves all saved credential profiles in a display-safe format.
     *
     * @returns A promise that resolves with an array of all saved profiles.
     */
    getAllCredentials(): Promise<CredentialProfile[]>;


    /**
     * Deletes a credential profile.
     *
     * @param profileName The alias of the credentials to delete.
     * @returns A promise that resolves with true if deletion was successful, false otherwise.
     */
    deleteCredentials(profileName: string): Promise<boolean>;
}