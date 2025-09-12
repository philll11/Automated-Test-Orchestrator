import type { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { initiateExecution, pollForExecutionCompletion, PlanFailedError } from '../api_client.js';
import type { CliDiscoveredComponent } from '../types.js';

export function registerExecuteCommand(program: Command) {
  program
    .command('execute')
    .description('Execute a selected set of tests from a Test Plan.')
    .requiredOption('-p, --planId <id>', 'The Test Plan ID from the discovery phase')
    .requiredOption('-t, --tests <ids>', 'A comma-separated list of test component IDs to run')
    .action(async (options) => {
      const testsToRun = options.tests.split(',').map((id: string) => id.trim()).filter(Boolean);
      if (testsToRun.length === 0) {
        console.error(chalk.red('Error: You must provide at least one test component ID.'));
        process.exit(1);
      }

      const spinner = ora(`Initiating execution for Plan ID: ${chalk.cyan(options.planId)}...`).start();

      try {
        // 1. Initiate the execution
        await initiateExecution(options.planId, testsToRun);
        spinner.text = `Execution in progress. Waiting for results...`;

        // 2. Poll for completion
        const finalPlan = await pollForExecutionCompletion(options.planId);
        spinner.succeed(chalk.green('Execution complete!'));

        // 3. Render the Jest-like report
        console.log('\n--- Test Execution Report ---');
        let failures = 0;

        finalPlan.discoveredComponents.forEach((comp: CliDiscoveredComponent) => {
          // Only report on tests that were actually part of this execution run
          if (comp.execution_status) {
            if (comp.execution_status === 'SUCCESS') {
              console.log(`${chalk.green('PASS')} ${comp.component_name || comp.component_id}`);
            } else if (comp.execution_status === 'FAILURE') {
              failures++;
              console.log(`${chalk.red('FAIL')} ${comp.component_name || comp.component_id}`);
              // Indent and print the log for failures
              if (comp.execution_log) {
                const indentedLog = comp.execution_log.split('\n').map((line: string) => `  > ${line}`).join('\n');
                console.log(chalk.gray(indentedLog));
              }
            }
          }
        });

        console.log('\n--- Summary ---');
        const executedCount = finalPlan.discoveredComponents.filter((c: any) => c.execution_status).length;
        const successCount = executedCount - failures;

        if (failures > 0) {
          console.log(chalk.red(`${failures} test(s) failed.`));
        }
        console.log(chalk.green(`${successCount} test(s) passed.`));
        console.log(`Total tests executed: ${executedCount}`);

      } catch (error: any) {
        spinner.fail(chalk.red('Execution failed.'));

        // Check for our custom error from the API client
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