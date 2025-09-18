// cli/src/commands/discover.ts

import type { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { parseComponentIdCsv } from '../csv_parser.js';
import { promises as fs } from 'fs';
import { initiateDiscovery, pollForPlanCompletion, PlanFailedError } from '../api_client.js';
import type { CliPlanComponent } from '../types.js';
import { handleCliError } from '../error_handler.js';

export function registerDiscoverCommand(program: Command) {
  program
    .command('discover')
    .description('Create a new test plan from a list of components.')
    .option('--from-csv <path>', 'Path to a CSV file with a single column of component IDs.')
    .option('--dependencies', 'Discover all dependencies for the provided components.', false)
    .requiredOption('--creds <profile>', 'The name of the credential profile to use')
    .action(async (options) => {
      const spinner = ora('Preparing test plan...').start();
      try {
        const { fromCsv, dependencies, creds: profileName } = options;
        let componentIds: string[] = [];

        if (fromCsv) {
          spinner.text = `Reading components from ${chalk.cyan(fromCsv)}...`;
          try {
            const fileContent = await fs.readFile(fromCsv, 'utf-8');
            componentIds = parseComponentIdCsv(fileContent);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`Failed to read or parse the CSV file at ${fromCsv}: ${message}`);
          }
        } else {
          spinner.stop(); // Stop spinner for interactive prompt
          const responses = [];
          let answer;
          const message = dependencies
            ? 'Enter a root Component ID to discover dependencies from (leave blank to finish):'
            : 'Enter a Component ID to add to the plan (leave blank to finish):';

          do {
            answer = await inquirer.prompt([
              {
                type: 'input',
                name: 'componentId',
                message: message
              }
            ]);
            if (answer.componentId) responses.push(answer.componentId);
          } while (answer.componentId);
          componentIds = responses;
          spinner.start();
        }

        if (componentIds.length === 0) {
          spinner.warn('No component IDs provided. Exiting.');
          return;
        }

        const discoveryMode = dependencies ? 'and all their dependencies' : '...';
        spinner.text = `Creating test plan with ${chalk.bold(componentIds.length)} component(s) ${discoveryMode}`;

        const { planId } = await initiateDiscovery(componentIds, profileName, dependencies);
        spinner.text = `Test plan created with ID: ${chalk.cyan(planId)}. Waiting for component processing to complete...`;

        const finalPlan = await pollForPlanCompletion(planId);
        spinner.succeed(chalk.green('Test plan processing complete!'));

        console.log(`\nTest Plan ID: ${chalk.cyan(planId)}`);

        // Renders a table that correctly displays the one-to-many relationship
        const displayData = finalPlan.planComponents.flatMap((comp: CliPlanComponent) => {
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

        if (displayData.length > 0) {
          console.table(displayData);
        } else {
          console.log(chalk.yellow('No components were found for this test plan.'));
        }

        console.log(chalk.yellow(`\nTo execute tests, use the 'execute' command with the Plan ID and desired Test IDs.`));

      } catch (error: any) {
        spinner.fail(chalk.red('Test plan creation failed.'));
        handleCliError(error);
      }
    });
}