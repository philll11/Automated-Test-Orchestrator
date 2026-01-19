// src/infrastructure/repositories/test_execution_result_repository.integration.test.ts

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { TestExecutionResultRepository } from './test_execution_result_repository.js';
import { TestPlan, TestPlanStatus, TestPlanType } from '../../domain/test_plan.js';
import { PlanComponent } from '../../domain/plan_component.js';
import { Mapping } from '../../domain/mapping.js';

describe('TestExecutionResultRepository Integration Tests', () => {
    let repository: TestExecutionResultRepository;
    const testPool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432', 10),
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
        // Truncating test_plans will cascade to all other tables
        await testPool.query('TRUNCATE TABLE test_plans RESTART IDENTITY CASCADE');
        await testPool.query('TRUNCATE TABLE mappings RESTART IDENTITY CASCADE');

        // UPDATED: parentTestPlan now requires a 'name'
        parentTestPlan = {
            id: uuidv4(),
            name: 'Parent Execution Plan',
            planType: TestPlanType.COMPONENT,
            status: TestPlanStatus.EXECUTING,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await testPool.query(
            'INSERT INTO test_plans (id, name, plan_type, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
            [parentTestPlan.id, parentTestPlan.name, parentTestPlan.planType, parentTestPlan.status, parentTestPlan.createdAt, parentTestPlan.updatedAt]
        );

        parentPlanComponent = {
            id: uuidv4(),
            testPlanId: parentTestPlan.id,
            sourceType: 'Boomi',
            componentId: 'comp-for-results',
            componentName: 'Results Parent Component',
        };
        await testPool.query(
            'INSERT INTO plan_components (id, test_plan_id, source_type, component_id, component_name) VALUES ($1, $2, $3, $4, $5)',
            [parentPlanComponent.id, parentPlanComponent.testPlanId, parentPlanComponent.sourceType, parentPlanComponent.componentId, parentPlanComponent.componentName]
        );

        // UPDATED: parentMapping now includes 'mainComponentName'
        parentMapping = {
            id: uuidv4(),
            mainComponentId: parentPlanComponent.componentId,
            mainComponentName: 'Results Parent Component',
            testComponentId: 'test-abc-123',
            testComponentName: 'My Awesome Test',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await testPool.query(
            'INSERT INTO mappings (id, main_component_id, main_component_name, test_component_id, test_component_name, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [parentMapping.id, parentMapping.mainComponentId, parentMapping.mainComponentName, parentMapping.testComponentId, parentMapping.testComponentName, parentMapping.createdAt, parentMapping.updatedAt]
        );
    });

    afterAll(async () => {
        await testPool.end();
    });

    describe('save', () => {
        it('should save a new test execution result with a message', async () => {
            // Arrange
            // UPDATED: The field is now 'message', not 'log'
            const newResultData = {
                testPlanId: parentTestPlan.id,
                planComponentId: parentPlanComponent.id,
                testComponentId: 'test-abc-123',
                status: 'SUCCESS' as 'SUCCESS' | 'FAILURE',
                message: 'Test passed successfully',
            };

            // Act
            const savedResult = await repository.save(newResultData);

            // Assert
            expect(savedResult.message).toBe('Test passed successfully');
            const result = await testPool.query('SELECT * FROM test_execution_results WHERE id = $1', [savedResult.id]);
            expect(result.rowCount).toBe(1);
            expect(result.rows[0].message).toBe('Test passed successfully');
        });
    });

    describe('findByPlanComponentIds', () => {
        it('should return all enriched results, including the testPlanName', async () => {
            await repository.save({ testPlanId: parentTestPlan.id, planComponentId: parentPlanComponent.id, testComponentId: 'test-abc-123', status: 'SUCCESS' });
            
            const results = await repository.findByPlanComponentIds([parentPlanComponent.id]);

            expect(results).toHaveLength(1);
            // UPDATED: Verify the new joined field
            expect(results[0].testPlanName).toBe(parentTestPlan.name);
            expect(results[0].componentName).toBe(parentPlanComponent.componentName);
            expect(results[0].testComponentName).toBe(parentMapping.testComponentName);
        });
    });

    describe('findByFilters', () => {
        let plan2: TestPlan, pc2: PlanComponent;

        beforeEach(async () => {
            // UPDATED: Seeding for the second plan now requires a 'name'
            plan2 = { id: uuidv4(), name: 'Plan Two', planType: TestPlanType.COMPONENT, status: TestPlanStatus.COMPLETED, createdAt: new Date(), updatedAt: new Date() };
            pc2 = { id: uuidv4(), testPlanId: plan2.id, sourceType: 'Boomi', componentId: 'comp-2', componentName: 'Second Component' };
            await testPool.query('INSERT INTO test_plans (id, name, plan_type, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)', [plan2.id, plan2.name, plan2.planType, plan2.status, plan2.createdAt, plan2.updatedAt]);
            await testPool.query('INSERT INTO plan_components (id, test_plan_id, source_type, component_id, component_name) VALUES ($1, $2, $3, $4, $5)', [pc2.id, pc2.testPlanId, pc2.sourceType, pc2.componentId, pc2.componentName]);
            
            await repository.save({ testPlanId: parentTestPlan.id, planComponentId: parentPlanComponent.id, testComponentId: 'test-abc-123', status: 'SUCCESS' });
            await repository.save({ testPlanId: parentTestPlan.id, planComponentId: parentPlanComponent.id, testComponentId: 'test-456', status: 'FAILURE' });
            await repository.save({ testPlanId: plan2.id, planComponentId: pc2.id, testComponentId: 'test-789', status: 'SUCCESS' });
        });

        // UPDATED: This test now validates our bug fix
        it('should filter by componentId (the business key)', async () => {
            const results = await repository.findByFilters({ componentId: parentPlanComponent.componentId }); // 'comp-for-results'
            expect(results).toHaveLength(2);
            expect(results[0].componentName).toBe('Results Parent Component');
        });

        it('should return all enriched fields when filtering', async () => {
            const results = await repository.findByFilters({ testPlanId: plan2.id });
            expect(results).toHaveLength(1);
            expect(results[0].testPlanId).toBe(plan2.id);
            expect(results[0].testPlanName).toBe('Plan Two');
        });
    });
});