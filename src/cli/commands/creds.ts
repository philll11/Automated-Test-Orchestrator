// src/cli/commands/creds.ts

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { addCredentialProfile, listCredentialProfiles, deleteCredentialProfile } from '../api_client.js';
import { handleCliError } from '../error_handler.js';

async function addCredentialCommand(profile: string): Promise<void> {
    try {
        console.log(`Adding new credentials for profile: ${chalk.cyan(profile)}`);
        const answers = await _promptForCredentials();
        await addCredentialProfile(profile, answers);
        console.log(`✅ Profile "${profile}" has been saved securely.`);

    } catch (error: any) {
        handleCliError(error);
    }
}

async function listCredentialsCommand(): Promise<void> {
    try {
        const profiles = await listCredentialProfiles();
        if (profiles.length === 0) {
            console.log(chalk.yellow('No credential profiles found. Use "ato creds add <profile>" to add one.'));
            return;
        }

        console.log(chalk.green('Saved Credential Profiles:'));

        const displayData = profiles.map(p => ({
            'Profile Name': p.profileName,
            'Account ID': p.credentials.accountId,
            'Username': p.credentials.username,
            'Execution Instance': p.credentials.executionInstanceId,
        }));

        console.table(displayData);

    } catch (error: any) {
        handleCliError(error);
    }
}

async function deleteCredentialCommand(profile: string): Promise<void> {
    try {
        await deleteCredentialProfile(profile);
        console.log(chalk.green(`✅ Profile "${profile}" was successfully deleted.`));
    } catch (error: any) {
        handleCliError(error);
    }
}

function _promptForCredentials(): Promise<{ [key: string]: any }> {
    return inquirer.prompt([
        {
            type: 'input',
            name: 'accountId',
            message: 'Enter your Integration Platform Account ID:',
            validate: (input: string) => input.trim() !== '' || 'This field cannot be empty.',
        },
        {
            type: 'input',
            name: 'username',
            message: 'Enter your Integration Platform Username:',
            validate: (input: string) => input.trim() !== '' || 'This field cannot be empty.',
        },
        {
            type: 'password',
            name: 'passwordOrToken',
            message: 'Enter your Integration Platform Password or Token:',
            mask: '*',
            validate: (input: string) => input.trim() !== '' || 'This field cannot be empty.',
        },
        {
            type: 'input',
            name: 'executionInstanceId',
            message: 'Enter the ID of the execution instance to use for execution:',
            validate: (input: string) => input.trim() !== '' || 'This field cannot be empty.',
        },
    ]);
}

export const credsCommand = new Command('creds')
    .description('Manage secure credential profiles')
    .addCommand(
        new Command('add')
            .description('Add a new credential profile')
            .argument('<profile>', 'The name of the profile to add (e.g., "dev-account")')
            .action(addCredentialCommand)
    )
    .addCommand(
        new Command('list')
            .description('List all saved credential profiles')
            .action(listCredentialsCommand)
    )
    .addCommand(
        new Command('delete')
            .description('Delete a credential profile')
            .argument('<profile>', 'The name of the profile to delete')
            .action(deleteCredentialCommand)
    );