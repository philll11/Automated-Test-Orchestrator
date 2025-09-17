// src/cli/commands/test-plans.ts

import { Command } from 'commander';
import chalk from 'chalk';
import { getAllPlans, getPlanStatus } from '../api_client.js';
import { handleCliError } from '../error_handler.js';
import { CliTestPlanSummary, CliTestPlan } from '../types.js';

export const testPlansCommand = new Command('test-plans')
    .description('Manage and view test plans.');

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
                // REMOVED: 'Root Component ID': plan.rootComponentId,
                'Status': plan.status,
                'Created At': new Date(plan.createdAt).toLocaleString(),
            }));

            console.table(formattedPlans);
            console.log("\nTo see the full details of a plan, use 'ato test-plans get <Plan ID>'.");

        } catch (error) {
            handleCliError(error);
        }
    });

testPlansCommand
    .command('get <planId>')
    .description('Get the full details of a specific test plan.')
    .action(async (planId: string) => {
        try {
            console.log(`Fetching details for Test Plan ID: ${chalk.cyan(planId)}...`);
            const plan = await getPlanStatus(planId);

            console.log('\n--- Plan Summary ---');
            console.table([
                {
                    ID: plan.id,
                    Status: plan.status,
                    'Created At': new Date(plan.createdAt).toLocaleString(),
                },
            ]);

            if (plan.status.endsWith('_FAILED') && plan.failureReason) {
                console.log(`${chalk.red('Failure Reason:')} ${plan.failureReason}`);
            }

            if (plan.planComponents && plan.planComponents.length > 0) {
                console.log('\n--- Plan Components & Test Coverage ---');
                const formattedComponents = plan.planComponents.map(c => ({
                    'Component ID': c.componentId,
                    'Component Name': c.componentName || 'N/A',
                    'Available Tests': c.availableTests.join(', ') || 'None',
                }));
                console.table(formattedComponents);
            } else {
                console.log('\nNo components are associated with this plan.');
            }

            const allResults = plan.planComponents.flatMap(pc => 
                pc.executionResults.map(res => ({
                    'Component Name': pc.componentName || pc.componentId,
                    'Test ID': res.testComponentId,
                    'Status': res.status === 'SUCCESS' ? chalk.green(res.status) : chalk.red(res.status),
                    'Has Log': res.log ? 'Yes' : 'No',
                }))
            );

            if (allResults.length > 0) {
                console.log('\n--- Test Execution Results ---');
                console.table(allResults);
            } else {
                console.log('\nNo tests have been executed for this plan yet.');
            }

        } catch (error) {
            handleCliError(error);
        }
    });