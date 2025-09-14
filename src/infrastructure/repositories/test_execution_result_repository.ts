// src/infrastructure/repositories/test_execution_result_repository.ts

import { Pool } from 'pg';
import { injectable, inject } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import { ITestExecutionResultRepository, NewTestExecutionResult } from '../../ports/i_test_execution_result_repository.js';
import { TestExecutionResult } from '../../domain/test_execution_result.js';
import { rowToTestExecutionResult } from '../mappers.js';
import { TYPES } from '../../inversify.types.js';

@injectable()
export class TestExecutionResultRepository implements ITestExecutionResultRepository {
    constructor(@inject(TYPES.PostgresPool) private pool: Pool) {}

    async save(newResult: NewTestExecutionResult): Promise<TestExecutionResult> {
        const { discoveredComponentId, testComponentId, status, log } = newResult;
        const result: TestExecutionResult = {
            id: uuidv4(),
            discoveredComponentId,
            testComponentId,
            status,
            log,
            executedAt: new Date(),
        };

        const query = `
            INSERT INTO test_execution_results (id, discovered_component_id, test_component_id, status, log, executed_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
        const values = [result.id, result.discoveredComponentId, result.testComponentId, result.status, result.log, result.executedAt];
        
        const dbResult = await this.pool.query(query, values);
        return rowToTestExecutionResult(dbResult.rows[0]);
    }

    async findByDiscoveredComponentIds(discoveredComponentIds: string[]): Promise<TestExecutionResult[]> {
        if (discoveredComponentIds.length === 0) {
            return [];
        }
        const query = `
            SELECT * FROM test_execution_results
            WHERE discovered_component_id = ANY($1::uuid[])
            ORDER BY executed_at ASC;
        `;
        const result = await this.pool.query(query, [discoveredComponentIds]);
        return result.rows.map(rowToTestExecutionResult);
    }
}