// src/e2e/live_system.e2e.test.ts

import request from 'supertest';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import app from '../app.js';
import globalPool from '../infrastructure/database.js';

// Helper function for polling the status endpoint
const pollForStatus = async (planId: string, targetStatus: string, timeout: number = 20000): Promise<any> => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const res = await request(app).get(`/api/v1/test-plans/${planId}`);
        if (res.body.data && res.body.data.status === targetStatus) {
            return res.body.data;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error(`Polling timed out after ${timeout}ms waiting for status: ${targetStatus}`);
};

describe('Live System End-to-End Tests', () => {
    let testPool: Pool;
    const liveTestProfileName = 'live-system-e2e-profile';
    const liveCredentials = {
        accountId: process.env.BOOMI_TEST_ACCOUNT_ID!,
        username: process.env.BOOMI_TEST_USERNAME!,
        passwordOrToken: process.env.BOOMI_TEST_TOKEN!,
        executionInstanceId: process.env.BOOMI_TEST_ATOM_ID!,
    };
    const rootComponentId = process.env.BOOMI_TEST_ROOT_COMPONENT_ID!;
    const mappedTestId = process.env.BOOMI_TEST_MAPPED_TEST_ID!;

    beforeAll(async () => {
        if (!liveCredentials.accountId || !liveCredentials.username || !liveCredentials.passwordOrToken || !liveCredentials.executionInstanceId || !rootComponentId || !mappedTestId) {
            throw new Error('Missing one or more required BOOMI_TEST environment variables. Skipping live tests.');
        }
        testPool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT || '5433', 10),
        });

        await request(app)
            .post('/api/v1/credentials')
            .send({ profileName: liveTestProfileName, ...liveCredentials })
            .expect(201);
    });

    beforeEach(async () => {
        // Clean all tables before every test for perfect isolation
        await testPool.query('TRUNCATE TABLE test_plans, discovered_components, mappings, test_execution_results RESTART IDENTITY CASCADE');
    });

    afterAll(async () => {
        await request(app).delete(`/api/v1/credentials/${liveTestProfileName}`);
        await testPool.end();
        await globalPool.end();
    });

    // --- Test Suite for the Mappings API ---
    describe('Mappings Administration', () => {
        it('should allow creating and deleting a mapping via the API', async () => {
            const newMainComponentId = rootComponentId;
            const newTestComponentId = mappedTestId;

            // 1. CREATE the mapping
            const createResponse = await request(app)
                .post('/api/v1/mappings')
                .send({ mainComponentId: newMainComponentId, testComponentId: newTestComponentId })
                .expect(201);

            const newMappingId = createResponse.body.data.id;
            expect(newMappingId).toBeDefined();

            // 2. VERIFY creation in the database
            const dbResult = await testPool.query('SELECT * FROM mappings WHERE id = $1', [newMappingId]);
            expect(dbResult.rowCount).toBe(1);
            expect(dbResult.rows[0].test_component_id).toBe(newTestComponentId);

            // 3. DELETE the mapping
            await request(app)
                .delete(`/api/v1/mappings/${newMappingId}`)
                .expect(204);

            // 4. VERIFY deletion in the database
            const finalDbResult = await testPool.query('SELECT * FROM mappings WHERE id = $1', [newMappingId]);
            expect(finalDbResult.rowCount).toBe(0);
        });
    });

    // --- Test Suite for the Discovery Stage ---
    describe('Discovery Stage', () => {
        beforeEach(async () => {
            // Seed the specific mapping needed for this test suite
            await testPool.query('TRUNCATE TABLE mappings RESTART IDENTITY CASCADE');
            await testPool.query(
                'INSERT INTO mappings (id, main_component_id, test_component_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
                [uuidv4(), rootComponentId, mappedTestId]
            );
        });

        it('should initiate discovery and find the pre-seeded test mapping', async () => {
            const discoveryResponse = await request(app)
                .post('/api/v1/test-plans')
                .send({ rootComponentId, credentialProfile: liveTestProfileName })
                .expect(202);

            const planId = discoveryResponse.body.data.id;
            expect(discoveryResponse.body.data.status).toBe('DISCOVERING');

            const discoveryResult = await pollForStatus(planId, 'AWAITING_SELECTION');
            const rootDiscovered = discoveryResult.discoveredComponents.find((c: any) => c.componentId === rootComponentId);

            expect(rootDiscovered).toBeDefined();
            expect(rootDiscovered.availableTests).toContain(mappedTestId);
        }, 25000); // Increased timeout for live discovery
    });

    // --- Test Suite for the Execution Stage ---
    describe('Execution Stage', () => {
        let planId: string;
        let discoveredComponentId: string;


        beforeEach(async () => {
            // Seed the database to simulate a completed discovery phase.
            await testPool.query('TRUNCATE TABLE mappings RESTART IDENTITY CASCADE');
            await testPool.query(
                'INSERT INTO mappings (id, main_component_id, test_component_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
                [uuidv4(), rootComponentId, mappedTestId]
            );
            planId = uuidv4();
            discoveredComponentId = uuidv4();
            await testPool.query(`INSERT INTO test_plans (id, root_component_id, status, created_at, updated_at) VALUES ($1, $2, 'AWAITING_SELECTION', NOW(), NOW())`, [planId, rootComponentId]);
            await testPool.query(`INSERT INTO discovered_components (id, test_plan_id, component_id) VALUES ($1, $2, $3)`, [discoveredComponentId, planId, rootComponentId]);
        });

        it('should execute a test using a credential profile and create a successful result record', async () => {
            await request(app)
                .post(`/api/v1/test-plans/${planId}/execute`)
                .send({ testsToRun: [mappedTestId], credentialProfile: liveTestProfileName })
                .expect(202);

            // Wait for the live Boomi execution to complete.
            await pollForStatus(planId, 'COMPLETED', 45000);

            const resultsDbResult = await testPool.query('SELECT status FROM test_execution_results WHERE discovered_component_id = $1', [discoveredComponentId]);
            expect(resultsDbResult.rowCount).toBe(1);
            expect(resultsDbResult.rows[0].status).toBe('SUCCESS');
        }, 50000); // Increased timeout for live API calls
    });

    describe('Results Querying Stage', () => {
        let planId: string;
        let discoveredComponentId: string;
        const componentName = 'Live Test Component';
        const testName = 'Live Test Mapping';

        beforeEach(async () => {
            await testPool.query('TRUNCATE TABLE mappings RESTART IDENTITY CASCADE');
            // Seed a mapping with a name for enrichment testing
            await testPool.query(
                'INSERT INTO mappings (id, main_component_id, test_component_id, test_component_name, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())',
                [uuidv4(), rootComponentId, mappedTestId, testName]
            );

            // Seed a plan and a discovered component with a name
            planId = uuidv4();
            discoveredComponentId = uuidv4();
            await testPool.query(`INSERT INTO test_plans (id, root_component_id, status, created_at, updated_at) VALUES ($1, $2, 'AWAITING_SELECTION', NOW(), NOW())`, [planId, rootComponentId]);
            await testPool.query(`INSERT INTO discovered_components (id, test_plan_id, component_id, component_name) VALUES ($1, $2, $3, $4)`, [discoveredComponentId, planId, rootComponentId, componentName]);
        });

        it('should execute a test and then successfully query for its enriched result via the API', async () => {
            // 1. Execute the test against the live Boomi API
            await request(app)
                .post(`/api/v1/test-plans/${planId}/execute`)
                .send({ testsToRun: [mappedTestId], credentialProfile: liveTestProfileName })
                .expect(202);

            // 2. Poll for completion to ensure the result has been saved
            await pollForStatus(planId, 'COMPLETED', 45000);

            // 3. Query for the result using our new endpoint
            const queryResponse = await request(app)
                .get('/api/v1/test-execution-results')
                .query({ testPlanId: planId })
                .expect(200);

            // 4. Assert the enriched data returned by the API is correct
            expect(queryResponse.body).toHaveLength(1);
            const result = queryResponse.body[0];

            expect(result.testPlanId).toBe(planId);
            expect(result.status).toBe('SUCCESS');
            expect(result.discoveredComponentId).toBe(discoveredComponentId);
            expect(result.componentName).toBe(componentName); // Verify enrichment
            expect(result.testComponentName).toBe(testName); // Verify enrichment
            expect(result.rootComponentId).toBe(rootComponentId); // Verify enrichment
        }, 60000); // Generous timeout for the full E2E workflow
    });
});