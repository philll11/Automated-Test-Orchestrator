// src/infrastructure/repositories/component_test_mapping_repository.ts

import type { Pool } from 'pg';
import { injectable, inject } from 'inversify';
import { IMappingRepository, UpdateMappingData } from "../../ports/i_mapping_repository.js";
import { Mapping } from "../../domain/mapping.js";
import { rowToMapping } from "../mappers.js";
import { TYPES } from '../../inversify.types.js';

@injectable()
export class MappingRepository implements IMappingRepository {
    constructor(@inject(TYPES.PostgresPool) private pool: Pool) {}

    async create(mapping: Omit<Mapping, 'createdAt' | 'updatedAt'>): Promise<Mapping> {
        const { id, mainComponentId, testComponentId, testComponentName, isDeployed, isPackaged } = mapping;
        const now = new Date();
        const query = `
            INSERT INTO mappings (id, main_component_id, test_component_id, test_component_name, is_deployed, is_packaged, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;`;
        const values = [id, mainComponentId, testComponentId, testComponentName, isDeployed, isPackaged, now, now];
        const result = await this.pool.query(query, values);
        return rowToMapping(result.rows[0]);
    }

    async findById(id: string): Promise<Mapping | null> {
        const query = 'SELECT * FROM mappings WHERE id = $1;';
        const result = await this.pool.query(query, [id]);
        return result.rows.length > 0 ? rowToMapping(result.rows[0]) : null;
    }

    async findByMainComponentId(mainComponentId: string): Promise<Mapping[]> {
        const query = 'SELECT * FROM mappings WHERE main_component_id = $1 ORDER BY created_at ASC;';
        const result = await this.pool.query(query, [mainComponentId]);
        return result.rows.map(rowToMapping);
    }
    
    async findAll(): Promise<Mapping[]> {
        const query = 'SELECT * FROM mappings ORDER BY main_component_id ASC, created_at ASC;';
        const result = await this.pool.query(query);
        return result.rows.map(rowToMapping);
    }

    async findAllTestsForMainComponents(mainComponentIds: string[]): Promise<Map<string, string[]>> {
        const map = new Map<string, string[]>();
        if (mainComponentIds.length === 0) return map;
        const query = 'SELECT main_component_id, test_component_id FROM mappings WHERE main_component_id = ANY($1::varchar[]);';
        const result = await this.pool.query(query, [mainComponentIds]);
        for (const row of result.rows) {
            if (!map.has(row.main_component_id)) map.set(row.main_component_id, []);
            map.get(row.main_component_id)!.push(row.test_component_id);
        }
        return map;
    }
    
    async update(id: string, updates: UpdateMappingData): Promise<Mapping | null> {
        const existingMapping = await this.findById(id);
        if (!existingMapping) return null;

        const newValues = { ...existingMapping, ...updates, updatedAt: new Date() };
        
        const query = `
            UPDATE mappings
            SET test_component_id = $1, test_component_name = $2, is_deployed = $3, is_packaged = $4, updated_at = $5
            WHERE id = $6
            RETURNING *;
        `;
        const values = [newValues.testComponentId, newValues.testComponentName, newValues.isDeployed, newValues.isPackaged, newValues.updatedAt, id];

        const result = await this.pool.query(query, values);
        return rowToMapping(result.rows[0]);
    }

    async delete(id: string): Promise<boolean> {
        const query = 'DELETE FROM mappings WHERE id = $1;';
        const result = await this.pool.query(query, [id]);
        return (result.rowCount ?? 0) > 0;
    }
}