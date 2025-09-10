import request from 'supertest';
import nock from 'nock';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import app from '../app';
import globalPool from '../infrastructure/database';
import { TestPlan } from '../domain/test_plan';
import { DiscoveredComponent } from '../domain/discovered_component';

// --- Test Setup ---
const BOOMI_API_BASE = 'https://api.boomi.com';

describe('Execution End-to-End Test', () => {
    let testPool: Pool;
    const credentials = {
        accountId: 'test-account-e2e',
        username: 'testuser',
        password_or_token: 'testpass',
    };
    const atomId = 'test-atom-e2e';
    const baseApiUrl = `/api/rest/v1/${credentials.accountId}`;

    beforeAll(() => {
        testPool = new Pool({
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

    it('should successfully execute selected tests and update the database state', async () => {
        // --- Arrange (1): Set up the initial database state ---
        const planId = uuidv4();
        const testPlan: TestPlan = {
            id: planId,
            rootComponentId: 'root-e2e-exec',
            status: 'AWAITING_SELECTION', // The required starting state
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await testPool.query(
            `INSERT INTO test_plans (id, root_component_id, status, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5)`,
            [planId, testPlan.rootComponentId, testPlan.status, testPlan.createdAt, testPlan.updatedAt]
        );

        const componentToTest: DiscoveredComponent = {
            id: uuidv4(),
            testPlanId: planId,
            componentId: 'comp-abc',
            mappedTestId: 'test-abc-123', // The test we will select to run
        };
        const componentToIgnore: DiscoveredComponent = {
            id: uuidv4(),
            testPlanId: planId,
            componentId: 'comp-def',
            mappedTestId: 'test-def-456', // The test we will NOT select
        };
        await testPool.query(
            `INSERT INTO discovered_components (id, test_plan_id, component_id, mapped_test_id) 
         VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)`,
            [componentToTest.id, planId, componentToTest.componentId, componentToTest.mappedTestId,
            componentToIgnore.id, planId, componentToIgnore.componentId, componentToIgnore.mappedTestId]
        );

        // --- Arrange (2): Mock the Boomi API execution sequence ---
        const requestId = 'execution-e2e-success-123';
        const recordUrl = 'https://platform.boomi.com/log/e2e-success-123';

        // Mock the POST to start the execution
        nock(BOOMI_API_BASE).post(`${baseApiUrl}/ExecutionRequest`).reply(200, { requestId, recordUrl });
        // Mock the GET polling to return success on the first poll
        nock(BOOMI_API_BASE).get(`${baseApiUrl}/ExecutionRecord/async/${requestId}`).reply(200, {
            responseStatusCode: 200,
            result: [{ status: 'COMPLETE' }],
        });

        // --- Act & Assert (Phase 1: Initial API Call) ---
        const response = await request(app)
            .post(`/api/v1/test-plans/${planId}/execute`)
            .send({
                testsToRun: [componentToTest.mappedTestId], // Only select the first test
                boomiCredentials: credentials,
                atomId: atomId,
            })
            .expect(202); // Assert the HTTP status code is 202 Accepted

        expect(response.body.metadata.message).toBe('Execution initiated');

        // --- Wait for the asynchronous background process to complete ---
        await new Promise(resolve => setTimeout(resolve, 500));

        // --- Assert (Phase 2: Final Database State) ---

        // 1. Check that the TestPlan was updated to COMPLETED
        const planResult = await testPool.query('SELECT status FROM test_plans WHERE id = $1', [planId]);
        expect(planResult.rowCount).toBe(1);
        expect(planResult.rows[0].status).toBe('COMPLETED');

        // 2. Check that the EXECUTED component was updated to SUCCESS
        const testedCompResult = await testPool.query('SELECT execution_status FROM discovered_components WHERE id = $1', [componentToTest.id]);
        expect(testedCompResult.rowCount).toBe(1);
        expect(testedCompResult.rows[0].execution_status).toBe('SUCCESS');

        // 3. Check that the IGNORED component was NOT updated
        const ignoredCompResult = await testPool.query('SELECT execution_status FROM discovered_components WHERE id = $1', [componentToIgnore.id]);
        expect(ignoredCompResult.rowCount).toBe(1);
        expect(ignoredCompResult.rows[0].execution_status).toBeNull();

        // 4. Verify that all mocked Boomi API endpoints were called
        expect(nock.isDone()).toBe(true);
    });
});