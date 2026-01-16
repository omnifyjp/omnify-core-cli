/**
 * @famgia/omnify-cli - Validate Command
 *
 * Validates schema files for syntax and semantic errors.
 */

import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { Command } from 'commander';
import { loadSchemas, mergePartialSchemas, validateSchemas, OmnifyError } from '@famgia/omnify-core';
import { loadConfig, validateConfig } from '../config/loader.js';
import { logger } from '../output/logger.js';

/**
 * Validate command options.
 */
interface ValidateOptions {
  verbose?: boolean;
}

/**
 * Runs the validate command.
 */
export async function runValidate(options: ValidateOptions): Promise<void> {
  logger.setVerbose(options.verbose ?? false);

  logger.header('Validating Schemas');

  // Load configuration
  logger.debug('Loading configuration...');
  logger.timing('Config load start');
  const { config, configPath } = await loadConfig();
  logger.timing('Config loaded');

  const rootDir = configPath ? dirname(configPath) : process.cwd();

  // Validate config (checks schema directory exists)
  validateConfig(config, rootDir);

  // Load schemas from main directory
  const schemaPath = resolve(rootDir, config.schemasDir);
  logger.step(`Loading schemas from ${schemaPath}`);
  logger.timing('Schema load start');

  let schemas = await loadSchemas(schemaPath);
  logger.debug(`Found ${Object.keys(schemas).length} schema(s) in main directory`);

  // Load additional schemas from config
  const additionalPaths = config.additionalSchemaPaths ?? [];
  let hasPackageSchemas = false;

  if (additionalPaths.length > 0) {
    logger.step(`Loading schemas from ${additionalPaths.length} additional path(s)`);
    for (const entry of additionalPaths) {
      const absolutePath = resolve(rootDir, entry.path);
      logger.debug(`  Checking: ${entry.path} → ${absolutePath}`);

      if (existsSync(absolutePath)) {
        const packageSchemas = await loadSchemas(absolutePath, { skipPartialResolution: true });
        const count = Object.keys(packageSchemas).filter(k => !k.startsWith('__partial__')).length;
        const partialCount = Object.keys(packageSchemas).filter(k => k.startsWith('__partial__')).length;
        const nsInfo = entry.namespace ? ` [${entry.namespace}]` : '';
        logger.info(`  • ${entry.path}${nsInfo}: ${count} schema(s)${partialCount > 0 ? ` + ${partialCount} partial(s)` : ''}`);
        schemas = { ...packageSchemas, ...schemas };
        hasPackageSchemas = true;
      } else {
        logger.warn(`  • ${entry.path}: directory not found (skipped)`);
      }
    }
  }

  // Resolve partial schemas from packages
  if (hasPackageSchemas) {
    schemas = mergePartialSchemas(schemas);
  }

  logger.timing('Schemas loaded');
  const schemaCount = Object.keys(schemas).length;

  if (schemaCount === 0) {
    logger.warn('No schema files found');
    return;
  }

  logger.debug(`Total: ${schemaCount} schema(s)`);

  // Validate schemas
  logger.step('Validating schemas...');
  logger.timing('Validation start');

  const result = validateSchemas(schemas);
  logger.timing('Validation complete');

  if (result.valid) {
    logger.success(`All ${schemaCount} schema(s) are valid`);
  } else {
    logger.error(`Found ${result.errors.length} validation error(s)`);
    logger.newline();

    for (const error of result.errors) {
      const omnifyError = OmnifyError.fromInfo(error);
      logger.formatError(omnifyError);
      logger.newline();
    }

    process.exit(2);
  }
}

/**
 * Registers the validate command.
 */
export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('Validate schema files')
    .option('-v, --verbose', 'Show detailed output')
    .action(async (options: ValidateOptions) => {
      try {
        await runValidate(options);
      } catch (error) {
        if (error instanceof OmnifyError) {
          logger.formatError(error);
          process.exit(logger.getExitCode(error));
        } else if (error instanceof Error) {
          logger.error(error.message);
          process.exit(1);
        }
        process.exit(1);
      }
    });
}
