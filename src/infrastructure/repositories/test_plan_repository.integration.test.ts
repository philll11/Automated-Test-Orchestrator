// src/infrastructure/repositories/test_plan_repository.integration.test.ts

import { TestPlanRepository } from './test_plan_repository';
import globalPool from '../database'; 
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
        port: parseInt(process.env.DB_PORT || '5433', 10), // Use the correct port
    });

    // Before any tests run, establish a connection.
    // The testPool connects lazily, so a simple query is a good way to verify the connection.
    beforeAll(async () => {
        repository = new TestPlanRepository(testPool);
        try {
            await testPool.query('SELECT NOW()');
            console.log('Test database connection successful.');
        } catch (error) {
            console.error('Test database connection failed:', error);
            throw error;
        }
    });

    // Before each test, clean the table to ensure a fresh state.
    // TRUNCATE is faster than DELETE for wiping a whole table.
    beforeEach(async () => {
        await testPool.query('TRUNCATE TABLE test_plans RESTART IDENTITY CASCADE');
    });

    // After all tests are done, close the database connection testPool.
    afterAll(async () => {
        await testPool.end();
        await globalPool.end();
    });

    describe('save', () => {
        it('should correctly save a new TestPlan to the database', async () => {
            // Arrange
            const testPlan: TestPlan = {
                id: uuidv4(),
                rootComponentId: 'comp-root-1',
                status: 'PENDING',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            // Act
            const savedPlan = await repository.save(testPlan);

            // Assert
            expect(savedPlan.id).toBe(testPlan.id);
            expect(savedPlan.status).toBe('PENDING');

            // Verify directly against the database for ultimate truth
            const result = await testPool.query('SELECT * FROM test_plans WHERE id = $1', [testPlan.id]);
            expect(result.rowCount).toBe(1);
            expect(result.rows[0].root_component_id).toBe('comp-root-1');
        });
    });

    describe('findById', () => {
        it('should return a TestPlan if one exists with the given id', async () => {
            // Arrange: First, insert a record to find
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
            expect(foundPlan?.id).toBe(testPlan.id);
            expect(foundPlan?.status).toBe('AWAITING_SELECTION');
        });

        it('should return null if no TestPlan exists with the given id', async () => {
            // Arrange: Database is empty
            const nonExistentId = uuidv4();

            // Act
            const foundPlan = await repository.findById(nonExistentId);

            // Assert
            expect(foundPlan).toBeNull();
        });
    });

    describe('update', () => {
        it('should update the status and updatedAt fields of an existing TestPlan', async () => {
            // Arrange: Create an initial record
            const initialPlan: TestPlan = {
                id: uuidv4(),
                rootComponentId: 'comp-root-3',
                status: 'PENDING',
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            await repository.save(initialPlan);

            // Act: Update the retrieved object
            const planToUpdate = (await repository.findById(initialPlan.id))!;
            planToUpdate.status = 'COMPLETED';
            planToUpdate.updatedAt = new Date(); // Ensure updatedAt is different

            const updatedPlan = await repository.update(planToUpdate);

            // Assert
            expect(updatedPlan.id).toBe(initialPlan.id);
            expect(updatedPlan.status).toBe('COMPLETED');
            expect(updatedPlan.updatedAt.getTime()).toBeGreaterThan(initialPlan.updatedAt.getTime());

            // Verify directly against the database
            const result = await testPool.query('SELECT status FROM test_plans WHERE id = $1', [initialPlan.id]);
            expect(result.rows[0].status).toBe('COMPLETED');
        });
    });
});