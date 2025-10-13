// src/infrastructure/repositories/test_execution_result_repository.integration.test.ts

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { TestExecutionResultRepository } from './test_execution_result_repository';
import { TestPlan } from '../../domain/test_plan';
import { PlanComponent } from '../../domain/plan_component';
import { Mapping } from '../../domain/mapping';

describe('TestExecutionResultRepository Integration Tests', () => {
    let repository: TestExecutionResultRepository;
    const testPool = new Pool({
        user: process.env.DB_USER, host: process.env.DB_HOST, database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD, port: parseInt(process.env.DB_PORT || '5433', 10),
    });

    let parentTestPlan: TestPlan;
    let parentPlanComponent: PlanComponent;
    let parentMapping: Mapping;

    beforeAll(async () => {
        repository = new TestExecutionResultRepository(testPool);
        try { await testPool.query('SELECT NOW()'); } catch (error) {
            console.error('Test database connection failed:', error);
            throw error;
        }
    });

    beforeEach(async () => {
        await testPool.query('TRUNCATE TABLE test_plans, plan_components, mappings, test_execution_results RESTART IDENTITY CASCADE');

        parentTestPlan = {
            id: uuidv4(),
            status: 'EXECUTING',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await testPool.query(
            'INSERT INTO test_plans (id, status, created_at, updated_at) VALUES ($1, $2, $3, $4)',
            [parentTestPlan.id, parentTestPlan.status, parentTestPlan.createdAt, parentTestPlan.updatedAt]
        );

        parentPlanComponent = {
            id: uuidv4(),
            testPlanId: parentTestPlan.id,
            componentId: 'comp-for-results',
            componentName: 'Results Parent Component',
        };
        await testPool.query(
            'INSERT INTO plan_components (id, test_plan_id, component_id, component_name) VALUES ($1, $2, $3, $4)',
            [parentPlanComponent.id, parentPlanComponent.testPlanId, parentPlanComponent.componentId, parentPlanComponent.componentName]
        );

        // Parent Mapping setup remains the same, but uses the new parentPlanComponent
        parentMapping = {
            id: uuidv4(),
            mainComponentId: parentPlanComponent.componentId,
            testComponentId: 'test-abc-123',
            testComponentName: 'My Awesome Test',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await testPool.query(
            'INSERT INTO mappings (id, main_component_id, test_component_id, test_component_name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
            [parentMapping.id, parentMapping.mainComponentId, parentMapping.testComponentId, parentMapping.testComponentName, parentMapping.createdAt, parentMapping.updatedAt]
        );
    });

    afterAll(async () => {
        await testPool.end();
    });

    describe('save', () => {
        it('should save a new test execution result to the database', async () => {
            // Arrange
            const newResultData = {
                testPlanId: parentTestPlan.id,
                planComponentId: parentPlanComponent.id,
                testComponentId: 'test-abc-123',
                status: 'SUCCESS' as 'SUCCESS' | 'FAILURE',
                log: 'Test passed successfully',
            };

            // Act
            const savedResult = await repository.save(newResultData);

            // Assert
            expect(savedResult.id).toBeDefined();
            expect(savedResult.status).toBe('SUCCESS');
            expect(savedResult.planComponentId).toBe(parentPlanComponent.id);

            const result = await testPool.query('SELECT * FROM test_execution_results WHERE id = $1', [savedResult.id]);
            expect(result.rowCount).toBe(1);
            expect(result.rows[0].plan_component_id).toBe(parentPlanComponent.id);
        });
    });

    describe('findByPlanComponentIds', () => {
        it('should return all enriched results for the given plan component IDs', async () => {
            // Arrange
            await repository.save({ testPlanId: parentTestPlan.id, planComponentId: parentPlanComponent.id, testComponentId: 'test-abc-123', status: 'SUCCESS' });
            await repository.save({ testPlanId: parentTestPlan.id, planComponentId: parentPlanComponent.id, testComponentId: 'test-456', status: 'FAILURE' });

            // Act
            const results = await repository.findByPlanComponentIds([parentPlanComponent.id]);

            // Assert
            expect(results).toHaveLength(2);
            expect(results[0].status).toBe('SUCCESS');
            expect(results[0].componentName).toBe(parentPlanComponent.componentName);
            expect(results[0].testComponentName).toBe(parentMapping.testComponentName);
            expect(results[1].status).toBe('FAILURE');
        });
    });

    describe('findByFilters', () => {
        let plan2: TestPlan, pc2: PlanComponent;

        beforeEach(async () => {
            plan2 = { id: uuidv4(), status: 'COMPLETED', createdAt: new Date(), updatedAt: new Date() };
            pc2 = { id: uuidv4(), testPlanId: plan2.id, componentId: 'comp-2', componentName: 'Second Component' };
            await testPool.query('INSERT INTO test_plans (id, status, created_at, updated_at) VALUES ($1, $2, $3, $4)', [plan2.id, plan2.status, plan2.createdAt, plan2.updatedAt]);
            await testPool.query('INSERT INTO plan_components (id, test_plan_id, component_id, component_name) VALUES ($1, $2, $3, $4)', [pc2.id, pc2.testPlanId, pc2.componentId, pc2.componentName]);
            
            await repository.save({ testPlanId: parentTestPlan.id, planComponentId: parentPlanComponent.id, testComponentId: 'test-abc-123', status: 'SUCCESS' });
            await repository.save({ testPlanId: parentTestPlan.id, planComponentId: parentPlanComponent.id, testComponentId: 'test-456', status: 'FAILURE' });
            await repository.save({ testPlanId: plan2.id, planComponentId: pc2.id, testComponentId: 'test-789', status: 'SUCCESS' });
        });

        it('should filter by planComponentId', async () => {
            const results = await repository.findByFilters({ planComponentId: parentPlanComponent.id });
            expect(results).toHaveLength(2);
            expect(results[0].planComponentId).toBe(parentPlanComponent.id);
        });

        // Other filter tests remain logically the same, but the setup data is now correct.
        it('should filter by testPlanId', async () => {
            const results = await repository.findByFilters({ testPlanId: plan2.id });
            expect(results).toHaveLength(1);
            expect(results[0].testPlanId).toBe(plan2.id);
        });

        it('should filter by a combination of testPlanId and status', async () => {
            const results = await repository.findByFilters({ testPlanId: parentTestPlan.id, status: 'FAILURE' });
            expect(results).toHaveLength(1);
            expect(results[0].testPlanId).toBe(parentTestPlan.id);
            expect(results[0].status).toBe('FAILURE');
        });
    });
});