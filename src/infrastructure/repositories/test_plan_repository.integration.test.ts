// src/infrastructure/repositories/test_plan_repository.integration.test.ts

import { TestPlanRepository } from './test_plan_repository';
import { Pool } from 'pg';
import { TestPlan } from '../../domain/test_plan';
import { v4 as uuidv4 } from 'uuid';

describe('TestPlanRepository Integration Tests', () => {
    let repository: TestPlanRepository;
    const testPool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5433', 10),
    });

    beforeAll(async () => {
        repository = new TestPlanRepository(testPool);
        try {
            await testPool.query('SELECT NOW()');
        } catch (error) {
            console.error('Test database connection failed:', error);
            throw error;
        }
    });

    beforeEach(async () => {
        // Truncating test_plans will cascade and delete from all other tables
        await testPool.query('TRUNCATE TABLE test_plans RESTART IDENTITY CASCADE');
    });

    afterAll(async () => {
        // We no longer need to close the globalPool here as it's not used in this test.
        await testPool.end();
    });

    describe('save', () => {
        it('should correctly save a new TestPlan to the database', async () => {
            // Arrange: Use a valid new status
            const testPlan: TestPlan = {
                id: uuidv4(),
                rootComponentId: 'comp-root-1',
                status: 'DISCOVERING',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // Act
            const savedPlan = await repository.save(testPlan);

            // Assert
            expect(savedPlan.status).toBe('DISCOVERING');
            const result = await testPool.query('SELECT * FROM test_plans WHERE id = $1', [testPlan.id]);
            expect(result.rowCount).toBe(1);
        });
    });

    describe('findById', () => {
        it('should return a TestPlan if one exists with the given id', async () => {
            // Arrange: Use a valid new status
            const testPlan: TestPlan = {
                id: uuidv4(),
                rootComponentId: 'comp-root-2',
                status: 'AWAITING_SELECTION',
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            await repository.save(testPlan);

            // Act
            const foundPlan = await repository.findById(testPlan.id);

            // Assert
            expect(foundPlan).not.toBeNull();
            expect(foundPlan?.status).toBe('AWAITING_SELECTION');
        });

        it('should return null if no TestPlan exists with the given id', async () => {
            const foundPlan = await repository.findById(uuidv4());
            expect(foundPlan).toBeNull();
        });
    });

    describe('update', () => {
        it('should update the status and failureReason of an existing TestPlan', async () => {
            // Arrange: Use a valid new status
            const initialPlan: TestPlan = {
                id: uuidv4(),
                rootComponentId: 'comp-root-3',
                status: 'DISCOVERING',
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            await repository.save(initialPlan);

            // Act: Update to a valid new status
            const planToUpdate = (await repository.findById(initialPlan.id))!;
            planToUpdate.status = 'DISCOVERY_FAILED';
            planToUpdate.failureReason = 'API credentials invalid';

            const updatedPlan = await repository.update(planToUpdate);

            // Assert
            expect(updatedPlan.status).toBe('DISCOVERY_FAILED');
            expect(updatedPlan.failureReason).toBe('API credentials invalid');

            // Verify directly against the database
            const result = await testPool.query('SELECT status, failure_reason FROM test_plans WHERE id = $1', [initialPlan.id]);
            expect(result.rows[0].status).toBe('DISCOVERY_FAILED');
            expect(result.rows[0].failure_reason).toBe('API credentials invalid');
        });
    });
});