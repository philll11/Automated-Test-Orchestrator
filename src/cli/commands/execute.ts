// src/cli/commands/execute.ts

import type { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { initiateExecution, pollForExecutionCompletion } from '../api_client.js';
import { handleCliError } from '../error_handler.js';

export function registerExecuteCommand(program: Command) {
  program
    .command('execute')
    .description('Execute a selected set of tests from a Test Plan.')
    .requiredOption('-p, --planId <id>', 'The Test Plan ID from the discovery phase')
    .option('-t, --tests <ids>', 'A comma-separated list of specific test component IDs to run. Leave empty to run all tests in the plan.')
    .requiredOption('--creds <profile>', 'The name of the credential profile to use')
    .action(async (options) => {
      const { planId, tests, creds: profileName } = options;

      let testsToRun: string[] | undefined = undefined;
      if (tests) {
        testsToRun = tests.split(',').map((id: string) => id.trim()).filter(Boolean);
        if (testsToRun && testsToRun.length === 0) {
          console.error(chalk.red('Error: If using the --tests flag, you must provide at least one test component ID.'));
          process.exit(1);
        }
      }

      const spinner = ora('Preparing execution...').start();
      try {

        const executionMessage = testsToRun ? `selected tests for Plan ID: ${chalk.cyan(planId)}...` : `all available tests for Plan ID: ${chalk.cyan(planId)}...`;
        spinner.text = `Initiating execution for ${executionMessage}`;

        // Pass the potentially undefined 'testsToRun' array to the API client
        await initiateExecution(planId, testsToRun, profileName);
        spinner.text = 'Execution in progress. Waiting for results...';

        const finalPlan = await pollForExecutionCompletion(planId);
        spinner.succeed(chalk.green('Execution complete!'));

        console.log('\n--- Test Execution Report ---');

        const allResults = finalPlan.planComponents.flatMap(c => c.executionResults);

        if (allResults.length === 0) {
          console.log(chalk.yellow('No tests were executed. Ensure the test IDs provided are correct.'));
          return;
        }

        let failures = 0;
        allResults.forEach(result => {
          if (result.status === 'SUCCESS') {
            console.log(`${chalk.green('PASS')} ${result.testComponentId}`);
          } else {
            failures++;
            console.log(`${chalk.red('FAIL')} ${result.testComponentId}`);
            if (result.log) {
              const indentedLog = result.log.split('\n').map(line => `  > ${line}`).join('\n');
              console.log(chalk.gray(indentedLog));
            }
          }
        });

        console.log('\n--- Summary ---');
        if (failures > 0) console.log(chalk.red(`${failures} test(s) failed.`));
        console.log(chalk.green(`${allResults.length - failures} test(s) passed.`));
        console.log(`Total tests executed: ${allResults.length}`);

      } catch (error: any) {
        spinner.fail(chalk.red('Execution failed.'));
        handleCliError(error);
      }
    });
}