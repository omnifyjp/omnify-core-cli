/**
 * @famgia/omnify-cli - Init Command
 *
 * Initializes a new omnify project with interactive configuration.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Command } from 'commander';
import { select, confirm, input } from '@inquirer/prompts';
import { logger } from '../output/logger.js';
import { configureOmnifyAlias } from '../config/alias-config.js';

/**
 * Migration tool options.
 */
type MigrationTool = 'laravel' | 'prisma' | 'drizzle' | 'none';

/**
 * Project configuration from prompts.
 */
interface ProjectConfig {
  database: 'mysql' | 'postgres' | 'sqlite';
  migrationTool: MigrationTool;
  generateTypes: boolean;
  migrationsPath: string;
  typesPath: string;
  schemasDir: string;
}

/**
 * Example schema file content.
 */
const EXAMPLE_SCHEMA = `# Example User schema
# See https://github.com/famgia/omnify for documentation

name: User
displayName: User Account
kind: object

properties:
  email:
    type: Email
    unique: true
    displayName: Email Address

  name:
    type: String
    displayName: Full Name

  bio:
    type: Text
    nullable: true
    displayName: Biography

options:
  timestamps: true
  softDelete: true
`;

/**
 * Generates config file content based on project configuration.
 */
function generateConfig(config: ProjectConfig): string {
  const imports: string[] = [`import { defineConfig } from '@famgia/omnify';`];
  const plugins: string[] = [];

  // Add Laravel plugin
  if (config.migrationTool === 'laravel') {
    imports.push(`import laravel from '@famgia/omnify-laravel/plugin';`);
    plugins.push(`    laravel({
      migrationsPath: '${config.migrationsPath}',
      typesPath: '${config.typesPath}',
      singleFile: true,
      generateMigrations: true,
      generateTypes: ${config.generateTypes},
    }),`);
  }

  // Prisma plugin (coming soon)
  if (config.migrationTool === 'prisma') {
    plugins.push(`    // Prisma plugin coming soon!
    // prisma({ schemaPath: 'prisma/schema.prisma' }),`);
  }

  // Drizzle plugin (coming soon)
  if (config.migrationTool === 'drizzle') {
    plugins.push(`    // Drizzle plugin coming soon!
    // drizzle({ schemaPath: 'src/db/schema.ts' }),`);
  }

  // TypeScript-only (no migration tool)
  if (config.migrationTool === 'none' && config.generateTypes) {
    imports.push(`import laravel from '@famgia/omnify-laravel/plugin';`);
    plugins.push(`    laravel({
      typesPath: '${config.typesPath}',
      generateMigrations: false,
      generateTypes: true,
    }),`);
  }

  // Database URL examples
  const dbUrlExamples: Record<string, string> = {
    mysql: 'mysql://root:password@localhost:3306/omnify_dev',
    postgres: 'postgres://postgres:password@localhost:5432/omnify_dev',
    sqlite: 'sqlite://./omnify_dev.db',
  };

  return `${imports.join('\n')}

export default defineConfig({
  // Schema files location
  schemasDir: '${config.schemasDir}',

  // Lock file for tracking schema changes
  lockFilePath: './omnify.lock',

  // Database configuration
  database: {
    driver: '${config.database}',
    // REQUIRED: Set your development database URL
    // devUrl: '${dbUrlExamples[config.database]}',
  },

  // Generator plugins
  plugins: [
${plugins.join('\n\n')}
  ],
});
`;
}

/**
 * Init command options.
 */
interface InitOptions {
  force?: boolean;
  yes?: boolean;
}

/**
 * Runs the init command with interactive prompts.
 */
export async function runInit(options: InitOptions): Promise<void> {
  const cwd = process.cwd();

  logger.header('Omnify Project Setup');
  logger.newline();

  // Check if config already exists
  const configPath = resolve(cwd, 'omnify.config.ts');
  if (existsSync(configPath) && !options.force) {
    logger.warn('omnify.config.ts already exists. Use --force to overwrite.');
    return;
  }

  let config: ProjectConfig;

  if (options.yes) {
    // Use defaults (Laravel)
    config = {
      database: 'mysql',
      migrationTool: 'laravel',
      generateTypes: true,
      migrationsPath: 'database/migrations/omnify',
      typesPath: 'resources/js/types',
      schemasDir: './schemas',
    };
    logger.info('Using default configuration...');
  } else {
    // Interactive prompts
    logger.info('Answer a few questions to configure your project:\n');

    // 1. Database selection
    const database = await select({
      message: 'Which database?',
      choices: [
        { name: 'MySQL / MariaDB', value: 'mysql' as const },
        { name: 'PostgreSQL', value: 'postgres' as const },
        { name: 'SQLite', value: 'sqlite' as const },
      ],
      default: 'mysql',
    });

    // 2. Migration tool selection
    const migrationTool = await select({
      message: 'Which migration tool?',
      choices: [
        { name: 'Laravel (PHP)', value: 'laravel' as const },
        { name: 'Prisma (coming soon)', value: 'prisma' as const, disabled: true },
        { name: 'Drizzle (coming soon)', value: 'drizzle' as const, disabled: true },
        { name: 'None (types only)', value: 'none' as const },
      ],
      default: 'laravel',
    });

    // 3. TypeScript types
    const generateTypes = await confirm({
      message: 'Generate TypeScript types?',
      default: true,
    });

    // Default paths based on migration tool
    // Note: Laravel uses /omnify subfolder to separate auto-generated migrations from manual ones
    const defaultPaths: Record<MigrationTool, { migrations: string; types: string }> = {
      laravel: { migrations: 'database/migrations/omnify', types: 'resources/js/types' },
      prisma: { migrations: 'prisma/migrations', types: 'src/types' },
      drizzle: { migrations: 'drizzle', types: 'src/types' },
      none: { migrations: '', types: 'types' },
    };

    const defaults = defaultPaths[migrationTool];
    let migrationsPath = defaults.migrations;
    let typesPath = defaults.types;

    if (migrationTool !== 'none') {
      migrationsPath = await input({
        message: 'Migrations output path:',
        default: defaults.migrations,
      });
    }

    if (generateTypes) {
      typesPath = await input({
        message: 'TypeScript types path:',
        default: defaults.types,
      });
    }

    // Schemas directory
    const schemasDir = await input({
      message: 'Schemas directory:',
      default: './schemas',
    });

    config = {
      database,
      migrationTool,
      generateTypes,
      migrationsPath,
      typesPath,
      schemasDir,
    };
  }

  logger.newline();
  logger.step('Creating project files...');

  // Create schemas directory
  const schemasDir = resolve(cwd, config.schemasDir);
  if (!existsSync(schemasDir)) {
    mkdirSync(schemasDir, { recursive: true });
    logger.debug(`Created ${config.schemasDir}/ directory`);
  }

  // Create example schema
  const examplePath = resolve(schemasDir, 'User.yaml');
  if (!existsSync(examplePath) || options.force) {
    writeFileSync(examplePath, EXAMPLE_SCHEMA);
    logger.debug('Created example schema: User.yaml');
  }

  // Create config file
  const configContent = generateConfig(config);
  writeFileSync(configPath, configContent);
  logger.debug('Created omnify.config.ts');

  // Auto-configure @omnify alias in vite.config and tsconfig.json
  if (config.generateTypes) {
    logger.step('Configuring @omnify path alias...');
    const aliasResult = configureOmnifyAlias(cwd, 'omnify', false);
    if (!aliasResult.viteUpdated && !aliasResult.tsconfigUpdated) {
      if (!aliasResult.viteSkipped) {
        logger.info('Note: vite.config not found - you may need to configure @omnify alias manually');
      }
      if (!aliasResult.tsconfigSkipped) {
        logger.info('Note: tsconfig.json not found - you may need to configure @omnify/* path manually');
      }
    }
  }

  logger.newline();
  logger.success('Project initialized!');
  logger.newline();

  // Summary
  const toolName =
    config.migrationTool === 'laravel'
      ? 'Laravel'
      : config.migrationTool === 'prisma'
        ? 'Prisma'
        : config.migrationTool === 'drizzle'
          ? 'Drizzle'
          : 'None';

  logger.info('Configuration:');
  logger.list([
    `Database: ${config.database}`,
    `Migration tool: ${toolName}`,
    `TypeScript types: ${config.generateTypes ? 'Yes' : 'No'}`,
  ]);

  logger.newline();
  logger.info('Files created:');
  logger.list(['omnify.config.ts', `${config.schemasDir}/User.yaml`]);

  logger.newline();
  logger.info('Next steps:');
  logger.newline();

  logger.step('1. Set database URL in omnify.config.ts');
  logger.newline();

  logger.step('2. Define schemas in ' + config.schemasDir + '/');
  logger.newline();

  logger.step('3. Generate:');
  logger.info('   npx omnify validate');
  logger.info('   npx omnify generate');
  logger.newline();
}

/**
 * Registers the init command.
 */
export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new omnify project')
    .option('-f, --force', 'Overwrite existing files')
    .option('-y, --yes', 'Use default configuration (skip prompts)')
    .action(async (options: InitOptions) => {
      try {
        await runInit(options);
      } catch (error) {
        if (error instanceof Error) {
          // Handle Ctrl+C gracefully
          if (error.message.includes('User force closed')) {
            logger.newline();
            logger.info('Setup cancelled.');
            process.exit(0);
          }
          logger.error(error.message);
        }
        process.exit(1);
      }
    });
}
