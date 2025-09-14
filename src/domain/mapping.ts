// src/domain/mapping.ts

export interface Mapping {
  id: string;
  mainComponentId: string;
  testComponentId: string;
  testComponentName?: string;
  isDeployed?: boolean;
  isPackage?: boolean;
  createdAt: Date;
  updatedAt: Date;
}