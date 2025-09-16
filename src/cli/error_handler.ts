// src/cli/error_handler.ts

import chalk from 'chalk';
import { AxiosError } from 'axios';

/**
 * A centralized error handler for all CLI commands. It inspects the error
 * and prints a user-friendly, actionable message.
 *
 * @param error The error object caught by the command.
 */
export function handleCliError(error: any): void {
  // Check if it's an Axios error first, as this is the most common case.
  if (error instanceof AxiosError) {
    // 1. Handle network errors where the server is unreachable.
    if (error.code === 'ECONNREFUSED') {
      console.error(chalk.red('\n❌ Error: Connection refused.'));
      console.error(chalk.yellow("Backend server is not responding."));
    }
    // 2. Handle cases where the server *did* respond, but with an error status (4xx, 5xx).
    else if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.metadata?.message || 'No additional details provided.';
      console.error(chalk.red(`\n❌ API Error: The server responded with status ${status}.`));
      console.error(chalk.yellow(`   Reason: ${message}`));
    }
    // 3. Handle other generic Axios errors (e.g., timeouts).
    else {
      console.error(chalk.red('\n❌ Network Error: An unexpected network error occurred.'));
      console.error(chalk.yellow(`   Details: ${error.message}`));
    }
  }
  // 4. Handle any non-Axios, unexpected errors from our own code.
  else {
    console.error(chalk.red('\n❌ An unexpected error occurred in the CLI.'));
    console.error(chalk.yellow(error.message));
  }
  
  process.exit(1);
}