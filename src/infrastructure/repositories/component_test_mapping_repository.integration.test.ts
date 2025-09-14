// src/infrastructure/repositories/component_test_mapping_repository.integration.test.ts

import { Pool } from 'pg';
import { ComponentTestMappingRepository } from './component_test_mapping_repository';
import { v4 as uuidv4 } from 'uuid';

describe('ComponentTestMappingRepository Integration Tests', () => {
    let repository: ComponentTestMappingRepository;
    const testPool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5433', 10),
    });

    beforeAll(async () => {
        repository = new ComponentTestMappingRepository(testPool);
        try {
            await testPool.query('SELECT NOW()'); // Verify connection
        } catch (error) {
            console.error('Test database connection failed:', error);
            throw error;
        }
    });

    // Before each test, clean the table and insert fresh test data
    beforeEach(async () => {
        await testPool.query('TRUNCATE TABLE component_test_mappings RESTART IDENTITY CASCADE');

        // Insert some seed data for our tests
        const now = new Date();
        const mappings = [
            { main_component_id: 'comp-A', test_component_id: 'test-A', created_at: now, updated_at: now },
            { main_component_id: 'comp-B', test_component_id: 'test-B', created_at: now, updated_at: now },
        ];
        for (const mapping of mappings) {
            await testPool.query(
                'INSERT INTO component_test_mappings (main_component_id, test_component_id, created_at, updated_at) VALUES ($1, $2, $3, $4)',
                [mapping.main_component_id, mapping.test_component_id, mapping.created_at, mapping.updated_at]
            );
        }
    });

    afterAll(async () => {
        await testPool.end();
    });

    describe('findTestMapping', () => {
        it('should return a mapping if one exists for the given mainComponentId', async () => {
            // Act
            const foundMapping = await repository.findTestMapping('comp-A');

            // Assert
            expect(foundMapping).not.toBeNull();
            expect(foundMapping?.mainComponentId).toBe('comp-A');
            expect(foundMapping?.testComponentId).toBe('test-A');
        });

        it('should return null if no mapping exists for the given mainComponentId', async () => {
            // Act
            const foundMapping = await repository.findTestMapping('non-existent-comp');

            // Assert
            expect(foundMapping).toBeNull();
        });
    });

    describe('findAllTestMappings', () => {
        it('should return a map of testComponentIds for all found mainComponentIds', async () => {
            // Arrange
            const idsToFind = ['comp-A', 'comp-B', 'comp-C-non-existent'];

            // Act
            const resultMap = await repository.findAllTestMappings(idsToFind);

            // Assert
            expect(resultMap).toBeInstanceOf(Map);
            expect(resultMap.size).toBe(2);
            expect(resultMap.get('comp-A')).toBe('test-A');
            expect(resultMap.get('comp-B')).toBe('test-B');
            expect(resultMap.has('comp-C-non-existent')).toBe(false);
        });

        it('should return an empty map if no mainComponentIds are provided', async () => {
            // Act
            const resultMap = await repository.findAllTestMappings([]);

            // Assert
            expect(resultMap.size).toBe(0);
        });

        it('should return an empty map if none of the provided mainComponentIds are found', async () => {
            // Act
            const resultMap = await repository.findAllTestMappings(['comp-X', 'comp-Y']);

            // Assert
            expect(resultMap.size).toBe(0);
        });
    });
});