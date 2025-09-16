// src/e2e/test_execution_results.e2e.test.ts

import request from 'supertest';
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import app from '../app.js';
import globalPool from '../infrastructure/database.js';

describe('GET /api/v1/test-execution-results End-to-End Test', () => {
    let testPool: pg.Pool;

    // We will seed the database with a known state
    const plan1Id = uuidv4();
    const plan2Id = uuidv4();

    const dc1Id = uuidv4(); // Belongs to plan1
    const dc2Id = uuidv4(); // Belongs to plan1
    const dc3Id = uuidv4(); // Belongs to plan2

    beforeAll(() => {
        testPool = new pg.Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT || '5433', 10),
        });
    });

    // Seed the database before all tests in this suite
    beforeAll(async () => {
        await testPool.query('TRUNCATE TABLE test_plans, discovered_components, mappings, test_execution_results RESTART IDENTITY CASCADE');

        // --- Seed Data ---
        // 1. Test Plans
        await testPool.query(`INSERT INTO test_plans (id, root_component_id, status, created_at, updated_at) VALUES ($1, 'root-1', 'COMPLETED', NOW(), NOW()), ($2, 'root-2', 'COMPLETED', NOW(), NOW())`, [plan1Id, plan2Id]);

        // 2. Discovered Components
        await testPool.query(`INSERT INTO discovered_components (id, test_plan_id, component_id, component_name) VALUES ($1, $2, 'comp-A', 'Component A')`, [dc1Id, plan1Id]);
        await testPool.query(`INSERT INTO discovered_components (id, test_plan_id, component_id, component_name) VALUES ($1, $2, 'comp-B', 'Component B')`, [dc2Id, plan1Id]);
        await testPool.query(`INSERT INTO discovered_components (id, test_plan_id, component_id, component_name) VALUES ($1, $2, 'comp-C', 'Component C')`, [dc3Id, plan2Id]);

        // 3. Mappings
        await testPool.query(`INSERT INTO mappings (id, main_component_id, test_component_id, test_component_name, created_at, updated_at) VALUES ($1, 'comp-A', 'test-A1', 'Test for A1', NOW(), NOW()), ($2, 'comp-C', 'test-C1', 'Test for C1', NOW(), NOW())`, [uuidv4(), uuidv4()]);

        // 4. Test Execution Results (3 for plan1, 1 for plan2)
        await testPool.query(`
            INSERT INTO test_execution_results (id, test_plan_id, discovered_component_id, test_component_id, status, executed_at)
            VALUES
                ('${uuidv4()}', '${plan1Id}', '${dc1Id}', 'test-A1', 'SUCCESS', NOW()),
                ('${uuidv4()}', '${plan1Id}', '${dc1Id}', 'test-A2', 'FAILURE', NOW()),
                ('${uuidv4()}', '${plan1Id}', '${dc2Id}', 'test-B1', 'SUCCESS', NOW()),
                ('${uuidv4()}', '${plan2Id}', '${dc3Id}', 'test-C1', 'SUCCESS', NOW())
        `);
    });

    afterAll(async () => {
        await testPool.end();
        await globalPool.end(); // Close the main app pool as well
    });

    it('should filter results by testPlanId', async () => {
        const response = await request(app)
            .get('/api/v1/test-execution-results')
            .query({ testPlanId: plan2Id })
            .expect(200);

        expect(response.body).toHaveLength(1);
        expect(response.body[0].testPlanId).toBe(plan2Id);
        expect(response.body[0].componentName).toBe('Component C');
        expect(response.body[0].testComponentName).toBe('Test for C1');
    });

    it('should filter results by status', async () => {
        const response = await request(app)
            .get('/api/v1/test-execution-results')
            .query({ status: 'FAILURE' })
            .expect(200);

        expect(response.body).toHaveLength(1);
        expect(response.body[0].status).toBe('FAILURE');
        expect(response.body[0].testComponentId).toBe('test-A2');
        // This test did not have a corresponding mapping, so the name should be null
        expect(response.body[0].testComponentName).toBeNull();
    });

    it('should filter by a combination of testPlanId and status', async () => {
        const response = await request(app)
            .get('/api/v1/test-execution-results')
            .query({ testPlanId: plan1Id, status: 'SUCCESS' })
            .expect(200);

        expect(response.body).toHaveLength(2);
        // Ensure both returned results match the filter criteria
        expect(response.body.every((r: any) => r.testPlanId === plan1Id && r.status === 'SUCCESS')).toBe(true);
    });

    it('should filter by discoveredComponentId', async () => {
        const response = await request(app)
            .get('/api/v1/test-execution-results')
            .query({ discoveredComponentId: dc1Id })
            .expect(200);

        expect(response.body).toHaveLength(2);
        expect(response.body[0].componentName).toBe('Component A');
        expect(response.body[1].componentName).toBe('Component A');
    });

    it('should return an empty array if no results match the filter', async () => {
        const response = await request(app)
            .get('/api/v1/test-execution-results')
            .query({ testPlanId: uuidv4() }) // A non-existent ID
            .expect(200);

        expect(response.body).toHaveLength(0);
    });

    it('should return an empty array if no filters are provided', async () => {
        // As per our repository logic, no filters means no results.
        const response = await request(app)
            .get('/api/v1/test-execution-results')
            .expect(200);

        expect(response.body).toHaveLength(0);
    });
});