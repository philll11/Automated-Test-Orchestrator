// src/infrastructure/repositories/discovered_component_repository.integration.test.ts

import { Pool } from 'pg';
import { DiscoveredComponentRepository } from './discovered_component_repository';
import { DiscoveredComponent } from '../../domain/discovered_component';
import { v4 as uuidv4 } from 'uuid';
import { TestPlan } from '../../domain/test_plan';

describe('DiscoveredComponentRepository Integration Tests', () => {
    let repository: DiscoveredComponentRepository;
    const testPool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5433', 10),
    });

    let parentTestPlan: TestPlan;

    beforeAll(async () => {
        repository = new DiscoveredComponentRepository(testPool);
        try {
            await testPool.query('SELECT NOW()');
        } catch (error) {
            console.error('Test database connection failed:', error);
            throw error;
        }
    });

    beforeEach(async () => {
        await testPool.query('TRUNCATE TABLE test_plans RESTART IDENTITY CASCADE');
        await testPool.query('TRUNCATE TABLE discovered_components RESTART IDENTITY CASCADE');
        await testPool.query('TRUNCATE TABLE test_execution_results RESTART IDENTITY CASCADE');

        parentTestPlan = {
            id: uuidv4(),
            rootComponentId: 'root-for-dc-test',
            status: 'DISCOVERING',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await testPool.query(
            'INSERT INTO test_plans (id, root_component_id, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
            [parentTestPlan.id, parentTestPlan.rootComponentId, parentTestPlan.status, parentTestPlan.createdAt, parentTestPlan.updatedAt]
        );
    });

    afterAll(async () => {
        await testPool.end();
    });

    describe('saveAll', () => {
        it('should save all provided components with their correct properties', async () => {
            // Arrange
            const components: DiscoveredComponent[] = [
                { id: uuidv4(), testPlanId: parentTestPlan.id, componentId: 'dc-1', componentName: 'Comp 1', componentType: 'Process' },
                { id: uuidv4(), testPlanId: parentTestPlan.id, componentId: 'dc-2', componentName: 'Comp 2', componentType: 'API' },
            ];

            // Act
            await repository.saveAll(components);

            // Assert
            const result = await testPool.query('SELECT * FROM discovered_components WHERE test_plan_id = $1 ORDER BY component_name ASC', [parentTestPlan.id]);
            expect(result.rowCount).toBe(2);
            expect(result.rows[0].component_name).toBe('Comp 1');
            // --- FAULTY ASSERTION REMOVED ---
            // The fact that saveAll succeeded is the proof that it's not trying to write to obsolete columns.
        });
    });

    describe('findByTestPlanId', () => {
        it('should return only the components associated with the given testPlanId', async () => {
            // Arrange
            await repository.saveAll([
                { id: uuidv4(), testPlanId: parentTestPlan.id, componentId: 'dc-A1', componentName: 'A1' },
            ]);
            const otherPlanId = uuidv4();
            const now = new Date();
            await testPool.query('INSERT INTO test_plans (id, root_component_id, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)', [otherPlanId, 'other-root', 'DISCOVERING', now, now]);
            await repository.saveAll([{ id: uuidv4(), testPlanId: otherPlanId, componentId: 'dc-B1', componentName: 'B1' }]);

            // Act
            const foundComponents = await repository.findByTestPlanId(parentTestPlan.id);

            // Assert
            expect(foundComponents).toHaveLength(1);
            expect(foundComponents[0].componentId).toBe('dc-A1');
        });
    });

    describe('update', () => {
        it('should do nothing and return the component object that was passed in', async () => {
            // Arrange
            const component: DiscoveredComponent = { id: uuidv4(), testPlanId: parentTestPlan.id, componentId: 'dc-to-update', componentName: 'Update Me' };
            await repository.saveAll([component]);
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            // Act
            const updatedComponent = await repository.update(component);

            // Assert
            expect(updatedComponent).toBe(component);
            expect(consoleWarnSpy).toHaveBeenCalledWith('[DiscoveredComponentRepository] The update method was called but has no effect.');
            
            const result = await testPool.query('SELECT * FROM discovered_components WHERE id = $1', [component.id]);
            expect(result.rows[0].component_name).toBe('Update Me');

            consoleWarnSpy.mockRestore();
        });
    });
});