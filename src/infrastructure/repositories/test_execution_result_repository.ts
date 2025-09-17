// src/infrastructure/repositories/test_execution_result_repository.ts

import type { Pool } from 'pg';
import { injectable, inject } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import { ITestExecutionResultRepository, NewTestExecutionResult, TestExecutionResultFilters } from '../../ports/i_test_execution_result_repository.js';
import { TestExecutionResult } from '../../domain/test_execution_result.js';
import { rowToTestExecutionResult } from '../mappers.js';
import { TYPES } from '../../inversify.types.js';

@injectable()
export class TestExecutionResultRepository implements ITestExecutionResultRepository {
    constructor(@inject(TYPES.PostgresPool) private pool: Pool) {}

    async save(newResult: NewTestExecutionResult): Promise<TestExecutionResult> {
        const { testPlanId, planComponentId, testComponentId, status, log } = newResult;

        const result = {
            id: uuidv4(),
            testPlanId,
            planComponentId,
            testComponentId,
            status,
            log,
            executedAt: new Date(),
        };

        const query = `
            INSERT INTO test_execution_results (id, test_plan_id, plan_component_id, test_component_id, status, log, executed_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *;
        `;
        const values = [result.id, result.testPlanId, result.planComponentId, result.testComponentId, result.status, result.log, result.executedAt];
        
        const dbResult = await this.pool.query(query, values);
        
        return rowToTestExecutionResult(dbResult.rows[0]);
    }

    async findByPlanComponentIds(planComponentIds: string[]): Promise<TestExecutionResult[]> {
        if (planComponentIds.length === 0) {
            return [];
        }
        
        const query = `
            SELECT
                ter.id,
                ter.test_plan_id,
                ter.plan_component_id,
                ter.test_component_id,
                ter.status,
                ter.log,
                ter.executed_at,
                tp.root_component_id,
                dc.component_name,
                m.test_component_name
            FROM test_execution_results ter
            INNER JOIN discovered_components dc ON ter.plan_component_id = dc.id
            INNER JOIN test_plans tp ON ter.test_plan_id = tp.id
            LEFT JOIN mappings m ON dc.component_id = m.main_component_id AND ter.test_component_id = m.test_component_id
            WHERE ter.plan_component_id = ANY($1::uuid[])
            ORDER BY ter.executed_at ASC;
        `;
        const result = await this.pool.query(query, [planComponentIds]);
        return result.rows.map(rowToTestExecutionResult);
    }

    async findByFilters(filters: TestExecutionResultFilters): Promise<TestExecutionResult[]> {
        const conditions: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (filters.testPlanId) {
            conditions.push(`ter.test_plan_id = $${paramIndex++}`);
            values.push(filters.testPlanId);
        }
        if (filters.planComponentId) {
            conditions.push(`ter.plan_component_id = $${paramIndex++}`);
            values.push(filters.planComponentId);
        }
        if (filters.testComponentId) {
            conditions.push(`ter.test_component_id = $${paramIndex++}`);
            values.push(filters.testComponentId);
        }
        if (filters.status) {
            conditions.push(`ter.status = $${paramIndex++}`);
            values.push(filters.status);
        }

        if (conditions.length === 0) {
            return [];
        }

        const whereClause = conditions.join(' AND ');
        const query = `
            SELECT
                ter.id,
                ter.test_plan_id,
                ter.plan_component_id,
                ter.test_component_id,
                ter.status,
                ter.log,
                ter.executed_at,
                tp.root_component_id,
                dc.component_name,
                m.test_component_name
            FROM test_execution_results ter
            INNER JOIN discovered_components dc ON ter.plan_component_id = dc.id
            INNER JOIN test_plans tp ON ter.test_plan_id = tp.id
            LEFT JOIN mappings m ON dc.component_id = m.main_component_id AND ter.test_component_id = m.test_component_id
            WHERE ${whereClause}
            ORDER BY ter.executed_at ASC;
        `;
        
        const result = await this.pool.query(query, values);
        return result.rows.map(rowToTestExecutionResult);
    }
}