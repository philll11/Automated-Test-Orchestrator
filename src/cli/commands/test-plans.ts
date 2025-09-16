// src/cli/commands/test-plans.ts

import { Command } from 'commander';
import { getAllPlans, getPlanStatus } from '../api_client.js';
import { handleCliError } from '../error_handler.js';
import { CliTestPlanSummary, CliTestPlan } from '../types.js';

// The main command is now 'test-plans'
export const testPlansCommand = new Command('test-plans')
    .description('Manage and view test plans.');

// Subcommand to list all plans
testPlansCommand
    .command('list')
    .description('List all test plans.')
    .action(async () => {
        try {
            console.log('Fetching all test plans...');
            const plans = await getAllPlans();

            if (plans.length === 0) {
                console.log('No test plans found.');
                return;
            }

            const formattedPlans = plans.map((plan: CliTestPlanSummary) => ({
                'Plan ID': plan.id,
                'Root Component ID': plan.rootComponentId,
                'Status': plan.status,
                'Created At': new Date(plan.createdAt).toLocaleString(),
            }));

            console.table(formattedPlans);
            // Updated help text to reflect the new command structure
            console.log("\nTo see the full details of a plan, use 'ato test-plans get <Plan ID>'.");

        } catch (error) {
            handleCliError(error);
        }
    });

// Subcommand to get details for a single plan
testPlansCommand
    .command('get <planId>')
    .description('Get the full details of a specific test plan.')
    .action(async (planId: string) => {
        try {
            console.log(`Fetching details for Test Plan ID: ${planId}...`);
            const plan = await getPlanStatus(planId);

            // Display Summary Info
            console.log('\n--- Plan Summary ---');
            console.table([
                {
                    ID: plan.id,
                    Status: plan.status,
                    'Root Component': plan.rootComponentId,
                    'Created At': new Date(plan.createdAt).toLocaleString(),
                },
            ]);

            if (plan.status.endsWith('_FAILED') && plan.failureReason) {
                console.log(`Failure Reason: ${plan.failureReason}`);
            }

            // Display Discovered Components and their available tests
            if (plan.discoveredComponents && plan.discoveredComponents.length > 0) {
                console.log('\n--- Discovered Components ---');
                const formattedComponents = plan.discoveredComponents.map(c => ({
                    'Component ID': c.componentId,
                    'Component Name': c.componentName || 'N/A',
                    'Available Tests': c.availableTests.join(', ') || 'None',
                }));
                console.table(formattedComponents);
            } else {
                console.log('\nNo components were discovered for this plan.');
            }

            // Flatten and Display All Execution Results
            const allResults = plan.discoveredComponents.flatMap(dc => 
                dc.executionResults.map(res => ({
                    'Component Name': dc.componentName || dc.componentId,
                    'Test ID': res.testComponentId,
                    'Status': res.status,
                    'Has Log': res.log ? 'Yes' : 'No',
                }))
            );

            if (allResults.length > 0) {
                console.log('\n--- Test Execution Results ---');
                console.table(allResults);
            } else {
                console.log('\nNo tests were executed for this plan.');
            }

        } catch (error) {
            handleCliError(error);
        }
    });