// src/e2e/mappings.e2e.test.ts

import request from 'supertest';
import { Pool } from 'pg';
import app from '../app.js';
import globalPool from '../infrastructure/database.js';

describe('Mappings API End-to-End Tests', () => {
    let testPool: Pool;

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
        // We only need to clean the mappings table for these tests
        await testPool.query('TRUNCATE TABLE mappings RESTART IDENTITY CASCADE');
    });

    afterAll(async () => {
        await testPool.end();
        await globalPool.end();
    });

    it('should perform a full CRUD lifecycle for a mapping', async () => {
        // --- 1. CREATE ---
        const createResponse = await request(app)
            .post('/api/v1/mappings')
            .send({
                mainComponentId: 'e2e-comp-1',
                testComponentId: 'e2e-test-1',
                testComponentName: 'E2E Test',
                isDeployed: true,
                isPackaged: false,
            })
            .expect(201);

        expect(createResponse.body.data.id).toBeDefined();
        const newMappingId = createResponse.body.data.id;
        expect(createResponse.body.data.mainComponentId).toBe('e2e-comp-1');
        expect(createResponse.body.data.isDeployed).toBe(true);

        // --- 2. READ (Single) ---
        const getResponse = await request(app)
            .get(`/api/v1/mappings/${newMappingId}`)
            .expect(200);

        expect(getResponse.body.data.id).toBe(newMappingId);
        expect(getResponse.body.data.testComponentName).toBe('E2E Test');

        // --- 3. READ (All) ---
        // First, create a second mapping to test the "get all" functionality
        await request(app).post('/api/v1/mappings').send({ mainComponentId: 'e2e-comp-2', testComponentId: 'e2e-test-2' });
        
        const getAllResponse = await request(app)
            .get('/api/v1/mappings')
            .expect(200);
        
        expect(getAllResponse.body.data).toHaveLength(2);
        
        // --- 4. READ (By Main Component ID) ---
        const getByComponentResponse = await request(app)
            .get('/api/v1/mappings/component/e2e-comp-1')
            .expect(200);

        expect(getByComponentResponse.body.data).toHaveLength(1);
        expect(getByComponentResponse.body.data[0].testComponentId).toBe('e2e-test-1');

        // --- 5. UPDATE ---
        const updateResponse = await request(app)
            .put(`/api/v1/mappings/${newMappingId}`)
            .send({
                testComponentName: 'E2E Test (Updated)',
                isDeployed: false,
            })
            .expect(200);
        
        expect(updateResponse.body.data.testComponentName).toBe('E2E Test (Updated)');
        expect(updateResponse.body.data.isDeployed).toBe(false);

        // --- 6. DELETE ---
        await request(app)
            .delete(`/api/v1/mappings/${newMappingId}`)
            .expect(204);

        // --- 7. VERIFY DELETION ---
        await request(app)
            .get(`/api/v1/mappings/${newMappingId}`)
            .expect(404);
            
        // Final check: ensure only one record remains
        const finalGetAllResponse = await request(app).get('/api/v1/mappings').expect(200);
        expect(finalGetAllResponse.body.data).toHaveLength(1);
    });
});