// src/e2e/discovery.e2e.test.ts

import request from 'supertest';
import nock from 'nock';
import { Pool } from 'pg';
import app from '../app.js';
import globalPool from '../infrastructure/database.js';
import { v4 as uuidv4 } from 'uuid';

const BOOMI_API_BASE = 'https://api.boomi.com';

// Helper to match the consolidated query body
const matchConsolidatedQuery = (body: any, fieldValues: { names?: string[], folders?: string[], ids?: string[] }) => {
    const mainAnd = body.QueryFilter.expression;
    if (mainAnd.operator !== 'and') return false;
    const filters = mainAnd.nestedExpression;

    // Check Global Filters
    const deleted = filters.find((f: any) => f.property === 'deleted' && f.argument[0] === 'false');
    const current = filters.find((f: any) => f.property === 'currentVersion' && f.argument[0] === 'true');
    if (!deleted || !current) return false;

    // Check OR block
    const orBlock = filters.find((f: any) => f.operator === 'or');
    if (!orBlock) return false;
    const orExprs = orBlock.nestedExpression;

    if (fieldValues.names) {
        // Look for any name match
        const hasName = orExprs.some((f: any) => f.property === 'name' && fieldValues.names!.includes(f.argument[0]));
        if (!hasName) return false;
    }
    
    // Note: Folder names are resolved to IDs before this query, so we'd see folderId
    // But testing the full 2-step flow in E2E with mocks is tricky without hardcoding the ID here.
    
    return true;
};

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
        const compIds = ['comp-e2e-A', 'comp-e2e-B'];
        // UPDATED: Using compIds
        const requestBody = { name: planName, planType: 'COMPONENT', compIds, credentialProfile: testProfileName, discoverDependencies: false };

        // UPDATED: Seed mappings with the richer structure
        await testPool.query(
            'INSERT INTO mappings (id, main_component_id, main_component_name, test_component_id, test_component_name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())',
            [uuidv4(), 'comp-e2e-B', 'Component B', 'test-for-B', 'Test For B']
        );

        // Mock the SEARCH Query (The service now uses searchComponents for everything)
        // Since we provided IDs, it will generate an OR query with nested IDs.
        nock(BOOMI_API_BASE)
            .post(`${baseApiUrl}/ComponentMetadata/query`)
            .reply(200, {
                numberOfResults: 2,
                result: [
                    { componentId: 'comp-e2e-A', name: 'Comp A', type: 'PROCESS', version: 1 },
                    { componentId: 'comp-e2e-B', name: 'Comp B', type: 'API', version: 1 }
                ]
            });

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
        expect(nock.isDone()).toBe(true);
    });

    it('TEST Mode: should validate inputs are executable tests and ignore mappings', async () => {
        // --- Arrange ---
        const compIds = ['test-direct-X'];
        const requestBody = { name: 'Test Mode Plan', planType: 'TEST', compIds, credentialProfile: testProfileName };

        // Mock Search (Consolidated Search used for resolution)
        nock(BOOMI_API_BASE)
            .post(`${baseApiUrl}/ComponentMetadata/query`)
            .reply(200, {
                 numberOfResults: 1,
                 result: [{ componentId: 'test-direct-X', name: 'Direct Test X', type: 'PROCESS', version: 1 }]
            });

        // --- Act ---
        const initialResponse = await request(app).post('/api/v1/test-plans').send(requestBody).expect(202);
        const planId = initialResponse.body.data.id;

        expect(initialResponse.body.data.planType).toBe('TEST');

        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for async processing

        // --- Assert ---
        const planResult = await testPool.query('SELECT name, status, plan_type FROM test_plans WHERE id = $1', [planId]);
        expect(planResult.rows[0].status).toBe('AWAITING_SELECTION');
        expect(planResult.rows[0].plan_type).toBe('TEST');

        const detailsResponse = await request(app).get(`/api/v1/test-plans/${planId}`).expect(200);
        const planDetails = detailsResponse.body.data;
        
        expect(planDetails.planComponents).toHaveLength(1);
        expect(planDetails.planComponents[0].componentId).toBe('test-direct-X');
        expect(planDetails.planComponents[0].componentName).toBe('Direct Test X');
        
        // Mappings were NOT seeded, so availableTests should be empty (standard behavior for TEST mode currently)
        expect(planDetails.planComponents[0].availableTests).toEqual([]);
        
        expect(nock.isDone()).toBe(true);
    });

    it('Recursive Mode: should discover all dependencies and their rich test info', async () => {
        // --- Arrange ---
        const compIds = ['root-e2e-123'];
        const childComponentId = 'child-e2e-456';
        // UPDATED: Using compIds
        const requestBody = { name: planName, planType: 'COMPONENT', compIds, credentialProfile: testProfileName, discoverDependencies: true };

        await testPool.query(
            'INSERT INTO mappings (id, main_component_id, test_component_id, test_component_name, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())',
            [uuidv4(), childComponentId, 'test-for-child-e2e', 'Child Test']
        );

        // 1. Resolve Inputs (Optimized Search)
        nock(BOOMI_API_BASE)
            .post(`${baseApiUrl}/ComponentMetadata/query`)
            .reply(200, {
                 numberOfResults: 1,
                 result: [{ componentId: 'root-e2e-123', name: 'E2E Root', type: 'PROCESS', version: 1 }]
            });

        // 2. Recursion (Existing logic re-fetches metadata + refs for root)
        nock(BOOMI_API_BASE)
            .get(`${baseApiUrl}/ComponentMetadata/${compIds[0]}`).reply(200, { name: 'E2E Root', version: 1, type: 'PROCESS' })
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
        expect(nock.isDone()).toBe(true);
    });

    it('Recursive Mode: should correctly deduplicate shared dependencies', async () => {
        // --- Arrange ---
        const rootA = 'root-A';
        const rootB = 'root-B';
        const sharedChild = 'shared-child';
        // UPDATED: Added name and planType
        const requestBody = { name: 'Dedupe Plan', planType: 'COMPONENT', compIds: [rootA, rootB], credentialProfile: testProfileName, discoverDependencies: true };

        // 1. Resolve Inputs
        nock(BOOMI_API_BASE)
            .post(`${baseApiUrl}/ComponentMetadata/query`)
            .reply(200, {
                 numberOfResults: 2,
                 result: [
                     { componentId: rootA, name: 'Root A', type: 'PROCESS', version: 1 },
                     { componentId: rootB, name: 'Root B', type: 'PROCESS', version: 1 }
                 ]
            });

        // 2. Recursion behavior
        // Discovery for Root A
        nock(BOOMI_API_BASE)
            .get(`${baseApiUrl}/ComponentMetadata/${rootA}`).reply(200, { name: 'Root A', version: 1, type: 'PROCESS' })
            .post(`${baseApiUrl}/ComponentReference/query`, (body: any) => 
                body.QueryFilter?.expression?.nestedExpression?.some((e: any) => e.property === 'parentComponentId' && e.argument[0] === rootA)
            ).reply(200, { numberOfResults: 1, result: [{ references: [{ componentId: sharedChild }] }] })
            
            // Discovery for Root B
            .get(`${baseApiUrl}/ComponentMetadata/${rootB}`).reply(200, { name: 'Root B', version: 1, type: 'PROCESS' })
            .post(`${baseApiUrl}/ComponentReference/query`, (body: any) => 
                body.QueryFilter?.expression?.nestedExpression?.some((e: any) => e.property === 'parentComponentId' && e.argument[0] === rootB)
            ).reply(200, { numberOfResults: 1, result: [{ references: [{ componentId: sharedChild }] }] })
            
            // Discovery for Shared Child
            .get(`${baseApiUrl}/ComponentMetadata/${sharedChild}`).times(2).reply(200, { name: 'Shared', version: 1, type: 'SUBPROCESS' })
            .post(`${baseApiUrl}/ComponentReference/query`, (body: any) => 
                body.QueryFilter?.expression?.nestedExpression?.some((e: any) => e.property === 'parentComponentId' && e.argument[0] === sharedChild)
            ).times(2).reply(200, { numberOfResults: 0 });

        // --- Act & Assert ---
        const initialResponse = await request(app).post('/api/v1/test-plans').send(requestBody).expect(202);
        const planId = initialResponse.body.data.id;
        await new Promise(resolve => setTimeout(resolve, 500));

        // Assert that the final plan in the database only contains 3 unique components
        const componentsResult = await testPool.query('SELECT component_id FROM plan_components WHERE test_plan_id = $1', [planId]);
        expect(componentsResult.rowCount).toBe(3);

        const detailsResponse = await request(app).get(`/api/v1/test-plans/${planId}`).expect(200);
        expect(detailsResponse.body.data.planComponents).toHaveLength(3);
        expect(nock.isDone()).toBe(true);
    });
});