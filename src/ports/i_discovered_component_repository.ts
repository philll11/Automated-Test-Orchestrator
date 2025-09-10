// src/ports/i_discovered_component_repository.ts

import { DiscoveredComponent } from "../domain/discovered_component.js";

export interface IDiscoveredComponentRepository {
  saveAll(components: DiscoveredComponent[]): Promise<void>;
  findByTestPlanId(testPlanId: string): Promise<DiscoveredComponent[]>;
  update(component: DiscoveredComponent): Promise<DiscoveredComponent>;
}