// src/cli/commands/discover.ts

import type { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { initiateDiscovery, pollForPlanCompletion, PlanFailedError } from '../api_client.js';
import type { CliDiscoveredComponent } from '../types.js';

export function registerDiscoverCommand(program: Command) {
  program
    .command('discover')
    .description('Discover all component dependencies and their test coverage.')
    .requiredOption('-c, --componentId <id>', 'The root Boomi Component ID')
    .action(async (options) => {
      const spinner = ora('Initiating discovery...').start();

      try {
        // 1. Initiate the discovery process
        const { planId } = await initiateDiscovery(options.componentId);
        spinner.text = `Discovery started with Plan ID: ${chalk.cyan(planId)}. Waiting for completion...`;

        // 2. Poll for the final results
        const finalPlan = await pollForPlanCompletion(planId);
        spinner.succeed(chalk.green('Discovery complete!'));

        // 3. Display the results in a user-friendly table
        console.log(`\nTest Plan ID: ${chalk.cyan(planId)}`);

        const displayData = finalPlan.discoveredComponents.map((comp: CliDiscoveredComponent) => ({
          'Component ID': comp.component_id,
          'Has Test Coverage': comp.mapped_test_id ? '✅ Yes' : '❌ No',
          'Test Component ID': comp.mapped_test_id || 'N/A',
        }));

        console.table(displayData);
        console.log(chalk.yellow(`\nTo execute tests, use the 'execute' command with the Plan ID.`));

      } catch (error: any) {
        spinner.fail(chalk.red('Discovery failed.'));
        
        // Check if this is our custom error from the API client
        if (error instanceof PlanFailedError) {
          console.error(chalk.red(`Reason: ${error.reason}`));
        } else if (error.code === 'ECONNREFUSED') {
          console.error(chalk.red('Error: Connection refused. Is the backend server running?'));
        } else {
          // For any other unexpected errors
          console.error(chalk.red(error.message));
        }
        process.exit(1);
      }
    });
}