// src/infrastructure/mappers.ts

import { TestPlan } from '../domain/test_plan.js';
import { DiscoveredComponent } from '../domain/discovered_component.js';
import { Mapping } from '../domain/mapping.js';
import { TestExecutionResult } from '../domain/test_execution_result.js';

/**
 * Maps a raw database row from the 'test_plans' table to a TestPlan domain object.
 * @param row The raw row object from the database (snake_case).
 * @returns A TestPlan object (camelCase).
 */
export function rowToTestPlan(row: any): TestPlan {
  if (!row) return row;
  return {
    id: row.id,
    rootComponentId: row.root_component_id,
    status: row.status,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Maps a raw database row from the 'discovered_components' table to a DiscoveredComponent domain object.
 * @param row The raw row object from the database (snake_case).
 * @returns A DiscoveredComponent object (camelCase).
 */
export function rowToDiscoveredComponent(row: any): DiscoveredComponent {
  if (!row) return row;
  return {
    id: row.id,
    testPlanId: row.test_plan_id,
    componentId: row.component_id,
    componentName: row.component_name,
    componentType: row.component_type
  };
}

/**
 * Maps a raw database row from the 'mappings' table to a Mapping domain object.
 * @param row The raw row object from the database (snake_case).
 * @returns A Mapping object (camelCase).
 */
export function rowToMapping(row: any): Mapping {
  if (!row) return row;
  return {
    id: row.id,
    mainComponentId: row.main_component_id,
    testComponentId: row.test_component_id,
    testComponentName: row.test_component_name,
    isDeployed: row.is_deployed,
    isPackage: row.is_package,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Maps a raw database row from the 'test_execution_results' table to a TestExecutionResult domain object.
 * This function expects a row that has been joined with other tables to include additional names.
 * @param row The raw row object from the database (snake_case).
 * @returns A TestExecutionResult object (camelCase).
 */
export function rowToTestExecutionResult(row: any): TestExecutionResult {
  if (!row) return row;
  return {
    id: row.id,
    testPlanId: row.test_plan_id,
    rootComponentId: row.root_component_id,
    discoveredComponentId: row.discovered_component_id,
    componentName: row.component_name,
    testComponentId: row.test_component_id,
    testComponentName: row.test_component_name,
    status: row.status,
    log: row.log,
    executedAt: row.executed_at,
  };
}