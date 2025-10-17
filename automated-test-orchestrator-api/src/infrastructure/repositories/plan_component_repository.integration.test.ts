// src/infrastructure/repositories/plan_component_repository.integration.test.ts

import { Pool } from 'pg';
import { PlanComponentRepository } from './plan_component_repository';
import { PlanComponent } from '../../domain/plan_component';
import { v4 as uuidv4 } from 'uuid';
import { TestPlan } from '../../domain/test_plan';

describe('PlanComponentRepository Integration Tests', () => {
    let repository: PlanComponentRepository;
    const testPool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT || '5432', 10),
    });

    let parentTestPlan: TestPlan;

    beforeAll(async () => {
        repository = new PlanComponentRepository(testPool);
        try { await testPool.query('SELECT NOW()'); } catch (error) {
            console.error('Test database connection failed:', error);
            throw error;
        }
    });

    beforeEach(async () => {
        await testPool.query('TRUNCATE TABLE test_plans RESTART IDENTITY CASCADE');

        parentTestPlan = {
            id: uuidv4(),
            name: 'Parent Test Plan', // Added the required name
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
        it('should save all provided components with their correct properties', async () => {
            const components: PlanComponent[] = [
                { id: uuidv4(), testPlanId: parentTestPlan.id, componentId: 'pc-1', componentName: 'Comp 1', componentType: 'Process' },
                { id: uuidv4(), testPlanId: parentTestPlan.id, componentId: 'pc-2', componentName: 'Comp 2', componentType: 'API' },
            ];

            await repository.saveAll(components);

            const result = await testPool.query('SELECT * FROM plan_components WHERE test_plan_id = $1 ORDER BY component_name ASC', [parentTestPlan.id]);
            expect(result.rowCount).toBe(2);
            expect(result.rows[0].component_name).toBe('Comp 1');
        });
    });

    describe('findByTestPlanId', () => {
        it('should return only the components associated with the given testPlanId', async () => {
            await repository.saveAll([
                { id: uuidv4(), testPlanId: parentTestPlan.id, componentId: 'pc-A1', componentName: 'A1' },
            ]);
            const otherPlanId = uuidv4();
            const now = new Date();
            // UPDATED: The second plan also needs a name
            await testPool.query('INSERT INTO test_plans (id, name, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)', [otherPlanId, 'Other Plan', 'DISCOVERING', now, now]);
            await repository.saveAll([{ id: uuidv4(), testPlanId: otherPlanId, componentId: 'pc-B1', componentName: 'B1' }]);

            const foundComponents = await repository.findByTestPlanId(parentTestPlan.id);

            expect(foundComponents).toHaveLength(1);
            expect(foundComponents[0].componentId).toBe('pc-A1');
        });
    });

    describe('update', () => {
        it('should do nothing and return the component object that was passed in', async () => {
            const component: PlanComponent = { id: uuidv4(), testPlanId: parentTestPlan.id, componentId: 'pc-to-update', componentName: 'Update Me' };
            await repository.saveAll([component]);
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });

            const updatedComponent = await repository.update(component);

            expect(updatedComponent).toBe(component);
            expect(consoleWarnSpy).toHaveBeenCalledWith('[PlanComponentRepository] The update method was called but has no effect.');
            consoleWarnSpy.mockRestore();
        });
    });
});