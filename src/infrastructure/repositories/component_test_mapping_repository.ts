// src/infrastructure/repositories/component_test_mapping_repository.ts
import { IComponentTestMappingRepository } from "../../ports/i_component_test_mapping_repository";
import { ComponentTestMapping } from "../../domain/component_test_mapping";
import globalPool from "../database";
import { Pool } from 'pg';
import { rowToComponentTestMapping } from "../mappers";

export class ComponentTestMappingRepository implements IComponentTestMappingRepository {
    private pool: Pool;

    constructor(poolInstance: Pool = globalPool) {
        this.pool = poolInstance;
    }
    async findTestMapping(mainComponentId: string): Promise<ComponentTestMapping | null> {
        const query = 'SELECT * FROM component_test_mappings WHERE main_component_id = $1;';
        const result = await this.pool.query(query, [mainComponentId]);
        return result.rows.length > 0 ? rowToComponentTestMapping(result.rows[0]) : null;
    }

    async findAllTestMappings(mainComponentIds: string[]): Promise<Map<string, string>> {
        if (mainComponentIds.length === 0) {
            return new Map();
        }
        const query = 'SELECT main_component_id, test_component_id FROM component_test_mappings WHERE main_component_id = ANY($1::varchar[]);';
        const result = await this.pool.query(query, [mainComponentIds]);
        const map = new Map<string, string>();
        for (const row of result.rows) {
            map.set(row.main_component_id, row.test_component_id);
        }
        return map;
    }
}
