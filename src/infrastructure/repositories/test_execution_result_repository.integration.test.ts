// src/infrastructure/repositories/test_execution_result_repository.integration.test.ts

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { TestExecutionResultRepository } from './test_execution_result_repository';
import { TestPlan } from '../../domain/test_plan';
import { DiscoveredComponent } from '../../domain/discovered_component';

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
        await testPool.query('TRUNCATE TABLE test_plans RESTART IDENTITY CASCADE');
        await testPool.query('TRUNCATE TABLE discovered_components RESTART IDENTITY CASCADE');
        await testPool.query('TRUNCATE TABLE test_execution_results RESTART IDENTITY CASCADE');

        // 1. Create a parent TestPlan
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

        // 2. Create a parent DiscoveredComponent
        parentDiscoveredComponent = {
            id: uuidv4(),
            testPlanId: parentTestPlan.id,
            componentId: 'comp-for-results',
            componentName: 'Results Parent',
        };
        await testPool.query(
            'INSERT INTO discovered_components (id, test_plan_id, component_id, component_name) VALUES ($1, $2, $3, $4)',
            [parentDiscoveredComponent.id, parentDiscoveredComponent.testPlanId, parentDiscoveredComponent.componentId, parentDiscoveredComponent.componentName]
        );
    });

    afterAll(async () => {
        await testPool.end();
    });

    describe('save', () => {
        it('should save a new test execution result to the database', async () => {
            // Arrange
            const newResultData = {
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
            expect(savedResult.executedAt).toBeInstanceOf(Date);

            // Verify directly in the database
            const result = await testPool.query('SELECT * FROM test_execution_results WHERE id = $1', [savedResult.id]);
            expect(result.rowCount).toBe(1);
            expect(result.rows[0].log).toBe('Test passed successfully');
        });
    });

    describe('findByDiscoveredComponentIds', () => {
        it('should return all results for the given discovered component IDs', async () => {
            // Arrange: Save some results for our component
            await repository.save({ discoveredComponentId: parentDiscoveredComponent.id, testComponentId: 'test-1', status: 'SUCCESS' });
            await repository.save({ discoveredComponentId: parentDiscoveredComponent.id, testComponentId: 'test-2', status: 'FAILURE' });

            // Act
            const results = await repository.findByDiscoveredComponentIds([parentDiscoveredComponent.id]);

            // Assert
            expect(results).toHaveLength(2);
            expect(results[0].status).toBe('SUCCESS');
            expect(results[1].status).toBe('FAILURE');
        });

        it('should return an empty array if no component IDs are provided', async () => {
            const results = await repository.findByDiscoveredComponentIds([]);
            expect(results).toHaveLength(0);
        });

        it('should return an empty array if the components have no execution results', async () => {
            const results = await repository.findByDiscoveredComponentIds([parentDiscoveredComponent.id]);
            expect(results).toHaveLength(0);
        });
    });
});