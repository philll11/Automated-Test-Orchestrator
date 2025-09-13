// src/domain/discovered_component.ts

export interface DiscoveredComponent {
  id: string;
  testPlanId: string;
  componentId: string;
  componentName?: string;
  componentType?: string;
  mappedTestId?: string;
  executionStatus?: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILURE';
  executionLog?: string;
}