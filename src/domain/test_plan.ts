// src/domain/test_plan.ts

export type TestPlanStatus =
  | 'DISCOVERING'
  | 'AWAITING_SELECTION'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'DISCOVERY_FAILED'
  | 'EXECUTION_FAILED';

export interface TestPlan {
  id: string;
  status: TestPlanStatus;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}