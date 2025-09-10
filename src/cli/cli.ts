#!/usr/bin/env node

import { program, Command } from 'commander';
import { registerDiscoverCommand } from './commands/discover.js';
import { registerExecuteCommand } from './commands/execute.js';

program
  .name('ato')
  .description('Automated Test Orchestrator for Boomi')
  .version('1.0.0');

// Register commands
registerDiscoverCommand(program as Command);
registerExecuteCommand(program as Command);

program.parse(process.argv);