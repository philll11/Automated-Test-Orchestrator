// src/infrastructure/repositories/test_execution_result_repository.integration.test.ts

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { TestExecutionResultRepository } from './test_execution_result_repository';
import { TestPlan } from '../../domain/test_plan';
import { DiscoveredComponent } from '../../domain/discovered_component';
import { Mapping } from '../../domain/mapping';

describe('TestExecutionResultRepository Integration Tests', () => {
    let repository: TestExecutionResultRepository;
    const testPool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5433', 10),
    });

    // We need parent records to satisfy foreign key constraints
    let parentTestPlan: TestPlan;
    let parentDiscoveredComponent: DiscoveredComponent;
    let parentMapping: Mapping;

    beforeAll(async () => {
        repository = new TestExecutionResultRepository(testPool);
        try {
            await testPool.query('SELECT NOW()');
        } catch (error) {
            console.error('Test database connection failed:', error);
            throw error;
        }
    });

    beforeEach(async () => {
        // Clean all related tables to ensure test isolation
        await testPool.query('TRUNCATE TABLE test_plans, discovered_components, mappings, test_execution_results RESTART IDENTITY CASCADE');

        // Create a parent TestPlan
        parentTestPlan = {
            id: uuidv4(),
            rootComponentId: 'root-for-results-test',
            status: 'EXECUTING',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await testPool.query(
            'INSERT INTO test_plans (id, root_component_id, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
            [parentTestPlan.id, parentTestPlan.rootComponentId, parentTestPlan.status, parentTestPlan.createdAt, parentTestPlan.updatedAt]
        );

        // Create a parent DiscoveredComponent
        parentDiscoveredComponent = {
            id: uuidv4(),
            testPlanId: parentTestPlan.id,
            componentId: 'comp-for-results',
            componentName: 'Results Parent Component',
        };
        await testPool.query(
            'INSERT INTO discovered_components (id, test_plan_id, component_id, component_name) VALUES ($1, $2, $3, $4)',
            [parentDiscoveredComponent.id, parentDiscoveredComponent.testPlanId, parentDiscoveredComponent.componentId, parentDiscoveredComponent.componentName]
        );

        // Create a parent Mapping
        parentMapping = {
            id: uuidv4(),
            mainComponentId: parentDiscoveredComponent.componentId,
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
                discoveredComponentId: parentDiscoveredComponent.id,
                testComponentId: 'test-abc-123',
                status: 'SUCCESS' as 'SUCCESS' | 'FAILURE',
                log: 'Test passed successfully',
            };

            // Act
            const savedResult = await repository.save(newResultData);

            // Assert
            expect(savedResult.id).toBeDefined();
            expect(savedResult.status).toBe('SUCCESS');
            expect(savedResult.testPlanId).toBe(parentTestPlan.id);
            expect(savedResult.executedAt).toBeInstanceOf(Date);

            // Verify directly in the database
            const result = await testPool.query('SELECT * FROM test_execution_results WHERE id = $1', [savedResult.id]);
            expect(result.rowCount).toBe(1);
            expect(result.rows[0].test_plan_id).toBe(parentTestPlan.id);
            expect(result.rows[0].log).toBe('Test passed successfully');
        });
    });

    describe('findByDiscoveredComponentIds', () => {
        it('should return all enriched results for the given discovered component IDs', async () => {
            // Arrange: Save some results for our component
            await repository.save({ testPlanId: parentTestPlan.id, discoveredComponentId: parentDiscoveredComponent.id, testComponentId: 'test-abc-123', status: 'SUCCESS' });
            await repository.save({ testPlanId: parentTestPlan.id, discoveredComponentId: parentDiscoveredComponent.id, testComponentId: 'test-456', status: 'FAILURE' });

            // Act
            const results = await repository.findByDiscoveredComponentIds([parentDiscoveredComponent.id]);

            // Assert
            expect(results).toHaveLength(2);
            // [FIX] Assert enriched data is present
            expect(results[0].status).toBe('SUCCESS');
            expect(results[0].rootComponentId).toBe(parentTestPlan.rootComponentId);
            expect(results[0].componentName).toBe(parentDiscoveredComponent.componentName);
            expect(results[0].testComponentName).toBe(parentMapping.testComponentName); // From the mapping
            expect(results[1].status).toBe('FAILURE');
            expect(results[1].testComponentName).toBeNull(); // No mapping for this test
        });
    });

    // New test suite for the findByFilters method
    describe('findByFilters', () => {
        let plan2: TestPlan, dc2: DiscoveredComponent;

        beforeEach(async () => {
            // Create a second set of data to test filtering
            plan2 = { id: uuidv4(), rootComponentId: 'root-2', status: 'COMPLETED', createdAt: new Date(), updatedAt: new Date() };
            dc2 = { id: uuidv4(), testPlanId: plan2.id, componentId: 'comp-2', componentName: 'Second Component' };
            await testPool.query('INSERT INTO test_plans (id, root_component_id, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)', [plan2.id, plan2.rootComponentId, plan2.status, plan2.createdAt, plan2.updatedAt]);
            await testPool.query('INSERT INTO discovered_components (id, test_plan_id, component_id, component_name) VALUES ($1, $2, $3, $4)', [dc2.id, dc2.testPlanId, dc2.componentId, dc2.componentName]);
            
            // Seed results
            await repository.save({ testPlanId: parentTestPlan.id, discoveredComponentId: parentDiscoveredComponent.id, testComponentId: 'test-abc-123', status: 'SUCCESS' });
            await repository.save({ testPlanId: parentTestPlan.id, discoveredComponentId: parentDiscoveredComponent.id, testComponentId: 'test-456', status: 'FAILURE' });
            await repository.save({ testPlanId: plan2.id, discoveredComponentId: dc2.id, testComponentId: 'test-789', status: 'SUCCESS' });
        });

        it('should filter by testPlanId', async () => {
            const results = await repository.findByFilters({ testPlanId: plan2.id });
            expect(results).toHaveLength(1);
            expect(results[0].testPlanId).toBe(plan2.id);
            expect(results[0].componentName).toBe('Second Component');
        });

        it('should filter by discoveredComponentId', async () => {
            const results = await repository.findByFilters({ discoveredComponentId: parentDiscoveredComponent.id });
            expect(results).toHaveLength(2);
            expect(results[0].discoveredComponentId).toBe(parentDiscoveredComponent.id);
        });

        it('should filter by testComponentId', async () => {
            const results = await repository.findByFilters({ testComponentId: 'test-456' });
            expect(results).toHaveLength(1);
            expect(results[0].testComponentId).toBe('test-456');
        });

        it('should filter by status', async () => {
            const results = await repository.findByFilters({ status: 'SUCCESS' });
            expect(results).toHaveLength(2);
            expect(results.every(r => r.status === 'SUCCESS')).toBe(true);
        });

        it('should filter by a combination of testPlanId and status', async () => {
            const results = await repository.findByFilters({ testPlanId: parentTestPlan.id, status: 'FAILURE' });
            expect(results).toHaveLength(1);
            expect(results[0].testPlanId).toBe(parentTestPlan.id);
            expect(results[0].status).toBe('FAILURE');
        });

        it('should return an empty array if no filters are provided', async () => {
            const results = await repository.findByFilters({});
            expect(results).toHaveLength(0);
        });

        it('should return an empty array if no results match', async () => {
            const results = await repository.findByFilters({ testPlanId: uuidv4() });
            expect(results).toHaveLength(0);
        });
    });
});