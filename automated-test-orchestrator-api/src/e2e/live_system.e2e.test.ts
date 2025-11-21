// src/e2e/live_system.e2e.test.ts

import request from 'supertest';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import app from '../app.js';
import globalPool from '../infrastructure/database.js';

// ... (liveCredentials and other constants are unchanged)
const liveCredentials = {
    accountId: process.env.BOOMI_TEST_ACCOUNT_ID!,
    username: process.env.BOOMI_TEST_USERNAME!,
    passwordOrToken: process.env.BOOMI_TEST_TOKEN!,
    executionInstanceId: process.env.BOOMI_TEST_ATOM_ID!,
};
const liveRootComponentId = process.env.BOOMI_TEST_ROOT_COMPONENT_ID!;
const liveTestComponentId = process.env.BOOMI_TEST_MAPPED_TEST_ID!;
const liveDependencyId = process.env.BOOMI_TEST_DEPENDENCY_ID!;
const liveSecondTestId = process.env.BOOMI_TEST_SECOND_MAPPED_TEST_ID!;

const areLiveTestsEnabled = !!liveCredentials.accountId && !!liveRootComponentId && !!liveTestComponentId && !!liveDependencyId && !!liveSecondTestId;
const conditionalDescribe = areLiveTestsEnabled ? describe : describe.skip;
const pollForStatus = async (planId: string, targetStatus: string, timeout: number = 45000): Promise<any> => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const res = await request(app).get(`/api/v1/test-plans/${planId}`);
        if (res.body.data && res.body.data.status === targetStatus) {
            return res.body.data;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error(`Polling timed out after ${timeout}ms waiting for status: ${targetStatus}`);
};


conditionalDescribe('Live System End-to-End Tests', () => {
    let testPool: Pool;
    const liveTestProfileName = 'live-system-e2e-profile';

    beforeAll(async () => {
        testPool = new Pool({
            user: process.env.DB_USER, host: process.env.DB_HOST, database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD, port: parseInt(process.env.DB_PORT || '5432', 10),
        });
        await request(app).post('/api/v1/credentials').send({ profileName: liveTestProfileName, ...liveCredentials }).expect(201);
    });

    beforeEach(async () => {
        await testPool.query('TRUNCATE TABLE test_plans, mappings RESTART IDENTITY CASCADE');
    });

    afterAll(async () => {
        await request(app).delete(`/api/v1/credentials/${liveTestProfileName}`).expect(204);
        await testPool.end();
        await globalPool.end();
    });

    describe('Mappings Administration', () => {
        it('should allow creating a mapping with mainComponentName', async () => {
            // UPDATED: Include mainComponentName in the payload
            const createResponse = await request(app)
                .post('/api/v1/mappings')
                .send({ 
                    mainComponentId: liveRootComponentId, 
                    mainComponentName: 'Live Root Component',
                    testComponentId: liveTestComponentId 
                })
                .expect(201);
            const newMappingId = createResponse.body.data.id;
            expect(newMappingId).toBeDefined();
        });
    });

    describe('Discovery Stage', () => {
        it('should initiate Direct Mode and find the enriched test mapping', async () => {
            await testPool.query(
                'INSERT INTO mappings (id, main_component_id, test_component_id, test_component_name, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())',
                [uuidv4(), liveRootComponentId, liveTestComponentId, 'Live Test 1']
            );

            const discoveryResponse = await request(app)
                .post('/api/v1/test-plans')
                .send({
                    name: 'Live Direct Discovery', // UPDATED: Added required name
                    componentIds: [liveRootComponentId],
                    credentialProfile: liveTestProfileName,
                    discoverDependencies: false
                })
                .expect(202);

            const planId = discoveryResponse.body.data.id;
            const discoveryResult = await pollForStatus(planId, 'AWAITING_SELECTION');
            const rootDiscovered = discoveryResult.planComponents.find((c: any) => c.componentId === liveRootComponentId);

            expect(rootDiscovered).toBeDefined();
            // UPDATED: Assert against the new {id, name} object structure
            expect(rootDiscovered.availableTests).toEqual([{ id: liveTestComponentId, name: 'Live Test 1' }]);
        }, 30000);

        it('should initiate Recursive Mode and find all enriched test mappings', async () => {
            await testPool.query(
                'INSERT INTO mappings (id, main_component_id, test_component_id, test_component_name, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()), ($5, $6, $7, $8, NOW(), NOW())',
                [uuidv4(), liveRootComponentId, liveTestComponentId, 'Live Test 1', uuidv4(), liveDependencyId, liveSecondTestId, 'Live Test 2']
            );

            const discoveryResponse = await request(app)
                .post('/api/v1/test-plans')
                .send({
                    name: 'Live Recursive Discovery', // UPDATED: Added required name
                    componentIds: [liveRootComponentId],
                    credentialProfile: liveTestProfileName,
                    discoverDependencies: true
                })
                .expect(202);

            const planId = discoveryResponse.body.data.id;
            const discoveryResult = await pollForStatus(planId, 'AWAITING_SELECTION');
            
            const rootPlanComponent = discoveryResult.planComponents.find((c: any) => c.componentId === liveRootComponentId);
            const depPlanComponent = discoveryResult.planComponents.find((c: any) => c.componentId === liveDependencyId);

            expect(rootPlanComponent).toBeDefined();
            expect(depPlanComponent).toBeDefined();
            // UPDATED: Assert against the new {id, name} object structure
            expect(rootPlanComponent.availableTests).toEqual([{ id: liveTestComponentId, name: 'Live Test 1' }]);
            expect(depPlanComponent.availableTests).toEqual([{ id: liveSecondTestId, name: 'Live Test 2' }]);
        }, 45000);
    });

    describe('Execution Stage', () => {
        let planId: string;

        beforeEach(async () => {
            await testPool.query(
                'INSERT INTO mappings (id, main_component_id, test_component_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()), ($4, $5, $6, NOW(), NOW())',
                [uuidv4(), liveRootComponentId, liveTestComponentId, uuidv4(), liveDependencyId, liveSecondTestId]
            );

            planId = uuidv4();
            // UPDATED: Added 'name' to the INSERT statement
            await testPool.query(`INSERT INTO test_plans (id, name, status, created_at, updated_at) VALUES ($1, 'Live Execution Plan', 'AWAITING_SELECTION', NOW(), NOW())`, [planId]);
            await testPool.query(`INSERT INTO plan_components (id, test_plan_id, component_id) VALUES ($1, $2, $3)`, [uuidv4(), planId, liveRootComponentId]);
            await testPool.query(`INSERT INTO plan_components (id, test_plan_id, component_id) VALUES ($1, $2, $3)`, [uuidv4(), planId, liveDependencyId]);
        });

        it('should execute multiple tests and create successful result records', async () => {
            const testsToRun = [liveTestComponentId, liveSecondTestId];

            await request(app).post(`/api/v1/test-plans/${planId}/execute`).send({ testsToRun, credentialProfile: liveTestProfileName }).expect(202);
            await pollForStatus(planId, 'COMPLETED', 60000);

            const resultsDbResult = await testPool.query('SELECT status, message FROM test_execution_results WHERE test_plan_id = $1', [planId]);
            expect(resultsDbResult.rowCount).toBe(2);
            // UPDATED: Check for the 'message' field instead of 'log'
            expect(resultsDbResult.rows.every(r => r.status === 'SUCCESS')).toBe(true);
            expect(resultsDbResult.rows[0].message).toBeDefined(); // Live tests should return a message
        }, 75000);
    });

    describe('Results Querying Stage', () => {
        it('should execute a test and then successfully query for its enriched result', async () => {
            const planId = uuidv4();
            const planComponentId = uuidv4();
            // UPDATED: Added 'name' to the INSERT statement
            await testPool.query(`INSERT INTO test_plans (id, name, status, created_at, updated_at) VALUES ($1, 'Live Query Plan', 'AWAITING_SELECTION', NOW(), NOW())`, [planId]);
            await testPool.query(`INSERT INTO plan_components (id, test_plan_id, component_id, component_name) VALUES ($1, $2, $3, 'Live Root')`, [planComponentId, planId, liveRootComponentId]);
            await testPool.query(
                'INSERT INTO mappings (id, main_component_id, test_component_id, test_component_name, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())',
                [uuidv4(), liveRootComponentId, liveTestComponentId, 'Live Query Test']
            );

            // 1. Execute the test
            await request(app).post(`/api/v1/test-plans/${planId}/execute`).send({ testsToRun: [liveTestComponentId], credentialProfile: liveTestProfileName }).expect(202);
            await pollForStatus(planId, 'COMPLETED', 60000);

            // 2. Query for the result
            const queryResponse = await request(app).get('/api/v1/test-execution-results').query({ testPlanId: planId }).expect(200);

            // 3. Assert the enriched data
            // UPDATED: Assert against the new response.body.data structure
            expect(queryResponse.body.data).toHaveLength(1);
            const result = queryResponse.body.data[0];

            expect(result.testPlanId).toBe(planId);
            expect(result.testPlanName).toBe('Live Query Plan'); // Check for the joined plan name
            expect(result.status).toBe('SUCCESS');
            expect(result.componentName).toBe('Live Root');
            expect(result.testComponentName).toBe('Live Query Test');
        }, 75000);
    });
});