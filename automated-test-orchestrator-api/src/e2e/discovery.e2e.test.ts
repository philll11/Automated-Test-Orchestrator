// src/e2e/discovery.e2e.test.ts

import request from 'supertest';
import nock from 'nock';
import { Pool } from 'pg';
import app from '../app.js';
import globalPool from '../infrastructure/database.js';
import { v4 as uuidv4 } from 'uuid';

const BOOMI_API_BASE = 'https://api.boomi.com';

describe('Discovery End-to-End Tests (POST /api/v1/test-plans)', () => {
    let testPool: Pool;
    const testProfileName = 'e2e-discovery-profile';
    const credentials = {
        accountId: 'test-account-e2e',
        username: 'testuser',
        passwordOrToken: 'testpass',
        executionInstanceId: 'atom-e2e'
    };
    const baseApiUrl = `/api/rest/v1/${credentials.accountId}`;
    const planName = 'E2E Discovery Plan'; // Add a plan name for all requests

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

    it('Direct Mode: should create a plan with the correct name and components', async () => {
        // --- Arrange ---
        const componentIds = ['comp-e2e-A', 'comp-e2e-B'];
        // UPDATED: Request body now includes the 'name'
        const requestBody = { name: planName, planType: 'COMPONENT', componentIds, credentialProfile: testProfileName, discoverDependencies: false };

        // UPDATED: Seed mappings with the richer structure
        await testPool.query(
            'INSERT INTO mappings (id, main_component_id, main_component_name, test_component_id, test_component_name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())',
            [uuidv4(), 'comp-e2e-B', 'Component B', 'test-for-B', 'Test For B']
        );

        const boomiScope = nock(BOOMI_API_BASE)
            .get(`${baseApiUrl}/ComponentMetadata/comp-e2e-A`).reply(200, { name: 'Comp A', type: 'PROCESS' })
            .get(`${baseApiUrl}/ComponentMetadata/comp-e2e-B`).reply(200, { name: 'Comp B', type: 'API' });

        // --- Act ---
        const initialResponse = await request(app).post('/api/v1/test-plans').send(requestBody).expect(202);
        const planId = initialResponse.body.data.id;

        // UPDATED: Check for the name in the initial response
        expect(initialResponse.body.data.name).toBe(planName);
        expect(initialResponse.body.data.status).toBe('DISCOVERING');

        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for async processing

        // --- Assert ---
        const planResult = await testPool.query('SELECT name, status FROM test_plans WHERE id = $1', [planId]);
        expect(planResult.rows[0].name).toBe(planName);
        expect(planResult.rows[0].status).toBe('AWAITING_SELECTION');

        const detailsResponse = await request(app).get(`/api/v1/test-plans/${planId}`).expect(200);
        const planDetails = detailsResponse.body.data;

        const compADetails = planDetails.planComponents.find((c: any) => c.componentId === 'comp-e2e-A');
        const compBDetails = planDetails.planComponents.find((c: any) => c.componentId === 'comp-e2e-B');

        // UPDATED: Assert against the new {id, name} structure
        expect(compADetails.availableTests).toEqual([]);
        expect(compBDetails.availableTests).toEqual([{ id: 'test-for-B', name: 'Test For B' }]);
        expect(boomiScope.isDone()).toBe(true);
    });

    it('Recursive Mode: should discover all dependencies and their rich test info', async () => {
        // --- Arrange ---
        const componentIds = ['root-e2e-123'];
        const childComponentId = 'child-e2e-456';
        const requestBody = { name: planName, planType: 'COMPONENT', componentIds, credentialProfile: testProfileName, discoverDependencies: true };

        await testPool.query(
            'INSERT INTO mappings (id, main_component_id, test_component_id, test_component_name, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())',
            [uuidv4(), childComponentId, 'test-for-child-e2e', 'Child Test']
        );

        const boomiScope = nock(BOOMI_API_BASE)
            .get(`${baseApiUrl}/ComponentMetadata/${componentIds[0]}`).reply(200, { name: 'E2E Root', version: 1, type: 'PROCESS' })
            .post(`${baseApiUrl}/ComponentReference/query`).reply(200, { numberOfResults: 1, result: [{ references: [{ componentId: childComponentId }] }] })
            .get(`${baseApiUrl}/ComponentMetadata/${childComponentId}`).reply(200, { name: 'E2E Child', version: 1, type: 'SUBPROCESS' })
            .post(`${baseApiUrl}/ComponentReference/query`).reply(200, { numberOfResults: 0 });

        // --- Act & Assert ---
        const initialResponse = await request(app).post('/api/v1/test-plans').send(requestBody).expect(202);
        const planId = initialResponse.body.data.id;
        await new Promise(resolve => setTimeout(resolve, 500));

        const detailsResponse = await request(app).get(`/api/v1/test-plans/${planId}`).expect(200);
        const planDetails = detailsResponse.body.data;
        expect(planDetails.planComponents).toHaveLength(2);
        const childDetails = planDetails.planComponents.find((c: any) => c.componentId === childComponentId);

        // UPDATED: Assert against the new {id, name} structure
        expect(childDetails.availableTests).toEqual([{ id: 'test-for-child-e2e', name: 'Child Test' }]);
        expect(boomiScope.isDone()).toBe(true);
    });

    it('Recursive Mode: should correctly deduplicate shared dependencies', async () => {
        // --- Arrange ---
        const rootA = 'root-A';
        const rootB = 'root-B';
        const sharedChild = 'shared-child';
        // UPDATED: Added name and planType
        const requestBody = { name: 'Dedupe Plan', planType: 'COMPONENT', componentIds: [rootA, rootB], credentialProfile: testProfileName, discoverDependencies: true };

        const boomiScope = nock(BOOMI_API_BASE)
            // Discovery for Root A
            .get(`${baseApiUrl}/ComponentMetadata/${rootA}`).reply(200, { name: 'Root A', version: 1, type: 'PROCESS' })
            .post(`${baseApiUrl}/ComponentReference/query`).reply(200, { numberOfResults: 1, result: [{ references: [{ componentId: sharedChild }] }] })
            // Discovery for Root B
            .get(`${baseApiUrl}/ComponentMetadata/${rootB}`).reply(200, { name: 'Root B', version: 1, type: 'PROCESS' })
            .post(`${baseApiUrl}/ComponentReference/query`).reply(200, { numberOfResults: 1, result: [{ references: [{ componentId: sharedChild }] }] })
            // Discovery for Shared Child (will be called for A, then skipped for B due to caching in the service)
            .get(`${baseApiUrl}/ComponentMetadata/${sharedChild}`).reply(200, { name: 'Shared', version: 1, type: 'SUBPROCESS' })
            .post(`${baseApiUrl}/ComponentReference/query`).reply(200, { numberOfResults: 0 });

        // --- Act & Assert ---
        const initialResponse = await request(app).post('/api/v1/test-plans').send(requestBody).expect(202);
        const planId = initialResponse.body.data.id;
        await new Promise(resolve => setTimeout(resolve, 500));

        // Assert that the final plan in the database only contains 3 unique components
        const componentsResult = await testPool.query('SELECT component_id FROM plan_components WHERE test_plan_id = $1', [planId]);
        expect(componentsResult.rowCount).toBe(3);

        const detailsResponse = await request(app).get(`/api/v1/test-plans/${planId}`).expect(200);
        expect(detailsResponse.body.data.planComponents).toHaveLength(3);
        expect(boomiScope.isDone()).toBe(true);
    });
});