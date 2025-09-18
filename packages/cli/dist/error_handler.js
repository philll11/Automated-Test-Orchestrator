// cli/src/error_handler.ts
import chalk from 'chalk';
import { AxiosError } from 'axios';
/**
 * A private utility to inspect an error object and create a user-friendly,
 * formatted string message. This function does NOT exit the process.
 *
 * @param error The error object.
 * @returns A formatted error string.
 */
function formatCliErrorMessage(error) {
    if (error instanceof AxiosError) {
        if (error.code === 'ECONNREFUSED') {
            return `❌ Error: Connection refused. Backend server is not responding.`;
        }
        else if (error.response) {
            const status = error.response.status;
            const message = error.response.data?.metadata?.message || 'No additional details provided.';
            return `❌ API Error (Status ${status}): ${message}`;
        }
        else {
            return `❌ Network Error: An unexpected network error occurred. Details: ${error.message}`;
        }
    }
    else if (error instanceof Error) {
        return `❌ An unexpected error occurred: ${error.message}`;
    }
    else {
        return `❌ An unknown, unexpected error occurred.`;
    }
}
/**
 * A centralized, TERMINATING error handler for all CLI commands. It inspects the error,
 * prints a user-friendly message, and then exits the process.
 * Its signature remains unchanged.
 *
 * @param error The error object caught by the command.
 */
export function handleCliError(error) {
    const errorMessage = formatCliErrorMessage(error);
    console.error(chalk.red(`\n${errorMessage}`));
    process.exit(1);
}
/**
 * A non-terminating error formatter specifically for use in loops or scenarios
 * where the process should continue after an error.
 * It is now just a public alias for our internal formatting utility.
 *
 * @param error The error object.
 * @returns A formatted error string.
 */
export function formatError(error) {
    return formatCliErrorMessage(error);
}
