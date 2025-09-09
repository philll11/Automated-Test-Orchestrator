import { IDiscoveredComponentRepository } from "../../ports/i_discovered_component_repository";
import { DiscoveredComponent } from "../../domain/discovered_component";
import pool from "../database";

export class DiscoveredComponentRepository implements IDiscoveredComponentRepository {
  async saveAll(components: DiscoveredComponent[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const component of components) {
        const { id, testPlanId, componentId, componentName, mappedTestId, executionStatus, executionLog } = component;
        const query = `
          INSERT INTO discovered_components (id, test_plan_id, component_id, component_name, mapped_test_id, execution_status, execution_log)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO NOTHING;
        `;
        const values = [id, testPlanId, componentId, componentName, mappedTestId, executionStatus, executionLog];
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
    const result = await pool.query(query, [testPlanId]);
    return result.rows;
  }
}
