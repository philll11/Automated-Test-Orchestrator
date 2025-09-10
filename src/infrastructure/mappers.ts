// src/infrastructure/mappers.ts

import { TestPlan } from '../domain/test_plan.js';
import { DiscoveredComponent } from '../domain/discovered_component.js';
import { ComponentTestMapping } from '../domain/component_test_mapping.js';

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
    mappedTestId: row.mapped_test_id,
    executionStatus: row.execution_status,
    executionLog: row.execution_log,
  };
}

/**
 * Maps a raw database row from the 'component_test_mappings' table to a ComponentTestMapping domain object.
 * @param row The raw row object from the database (snake_case).
 * @returns A ComponentTestMapping object (camelCase).
 */
export function rowToComponentTestMapping(row: any): ComponentTestMapping {
    if (!row) return row;
    return {
        mainComponentId: row.main_component_id,
        testComponentId: row.test_component_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}