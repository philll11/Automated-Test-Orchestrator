// src/cli/commands/discover.ts

import type { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { initiateDiscovery, pollForPlanCompletion, PlanFailedError } from '../api_client.js';
import type { CliDiscoveredComponent } from '../types.js';
import { handleCliError } from '../error_handler.js';

export function registerDiscoverCommand(program: Command) {
  program
    .command('discover')
    .description('Discover all component dependencies and their test coverage.')
    .requiredOption('-c, --componentId <id>', 'The root Component ID')
    .requiredOption('--creds <profile>', 'The name of the credential profile to use')
    .action(async (options) => {
      const spinner = ora('Preparing discovery...').start();
      try {
        const { componentId, creds: profileName } = options;
        spinner.text = 'Initiating discovery with backend...';

        const { planId } = await initiateDiscovery(componentId, profileName);
        spinner.text = `Discovery started with Plan ID: ${chalk.cyan(planId)}. Waiting for completion...`;

        const finalPlan = await pollForPlanCompletion(planId);
        spinner.succeed(chalk.green('Discovery complete!'));

        console.log(`\nTest Plan ID: ${chalk.cyan(planId)}`);

        // Renders a table that correctly displays the one-to-many relationship
        const displayData = finalPlan.discoveredComponents.flatMap((comp: CliDiscoveredComponent) => {
          if (comp.availableTests.length === 0) {
            return [{
              'Component ID': comp.componentId,
              'Component Name': comp.componentName || 'N/A',
              'Has Test Coverage': '❌ No',
              'Available Test ID': 'N/A',
            }];
          }
          return comp.availableTests.map(testId => ({
            'Component ID': comp.componentId,
            'Component Name': comp.componentName || 'N/A',
            'Has Test Coverage': '✅ Yes',
            'Available Test ID': testId,
          }));
        });

        console.table(displayData);
        console.log(chalk.yellow(`\nTo execute tests, use the 'execute' command with the Plan ID and desired Test IDs.`));

      } catch (error: any) {
        spinner.fail(chalk.red('Discovery failed.'));
        handleCliError(error);
      }
    });
}