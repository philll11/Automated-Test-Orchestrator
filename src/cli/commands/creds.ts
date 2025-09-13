// src/cli/commands/creds.ts

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { SecureCredentialService } from '../../infrastructure/secure_credential_service.js';
import { IntegrationPlatformCredentials } from '../../domain/integration_platform_credentials.js';

async function addCredentialCommand(profile: string): Promise<void> {
    console.log(`Adding new credentials for profile: ${profile}`);

    try {
        const answers = await _promptForCredentials();
        const credentialService = new SecureCredentialService();
        await credentialService.addCredentials(profile, answers);
        console.log(`✅ Profile "${profile}" has been saved securely.`);

    } catch (error: any) {
        if (error.name === 'ExitPromptError') {
            console.log('\n👋 Add command cancelled by user.');
            process.exit(0);
        } else {
            console.error('\n❌ An unexpected error occurred:', error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    }
}

async function listCredentialsCommand(): Promise<void> {
    try {
        const credentialService = new SecureCredentialService();
        const profiles = await credentialService.getAllCredentials();

        if (profiles.length === 0) {
            console.log(chalk.yellow('No credential profiles found. Use "ato creds add <profile>" to add one.'));
            return;
        }

        console.log(chalk.green('Saved Credential Profiles:'));

        const displayData = profiles.map(p => ({
            'Profile Name': p.profileName,
            'Account ID': p.credentials.accountId,
            'Username': p.credentials.username,
            'Atom ID': p.credentials.executionInstanceId,
        }));

        console.table(displayData);

    } catch (error) {
        console.error('❌ Error listing credentials:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

async function deleteCredentialCommand(profile: string): Promise<void> {
    try {
        const credentialService = new SecureCredentialService();
        const success = await credentialService.deleteCredentials(profile);

        if (success) {
            console.log(chalk.green(`✅ Profile "${profile}" was successfully deleted.`));
        } else {
            console.error(chalk.red(`❌ Error: Profile "${profile}" not found.`));
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Error deleting credentials:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

function _promptForCredentials(): Promise<IntegrationPlatformCredentials> {
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