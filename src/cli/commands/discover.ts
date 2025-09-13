// src/cli/commands/discover.ts

import type { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { initiateDiscovery, pollForPlanCompletion, PlanFailedError } from '../api_client.js';
import type { CliDiscoveredComponent } from '../types.js';
import { SecureCredentialService } from '../../infrastructure/secure_credential_service.js';

export function registerDiscoverCommand(program: Command) {
  program
    .command('discover')
    .description('Discover all component dependencies and their test coverage.')
    .requiredOption('-c, --componentId <id>', 'The root Component ID')
    .requiredOption('--creds <profile>', 'The name of the credential profile to use')
    .action(async (options) => {
      const spinner = ora('Preparing discovery...').start();
      const { componentId, creds: profileName } = options;

      try {
        // 1. Retrieve secure credentials
        spinner.text = `Loading credentials for profile: ${chalk.cyan(profileName)}`;
        const credentialService = new SecureCredentialService();
        const credentials = await credentialService.getCredentials(profileName);

        if (!credentials) {
          throw new Error(`Credentials for profile "${profileName}" not found. Please add them using 'ato creds add ${profileName}'.`);
        }

        // 2. Initiate the discovery process
        spinner.text = 'Initiating discovery...';
        const { planId } = await initiateDiscovery(componentId, credentials);
        spinner.text = `Discovery started with Plan ID: ${chalk.cyan(planId)}. Waiting for completion...`;

        // 3. Poll for the final results
        const finalPlan = await pollForPlanCompletion(planId);
        spinner.succeed(chalk.green('Discovery complete!'));

        // 4. Display the results
        console.log(`\nTest Plan ID: ${chalk.cyan(planId)}`);

        const displayData = finalPlan.discoveredComponents.map((comp: CliDiscoveredComponent) => ({
          'Component ID': comp.componentId,
          'Component Name': comp.componentName || 'N/A',
          'Component Type': comp.componentType || 'N/A',
          'Has Test Coverage': comp.mappedTestId ? '✅ Yes' : '❌ No',
          'Test Component ID': comp.mappedTestId || 'N/A',
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