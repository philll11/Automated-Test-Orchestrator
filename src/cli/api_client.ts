// src/cli/api_client.ts

import axios from 'axios';
import type { CliTestPlan } from './types.js';
import { config } from './config.js';
import { IntegrationPlatformCredentials } from '../domain/integration_platform_credentials.js';

const apiClient = axios.create({
  baseURL: config.API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * A custom error class for the CLI to pass specific failure reasons.
 */
export class PlanFailedError extends Error {
  public readonly reason: string;
  constructor(reason: string) {
    super('The test plan failed on the server.');
    this.name = 'PlanFailedError';
    this.reason = reason;
  }
}

/**
 * A simple delay utility to use in our polling logic.
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Initiates the discovery process.
 * @param rootComponentId The component to start discovery from.
 * @param credentials The secure integration credentials for the API call.
 * @returns The newly created planId.
 */
export async function initiateDiscovery(rootComponentId: string, credentials: IntegrationPlatformCredentials): Promise<{ planId: string }> {
  const response = await apiClient.post('/test-plans', {
    rootComponentId,
    integrationPlatformCredentials: credentials
  });

  const planId = response.data.data.id;
  return { planId };
}

/**
 * Fetches the current status and data for a given test plan.
 * @param planId The ID of the plan to fetch.
 * @returns The full test plan object.
 */
export async function getPlanStatus(planId: string): Promise<CliTestPlan> {
  const response = await apiClient.get<{ data: CliTestPlan }>(`/test-plans/${planId}`);
  return response.data.data;
}

/**
 * Polls the API until the test plan status is 'AWAITING_SELECTION' or 'FAILED'.
 * @param planId The ID of the plan to poll.
 * @returns The completed test plan object.
 */
export async function pollForPlanCompletion(planId: string): Promise<CliTestPlan> {
  let plan = await getPlanStatus(planId);

  // Poll every 2 seconds until discovery is complete or has failed.
  while (plan.status !== 'AWAITING_SELECTION' && plan.status !== 'FAILED') {
    await delay(2000);
    plan = await getPlanStatus(planId);
  }

  if (plan.status === 'FAILED') {
    throw new PlanFailedError(plan.failureReason || 'An unknown error occurred on the server.');
  }

  return plan;
}

/**
 * Initiates the execution of selected tests for a given plan.
 * @param planId The ID of the plan to execute.
 * @param testsToRun An array of test component IDs to execute.
 * @param credentials The secure integration credentials for the API call.
 * @returns The initial response from the server.
 */
export async function initiateExecution(planId: string, testsToRun: string[], credentials: IntegrationPlatformCredentials): Promise<any> {
  // We will pass a dummy executionInstanceId for now, as this will be handled by
  // a secure configuration service later.
  const response = await apiClient.post(`/test-plans/${planId}/execute`, {
    testsToRun,
    integrationPlatformCredentials: credentials,
    executionInstanceId: credentials.executionInstanceId
  });
  return response.data;
}

/**
 * Polls the API until the test plan status is 'COMPLETED' or 'FAILED'.
 * @param planId The ID of the plan to poll.
 * @returns The completed test plan object.
 */
export async function pollForExecutionCompletion(planId: string): Promise<CliTestPlan> {
  let plan = await getPlanStatus(planId);

  // Poll every 3 seconds until execution is complete or has failed.
  while (plan.status !== 'COMPLETED' && plan.status !== 'FAILED') {
    await delay(3000);
    plan = await getPlanStatus(planId);
  }

  if (plan.status === 'FAILED') {
    throw new PlanFailedError(plan.failureReason || 'The test plan execution failed on the server.');
  }

  return plan;
}