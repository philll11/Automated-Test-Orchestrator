#!/usr/bin/env node

import { program, Command } from 'commander';
import { registerDiscoverCommand } from './commands/discover.js';
import { registerExecuteCommand } from './commands/execute.js';
import { credsCommand } from './commands/creds.js';
import { registerMappingsCommand } from './commands/mappings.js';
import { resultsCommand } from './commands/results.js';
import { testPlansCommand } from './commands/test-plans.js';

program
  .name('ato')
  .description('Automated Test Orchestrator')
  .version('1.0.0');

// Register commands
registerDiscoverCommand(program as Command);
program.addCommand(testPlansCommand);
registerExecuteCommand(program as Command);
program.addCommand(resultsCommand);
registerMappingsCommand(program as Command);
program.addCommand(credsCommand);

program.parse(process.argv);