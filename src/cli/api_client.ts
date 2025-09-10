// src/cli/api_client.ts

import axios from 'axios';

// In a real application, this would come from a configuration file.
const API_BASE_URL = 'http://localhost:3000/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * A simple delay utility to use in our polling logic.
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Initiates the discovery process.
 * @param rootComponentId The component to start discovery from.
 * @returns The newly created planId.
 */
export async function initiateDiscovery(rootComponentId: string): Promise<{ planId: string }> {
  // The backend API requires boomiCredentials, even for discovery.
  // We will pass dummy data for now, matching the pattern in initiateExecution.
  // This will be replaced later by a secure credential management system.
  const response = await apiClient.post('/test-plans', {
    rootComponentId,
    boomiCredentials: {
      accountId: 'dummy-account-id',
      username: 'dummy-username',
      password_or_token: 'dummy-token'
    }
  });
  return response.data;
}

/**
 * Fetches the current status and data for a given test plan.
 * @param planId The ID of the plan to fetch.
 * @returns The full test plan object.
 */
export async function getPlanStatus(planId: string): Promise<any> { // Replace 'any' with a proper type later
  const response = await apiClient.get(`/test-plans/${planId}`);
  return response.data;
}

/**
 * Polls the API until the test plan status is 'AWAITING_SELECTION' or 'FAILED'.
 * @param planId The ID of the plan to poll.
 * @returns The completed test plan object.
 */
export async function pollForPlanCompletion(planId: string): Promise<any> { // Replace 'any' with a proper type
  let plan = await getPlanStatus(planId);

  // Poll every 2 seconds until discovery is complete or has failed.
  while (plan.status !== 'AWAITING_SELECTION' && plan.status !== 'FAILED') {
    await delay(2000);
    plan = await getPlanStatus(planId);
  }

  if (plan.status === 'FAILED') {
    throw new Error('The test plan discovery failed on the server.');
  }

  return plan;
}

/**
 * Initiates the execution of selected tests for a given plan.
 * @param planId The ID of the plan to execute.
 * @param testsToRun An array of test component IDs to execute.
 * @returns The initial response from the server.
 */
export async function initiateExecution(planId: string, testsToRun: string[]): Promise<any> {
  // The backend API requires the full credentials and atomId for now.
  // We will pass dummy data for the CLI, as this will be handled by
  // a secure configuration service later.
  const response = await apiClient.post(`/test-plans/${planId}/execute`, {
    testsToRun,
    boomiCredentials: {
      accountId: 'dummy-account-id',
      username: 'dummy-username',
      password_or_token: 'dummy-token'
    },
    atomId: 'dummy-atom-id'
  });
  return response.data;
}

/**
 * Polls the API until the test plan status is 'COMPLETED' or 'FAILED'.
 * @param planId The ID of the plan to poll.
 * @returns The completed test plan object.
 */
export async function pollForExecutionCompletion(planId: string): Promise<any> { // Replace 'any' with a proper type
  let plan = await getPlanStatus(planId);

  // Poll every 3 seconds until execution is complete or has failed.
  while (plan.status !== 'COMPLETED' && plan.status !== 'FAILED') {
    await delay(3000);
    plan = await getPlanStatus(planId);
  }

  if (plan.status === 'FAILED') {
    throw new Error('The test plan execution failed on the server.');
  }

  return plan;
}