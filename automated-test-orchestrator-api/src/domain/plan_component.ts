// src/domain/plan_component.ts

export interface PlanComponent {
  id: string;
  testPlanId: string;
  sourceType: string;
  componentId: string;
  componentName?: string;
  componentType?: string;
}