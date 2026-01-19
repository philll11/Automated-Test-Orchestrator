// src/infrastructure/repositories/test_plan_repository.integration.test.ts

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { TestPlanRepository } from './test_plan_repository.js';
import { TestPlan, TestPlanStatus, TestPlanType } from '../../domain/test_plan.js';

describe('TestPlanRepository Integration Tests', () => {
    let repository: TestPlanRepository;
    const testPool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432', 10),
    });

    // Keep track of a seeded record to use in tests
    let seededPlan1: TestPlan;

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
        await testPool.query('TRUNCATE TABLE test_plans RESTART IDENTITY CASCADE');

        // Seed data with a couple of test plans
        seededPlan1 = {
            id: uuidv4(),
            name: 'Seeded Plan 1',
            status: TestPlanStatus.COMPLETED,
            planType: TestPlanType.COMPONENT,
            createdAt: new Date(Date.now() - 10000), // Older
            updatedAt: new Date(),
        };
        const seededPlan2: TestPlan = {
            id: uuidv4(),
            name: 'Seeded Plan 2',
            status: TestPlanStatus.DISCOVERING,
            planType: TestPlanType.COMPONENT,
            createdAt: new Date(), // Newer
            updatedAt: new Date(),
        };
        
        // Insert in a specific order to test findAll ordering
        for (const plan of [seededPlan1, seededPlan2]) {
            await testPool.query(
                'INSERT INTO test_plans (id, name, plan_type, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
                [plan.id, plan.name, plan.planType, plan.status, plan.createdAt, plan.updatedAt]
            );
        }
    });

    afterAll(async () => {
        await testPool.end();
    });

    describe('save', () => {
        it('should correctly insert a new test plan into the database', async () => {
            const newPlan: TestPlan = {
                id: uuidv4(),
                name: 'New Plan',
                planType: TestPlanType.TEST,
                status: TestPlanStatus.AWAITING_SELECTION,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const savedPlan = await repository.save(newPlan);

            expect(savedPlan.name).toBe('New Plan');
            expect(savedPlan.planType).toBe(TestPlanType.TEST);
            
            const result = await testPool.query('SELECT * FROM test_plans WHERE id = $1', [newPlan.id]);
            expect(result.rowCount).toBe(1);
            expect(result.rows[0].name).toBe('New Plan');
            expect(result.rows[0].plan_type).toBe('TEST');
        });
    });

    describe('findById', () => {
        it('should return a single test plan by its unique UUID', async () => {
            const found = await repository.findById(seededPlan1.id);
            expect(found).not.toBeNull();
            expect(found?.name).toBe('Seeded Plan 1');
            expect(found?.status).toBe('COMPLETED');
        });

        it('should return null if no test plan is found', async () => {
            const found = await repository.findById(uuidv4());
            expect(found).toBeNull();
        });
    });

    describe('update', () => {
        it('should update the status and failure_reason of a specific test plan', async () => {
            const planToUpdate = { ...seededPlan1, status: TestPlanStatus.EXECUTION_FAILED, failureReason: 'A test failed' };
            
            const updatedPlan = await repository.update(planToUpdate);

            expect(updatedPlan.status).toBe(TestPlanStatus.EXECUTION_FAILED);
            expect(updatedPlan.failureReason).toBe('A test failed');

            const result = await testPool.query('SELECT status, failure_reason FROM test_plans WHERE id = $1', [seededPlan1.id]);
            expect(result.rows[0].status).toBe('EXECUTION_FAILED');
            expect(result.rows[0].failure_reason).toBe('A test failed');
        });
    });

    describe('findAll', () => {
        it('should return all test plans in descending order of creation date', async () => {
            const allPlans = await repository.findAll();
            expect(allPlans).toHaveLength(2);
            // Verify the 'ORDER BY created_at DESC'
            expect(allPlans[0].name).toBe('Seeded Plan 2'); // The newer one should be first
            expect(allPlans[1].name).toBe('Seeded Plan 1');
        });
    });

    describe('deleteById', () => {
        it('should delete a specific test plan record by its unique id', async () => {
            await repository.deleteById(seededPlan1.id);
            
            const result = await testPool.query('SELECT * FROM test_plans WHERE id = $1', [seededPlan1.id]);
            expect(result.rowCount).toBe(0);
        });
    });
});