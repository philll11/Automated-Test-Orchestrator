// src/e2e/test_execution_results.e2e.test.ts

import request from 'supertest';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import app from '../app.js';
import globalPool from '../infrastructure/database.js';

describe('GET /api/v1/test-execution-results End-to-End Test', () => {
    let testPool: Pool;

    // Define IDs for seeding the database
    const plan1Id = uuidv4();
    const plan2Id = uuidv4();

    const pc1Id = uuidv4(); // planComponent 1, belongs to plan1
    const pc2Id = uuidv4(); // planComponent 2, belongs to plan1
    const pc3Id = uuidv4(); // planComponent 3, belongs to plan2

    beforeAll(async () => {
        testPool = new Pool({
            user: process.env.DB_USER, host: process.env.DB_HOST, database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD, port: parseInt(process.env.DB_PORT || '5433', 10),
        });

        // --- Seed the database with valid, refactored data ---
        // CORRECTED: Truncate the new table names
        await testPool.query('TRUNCATE TABLE test_plans, plan_components, mappings, test_execution_results RESTART IDENTITY CASCADE');

        // 1. Test Plans (without root_component_id)
        await testPool.query(`INSERT INTO test_plans (id, name, status, plan_type, created_at, updated_at) VALUES ($1, 'Results Plan 1', 'COMPLETED', 'COMPONENT', NOW(), NOW()), ($2, 'Results Plan 2', 'COMPLETED', 'COMPONENT', NOW(), NOW())`, [plan1Id, plan2Id]);

        // 2. Plan Components
        await testPool.query(`INSERT INTO plan_components (id, test_plan_id, component_id, component_name, source_type) VALUES ($1, $2, 'comp-A', 'Component A', 'DIRECT')`, [pc1Id, plan1Id]);
        await testPool.query(`INSERT INTO plan_components (id, test_plan_id, component_id, component_name, source_type) VALUES ($1, $2, 'comp-B', 'Component B', 'DIRECT')`, [pc2Id, plan1Id]);
        await testPool.query(`INSERT INTO plan_components (id, test_plan_id, component_id, component_name, source_type) VALUES ($1, $2, 'comp-C', 'Component C', 'DIRECT')`, [pc3Id, plan2Id]);

        // 3. Mappings
        await testPool.query(`INSERT INTO mappings (id, main_component_id, test_component_id, test_component_name, created_at, updated_at) VALUES ($1, 'comp-A', 'test-A1', 'Test for A1', NOW(), NOW()), ($2, 'comp-C', 'test-C1', 'Test for C1', NOW(), NOW())`, [uuidv4(), uuidv4()]);

        // 4. Test Execution Results (using plan_component_id)
        await testPool.query(`
            INSERT INTO test_execution_results (id, test_plan_id, plan_component_id, test_component_id, status, executed_at)
            VALUES
                ('${uuidv4()}', '${plan1Id}', '${pc1Id}', 'test-A1', 'SUCCESS', NOW()),
                ('${uuidv4()}', '${plan1Id}', '${pc1Id}', 'test-A2', 'FAILURE', NOW()),
                ('${uuidv4()}', '${plan1Id}', '${pc2Id}', 'test-B1', 'SUCCESS', NOW()),
                ('${uuidv4()}', '${plan2Id}', '${pc3Id}', 'test-C1', 'SUCCESS', NOW())
        `);
    });

    afterAll(async () => {
        await testPool.end();
        await globalPool.end();
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
    });

    it('should filter by a combination of testPlanId and status', async () => {
        const response = await request(app)
            .get('/api/v1/test-execution-results')
            .query({ testPlanId: plan1Id, status: 'SUCCESS' })
            .expect(200);

        expect(response.body).toHaveLength(2);
        expect(response.body.every((r: any) => r.testPlanId === plan1Id && r.status === 'SUCCESS')).toBe(true);
    });

    it('should filter by planComponentId', async () => {
        // CORRECTED: The query parameter is now 'planComponentId'
        const response = await request(app)
            .get('/api/v1/test-execution-results')
            .query({ planComponentId: pc1Id })
            .expect(200);

        expect(response.body).toHaveLength(2);
        expect(response.body[0].componentName).toBe('Component A');
        expect(response.body[1].componentName).toBe('Component A');
    });

    it('should return an empty array if no results match the filter', async () => {
        const response = await request(app)
            .get('/api/v1/test-execution-results')
            .query({ testPlanId: uuidv4() })
            .expect(200);

        expect(response.body).toHaveLength(0);
    });

    it('should return an empty array if no filters are provided', async () => {
        const response = await request(app)
            .get('/api/v1/test-execution-results')
            .expect(200);

        expect(response.body).toHaveLength(0);
    });
});