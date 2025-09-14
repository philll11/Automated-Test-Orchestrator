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
                const { id, testPlanId, componentId, componentName, componentType, mappedTestId, executionStatus, executionLog } = component;
                const query = `
                    INSERT INTO discovered_components (id, test_plan_id, component_id, component_name, component_type, mapped_test_id, execution_status, execution_log)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (id) DO NOTHING;
                `;
                const values = [id, testPlanId, componentId, componentName, componentType, mappedTestId, executionStatus, executionLog];
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

    async update(component: DiscoveredComponent): Promise<DiscoveredComponent> {
        const { id, executionStatus, executionLog, mappedTestId } = component;
        const query = `
            UPDATE discovered_components
            SET execution_status = $1, execution_log = $2, mapped_test_id = $3
            WHERE id = $4
            RETURNING *;
        `;
        const values = [executionStatus, executionLog, mappedTestId, id];
        const result = await this.pool.query(query, values);
        return rowToDiscoveredComponent(result.rows[0]);
    }
}