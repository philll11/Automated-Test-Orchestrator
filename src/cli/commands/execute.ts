import type { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { initiateExecution, pollForExecutionCompletion, PlanFailedError } from '../api_client.js';
import type { CliDiscoveredComponent } from '../types.js';
import { SecureCredentialService } from '../../infrastructure/secure_credential_service.js';

export function registerExecuteCommand(program: Command) {
  program
    .command('execute')
    .description('Execute a selected set of tests from a Test Plan.')
    .requiredOption('-p, --planId <id>', 'The Test Plan ID from the discovery phase')
    .requiredOption('-t, --tests <ids>', 'A comma-separated list of test component IDs to run')
    .requiredOption('--creds <profile>', 'The name of the credential profile to use')
    .action(async (options) => {
      const { planId, tests, creds: profileName } = options;
      const testsToRun = tests.split(',').map((id: string) => id.trim()).filter(Boolean);

      if (testsToRun.length === 0) {
        console.error(chalk.red('Error: You must provide at least one test component ID.'));
        process.exit(1);
      }

      const spinner = ora('Preparing execution...').start();
      try {
        // 1. Retrieve secure credentials
        spinner.text = `Loading credentials for profile: ${chalk.cyan(profileName)}`;
        const credentialService = new SecureCredentialService();
        const credentials = await credentialService.getCredentials(profileName);

        if (!credentials) {
          throw new Error(`Credentials for profile "${profileName}" not found. Please add them using 'ato creds add ${profileName}'.`);
        }

        // 2. Initiate the execution
        spinner.text = `Initiating execution for Plan ID: ${chalk.cyan(planId)}...`;
        await initiateExecution(planId, testsToRun, credentials);
        spinner.text = 'Execution in progress. Waiting for results...';

        // 3. Poll for completion
        const finalPlan = await pollForExecutionCompletion(planId);
        spinner.succeed(chalk.green('Execution complete!'));

        // 4. Render the Jest-like report
        console.log('\n--- Test Execution Report ---');
        let failures = 0;

        finalPlan.discoveredComponents.forEach((comp: CliDiscoveredComponent) => {
          // Only report on tests that were actually part of this execution run
          if (comp.executionStatus) {
            if (comp.executionStatus === 'SUCCESS') {
              console.log(`${chalk.green('PASS')} ${comp.componentName || comp.componentId}`);
            } else if (comp.executionStatus === 'FAILURE') {
              failures++;
              console.log(`${chalk.red('FAIL')} ${comp.componentName || comp.componentId}`);
              // Indent and print the log for failures
              if (comp.executionLog) {
                const indentedLog = comp.executionLog.split('\n').map((line: string) => `  > ${line}`).join('\n');
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