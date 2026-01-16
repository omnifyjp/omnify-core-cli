/**
 * @famgia/omnify-cli - CLI Runner
 * This file contains the actual CLI execution logic.
 * Import this file to run the CLI (has side effects).
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import { OmnifyError } from '@famgia/omnify-core';
import {
  registerInitCommand,
  registerValidateCommand,
  registerDiffCommand,
  registerGenerateCommand,
  registerResetCommand,
  registerCreateProjectCommand,
  registerDeployCommand,
  registerVerifyCommand,
  runInit,
} from './commands/index.js';
import { logger } from './output/logger.js';

/**
 * CLI version (from package.json)
 */
const VERSION = '0.0.5';

/**
 * Main CLI program.
 */
const program = new Command();

program
  .name('omnify')
  .description('Schema-first database migrations for Laravel and TypeScript')
  .version(VERSION);

// Register commands
registerInitCommand(program);
registerValidateCommand(program);
registerDiffCommand(program);
registerGenerateCommand(program);
registerResetCommand(program);
registerCreateProjectCommand(program);
registerDeployCommand(program);
registerVerifyCommand(program);

// Global error handling
process.on('uncaughtException', (error) => {
  if (error instanceof OmnifyError) {
    logger.formatError(error);
    process.exit(logger.getExitCode(error));
  } else {
    logger.error(error.message);
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  if (reason instanceof OmnifyError) {
    logger.formatError(reason);
    process.exit(logger.getExitCode(reason));
  } else if (reason instanceof Error) {
    logger.error(reason.message);
  } else {
    logger.error(String(reason));
  }
  process.exit(1);
});

// Check if we should auto-run init
const args = process.argv.slice(2);
const firstArg = args[0];
const hasCommand = firstArg !== undefined && !firstArg.startsWith('-');
const configPath = resolve(process.cwd(), 'omnify.config.ts');
const hasConfig = existsSync(configPath);

if (!hasCommand && !hasConfig) {
  // No command specified and no config exists → run init
  runInit({}).catch((error) => {
    if (error instanceof Error) {
      if (error.message.includes('User force closed')) {
        logger.newline();
        logger.info('Setup cancelled.');
        process.exit(0);
      }
      logger.error(error.message);
    }
    process.exit(1);
  });
} else {
  // Parse CLI arguments normally
  program.parse();
}
