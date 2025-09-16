// src/e2e/test_plans.e2e.test.ts

import request from 'supertest';
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import app from '../app.js';
import globalPool from '../infrastructure/database.js';

describe('GET /api/v1/test-plans End-to-End Test', () => {
    let testPool: pg.Pool;

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
        await testPool.query('TRUNCATE TABLE test_plans RESTART IDENTITY CASCADE');

        // Seed two test plans
        await testPool.query(`
            INSERT INTO test_plans (id, root_component_id, status, created_at, updated_at)
            VALUES
                ('${uuidv4()}', 'root-e2e-1', 'COMPLETED', NOW(), NOW()),
                ('${uuidv4()}', 'root-e2e-2', 'DISCOVERY_FAILED', NOW(), NOW())
        `);
    });

    afterAll(async () => {
        await testPool.end();
        await globalPool.end();
    });

    it('should retrieve a list of all test plans', async () => {
        const response = await request(app)
            .get('/api/v1/test-plans')
            .expect(200);

        // The API returns a standard response wrapper
        const plans = response.body.data;

        expect(plans).toBeInstanceOf(Array);
        expect(plans).toHaveLength(2);

        // Sort results to make the test deterministic, as insertion order isn't guaranteed
        const sortedPlans = plans.sort((a: any, b: any) => a.rootComponentId.localeCompare(b.rootComponentId));

        // Check for the presence of key fields
        expect(plans[0].rootComponentId).toBe('root-e2e-1');
        expect(plans[0].status).toBe('COMPLETED');
        expect(plans[1].rootComponentId).toBe('root-e2e-2');
        expect(plans[1].status).toBe('DISCOVERY_FAILED');
    });
});