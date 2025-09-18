// cli/src/commands/mappings.ts

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import { createMapping, getAllMappings, deleteMapping } from '../api_client.js';
import { parseMappingCsv } from '../csv_parser.js';
import { handleCliError, formatError } from '../error_handler.js';

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
                    'Test Component Name': m.testComponentName || 'N/A',
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
        .command('import')
        .description('Bulk import mappings from a CSV file')
        .requiredOption('--from-csv <path>', 'Path to a CSV file with `mainComponentId` and `testComponentId` columns')
        .action(async (options) => {
            const spinner = ora('Preparing to import mappings...').start();
            try {
                spinner.text = `Reading and parsing CSV file from ${chalk.cyan(options.fromCsv)}...`;
                const fileContent = await fs.readFile(options.fromCsv, 'utf-8');
                const mappingsToCreate = parseMappingCsv(fileContent);

                if (mappingsToCreate.length === 0) {
                    spinner.warn('No valid mappings found in the CSV file.');
                    return;
                }
                spinner.text = `Found ${chalk.bold(mappingsToCreate.length)} mappings to import.`;

                let successCount = 0;
                let failureCount = 0;

                for (let i = 0; i < mappingsToCreate.length; i++) {
                    const mapping = mappingsToCreate[i];
                    spinner.text = `Importing mapping ${i + 1} of ${mappingsToCreate.length}: ${mapping.mainComponentId} -> ${mapping.testComponentId}`;
                    try {
                        await createMapping(mapping);
                        successCount++;
                    } catch (error: any) {
                        failureCount++;
                        const errorMessage = formatError(error); 
                        spinner.stop();
                        console.error(chalk.red(`\n  Failed to import row ${i + 2}: ${errorMessage}`));
                        spinner.start();
                    }
                }

                spinner.stop();
                console.log(chalk.green('\n--- Import Complete ---'));
                if (successCount > 0) {
                    console.log(chalk.green(`Successfully imported ${successCount} mapping(s).`));
                }
                if (failureCount > 0) {
                    console.log(chalk.red(`Failed to import ${failureCount} mapping(s). See error details above.`));
                }

            } catch (error: any) {
                spinner.fail(chalk.red('A critical error occurred during the import process.'));
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