// src/e2e/discovery.e2e.test.ts

import request from 'supertest';
import nock from 'nock';
import pg from 'pg';
import app from '../app.js';
import globalPool from '../infrastructure/database.js';

// --- Test Setup ---
const BOOMI_API_BASE = 'https://api.boomi.com';

describe('Discovery End-to-End Test', () => {
    let testPool: pg.Pool;

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
        await testPool.query('TRUNCATE TABLE discovered_components RESTART IDENTITY CASCADE');
        await testPool.query('TRUNCATE TABLE test_plans RESTART IDENTITY CASCADE');
        nock.cleanAll();
    });

    afterAll(async () => {
        await testPool.end();
        await globalPool.end();
    });

    it('should successfully initiate discovery, process dependencies, and update the database with names and status', async () => {
        // --- Arrange ---
        const rootComponentId = 'root-e2e-123';
        const childComponentId = 'child-e2e-456';
        const credentials = {
            accountId: 'test-account-e2e',
            username: 'testuser',
            passwordOrToken: 'testpass',
        };
        const baseApiUrl = `/api/rest/v1/${credentials.accountId}`;
        const requestBody = { rootComponentId, integrationPlatformCredentials: credentials };

        // Mock the Boomi API to include component names
        nock(BOOMI_API_BASE).get(`${baseApiUrl}/ComponentMetadata/${rootComponentId}`).reply(200, { name: 'E2E Root Component', version: 1 });
        nock(BOOMI_API_BASE).post(`${baseApiUrl}/ComponentReference/query`).reply(200, {
            numberOfResults: 1,
            result: [{ references: [{ componentId: childComponentId }] }],
        });
        nock(BOOMI_API_BASE).get(`${baseApiUrl}/ComponentMetadata/${childComponentId}`).reply(200, { name: 'E2E Child Component', version: 5 });
        nock(BOOMI_API_BASE).post(`${baseApiUrl}/ComponentReference/query`).reply(200, { numberOfResults: 0, result: [] });

        // --- Act & Assert (Phase 1: Initial API Call) ---
        const response = await request(app)
            .post('/api/v1/test-plans')
            .send(requestBody)
            .expect(202);

        expect(response.body.data.id).toBeDefined();
        expect(response.body.data.status).toBe('PENDING');
        expect(response.body.data.rootComponentId).toBe(rootComponentId);

        const planId = response.body.data.id;

        // --- Wait for the asynchronous background process to complete ---
        await new Promise(resolve => setTimeout(resolve, 500));

        // --- Assert (Phase 2: Final Database State) ---

        // 1. Check that the TestPlan was updated to AWAITING_SELECTION
        const planResult = await testPool.query('SELECT status FROM test_plans WHERE id = $1', [planId]);
        expect(planResult.rowCount).toBe(1);
        expect(planResult.rows[0].status).toBe('AWAITING_SELECTION');

        // Check that discovered components were saved with all correct fields
        const componentsResult = await testPool.query(
            'SELECT component_id, component_name, execution_status FROM discovered_components WHERE test_plan_id = $1',
            [planId]
        );
        expect(componentsResult.rowCount).toBe(2);

        const rootComponent = componentsResult.rows.find(r => r.component_id === rootComponentId);
        const childComponent = componentsResult.rows.find(r => r.component_id === childComponentId);

        // Verify names were saved
        expect(rootComponent.component_name).toBe('E2E Root Component');
        expect(childComponent.component_name).toBe('E2E Child Component');

        // Verify default status was set
        expect(rootComponent.execution_status).toBe('PENDING');
        expect(childComponent.execution_status).toBe('PENDING');

        // 3. Verify that all mocked Boomi API endpoints were called
        expect(nock.isDone()).toBe(true);
    });
});