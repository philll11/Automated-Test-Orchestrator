// src/domain/test_plan.ts

export enum TestPlanStatus {
    DISCOVERING = 'DISCOVERING',
    AWAITING_SELECTION = 'AWAITING_SELECTION',
    EXECUTING = 'EXECUTING',
    COMPLETED = 'COMPLETED',
    DISCOVERY_FAILED = 'DISCOVERY_FAILED',
    EXECUTION_FAILED = 'EXECUTION_FAILED'
}

export interface TestPlan {
  id: string;
  name: string;
  status: TestPlanStatus;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}