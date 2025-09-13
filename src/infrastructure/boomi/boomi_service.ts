// src/infrastructure/boomi/boomi_service.ts

import axios, { AxiosInstance } from 'axios';
import { IIntegrationPlatformService, IntegrationPlatformCredentials, TestExecutionResult, TestExecutionOptions, ComponentInfo } from '../../ports/i_integration_platform_service.js';
import { AuthenticationError } from '../../utils/app_error.js';

// --- Type Definitions for Boomi API Responses ---
interface ComponentMetadataResponse {
    name: string;
    version: number;
    type: string;
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

interface PollingOptions {
    pollInterval?: number;
    maxPolls?: number;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class BoomiService implements IIntegrationPlatformService {
    private apiClient: AxiosInstance;
    private pollInterval: number;
    private maxPolls: number;

    constructor(credentials: IntegrationPlatformCredentials, options: PollingOptions = {}) {
        
        console.log(`[ADAPTER] Creating BoomiService for account: ${credentials.accountId}`);

        this.apiClient = axios.create({
            baseURL: `https://api.boomi.com/api/rest/v1/${credentials.accountId}`,
            auth: {
                username: credentials.username,
                password: credentials.passwordOrToken,
            },
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        this.pollInterval = options.pollInterval ?? 1000;
        this.maxPolls = options.maxPolls ?? 60;
    }

    private async getComponentMetadata(componentId: string): Promise<ComponentMetadataResponse | null> {
        
        console.log(`[ADAPTER] getComponentVersion called for component: ${componentId}`);

        try {
            const response = await this.apiClient.get<ComponentMetadataResponse>(`/ComponentMetadata/${componentId}`);
            return {
                name: response.data.name,
                version: response.data.version,
                type: response.data.type,
            };
        } catch (error) {
            
            console.error(`[ADAPTER] CATCH BLOCK in getComponentVersion.`);
            if (axios.isAxiosError(error) && error.response) {
                console.error(`[ADAPTER] Axios error with status: ${error.response.status}`);
            } else {
                console.error(`[ADAPTER] A non-Axios error occurred:`, error);
            }

            if (axios.isAxiosError(error) && error.response) {
                if ([401, 403, 404].includes(error.response.status)) {
                    throw new AuthenticationError('Boomi API authentication failed. Please check your credentials.');
                }
                if (error.response.status === 400) { // Boomi incorrectly returns 400 for not found
                    console.warn(`Component with ID ${componentId} not found or invalid. It will be treated as having no dependencies.`);
                    return null;
                }
            }
            console.error(`An unexpected error occurred while fetching metadata for component ${componentId}:`, error);
            throw error;
        }
    }

    public async getComponentInfoAndDependencies(componentId: string): Promise<ComponentInfo | null> {
        const metadata = await this.getComponentMetadata(componentId);
        if (metadata === null) return null; // Component not found, return null

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
                                argument: [metadata.version],
                            },
                        ],
                    },
                },
            });

            const dependencyIds = response.data.numberOfResults === 0 || !response.data.result
                ? []
                : response.data.result.flatMap((resultItem) =>
                    resultItem.references ? resultItem.references.map((ref) => ref.componentId) : []
                );
            
            // Return the combined object
            return {
                id: componentId,
                name: metadata.name,
                type: metadata.type,
                dependencyIds: dependencyIds
            };

        } catch (error) {
            console.error(`An unexpected error occurred while fetching dependencies for component ${componentId}:`, error);
            throw error;
        }
    }

    public async executeTestProcess(componentId: string, options: TestExecutionOptions): Promise<TestExecutionResult> {
        try {
            const executionRequest = {
                '@type': 'ExecutionRequest',
                atomId: options.executionInstanceId,
                processId: componentId,
            };
            const initResponse = await this.apiClient.post('/ExecutionRequest', executionRequest);
            const requestId = initResponse.data.requestId;
            const recordUrl = initResponse.data.recordUrl; // For the final log URL

            if (!requestId) {
                throw new Error('Execution initiation failed to return a requestId.');
            }

            let pollCount = 0;

            while (pollCount < this.maxPolls) {
                const pollResponse = await this.apiClient.get(`/ExecutionRecord/async/${requestId}`);

                if (pollResponse.data.responseStatusCode === 200) {
                    const executionRecord = pollResponse.data.result?.[0];
                    if (!executionRecord) {
                        return { status: 'FAILURE', message: 'Execution completed but no result record was found.' };
                    }

                    const currentStatus = executionRecord.status;

                    // Check for terminal success or failure states
                    if (currentStatus === 'COMPLETE') {
                        return { status: 'SUCCESS', message: 'Execution completed successfully.', executionLogUrl: recordUrl };
                    }

                    if (currentStatus === 'ERROR') {
                        return { status: 'FAILURE', message: `Execution failed with message: ${executionRecord.message}`, executionLogUrl: recordUrl };
                    }
                }

                pollCount++;
                await delay(this.pollInterval);
            }

            return { status: 'FAILURE', message: 'Execution timed out while polling for a result.' };

        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                console.error('Boomi API error during test execution:', error.response.data);
                const message = error.response.data?.message || 'An unknown error occurred during execution.';
                return { status: 'FAILURE', message: message };
            } else {
                console.error('Unexpected error during test execution:', error);
                return { status: 'FAILURE', message: 'An unknown error occurred during execution.' };
            }
        }
    }
}