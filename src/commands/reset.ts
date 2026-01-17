/**
 * @famgia/omnify-cli - Reset Command
 *
 * Cleans up generated files: OmnifyBase models, migrations, and lock files.
 */

import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import type { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { logger } from '../output/logger.js';

/**
 * Reset command options.
 */
interface ResetOptions {
  verbose?: boolean;
  yes?: boolean;
}

/**
 * Prompts user for confirmation.
 */
async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Recursively counts files in a directory.
 */
function countFiles(dir: string): number {
  if (!existsSync(dir)) return 0;

  let count = 0;
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      count += countFiles(fullPath);
    } else {
      count++;
    }
  }

  return count;
}

/**
 * Recursively deletes a directory.
 */
function deleteDir(dir: string, verbose: boolean): number {
  if (!existsSync(dir)) return 0;

  const count = countFiles(dir);
  rmSync(dir, { recursive: true, force: true });

  if (verbose) {
    logger.debug(`Deleted: ${dir}`);
  }

  return count;
}

/**
 * Deletes files matching a pattern in a directory.
 */
function deleteFilesInDir(dir: string, pattern: RegExp, verbose: boolean): number {
  if (!existsSync(dir)) return 0;

  let count = 0;
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isFile() && pattern.test(entry)) {
      rmSync(fullPath);
      if (verbose) {
        logger.debug(`Deleted: ${fullPath}`);
      }
      count++;
    }
  }

  return count;
}

/**
 * Runs the reset command.
 */
export async function runReset(options: ResetOptions): Promise<void> {
  logger.setVerbose(options.verbose ?? false);

  logger.header('Reset Omnify Generated Files');

  // Load configuration
  logger.debug('Loading configuration...');
  const { config, configPath } = await loadConfig();
  const rootDir = configPath ? dirname(configPath) : process.cwd();

  // Determine paths to clean
  const paths: { name: string; path: string; type: 'dir' | 'file' | 'files'; pattern?: RegExp }[] = [];

  // Common OmnifyBase locations (check both with and without backend prefix)
  // Also check legacy 'Generated' paths for cleanup
  const omnifyBasePaths = [
    { name: 'OmnifyBase models', paths: ['app/Models/OmnifyBase', 'backend/app/Models/OmnifyBase'] },
    { name: 'OmnifyBase requests', paths: ['app/Http/Requests/OmnifyBase', 'backend/app/Http/Requests/OmnifyBase'] },
    { name: 'OmnifyBase resources', paths: ['app/Http/Resources/OmnifyBase', 'backend/app/Http/Resources/OmnifyBase'] },
  ];

  // Legacy 'Generated' paths (for cleanup of old installations)
  const legacyGeneratedPaths = [
    { name: 'Legacy Generated models', paths: ['app/Models/Generated', 'backend/app/Models/Generated'] },
    { name: 'Legacy Generated requests', paths: ['app/Http/Requests/Generated', 'backend/app/Http/Requests/Generated'] },
    { name: 'Legacy Generated resources', paths: ['app/Http/Resources/Generated', 'backend/app/Http/Resources/Generated'] },
  ];

  for (const { name, paths: relPaths } of omnifyBasePaths) {
    for (const relPath of relPaths) {
      const omnifyBasePath = resolve(rootDir, relPath);
      if (existsSync(omnifyBasePath)) {
        paths.push({ name, path: omnifyBasePath, type: 'dir' });
        break; // Only add the first match for each type
      }
    }
  }

  // Clean up legacy Generated paths
  for (const { name, paths: relPaths } of legacyGeneratedPaths) {
    for (const relPath of relPaths) {
      const legacyPath = resolve(rootDir, relPath);
      if (existsSync(legacyPath)) {
        paths.push({ name, path: legacyPath, type: 'dir' });
        break;
      }
    }
  }

  // Common migration locations
  const migrationPaths = [
    'database/migrations/omnify',
    'backend/database/migrations/omnify',
  ];

  for (const relPath of migrationPaths) {
    const migrationsPath = resolve(rootDir, relPath);
    if (existsSync(migrationsPath)) {
      paths.push({
        name: 'Omnify migrations',
        path: migrationsPath,
        type: 'files',
        pattern: /\.php$/,
      });
      break; // Only add the first match
    }
  }

  // Also check config.output.laravel if available
  const laravelConfig = config.output.laravel;
  if (laravelConfig?.modelsPath) {
    const modelsPath = resolve(rootDir, laravelConfig.modelsPath);
    const omnifyBasePath = join(modelsPath, 'OmnifyBase');
    if (existsSync(omnifyBasePath) && !paths.some(p => p.path === omnifyBasePath)) {
      paths.push({ name: 'OmnifyBase models', path: omnifyBasePath, type: 'dir' });
    }
  }

  if (laravelConfig?.migrationsPath) {
    const migrationsPath = resolve(rootDir, laravelConfig.migrationsPath);
    if (existsSync(migrationsPath) && !paths.some(p => p.path === migrationsPath)) {
      paths.push({
        name: 'Omnify migrations',
        path: migrationsPath,
        type: 'files',
        pattern: /\.php$/,
      });
    }
  }

  // Clean up package directories from additionalSchemaPaths
  if (config.additionalSchemaPaths) {
    for (const additionalPath of config.additionalSchemaPaths) {
      const pkgOutput = additionalPath.output?.laravel;
      if (pkgOutput?.base) {
        const pkgBase = resolve(rootDir, pkgOutput.base);
        const pkgName = additionalPath.namespace ?? 'Package';

        // OmnifyBase models in package
        const pkgOmnifyBase = join(pkgBase, pkgOutput.baseModelsPath ?? 'src/Models/OmnifyBase');
        if (existsSync(pkgOmnifyBase) && !paths.some(p => p.path === pkgOmnifyBase)) {
          paths.push({ name: `${pkgName} OmnifyBase`, path: pkgOmnifyBase, type: 'dir' });
        }

        // Legacy Generated models in package
        const pkgGenerated = join(pkgBase, 'src/Models/Generated');
        if (existsSync(pkgGenerated) && !paths.some(p => p.path === pkgGenerated)) {
          paths.push({ name: `${pkgName} Legacy Generated`, path: pkgGenerated, type: 'dir' });
        }

        // Package migrations - IMPORTANT: Only delete omnify subdirectory, never the entire migrations folder!
        const pkgMigrations = join(pkgBase, pkgOutput.migrationsPath ?? 'database/migrations/omnify');
        if (existsSync(pkgMigrations) && !paths.some(p => p.path === pkgMigrations)) {
          paths.push({
            name: `${pkgName} migrations`,
            path: pkgMigrations,
            type: 'dir',
          });
        }

        // Package providers
        const pkgProviders = join(pkgBase, pkgOutput.providersPath ?? 'src/Providers');
        if (existsSync(pkgProviders) && !paths.some(p => p.path === pkgProviders)) {
          paths.push({ name: `${pkgName} Providers`, path: pkgProviders, type: 'dir' });
        }

        // Package factories
        const pkgFactories = join(pkgBase, pkgOutput.factoriesPath ?? 'database/factories');
        if (existsSync(pkgFactories) && !paths.some(p => p.path === pkgFactories)) {
          paths.push({ name: `${pkgName} Factories`, path: pkgFactories, type: 'dir' });
        }
      }
    }
  }

  // TypeScript types - only delete auto-generated subdirectories, not user-editable files
  // Structure: models/base/* (auto), models/enum/* (auto), models/rules/* (auto)
  // Keep: models/*.ts (user-editable)
  const typescriptPath = config.output.typescript?.path;
  const tsBasePath = typescriptPath ? resolve(rootDir, typescriptPath) : null;

  // Check common TypeScript locations if not in config
  const commonTsPaths = [
    'resources/ts/omnify',
    'resources/ts/omnify/schemas',
    'resources/ts/types/models',
    'frontend/src/types/model',
    'frontend/src/types/models',
    'src/types/models',
  ];

  let foundTsPath = tsBasePath;
  if (!foundTsPath || !existsSync(foundTsPath)) {
    for (const relPath of commonTsPaths) {
      const tsPath = resolve(rootDir, relPath);
      if (existsSync(tsPath)) {
        foundTsPath = tsPath;
        break;
      }
    }
  }

  if (foundTsPath && existsSync(foundTsPath)) {
    // Delete auto-generated subdirectories
    // Note: 'components' is excluded - it may contain custom user components
    const autoGeneratedDirs = ['base', 'enum', 'rules', 'hooks', 'lib'];
    for (const subDir of autoGeneratedDirs) {
      const subPath = join(foundTsPath, subDir);
      if (existsSync(subPath)) {
        paths.push({ name: `TypeScript ${subDir}`, path: subPath, type: 'dir' });
      }
    }
    // Delete auto-generated files at root level
    const autoGeneratedFiles = ['common.ts', 'index.ts', 'i18n.ts'];
    for (const fileName of autoGeneratedFiles) {
      const filePath = join(foundTsPath, fileName);
      if (existsSync(filePath)) {
        paths.push({ name: `TypeScript ${fileName}`, path: filePath, type: 'file' });
      }
    }
  }

  // Lock files
  const lockFilePath = resolve(rootDir, config.lockFilePath);
  if (existsSync(lockFilePath)) {
    paths.push({ name: 'Lock file', path: lockFilePath, type: 'file' });
  }

  // Version history directory (.omnify-versions)
  const versionsDir = resolve(rootDir, '.omnify-versions');
  if (existsSync(versionsDir)) {
    paths.push({ name: 'Version history', path: versionsDir, type: 'dir' });
  }

  // Also check for versions inside .omnify directory (but NOT schemas!)
  const omnifyVersionsDir = resolve(rootDir, '.omnify/versions');
  if (existsSync(omnifyVersionsDir)) {
    paths.push({ name: 'Version history (.omnify/versions)', path: omnifyVersionsDir, type: 'dir' });
  }

  // Logs directory
  const logsDir = resolve(rootDir, '.omnify/logs');
  if (existsSync(logsDir)) {
    paths.push({ name: 'Logs', path: logsDir, type: 'dir' });
  }

  // Check if anything to clean
  if (paths.length === 0) {
    logger.info('Nothing to clean. No generated files found.');
    return;
  }

  // Show what will be deleted
  logger.newline();
  logger.warn('The following will be deleted:');
  logger.newline();

  for (const item of paths) {
    if (item.type === 'dir') {
      const count = countFiles(item.path);
      logger.info(`  • ${item.name}: ${item.path} (${count} files)`);
    } else if (item.type === 'files' && item.pattern) {
      const count = readdirSync(item.path).filter((f) => item.pattern!.test(f)).length;
      logger.info(`  • ${item.name}: ${item.path} (${count} files)`);
    } else {
      logger.info(`  • ${item.name}: ${item.path}`);
    }
  }

  logger.newline();

  // Ask for confirmation
  if (!options.yes) {
    const confirmed = await confirm('Are you sure you want to delete these files?');
    if (!confirmed) {
      logger.info('Reset cancelled.');
      return;
    }
  }

  logger.newline();
  logger.step('Deleting files...');

  // Delete files
  let totalDeleted = 0;

  for (const item of paths) {
    if (item.type === 'dir') {
      const count = deleteDir(item.path, options.verbose ?? false);
      totalDeleted += count;
      logger.info(`  ✓ Deleted ${item.name} (${count} files)`);
    } else if (item.type === 'files' && item.pattern) {
      const count = deleteFilesInDir(item.path, item.pattern, options.verbose ?? false);
      totalDeleted += count;
      logger.info(`  ✓ Deleted ${item.name} (${count} files)`);
    } else {
      rmSync(item.path, { force: true });
      if (options.verbose) {
        logger.debug(`Deleted: ${item.path}`);
      }
      totalDeleted++;
      logger.info(`  ✓ Deleted ${item.name}`);
    }
  }

  logger.newline();
  logger.success(`Reset complete! Deleted ${totalDeleted} file(s).`);
  logger.newline();
  logger.info('Run `omnify generate` to regenerate files.');
}

/**
 * Registers the reset command.
 */
export function registerResetCommand(program: Command): void {
  program
    .command('reset')
    .description('Delete all generated files (OmnifyBase, migrations, locks)')
    .option('-v, --verbose', 'Show detailed output')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (options: ResetOptions) => {
      try {
        await runReset(options);
      } catch (error) {
        if (error instanceof Error) {
          logger.error(error.message);
          process.exit(1);
        }
        process.exit(1);
      }
    });
}
