/**
 * @famgia/omnify-cli - Generate Command
 *
 * Generates Laravel migrations and TypeScript types from schemas.
 * Supports both direct generation and plugin-based generation.
 */

import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import type { Command } from 'commander';
import {
  loadSchemas,
  mergePartialSchemas,
  validateSchemas,
  OmnifyError,
  PluginManager,
  createVersionStore,
  type VersionSchemaSnapshot,
  type VersionPropertySnapshot,
  type VersionChange,
} from '@famgia/omnify-core';
import type { LoadedSchema } from '@famgia/omnify-types';
import {
  writeLockFile,
  readLockFile,
  updateLockFile,
  buildSchemaSnapshots,
  compareSchemasDeep,
  isLockFileV2,
  validateMigrations,
  getMigrationsToRegenerate,
  VERSION_CHAIN_FILE,
  readVersionChain,
  checkBulkLockViolation,
  type SchemaChange,
  type MigrationValidation,
} from '@famgia/omnify-atlas';
import {
  generateMigrations,
  generateMigrationsFromChanges,
  generateModels,
  getModelPath,
  generateFactories,
  getFactoryPath,
} from '@famgia/omnify-laravel';
import { generateTypeScript, copyStubs, generateAIGuides as generateTypescriptAIGuides, shouldGenerateAIGuides as shouldGenerateTypescriptAIGuides } from '@famgia/omnify-typescript';
import type {
  OmnifyPlugin,
  SchemaCollection,
  GeneratorOutput,
} from '@famgia/omnify-types';
import type { ResolvedOmnifyConfig } from '../config/types.js';
import { loadConfig, validateConfig } from '../config/loader.js';
import { configureOmnifyAlias, addPluginEnumAlias, addPluginEnumTsconfigPath } from '../config/alias-config.js';
import { logger } from '../output/logger.js';
import { generateAIGuides } from '../guides/index.js';

/**
 * Generate command options.
 */
interface GenerateOptions {
  verbose?: boolean;
  migrationsOnly?: boolean;
  typesOnly?: boolean;
  force?: boolean;
  /** CI mode: check if migrations are in sync without generating */
  check?: boolean;
  /** Show stale migration warnings */
  warnStale?: boolean;
}


/**
 * Checks if plugins have generators configured.
 */
function hasPluginGenerators(plugins: readonly OmnifyPlugin[]): boolean {
  return plugins.some((p) => p.generators && p.generators.length > 0);
}

/**
 * Scans a directory for existing migration files and returns tables that already have CREATE migrations.
 */
function getExistingMigrationTables(migrationsDir: string): Set<string> {
  const existingTables = new Set<string>();

  if (!existsSync(migrationsDir)) {
    return existingTables;
  }

  try {
    const files = readdirSync(migrationsDir);
    // Match pattern: YYYY_MM_DD_HHMMSS_create_<table>_table.php
    const createMigrationPattern = /^\d{4}_\d{2}_\d{2}_\d{6}_create_(.+)_table\.php$/;

    for (const file of files) {
      const match = file.match(createMigrationPattern);
      if (match) {
        existingTables.add(match[1]); // table name
      }
    }
  } catch {
    // Ignore errors reading directory
  }

  return existingTables;
}

/**
 * Logs detailed schema change information.
 */
function logSchemaChange(change: SchemaChange, verbose: boolean): void {
  logger.debug(`  ${change.changeType}: ${change.schemaName}`);

  if (!verbose || change.changeType !== 'modified') {
    return;
  }

  // Log column changes
  if (change.columnChanges) {
    for (const col of change.columnChanges) {
      if (col.changeType === 'added') {
        logger.debug(`    + column: ${col.column} (${col.currentDef?.type})`);
      } else if (col.changeType === 'removed') {
        logger.debug(`    - column: ${col.column}`);
      } else if (col.changeType === 'modified' && col.modifications) {
        logger.debug(`    ~ column: ${col.column} [${col.modifications.join(', ')}]`);
      } else if (col.changeType === 'renamed' && col.previousColumn) {
        const mods = col.modifications?.length ? ` [${col.modifications.join(', ')}]` : '';
        logger.debug(`    → column: ${col.previousColumn} → ${col.column}${mods}`);
      }
    }
  }

  // Log index changes
  if (change.indexChanges) {
    for (const idx of change.indexChanges) {
      const type = idx.index.unique ? 'unique' : 'index';
      if (idx.changeType === 'added') {
        logger.debug(`    + ${type}: (${idx.index.columns.join(', ')})`);
      } else {
        logger.debug(`    - ${type}: (${idx.index.columns.join(', ')})`);
      }
    }
  }

  // Log option changes
  if (change.optionChanges) {
    if (change.optionChanges.timestamps) {
      const { from, to } = change.optionChanges.timestamps;
      logger.debug(`    ~ timestamps: ${from} → ${to}`);
    }
    if (change.optionChanges.softDelete) {
      const { from, to } = change.optionChanges.softDelete;
      logger.debug(`    ~ softDelete: ${from} → ${to}`);
    }
    if (change.optionChanges.idType) {
      const { from, to } = change.optionChanges.idType;
      logger.debug(`    ~ idType: ${from} → ${to}`);
    }
  }
}

/**
 * Convert property to version snapshot format.
 */
function propertyToVersionSnapshot(prop: Record<string, unknown>): VersionPropertySnapshot {
  return {
    type: prop.type as string,
    ...(prop.displayName !== undefined && { displayName: prop.displayName as string }),
    ...(prop.description !== undefined && { description: prop.description as string }),
    ...(prop.nullable !== undefined && { nullable: prop.nullable as boolean }),
    ...(prop.unique !== undefined && { unique: prop.unique as boolean }),
    ...(prop.default !== undefined && { default: prop.default }),
    ...(prop.length !== undefined && { length: prop.length as number }),
    ...(prop.unsigned !== undefined && { unsigned: prop.unsigned as boolean }),
    ...(prop.precision !== undefined && { precision: prop.precision as number }),
    ...(prop.scale !== undefined && { scale: prop.scale as number }),
    ...(prop.enum !== undefined && { enum: prop.enum as readonly string[] }),
    ...(prop.relation !== undefined && { relation: prop.relation as string }),
    ...(prop.target !== undefined && { target: prop.target as string }),
    ...(prop.targets !== undefined && { targets: prop.targets as readonly string[] }),
    ...(prop.morphName !== undefined && { morphName: prop.morphName as string }),
    ...(prop.onDelete !== undefined && { onDelete: prop.onDelete as string }),
    ...(prop.onUpdate !== undefined && { onUpdate: prop.onUpdate as string }),
    ...(prop.mappedBy !== undefined && { mappedBy: prop.mappedBy as string }),
    ...(prop.inversedBy !== undefined && { inversedBy: prop.inversedBy as string }),
    ...(prop.joinTable !== undefined && { joinTable: prop.joinTable as string }),
    ...(prop.owning !== undefined && { owning: prop.owning as boolean }),
    // Laravel-specific properties
    ...(prop.hidden !== undefined && { hidden: prop.hidden as boolean }),
    ...(prop.fillable !== undefined && { fillable: prop.fillable as boolean }),
    // Per-field overrides for compound types
    ...(prop.fields !== undefined && { fields: prop.fields as Record<string, { nullable?: boolean; hidden?: boolean; fillable?: boolean }> }),
  };
}

/**
 * Convert schemas to version snapshot format.
 */
function schemasToVersionSnapshot(
  schemas: SchemaCollection
): Record<string, VersionSchemaSnapshot> {
  const snapshot: Record<string, VersionSchemaSnapshot> = {};

  for (const [name, schema] of Object.entries(schemas)) {
    const properties: Record<string, VersionPropertySnapshot> = {};
    if (schema.properties) {
      for (const [propName, prop] of Object.entries(schema.properties)) {
        properties[propName] = propertyToVersionSnapshot(prop as unknown as Record<string, unknown>);
      }
    }

    const opts = schema.options;
    snapshot[name] = {
      name: schema.name,
      kind: (schema.kind ?? 'object') as 'object' | 'enum',
      ...(Object.keys(properties).length > 0 && { properties }),
      ...(schema.values && { values: schema.values }),
      ...(opts && {
        options: {
          ...(opts.id !== undefined && { id: opts.id }),
          ...(opts.idType !== undefined && { idType: opts.idType }),
          ...(opts.timestamps !== undefined && { timestamps: opts.timestamps }),
          ...(opts.softDelete !== undefined && { softDelete: opts.softDelete }),
          ...(opts.tableName !== undefined && { tableName: opts.tableName }),
          ...(opts.translations !== undefined && { translations: opts.translations }),
          ...(opts.authenticatable !== undefined && { authenticatable: opts.authenticatable }),
        },
      }),
    };
  }

  return snapshot;
}

/**
 * Convert SchemaChange to VersionChange format.
 */
function schemaChangeToVersionChange(change: SchemaChange): VersionChange[] {
  const changes: VersionChange[] = [];

  if (change.changeType === 'added') {
    changes.push({ action: 'schema_added', schema: change.schemaName });
  } else if (change.changeType === 'removed') {
    changes.push({ action: 'schema_removed', schema: change.schemaName });
  } else if (change.changeType === 'modified') {
    // Add property-level changes
    if (change.columnChanges) {
      for (const col of change.columnChanges) {
        if (col.changeType === 'added') {
          changes.push({
            action: 'property_added',
            schema: change.schemaName,
            property: col.column,
            to: col.currentDef,
          });
        } else if (col.changeType === 'removed') {
          changes.push({
            action: 'property_removed',
            schema: change.schemaName,
            property: col.column,
            from: col.previousDef,
          });
        } else if (col.changeType === 'modified') {
          changes.push({
            action: 'property_modified',
            schema: change.schemaName,
            property: col.column,
            from: col.previousDef,
            to: col.currentDef,
          });
        } else if (col.changeType === 'renamed') {
          changes.push({
            action: 'property_renamed',
            schema: change.schemaName,
            property: col.column,
            from: col.previousColumn,
            to: col.column,
          });
        }
      }
    }

    // Add option changes
    if (change.optionChanges) {
      changes.push({
        action: 'option_changed',
        schema: change.schemaName,
        from: change.optionChanges,
        to: change.optionChanges,
      });
    }

    // Add index changes
    if (change.indexChanges) {
      for (const idx of change.indexChanges) {
        if (idx.changeType === 'added') {
          changes.push({
            action: 'index_added',
            schema: change.schemaName,
            to: idx.index,
          });
        } else {
          changes.push({
            action: 'index_removed',
            schema: change.schemaName,
            from: idx.index,
          });
        }
      }
    }
  }

  return changes;
}

/**
 * Writes generator outputs to disk.
 */
function writeGeneratorOutputs(
  outputs: readonly GeneratorOutput[],
  rootDir: string
): { migrations: number; types: number; models: number; factories: number; other: number } {
  const counts = { migrations: 0, types: 0, models: 0, factories: 0, other: 0 };

  for (const output of outputs) {
    const filePath = resolve(rootDir, output.path);
    const dir = dirname(filePath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      logger.debug(`Created directory: ${dir}`);
    }

    // Skip writing if file exists and skipIfExists is true
    if (output.skipIfExists && existsSync(filePath)) {
      logger.debug(`Skipped (exists): ${output.path}`);
      continue;
    }

    writeFileSync(filePath, output.content);
    logger.debug(`Created: ${output.path}`);

    if (output.type === 'migration') counts.migrations++;
    else if (output.type === 'type') counts.types++;
    else if (output.type === 'model') counts.models++;
    else if (output.type === 'factory') counts.factories++;
    else counts.other++;
  }

  return counts;
}

/**
 * Runs generation using the plugin system.
 */
async function runPluginGeneration(
  plugins: readonly OmnifyPlugin[],
  schemas: SchemaCollection,
  rootDir: string,
  verbose: boolean,
  changes?: readonly SchemaChange[]
): Promise<{ migrations: number; types: number; models: number; factories: number; other: number }> {
  const pluginManager = new PluginManager({
    cwd: rootDir,
    verbose,
    logger: {
      debug: (msg) => logger.debug(msg),
      info: (msg) => logger.info(msg),
      warn: (msg) => logger.warn(msg),
      error: (msg) => logger.error(msg),
    },
  });

  // Register plugins
  for (const plugin of plugins) {
    await pluginManager.register(plugin);
  }

  // Run generators with schema changes
  const result = await pluginManager.runGenerators(schemas, changes);

  if (!result.success) {
    for (const error of result.errors) {
      logger.error(`Generator ${error.generatorName} failed: ${error.message}`);
    }
    throw new Error('Generator execution failed');
  }

  // Write outputs
  return writeGeneratorOutputs(result.outputs, rootDir);
}

/**
 * Runs generation using direct function calls (legacy mode).
 */
function runDirectGeneration(
  schemas: SchemaCollection,
  config: ResolvedOmnifyConfig,
  rootDir: string,
  options: GenerateOptions,
  changes: readonly SchemaChange[]
): { migrations: number; types: number; models: number; factories: number } {
  let migrationsGenerated = 0;
  let typesGenerated = 0;
  let modelsGenerated = 0;
  let factoriesGenerated = 0;

  // Extract custom types from plugins for generators
  const customTypesMap = new Map<string, import('@famgia/omnify-types').CustomTypeDefinition>();
  for (const plugin of config.plugins) {
    if (plugin.types) {
      for (const typeDef of plugin.types) {
        customTypesMap.set(typeDef.name, typeDef);
      }
    }
  }

  // Extract plugin enums for TypeScript generation
  const pluginEnumsMap = new Map<string, import('@famgia/omnify-types').PluginEnumDefinition>();
  for (const plugin of config.plugins) {
    if (plugin.enums) {
      for (const enumDef of plugin.enums) {
        pluginEnumsMap.set(enumDef.name, enumDef);
      }
    }
  }

  // Generate Laravel migrations
  if (!options.typesOnly && config.output.laravel) {
    logger.step('Generating Laravel migrations...');

    const migrationsDir = resolve(rootDir, config.output.laravel.migrationsPath);
    if (!existsSync(migrationsDir)) {
      mkdirSync(migrationsDir, { recursive: true });
      logger.debug(`Created directory: ${migrationsDir}`);
    }

    // Separate added schemas from modified/removed
    const addedSchemaNames = new Set(
      changes.filter((c) => c.changeType === 'added').map((c) => c.schemaName)
    );
    const alterChanges = changes.filter(
      (c) => c.changeType === 'modified' || c.changeType === 'removed'
    );

    // Get existing migration tables to avoid duplicates
    const existingTables = getExistingMigrationTables(migrationsDir);

    // Generate CREATE migrations only for added schemas
    if (addedSchemaNames.size > 0) {
      const addedSchemas = Object.fromEntries(
        Object.entries(schemas).filter(([name]) => addedSchemaNames.has(name))
      ) as SchemaCollection;

      const createMigrations = generateMigrations(addedSchemas, { customTypes: customTypesMap });
      for (const migration of createMigrations) {
        const tableName = migration.tables[0];
        // Skip if table already has a create migration
        if (existingTables.has(tableName)) {
          logger.debug(`Skipped CREATE for ${tableName} (already exists)`);
          continue;
        }
        const filePath = resolve(migrationsDir, migration.fileName);
        writeFileSync(filePath, migration.content);
        logger.debug(`Created: ${migration.fileName}`);
        migrationsGenerated++;
      }
    }

    // Generate ALTER/DROP migrations for modified/removed schemas
    if (alterChanges.length > 0) {
      const alterMigrations = generateMigrationsFromChanges(alterChanges);
      for (const migration of alterMigrations) {
        const filePath = resolve(migrationsDir, migration.fileName);
        writeFileSync(filePath, migration.content);
        logger.debug(`Created: ${migration.fileName}`);
        migrationsGenerated++;
      }
    }

    logger.success(`Generated ${migrationsGenerated} migration(s)`);
  }

  // Generate Laravel models
  if (!options.typesOnly && config.output.laravel?.modelsPath) {
    logger.step('Generating Laravel models...');

    const modelsPath = config.output.laravel.modelsPath;
    const baseModelsPath = config.output.laravel.baseModelsPath ?? `${modelsPath}/OmnifyBase`;

    // Ensure directories exist
    const modelsDir = resolve(rootDir, modelsPath);
    const baseModelsDir = resolve(rootDir, baseModelsPath);
    if (!existsSync(modelsDir)) {
      mkdirSync(modelsDir, { recursive: true });
    }
    if (!existsSync(baseModelsDir)) {
      mkdirSync(baseModelsDir, { recursive: true });
    }

    const providersPath = config.output.laravel.providersPath ?? 'app/Providers';

    const models = generateModels(schemas, {
      modelPath: modelsPath,
      baseModelPath: baseModelsPath,
      providersPath: providersPath,
      customTypes: customTypesMap,
    });

    for (const model of models) {
      const filePath = resolve(rootDir, getModelPath(model));
      const fileDir = dirname(filePath);
      if (!existsSync(fileDir)) {
        mkdirSync(fileDir, { recursive: true });
      }

      // Skip user models if they exist (don't overwrite customizations)
      // Always overwrite base models (overwrite: true)
      if (!model.overwrite && existsSync(filePath)) {
        logger.debug(`Skipped (exists): ${getModelPath(model)}`);
        continue;
      }

      writeFileSync(filePath, model.content);
      logger.debug(`Created: ${getModelPath(model)}`);
      modelsGenerated++;
    }

    logger.success(`Generated ${modelsGenerated} model(s)`);
  }

  // Generate Laravel factories
  if (!options.typesOnly && config.output.laravel?.factoriesPath) {
    logger.step('Generating Laravel factories...');

    const factoriesPath = config.output.laravel.factoriesPath;
    const factoriesDir = resolve(rootDir, factoriesPath);
    if (!existsSync(factoriesDir)) {
      mkdirSync(factoriesDir, { recursive: true });
    }

    const factories = generateFactories(schemas, {
      factoryPath: factoriesPath,
    });

    for (const factory of factories) {
      const filePath = resolve(rootDir, getFactoryPath(factory));
      const fileDir = dirname(filePath);
      if (!existsSync(fileDir)) {
        mkdirSync(fileDir, { recursive: true });
      }

      // Skip user factories if they exist (don't overwrite customizations)
      if (!factory.overwrite && existsSync(filePath)) {
        logger.debug(`Skipped (exists): ${getFactoryPath(factory)}`);
        continue;
      }

      writeFileSync(filePath, factory.content);
      logger.debug(`Created: ${getFactoryPath(factory)}`);
      factoriesGenerated++;
    }

    logger.success(`Generated ${factoriesGenerated} factory(ies)`);
  }

  // Generate TypeScript types
  if (!options.migrationsOnly && config.output.typescript) {
    logger.step('Generating TypeScript types...');

    const tsConfig = config.output.typescript as {
      path: string;
      schemasDir?: string;
      enumDir?: string;
      generateRules?: boolean;
      validationTemplates?: Record<string, Record<string, string>>;
    };

    // Resolve paths: basePath + subdirectories
    const basePath = resolve(rootDir, tsConfig.path);
    const schemasDir = resolve(basePath, tsConfig.schemasDir ?? 'schemas');
    const enumDir = resolve(basePath, tsConfig.enumDir ?? 'enum');

    // Plugin enums go to node_modules/.omnify-generated/enum (auto-generated)
    const pluginEnumDir = resolve(rootDir, 'node_modules/.omnify-generated/enum');

    // Calculate enum import prefix (relative path from schemas to enum)
    const enumImportPrefix = relative(schemasDir, enumDir).replace(/\\/g, '/');

    // Create directories
    if (!existsSync(schemasDir)) {
      mkdirSync(schemasDir, { recursive: true });
      logger.debug(`Created directory: ${schemasDir}`);
    }
    if (!existsSync(enumDir)) {
      mkdirSync(enumDir, { recursive: true });
      logger.debug(`Created directory: ${enumDir}`);
    }
    if (!existsSync(pluginEnumDir)) {
      mkdirSync(pluginEnumDir, { recursive: true });
      logger.debug(`Created directory: ${pluginEnumDir}`);
    }

    // Create package.json for .omnify-generated package
    const omnifyPkgDir = resolve(rootDir, 'node_modules/.omnify-generated');
    const omnifyPkgJson = resolve(omnifyPkgDir, 'package.json');
    if (!existsSync(omnifyPkgJson)) {
      writeFileSync(omnifyPkgJson, JSON.stringify({
        name: '.omnify-generated',
        version: '0.0.0',
        private: true,
        main: './enum/index.js',
        exports: {
          './enum/*': './enum/*.js',
        },
      }, null, 2));
    }

    // Enable multiLocale if locale config has multiple locales
    const isMultiLocale = config.locale && config.locale.locales && config.locale.locales.length > 1;
    const typeFiles = generateTypeScript(schemas, {
      customTypes: customTypesMap,
      pluginEnums: pluginEnumsMap,
      localeConfig: config.locale,
      multiLocale: isMultiLocale,
      generateRules: tsConfig.generateRules ?? true,
      validationTemplates: tsConfig.validationTemplates,
      enumImportPrefix,
      pluginEnumImportPrefix: '.omnify-generated/enum',
    });

    for (const file of typeFiles) {
      // Determine output directory based on file category
      let outputDir: string;
      if (file.category === 'plugin-enum') {
        outputDir = pluginEnumDir;
      } else if (file.category === 'enum') {
        outputDir = enumDir;
      } else {
        outputDir = schemasDir;
      }
      const filePath = resolve(outputDir, file.filePath);
      const fileDir = dirname(filePath);
      if (!existsSync(fileDir)) {
        mkdirSync(fileDir, { recursive: true });
      }
      // Skip if file exists and shouldn't be overwritten
      if (!file.overwrite && existsSync(filePath)) {
        logger.debug(`Skipped (exists): ${file.filePath}`);
        continue;
      }
      writeFileSync(filePath, file.content);
      logger.debug(`Created: ${file.filePath}`);
      typesGenerated++;
    }

    logger.success(`Generated ${typesGenerated} TypeScript file(s)`);

    // Copy React utility stubs (components, hooks, lib)
    const stubsResult = copyStubs({
      targetDir: basePath,
      skipIfExists: true,
    });
    if (stubsResult.copied.length > 0) {
      logger.success(`Generated ${stubsResult.copied.length} React stub(s)`);
    }

    // Auto-configure @omnify alias (silent mode - only log if changes made)
    const aliasResult = configureOmnifyAlias(rootDir, tsConfig.path, true);
    if (aliasResult.viteUpdated) {
      logger.success('Auto-configured @omnify alias in vite.config');
    }
    if (aliasResult.tsconfigUpdated) {
      logger.success('Auto-configured @omnify/* path in tsconfig.json');
    }
    
    // Configure .omnify-generated alias for plugin enums (if there are plugin enums)
    if (pluginEnumsMap.size > 0) {
      const pluginAliasResult = addPluginEnumAlias(rootDir);
      if (pluginAliasResult.updated) {
        logger.success('Auto-configured .omnify-generated alias in vite.config');
      }
      const pluginPathResult = addPluginEnumTsconfigPath(rootDir);
      if (pluginPathResult.updated) {
        logger.success('Auto-configured .omnify-generated/* path in tsconfig.json');
      }
    }
  }

  return { migrations: migrationsGenerated, types: typesGenerated, models: modelsGenerated, factories: factoriesGenerated };
}

/**
 * Runs the generate command.
 */
export async function runGenerate(options: GenerateOptions): Promise<void> {
  logger.setVerbose(options.verbose ?? false);

  logger.header('Generating Outputs');

  // Load configuration
  logger.debug('Loading configuration...');
  const { config, configPath } = await loadConfig();
  const rootDir = configPath ? dirname(configPath) : process.cwd();

  // Validate config (devUrl not required for generate)
  validateConfig(config, rootDir);

  // Load schemas from main directory
  const schemaPath = resolve(rootDir, config.schemasDir);
  logger.step(`Loading schemas from ${schemaPath}`);

  let schemas = await loadSchemas(schemaPath);
  logger.debug(`Found ${Object.keys(schemas).length} schema(s) in main directory`);

  // Load additional schemas from config (additionalSchemaPaths)
  // Includes auto-discovered packages from .omnify-packages.json
  const additionalPaths = config.additionalSchemaPaths ?? [];
  let hasPackageSchemas = false;

  if (additionalPaths.length > 0) {
    logger.step(`Loading schemas from ${additionalPaths.length} additional path(s)`);
    for (const entry of additionalPaths) {
      // Resolve relative path from rootDir
      const absolutePath = resolve(rootDir, entry.path);
      logger.debug(`  Checking: ${entry.path} → ${absolutePath}`);

      if (existsSync(absolutePath)) {
        // Load package schemas with skipPartialResolution to defer resolution
        // This allows partials to target schemas from main directory
        let packageSchemas = await loadSchemas(absolutePath, { skipPartialResolution: true });

        // パッケージ出力設定がある場合、各スキーマにpackageOutputを付与
        if (entry.output) {
          const schemasWithOutput: Record<string, LoadedSchema> = {};
          for (const [name, schema] of Object.entries(packageSchemas)) {
            schemasWithOutput[name] = {
              ...schema,
              packageOutput: entry.output,
            };
          }
          packageSchemas = schemasWithOutput;
        }

        const count = Object.keys(packageSchemas).filter(k => !k.startsWith('__partial__')).length;
        const partialCount = Object.keys(packageSchemas).filter(k => k.startsWith('__partial__')).length;
        const nsInfo = entry.namespace ? ` [${entry.namespace}]` : '';
        const outputInfo = entry.output?.laravel ? ` → ${entry.output.laravel.base}` : '';
        logger.info(`  • ${entry.path}${nsInfo}: ${count} schema(s)${partialCount > 0 ? ` + ${partialCount} partial(s)` : ''}${outputInfo}`);
        // Merge schemas (package schemas won't override main schemas)
        schemas = { ...packageSchemas, ...schemas };
        hasPackageSchemas = true;
      } else {
        logger.warn(`  • ${entry.path}: directory not found (skipped)`);
        logger.debug(`    Resolved path: ${absolutePath}`);
      }
    }
  }

  // Resolve partial schemas from packages now that all schemas are merged
  if (hasPackageSchemas) {
    schemas = mergePartialSchemas(schemas);
  }

  const schemaCount = Object.keys(schemas).length;

  if (schemaCount === 0) {
    logger.warn('No schema files found');
    return;
  }

  logger.debug(`Total: ${schemaCount} schema(s)`);

  // Extract custom type names from plugins for validation
  const customTypeNames: string[] = [];
  for (const plugin of config.plugins) {
    if (plugin.types) {
      for (const typeDef of plugin.types) {
        customTypeNames.push(typeDef.name);
      }
    }
  }

  // Validate schemas first
  logger.step('Validating schemas...');
  const validationResult = validateSchemas(schemas, {
    customTypes: customTypeNames,
  });

  if (!validationResult.valid) {
    logger.error('Schema validation failed. Fix errors before generating.');
    for (const error of validationResult.errors) {
      const omnifyError = OmnifyError.fromInfo(error);
      logger.formatError(omnifyError);
    }
    process.exit(2);
  }

  // Check for changes by comparing lock file with current schemas
  logger.step('Checking for changes...');
  const lockPath = resolve(rootDir, config.lockFilePath);

  const existingLock = await readLockFile(lockPath);
  const currentSnapshots = await buildSchemaSnapshots(schemas);

  // Use v2 format for deep diff
  const v2Lock = existingLock && isLockFileV2(existingLock) ? existingLock : null;
  const comparison = compareSchemasDeep(currentSnapshots, v2Lock);

  // Check version chain for locked schemas (blockchain-like protection)
  const chainFilePath = resolve(rootDir, VERSION_CHAIN_FILE);
  const versionChain = await readVersionChain(chainFilePath);

  if (versionChain && comparison.hasChanges) {
    // Build list of schemas being removed or modified
    const schemaActions: { name: string; action: 'delete' | 'modify' }[] = [];

    for (const change of comparison.changes) {
      if (change.changeType === 'removed') {
        schemaActions.push({ name: change.schemaName, action: 'delete' });
      } else if (change.changeType === 'modified') {
        schemaActions.push({ name: change.schemaName, action: 'modify' });
      }
    }

    if (schemaActions.length > 0) {
      const lockCheck = checkBulkLockViolation(versionChain, schemaActions);

      if (!lockCheck.allowed) {
        logger.newline();
        logger.error('🔒 VERSION LOCK VIOLATION DETECTED');
        logger.error('');
        logger.error('The following schemas are locked in production:');
        for (const name of lockCheck.affectedSchemas) {
          logger.error(`  • ${name}`);
        }
        logger.error('');
        logger.error(`Locked in version(s): ${lockCheck.lockedInVersions.join(', ')}`);
        logger.error('');
        logger.error('These schemas CANNOT be modified or deleted.');
        logger.error('This is enforced by the blockchain-like version chain.');
        logger.newline();

        throw new OmnifyError(
          lockCheck.reason ?? 'Schema modification blocked by version lock',
          'E407',
          undefined,
          'Restore the original schema files or create new schemas instead of modifying locked ones.'
        );
      }
    }
  }

  // Validate existing migrations (check for missing/modified files)
  if (existingLock && config.output.laravel?.migrationsPath) {
    const migrationsDir = resolve(rootDir, config.output.laravel.migrationsPath);
    const migrationValidation = await validateMigrations(existingLock, migrationsDir);

    // Report validation results
    if (!migrationValidation.valid) {
      logger.newline();
      logger.warn('Migration file issues detected:');

      if (migrationValidation.missingFiles.length > 0) {
        logger.error(`  Missing files (${migrationValidation.missingFiles.length}):`);
        for (const file of migrationValidation.missingFiles) {
          logger.error(`    - ${file}`);
        }
      }

      if (migrationValidation.modifiedFiles.length > 0) {
        logger.warn(`  Modified files (${migrationValidation.modifiedFiles.length}):`);
        for (const file of migrationValidation.modifiedFiles) {
          logger.warn(`    - ${file} (checksum mismatch)`);
        }
      }

      logger.newline();
    }

    // Report stale migrations if --warn-stale is enabled
    if ((options.warnStale ?? true) && migrationValidation.staleFiles.length > 0) {
      logger.newline();
      logger.warn('⚠️  Stale migrations detected (old timestamp, not in lock file):');
      for (const file of migrationValidation.staleFiles) {
        logger.warn(`    - ${file}`);
      }
      logger.warn('  These may be from merged branches. Review before running migrate.');
      logger.newline();
    }

    // Check mode: exit with status based on validation
    if (options.check) {
      logger.newline();
      logger.step('CI Check Mode Results:');
      logger.info(`  Schemas: ${schemaCount}`);
      logger.info(`  Tracked migrations: ${migrationValidation.totalTracked}`);
      logger.info(`  Migrations on disk: ${migrationValidation.totalOnDisk}`);
      logger.info(`  Schema changes: ${comparison.changes.length}`);

      const hasIssues = !migrationValidation.valid || comparison.hasChanges;

      if (hasIssues) {
        logger.newline();
        if (comparison.hasChanges) {
          logger.error('❌ Schema changes detected - run "npx omnify generate" to update migrations');
        }
        if (migrationValidation.missingFiles.length > 0) {
          logger.error('❌ Missing migration files - regenerate or restore from git');
        }
        if (migrationValidation.modifiedFiles.length > 0) {
          logger.warn('⚠️  Modified migration files - may cause inconsistencies');
        }
        process.exit(1);
      } else {
        logger.success('✅ All migrations in sync');
        return;
      }
    }

    // Offer to regenerate missing files
    if (migrationValidation.missingFiles.length > 0) {
      const toRegenerate = getMigrationsToRegenerate(existingLock, migrationValidation.missingFiles);

      if (toRegenerate.length > 0) {
        logger.info(`Will regenerate ${toRegenerate.length} missing migration(s) with original timestamps.`);

        // Add regeneration logic here in the future
        // For now, we just warn - actual regeneration requires more work
        logger.warn('Auto-regeneration not yet implemented. Please restore from git or reset migrations.');
      }
    }
  }

  // Only skip if no changes AND no outputs to regenerate
  // Models/TypeScript with overwrite: true should always be regenerated
  const skipMigrations = !comparison.hasChanges && !options.force;
  const pluginsHaveGenerators = config.plugins.some(p => p.generators && p.generators.length > 0);
  const hasTypescriptOutput = !!config.output.typescript;

  if (skipMigrations && !config.output.laravel?.modelsPath && !pluginsHaveGenerators && !hasTypescriptOutput) {
    logger.success('No changes to generate');
    return;
  }

  if (comparison.hasChanges) {
    logger.debug(`Detected ${comparison.changes.length} change(s)`);
    for (const change of comparison.changes) {
      logSchemaChange(change, options.verbose ?? false);
    }
  }

  let migrationsGenerated = 0;
  let typesGenerated = 0;
  let modelsGenerated = 0;
  let factoriesGenerated = 0;

  // Check if plugins have generators
  const usePlugins = hasPluginGenerators(config.plugins);

  // Extract custom types from plugins for generators
  const customTypesMap = new Map<string, import('@famgia/omnify-types').CustomTypeDefinition>();
  for (const plugin of config.plugins) {
    if (plugin.types) {
      for (const typeDef of plugin.types) {
        customTypesMap.set(typeDef.name, typeDef);
      }
    }
  }

  // Extract plugin enums for TypeScript generation
  const pluginEnumsMap = new Map<string, import('@famgia/omnify-types').PluginEnumDefinition>();
  for (const plugin of config.plugins) {
    if (plugin.enums) {
      for (const enumDef of plugin.enums) {
        pluginEnumsMap.set(enumDef.name, enumDef);
      }
    }
  }

  if (usePlugins) {
    // Use plugin system for generation
    logger.step('Running plugin generators...');
    const counts = await runPluginGeneration(
      config.plugins,
      schemas,
      rootDir,
      options.verbose ?? false,
      comparison.changes
    );
    migrationsGenerated = counts.migrations;
    typesGenerated = counts.types;

    if (counts.migrations > 0) {
      logger.success(`Generated ${counts.migrations} migration(s)`);
    }
    if (counts.types > 0) {
      logger.success(`Generated ${counts.types} TypeScript file(s)`);
    }
    if (counts.models > 0) {
      logger.success(`Generated ${counts.models} model(s)`);
    }
    if (counts.factories > 0) {
      logger.success(`Generated ${counts.factories} factory(ies)`);
    }
    if (counts.other > 0) {
      logger.success(`Generated ${counts.other} other file(s)`);
    }

    // Generate TypeScript from output.typescript config (even when using plugins)
    if (!options.migrationsOnly && config.output.typescript && typesGenerated === 0) {
      logger.step('Generating TypeScript types...');

      const tsConfig2 = config.output.typescript as {
        path: string;
        schemasDir?: string;
        enumDir?: string;
        generateRules?: boolean;
        validationTemplates?: Record<string, Record<string, string>>;
      };

      // Resolve paths: basePath + subdirectories
      const basePath2 = resolve(rootDir, tsConfig2.path);
      const schemasDir2 = resolve(basePath2, tsConfig2.schemasDir ?? 'schemas');
      const enumDir2 = resolve(basePath2, tsConfig2.enumDir ?? 'enum');

      // Plugin enums go to node_modules/.omnify-generated/enum (auto-generated)
      const pluginEnumDir2 = resolve(rootDir, 'node_modules/.omnify-generated/enum');

      // Calculate enum import prefix (relative path from schemas to enum)
      const enumImportPrefix2 = relative(schemasDir2, enumDir2).replace(/\\/g, '/');

      // Create directories
      if (!existsSync(schemasDir2)) {
        mkdirSync(schemasDir2, { recursive: true });
        logger.debug(`Created directory: ${schemasDir2}`);
      }
      if (!existsSync(enumDir2)) {
        mkdirSync(enumDir2, { recursive: true });
        logger.debug(`Created directory: ${enumDir2}`);
      }
      if (!existsSync(pluginEnumDir2)) {
        mkdirSync(pluginEnumDir2, { recursive: true });
        logger.debug(`Created directory: ${pluginEnumDir2}`);
      }

      // Create package.json for .omnify-generated package
      const omnifyPkgDir2 = resolve(rootDir, 'node_modules/.omnify-generated');
      const omnifyPkgJson2 = resolve(omnifyPkgDir2, 'package.json');
      if (!existsSync(omnifyPkgJson2)) {
        writeFileSync(omnifyPkgJson2, JSON.stringify({
          name: '.omnify-generated',
          version: '0.0.0',
          private: true,
          main: './enum/index.js',
          exports: {
            './enum/*': './enum/*.js',
          },
        }, null, 2));
      }

      // Enable multiLocale if locale config has multiple locales
      const isMultiLocale = config.locale && config.locale.locales && config.locale.locales.length > 1;
      const typeFiles = generateTypeScript(schemas, {
        customTypes: customTypesMap,
        pluginEnums: pluginEnumsMap,
        localeConfig: config.locale,
        multiLocale: isMultiLocale,
        generateRules: tsConfig2.generateRules ?? true,
        validationTemplates: tsConfig2.validationTemplates,
        enumImportPrefix: enumImportPrefix2,
        pluginEnumImportPrefix: '.omnify-generated/enum',
      });

      for (const file of typeFiles) {
        // Determine output directory based on file category
        let outputDir2: string;
        if (file.category === 'plugin-enum') {
          outputDir2 = pluginEnumDir2;
        } else if (file.category === 'enum') {
          outputDir2 = enumDir2;
        } else {
          outputDir2 = schemasDir2;
        }
        const filePath = resolve(outputDir2, file.filePath);
        const fileDir = dirname(filePath);
        if (!existsSync(fileDir)) {
          mkdirSync(fileDir, { recursive: true });
        }
        // Skip if file exists and shouldn't be overwritten
        if (!file.overwrite && existsSync(filePath)) {
          logger.debug(`Skipped (exists): ${file.filePath}`);
          continue;
        }
        writeFileSync(filePath, file.content);
        logger.debug(`Created: ${file.filePath}`);
        typesGenerated++;
      }

      logger.success(`Generated ${typesGenerated} TypeScript file(s)`);

      // Copy React utility stubs (components, hooks, lib)
      const stubsResult2 = copyStubs({
        targetDir: basePath2,
        skipIfExists: true,
      });
      if (stubsResult2.copied.length > 0) {
        logger.success(`Generated ${stubsResult2.copied.length} React stub(s)`);
      }

      // Auto-configure @omnify alias (silent mode - only log if changes made)
      const aliasResult = configureOmnifyAlias(rootDir, tsConfig2.path, true);
      if (aliasResult.viteUpdated) {
        logger.success('Auto-configured @omnify alias in vite.config');
      }
      if (aliasResult.tsconfigUpdated) {
        logger.success('Auto-configured @omnify/* path in tsconfig.json');
      }
      
      // Configure .omnify-generated alias for plugin enums (if there are plugin enums)
      if (pluginEnumsMap.size > 0) {
        const pluginAliasResult = addPluginEnumAlias(rootDir);
        if (pluginAliasResult.updated) {
          logger.success('Auto-configured .omnify-generated alias in vite.config');
        }
        const pluginPathResult = addPluginEnumTsconfigPath(rootDir);
        if (pluginPathResult.updated) {
          logger.success('Auto-configured .omnify-generated/* path in tsconfig.json');
        }
      }

      // Generate TypeScript AI guides if needed
      if (shouldGenerateTypescriptAIGuides(rootDir)) {
        const tsAIResult = generateTypescriptAIGuides(rootDir, {
          typescriptPath: tsConfig2.path,
        });
        const tsClaudeTotal = tsAIResult.claudeGuides + tsAIResult.claudeChecklists;
        if (tsClaudeTotal > 0 || tsAIResult.cursorRules > 0) {
          logger.debug(`Generated ${tsClaudeTotal} React Claude files, ${tsAIResult.cursorRules} Cursor rules`);
        }
      }
    }
  } else {
    // Use direct generation (legacy mode)
    const counts = runDirectGeneration(schemas, config, rootDir, options, comparison.changes);
    migrationsGenerated = counts.migrations;
    typesGenerated = counts.types;
    modelsGenerated = counts.models;
    factoriesGenerated = counts.factories;
  }

  // Update lock file (v2 with snapshots)
  logger.step('Updating lock file...');
  const newLockFile = updateLockFile(existingLock, currentSnapshots, config.database.driver);
  await writeLockFile(lockPath, newLockFile);
  logger.debug(`Updated: ${config.lockFilePath}`);

  // Save version history only when there are actual schema changes
  if (comparison.hasChanges) {
    logger.step('Saving version history...');
    const versionStore = createVersionStore({ baseDir: rootDir, maxVersions: 100 });
    const versionSnapshot = schemasToVersionSnapshot(schemas);
    const versionChanges: VersionChange[] = comparison.changes.flatMap(schemaChangeToVersionChange);

    // Get migration file name for version description
    const migrationFileName = migrationsGenerated > 0
      ? `${migrationsGenerated} migration(s)`
      : undefined;

    try {
      const newVersion = await versionStore.createVersion(
        versionSnapshot,
        versionChanges,
        {
          driver: config.database.driver,
          ...(migrationFileName !== undefined && { migration: migrationFileName }),
          description: `Generated ${comparison.changes.length} change(s)`,
        }
      );
      logger.debug(`Created version ${newVersion.version}`);
    } catch (versionError) {
      // Version history is optional, log but don't fail
      logger.debug(`Could not save version history: ${(versionError as Error).message}`);
    }
  }

  // Generate AI guides
  try {
    const guidesWritten = generateAIGuides(rootDir, config.plugins);
    if (guidesWritten > 0) {
      logger.debug(`Updated ${guidesWritten} AI guide file(s)`);
    }
  } catch (guideError) {
    // AI guides are optional, log but don't fail
    logger.debug(`Could not generate AI guides: ${(guideError as Error).message}`);
  }

  logger.newline();
  logger.success('Generation complete!');

  if (migrationsGenerated > 0 && config.output.laravel) {
    logger.info(`  Migrations: ${config.output.laravel.migrationsPath}/`);
  }
  if (modelsGenerated > 0 && config.output.laravel?.modelsPath) {
    logger.info(`  Models: ${config.output.laravel.modelsPath}/`);
  }
  if (typesGenerated > 0 && config.output.typescript) {
    logger.info(`  Types: ${config.output.typescript.path}/`);
  }
}

/**
 * Registers the generate command.
 */
export function registerGenerateCommand(program: Command): void {
  program
    .command('generate')
    .description('Generate Laravel migrations and TypeScript types')
    .option('-v, --verbose', 'Show detailed output')
    .option('--migrations-only', 'Only generate migrations')
    .option('--types-only', 'Only generate TypeScript types')
    .option('-f, --force', 'Generate even if no changes detected')
    .option('--check', 'CI mode: check if migrations are in sync without generating (exits with code 1 if out of sync)')
    .option('--no-warn-stale', 'Disable stale migration warnings')
    .action(async (options: GenerateOptions) => {
      try {
        await runGenerate(options);
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
