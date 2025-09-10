// src/ports/i_component_test_mapping_repository.ts

import { ComponentTestMapping } from "../domain/component_test_mapping.js";

export interface IComponentTestMappingRepository {
  findTestMapping(mainComponentId: string): Promise<ComponentTestMapping | null>;
  findAllTestMappings(mainComponentIds: string[]): Promise<Map<string, string>>;
}