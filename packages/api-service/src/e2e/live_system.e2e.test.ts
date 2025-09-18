// src/e2e/live_system.e2e.test.ts

import request from 'supertest';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import app from '../app.js';
import globalPool from '../infrastructure/database.js';

const liveCredentials = {
    accountId: process.env.BOOMI_TEST_ACCOUNT_ID!,
    username: process.env.BOOMI_TEST_USERNAME!,
    passwordOrToken: process.env.BOOMI_TEST_TOKEN!,
    executionInstanceId: process.env.BOOMI_TEST_ATOM_ID!,
};
// Environment variables for live Boomi components.
// Ensure these are set for a working Boomi test environment.
const liveRootComponentId = process.env.BOOMI_TEST_ROOT_COMPONENT_ID!; // A component with known dependencies.
const liveTestComponentId = process.env.BOOMI_TEST_MAPPED_TEST_ID!;   // A test component that can be executed.
const liveDependencyId = process.env.BOOMI_TEST_DEPENDENCY_ID!;       // A known dependency of the root component.
const liveSecondTestId = process.env.BOOMI_TEST_SECOND_MAPPED_TEST_ID!; // A second test component for multi-test execution.

// A single check to determine if the entire suite should run.
const areLiveTestsEnabled =
    !!liveCredentials.accountId &&
    !!liveCredentials.username &&
    !!liveCredentials.passwordOrToken &&
    !!liveCredentials.executionInstanceId &&
    !!liveRootComponentId &&
    !!liveTestComponentId &&
    !!liveDependencyId &&
    !!liveSecondTestId;

// Use 'describe.skip' if tests are not enabled. This prevents any hooks or tests from running.
const conditionalDescribe = areLiveTestsEnabled ? describe : describe.skip;

// Helper function for polling the status endpoint
const pollForStatus = async (planId: string, targetStatus: string, timeout: number = 45000): Promise<any> => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const res = await request(app).get(`/api/v1/test-plans/${planId}`);
        if (res.body.data && res.body.data.status === targetStatus) {
            return res.body.data;
        }
        await new Promise(resolve => setTimeout(resolve, 2000)); // Poll every 2 seconds
    }
    throw new Error(`Polling timed out after ${timeout}ms waiting for status: ${targetStatus}`);
};

conditionalDescribe('Live System End-to-End Tests', () => {
    let testPool: Pool;
    const liveTestProfileName = 'live-system-e2e-profile';

    beforeAll(async () => {
        // This block now only runs if areLiveTestsEnabled is true.
        testPool = new Pool({
            user: process.env.DB_USER, host: process.env.DB_HOST, database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD, port: parseInt(process.env.DB_PORT || '5433', 10),
        });

        await request(app)
            .post('/api/v1/credentials')
            .send({ profileName: liveTestProfileName, ...liveCredentials })
            .expect(201);
    });

    beforeEach(async () => {
        // This block now only runs if areLiveTestsEnabled is true.
        await testPool.query('TRUNCATE TABLE test_plans, plan_components, test_plan_entry_points, mappings, test_execution_results RESTART IDENTITY CASCADE');
    });

    afterAll(async () => {
        // This block now only runs if areLiveTestsEnabled is true.
        await request(app).delete(`/api/v1/credentials/${liveTestProfileName}`).expect(204);
        await testPool.end();
        await globalPool.end();
    });

    // --- Test Suite for the Mappings API ---
    describe('Mappings Administration', () => {
        // Ensure this suite also respects the env var check.
        beforeEach(() => {
            if (!liveCredentials.accountId) {
                pending('Skipping Mappings Administration tests due to missing environment variables.');
            }
        });

        it('should allow creating and deleting a mapping via the API', async () => {
            const newMainComponentId = liveRootComponentId;
            const newTestComponentId = liveTestComponentId;

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
        // Ensure this suite also respects the env var check.
        beforeEach(() => {
            if (!liveCredentials.accountId) {
                pending('Skipping Discovery Stage tests due to missing environment variables.');
            }
        });

        it('should initiate Direct Mode discovery and find the pre-seeded test mapping', async () => {
            // Seed the specific mapping needed for this test
            await testPool.query('TRUNCATE TABLE mappings RESTART IDENTITY CASCADE');
            await testPool.query(
                'INSERT INTO mappings (id, main_component_id, test_component_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
                [uuidv4(), liveRootComponentId, liveTestComponentId]
            );

            // Use new API contract for direct discovery
            const discoveryResponse = await request(app)
                .post('/api/v1/test-plans')
                .send({
                    componentIds: [liveRootComponentId],
                    credentialProfile: liveTestProfileName,
                    discoverDependencies: false // Direct mode
                })
                .expect(202);

            const planId = discoveryResponse.body.data.id;
            expect(discoveryResponse.body.data.status).toBe('DISCOVERING');

            const discoveryResult = await pollForStatus(planId, 'AWAITING_SELECTION');
            // Check planComponents
            const rootDiscovered = discoveryResult.planComponents.find((c: any) => c.componentId === liveRootComponentId);

            expect(rootDiscovered).toBeDefined();
            expect(rootDiscovered.availableTests).toContain(liveTestComponentId);
            expect(discoveryResult.planComponents).toHaveLength(1); // Only the root component should be present
        }, 30000); // Increased timeout for live discovery

        it('should initiate Recursive Mode discovery and find the root, its dependency, and pre-seeded test mapping', async () => {
            // Seed a mapping for the root component and its dependency
            await testPool.query('TRUNCATE TABLE mappings RESTART IDENTITY CASCADE');
            await testPool.query(
                'INSERT INTO mappings (id, main_component_id, test_component_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()), ($4, $5, $6, NOW(), NOW())',
                [uuidv4(), liveRootComponentId, liveTestComponentId, uuidv4(), liveDependencyId, liveSecondTestId]
            );

            // Use new API contract for recursive discovery
            const discoveryResponse = await request(app)
                .post('/api/v1/test-plans')
                .send({
                    componentIds: [liveRootComponentId],
                    credentialProfile: liveTestProfileName,
                    discoverDependencies: true // Recursive mode
                })
                .expect(202);

            const planId = discoveryResponse.body.data.id;
            expect(discoveryResponse.body.data.status).toBe('DISCOVERING');

            const discoveryResult = await pollForStatus(planId, 'AWAITING_SELECTION');
            expect(discoveryResult.planComponents.length).toBeGreaterThanOrEqual(2); // Should find root + at least one dependency

            const rootPlanComponent = discoveryResult.planComponents.find((c: any) => c.componentId === liveRootComponentId);
            const depPlanComponent = discoveryResult.planComponents.find((c: any) => c.componentId === liveDependencyId);

            expect(rootPlanComponent).toBeDefined();
            expect(rootPlanComponent.availableTests).toContain(liveTestComponentId);
            expect(depPlanComponent).toBeDefined();
            expect(depPlanComponent.availableTests).toContain(liveSecondTestId);
        }, 45000); // More generous timeout for recursive live discovery
    });

    // --- Test Suite for the Execution Stage ---
    describe('Execution Stage', () => {
        let planId: string;
        let planComponentIdRoot: string;
        let planComponentIdDependency: string;

        // Ensure this suite also respects the env var check.
        beforeEach(() => {
            if (!liveCredentials.accountId) {
                pending('Skipping Execution Stage tests due to missing environment variables.');
                return;
            }
            // Seed the database to simulate a completed recursive discovery phase with multiple components and mappings.
            return (async () => { // Wrap in async IIFE
                await testPool.query('TRUNCATE TABLE mappings RESTART IDENTITY CASCADE');
                await testPool.query(
                    'INSERT INTO mappings (id, main_component_id, test_component_id, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()), ($4, $5, $6, NOW(), NOW())',
                    [uuidv4(), liveRootComponentId, liveTestComponentId, uuidv4(), liveDependencyId, liveSecondTestId]
                );

                planId = uuidv4();
                planComponentIdRoot = uuidv4();
                planComponentIdDependency = uuidv4();

                await testPool.query(`INSERT INTO test_plans (id, status, created_at, updated_at) VALUES ($1, 'AWAITING_SELECTION', NOW(), NOW())`, [planId]);
                await testPool.query(`INSERT INTO plan_components (id, test_plan_id, component_id) VALUES ($1, $2, $3)`, [planComponentIdRoot, planId, liveRootComponentId]);
                await testPool.query(`INSERT INTO plan_components (id, test_plan_id, component_id) VALUES ($1, $2, $3)`, [planComponentIdDependency, planId, liveDependencyId]);
            })(); // Execute immediately
        });

        it('should execute multiple tests in a plan and create successful result records', async () => {
            const testsToRun = [liveTestComponentId, liveSecondTestId]; // Execute both tests

            await request(app)
                .post(`/api/v1/test-plans/${planId}/execute`)
                .send({ testsToRun, credentialProfile: liveTestProfileName })
                .expect(202);

            // Wait for the live Boomi execution to complete.
            await pollForStatus(planId, 'COMPLETED', 60000); // Longer timeout for multiple executions

            const resultsDbResult = await testPool.query('SELECT status, test_component_id FROM test_execution_results WHERE test_plan_id = $1 ORDER BY test_component_id', [planId]);
            expect(resultsDbResult.rowCount).toBe(2); // Two tests executed
            expect(resultsDbResult.rows[0].status).toBe('SUCCESS');
            expect(resultsDbResult.rows[0].test_component_id).toBe(liveSecondTestId); // Alphabetical
            expect(resultsDbResult.rows[1].status).toBe('SUCCESS');
            expect(resultsDbResult.rows[1].test_component_id).toBe(liveTestComponentId);

        }, 75000); // Generous timeout for multiple live API calls
    });

    describe('Results Querying Stage', () => {
        let planId: string;
        let planComponentId: string;
        const componentName = 'Live Test Root Component';
        const testName = 'Live Test Mapping';

        // Ensure this suite also respects the env var check.
        beforeEach(() => {
            if (!liveCredentials.accountId) {
                pending('Skipping Results Querying Stage tests due to missing environment variables.');
                return;
            }
            return (async () => { // Wrap in async IIFE
                await testPool.query('TRUNCATE TABLE mappings RESTART IDENTITY CASCADE');
                await testPool.query(
                    'INSERT INTO mappings (id, main_component_id, test_component_id, test_component_name, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())',
                    [uuidv4(), liveRootComponentId, liveTestComponentId, testName]
                );

                planId = uuidv4();
                planComponentId = uuidv4();
                await testPool.query(`INSERT INTO test_plans (id, status, created_at, updated_at) VALUES ($1, 'AWAITING_SELECTION', NOW(), NOW())`, [planId]);
                await testPool.query(`INSERT INTO plan_components (id, test_plan_id, component_id, component_name) VALUES ($1, $2, $3, $4)`, [planComponentId, planId, liveRootComponentId, componentName]);
            })();
        });

        it('should execute a test and then successfully query for its enriched result via the API', async () => {
            // 1. Execute the test against the live Boomi API
            await request(app)
                .post(`/api/v1/test-plans/${planId}/execute`)
                .send({ testsToRun: [liveTestComponentId], credentialProfile: liveTestProfileName })
                .expect(202);

            // 2. Poll for completion to ensure the result has been saved
            await pollForStatus(planId, 'COMPLETED', 60000);

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
            expect(result.planComponentId).toBe(planComponentId);
            expect(result.componentName).toBe(componentName);
            expect(result.testComponentName).toBe(testName);
            expect(result.rootComponentId).toBeUndefined(); // This should be undefined now
        }, 75000); // Generous timeout for the full E2E workflow
    });
});