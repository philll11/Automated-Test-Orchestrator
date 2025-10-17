// src/infrastructure/repositories/test_plan_entry_point_repository.integration.test.ts

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { TestPlanEntryPointRepository } from './test_plan_entry_point_repository';
import { TestPlanEntryPoint } from '../../domain/test_plan_entry_point';
import { TestPlan } from '../../domain/test_plan';

describe('TestPlanEntryPointRepository Integration Tests', () => {
    let repository: TestPlanEntryPointRepository;
    const testPool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432', 10),
    });

    let parentTestPlan: TestPlan;

    beforeAll(async () => {
        repository = new TestPlanEntryPointRepository(testPool);
        try {
            await testPool.query('SELECT NOW()');
        } catch (error) {
            console.error('Test database connection failed:', error);
            throw error;
        }
    });

    beforeEach(async () => {
        // Truncating test_plans will cascade and delete from entry points
        await testPool.query('TRUNCATE TABLE test_plans RESTART IDENTITY CASCADE');

        // UPDATED: The TestPlan object and INSERT statement now require a 'name'
        parentTestPlan = {
            id: uuidv4(),
            name: 'Parent Entry Point Plan',
            status: 'DISCOVERING',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await testPool.query(
            'INSERT INTO test_plans (id, name, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
            [parentTestPlan.id, parentTestPlan.name, parentTestPlan.status, parentTestPlan.createdAt, parentTestPlan.updatedAt]
        );
    });

    afterAll(async () => {
        await testPool.end();
    });

    describe('saveAll', () => {
        it('should save all provided entry points linked to the correct test plan', async () => {
            // Arrange
            const entryPoints: TestPlanEntryPoint[] = [
                { id: uuidv4(), testPlanId: parentTestPlan.id, componentId: 'comp-A' },
                { id: uuidv4(), testPlanId: parentTestPlan.id, componentId: 'comp-B' },
                { id: uuidv4(), testPlanId: parentTestPlan.id, componentId: 'comp-C' },
            ];

            // Act
            await repository.saveAll(entryPoints);

            // Assert
            const result = await testPool.query('SELECT * FROM test_plan_entry_points WHERE test_plan_id = $1 ORDER BY component_id ASC', [parentTestPlan.id]);
            expect(result.rowCount).toBe(3);
            expect(result.rows[0].component_id).toBe('comp-A');
        });

        it('should not insert anything if the entry points array is empty', async () => {
            // Arrange
            const entryPoints: TestPlanEntryPoint[] = [];

            // Act
            await repository.saveAll(entryPoints);

            // Assert
            const result = await testPool.query('SELECT * FROM test_plan_entry_points');
            expect(result.rowCount).toBe(0);
        });
    });
});