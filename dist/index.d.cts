import { OmnifyPlugin, LocaleConfig } from '@famgia/omnify-types';
import { Command } from 'commander';
import { OmnifyError } from '@famgia/omnify-core';

/**
 * @famgia/omnify-cli - Configuration Types
 *
 * Inline type definitions for omnify.config.ts configuration file.
 * これらの型定義は @famgia/omnify-types からのコピーです。
 * pnpm symlink解決問題を回避するため、直接インライン化しています。
 */

/**
 * Supported database drivers.
 */
type DatabaseDriver = 'mysql' | 'pgsql' | 'postgres' | 'sqlite' | 'sqlsrv' | 'mariadb';
/**
 * Database configuration for Atlas and migrations.
 */
interface DatabaseConfig {
    /** Database driver type */
    readonly driver: DatabaseDriver;
    /** Development database URL for Atlas diff operations */
    readonly devUrl?: string;
    /** Enable field comments in migrations (MySQL only) */
    readonly enableFieldComments?: boolean;
}
/**
 * Laravel output configuration.
 */
interface LaravelOutputConfig {
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
interface TypeScriptOutputConfig {
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
interface OutputConfig {
    /** Laravel migration and model output */
    readonly laravel?: LaravelOutputConfig;
    /** TypeScript type definitions output */
    readonly typescript?: TypeScriptOutputConfig;
}
/**
 * Package-level Laravel output configuration.
 * パッケージ独自の出力パスとnamespaceを定義可能
 */
interface PackageLaravelOutputConfig {
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
interface PackageOutputConfig {
    /** Laravel output configuration for the package */
    readonly laravel?: PackageLaravelOutputConfig;
}
/**
 * Additional schema path entry for loading schemas from packages.
 */
interface AdditionalSchemaPath {
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
/**
 * Package discovery configuration.
 * Controls automatic detection of Omnify-enabled packages via composer.json.
 */
interface DiscoveryConfig {
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
 * Main omnify configuration interface.
 * Used in omnify.config.ts files.
 */
interface OmnifyConfig {
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
interface ResolvedOmnifyConfig extends Required<Omit<OmnifyConfig, 'plugins' | 'locale' | 'additionalSchemaPaths' | 'discovery'>> {
    readonly plugins: readonly OmnifyPlugin[];
    readonly locale?: LocaleConfig;
    readonly additionalSchemaPaths?: readonly AdditionalSchemaPath[];
    readonly discovery: DiscoveryConfig;
}
/**
 * Configuration file loading result.
 */
interface ConfigLoadResult {
    config: ResolvedOmnifyConfig;
    configPath: string | null;
}

/**
 * @famgia/omnify-cli - Configuration Loader
 *
 * Loads and resolves omnify.config.ts configuration.
 */

/**
 * Loads configuration from file or returns defaults.
 */
declare function loadConfig(startDir?: string): Promise<ConfigLoadResult>;
/**
 * Helper function for type-safe configuration.
 * Used in omnify.config.ts files.
 */
declare function defineConfig(config: OmnifyConfig): OmnifyConfig;

/**
 * @famgia/omnify-cli - Init Command
 *
 * Initializes a new omnify project with interactive configuration.
 */

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
declare function runInit(options: InitOptions): Promise<void>;
/**
 * Registers the init command.
 */
declare function registerInitCommand(program: Command): void;

/**
 * @famgia/omnify-cli - Validate Command
 *
 * Validates schema files for syntax and semantic errors.
 */

/**
 * Registers the validate command.
 */
declare function registerValidateCommand(program: Command): void;

/**
 * @famgia/omnify-cli - Diff Command
 *
 * Shows pending schema changes without generating migrations.
 */

/**
 * Registers the diff command.
 */
declare function registerDiffCommand(program: Command): void;

/**
 * @famgia/omnify-cli - Generate Command
 *
 * Generates Laravel migrations and TypeScript types from schemas.
 * Supports both direct generation and plugin-based generation.
 */

/**
 * Registers the generate command.
 */
declare function registerGenerateCommand(program: Command): void;

/**
 * @famgia/omnify-cli - Logger
 *
 * CLI output and logging utilities.
 */

/**
 * Logger options.
 */
interface LoggerOptions {
    /** Enable verbose logging */
    verbose?: boolean;
    /** Suppress all output except errors */
    quiet?: boolean;
}
/**
 * CLI Logger for formatted output.
 */
declare class Logger {
    private _verbose;
    private _quiet;
    private _startTime;
    constructor(options?: LoggerOptions);
    /**
     * Enable or disable verbose mode.
     */
    setVerbose(verbose: boolean): void;
    /**
     * Enable or disable quiet mode.
     */
    setQuiet(quiet: boolean): void;
    /**
     * Log an info message.
     */
    info(message: string): void;
    /**
     * Log a success message.
     */
    success(message: string): void;
    /**
     * Log a warning message.
     */
    warn(message: string): void;
    /**
     * Log an error message.
     */
    error(message: string): void;
    /**
     * Log a debug message (only in verbose mode).
     */
    debug(message: string): void;
    /**
     * Log a step message.
     */
    step(message: string): void;
    /**
     * Log a header.
     */
    header(message: string): void;
    /**
     * Log a list item.
     */
    list(items: string[]): void;
    /**
     * Log a timing message.
     */
    timing(message: string): void;
    /**
     * Log an empty line.
     */
    newline(): void;
    /**
     * Format and log an OmnifyError.
     */
    formatError(error: OmnifyError): void;
    /**
     * Get exit code for an error.
     */
    getExitCode(error: OmnifyError): number;
}
/**
 * Global logger instance.
 */
declare const logger: Logger;

export { type AdditionalSchemaPath, type DatabaseConfig, type DatabaseDriver, type LaravelOutputConfig, type OmnifyConfig, type OutputConfig, type PackageLaravelOutputConfig, type PackageOutputConfig, type ResolvedOmnifyConfig, type TypeScriptOutputConfig, defineConfig, loadConfig, logger, registerDiffCommand, registerGenerateCommand, registerInitCommand, registerValidateCommand, runInit };
