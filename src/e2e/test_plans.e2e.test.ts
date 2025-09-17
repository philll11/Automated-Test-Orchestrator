// src/e2e/test_plans.e2e.test.ts

import request from 'supertest';
import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import app from '../app.js';
import globalPool from '../infrastructure/database.js';

describe('GET /api/v1/test-plans End-to-End Test', () => {
    let testPool: pg.Pool;

    beforeAll(async () => {
        testPool = new pg.Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT || '5433', 10),
        });

        // Seed the database before all tests in this suite
        await testPool.query('TRUNCATE TABLE test_plans RESTART IDENTITY CASCADE');

        // Seed two valid test plans without root_component_id
        await testPool.query(`
            INSERT INTO test_plans (id, status, created_at, updated_at)
            VALUES
                ('${uuidv4()}', 'COMPLETED', NOW(), NOW()),
                ('${uuidv4()}', 'DISCOVERY_FAILED', NOW(), NOW())
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

        const plans = response.body.data;

        expect(plans).toBeInstanceOf(Array);
        expect(plans).toHaveLength(2);

        // Sort by a property that exists, like 'status', for a deterministic test.
        const sortedPlans = plans.sort((a: any, b: any) => a.status.localeCompare(b.status));

        // Check for properties that exist in the new model.
        expect(sortedPlans[0].status).toBe('COMPLETED');
        expect(sortedPlans[1].status).toBe('DISCOVERY_FAILED');
        expect(sortedPlans[0].id).toBeDefined();
        expect(sortedPlans[1].id).toBeDefined();
    });
});