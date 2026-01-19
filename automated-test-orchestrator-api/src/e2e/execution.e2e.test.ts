// src/e2e/execution.e2e.test.ts

import request from 'supertest';
import nock from 'nock';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import app from '../app.js';
import globalPool from '../infrastructure/database.js';

const BOOMI_API_BASE = 'https://api.boomi.com';

describe('Execution End-to-End Test (POST /api/v1/test-plans/:planId/execute)', () => {
    let testPool: Pool;
    const testProfileName = 'e2e-exec-profile';
    const credentials = {
        accountId: 'test-account-e2e', username: 'testuser', passwordOrToken: 'testpass',
        executionInstanceId: 'test-atom-e2e'
    };
    const baseApiUrl = `/api/rest/v1/${credentials.accountId}`;

    beforeAll(() => {
        testPool = new Pool({
            user: process.env.DB_USER, host: process.env.DB_HOST, database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD, port: parseInt(process.env.DB_PORT || '5432', 10),
        });
    });

    beforeEach(async () => {
        await testPool.query('TRUNCATE TABLE test_plans, mappings RESTART IDENTITY CASCADE');
        nock.cleanAll();
        await request(app).post('/api/v1/credentials').send({ profileName: testProfileName, ...credentials }).expect(201);
    });

    afterEach(async () => {
        await request(app).delete(`/api/v1/credentials/${testProfileName}`).expect(204);
    });

    afterAll(async () => {
        await testPool.end();
        await globalPool.end();
    });

    it('should execute a successful test and create a correct result record', async () => {
        // --- Arrange (1): Seed the database ---
        const planId = uuidv4();
        // UPDATED: Added 'name' to test_plans insert
        await testPool.query(`INSERT INTO test_plans (id, name, status, plan_type, created_at, updated_at) VALUES ($1, 'E2E Success Plan', 'AWAITING_SELECTION', 'COMPONENT', NOW(), NOW())`, [planId]);

        const planComponentId = uuidv4();
        await testPool.query(`INSERT INTO plan_components (id, test_plan_id, component_id, component_name, source_type) VALUES ($1, $2, 'comp-abc', 'Component to Test', 'DIRECT')`, [planComponentId, planId]);

        const testToRun = 'test-abc-123';
        // UPDATED: Added 'main_component_name' to mappings insert
        await testPool.query(`INSERT INTO mappings (id, main_component_id, main_component_name, test_component_id, test_component_name, created_at, updated_at) VALUES ($1, 'comp-abc', 'Component to Test', $2, 'Successful Test', NOW(), NOW())`, [uuidv4(), testToRun]);

        // --- Arrange (2): Mock the Boomi API ---
        const boomiScope = nock(BOOMI_API_BASE)
            .post(`${baseApiUrl}/ExecutionRequest`).reply(200, { requestId: 'success-1', recordUrl: 'http://log.url' })
            .get(`${baseApiUrl}/ExecutionRecord/async/success-1`).reply(200, { responseStatusCode: 200, result: [{ status: 'COMPLETE' }] });

        // --- Act ---
        await request(app).post(`/api/v1/test-plans/${planId}/execute`).send({ testsToRun: [testToRun], credentialProfile: testProfileName }).expect(202);
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for async processing

        // --- Assert Final State ---
        const finalPlanResult = await testPool.query('SELECT status FROM test_plans WHERE id = $1', [planId]);
        expect(finalPlanResult.rows[0].status).toBe('COMPLETED');

        const resultsResult = await testPool.query('SELECT * FROM test_execution_results WHERE plan_component_id = $1', [planComponentId]);
        expect(resultsResult.rowCount).toBe(1);
        expect(resultsResult.rows[0].status).toBe('SUCCESS');

        const detailsResponse = await request(app).get(`/api/v1/test-plans/${planId}`).expect(200);
        const componentDetails = detailsResponse.body.data.planComponents[0];
        expect(componentDetails.executionResults).toHaveLength(1);
        expect(componentDetails.executionResults[0].status).toBe('SUCCESS');
        expect(componentDetails.executionResults[0].testComponentName).toBe('Successful Test'); // Verify enriched name

        expect(boomiScope.isDone()).toBe(true);
    });

    it('should handle a failed test and record the failure message', async () => {
        // --- Arrange ---
        const planId = uuidv4();
        // UPDATED: Added 'name'
        await testPool.query(`INSERT INTO test_plans (id, name, status, plan_type, created_at, updated_at) VALUES ($1, 'E2E Failure Plan', 'AWAITING_SELECTION', 'COMPONENT', NOW(), NOW())`, [planId]);
        const planComponentId = uuidv4();
        await testPool.query(`INSERT INTO plan_components (id, test_plan_id, component_id, source_type) VALUES ($1, $2, 'comp-def', 'DIRECT')`, [planComponentId, planId]);
        const testToRun = 'test-def-456';
        await testPool.query(`INSERT INTO mappings (id, main_component_id, test_component_id, created_at, updated_at) VALUES ($1, 'comp-def', $2, NOW(), NOW())`, [uuidv4(), testToRun]);

        // UPDATED: Mock now returns a 'message', not 'log'
        const failureMessage = 'Process failed due to invalid input.';
        const boomiScope = nock(BOOMI_API_BASE)
            .post(`${baseApiUrl}/ExecutionRequest`).reply(200, { requestId: 'fail-1' })
            .get(`${baseApiUrl}/ExecutionRecord/async/fail-1`).reply(200, { responseStatusCode: 200, result: [{ status: 'ERROR', message: failureMessage }] });

        // --- Act ---
        await request(app).post(`/api/v1/test-plans/${planId}/execute`).send({ testsToRun: [testToRun], credentialProfile: testProfileName }).expect(202);
        await new Promise(resolve => setTimeout(resolve, 500));

        // --- Assert ---
        const finalPlanResult = await testPool.query('SELECT status FROM test_plans WHERE id = $1', [planId]);
        expect(finalPlanResult.rows[0].status).toBe('COMPLETED');

        // UPDATED: Check for the 'message' field in the database
        const resultsResult = await testPool.query('SELECT * FROM test_execution_results WHERE plan_component_id = $1', [planComponentId]);
        expect(resultsResult.rowCount).toBe(1);
        expect(resultsResult.rows[0].status).toBe('FAILURE');
        expect(resultsResult.rows[0].message).toBe(failureMessage);
        
        expect(boomiScope.isDone()).toBe(true);
    });
});