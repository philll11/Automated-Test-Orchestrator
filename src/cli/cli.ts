#!/usr/bin/env node

import { program, Command } from 'commander';
import { registerDiscoverCommand } from './commands/discover.js';
import { registerExecuteCommand } from './commands/execute.js';
import { credsCommand } from './commands/creds.js';

program
  .name('ato')
  .description('Automated Test Orchestrator')
  .version('1.0.0');

// Register commands
registerDiscoverCommand(program as Command);
registerExecuteCommand(program as Command);
program.addCommand(credsCommand);

program.parse(process.argv);