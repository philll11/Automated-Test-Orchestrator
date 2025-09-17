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
        await testPool.end();
    });

    describe('save', () => {
        it('should correctly save a new TestPlan to the database', async () => {
            // Arrange
            const testPlan: TestPlan = {
                id: uuidv4(),
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
            // Verify that the root_component_id column does not exist and wasn't saved
            expect(result.rows[0].root_component_id).toBeUndefined();
        });
    });

    describe('findById', () => {
        it('should return a TestPlan if one exists with the given id', async () => {
            // Arrange
            const testPlan: TestPlan = {
                id: uuidv4(),
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
            // Arrange
            const initialPlan: TestPlan = {
                id: uuidv4(),
                status: 'DISCOVERING',
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            await repository.save(initialPlan);

            // Act
            const planToUpdate = (await repository.findById(initialPlan.id))!;
            planToUpdate.status = 'DISCOVERY_FAILED';
            planToUpdate.failureReason = 'API credentials invalid';

            const updatedPlan = await repository.update(planToUpdate);

            // Assert
            expect(updatedPlan.status).toBe('DISCOVERY_FAILED');
            expect(updatedPlan.failureReason).toBe('API credentials invalid');

            const result = await testPool.query('SELECT status, failure_reason FROM test_plans WHERE id = $1', [initialPlan.id]);
            expect(result.rows[0].status).toBe('DISCOVERY_FAILED');
            expect(result.rows[0].failure_reason).toBe('API credentials invalid');
        });
    });

    describe('findAll', () => {
        it('should return all test plans, ordered by creation date descending', async () => {
            const plan1: TestPlan = { id: uuidv4(), status: 'COMPLETED', createdAt: new Date('2025-01-01'), updatedAt: new Date() };
            const plan2: TestPlan = { id: uuidv4(), status: 'DISCOVERY_FAILED', createdAt: new Date('2025-01-02'), updatedAt: new Date() };
            await repository.save(plan1);
            await repository.save(plan2);

            // Act
            const plans = await repository.findAll();

            // Assert
            expect(plans).toHaveLength(2);
            expect(plans[0].id).toBe(plan2.id);
            expect(plans[1].id).toBe(plan1.id);
        });

        it('should return an empty array if no test plans exist', async () => {
            // Act
            const plans = await repository.findAll();

            // Assert
            expect(plans).toHaveLength(0);
        });
    });
});