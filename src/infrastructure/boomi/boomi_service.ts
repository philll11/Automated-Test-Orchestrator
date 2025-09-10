// src/infrastructure/boomi/boomi_service.ts

import axios, { AxiosInstance } from 'axios';
import { IBoomiService, BoomiCredentials, TestExecutionResult, TestExecutionOptions } from '../../ports/i_boomi_service.js';

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

interface PollingOptions {
    pollInterval?: number;
    maxPolls?: number;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class BoomiService implements IBoomiService {
    private apiClient: AxiosInstance;
    private pollInterval: number;
    private maxPolls: number;

    constructor(credentials: BoomiCredentials, options: PollingOptions = {}) {
        this.apiClient = axios.create({
            baseURL: `https://api.boomi.com/api/rest/v1/${credentials.accountId}`,
            auth: {
                username: credentials.username,
                password: credentials.password_or_token,
            },
        });
        this.pollInterval = options.pollInterval ?? 1000; 
        this.maxPolls = options.maxPolls ?? 60;
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

    public async executeTestProcess(componentId: string, options: TestExecutionOptions): Promise<TestExecutionResult> {
        try {
            // 1. Initiate Execution
            const executionRequest = {
                '@type': 'ExecutionRequest',
                atomId: options.atomId,
                processId: componentId,
            };
            const initResponse = await this.apiClient.post('/ExecutionRequest', executionRequest);
            const requestId = initResponse.data.requestId;
            const recordUrl = initResponse.data.recordUrl; // For the final log URL

            if (!requestId) {
                throw new Error('Execution initiation failed to return a requestId.');
            }

            // 2. Poll for Result
            let pollCount = 0;

            while (pollCount < this.maxPolls) {
                const pollResponse = await this.apiClient.get(`/ExecutionRecord/async/${requestId}`);

                if (pollResponse.data.responseStatusCode === 200) {
                    // 3. Interpret Final Result
                    const executionRecord = pollResponse.data.result?.[0];
                    if (!executionRecord) {
                        return { status: 'FAILURE', message: 'Execution completed but no result record was found.' };
                    }

                    if (executionRecord.status === 'COMPLETE') {
                        return { status: 'SUCCESS', message: 'Execution completed successfully.', executionLogUrl: recordUrl };
                    } else if (executionRecord.status === 'ERROR') {
                        return { status: 'FAILURE', message: `Execution failed with message: ${executionRecord.message}`, executionLogUrl: recordUrl };
                    } else {
                        // This could happen if the process errors out in an unusual way
                        return { status: 'FAILURE', message: `Execution finished with unexpected status: ${executionRecord.status}`, executionLogUrl: recordUrl };
                    }
                }

                // If status is 202 (INPROCESS), wait and poll again
                pollCount++;
                await delay(this.pollInterval);
            }

            // If we exit the loop, it's a timeout
            return { status: 'FAILURE', message: 'Execution timed out while polling for a result.' };

        } catch (error) {
            console.error(`Execution failed for component ${componentId}:`, error);
            const message = axios.isAxiosError(error) ? error.message : 'An unknown error occurred during execution.';
            return { status: 'FAILURE', message };
        }
    }
}