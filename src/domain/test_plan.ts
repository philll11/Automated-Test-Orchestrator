// src/domain/test_plan.ts

export interface TestPlan {
  id: string;
  rootComponentId: string;
  status: 'PENDING' | 'AWAITING_SELECTION' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
