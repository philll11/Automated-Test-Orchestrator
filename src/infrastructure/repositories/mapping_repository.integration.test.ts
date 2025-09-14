// src/infrastructure/repositories/component_test_mapping_repository.integration.test.ts

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
        port: parseInt(process.env.DB_PORT || '5433', 10),
    });

    // Keep track of created records to test findById, update, delete
    let mappingA1: Mapping;

    beforeAll(async () => {
        repository = new MappingRepository(testPool);
        try {
            await testPool.query('SELECT NOW()');
        } catch (error) {
            console.error('Test database connection failed:', error);
            throw error;
        }
    });

    beforeEach(async () => {
        await testPool.query('TRUNCATE TABLE mappings RESTART IDENTITY CASCADE');

        // Seed data now includes the UUID and multiple tests for comp-A
        const now = new Date();
        mappingA1 = { id: uuidv4(), mainComponentId: 'comp-A', testComponentId: 'test-A1', createdAt: now, updatedAt: now };
        const mappingA2 = { id: uuidv4(), mainComponentId: 'comp-A', testComponentId: 'test-A2', createdAt: now, updatedAt: now };
        const mappingB1 = { id: uuidv4(), mainComponentId: 'comp-B', testComponentId: 'test-B1', createdAt: now, updatedAt: now };
        
        for (const m of [mappingA1, mappingA2, mappingB1]) {
            await testPool.query(
                'INSERT INTO mappings (id, main_component_id, test_component_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
                [m.id, m.mainComponentId, m.testComponentId, m.createdAt, m.updatedAt]
            );
        }
    });

    afterAll(async () => {
        await testPool.end();
    });

    describe('create', () => {
        it('should correctly save a new mapping to the database', async () => {
            const newMappingData = { id: uuidv4(), mainComponentId: 'comp-C', testComponentId: 'test-C1' };
            const createdMapping = await repository.create(newMappingData);
            expect(createdMapping.id).toBe(newMappingData.id);
            expect(createdMapping.mainComponentId).toBe('comp-C');
            
            const result = await testPool.query('SELECT * FROM mappings WHERE id = $1', [newMappingData.id]);
            expect(result.rowCount).toBe(1);
        });
    });

    describe('findById', () => {
        it('should return a single mapping by its unique UUID', async () => {
            const found = await repository.findById(mappingA1.id);
            expect(found).not.toBeNull();
            expect(found?.testComponentId).toBe('test-A1');
        });
    });

    describe('findByMainComponentId', () => {
        it('should return all mappings for a given main component ID', async () => {
            const found = await repository.findByMainComponentId('comp-A');
            expect(found).toHaveLength(2);
            expect(found.map(m => m.testComponentId)).toContain('test-A1');
            expect(found.map(m => m.testComponentId)).toContain('test-A2');
        });
    });

    describe('findAll', () => {
        it('should return all mappings in the table', async () => {
            const allMappings = await repository.findAll();
            expect(allMappings).toHaveLength(3);
        });
    });

    describe('findAllTestsForMainComponents', () => {
        it('should return a map of main component IDs to an array of their test IDs', async () => {
            const idsToFind = ['comp-A', 'comp-B', 'comp-C']; // comp-C does not exist
            const resultMap = await repository.findAllTestsForMainComponents(idsToFind);

            expect(resultMap.get('comp-A')).toEqual(['test-A1', 'test-A2']);
            expect(resultMap.get('comp-B')).toEqual(['test-B1']);
            expect(resultMap.has('comp-C')).toBe(false);
        });
    });

    describe('update', () => {
        it('should update the test_component_id of a specific mapping record', async () => {
            const updatedMapping = await repository.update(mappingA1.id, { testComponentId: 'test-A1-updated' });
            expect(updatedMapping?.testComponentId).toBe('test-A1-updated');

            const result = await testPool.query('SELECT test_component_id FROM mappings WHERE id = $1', [mappingA1.id]);
            expect(result.rows[0].test_component_id).toBe('test-A1-updated');
        });
    });

    describe('delete', () => {
        it('should delete a specific mapping record by its unique id and return true', async () => {
            const wasDeleted = await repository.delete(mappingA1.id);
            expect(wasDeleted).toBe(true);
            
            const result = await testPool.query('SELECT * FROM mappings WHERE id = $1', [mappingA1.id]);
            expect(result.rowCount).toBe(0);
        });

        it('should return false if no record was found to delete', async () => {
            const wasDeleted = await repository.delete(uuidv4());
            expect(wasDeleted).toBe(false);
        });
    });
});