// src/domain/plan_component.ts

export interface PlanComponent {
  id: string;
  testPlanId: string;
  componentId: string;
  componentName?: string;
  componentType?: string;
}