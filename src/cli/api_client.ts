// src/cli/api_client.ts

import axios from 'axios';
import type { CliTestPlan, CliTestPlanSummary, CliMapping, CliCredentialProfile, CliEnrichedTestExecutionResult } from './types.js';
import { config } from './config.js';

const apiClient = axios.create({
  baseURL: config.API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export class PlanFailedError extends Error {
  constructor(public readonly reason: string) {
    super('The test plan failed on the server.');
    this.name = 'PlanFailedError';
  }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- CREDENTIALS FUNCTIONS ---

/**
 * Sends a new credential profile to the backend to be stored securely.
 * @param profileName The name for the new profile.
 * @param credentials The full credential object, including the executionInstanceId.
 */
export async function addCredentialProfile(profileName: string, credentials: { [key: string]: any }): Promise<void> {
  // The backend API expects the profileName to be part of the body.
  await apiClient.post('/credentials', { profileName, ...credentials });
}

/**
 * Retrieves a list of all saved credential profiles from the backend.
 * @returns An array of credential profiles, omitting sensitive information.
 */
export async function listCredentialProfiles(): Promise<CliCredentialProfile[]> {
  const response = await apiClient.get('/credentials');
  return response.data.data;
}

/**
 * Deletes a credential profile from the backend's secure store.
 * @param profileName The name of the profile to delete.
 */
export async function deleteCredentialProfile(profileName: string): Promise<void> {
  await apiClient.delete(`/credentials/${profileName}`);
}

// --- TEST PLAN FUNCTIONS ---

/**
 * Initiates the discovery process using a credential profile name.
 * @param componentIds An array of component IDs to include in the plan.
 * @param credentialProfile The name of the credential profile to use.
 * @param discoverDependencies If true, find all dependencies for the given component IDs.
 * @returns The newly created planId.
 */
export async function initiateDiscovery(componentIds: string[], credentialProfile: string, discoverDependencies: boolean): Promise<{ planId: string }> {
  const response = await apiClient.post('/test-plans', {
    componentIds,
    credentialProfile,
    discoverDependencies,
  });
  return { planId: response.data.data.id };
}


/**
 * Retrieves a summary list of all test plans.
 * @returns An array of test plan summary objects.
 */
export async function getAllPlans(): Promise<CliTestPlanSummary[]> {
  const response = await apiClient.get('/test-plans');
  return response.data.data;
}

/** Fetches the current status of a test plan by its ID.
 * @param planId The ID of the test plan to fetch.
 * @returns The full test plan object.
 */
export async function getPlanStatus(planId: string): Promise<CliTestPlan> {
  const response = await apiClient.get<{ data: CliTestPlan }>(`/test-plans/${planId}`);
  return response.data.data;
}

/** Polls the backend until the discovery phase of a test plan is complete.
 * @param planId The ID of the test plan to poll.
 * @returns The completed test plan object.
 * @throws PlanFailedError if the discovery phase fails.
 */
export async function pollForPlanCompletion(planId: string): Promise<CliTestPlan> {
  let plan = await getPlanStatus(planId);
  // Poll until we reach a terminal state for the discovery phase
  while (plan.status === 'DISCOVERING') {
    await delay(2000);
    plan = await getPlanStatus(planId);
  }

  if (plan.status === 'DISCOVERY_FAILED') {
    throw new PlanFailedError(plan.failureReason || 'An unknown discovery error occurred.');
  }
  return plan;
}

/**
 * Initiates the execution of selected tests using a credential profile name.
 * @param planId The ID of the plan to execute.
 * @param testsToRun An array of test component IDs to execute.
 * @param credentialProfile The name of the credential profile to use.
 * @returns The initial response from the server.
 */
export async function initiateExecution(planId: string, testsToRun: string[], credentialProfile: string): Promise<any> {
  const response = await apiClient.post(`/test-plans/${planId}/execute`, {
    testsToRun,
    credentialProfile,
  });
  return response.data;
}

/**
 * Polls the backend until the execution phase of a test plan is complete.
 * @param planId The ID of the plan to poll.
 * @returns The completed test plan object.
 */
export async function pollForExecutionCompletion(planId: string): Promise<CliTestPlan> {
  let plan = await getPlanStatus(planId);
  // Poll until we reach a terminal state for the execution phase
  while (plan.status === 'EXECUTING' || plan.status === 'AWAITING_SELECTION') {
    await delay(3000);
    plan = await getPlanStatus(planId);
  }

  if (plan.status === 'EXECUTION_FAILED') {
    throw new PlanFailedError(plan.failureReason || 'A system error occurred during execution.');
  }
  return plan;
}

// --- MAPPING FUNCTIONS ---

/**
 * Creates a new test mapping between a main component and a test component.
 * @param data The mapping details including mainComponentId, testComponentId, and optional testComponentName.
 * @returns The newly created mapping object.
 */
export async function createMapping(data: { mainComponentId: string; testComponentId: string; testComponentName?: string }): Promise<CliMapping> {
  const response = await apiClient.post('/mappings', data);
  return response.data.data;
}

/** Retrieves all existing test mappings from the backend.
 * @returns An array of mapping objects.
 */
export async function getAllMappings(): Promise<CliMapping[]> {
  const response = await apiClient.get('/mappings');
  return response.data.data;
}

/** Deletes a test mapping by its unique ID.
 * @param mappingId The unique ID of the mapping to delete.
 */
export async function deleteMapping(mappingId: string): Promise<void> {
  await apiClient.delete(`/mappings/${mappingId}`);
}

// --- TEST EXECUTION RESULTS FUNCTIONS ---

/**
 * The filter criteria for querying test execution results.
 */
export interface GetResultsFilters {
  testPlanId?: string;
  discoveredComponentId?: string;
  testComponentId?: string;
  status?: 'SUCCESS' | 'FAILURE';
}

/**
 * Retrieves enriched test execution results from the backend based on filters.
 * @param filters The query parameters to filter the results by.
 * @returns An array of enriched test execution result objects.
 */
export async function getExecutionResults(filters: GetResultsFilters): Promise<CliEnrichedTestExecutionResult[]> {
  const response = await apiClient.get('/test-execution-results', { params: filters });
  return response.data;
}