// src/infrastructure/repositories/discovered_component_repository.ts

import { Pool } from 'pg';
import { injectable, inject } from 'inversify';
import { IDiscoveredComponentRepository } from "../../ports/i_discovered_component_repository.js";
import { DiscoveredComponent } from "../../domain/discovered_component.js";
import { rowToDiscoveredComponent } from "../mappers.js";
import { TYPES } from '../../inversify.types.js';

@injectable()
export class DiscoveredComponentRepository implements IDiscoveredComponentRepository {
    constructor(@inject(TYPES.PostgresPool) private pool: Pool) {}

    async saveAll(components: DiscoveredComponent[]): Promise<void> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            for (const component of components) {
                const { id, testPlanId, componentId, componentName, componentType } = component;
                const query = `
                    INSERT INTO discovered_components (id, test_plan_id, component_id, component_name, component_type)
                    VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING;`;
                const values = [id, testPlanId, componentId, componentName, componentType];
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

    async findByTestPlanId(testPlanId: string): Promise<DiscoveredComponent[]> {
        const query = 'SELECT * FROM discovered_components WHERE test_plan_id = $1;';
        const result = await this.pool.query(query, [testPlanId]);
        return result.rows.map(rowToDiscoveredComponent);
    }
    
    // The update method is no longer needed as there's nothing to update on this record
    // after it has been discovered. We can remove it from the interface and class in a future step
    // but will leave it for now to avoid breaking the port contract.
    async update(component: DiscoveredComponent): Promise<DiscoveredComponent> {
        // This method no longer has a purpose but is kept to satisfy the interface.
        console.warn('[DiscoveredComponentRepository] The update method was called but has no effect.');
        return Promise.resolve(component);
    }
}