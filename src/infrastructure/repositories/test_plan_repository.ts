// src/infrastructure/repositories/test_plan_repository.ts

import pg from 'pg';
import { ITestPlanRepository } from "../../ports/i_test_plan_repository.js";
import { TestPlan } from "../../domain/test_plan.js";
import globalPool from "../database.js";
import { rowToTestPlan } from "../mappers.js";


export class TestPlanRepository implements ITestPlanRepository {
    private pool: pg.Pool;

    constructor(poolInstance: pg.Pool = globalPool) {
        this.pool = poolInstance;
    }

    async save(testPlan: TestPlan): Promise<TestPlan> {
        const { id, rootComponentId, status, createdAt, updatedAt } = testPlan;
        const query = `
            INSERT INTO test_plans (id, root_component_id, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const values = [id, rootComponentId, status, createdAt, updatedAt];
        const result = await this.pool.query(query, values);
        return rowToTestPlan(result.rows[0]);
    }

    async findById(id: string): Promise<TestPlan | null> {
        const query = 'SELECT * FROM test_plans WHERE id = $1;';
        const result = await this.pool.query(query, [id]);
        if (result.rows.length === 0) return null;
        return rowToTestPlan(result.rows[0]);
    }

    async update(testPlan: TestPlan): Promise<TestPlan> {
        const { id, status, updatedAt, failureReason } = testPlan;
        const query = `
            UPDATE test_plans
            SET status = $1, updated_at = $2, failure_reason = $3
            WHERE id = $4
            RETURNING *;
        `;
        const values = [status, updatedAt, failureReason || null, id];
        const result = await this.pool.query(query, values);

        return rowToTestPlan(result.rows[0]);
    }
}