// src/cli/commands/discover.ts

import type { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { initiateDiscovery, pollForPlanCompletion } from '../api_client.js';

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

        const displayData = finalPlan.discoveredComponents.map((comp: any) => ({
          'Component ID': comp.componentId,
          'Has Test Coverage': comp.hasTestCoverage ? '✅ Yes' : '❌ No',
          'Test Component ID': comp.testComponentId || 'N/A',
        }));

        console.table(displayData);
        console.log(chalk.yellow(`\nTo execute tests, use the 'execute' command with the Plan ID.`));

      } catch (error: any) {
        spinner.fail(chalk.red('Discovery failed.'));
        
        // Provide a more helpful error message for network errors
        if (error.code === 'ECONNREFUSED') {
          console.error(chalk.red('Error: Connection refused. Is the backend server running?'));
        } else {
          console.error(chalk.red(error.message));
        }
        process.exit(1);
      }
    });
}