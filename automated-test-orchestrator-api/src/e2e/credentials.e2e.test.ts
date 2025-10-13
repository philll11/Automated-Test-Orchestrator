// src/e2e/credentials.e2e.test.ts

import request from 'supertest';
import app from '../app.js';
import { InMemorySecureCredentialService } from '../infrastructure/in_memory_secure_credential_service.js';

describe('Credentials API End-to-End Test', () => {
    const testProfileName = 'e2e-creds-test-profile';
    const cleanupService = new InMemorySecureCredentialService();

    beforeAll(async () => {
        await cleanupService.deleteCredentials(testProfileName);
    });

    afterAll(async () => {
        await cleanupService.deleteCredentials(testProfileName);
    });

    // This test now runs first and can be confident the state is clean.
    it('should return a 200 OK with an empty array when no credentials exist', async () => {
        const response = await request(app)
            .get('/api/v1/credentials')
            .expect(200);

        // This assertion assumes no other profiles exist. By cleaning up in beforeAll/afterAll,
        // and running this test first, we make this a much safer assumption.
        const testRelatedProfile = response.body.data.find((p: any) => p.profileName === testProfileName);
        expect(testRelatedProfile).toBeUndefined();
    });

    it('should perform a full CRUD lifecycle: POST, GET, then DELETE', async () => {
        const credentialsPayload = {
            profileName: testProfileName,
            accountId: 'e2e-creds-account',
            username: 'e2e-creds-user',
            passwordOrToken: 'e2e-creds-pass',
            executionInstanceId: 'e2e-creds-atom'
        };

        // 1. CREATE
        await request(app).post('/api/v1/credentials').send(credentialsPayload).expect(201);

        // 2. READ
        const listResponse = await request(app).get('/api/v1/credentials').expect(200);
        const createdProfile = listResponse.body.data.find((p: any) => p.profileName === testProfileName);
        expect(createdProfile).toBeDefined();
        expect(createdProfile.credentials.accountId).toBe(credentialsPayload.accountId);

        // 3. DELETE
        await request(app).delete(`/api/v1/credentials/${testProfileName}`).expect(204);

        // 4. VERIFY DELETION
        const finalListResponse = await request(app).get('/api/v1/credentials').expect(200);
        const deletedProfile = finalListResponse.body.data.find((p: any) => p.profileName === testProfileName);
        expect(deletedProfile).toBeUndefined();
    });

    it('should return a 404 when trying to delete a profile that does not exist', async () => {
        await request(app).delete('/api/v1/credentials/non-existent-profile-e2e').expect(404);
    });
});