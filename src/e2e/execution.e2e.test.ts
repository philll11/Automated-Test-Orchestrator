// src/e2e/execution.e2e.test.ts

import request from 'supertest';
import nock from 'nock';
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import app from '../app.js';
import globalPool from '../infrastructure/database.js';

const BOOMI_API_BASE = 'https://api.boomi.com';

describe('Execution End-to-End Test', () => {
    let testPool: pg.Pool;
    const testProfileName = 'e2e-exec-profile';
    const credentials = {
        accountId: 'test-account-e2e',
        username: 'testuser',
        passwordOrToken: 'testpass',
        executionInstanceId: 'test-atom-e2e'
    };
    const baseApiUrl = `/api/rest/v1/${credentials.accountId}`;

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
        await testPool.query('TRUNCATE TABLE test_plans, discovered_components, mappings, test_execution_results RESTART IDENTITY CASCADE');
        nock.cleanAll();

        await request(app)
            .post('/api/v1/credentials')
            .send({ profileName: testProfileName, ...credentials })
            .expect(201);
    });

    afterEach(async () => {
        await request(app).delete(`/api/v1/credentials/${testProfileName}`).expect(204);
    });

    afterAll(async () => {
        await testPool.end();
        await globalPool.end();
    });

    it('should execute a successful test, create a result record, and mark the plan as COMPLETED', async () => {
        // --- Arrange (1): Seed the database ---
        const planId = uuidv4();
        await testPool.query(`INSERT INTO test_plans (id, root_component_id, status, created_at, updated_at) VALUES ($1, 'root', 'AWAITING_SELECTION', NOW(), NOW())`, [planId]);

        const discoveredComponentId = uuidv4();
        await testPool.query(`INSERT INTO discovered_components (id, test_plan_id, component_id, component_name) VALUES ($1, $2, 'comp-abc', 'Component to Test')`, [discoveredComponentId, planId]);

        const testToRun = 'test-abc-123';
        await testPool.query(`INSERT INTO mappings (id, main_component_id, test_component_id, created_at, updated_at) VALUES ($1, 'comp-abc', $2, NOW(), NOW())`, [uuidv4(), testToRun]);

        // --- Arrange (2): Mock the Boomi API ---
        const requestId = 'execution-e2e-success-123';
        const recordUrl = 'https://platform.boomi.com/log/e2e-success-123';

        const boomiScope = nock(BOOMI_API_BASE)
            .post(`${baseApiUrl}/ExecutionRequest`).reply(200, { requestId, recordUrl })
            .get(`${baseApiUrl}/ExecutionRecord/async/${requestId}`).reply(200, { responseStatusCode: 200, result: [{ status: 'COMPLETE' }] });

        // --- Act ---
        await request(app)
            .post(`/api/v1/test-plans/${planId}/execute`)
            .send({
                testsToRun: [testToRun],
                credentialProfile: testProfileName,
            })
            .expect(202);

        // --- Wait for the asynchronous process to complete ---
        await new Promise(resolve => setTimeout(resolve, 500));

        // --- Assert Final State ---
        // 1. The TestPlan should be COMPLETED
        const finalPlanResult = await testPool.query('SELECT status FROM test_plans WHERE id = $1', [planId]);
        expect(finalPlanResult.rows[0].status).toBe('COMPLETED'); // <-- This is the most important assertion

        // 2. A new record should exist in test_execution_results
        const resultsResult = await testPool.query('SELECT * FROM test_execution_results WHERE discovered_component_id = $1', [discoveredComponentId]);
        expect(resultsResult.rowCount).toBe(1);
        expect(resultsResult.rows[0].status).toBe('SUCCESS');

        // 3. Verify all mocks were used
        expect(boomiScope.isDone()).toBe(true);

        // 4. GET endpoint should now show the result
        const detailsResponse = await request(app).get(`/api/v1/test-plans/${planId}`).expect(200);
        const componentDetails = detailsResponse.body.data.discoveredComponents[0];
        expect(componentDetails.executionResults).toHaveLength(1);
        expect(componentDetails.executionResults[0].status).toBe('SUCCESS');
    });
});