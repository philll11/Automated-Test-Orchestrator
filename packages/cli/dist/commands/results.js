// cli/src/commands/results.ts
import { Command } from 'commander';
import { getExecutionResults } from '../api_client.js';
import { handleCliError } from '../error_handler.js';
export const resultsCommand = new Command('results');
resultsCommand
    .description('Query for test execution results with optional filters.')
    .option('--planId <id>', 'Filter results by a specific Test Plan ID.')
    .option('--componentId <id>', 'Filter results by a specific Discovered Component ID.')
    .option('--testId <id>', 'Filter results by a specific Test Component ID.')
    .option('--status <status>', 'Filter results by status (SUCCESS or FAILURE).')
    .action(async (options) => {
    try {
        console.log('Fetching test execution results...');
        const filters = {
            testPlanId: options.planId,
            discoveredComponentId: options.componentId,
            testComponentId: options.testId,
            status: options.status,
        };
        const results = await getExecutionResults(filters);
        if (results.length === 0) {
            console.log('No test execution results found matching the specified criteria.');
            return;
        }
        // Format the data for table display
        const formattedResults = results.map(r => ({
            'Test Plan ID': r.testPlanId,
            'Component Name': r.componentName || 'N/A',
            'Test Name': r.testComponentName || r.testComponentId,
            'Status': r.status === 'SUCCESS' ? '✅ SUCCESS' : '❌ FAILURE',
            'Executed At': new Date(r.executedAt).toLocaleString(),
            'Log': r.log ? 'Yes' : 'No', // Provide a simple indicator for logs
        }));
        console.table(formattedResults);
    }
    catch (error) {
        handleCliError(error);
    }
});
