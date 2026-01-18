/**
 * @famgia/omnify-cli - Configuration Loader
 *
 * Loads and resolves omnify.config.ts configuration.
 */

import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createJiti } from 'jiti';
import type { OmnifyConfig, ResolvedOmnifyConfig, OmnifyPlugin, ConfigLoadResult, DiscoveryConfig } from './types.js';
import { configError, configNotFoundError } from '@famgia/omnify-core';
import { discoverPackages } from './discovery.js';

/**
 * Configuration file names to search for (in order of priority).
 */
const CONFIG_FILES = [
  'omnify.config.ts',
  'omnify.config.js',
  'omnify.config.mjs',
  'omnify.config.cjs',
];

/**
 * Finds configuration file in directory.
 */
export function findConfigFile(startDir: string): string | null {
  const cwd = resolve(startDir);

  for (const filename of CONFIG_FILES) {
    const configPath = resolve(cwd, filename);
    if (existsSync(configPath)) {
      return configPath;
    }
  }

  return null;
}

/**
 * Loads configuration from file using jiti.
 */
async function loadConfigFile(configPath: string): Promise<OmnifyConfig> {
  const jiti = createJiti(configPath, {
    interopDefault: true,
    moduleCache: false,
  });

  try {
    const module = await jiti.import(configPath);
    const config = module as OmnifyConfig;

    // Handle default export
    if ('default' in config) {
      return (config as { default: OmnifyConfig }).default;
    }

    return config;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw configError(
      `Failed to load config file: ${message}. Check your omnify.config.ts for syntax errors.`,
      'E002'
    );
  }
}

/**
 * Resolves plugins from configuration.
 * Handles both string (npm package) and object plugins.
 */
async function resolvePlugins(
  plugins: readonly (string | OmnifyPlugin)[] | undefined,
  configPath: string | null
): Promise<OmnifyPlugin[]> {
  if (!plugins || plugins.length === 0) {
    return [];
  }

  const resolved: OmnifyPlugin[] = [];
  const configDir = configPath ? dirname(configPath) : process.cwd();

  for (const plugin of plugins) {
    if (typeof plugin === 'string') {
      // Load plugin from npm package
      const jiti = createJiti(configDir, {
        interopDefault: true,
        moduleCache: false,
      });

      try {
        const module = await jiti.import(plugin);
        const loadedPlugin = (module as { default?: OmnifyPlugin }).default ?? module;
        resolved.push(loadedPlugin as OmnifyPlugin);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw configError(
          `Failed to load plugin '${plugin}': ${message}. Ensure the plugin is installed: npm install ${plugin}`,
          'E301'
        );
      }
    } else {
      // Direct plugin object
      resolved.push(plugin);
    }
  }

  return resolved;
}

/**
 * Resolves configuration with defaults.
 */
export async function resolveConfig(
  userConfig: OmnifyConfig,
  configPath: string | null
): Promise<ResolvedOmnifyConfig> {
  const plugins = await resolvePlugins(userConfig.plugins, configPath);
  const projectRoot = configPath ? dirname(configPath) : process.cwd();

  // Build discovery config with defaults
  const discovery: DiscoveryConfig = {
    enabled: userConfig.discovery?.enabled ?? true,
    exclude: userConfig.discovery?.exclude,
  };

  // Discover packages and merge with explicit additionalSchemaPaths
  const allSchemaPaths = discoverPackages(
    projectRoot,
    discovery,
    userConfig.additionalSchemaPaths
  );

  // Build database config, only including defined optional properties
  const databaseConfig = {
    driver: userConfig.database.driver,
    enableFieldComments: userConfig.database.enableFieldComments ?? false,
  };
  // Only add devUrl if defined
  const database = userConfig.database.devUrl !== undefined
    ? { ...databaseConfig, devUrl: userConfig.database.devUrl }
    : databaseConfig;

  // Build laravel output config
  // Default to 'database/migrations/omnify' to match the laravel plugin default
  // This ensures reset command only deletes the omnify subfolder, not the entire migrations folder
  const laravelConfig = {
    migrationsPath: userConfig.output?.laravel?.migrationsPath ?? 'database/migrations/omnify',
  };
  // Only add optional properties if they are defined
  const laravel = buildLaravelConfig(laravelConfig, userConfig.output?.laravel);

  // Build typescript output config
  const tsConfig = userConfig.output?.typescript;
  const typescript = {
    path: tsConfig?.path ?? 'types',
    schemasDir: tsConfig?.schemasDir ?? 'schemas',
    enumDir: tsConfig?.enumDir ?? 'enum',
    singleFile: tsConfig?.singleFile ?? true,
    generateEnums: tsConfig?.generateEnums ?? true,
    generateRelationships: tsConfig?.generateRelationships ?? true,
  };

  const result: ResolvedOmnifyConfig = {
    schemasDir: userConfig.schemasDir ?? './schemas',
    database: database as ResolvedOmnifyConfig['database'],
    output: {
      laravel,
      typescript,
    } as ResolvedOmnifyConfig['output'],
    plugins,
    verbose: userConfig.verbose ?? false,
    lockFilePath: userConfig.lockFilePath ?? '.omnify.lock',
    discovery,
    ...(userConfig.locale && { locale: userConfig.locale }),
    ...(allSchemaPaths.length > 0 && { additionalSchemaPaths: allSchemaPaths }),
  };

  return result;
}

/**
 * Builds Laravel config with only defined optional properties.
 */
function buildLaravelConfig(
  base: { migrationsPath: string },
  userLaravel?: Readonly<{
    migrationsPath?: string;
    modelsPath?: string;
    baseModelsPath?: string;
    providersPath?: string;
    modelsNamespace?: string;
    factoriesPath?: string;
    enumsPath?: string;
    enumsNamespace?: string;
  }>
): ResolvedOmnifyConfig['output']['laravel'] {
  const config: ResolvedOmnifyConfig['output']['laravel'] = { ...base };

  if (userLaravel?.modelsPath !== undefined) {
    (config as { modelsPath: string }).modelsPath = userLaravel.modelsPath;
  }
  if (userLaravel?.baseModelsPath !== undefined) {
    (config as { baseModelsPath: string }).baseModelsPath = userLaravel.baseModelsPath;
  }
  if (userLaravel?.providersPath !== undefined) {
    (config as { providersPath: string }).providersPath = userLaravel.providersPath;
  }
  if (userLaravel?.modelsNamespace !== undefined) {
    (config as { modelsNamespace: string }).modelsNamespace = userLaravel.modelsNamespace;
  }
  if (userLaravel?.factoriesPath !== undefined) {
    (config as { factoriesPath: string }).factoriesPath = userLaravel.factoriesPath;
  }
  if (userLaravel?.enumsPath !== undefined) {
    (config as { enumsPath: string }).enumsPath = userLaravel.enumsPath;
  }
  if (userLaravel?.enumsNamespace !== undefined) {
    (config as { enumsNamespace: string }).enumsNamespace = userLaravel.enumsNamespace;
  }

  return config;
}

/**
 * Validates required configuration.
 */
export function validateConfig(config: ResolvedOmnifyConfig, rootDir: string): void {
  // Validate schema directory exists
  const schemaPath = resolve(rootDir, config.schemasDir);
  if (!existsSync(schemaPath)) {
    throw configError(
      `Schema directory not found: ${schemaPath}. Create the '${config.schemasDir}' directory or update schemasDir in config.`,
      'E002'
    );
  }
}

/**
 * Validates that devUrl is configured (required for diff/generate operations).
 */
export function requireDevUrl(config: ResolvedOmnifyConfig): void {
  if (!config.database.devUrl) {
    throw configError(
      `database.devUrl is required for diff and generate operations. Add devUrl to your database config, e.g., "mysql://root@localhost:3306/omnify_dev"`,
      'E003'
    );
  }
}

/**
 * Loads configuration from file or returns defaults.
 */
export async function loadConfig(startDir: string = process.cwd()): Promise<ConfigLoadResult> {
  const cwd = resolve(startDir);
  const configPath = findConfigFile(cwd);

  if (configPath) {
    const userConfig = await loadConfigFile(configPath);
    const config = await resolveConfig(userConfig, configPath);

    return {
      config,
      configPath,
    };
  }

  // No config file found - require config file
  throw configNotFoundError(resolve(cwd, 'omnify.config.ts'));
}

/**
 * Helper function for type-safe configuration.
 * Used in omnify.config.ts files.
 */
export function defineConfig(config: OmnifyConfig): OmnifyConfig {
  return config;
}
