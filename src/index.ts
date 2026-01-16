/**
 * @famgia/omnify-cli
 * Command-line interface for omnify-schema
 *
 * This file contains only exports (no side effects).
 * For CLI execution, import './cli.js' instead.
 */

// Re-export for programmatic usage
export { defineConfig, loadConfig } from './config/index.js';
export type {
  OmnifyConfig,
  ResolvedOmnifyConfig,
  DatabaseConfig,
  DatabaseDriver,
  OutputConfig,
  LaravelOutputConfig,
  TypeScriptOutputConfig,
  AdditionalSchemaPath,
  PackageLaravelOutputConfig,
  PackageOutputConfig,
} from './config/types.js';

// Export commands for programmatic usage
export { runInit, registerInitCommand } from './commands/init.js';
export { registerValidateCommand } from './commands/validate.js';
export { registerDiffCommand } from './commands/diff.js';
export { registerGenerateCommand } from './commands/generate.js';

// Export logger for plugins
export { logger } from './output/logger.js';
