// src/e2e/mappings.e2e.test.ts

import request from 'supertest';
import { Pool } from 'pg';
import app from '../app.js';
import globalPool from '../infrastructure/database.js';

describe('Mappings API End-to-End Tests', () => {
    let testPool: Pool;

    beforeAll(() => {
        // --- CORRECTED CONNECTION ---
        testPool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: parseInt(process.env.DB_PORT || '5432', 10),
        });
    });

    beforeEach(async () => {
        await testPool.query('TRUNCATE TABLE mappings RESTART IDENTITY CASCADE');
    });

    afterAll(async () => {
        await testPool.end();
        await globalPool.end();
    });

    it('should perform a full CRUD lifecycle for a mapping, including mainComponentName', async () => {
        // --- 1. CREATE ---
        // UPDATED: Include the new mainComponentName field
        const createResponse = await request(app)
            .post('/api/v1/mappings')
            .send({
                mainComponentId: 'e2e-comp-1',
                mainComponentName: 'E2E Main Component',
                testComponentId: 'e2e-test-1',
                testComponentName: 'E2E Test',
                isDeployed: true,
            })
            .expect(201);

        const newMappingId = createResponse.body.data.id;
        expect(newMappingId).toBeDefined();
        expect(createResponse.body.data.mainComponentId).toBe('e2e-comp-1');
        // UPDATED: Assert the new field was returned correctly
        expect(createResponse.body.data.mainComponentName).toBe('E2E Main Component');

        // --- 2. READ (Single) ---
        const getResponse = await request(app)
            .get(`/api/v1/mappings/${newMappingId}`)
            .expect(200);

        expect(getResponse.body.data.id).toBe(newMappingId);
        expect(getResponse.body.data.mainComponentName).toBe('E2E Main Component');

        // --- 3. READ (All) ---
        await request(app).post('/api/v1/mappings').send({ mainComponentId: 'e2e-comp-2', mainComponentName: 'Component 2', testComponentId: 'e2e-test-2' });
        
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
        // UPDATED: Include mainComponentName in the update payload
        const updateResponse = await request(app)
            .put(`/api/v1/mappings/${newMappingId}`)
            .send({
                mainComponentName: 'E2E Main Component (Updated)',
                testComponentName: 'E2E Test (Updated)',
            })
            .expect(200);
        
        // UPDATED: Assert that the main component name was updated
        expect(updateResponse.body.data.mainComponentName).toBe('E2E Main Component (Updated)');
        expect(updateResponse.body.data.testComponentName).toBe('E2E Test (Updated)');

        // --- 6. DELETE ---
        await request(app)
            .delete(`/api/v1/mappings/${newMappingId}`)
            .expect(204);

        // --- 7. VERIFY DELETION ---
        await request(app)
            .get(`/api/v1/mappings/${newMappingId}`)
            .expect(404);
            
        const finalGetAllResponse = await request(app).get('/api/v1/mappings').expect(200);
        expect(finalGetAllResponse.body.data).toHaveLength(1);
    });
});