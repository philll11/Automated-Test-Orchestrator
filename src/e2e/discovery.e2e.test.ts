// src/e2e/discovery.e2e.test.ts

import request from 'supertest';
import nock from 'nock';
import pg from 'pg';
import app from '../app.js';
import globalPool from '../infrastructure/database.js';
import { v4 as uuidv4 } from 'uuid';

const BOOMI_API_BASE = 'https://api.boomi.com';

describe('Discovery End-to-End Test', () => {
    let testPool: pg.Pool;
    const testProfileName = 'e2e-test-profile';
    const credentials = {
        accountId: 'test-account-e2e',
        username: 'testuser',
        passwordOrToken: 'testpass',
        executionInstanceId: 'atom-e2e'
    };

    beforeAll(() => {
        testPool = new pg.Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT || '5433', 10),
        });
    });

    beforeEach(async () => {
        await testPool.query('TRUNCATE TABLE test_plans RESTART IDENTITY CASCADE');
        await testPool.query('TRUNCATE TABLE mappings RESTART IDENTITY CASCADE');
        nock.cleanAll();

        // Create the credential profile required for the test via the API.
        // This is a critical setup step for the new workflow.
        await request(app)
            .post('/api/v1/credentials')
            .send({ profileName: testProfileName, ...credentials })
            .expect(201);
    });

    afterEach(async () => {
        await request(app).delete(`/api/v1/credentials/${testProfileName}`).expect(204); // Clean up the created profile
    });

    // --- UPDATED afterAll block ---
    afterAll(async () => {
        await testPool.end();
        await globalPool.end(); // Ensure the global pool is also closed
    });

    it('should successfully initiate discovery and retrieve the detailed plan', async () => {
        // --- Arrange ---
        const rootComponentId = 'root-e2e-123';
        const childComponentId = 'child-e2e-456';
        const baseApiUrl = `/api/rest/v1/${credentials.accountId}`;
        const requestBody = { rootComponentId, credentialProfile: testProfileName };

        await testPool.query(
            'INSERT INTO mappings (id, main_component_id, test_component_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
            [uuidv4(), childComponentId, 'test-for-child-e2e']
        );

        const boomiScope = nock(BOOMI_API_BASE)
            // 1. Get metadata for the root component
            .get(`${baseApiUrl}/ComponentMetadata/${rootComponentId}`)
            .reply(200, { name: 'E2E Root Component', version: 1, type: 'PROCESS' })
            // 2. Query for root component's dependencies
            .post(`${baseApiUrl}/ComponentReference/query`)
            .reply(200, { numberOfResults: 1, result: [{ references: [{ componentId: childComponentId }] }] })
            // 3. Get metadata for the child component
            .get(`${baseApiUrl}/ComponentMetadata/${childComponentId}`)
            .reply(200, { name: 'E2E Child Component', version: 5, type: 'PROCESS' })
            // 4. Query for child component's dependencies (finds none)
            .post(`${baseApiUrl}/ComponentReference/query`)
            .reply(200, { numberOfResults: 0, result: [] });

        // --- Act & Assert (Phase 1: Initial API Call) ---
        const initialResponse = await request(app).post('/api/v1/test-plans').send(requestBody).expect(202);
        const planId = initialResponse.body.data.id;
        expect(initialResponse.body.data.status).toBe('DISCOVERING');

        // --- Wait for async background process ---
        await new Promise(resolve => setTimeout(resolve, 500));

        // --- Assert (Phase 2: Database State) ---
        const planResult = await testPool.query('SELECT status FROM test_plans WHERE id = $1', [planId]);
        expect(planResult.rowCount).toBe(1);
        expect(planResult.rows[0].status).toBe('AWAITING_SELECTION');

        const componentsResult = await testPool.query('SELECT component_id, component_name FROM discovered_components WHERE test_plan_id = $1', [planId]);
        expect(componentsResult.rowCount).toBe(2);

        // --- Assert (Phase 3: GET Plan Details) ---
        const detailsResponse = await request(app).get(`/api/v1/test-plans/${planId}`).expect(200);
        const planDetails = detailsResponse.body.data;
        const rootDetails = planDetails.discoveredComponents.find((c: any) => c.componentId === rootComponentId);
        const childDetails = planDetails.discoveredComponents.find((c: any) => c.componentId === childComponentId);
        
        expect(rootDetails.availableTests).toEqual([]); // The root component has no mapped test
        expect(childDetails.availableTests).toEqual(['test-for-child-e2e']); // The child component has a mapped test
        
        expect(boomiScope.isDone()).toBe(true); // Verify all nock mocks were called
    });
});