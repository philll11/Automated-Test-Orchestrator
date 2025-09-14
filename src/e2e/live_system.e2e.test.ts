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
    const integrationPlatformCredentials = {
        accountId: process.env.BOOMI_TEST_ACCOUNT_ID!,
        username: process.env.BOOMI_TEST_USERNAME!,
        passwordOrToken: process.env.BOOMI_TEST_TOKEN!,
    };
    const rootComponentId = process.env.BOOMI_TEST_ROOT_COMPONENT_ID!;
    const mappedTestId = process.env.BOOMI_TEST_MAPPED_TEST_ID!;
    const executionInstanceId = process.env.BOOMI_TEST_ATOM_ID!;

    beforeAll(() => {
        if (!integrationPlatformCredentials.accountId || !rootComponentId || !mappedTestId || !executionInstanceId) {
            throw new Error('Missing one or more required BOOMI_TEST environment variables. Skipping live tests.');
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
        // Clean all tables before every test for perfect isolation
        await testPool.query('TRUNCATE TABLE test_plans RESTART IDENTITY CASCADE');
    });

    afterAll(async () => {
        await testPool.end();
        await globalPool.end();
    });

    // --- NEW Test Suite for the Mappings API ---
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
            await testPool.query(
                'INSERT INTO mappings (id, main_component_id, test_component_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
                [uuidv4(), rootComponentId, mappedTestId]
            );
        });

        it('should initiate discovery and find the pre-seeded test mapping', async () => {
            const discoveryResponse = await request(app)
                .post('/api/v1/test-plans')
                .send({ rootComponentId, integrationPlatformCredentials })
                .expect(202);

            const planId = discoveryResponse.body.data.id;
            expect(discoveryResponse.body.data.status).toBe('DISCOVERING');

            const discoveryResult = await pollForStatus(planId, 'AWAITING_SELECTION');
            const rootDiscovered = discoveryResult.discoveredComponents.find((c: any) => c.componentId === rootComponentId);
            
            expect(rootDiscovered).toBeDefined();
            expect(rootDiscovered.availableTests).toContain(mappedTestId);
        }, 25000);
    });

    // --- Test Suite for the Execution Stage ---
    describe('Execution Stage', () => {
        let planId: string;
        let discoveredComponentId: string;

        beforeEach(async () => {
            // Seed the specific mapping AND the discovered plan state for this suite
            await testPool.query(
                'INSERT INTO mappings (id, main_component_id, test_component_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
                [uuidv4(), rootComponentId, mappedTestId]
            );
            planId = uuidv4();
            discoveredComponentId = uuidv4();
            await testPool.query(`INSERT INTO test_plans (id, root_component_id, status, created_at, updated_at) VALUES ($1, $2, 'AWAITING_SELECTION', NOW(), NOW())`, [planId, rootComponentId]);
            await testPool.query(`INSERT INTO discovered_components (id, test_plan_id, component_id) VALUES ($1, $2, $3)`, [discoveredComponentId, planId, rootComponentId]);
        });

        it('should execute a test and create a successful result record', async () => {
            await request(app)
                .post(`/api/v1/test-plans/${planId}/execute`)
                .send({ testsToRun: [mappedTestId], integrationPlatformCredentials, executionInstanceId })
                .expect(202);

            await pollForStatus(planId, 'COMPLETED', 45000);

            const resultsDbResult = await testPool.query('SELECT status FROM test_execution_results WHERE discovered_component_id = $1', [discoveredComponentId]);
            expect(resultsDbResult.rowCount).toBe(1);
            expect(resultsDbResult.rows[0].status).toBe('SUCCESS');
        }, 50000);
    });
});