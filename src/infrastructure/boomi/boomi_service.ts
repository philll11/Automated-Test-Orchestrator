// src/infrastructure/boomi/boomi_service.ts

import axios, { AxiosInstance } from 'axios';
import { IBoomiService, BoomiCredentials } from '../../ports/i_boomi_service';

// --- Type Definitions for Boomi API Responses ---
interface ComponentMetadataResponse {
  version: number;
}

interface ComponentReference {
  componentId: string;
}

interface ComponentReferenceResult {
  references?: ComponentReference[];
}

interface ComponentReferenceQueryResponse {
  numberOfResults: number;
  result?: ComponentReferenceResult[];
}

export class BoomiService implements IBoomiService {
  private apiClient: AxiosInstance;

  constructor(credentials: BoomiCredentials) {
    this.apiClient = axios.create({
      baseURL: `https://api.boomi.com/api/rest/v1/${credentials.accountId}`,
      auth: {
        username: credentials.username,
        password: credentials.password_or_token,
      },
    });
  }

  private async getComponentVersion(componentId: string): Promise<number | null> {
    try {
      const response = await this.apiClient.get<ComponentMetadataResponse>(`/ComponentMetadata/${componentId}`);
      return response.data.version;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response && error.response.status === 400) {
          console.warn(`Component with ID ${componentId} not found or invalid. It will be treated as having no dependencies.`);
          return null; // Gracefully handle "not found" as a non-critical error
        }
      }
      // For all other errors (network issues, 500s, etc.), log and re-throw
      console.error(`An unexpected error occurred while fetching version for component ${componentId}:`, error);
      throw error;
    }
  }

  public async getComponentDependencies(componentId: string): Promise<string[]> {
    const version = await this.getComponentVersion(componentId);
    if (version === null) return [];

    try {
      const response = await this.apiClient.post<ComponentReferenceQueryResponse>('/ComponentReference/query', {
        QueryFilter: {
          expression: {
            operator: 'and',
            nestedExpression: [
              {
                operator: 'EQUALS',
                property: 'parentComponentId',
                argument: [componentId],
              },
              {
                operator: 'EQUALS',
                property: 'parentVersion',
                argument: [version],
              },
            ],
          },
        },
      });

      if (response.data.numberOfResults === 0 || !response.data.result) return [];

      return response.data.result.flatMap((resultItem) =>
        resultItem.references ? resultItem.references.map((ref) => ref.componentId) : []
      );

    } catch (error) {
      console.error(`An unexpected error occurred while fetching dependencies for component ${componentId}:`, error);
      throw error; // Re-throw to be handled by the calling service (TestPlanService)
    }
  }
}