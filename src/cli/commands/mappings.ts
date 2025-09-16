// src/cli/commands/mappings.ts

import { Command } from 'commander';
import chalk from 'chalk';
import { createMapping, getAllMappings, deleteMapping } from '../api_client.js';
import ora from 'ora';
import { handleCliError } from '../error_handler.js';

export function registerMappingsCommand(program: Command) {
    const mappingsCommand = new Command('mappings')
        .description('Manage component-to-test mappings');

    mappingsCommand
        .command('list')
        .description('List all existing test mappings')
        .action(async () => {
            try {
                const mappings = await getAllMappings();
                if (mappings.length === 0) {
                    console.log(chalk.yellow('No mappings found.'));
                    return;
                }
                const displayData = mappings.map(m => ({
                    'Mapping ID': m.id,
                    'Main Component ID': m.mainComponentId,
                    'Test Component ID': m.testComponentId,
                    'Test Name': m.testComponentName || 'N/A',
                }));
                console.table(displayData);
            } catch (error: any) {
                handleCliError(error);
            }
        });

    mappingsCommand
        .command('add')
        .description('Add a new test mapping')
        .requiredOption('--mainId <id>', 'The main component ID')
        .requiredOption('--testId <id>', 'The test component ID')
        .option('--name <name>', 'An optional descriptive name for the test')
        .action(async (options) => {
            const spinner = ora('Adding new mapping...').start();
            try {
                const newMapping = await createMapping({
                    mainComponentId: options.mainId,
                    testComponentId: options.testId,
                    testComponentName: options.name,
                });
                spinner.succeed(chalk.green('Mapping created successfully!'));
                console.log(chalk.cyan(`Mapping ID: ${newMapping.id}`));
            } catch (error: any) {
                spinner.fail(chalk.red('Failed to create mapping.'));
                handleCliError(error);
            }
        });

    mappingsCommand
        .command('rm')
        .description('Remove a test mapping by its unique ID')
        .argument('<mappingId>', 'The unique ID of the mapping to remove')
        .action(async (mappingId) => {
            const spinner = ora(`Removing mapping ${mappingId}...`).start();
            try {
                await deleteMapping(mappingId);
                spinner.succeed(chalk.green('Mapping removed successfully!'));
            } catch (error: any) {
                spinner.fail(chalk.red('Failed to remove mapping.'));
                handleCliError(error);
            }
        });

    program.addCommand(mappingsCommand);
}