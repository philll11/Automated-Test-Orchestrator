import request from 'supertest';
import nock from 'nock';
import { Pool } from 'pg';
import app from '../app';
import globalPool from '../infrastructure/database';

// --- Test Setup ---
const BOOMI_API_BASE = 'https://api.boomi.com';

describe('Discovery End-to-End Test', () => {
    let testPool: Pool;

    // Before all tests, set up the test database connection and nock
    beforeAll(() => {
        testPool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT || '5433', 10),
        });
    });

    // Before each test, clean up the database and nock
    beforeEach(async () => {
        await testPool.query('TRUNCATE TABLE discovered_components RESTART IDENTITY CASCADE');
        await testPool.query('TRUNCATE TABLE test_plans RESTART IDENTITY CASCADE');
        nock.cleanAll();
    });

    // After all tests, close the database connection
    afterAll(async () => {
        await testPool.end();
        await globalPool.end();
    });

    it('should successfully initiate discovery, process dependencies, and update the database', async () => {
        // --- Arrange ---
        const rootComponentId = 'root-e2e-123';
        const childComponentId = 'child-e2e-456';
        const credentials = {
            accountId: 'test-account-e2e',
            username: 'testuser',
            password_or_token: 'testpass',
        };
        const baseApiUrl = `/api/rest/v1/${credentials.accountId}`;
        const requestBody = { rootComponentId, boomiCredentials: credentials };

        // Mock the Boomi API dependency graph: root -> child, child -> []
        nock(BOOMI_API_BASE).get(`${baseApiUrl}/ComponentMetadata/${rootComponentId}`).reply(200, { version: 1 });
        nock(BOOMI_API_BASE).post(`${baseApiUrl}/ComponentReference/query`).reply(200, {
            numberOfResults: 1,
            result: [{ references: [{ componentId: childComponentId }] }],
        });
        nock(BOOMI_API_BASE).get(`${baseApiUrl}/ComponentMetadata/${childComponentId}`).reply(200, { version: 5 });
        nock(BOOMI_API_BASE).post(`${baseApiUrl}/ComponentReference/query`).reply(200, { numberOfResults: 0, result: [] });

        // --- Act & Assert (Phase 1: Initial API Call) ---
        const response = await request(app)
            .post('/api/v1/test-plans')
            .send(requestBody)
            .expect(202); // Assert the HTTP status code is 202 Accepted

        // Assert the immediate response body
        expect(response.body.data.id).toBeDefined();
        expect(response.body.data.status).toBe('PENDING');
        expect(response.body.data.rootComponentId).toBe(rootComponentId);

        const planId = response.body.data.id;

        // --- Wait for the asynchronous background process to complete ---
        // In a real-world complex test suite, you might poll the GET endpoint.
        // For this test, a simple timeout is sufficient and reliable.
        await new Promise(resolve => setTimeout(resolve, 500));

        // --- Assert (Phase 2: Final Database State) ---

        // 1. Check that the TestPlan was updated to AWAITING_SELECTION
        const planResult = await testPool.query('SELECT status FROM test_plans WHERE id = $1', [planId]);
        expect(planResult.rowCount).toBe(1);
        expect(planResult.rows[0].status).toBe('AWAITING_SELECTION');

        // 2. Check that the discovered components were saved correctly
        const componentsResult = await testPool.query('SELECT component_id FROM discovered_components WHERE test_plan_id = $1', [planId]);
        expect(componentsResult.rowCount).toBe(2); // root + child
        const discoveredIds = componentsResult.rows.map(r => r.component_id);
        expect(discoveredIds).toContain(rootComponentId);
        expect(discoveredIds).toContain(childComponentId);

        // 3. Verify that all mocked Boomi API endpoints were called
        expect(nock.isDone()).toBe(true);
    });
});