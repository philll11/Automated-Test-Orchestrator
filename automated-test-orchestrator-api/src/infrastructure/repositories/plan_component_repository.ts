// src/infrastructure/repositories/plan_component_repository.ts

import type { Pool } from 'pg';
import { injectable, inject } from 'inversify';
import { IPlanComponentRepository } from "../../ports/i_plan_component_repository.js";
import { PlanComponent } from "../../domain/plan_component.js";
import { rowToPlanComponent } from "../mappers.js"; 
import { TYPES } from '../../inversify.types.js';

@injectable()
export class PlanComponentRepository implements IPlanComponentRepository {
    constructor(@inject(TYPES.PostgresPool) private pool: Pool) {}

    async saveAll(components: PlanComponent[]): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            for (const component of components) {
                const { id, testPlanId, sourceType, componentId, componentName, componentType } = component;
                const query = `
                    INSERT INTO plan_components (id, test_plan_id, source_type, component_id, component_name, component_type)
                    VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING;`;
                const values = [id, testPlanId, sourceType, componentId, componentName, componentType];
                await client.query(query, values);
            }
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async findByTestPlanId(testPlanId: string): Promise<PlanComponent[]> {
        const query = 'SELECT * FROM plan_components WHERE test_plan_id = $1;';
        const result = await this.pool.query(query, [testPlanId]);
        return result.rows.map(rowToPlanComponent); 
    }
    
        // The update method is no longer needed as there's nothing to update on this record
    // after it has been discovered. We can remove it from the interface and class in a future step
    // but will leave it for now to avoid breaking the port contract.
    async update(component: PlanComponent): Promise<PlanComponent> {
        console.warn('[PlanComponentRepository] The update method was called but has no effect.');
        return Promise.resolve(component);
    }
}