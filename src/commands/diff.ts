/**
 * @famgia/omnify-cli - Diff Command
 *
 * Shows pending schema changes without generating migrations.
 */

import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { Command } from 'commander';
import { loadSchemas, mergePartialSchemas, validateSchemas, OmnifyError } from '@famgia/omnify-core';
import { loadConfig, validateConfig, requireDevUrl } from '../config/loader.js';
import { logger } from '../output/logger.js';
import { runDiffOperation } from '../operations/diff.js';
import pc from 'picocolors';

/**
 * Diff command options.
 */
interface DiffOptions {
  verbose?: boolean;
  check?: boolean;
}

/**
 * Runs the diff command.
 */
export async function runDiff(options: DiffOptions): Promise<void> {
  logger.setVerbose(options.verbose ?? false);

  logger.header('Checking for Schema Changes');

  // Load configuration
  logger.debug('Loading configuration...');
  const { config, configPath } = await loadConfig();
  const rootDir = configPath ? dirname(configPath) : process.cwd();

  // Validate config and require devUrl for diff
  validateConfig(config, rootDir);
  requireDevUrl(config);

  // Load schemas from main directory
  const schemaPath = resolve(rootDir, config.schemasDir);
  logger.step(`Loading schemas from ${schemaPath}`);

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

  const schemaCount = Object.keys(schemas).length;

  if (schemaCount === 0) {
    logger.warn('No schema files found');
    return;
  }

  logger.debug(`Total: ${schemaCount} schema(s)`);

  // Validate schemas first
  logger.step('Validating schemas...');
  const validationResult = validateSchemas(schemas);

  if (!validationResult.valid) {
    logger.error('Schema validation failed. Fix errors before running diff.');
    for (const error of validationResult.errors) {
      const omnifyError = OmnifyError.fromInfo(error);
      logger.formatError(omnifyError);
    }
    process.exit(2);
  }

  // Run diff operation
  logger.step('Running Atlas diff...');
  const lockPath = resolve(rootDir, config.lockFilePath);

  const diffResult = await runDiffOperation({
    schemas,
    devUrl: config.database.devUrl!,
    lockFilePath: lockPath,
    driver: config.database.driver,
    workDir: rootDir,
  });

  if (!diffResult.hasChanges) {
    logger.success('No changes detected');
    return;
  }

  // Show changes preview
  logger.newline();
  console.log(pc.bold('Changes detected:'));
  console.log();
  console.log(diffResult.formattedPreview);

  if (diffResult.hasDestructiveChanges) {
    logger.newline();
    logger.warn('This preview contains destructive changes. Review carefully.');
  }

  // Check mode: exit with code 1 if changes exist
  if (options.check) {
    logger.newline();
    logger.info('Changes detected (--check mode)');
    process.exit(1);
  }

  logger.newline();
  logger.info('Run "omnify generate" to create migrations');
}

/**
 * Registers the diff command.
 */
export function registerDiffCommand(program: Command): void {
  program
    .command('diff')
    .description('Show pending schema changes')
    .option('-v, --verbose', 'Show detailed output')
    .option('--check', 'Exit with code 1 if changes exist (for CI)')
    .action(async (options: DiffOptions) => {
      try {
        await runDiff(options);
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
