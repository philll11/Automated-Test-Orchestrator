// src/e2e/test_plans.e2e.test.ts

import request from 'supertest';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import app from '../app.js';
import globalPool from '../infrastructure/database.js';

describe('GET /api/v1/test-plans End-to-End Test', () => {
    let testPool: Pool;

    beforeAll(async () => {
        // Use the same individual DB variables as other integration tests
        testPool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT || '5432', 10),
        });

        // Seed the database before all tests in this suite
        await testPool.query('TRUNCATE TABLE test_plans RESTART IDENTITY CASCADE');

        // UPDATED: The INSERT statement now includes the required 'name' column.
        await testPool.query(`
            INSERT INTO test_plans (id, name, status, plan_type, created_at, updated_at)
            VALUES
                ('${uuidv4()}', 'Completed E2E Plan', 'COMPLETED', 'COMPONENT', NOW(), NOW()),
                ('${uuidv4()}', 'Failed E2E Plan', 'DISCOVERY_FAILED', 'COMPONENT', NOW(), NOW())
        `);
    });

    afterAll(async () => {
        await testPool.end();
        await globalPool.end();
    });

    it('should retrieve a list of all test plans, including their names', async () => {
        const response = await request(app)
            .get('/api/v1/test-plans')
            .expect(200);

        const plans = response.body.data;

        expect(plans).toBeInstanceOf(Array);
        expect(plans).toHaveLength(2);

        // Sort by 'name' for a deterministic test.
        const sortedPlans = plans.sort((a: any, b: any) => a.name.localeCompare(b.name));

        expect(sortedPlans[0].name).toBe('Completed E2E Plan');
        expect(sortedPlans[0].status).toBe('COMPLETED');
        expect(sortedPlans[0].id).toBeDefined();

        expect(sortedPlans[1].name).toBe('Failed E2E Plan');
        expect(sortedPlans[1].status).toBe('DISCOVERY_FAILED');
        expect(sortedPlans[1].id).toBeDefined();
    });
});