// src/e2e/live_system.e2e.test.ts

import request from 'supertest';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import app from '../app.js';
import globalPool from '../infrastructure/database.js';

// Helper function for polling the status endpoint
const pollForStatus = async (planId: string, targetStatus: string, timeout: number = 15000): Promise<any> => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const res = await request(app).get(`/api/v1/test-plans/${planId}`);
        if (res.body.data.status === targetStatus) {
            return res.body.data;
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before polling again
    }
    throw new Error(`Polling timed out waiting for status: ${targetStatus}`);
};

describe('Live System End-to-End Tests', () => {
    let testPool: Pool;
    const boomiCredentials = {
        accountId: process.env.BOOMI_TEST_ACCOUNT_ID!,
        username: process.env.BOOMI_TEST_USERNAME!,
        password_or_token: process.env.BOOMI_TEST_TOKEN!,
    };
    const rootComponentId = process.env.BOOMI_TEST_ROOT_COMPONENT_ID!;
    const mappedTestId = process.env.BOOMI_TEST_MAPPED_TEST_ID!;
    const atomId = process.env.BOOMI_TEST_ATOM_ID!;

    // --- Global Setup & Teardown ---
    beforeAll(() => {
        // Ensure all required environment variables are present
        if (!boomiCredentials.accountId || !boomiCredentials.username || !boomiCredentials.password_or_token || !rootComponentId || !mappedTestId || !atomId) {
            throw new Error('Missing one or more required BOOMI_TEST environment variables in .env.test');
        }

        testPool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT || '5433', 10),
        });
    });

    beforeEach(async () => {
        // Clean up tables before each test to ensure isolation
        await testPool.query('TRUNCATE TABLE discovered_components RESTART IDENTITY CASCADE');
        await testPool.query('TRUNCATE TABLE test_plans RESTART IDENTITY CASCADE');
        await testPool.query('TRUNCATE TABLE component_test_mappings RESTART IDENTITY CASCADE');

        // Seed the database with the static mapping needed for the tests
        await testPool.query(
            'INSERT INTO component_test_mappings (main_component_id, test_component_id, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())',
            [rootComponentId, mappedTestId]
        );
    });

    afterAll(async () => {
        await testPool.end();
        await globalPool.end();
    });

    // --- Test Suite for the Discovery Stage ---
    describe('Discovery Stage', () => {
        it('should initiate discovery and correctly populate the test plan', async () => {
            // 1. Initiate Discovery via API
            const discoveryResponse = await request(app)
                .post('/api/v1/test-plans')
                .send({ rootComponentId, boomiCredentials })
                .expect(202);

            const planId = discoveryResponse.body.data.id;
            expect(planId).toBeDefined();
            expect(discoveryResponse.body.data.status).toBe('PENDING');

            // 2. Poll for Discovery Completion
            const discoveryResult = await pollForStatus(planId, 'AWAITING_SELECTION');

            expect(discoveryResult.id).toBe(planId);
            expect(discoveryResult.discoveredComponents).toBeDefined();
            expect(discoveryResult.discoveredComponents.length).toBeGreaterThan(0);

            // 3. Verify the root component was discovered and its test was mapped
            const rootDiscoveredComponent = discoveryResult.discoveredComponents.find(
                (c: any) => c.componentId === rootComponentId
            );
            expect(rootDiscoveredComponent).toBeDefined();
            expect(rootDiscoveredComponent.mappedTestId).toBe(mappedTestId);
        }, 20000); // Allow generous timeout for live API calls
    });

    // --- Test Suite for the Execution Stage ---
    describe('Execution Stage', () => {
        let planId: string;

        beforeEach(async () => {
            // Manually set up the database to simulate a completed discovery stage
            planId = uuidv4();

            // 1. Create a test plan that is ready for execution
            await testPool.query(
                `INSERT INTO test_plans (id, root_component_id, status, created_at, updated_at) 
                 VALUES ($1, $2, 'AWAITING_SELECTION', NOW(), NOW())`,
                [planId, rootComponentId]
            );

            // 2. Create a discovered component linked to the plan that we can execute
            await testPool.query(
                `INSERT INTO discovered_components (id, test_plan_id, component_id, component_name, mapped_test_id, execution_status) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [uuidv4(), planId, rootComponentId, 'Root Component', mappedTestId, 'PENDING']
            );
        });

        it('should initiate execution for a pre-existing plan and report a successful result', async () => {
            // 1. Initiate Execution via API
            const executeResponse = await request(app)
                .post(`/api/v1/test-plans/${planId}/execute`)
                .send({
                    testsToRun: [mappedTestId], // User selects the test to run
                    boomiCredentials,
                    atomId
                })
                .expect(202);

            expect(executeResponse.body.metadata.message).toBe('Execution initiated');

            // 2. Poll for Execution Completion
            const finalResult = await pollForStatus(planId, 'COMPLETED', 30000); // Allow longer timeout for execution

            expect(finalResult.status).toBe('COMPLETED');

            // 3. Verify the final status in the database
            const componentResult = await testPool.query(
                'SELECT execution_status, execution_log FROM discovered_components WHERE test_plan_id = $1 AND component_id = $2',
                [planId, rootComponentId]
            );

            expect(componentResult.rowCount).toBe(1);
            expect(componentResult.rows[0].execution_status).toBe('SUCCESS');
            expect(componentResult.rows[0].execution_log).toBeDefined();
        }, 35000); // Increase Jest's timeout for this test
    });
});