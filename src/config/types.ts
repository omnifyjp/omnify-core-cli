/**
 * @famgia/omnify-cli - Configuration Types
 *
 * Inline type definitions for omnify.config.ts configuration file.
 * これらの型定義は @famgia/omnify-types からのコピーです。
 * pnpm symlink解決問題を回避するため、直接インライン化しています。
 */

import type { OmnifyPlugin, PluginFactory, LocaleConfig } from '@famgia/omnify-types';

// Re-export plugin types (these are less likely to cause resolution issues)
export type { OmnifyPlugin, PluginFactory } from '@famgia/omnify-types';

// ============================================================================
// Database Configuration
// ============================================================================

/**
 * Supported database drivers.
 */
export type DatabaseDriver = 'mysql' | 'pgsql' | 'postgres' | 'sqlite' | 'sqlsrv' | 'mariadb';

/**
 * Database configuration for Atlas and migrations.
 */
export interface DatabaseConfig {
  /** Database driver type */
  readonly driver: DatabaseDriver;
  /** Development database URL for Atlas diff operations */
  readonly devUrl?: string;
  /** Enable field comments in migrations (MySQL only) */
  readonly enableFieldComments?: boolean;
}

// ============================================================================
// Output Configuration
// ============================================================================

/**
 * Laravel output configuration.
 */
export interface LaravelOutputConfig {
  /** Directory for generated migration files */
  readonly migrationsPath: string;
  /** Directory for generated model files */
  readonly modelsPath?: string;
  /** Directory for generated base model files (auto-generated, always overwritten) */
  readonly baseModelsPath?: string;
  /** Directory for generated service provider files */
  readonly providersPath?: string;
  /** Model namespace */
  readonly modelsNamespace?: string;
  /** Directory for generated factory files */
  readonly factoriesPath?: string;
  /** Directory for generated enum files */
  readonly enumsPath?: string;
  /** Enum namespace */
  readonly enumsNamespace?: string;
}

/**
 * TypeScript output configuration.
 */
export interface TypeScriptOutputConfig {
  /**
   * Base output directory for all TypeScript files.
   * Schemas and enums will be placed in subdirectories.
   * @example 'resources/ts/omnify'
   */
  readonly path: string;
  /**
   * Subdirectory for schema files (interfaces, Zod schemas, i18n).
   * Relative to `path`.
   * @default 'schemas'
   * @example 'models' - places schemas at {path}/models/
   */
  readonly schemasDir?: string;
  /**
   * Subdirectory for enum files.
   * Relative to `path`.
   * @default 'enum'
   * @example 'enums' - places enums at {path}/enums/
   */
  readonly enumDir?: string;
  /** Whether to generate a single file or multiple files */
  readonly singleFile?: boolean;
  /** Whether to generate enum types */
  readonly generateEnums?: boolean;
  /** Whether to generate relationship types */
  readonly generateRelationships?: boolean;
}

/**
 * Combined output configuration.
 */
export interface OutputConfig {
  /** Laravel migration and model output */
  readonly laravel?: LaravelOutputConfig;
  /** TypeScript type definitions output */
  readonly typescript?: TypeScriptOutputConfig;
}

// ============================================================================
// Additional Schema Paths
// ============================================================================

/**
 * Package-level Laravel output configuration.
 * パッケージ独自の出力パスとnamespaceを定義可能
 */
export interface PackageLaravelOutputConfig {
  /** Base path for all package outputs (relative to project root) */
  readonly base: string;
  /** Model namespace for the package (e.g., 'Omnify\\SsoClient\\Models') */
  readonly modelsNamespace: string;
  /** Path for user-editable models (relative to base). @default 'src/Models' */
  readonly modelsPath?: string;
  /** Path for auto-generated base models (relative to base). @default 'src/Models/OmnifyBase' */
  readonly baseModelsPath?: string;
  /** Base model namespace. @default derived from modelsNamespace + '\\OmnifyBase' */
  readonly baseModelsNamespace?: string;
  /** Path for migrations (relative to base). @default 'database/migrations' */
  readonly migrationsPath?: string;
  /** Path for enums (relative to base). @default 'src/Enums' */
  readonly enumsPath?: string;
  /** Enum namespace. @default derived from modelsNamespace parent + '\\Enums' */
  readonly enumsNamespace?: string;
  /** Whether to generate a service provider. @default true */
  readonly generateServiceProvider?: boolean;
  /** Path for service provider (relative to base). @default 'src/Providers' */
  readonly providersPath?: string;
  /** Service provider namespace. @default derived from modelsNamespace parent + '\\Providers' */
  readonly providersNamespace?: string;
  /** Whether to generate factories. @default true */
  readonly generateFactories?: boolean;
  /** Path for factories (relative to base). @default 'database/factories' */
  readonly factoriesPath?: string;
}

/**
 * Package-level output configuration.
 */
export interface PackageOutputConfig {
  /** Laravel output configuration for the package */
  readonly laravel?: PackageLaravelOutputConfig;
}

/**
 * Additional schema path entry for loading schemas from packages.
 */
export interface AdditionalSchemaPath {
  /**
   * Path to the schema directory.
   * Can be relative (from project root) or absolute.
   * @example './packages/sso-client/database/schemas'
   */
  readonly path: string;

  /**
   * Optional namespace prefix for schemas from this path.
   * Used for organizing schemas from different packages.
   * @example 'Sso'
   */
  readonly namespace?: string;

  /**
   * Package-level output configuration.
   * When set, generated files for schemas from this path will be placed
   * in the package directory with custom namespaces.
   *
   * @example
   * output: {
   *   laravel: {
   *     base: './packages/sso-client',
   *     modelsNamespace: 'Omnify\\SsoClient\\Models',
   *   }
   * }
   */
  readonly output?: PackageOutputConfig;
}

// ============================================================================
// Package Auto-Discovery
// ============================================================================

/**
 * Package discovery configuration.
 * Controls automatic detection of Omnify-enabled packages via composer.json.
 */
export interface DiscoveryConfig {
  /**
   * Enable automatic package discovery.
   * When enabled, reads `.omnify-packages.json` generated by Composer plugin.
   * @default true
   */
  readonly enabled?: boolean;

  /**
   * Package names to exclude from discovery.
   * Useful for disabling problematic or deprecated packages.
   * @example ['vendor/deprecated-package', 'vendor/problematic-package']
   */
  readonly exclude?: readonly string[];
}

/**
 * Package options in the manifest file.
 */
export interface OmnifyPackageOptions {
  /** Generate database migrations. @default true */
  readonly generateMigrations?: boolean;
  /** Generate Eloquent models. @default true */
  readonly generateModels?: boolean;
  /** PHP namespace for generated models */
  readonly modelNamespace?: string;
  /** Output path for migrations */
  readonly migrationsPath?: string;
  /** Output path for factories */
  readonly factoriesPath?: string;
  /** Generate Laravel service provider. @default true */
  readonly generateServiceProvider?: boolean;
  /** Extensible - additional options */
  readonly [key: string]: unknown;
}

/**
 * Single package configuration in the manifest.
 */
export interface OmnifyPackageConfig {
  /** Path to schema directory (relative to project root) */
  readonly schemas: string;
  /** Namespace prefix for schemas */
  readonly namespace?: string;
  /** Package version (for tracking) */
  readonly version?: string;
  /** Processing priority (lower = processed first). @default 100 */
  readonly priority?: number;
  /** Generation options */
  readonly options?: OmnifyPackageOptions;
}

/**
 * Structure of `.omnify-packages.json` manifest file.
 * Generated by Composer plugin when packages are installed.
 */
export interface OmnifyPackagesManifest {
  /** JSON Schema URL for validation */
  readonly $schema?: string;
  /** Manifest format version (currently 1) */
  readonly version: number;
  /** ISO 8601 timestamp when file was generated */
  readonly generated_at?: string;
  /** Map of package name → configuration */
  readonly packages: Record<string, OmnifyPackageConfig>;
}

// ============================================================================
// Main Configuration
// ============================================================================

/**
 * Main omnify configuration interface.
 * Used in omnify.config.ts files.
 */
export interface OmnifyConfig {
  /**
   * Directory containing schema definition files.
   * @default './schemas'
   */
  readonly schemasDir?: string;

  /**
   * Additional schema paths from packages or other directories.
   * Schemas from these paths will be merged with the main schemasDir.
   * Package schemas won't override main schemas with the same name.
   *
   * @example
   * additionalSchemaPaths: [
   *   { path: './packages/sso-client/database/schemas', namespace: 'Sso' },
   *   { path: './packages/billing/schemas', namespace: 'Billing' },
   * ]
   */
  readonly additionalSchemaPaths?: readonly AdditionalSchemaPath[];

  /**
   * Package auto-discovery configuration.
   * When enabled, automatically detects Omnify-enabled packages from
   * `.omnify-packages.json` generated by the Composer plugin.
   *
   * @example
   * discovery: {
   *   enabled: true,
   *   exclude: ['vendor/deprecated-package'],
   * }
   *
   * @default { enabled: true }
   */
  readonly discovery?: DiscoveryConfig;

  /**
   * Database configuration.
   */
  readonly database: DatabaseConfig;

  /**
   * Output configuration for generated files.
   */
  readonly output?: OutputConfig;

  /**
   * Plugins to load for custom types.
   * Can be npm package names or plugin objects.
   */
  readonly plugins?: readonly (string | OmnifyPlugin)[];

  /**
   * Enable verbose logging.
   * @default false
   */
  readonly verbose?: boolean;

  /**
   * Lock file path for tracking schema state.
   * @default '.omnify.lock'
   */
  readonly lockFilePath?: string;

  /**
   * Locale configuration for multi-language support.
   * Used for displayName, description, and other localizable strings.
   *
   * @example
   * locale: {
   *   locales: ['en', 'ja', 'vi'],
   *   defaultLocale: 'en',
   *   fallbackLocale: 'en'
   * }
   */
  readonly locale?: LocaleConfig;
}

/**
 * Resolved configuration with all defaults applied.
 * locale is optional since multi-language support is opt-in.
 * additionalSchemaPaths is optional since it's not required.
 * discovery is optional with defaults applied.
 */
export interface ResolvedOmnifyConfig extends Required<Omit<OmnifyConfig, 'plugins' | 'locale' | 'additionalSchemaPaths' | 'discovery'>> {
  readonly plugins: readonly OmnifyPlugin[];
  readonly locale?: LocaleConfig;
  readonly additionalSchemaPaths?: readonly AdditionalSchemaPath[];
  readonly discovery: DiscoveryConfig;
}

/**
 * Configuration file loading result.
 */
export interface ConfigLoadResult {
  config: ResolvedOmnifyConfig;
  configPath: string | null;
}
