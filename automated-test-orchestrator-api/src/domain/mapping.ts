// src/domain/mapping.ts

export interface Mapping {
  id: string;
  mainComponentId: string;
  mainComponentName?: string;
  testComponentId: string;
  testComponentName?: string;
  isDeployed?: boolean;
  isPackaged?: boolean;
  createdAt: Date;
  updatedAt: Date;
}