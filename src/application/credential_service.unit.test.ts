// src/application/credential_service.unit.test.ts

import { CredentialService } from './credential_service.js';
import { ISecureCredentialService, CredentialProfile } from '../ports/i_secure_credential_service.js';
import { IntegrationPlatformCredentials } from '../domain/integration_platform_credentials.js';

// --- JEST MOCK FOR THE SECURE CREDENTIAL SERVICE PORT ---
const mockSecureCredentialService: jest.Mocked<ISecureCredentialService> = {
    addCredentials: jest.fn(),
    getCredentials: jest.fn(),
    getAllCredentials: jest.fn(),
    deleteCredentials: jest.fn(),
};

describe('CredentialService', () => {
    let service: CredentialService;

    beforeEach(() => {
        // Clear all mock implementations and call history before each test
        jest.clearAllMocks();

        // Create a new instance of the service with the mocked dependency
        service = new CredentialService(mockSecureCredentialService);
    });

    describe('add', () => {
        it('should delegate the call to the secure credential service addCredentials method', async () => {
            const profileName = 'test-profile';
            const creds: IntegrationPlatformCredentials = {
                accountId: 'acc-123',
                username: 'user',
                passwordOrToken: 'secret',
                executionInstanceId: 'atom-456',
            };

            // The 'add' method doesn't return anything, so we don't need to mock a return value.
            // We just need to check that the underlying method is called.
            await service.add(profileName, creds);

            expect(mockSecureCredentialService.addCredentials).toHaveBeenCalledTimes(1);
            expect(mockSecureCredentialService.addCredentials).toHaveBeenCalledWith(profileName, creds);
        });
    });

    describe('list', () => {
        it('should delegate the call to the secure credential service getAllCredentials method and return the result', async () => {
            const mockProfiles: CredentialProfile[] = [
                {
                    profileName: 'profile1',
                    credentials: { accountId: 'acc-1', username: 'user1', executionInstanceId: 'atom-1' }
                },
                {
                    profileName: 'profile2',
                    credentials: { accountId: 'acc-2', username: 'user2', executionInstanceId: 'atom-2' }
                },
            ];

            // Configure the mock to return our test data
            mockSecureCredentialService.getAllCredentials.mockResolvedValue(mockProfiles);

            const result = await service.list();

            expect(mockSecureCredentialService.getAllCredentials).toHaveBeenCalledTimes(1);
            expect(result).toBe(mockProfiles);
            expect(result).toHaveLength(2);
        });
    });

    describe('delete', () => {
        it('should delegate the call to the secure credential service deleteCredentials method and return the result', async () => {
            const profileName = 'profile-to-delete';

            // Configure the mock to return 'true' for a successful deletion
            mockSecureCredentialService.deleteCredentials.mockResolvedValue(true);

            const result = await service.delete(profileName);

            expect(mockSecureCredentialService.deleteCredentials).toHaveBeenCalledTimes(1);
            expect(mockSecureCredentialService.deleteCredentials).toHaveBeenCalledWith(profileName);
            expect(result).toBe(true);
        });
    });
});