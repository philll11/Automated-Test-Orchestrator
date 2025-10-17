// src/infrastructure/repositories/mapping_repository.integration.test.ts

import { Pool } from 'pg';
import { MappingRepository } from './mapping_repository.js';
import { v4 as uuidv4 } from 'uuid';
import { Mapping } from '../../domain/mapping.js';

describe('MappingRepository Integration Tests', () => {
    let repository: MappingRepository;
    const testPool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432', 10),
    });
    let mappingA1: Mapping;

    beforeAll(async () => {
        repository = new MappingRepository(testPool);
        // Verify the connection
        try {
            await testPool.query('SELECT NOW()');
        } catch (error) {
            console.error('Test database connection failed:', error);
            throw error;
        }
    });

    beforeEach(async () => {
        // Clear the table before each test for isolation
        await testPool.query('TRUNCATE TABLE mappings RESTART IDENTITY CASCADE');

        // Seed data now includes the mainComponentName
        const now = new Date();
        mappingA1 = { id: uuidv4(), mainComponentId: 'comp-A', mainComponentName: 'Component A', testComponentId: 'test-A1', testComponentName: 'Test A1', createdAt: now, updatedAt: now };
        const mappingA2 = { id: uuidv4(), mainComponentId: 'comp-A', mainComponentName: 'Component A', testComponentId: 'test-A2', testComponentName: 'Test A2', createdAt: now, updatedAt: now };
        const mappingB1 = { id: uuidv4(), mainComponentId: 'comp-B', mainComponentName: 'Component B', testComponentId: 'test-B1', testComponentName: 'Test B1', createdAt: now, updatedAt: now };

        for (const m of [mappingA1, mappingA2, mappingB1]) {
            await testPool.query(
                'INSERT INTO mappings (id, main_component_id, main_component_name, test_component_id, test_component_name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [m.id, m.mainComponentId, m.mainComponentName, m.testComponentId, m.testComponentName, m.createdAt, m.updatedAt]
            );
        }
    });

    afterAll(async () => {
        await testPool.end();
    });

    describe('create', () => {
        it('should correctly save a new mapping with a mainComponentName', async () => {
            const newMappingData = { id: uuidv4(), mainComponentId: 'comp-C', mainComponentName: 'Component C', testComponentId: 'test-C1' };
            const createdMapping = await repository.create(newMappingData);

            expect(createdMapping.id).toBe(newMappingData.id);
            expect(createdMapping.mainComponentName).toBe('Component C');

            const result = await testPool.query('SELECT * FROM mappings WHERE id = $1', [newMappingData.id]);
            expect(result.rows[0].main_component_name).toBe('Component C');
        });
    });

    describe('findById', () => {
        it('should return a single mapping including its mainComponentName', async () => {
            const found = await repository.findById(mappingA1.id);
            expect(found).not.toBeNull();
            expect(found?.mainComponentName).toBe('Component A');
        });
    });

    describe('findByMainComponentId', () => {
        it('should return all mappings for a given main component ID', async () => {
            const found = await repository.findByMainComponentId('comp-A');
            expect(found).toHaveLength(2);
            expect(found[0].mainComponentName).toBe('Component A');
        });
    });

    describe('findAll', () => {
        it('should return all mappings in the table', async () => {
            const allMappings = await repository.findAll();
            expect(allMappings).toHaveLength(3);
        });
    });

    describe('findAllTestsForMainComponents', () => {
        it('should return a map of main component IDs to an array of test info objects', async () => {
            const idsToFind = ['comp-A', 'comp-B', 'comp-C'];
            const resultMap = await repository.findAllTestsForMainComponents(idsToFind);

            expect(resultMap.get('comp-A')).toEqual([
                { id: 'test-A1', name: 'Test A1' },
                { id: 'test-A2', name: 'Test A2' },
            ]);
            expect(resultMap.get('comp-B')).toEqual([
                { id: 'test-B1', name: 'Test B1' },
            ]);
            expect(resultMap.has('comp-C')).toBe(false);
        });
    });

    describe('update', () => {
        it('should update the main_component_name of a record', async () => {
            const updatedMapping = await repository.update(mappingA1.id, { mainComponentName: 'Component A Updated' });
            expect(updatedMapping?.mainComponentName).toBe('Component A Updated');

            const result = await testPool.query('SELECT main_component_name FROM mappings WHERE id = $1', [mappingA1.id]);
            expect(result.rows[0].main_component_name).toBe('Component A Updated');
        });
    });

    describe('delete', () => {
        it('should delete a specific mapping record', async () => {
            const wasDeleted = await repository.delete(mappingA1.id);
            expect(wasDeleted).toBe(true);

            const result = await testPool.query('SELECT * FROM mappings WHERE id = $1', [mappingA1.id]);
            expect(result.rowCount).toBe(0);
        });
    });
});