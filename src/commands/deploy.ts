/**
 * @famgia/omnify-cli - Deploy Command
 *
 * Locks schema version for production deployment using blockchain-like chain.
 * 一度ロックされたスキーマは変更・削除不可能になる
 */

import { existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { Command } from 'commander';
import { loadSchemas, OmnifyError } from '@famgia/omnify-core';
import {
  VERSION_CHAIN_FILE,
  readVersionChain,
  deployVersion,
  getChainSummary,
  verifyChain,
  type DeployOptions,
} from '@famgia/omnify-atlas';
import type { ResolvedOmnifyConfig } from '../config/types.js';
import { loadConfig, validateConfig } from '../config/loader.js';
import { logger } from '../output/logger.js';

/**
 * Deploy command options.
 */
interface DeployCommandOptions {
  verbose?: boolean;
  version?: string;
  environment?: string;
  comment?: string;
  yes?: boolean;
  deployedBy?: string;
  dryRun?: boolean;
}

/**
 * Interactive confirmation prompt.
 * CI環境では--yesフラグを使用
 */
async function confirmDeploy(
  schemaCount: number,
  environment: string,
  version: string
): Promise<boolean> {
  const { createInterface } = await import('node:readline');
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    logger.newline();
    logger.warn('⚠️  WARNING: This action is IRREVERSIBLE!');
    logger.warn('');
    logger.warn(`   Environment: ${environment}`);
    logger.warn(`   Version:     ${version}`);
    logger.warn(`   Schemas:     ${schemaCount} file(s)`);
    logger.warn('');
    logger.warn('   Once locked, these schema files CANNOT be:');
    logger.warn('   • Deleted');
    logger.warn('   • Modified (content hash is recorded)');
    logger.warn('');
    logger.warn('   This creates an immutable blockchain-like record.');
    logger.newline();

    rl.question('   Type "LOCK" to confirm: ', (answer) => {
      rl.close();
      resolve(answer.trim().toUpperCase() === 'LOCK');
    });
  });
}

/**
 * Collects schema files from directory.
 */
async function collectSchemaFiles(
  schemasDir: string
): Promise<{ name: string; relativePath: string; filePath: string }[]> {
  const files: { name: string; relativePath: string; filePath: string }[] = [];

  const schemas = await loadSchemas(schemasDir);

  for (const [name, schema] of Object.entries(schemas)) {
    files.push({
      name,
      relativePath: schema.relativePath,
      filePath: schema.filePath,
    });
  }

  return files;
}

/**
 * Runs the deploy command.
 */
export async function runDeploy(options: DeployCommandOptions): Promise<void> {
  logger.setVerbose(options.verbose ?? false);

  logger.header('Deploy Version Lock');

  // Load configuration
  logger.debug('Loading configuration...');
  const { config, configPath } = await loadConfig();
  const rootDir = configPath ? dirname(configPath) : process.cwd();

  // Validate config
  validateConfig(config, rootDir);

  // Resolve paths
  const schemasDir = resolve(rootDir, config.schemasDir);
  const chainFilePath = resolve(rootDir, VERSION_CHAIN_FILE);

  // Check if schemas directory exists
  if (!existsSync(schemasDir)) {
    throw new OmnifyError(
      `Schemas directory not found: ${schemasDir}`,
      'E003',
      undefined,
      'Make sure the schemasDir in omnify.config.ts is correct.'
    );
  }

  // Collect schema files
  logger.step('Collecting schema files...');
  const schemaFiles = await collectSchemaFiles(schemasDir);

  if (schemaFiles.length === 0) {
    throw new OmnifyError(
      'No schema files found',
      'E003',
      undefined,
      'Create schema files in your schemas directory before deploying.'
    );
  }

  logger.info(`Found ${schemaFiles.length} schema file(s)`);

  // Load existing chain
  const existingChain = await readVersionChain(chainFilePath);
  if (existingChain) {
    const summary = getChainSummary(existingChain);
    logger.debug(`Existing chain: ${summary.blockCount} block(s), ${summary.schemaCount} schema(s)`);

    // Verify chain integrity before adding new block
    logger.step('Verifying chain integrity...');
    const verification = await verifyChain(existingChain, schemasDir);

    if (!verification.valid) {
      logger.error('Chain integrity verification failed!');

      if (verification.corruptedBlocks.length > 0) {
        logger.error('');
        logger.error('Corrupted blocks:');
        for (const block of verification.corruptedBlocks) {
          logger.error(`  • ${block.version}: ${block.reason}`);
        }
      }

      if (verification.tamperedSchemas.length > 0) {
        logger.error('');
        logger.error('Tampered schemas (modified since lock):');
        for (const schema of verification.tamperedSchemas) {
          logger.error(`  • ${schema.schemaName} (locked in ${schema.lockedInVersion})`);
        }
      }

      if (verification.deletedLockedSchemas.length > 0) {
        logger.error('');
        logger.error('Deleted locked schemas:');
        for (const schema of verification.deletedLockedSchemas) {
          logger.error(`  • ${schema.schemaName} (locked in ${schema.lockedInVersion})`);
        }
      }

      throw new OmnifyError(
        'Cannot deploy: chain integrity compromised',
        'E406',
        undefined,
        'Restore deleted/modified files to match the locked state, or contact support.'
      );
    }

    logger.success('Chain integrity verified ✓');
  } else {
    logger.info('Creating new version chain (first deployment)');
  }

  // Determine version and environment
  const environment = options.environment ?? 'production';
  const version = options.version ?? generateVersionFromTimestamp();

  // Dry run mode
  if (options.dryRun) {
    logger.newline();
    logger.info('DRY RUN - No changes will be made');
    logger.info('');
    logger.info(`Would create block:`);
    logger.info(`  Version:     ${version}`);
    logger.info(`  Environment: ${environment}`);
    logger.info(`  Schemas:     ${schemaFiles.length} file(s)`);
    logger.info('');
    for (const file of schemaFiles) {
      logger.info(`    • ${file.name} (${file.relativePath})`);
    }
    return;
  }

  // Confirmation prompt (unless --yes is provided)
  if (!options.yes) {
    const confirmed = await confirmDeploy(schemaFiles.length, environment, version);
    if (!confirmed) {
      logger.newline();
      logger.info('Deployment cancelled.');
      return;
    }
  }

  // Deploy
  logger.step('Creating version lock...');

  const deployOptions: DeployOptions = {
    version,
    environment,
    deployedBy: options.deployedBy ?? process.env.USER ?? 'unknown',
    comment: options.comment,
    skipConfirmation: true,
  };

  const result = await deployVersion(chainFilePath, schemasDir, schemaFiles, deployOptions);

  if (!result.success) {
    throw new OmnifyError(
      result.error ?? 'Deployment failed',
      'E408'
    );
  }

  // Success output
  logger.newline();
  logger.success('🔒 Version locked successfully!');
  logger.newline();

  if (result.block) {
    logger.info(`  Version:     ${result.block.version}`);
    logger.info(`  Block Hash:  ${result.block.blockHash.substring(0, 16)}...`);
    logger.info(`  Locked At:   ${result.block.lockedAt}`);
    logger.info(`  Environment: ${result.block.environment}`);
    logger.info(`  Schemas:     ${result.block.schemas.length} file(s)`);
  }

  if (result.addedSchemas.length > 0) {
    logger.newline();
    logger.info('  New schemas locked:');
    for (const name of result.addedSchemas) {
      logger.info(`    + ${name}`);
    }
  }

  if (result.warnings.length > 0) {
    logger.newline();
    logger.warn('  Warnings:');
    for (const warning of result.warnings) {
      logger.warn(`    ⚠ ${warning}`);
    }
  }

  logger.newline();
  logger.info(`  Chain file: ${VERSION_CHAIN_FILE}`);
  logger.info('  This file should be committed to version control.');
}

/**
 * Generates a version string from current timestamp.
 */
function generateVersionFromTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  return `v${year}.${month}.${day}-${hour}${minute}${second}`;
}

/**
 * Registers the deploy command.
 */
export function registerDeployCommand(program: Command): void {
  program
    .command('deploy')
    .description('Lock schema version for production (blockchain-like immutable record)')
    .option('-v, --verbose', 'Show detailed output')
    .option('--version <version>', 'Version name (e.g., v1.0.0, default: auto-generated)')
    .option('-e, --environment <env>', 'Deployment environment (default: production)', 'production')
    .option('-c, --comment <comment>', 'Deployment comment')
    .option('-y, --yes', 'Skip confirmation prompt (for CI/CD)')
    .option('--deployed-by <name>', 'Deployer name (default: $USER)')
    .option('--dry-run', 'Show what would be locked without making changes')
    .action(async (options: DeployCommandOptions) => {
      try {
        await runDeploy(options);
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
