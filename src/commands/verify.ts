/**
 * @famgia/omnify-cli - Verify Command
 *
 * Verifies version chain integrity and schema file states.
 * ブロックチェーンの整合性とスキーマファイルの状態を検証
 */

import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { Command } from 'commander';
import { OmnifyError } from '@famgia/omnify-core';
import {
  VERSION_CHAIN_FILE,
  readVersionChain,
  verifyChain,
  getChainSummary,
  getLockedSchemas,
} from '@famgia/omnify-atlas';
import { loadConfig, validateConfig } from '../config/loader.js';
import { logger } from '../output/logger.js';

/**
 * Verify command options.
 */
interface VerifyCommandOptions {
  verbose?: boolean;
  showAll?: boolean;
  json?: boolean;
}

/**
 * Runs the verify command.
 */
export async function runVerify(options: VerifyCommandOptions): Promise<void> {
  logger.setVerbose(options.verbose ?? false);

  if (!options.json) {
    logger.header('Verify Version Chain');
  }

  // Load configuration
  logger.debug('Loading configuration...');
  const { config, configPath } = await loadConfig();
  const rootDir = configPath ? dirname(configPath) : process.cwd();

  // Validate config
  validateConfig(config, rootDir);

  // Resolve paths
  const schemasDir = resolve(rootDir, config.schemasDir);
  const chainFilePath = resolve(rootDir, VERSION_CHAIN_FILE);

  // Check if chain file exists
  if (!existsSync(chainFilePath)) {
    if (options.json) {
      console.log(JSON.stringify({
        valid: true,
        message: 'No version chain exists yet',
        blockCount: 0,
        schemaCount: 0,
      }, null, 2));
      return;
    }

    logger.info('No version chain exists yet.');
    logger.info('Run "npx omnify deploy" to create the first version lock.');
    return;
  }

  // Load chain
  const chain = await readVersionChain(chainFilePath);
  if (!chain) {
    throw new OmnifyError(
      'Failed to read version chain file',
      'E406',
      undefined,
      `Check if ${VERSION_CHAIN_FILE} is valid JSON.`
    );
  }

  // Get chain summary
  const summary = getChainSummary(chain);

  if (!options.json) {
    logger.step('Chain Summary');
    logger.info(`  Blocks:       ${summary.blockCount}`);
    logger.info(`  Schemas:      ${summary.schemaCount}`);
    logger.info(`  First Lock:   ${summary.firstVersion ?? 'N/A'}`);
    logger.info(`  Latest Lock:  ${summary.latestVersion ?? 'N/A'}`);
    logger.info(`  Environments: ${summary.environments.join(', ') || 'N/A'}`);
    logger.newline();
  }

  // Verify chain integrity
  if (!options.json) {
    logger.step('Verifying chain integrity...');
  }

  const verification = await verifyChain(chain, schemasDir);

  // JSON output
  if (options.json) {
    console.log(JSON.stringify({
      valid: verification.valid,
      blockCount: verification.blockCount,
      verifiedBlocks: verification.verifiedBlocks,
      corruptedBlocks: verification.corruptedBlocks,
      tamperedSchemas: verification.tamperedSchemas,
      deletedLockedSchemas: verification.deletedLockedSchemas,
      summary,
    }, null, 2));

    if (!verification.valid) {
      process.exit(1);
    }
    return;
  }

  // Detailed output
  if (verification.valid) {
    logger.success('✓ Chain integrity verified');
    logger.success(`✓ All ${verification.blockCount} block(s) valid`);
    logger.success('✓ No tampered or deleted locked schemas');
    logger.newline();

    // Show locked schemas if --show-all
    if (options.showAll) {
      const lockedSchemas = getLockedSchemas(chain);
      logger.step('Locked Schemas');
      for (const [name, info] of lockedSchemas) {
        logger.info(`  • ${name}`);
        logger.debug(`    Path:    ${info.relativePath}`);
        logger.debug(`    Hash:    ${info.hash.substring(0, 16)}...`);
        logger.debug(`    Version: ${info.version}`);
      }
    }
  } else {
    logger.error('✗ Chain integrity verification FAILED');
    logger.newline();

    let exitCode = 0;

    // Corrupted blocks
    if (verification.corruptedBlocks.length > 0) {
      logger.error('Corrupted Blocks:');
      for (const block of verification.corruptedBlocks) {
        logger.error(`  ✗ ${block.version}`);
        logger.error(`    Reason: ${block.reason}`);
        logger.error(`    Expected: ${block.expectedHash.substring(0, 16)}...`);
        logger.error(`    Actual:   ${block.actualHash.substring(0, 16)}...`);
      }
      logger.newline();
      exitCode = 1;
    }

    // Tampered schemas
    if (verification.tamperedSchemas.length > 0) {
      logger.error('Tampered Schemas (modified since lock):');
      for (const schema of verification.tamperedSchemas) {
        logger.error(`  ✗ ${schema.schemaName}`);
        logger.error(`    File:      ${schema.filePath}`);
        logger.error(`    Locked in: ${schema.lockedInVersion}`);
        logger.error(`    Locked:    ${schema.lockedHash.substring(0, 16)}...`);
        logger.error(`    Current:   ${schema.currentHash.substring(0, 16)}...`);
      }
      logger.newline();
      exitCode = 1;
    }

    // Deleted locked schemas
    if (verification.deletedLockedSchemas.length > 0) {
      logger.error('Deleted Locked Schemas:');
      for (const schema of verification.deletedLockedSchemas) {
        logger.error(`  ✗ ${schema.schemaName}`);
        logger.error(`    File:      ${schema.filePath}`);
        logger.error(`    Locked in: ${schema.lockedInVersion}`);
        logger.error(`    Hash:      ${schema.lockedHash.substring(0, 16)}...`);
      }
      logger.newline();
      exitCode = 1;
    }

    // Help text
    logger.newline();
    logger.warn('How to fix:');
    logger.warn('  1. Restore deleted files from git or backup');
    logger.warn('  2. Revert modified files to their locked state');
    logger.warn('  3. Do NOT modify the .omnify.chain file');
    logger.newline();

    process.exit(exitCode);
  }
}

/**
 * Registers the verify command.
 */
export function registerVerifyCommand(program: Command): void {
  program
    .command('verify')
    .description('Verify version chain integrity and schema states')
    .option('-v, --verbose', 'Show detailed output')
    .option('-a, --show-all', 'Show all locked schemas')
    .option('--json', 'Output result as JSON')
    .action(async (options: VerifyCommandOptions) => {
      try {
        await runVerify(options);
      } catch (error) {
        if (error instanceof OmnifyError) {
          if (options.json) {
            console.log(JSON.stringify({
              valid: false,
              error: error.message,
            }, null, 2));
          } else {
            logger.formatError(error);
          }
          process.exit(logger.getExitCode(error));
        } else if (error instanceof Error) {
          if (options.json) {
            console.log(JSON.stringify({
              valid: false,
              error: error.message,
            }, null, 2));
          } else {
            logger.error(error.message);
          }
          process.exit(1);
        }
        process.exit(1);
      }
    });
}
