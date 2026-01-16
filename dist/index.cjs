"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  defineConfig: () => defineConfig,
  loadConfig: () => loadConfig,
  logger: () => logger,
  registerDiffCommand: () => registerDiffCommand,
  registerGenerateCommand: () => registerGenerateCommand,
  registerInitCommand: () => registerInitCommand,
  registerValidateCommand: () => registerValidateCommand,
  runInit: () => runInit
});
module.exports = __toCommonJS(index_exports);

// src/config/loader.ts
var import_node_fs2 = require("fs");
var import_node_path2 = require("path");
var import_jiti = require("jiti");
var import_omnify_core2 = require("@famgia/omnify-core");

// src/config/discovery.ts
var import_node_fs = require("fs");
var import_node_path = require("path");

// src/output/logger.ts
var import_picocolors = __toESM(require("picocolors"), 1);
var import_omnify_core = require("@famgia/omnify-core");
var Logger = class {
  _verbose;
  _quiet;
  _startTime;
  constructor(options = {}) {
    this._verbose = options.verbose ?? false;
    this._quiet = options.quiet ?? false;
    this._startTime = Date.now();
  }
  /**
   * Enable or disable verbose mode.
   */
  setVerbose(verbose) {
    this._verbose = verbose;
  }
  /**
   * Enable or disable quiet mode.
   */
  setQuiet(quiet) {
    this._quiet = quiet;
  }
  /**
   * Log an info message.
   */
  info(message) {
    if (!this._quiet) {
      console.log(message);
    }
  }
  /**
   * Log a success message.
   */
  success(message) {
    if (!this._quiet) {
      console.log(import_picocolors.default.green("\u2713") + " " + message);
    }
  }
  /**
   * Log a warning message.
   */
  warn(message) {
    if (!this._quiet) {
      console.log(import_picocolors.default.yellow("\u26A0") + " " + import_picocolors.default.yellow(message));
    }
  }
  /**
   * Log an error message.
   */
  error(message) {
    console.error(import_picocolors.default.red("\u2717") + " " + import_picocolors.default.red(message));
  }
  /**
   * Log a debug message (only in verbose mode).
   */
  debug(message) {
    if (this._verbose && !this._quiet) {
      console.log(import_picocolors.default.dim("  " + message));
    }
  }
  /**
   * Log a step message.
   */
  step(message) {
    if (!this._quiet) {
      console.log(import_picocolors.default.cyan("\u2192") + " " + message);
    }
  }
  /**
   * Log a header.
   */
  header(message) {
    if (!this._quiet) {
      console.log();
      console.log(import_picocolors.default.bold(message));
      console.log();
    }
  }
  /**
   * Log a list item.
   */
  list(items) {
    if (!this._quiet) {
      for (const item of items) {
        console.log("  \u2022 " + item);
      }
    }
  }
  /**
   * Log a timing message.
   */
  timing(message) {
    if (this._verbose && !this._quiet) {
      const elapsed = Date.now() - this._startTime;
      console.log(import_picocolors.default.dim(`  [${elapsed}ms] ${message}`));
    }
  }
  /**
   * Log an empty line.
   */
  newline() {
    if (!this._quiet) {
      console.log();
    }
  }
  /**
   * Format and log an OmnifyError.
   */
  formatError(error) {
    const formatted = (0, import_omnify_core.formatError)(error, { color: true });
    console.error(formatted);
  }
  /**
   * Get exit code for an error.
   */
  getExitCode(error) {
    return (0, import_omnify_core.getExitCode)(error);
  }
};
var logger = new Logger();

// src/config/discovery.ts
var MANIFEST_FILENAME = ".omnify-packages.json";
var MANIFEST_VERSION = 1;
function loadPackageManifest(projectRoot) {
  const manifestPath = (0, import_node_path.resolve)(projectRoot, MANIFEST_FILENAME);
  if (!(0, import_node_fs.existsSync)(manifestPath)) {
    logger.debug(`Package manifest not found: ${manifestPath}`);
    return null;
  }
  try {
    const content = (0, import_node_fs.readFileSync)(manifestPath, "utf-8");
    const manifest = JSON.parse(content);
    if (manifest.version !== MANIFEST_VERSION) {
      logger.warn(
        `Package manifest version mismatch: expected ${MANIFEST_VERSION}, got ${manifest.version}. Run \`composer dump-autoload\` to regenerate.`
      );
    }
    return manifest;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to read package manifest: ${message}`);
    return null;
  }
}
function packageConfigToSchemaPath(packageName, config) {
  const result = {
    path: config.schemas,
    namespace: config.namespace
  };
  if (config.options) {
    const opts = config.options;
    const basePath = config.schemas.replace(/\/database\/schemas\/?$/, "");
    const laravelOutput = {
      base: basePath
    };
    if (opts.modelNamespace) {
      laravelOutput.modelsNamespace = opts.modelNamespace;
    }
    if (opts.migrationsPath) {
      laravelOutput.migrationsPath = opts.migrationsPath.replace(basePath + "/", "");
    }
    if (opts.factoriesPath) {
      laravelOutput.factoriesPath = opts.factoriesPath.replace(basePath + "/", "");
    }
    if (opts.generateServiceProvider !== void 0) {
      laravelOutput.generateServiceProvider = opts.generateServiceProvider;
    }
    if (opts.generateMigrations !== void 0) {
      laravelOutput.generateMigrations = opts.generateMigrations;
    }
    if (opts.generateModels !== void 0) {
      laravelOutput.generateModels = opts.generateModels;
    }
    result.output = { laravel: laravelOutput };
  }
  return result;
}
function discoverPackages(projectRoot, discoveryConfig, explicitPaths) {
  const result = [];
  const excludeSet = new Set(discoveryConfig.exclude ?? []);
  if (discoveryConfig.enabled !== false) {
    const manifest = loadPackageManifest(projectRoot);
    if (manifest) {
      const sortedPackages = Object.entries(manifest.packages).sort(
        ([, a], [, b]) => (a.priority ?? 100) - (b.priority ?? 100)
      );
      for (const [packageName, config] of sortedPackages) {
        if (excludeSet.has(packageName)) {
          logger.debug(`Skipping excluded package: ${packageName}`);
          continue;
        }
        const schemasPath = (0, import_node_path.resolve)(projectRoot, config.schemas);
        if (!(0, import_node_fs.existsSync)(schemasPath)) {
          logger.debug(`Package schemas not found, skipping: ${schemasPath}`);
          continue;
        }
        result.push(packageConfigToSchemaPath(packageName, config));
        logger.debug(`Discovered package: ${packageName} (${config.namespace ?? "no namespace"})`);
      }
      if (result.length > 0) {
        logger.info(`Auto-discovered ${result.length} package(s) from ${MANIFEST_FILENAME}`);
      }
    }
  }
  if (explicitPaths?.length) {
    result.push(...explicitPaths);
  }
  return result;
}

// src/config/loader.ts
var CONFIG_FILES = [
  "omnify.config.ts",
  "omnify.config.js",
  "omnify.config.mjs",
  "omnify.config.cjs"
];
function findConfigFile(startDir) {
  const cwd = (0, import_node_path2.resolve)(startDir);
  for (const filename of CONFIG_FILES) {
    const configPath = (0, import_node_path2.resolve)(cwd, filename);
    if ((0, import_node_fs2.existsSync)(configPath)) {
      return configPath;
    }
  }
  return null;
}
async function loadConfigFile(configPath) {
  const jiti = (0, import_jiti.createJiti)(configPath, {
    interopDefault: true,
    moduleCache: false
  });
  try {
    const module2 = await jiti.import(configPath);
    const config = module2;
    if ("default" in config) {
      return config.default;
    }
    return config;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw (0, import_omnify_core2.configError)(
      `Failed to load config file: ${message}. Check your omnify.config.ts for syntax errors.`,
      "E002"
    );
  }
}
async function resolvePlugins(plugins, configPath) {
  if (!plugins || plugins.length === 0) {
    return [];
  }
  const resolved = [];
  const configDir = configPath ? (0, import_node_path2.dirname)(configPath) : process.cwd();
  for (const plugin of plugins) {
    if (typeof plugin === "string") {
      const jiti = (0, import_jiti.createJiti)(configDir, {
        interopDefault: true,
        moduleCache: false
      });
      try {
        const module2 = await jiti.import(plugin);
        const loadedPlugin = module2.default ?? module2;
        resolved.push(loadedPlugin);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw (0, import_omnify_core2.configError)(
          `Failed to load plugin '${plugin}': ${message}. Ensure the plugin is installed: npm install ${plugin}`,
          "E301"
        );
      }
    } else {
      resolved.push(plugin);
    }
  }
  return resolved;
}
async function resolveConfig(userConfig, configPath) {
  const plugins = await resolvePlugins(userConfig.plugins, configPath);
  const projectRoot = configPath ? (0, import_node_path2.dirname)(configPath) : process.cwd();
  const discovery = {
    enabled: userConfig.discovery?.enabled ?? true,
    exclude: userConfig.discovery?.exclude
  };
  const allSchemaPaths = discoverPackages(
    projectRoot,
    discovery,
    userConfig.additionalSchemaPaths
  );
  const databaseConfig = {
    driver: userConfig.database.driver,
    enableFieldComments: userConfig.database.enableFieldComments ?? false
  };
  const database = userConfig.database.devUrl !== void 0 ? { ...databaseConfig, devUrl: userConfig.database.devUrl } : databaseConfig;
  const laravelConfig = {
    migrationsPath: userConfig.output?.laravel?.migrationsPath ?? "database/migrations"
  };
  const laravel = buildLaravelConfig(laravelConfig, userConfig.output?.laravel);
  const tsConfig = userConfig.output?.typescript;
  const typescript = {
    path: tsConfig?.path ?? "types",
    schemasDir: tsConfig?.schemasDir ?? "schemas",
    enumDir: tsConfig?.enumDir ?? "enum",
    singleFile: tsConfig?.singleFile ?? true,
    generateEnums: tsConfig?.generateEnums ?? true,
    generateRelationships: tsConfig?.generateRelationships ?? true
  };
  const result = {
    schemasDir: userConfig.schemasDir ?? "./schemas",
    database,
    output: {
      laravel,
      typescript
    },
    plugins,
    verbose: userConfig.verbose ?? false,
    lockFilePath: userConfig.lockFilePath ?? ".omnify.lock",
    discovery,
    ...userConfig.locale && { locale: userConfig.locale },
    ...allSchemaPaths.length > 0 && { additionalSchemaPaths: allSchemaPaths }
  };
  return result;
}
function buildLaravelConfig(base, userLaravel) {
  const config = { ...base };
  if (userLaravel?.modelsPath !== void 0) {
    config.modelsPath = userLaravel.modelsPath;
  }
  if (userLaravel?.baseModelsPath !== void 0) {
    config.baseModelsPath = userLaravel.baseModelsPath;
  }
  if (userLaravel?.providersPath !== void 0) {
    config.providersPath = userLaravel.providersPath;
  }
  if (userLaravel?.modelsNamespace !== void 0) {
    config.modelsNamespace = userLaravel.modelsNamespace;
  }
  if (userLaravel?.factoriesPath !== void 0) {
    config.factoriesPath = userLaravel.factoriesPath;
  }
  if (userLaravel?.enumsPath !== void 0) {
    config.enumsPath = userLaravel.enumsPath;
  }
  if (userLaravel?.enumsNamespace !== void 0) {
    config.enumsNamespace = userLaravel.enumsNamespace;
  }
  return config;
}
function validateConfig(config, rootDir) {
  const schemaPath = (0, import_node_path2.resolve)(rootDir, config.schemasDir);
  if (!(0, import_node_fs2.existsSync)(schemaPath)) {
    throw (0, import_omnify_core2.configError)(
      `Schema directory not found: ${schemaPath}. Create the '${config.schemasDir}' directory or update schemasDir in config.`,
      "E002"
    );
  }
}
function requireDevUrl(config) {
  if (!config.database.devUrl) {
    throw (0, import_omnify_core2.configError)(
      `database.devUrl is required for diff and generate operations. Add devUrl to your database config, e.g., "mysql://root@localhost:3306/omnify_dev"`,
      "E003"
    );
  }
}
async function loadConfig(startDir = process.cwd()) {
  const cwd = (0, import_node_path2.resolve)(startDir);
  const configPath = findConfigFile(cwd);
  if (configPath) {
    const userConfig = await loadConfigFile(configPath);
    const config = await resolveConfig(userConfig, configPath);
    return {
      config,
      configPath
    };
  }
  throw (0, import_omnify_core2.configNotFoundError)((0, import_node_path2.resolve)(cwd, "omnify.config.ts"));
}
function defineConfig(config) {
  return config;
}

// src/config/alias-config.ts
var import_node_fs3 = require("fs");
var import_node_path3 = require("path");
function hasViteOmnifyAlias(content) {
  return content.includes("'@omnify'") || content.includes('"@omnify"') || content.includes("@omnify:") || content.includes("'@omnify/");
}
function hasViteOmnifyClientAlias(content) {
  return content.includes("'@omnify-client'") || content.includes('"@omnify-client"') || content.includes("@omnify-client/");
}
function hasTsconfigOmnifyPath(content) {
  return content.includes('"@omnify/*"') || content.includes("'@omnify/*'") || content.includes('"@omnify/"');
}
function updateViteConfig(rootDir, omnifyPath = "omnify") {
  const configPaths = [
    (0, import_node_path3.resolve)(rootDir, "vite.config.ts"),
    (0, import_node_path3.resolve)(rootDir, "vite.config.js"),
    (0, import_node_path3.resolve)(rootDir, "vite.config.mts"),
    (0, import_node_path3.resolve)(rootDir, "vite.config.mjs")
  ];
  const configPath = configPaths.find((p) => (0, import_node_fs3.existsSync)(p));
  if (!configPath) {
    return { updated: false, skipped: true };
  }
  try {
    let content = (0, import_node_fs3.readFileSync)(configPath, "utf-8");
    if (hasViteOmnifyAlias(content)) {
      return { updated: false, skipped: true };
    }
    const aliasPatterns = [
      // Pattern 1: resolve: { alias: { ... } }
      /resolve\s*:\s*\{[^}]*alias\s*:\s*\{/,
      // Pattern 2: alias: { ... } directly in defineConfig
      /alias\s*:\s*\{/
    ];
    let updated = false;
    for (const pattern of aliasPatterns) {
      const match = content.match(pattern);
      if (match) {
        const insertPoint = match.index + match[0].length;
        const aliasLine = `
      '@omnify': path.resolve(__dirname, '${omnifyPath}'),`;
        content = content.slice(0, insertPoint) + aliasLine + content.slice(insertPoint);
        updated = true;
        break;
      }
    }
    if (!updated) {
      const resolvePattern = /resolve\s*:\s*\{/;
      const resolveMatch = content.match(resolvePattern);
      if (resolveMatch) {
        const insertPoint = resolveMatch.index + resolveMatch[0].length;
        const aliasSection = `
    alias: {
      '@omnify': path.resolve(__dirname, '${omnifyPath}'),
    },`;
        content = content.slice(0, insertPoint) + aliasSection + content.slice(insertPoint);
        updated = true;
      }
    }
    if (!updated) {
      const defineConfigPattern = /defineConfig\s*\(\s*\{/;
      const defineConfigMatch = content.match(defineConfigPattern);
      if (defineConfigMatch) {
        const insertPoint = defineConfigMatch.index + defineConfigMatch[0].length;
        const resolveSection = `
  resolve: {
    alias: {
      '@omnify': path.resolve(__dirname, '${omnifyPath}'),
    },
  },`;
        content = content.slice(0, insertPoint) + resolveSection + content.slice(insertPoint);
        if (!content.includes("import path from") && !content.includes("import * as path")) {
          content = `import path from 'path';
` + content;
        }
        updated = true;
      }
    }
    if (updated) {
      if (!content.includes("import path from") && !content.includes("import * as path") && !content.includes("require('path')")) {
        const importMatch = content.match(/^(import .+;\n)+/m);
        if (importMatch) {
          const insertPoint = importMatch.index + importMatch[0].length;
          content = content.slice(0, insertPoint) + "import path from 'path';\n" + content.slice(insertPoint);
        } else {
          content = "import path from 'path';\n" + content;
        }
      }
      (0, import_node_fs3.writeFileSync)(configPath, content);
      return { updated: true, skipped: false };
    }
    return {
      updated: false,
      skipped: false,
      error: "Could not find suitable location to add alias. Please add manually."
    };
  } catch (error) {
    return {
      updated: false,
      skipped: false,
      error: `Failed to update vite.config: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
function updateTsconfig(rootDir, omnifyPath = "omnify") {
  const configPath = (0, import_node_path3.resolve)(rootDir, "tsconfig.json");
  if (!(0, import_node_fs3.existsSync)(configPath)) {
    return { updated: false, skipped: true };
  }
  try {
    const content = (0, import_node_fs3.readFileSync)(configPath, "utf-8");
    if (hasTsconfigOmnifyPath(content)) {
      return { updated: false, skipped: true };
    }
    const jsonContent = content.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    let config;
    try {
      config = JSON.parse(jsonContent);
    } catch {
      return {
        updated: false,
        skipped: false,
        error: "Could not parse tsconfig.json as JSON"
      };
    }
    if (!config.compilerOptions) {
      config.compilerOptions = {};
    }
    const compilerOptions = config.compilerOptions;
    if (!compilerOptions.paths) {
      compilerOptions.paths = {};
    }
    const paths = compilerOptions.paths;
    paths["@omnify/*"] = [`./${omnifyPath}/*`];
    const newContent = JSON.stringify(config, null, 2);
    (0, import_node_fs3.writeFileSync)(configPath, newContent + "\n");
    return { updated: true, skipped: false };
  } catch (error) {
    return {
      updated: false,
      skipped: false,
      error: `Failed to update tsconfig.json: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
function configureOmnifyAlias(rootDir, omnifyPath = "omnify", silent = false) {
  const result = {
    viteUpdated: false,
    tsconfigUpdated: false,
    viteSkipped: false,
    tsconfigSkipped: false,
    errors: []
  };
  const viteResult = updateViteConfig(rootDir, omnifyPath);
  result.viteUpdated = viteResult.updated;
  result.viteSkipped = viteResult.skipped;
  if (viteResult.error) {
    result.errors.push(viteResult.error);
  }
  const tsconfigResult = updateTsconfig(rootDir, omnifyPath);
  result.tsconfigUpdated = tsconfigResult.updated;
  result.tsconfigSkipped = tsconfigResult.skipped;
  if (tsconfigResult.error) {
    result.errors.push(tsconfigResult.error);
  }
  if (!silent) {
    if (result.viteUpdated) {
      logger.success("Updated vite.config - Added @omnify alias");
    }
    if (result.tsconfigUpdated) {
      logger.success("Updated tsconfig.json - Added @omnify/* path");
    }
    if (result.errors.length > 0) {
      for (const error of result.errors) {
        logger.warn(error);
      }
    }
  }
  return result;
}
function addPluginEnumAlias(rootDir) {
  const configPaths = [
    (0, import_node_path3.resolve)(rootDir, "vite.config.ts"),
    (0, import_node_path3.resolve)(rootDir, "vite.config.js"),
    (0, import_node_path3.resolve)(rootDir, "vite.config.mts"),
    (0, import_node_path3.resolve)(rootDir, "vite.config.mjs")
  ];
  const configPath = configPaths.find((p) => (0, import_node_fs3.existsSync)(p));
  if (!configPath) {
    return { updated: false };
  }
  try {
    let content = (0, import_node_fs3.readFileSync)(configPath, "utf-8");
    if (hasViteOmnifyClientAlias(content)) {
      return { updated: false };
    }
    const lines = content.split("\n");
    let insertIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if ((line.includes("'@omnify'") || line.includes('"@omnify"')) && line.includes(":")) {
        for (let j = i; j < lines.length; j++) {
          if (lines[j].includes("),") || lines[j].trim().endsWith(",") && lines[j].includes(")")) {
            insertIndex = j + 1;
            break;
          }
        }
        break;
      }
    }
    if (insertIndex > 0) {
      const indent = "      ";
      const aliasLine = `${indent}'@omnify-client': path.resolve(__dirname, 'node_modules/@omnify-client'),`;
      lines.splice(insertIndex, 0, aliasLine);
      content = lines.join("\n");
      (0, import_node_fs3.writeFileSync)(configPath, content);
      return { updated: true };
    }
    return { updated: false, error: "Could not find @omnify alias to add @omnify-client after" };
  } catch (error) {
    return {
      updated: false,
      error: `Failed to add plugin enum alias: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
function addPluginEnumTsconfigPath(rootDir) {
  const configPath = (0, import_node_path3.resolve)(rootDir, "tsconfig.json");
  if (!(0, import_node_fs3.existsSync)(configPath)) {
    return { updated: false };
  }
  try {
    const content = (0, import_node_fs3.readFileSync)(configPath, "utf-8");
    if (content.includes("@omnify-client")) {
      return { updated: false };
    }
    const jsonContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
    const config = JSON.parse(jsonContent);
    if (!config.compilerOptions) {
      config.compilerOptions = {};
    }
    if (!config.compilerOptions.paths) {
      config.compilerOptions.paths = {};
    }
    config.compilerOptions.paths["@omnify-client/*"] = ["./node_modules/@omnify-client/*"];
    (0, import_node_fs3.writeFileSync)(configPath, JSON.stringify(config, null, 2));
    return { updated: true };
  } catch (error) {
    return {
      updated: false,
      error: `Failed to add plugin enum tsconfig path: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// src/commands/init.ts
var import_node_fs4 = require("fs");
var import_node_path4 = require("path");
var import_prompts = require("@inquirer/prompts");
var EXAMPLE_SCHEMA = `# Example User schema
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
function generateConfig(config) {
  const imports = [`import { defineConfig } from '@famgia/omnify';`];
  const plugins = [];
  if (config.migrationTool === "laravel") {
    imports.push(`import laravel from '@famgia/omnify-laravel/plugin';`);
    plugins.push(`    laravel({
      migrationsPath: '${config.migrationsPath}',
      typesPath: '${config.typesPath}',
      singleFile: true,
      generateMigrations: true,
      generateTypes: ${config.generateTypes},
    }),`);
  }
  if (config.migrationTool === "prisma") {
    plugins.push(`    // Prisma plugin coming soon!
    // prisma({ schemaPath: 'prisma/schema.prisma' }),`);
  }
  if (config.migrationTool === "drizzle") {
    plugins.push(`    // Drizzle plugin coming soon!
    // drizzle({ schemaPath: 'src/db/schema.ts' }),`);
  }
  if (config.migrationTool === "none" && config.generateTypes) {
    imports.push(`import laravel from '@famgia/omnify-laravel/plugin';`);
    plugins.push(`    laravel({
      typesPath: '${config.typesPath}',
      generateMigrations: false,
      generateTypes: true,
    }),`);
  }
  const dbUrlExamples = {
    mysql: "mysql://root:password@localhost:3306/omnify_dev",
    postgres: "postgres://postgres:password@localhost:5432/omnify_dev",
    sqlite: "sqlite://./omnify_dev.db"
  };
  return `${imports.join("\n")}

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
${plugins.join("\n\n")}
  ],
});
`;
}
async function runInit(options) {
  const cwd = process.cwd();
  logger.header("Omnify Project Setup");
  logger.newline();
  const configPath = (0, import_node_path4.resolve)(cwd, "omnify.config.ts");
  if ((0, import_node_fs4.existsSync)(configPath) && !options.force) {
    logger.warn("omnify.config.ts already exists. Use --force to overwrite.");
    return;
  }
  let config;
  if (options.yes) {
    config = {
      database: "mysql",
      migrationTool: "laravel",
      generateTypes: true,
      migrationsPath: "database/migrations",
      typesPath: "resources/js/types",
      schemasDir: "./schemas"
    };
    logger.info("Using default configuration...");
  } else {
    logger.info("Answer a few questions to configure your project:\n");
    const database = await (0, import_prompts.select)({
      message: "Which database?",
      choices: [
        { name: "MySQL / MariaDB", value: "mysql" },
        { name: "PostgreSQL", value: "postgres" },
        { name: "SQLite", value: "sqlite" }
      ],
      default: "mysql"
    });
    const migrationTool = await (0, import_prompts.select)({
      message: "Which migration tool?",
      choices: [
        { name: "Laravel (PHP)", value: "laravel" },
        { name: "Prisma (coming soon)", value: "prisma", disabled: true },
        { name: "Drizzle (coming soon)", value: "drizzle", disabled: true },
        { name: "None (types only)", value: "none" }
      ],
      default: "laravel"
    });
    const generateTypes = await (0, import_prompts.confirm)({
      message: "Generate TypeScript types?",
      default: true
    });
    const defaultPaths = {
      laravel: { migrations: "database/migrations", types: "resources/js/types" },
      prisma: { migrations: "prisma/migrations", types: "src/types" },
      drizzle: { migrations: "drizzle", types: "src/types" },
      none: { migrations: "", types: "types" }
    };
    const defaults = defaultPaths[migrationTool];
    let migrationsPath = defaults.migrations;
    let typesPath = defaults.types;
    if (migrationTool !== "none") {
      migrationsPath = await (0, import_prompts.input)({
        message: "Migrations output path:",
        default: defaults.migrations
      });
    }
    if (generateTypes) {
      typesPath = await (0, import_prompts.input)({
        message: "TypeScript types path:",
        default: defaults.types
      });
    }
    const schemasDir2 = await (0, import_prompts.input)({
      message: "Schemas directory:",
      default: "./schemas"
    });
    config = {
      database,
      migrationTool,
      generateTypes,
      migrationsPath,
      typesPath,
      schemasDir: schemasDir2
    };
  }
  logger.newline();
  logger.step("Creating project files...");
  const schemasDir = (0, import_node_path4.resolve)(cwd, config.schemasDir);
  if (!(0, import_node_fs4.existsSync)(schemasDir)) {
    (0, import_node_fs4.mkdirSync)(schemasDir, { recursive: true });
    logger.debug(`Created ${config.schemasDir}/ directory`);
  }
  const examplePath = (0, import_node_path4.resolve)(schemasDir, "User.yaml");
  if (!(0, import_node_fs4.existsSync)(examplePath) || options.force) {
    (0, import_node_fs4.writeFileSync)(examplePath, EXAMPLE_SCHEMA);
    logger.debug("Created example schema: User.yaml");
  }
  const configContent = generateConfig(config);
  (0, import_node_fs4.writeFileSync)(configPath, configContent);
  logger.debug("Created omnify.config.ts");
  if (config.generateTypes) {
    logger.step("Configuring @omnify path alias...");
    const aliasResult = configureOmnifyAlias(cwd, "omnify", false);
    if (!aliasResult.viteUpdated && !aliasResult.tsconfigUpdated) {
      if (!aliasResult.viteSkipped) {
        logger.info("Note: vite.config not found - you may need to configure @omnify alias manually");
      }
      if (!aliasResult.tsconfigSkipped) {
        logger.info("Note: tsconfig.json not found - you may need to configure @omnify/* path manually");
      }
    }
  }
  logger.newline();
  logger.success("Project initialized!");
  logger.newline();
  const toolName = config.migrationTool === "laravel" ? "Laravel" : config.migrationTool === "prisma" ? "Prisma" : config.migrationTool === "drizzle" ? "Drizzle" : "None";
  logger.info("Configuration:");
  logger.list([
    `Database: ${config.database}`,
    `Migration tool: ${toolName}`,
    `TypeScript types: ${config.generateTypes ? "Yes" : "No"}`
  ]);
  logger.newline();
  logger.info("Files created:");
  logger.list(["omnify.config.ts", `${config.schemasDir}/User.yaml`]);
  logger.newline();
  logger.info("Next steps:");
  logger.newline();
  logger.step("1. Set database URL in omnify.config.ts");
  logger.newline();
  logger.step("2. Define schemas in " + config.schemasDir + "/");
  logger.newline();
  logger.step("3. Generate:");
  logger.info("   npx omnify validate");
  logger.info("   npx omnify generate");
  logger.newline();
}
function registerInitCommand(program) {
  program.command("init").description("Initialize a new omnify project").option("-f, --force", "Overwrite existing files").option("-y, --yes", "Use default configuration (skip prompts)").action(async (options) => {
    try {
      await runInit(options);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("User force closed")) {
          logger.newline();
          logger.info("Setup cancelled.");
          process.exit(0);
        }
        logger.error(error.message);
      }
      process.exit(1);
    }
  });
}

// src/commands/validate.ts
var import_node_fs5 = require("fs");
var import_node_path5 = require("path");
var import_omnify_core3 = require("@famgia/omnify-core");
async function runValidate(options) {
  logger.setVerbose(options.verbose ?? false);
  logger.header("Validating Schemas");
  logger.debug("Loading configuration...");
  logger.timing("Config load start");
  const { config, configPath } = await loadConfig();
  logger.timing("Config loaded");
  const rootDir = configPath ? (0, import_node_path5.dirname)(configPath) : process.cwd();
  validateConfig(config, rootDir);
  const schemaPath = (0, import_node_path5.resolve)(rootDir, config.schemasDir);
  logger.step(`Loading schemas from ${schemaPath}`);
  logger.timing("Schema load start");
  let schemas = await (0, import_omnify_core3.loadSchemas)(schemaPath);
  logger.debug(`Found ${Object.keys(schemas).length} schema(s) in main directory`);
  const additionalPaths = config.additionalSchemaPaths ?? [];
  let hasPackageSchemas = false;
  if (additionalPaths.length > 0) {
    logger.step(`Loading schemas from ${additionalPaths.length} additional path(s)`);
    for (const entry of additionalPaths) {
      const absolutePath = (0, import_node_path5.resolve)(rootDir, entry.path);
      logger.debug(`  Checking: ${entry.path} \u2192 ${absolutePath}`);
      if ((0, import_node_fs5.existsSync)(absolutePath)) {
        const packageSchemas = await (0, import_omnify_core3.loadSchemas)(absolutePath, { skipPartialResolution: true });
        const count = Object.keys(packageSchemas).filter((k) => !k.startsWith("__partial__")).length;
        const partialCount = Object.keys(packageSchemas).filter((k) => k.startsWith("__partial__")).length;
        const nsInfo = entry.namespace ? ` [${entry.namespace}]` : "";
        logger.info(`  \u2022 ${entry.path}${nsInfo}: ${count} schema(s)${partialCount > 0 ? ` + ${partialCount} partial(s)` : ""}`);
        schemas = { ...packageSchemas, ...schemas };
        hasPackageSchemas = true;
      } else {
        logger.warn(`  \u2022 ${entry.path}: directory not found (skipped)`);
      }
    }
  }
  if (hasPackageSchemas) {
    schemas = (0, import_omnify_core3.mergePartialSchemas)(schemas);
  }
  logger.timing("Schemas loaded");
  const schemaCount = Object.keys(schemas).length;
  if (schemaCount === 0) {
    logger.warn("No schema files found");
    return;
  }
  logger.debug(`Total: ${schemaCount} schema(s)`);
  logger.step("Validating schemas...");
  logger.timing("Validation start");
  const result = (0, import_omnify_core3.validateSchemas)(schemas);
  logger.timing("Validation complete");
  if (result.valid) {
    logger.success(`All ${schemaCount} schema(s) are valid`);
  } else {
    logger.error(`Found ${result.errors.length} validation error(s)`);
    logger.newline();
    for (const error of result.errors) {
      const omnifyError = import_omnify_core3.OmnifyError.fromInfo(error);
      logger.formatError(omnifyError);
      logger.newline();
    }
    process.exit(2);
  }
}
function registerValidateCommand(program) {
  program.command("validate").description("Validate schema files").option("-v, --verbose", "Show detailed output").action(async (options) => {
    try {
      await runValidate(options);
    } catch (error) {
      if (error instanceof import_omnify_core3.OmnifyError) {
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

// src/commands/diff.ts
var import_node_fs6 = require("fs");
var import_node_path6 = require("path");
var import_omnify_core4 = require("@famgia/omnify-core");

// src/operations/diff.ts
var import_omnify_atlas = require("@famgia/omnify-atlas");
async function runDiffOperation(options) {
  const { schemas, devUrl, driver, workDir } = options;
  const preview = await (0, import_omnify_atlas.generatePreview)(schemas, {
    driver,
    devUrl,
    workDir
  }, {
    warnDestructive: true,
    showSql: true
  });
  const formattedPreview = (0, import_omnify_atlas.formatPreview)(preview, "text");
  return {
    hasChanges: preview.hasChanges,
    hasDestructiveChanges: preview.hasDestructiveChanges,
    preview,
    formattedPreview,
    sql: preview.sql
  };
}

// src/commands/diff.ts
var import_picocolors2 = __toESM(require("picocolors"), 1);
async function runDiff(options) {
  logger.setVerbose(options.verbose ?? false);
  logger.header("Checking for Schema Changes");
  logger.debug("Loading configuration...");
  const { config, configPath } = await loadConfig();
  const rootDir = configPath ? (0, import_node_path6.dirname)(configPath) : process.cwd();
  validateConfig(config, rootDir);
  requireDevUrl(config);
  const schemaPath = (0, import_node_path6.resolve)(rootDir, config.schemasDir);
  logger.step(`Loading schemas from ${schemaPath}`);
  let schemas = await (0, import_omnify_core4.loadSchemas)(schemaPath);
  logger.debug(`Found ${Object.keys(schemas).length} schema(s) in main directory`);
  const additionalPaths = config.additionalSchemaPaths ?? [];
  let hasPackageSchemas = false;
  if (additionalPaths.length > 0) {
    logger.step(`Loading schemas from ${additionalPaths.length} additional path(s)`);
    for (const entry of additionalPaths) {
      const absolutePath = (0, import_node_path6.resolve)(rootDir, entry.path);
      logger.debug(`  Checking: ${entry.path} \u2192 ${absolutePath}`);
      if ((0, import_node_fs6.existsSync)(absolutePath)) {
        const packageSchemas = await (0, import_omnify_core4.loadSchemas)(absolutePath, { skipPartialResolution: true });
        const count = Object.keys(packageSchemas).filter((k) => !k.startsWith("__partial__")).length;
        const partialCount = Object.keys(packageSchemas).filter((k) => k.startsWith("__partial__")).length;
        const nsInfo = entry.namespace ? ` [${entry.namespace}]` : "";
        logger.info(`  \u2022 ${entry.path}${nsInfo}: ${count} schema(s)${partialCount > 0 ? ` + ${partialCount} partial(s)` : ""}`);
        schemas = { ...packageSchemas, ...schemas };
        hasPackageSchemas = true;
      } else {
        logger.warn(`  \u2022 ${entry.path}: directory not found (skipped)`);
      }
    }
  }
  if (hasPackageSchemas) {
    schemas = (0, import_omnify_core4.mergePartialSchemas)(schemas);
  }
  const schemaCount = Object.keys(schemas).length;
  if (schemaCount === 0) {
    logger.warn("No schema files found");
    return;
  }
  logger.debug(`Total: ${schemaCount} schema(s)`);
  logger.step("Validating schemas...");
  const validationResult = (0, import_omnify_core4.validateSchemas)(schemas);
  if (!validationResult.valid) {
    logger.error("Schema validation failed. Fix errors before running diff.");
    for (const error of validationResult.errors) {
      const omnifyError = import_omnify_core4.OmnifyError.fromInfo(error);
      logger.formatError(omnifyError);
    }
    process.exit(2);
  }
  logger.step("Running Atlas diff...");
  const lockPath = (0, import_node_path6.resolve)(rootDir, config.lockFilePath);
  const diffResult = await runDiffOperation({
    schemas,
    devUrl: config.database.devUrl,
    lockFilePath: lockPath,
    driver: config.database.driver,
    workDir: rootDir
  });
  if (!diffResult.hasChanges) {
    logger.success("No changes detected");
    return;
  }
  logger.newline();
  console.log(import_picocolors2.default.bold("Changes detected:"));
  console.log();
  console.log(diffResult.formattedPreview);
  if (diffResult.hasDestructiveChanges) {
    logger.newline();
    logger.warn("This preview contains destructive changes. Review carefully.");
  }
  if (options.check) {
    logger.newline();
    logger.info("Changes detected (--check mode)");
    process.exit(1);
  }
  logger.newline();
  logger.info('Run "omnify generate" to create migrations');
}
function registerDiffCommand(program) {
  program.command("diff").description("Show pending schema changes").option("-v, --verbose", "Show detailed output").option("--check", "Exit with code 1 if changes exist (for CI)").action(async (options) => {
    try {
      await runDiff(options);
    } catch (error) {
      if (error instanceof import_omnify_core4.OmnifyError) {
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

// src/commands/generate.ts
var import_node_fs8 = require("fs");
var import_node_path8 = require("path");
var import_omnify_core5 = require("@famgia/omnify-core");
var import_omnify_atlas2 = require("@famgia/omnify-atlas");
var import_omnify_laravel = require("@famgia/omnify-laravel");
var import_omnify_typescript = require("@famgia/omnify-typescript");

// src/guides/index.ts
var import_node_fs7 = require("fs");
var import_node_path7 = require("path");
var import_node_url = require("url");
var CLAUDE_MD = `# Omnify Project

This project uses **Omnify** for schema-driven code generation.

## Quick Reference

- **Schema Guide**: @.claude/omnify/guides/omnify/schema-guide.md
- **Config Guide**: @.claude/omnify/guides/omnify/config-guide.md

## Commands

\`\`\`bash
npx omnify generate    # Generate code from schemas
npx omnify validate    # Validate schemas
php artisan migrate    # Run database migrations
\`\`\`

## Critical Rules

### \u26D4 DO NOT EDIT Auto-Generated Files
- \`database/migrations/omnify/**\` - Regenerated on \`npx omnify generate\`
- \`app/Models/OmnifyBase/**\` - Base models (extend, don't edit)
- \`app/Http/Requests/OmnifyBase/**\` - Base requests
- \`app/Http/Resources/OmnifyBase/**\` - Base resources

### \u2705 Schema-First Workflow
1. Edit YAML schema in \`schemas/\`
2. Run \`npx omnify generate\`
3. Run \`php artisan migrate\`

**NEVER use \`php artisan make:migration\`** - Always use schemas!

## Documentation Structure

\`\`\`
.claude/
\u251C\u2500\u2500 CLAUDE.md              # This file (root pointer)
\u251C\u2500\u2500 rules/                 # Claude Code rules (path-specific)
\u2502   \u2514\u2500\u2500 omnify/*.md
\u2514\u2500\u2500 omnify/                # Detailed guides
    \u251C\u2500\u2500 guides/
    \u2502   \u251C\u2500\u2500 omnify/        # Schema & config docs
    \u2502   \u251C\u2500\u2500 laravel/       # Laravel patterns
    \u2502   \u2514\u2500\u2500 react/         # React patterns
    \u251C\u2500\u2500 workflows/         # Step-by-step workflows
    \u2514\u2500\u2500 agents/            # AI agent prompts
\`\`\`

## Individual Preferences

Add your personal preferences in \`CLAUDE.local.md\` (gitignored).
`;
function copyOmnifyGuides(rootDir) {
  let filesWritten = 0;
  const omnifyPkgPaths = [
    (0, import_node_path7.resolve)(rootDir, "node_modules", "@famgia", "omnify", "stubs", "ai-guides", "omnify"),
    (0, import_node_path7.resolve)(rootDir, "node_modules", ".pnpm", "@famgia+omnify@*", "node_modules", "@famgia", "omnify", "stubs", "ai-guides", "omnify")
  ];
  let stubsDir = null;
  for (const pkgPath of omnifyPkgPaths) {
    if (pkgPath.includes("*")) {
      const parentDir = (0, import_node_path7.dirname)((0, import_node_path7.dirname)(pkgPath));
      if ((0, import_node_fs7.existsSync)(parentDir)) {
        const entries = (0, import_node_fs7.readdirSync)(parentDir);
        for (const entry of entries) {
          if (entry.startsWith("@famgia+omnify@")) {
            const testPath = (0, import_node_path7.join)(parentDir, entry, "node_modules", "@famgia", "omnify", "stubs", "ai-guides", "omnify");
            if ((0, import_node_fs7.existsSync)(testPath)) {
              stubsDir = testPath;
              break;
            }
          }
        }
      }
    } else if ((0, import_node_fs7.existsSync)(pkgPath)) {
      stubsDir = pkgPath;
      break;
    }
  }
  if (!stubsDir) {
    try {
      const omnifyPath = (0, import_node_path7.dirname)(require.resolve("@famgia/omnify/package.json", { paths: [rootDir] }));
      const testPath = (0, import_node_path7.join)(omnifyPath, "stubs", "ai-guides", "omnify");
      if ((0, import_node_fs7.existsSync)(testPath)) {
        stubsDir = testPath;
      }
    } catch {
    }
  }
  if (!stubsDir) {
    return 0;
  }
  const destDir = (0, import_node_path7.resolve)(rootDir, ".claude", "omnify", "guides", "omnify");
  (0, import_node_fs7.mkdirSync)(destDir, { recursive: true });
  const files = (0, import_node_fs7.readdirSync)(stubsDir).filter((f) => f.endsWith(".stub"));
  for (const file of files) {
    const srcPath = (0, import_node_path7.join)(stubsDir, file);
    const destPath = (0, import_node_path7.join)(destDir, file.replace(".stub", ""));
    const content = (0, import_node_fs7.readFileSync)(srcPath, "utf8");
    (0, import_node_fs7.writeFileSync)(destPath, content);
    filesWritten++;
  }
  return filesWritten;
}
function generateAIGuides(rootDir, _plugins) {
  let filesWritten = 0;
  const claudeMdPath = (0, import_node_path7.resolve)(rootDir, "CLAUDE.md");
  if (!(0, import_node_fs7.existsSync)(claudeMdPath)) {
    (0, import_node_fs7.writeFileSync)(claudeMdPath, CLAUDE_MD);
    filesWritten++;
  }
  filesWritten += copyOmnifyGuides(rootDir);
  return filesWritten;
}

// src/commands/generate.ts
function hasPluginGenerators(plugins) {
  return plugins.some((p) => p.generators && p.generators.length > 0);
}
function getExistingMigrationTables(migrationsDir) {
  const existingTables = /* @__PURE__ */ new Set();
  if (!(0, import_node_fs8.existsSync)(migrationsDir)) {
    return existingTables;
  }
  try {
    const files = (0, import_node_fs8.readdirSync)(migrationsDir);
    const createMigrationPattern = /^\d{4}_\d{2}_\d{2}_\d{6}_create_(.+)_table\.php$/;
    for (const file of files) {
      const match = file.match(createMigrationPattern);
      if (match) {
        existingTables.add(match[1]);
      }
    }
  } catch {
  }
  return existingTables;
}
function logSchemaChange(change, verbose) {
  logger.debug(`  ${change.changeType}: ${change.schemaName}`);
  if (!verbose || change.changeType !== "modified") {
    return;
  }
  if (change.columnChanges) {
    for (const col of change.columnChanges) {
      if (col.changeType === "added") {
        logger.debug(`    + column: ${col.column} (${col.currentDef?.type})`);
      } else if (col.changeType === "removed") {
        logger.debug(`    - column: ${col.column}`);
      } else if (col.changeType === "modified" && col.modifications) {
        logger.debug(`    ~ column: ${col.column} [${col.modifications.join(", ")}]`);
      } else if (col.changeType === "renamed" && col.previousColumn) {
        const mods = col.modifications?.length ? ` [${col.modifications.join(", ")}]` : "";
        logger.debug(`    \u2192 column: ${col.previousColumn} \u2192 ${col.column}${mods}`);
      }
    }
  }
  if (change.indexChanges) {
    for (const idx of change.indexChanges) {
      const type = idx.index.unique ? "unique" : "index";
      if (idx.changeType === "added") {
        logger.debug(`    + ${type}: (${idx.index.columns.join(", ")})`);
      } else {
        logger.debug(`    - ${type}: (${idx.index.columns.join(", ")})`);
      }
    }
  }
  if (change.optionChanges) {
    if (change.optionChanges.timestamps) {
      const { from, to } = change.optionChanges.timestamps;
      logger.debug(`    ~ timestamps: ${from} \u2192 ${to}`);
    }
    if (change.optionChanges.softDelete) {
      const { from, to } = change.optionChanges.softDelete;
      logger.debug(`    ~ softDelete: ${from} \u2192 ${to}`);
    }
    if (change.optionChanges.idType) {
      const { from, to } = change.optionChanges.idType;
      logger.debug(`    ~ idType: ${from} \u2192 ${to}`);
    }
  }
}
function propertyToVersionSnapshot(prop) {
  return {
    type: prop.type,
    ...prop.displayName !== void 0 && { displayName: prop.displayName },
    ...prop.description !== void 0 && { description: prop.description },
    ...prop.nullable !== void 0 && { nullable: prop.nullable },
    ...prop.unique !== void 0 && { unique: prop.unique },
    ...prop.default !== void 0 && { default: prop.default },
    ...prop.length !== void 0 && { length: prop.length },
    ...prop.unsigned !== void 0 && { unsigned: prop.unsigned },
    ...prop.precision !== void 0 && { precision: prop.precision },
    ...prop.scale !== void 0 && { scale: prop.scale },
    ...prop.enum !== void 0 && { enum: prop.enum },
    ...prop.relation !== void 0 && { relation: prop.relation },
    ...prop.target !== void 0 && { target: prop.target },
    ...prop.targets !== void 0 && { targets: prop.targets },
    ...prop.morphName !== void 0 && { morphName: prop.morphName },
    ...prop.onDelete !== void 0 && { onDelete: prop.onDelete },
    ...prop.onUpdate !== void 0 && { onUpdate: prop.onUpdate },
    ...prop.mappedBy !== void 0 && { mappedBy: prop.mappedBy },
    ...prop.inversedBy !== void 0 && { inversedBy: prop.inversedBy },
    ...prop.joinTable !== void 0 && { joinTable: prop.joinTable },
    ...prop.owning !== void 0 && { owning: prop.owning },
    // Laravel-specific properties
    ...prop.hidden !== void 0 && { hidden: prop.hidden },
    ...prop.fillable !== void 0 && { fillable: prop.fillable },
    // Per-field overrides for compound types
    ...prop.fields !== void 0 && { fields: prop.fields }
  };
}
function schemasToVersionSnapshot(schemas) {
  const snapshot = {};
  for (const [name, schema] of Object.entries(schemas)) {
    const properties = {};
    if (schema.properties) {
      for (const [propName, prop] of Object.entries(schema.properties)) {
        properties[propName] = propertyToVersionSnapshot(prop);
      }
    }
    const opts = schema.options;
    snapshot[name] = {
      name: schema.name,
      kind: schema.kind ?? "object",
      ...Object.keys(properties).length > 0 && { properties },
      ...schema.values && { values: schema.values },
      ...opts && {
        options: {
          ...opts.id !== void 0 && { id: opts.id },
          ...opts.idType !== void 0 && { idType: opts.idType },
          ...opts.timestamps !== void 0 && { timestamps: opts.timestamps },
          ...opts.softDelete !== void 0 && { softDelete: opts.softDelete },
          ...opts.tableName !== void 0 && { tableName: opts.tableName },
          ...opts.translations !== void 0 && { translations: opts.translations },
          ...opts.authenticatable !== void 0 && { authenticatable: opts.authenticatable }
        }
      }
    };
  }
  return snapshot;
}
function schemaChangeToVersionChange(change) {
  const changes = [];
  if (change.changeType === "added") {
    changes.push({ action: "schema_added", schema: change.schemaName });
  } else if (change.changeType === "removed") {
    changes.push({ action: "schema_removed", schema: change.schemaName });
  } else if (change.changeType === "modified") {
    if (change.columnChanges) {
      for (const col of change.columnChanges) {
        if (col.changeType === "added") {
          changes.push({
            action: "property_added",
            schema: change.schemaName,
            property: col.column,
            to: col.currentDef
          });
        } else if (col.changeType === "removed") {
          changes.push({
            action: "property_removed",
            schema: change.schemaName,
            property: col.column,
            from: col.previousDef
          });
        } else if (col.changeType === "modified") {
          changes.push({
            action: "property_modified",
            schema: change.schemaName,
            property: col.column,
            from: col.previousDef,
            to: col.currentDef
          });
        } else if (col.changeType === "renamed") {
          changes.push({
            action: "property_renamed",
            schema: change.schemaName,
            property: col.column,
            from: col.previousColumn,
            to: col.column
          });
        }
      }
    }
    if (change.optionChanges) {
      changes.push({
        action: "option_changed",
        schema: change.schemaName,
        from: change.optionChanges,
        to: change.optionChanges
      });
    }
    if (change.indexChanges) {
      for (const idx of change.indexChanges) {
        if (idx.changeType === "added") {
          changes.push({
            action: "index_added",
            schema: change.schemaName,
            to: idx.index
          });
        } else {
          changes.push({
            action: "index_removed",
            schema: change.schemaName,
            from: idx.index
          });
        }
      }
    }
  }
  return changes;
}
function writeGeneratorOutputs(outputs, rootDir) {
  const counts = { migrations: 0, types: 0, models: 0, factories: 0, other: 0 };
  for (const output of outputs) {
    const filePath = (0, import_node_path8.resolve)(rootDir, output.path);
    const dir = (0, import_node_path8.dirname)(filePath);
    if (!(0, import_node_fs8.existsSync)(dir)) {
      (0, import_node_fs8.mkdirSync)(dir, { recursive: true });
      logger.debug(`Created directory: ${dir}`);
    }
    if (output.skipIfExists && (0, import_node_fs8.existsSync)(filePath)) {
      logger.debug(`Skipped (exists): ${output.path}`);
      continue;
    }
    (0, import_node_fs8.writeFileSync)(filePath, output.content);
    logger.debug(`Created: ${output.path}`);
    if (output.type === "migration") counts.migrations++;
    else if (output.type === "type") counts.types++;
    else if (output.type === "model") counts.models++;
    else if (output.type === "factory") counts.factories++;
    else counts.other++;
  }
  return counts;
}
async function runPluginGeneration(plugins, schemas, rootDir, verbose, changes) {
  const pluginManager = new import_omnify_core5.PluginManager({
    cwd: rootDir,
    verbose,
    logger: {
      debug: (msg) => logger.debug(msg),
      info: (msg) => logger.info(msg),
      warn: (msg) => logger.warn(msg),
      error: (msg) => logger.error(msg)
    }
  });
  for (const plugin of plugins) {
    await pluginManager.register(plugin);
  }
  const result = await pluginManager.runGenerators(schemas, changes);
  if (!result.success) {
    for (const error of result.errors) {
      logger.error(`Generator ${error.generatorName} failed: ${error.message}`);
    }
    throw new Error("Generator execution failed");
  }
  return writeGeneratorOutputs(result.outputs, rootDir);
}
function runDirectGeneration(schemas, config, rootDir, options, changes) {
  let migrationsGenerated = 0;
  let typesGenerated = 0;
  let modelsGenerated = 0;
  let factoriesGenerated = 0;
  const customTypesMap = /* @__PURE__ */ new Map();
  for (const plugin of config.plugins) {
    if (plugin.types) {
      for (const typeDef of plugin.types) {
        customTypesMap.set(typeDef.name, typeDef);
      }
    }
  }
  const pluginEnumsMap = /* @__PURE__ */ new Map();
  for (const plugin of config.plugins) {
    if (plugin.enums) {
      for (const enumDef of plugin.enums) {
        pluginEnumsMap.set(enumDef.name, enumDef);
      }
    }
  }
  if (!options.typesOnly && config.output.laravel) {
    logger.step("Generating Laravel migrations...");
    const migrationsDir = (0, import_node_path8.resolve)(rootDir, config.output.laravel.migrationsPath);
    if (!(0, import_node_fs8.existsSync)(migrationsDir)) {
      (0, import_node_fs8.mkdirSync)(migrationsDir, { recursive: true });
      logger.debug(`Created directory: ${migrationsDir}`);
    }
    const addedSchemaNames = new Set(
      changes.filter((c) => c.changeType === "added").map((c) => c.schemaName)
    );
    const alterChanges = changes.filter(
      (c) => c.changeType === "modified" || c.changeType === "removed"
    );
    const existingTables = getExistingMigrationTables(migrationsDir);
    if (addedSchemaNames.size > 0) {
      const addedSchemas = Object.fromEntries(
        Object.entries(schemas).filter(([name]) => addedSchemaNames.has(name))
      );
      const createMigrations = (0, import_omnify_laravel.generateMigrations)(addedSchemas, { customTypes: customTypesMap });
      for (const migration of createMigrations) {
        const tableName = migration.tables[0];
        if (existingTables.has(tableName)) {
          logger.debug(`Skipped CREATE for ${tableName} (already exists)`);
          continue;
        }
        const filePath = (0, import_node_path8.resolve)(migrationsDir, migration.fileName);
        (0, import_node_fs8.writeFileSync)(filePath, migration.content);
        logger.debug(`Created: ${migration.fileName}`);
        migrationsGenerated++;
      }
    }
    if (alterChanges.length > 0) {
      const alterMigrations = (0, import_omnify_laravel.generateMigrationsFromChanges)(alterChanges);
      for (const migration of alterMigrations) {
        const filePath = (0, import_node_path8.resolve)(migrationsDir, migration.fileName);
        (0, import_node_fs8.writeFileSync)(filePath, migration.content);
        logger.debug(`Created: ${migration.fileName}`);
        migrationsGenerated++;
      }
    }
    logger.success(`Generated ${migrationsGenerated} migration(s)`);
  }
  if (!options.typesOnly && config.output.laravel?.modelsPath) {
    logger.step("Generating Laravel models...");
    const modelsPath = config.output.laravel.modelsPath;
    const baseModelsPath = config.output.laravel.baseModelsPath ?? `${modelsPath}/OmnifyBase`;
    const modelsDir = (0, import_node_path8.resolve)(rootDir, modelsPath);
    const baseModelsDir = (0, import_node_path8.resolve)(rootDir, baseModelsPath);
    if (!(0, import_node_fs8.existsSync)(modelsDir)) {
      (0, import_node_fs8.mkdirSync)(modelsDir, { recursive: true });
    }
    if (!(0, import_node_fs8.existsSync)(baseModelsDir)) {
      (0, import_node_fs8.mkdirSync)(baseModelsDir, { recursive: true });
    }
    const providersPath = config.output.laravel.providersPath ?? "app/Providers";
    const models = (0, import_omnify_laravel.generateModels)(schemas, {
      modelPath: modelsPath,
      baseModelPath: baseModelsPath,
      providersPath,
      customTypes: customTypesMap
    });
    for (const model of models) {
      const filePath = (0, import_node_path8.resolve)(rootDir, (0, import_omnify_laravel.getModelPath)(model));
      const fileDir = (0, import_node_path8.dirname)(filePath);
      if (!(0, import_node_fs8.existsSync)(fileDir)) {
        (0, import_node_fs8.mkdirSync)(fileDir, { recursive: true });
      }
      if (!model.overwrite && (0, import_node_fs8.existsSync)(filePath)) {
        logger.debug(`Skipped (exists): ${(0, import_omnify_laravel.getModelPath)(model)}`);
        continue;
      }
      (0, import_node_fs8.writeFileSync)(filePath, model.content);
      logger.debug(`Created: ${(0, import_omnify_laravel.getModelPath)(model)}`);
      modelsGenerated++;
    }
    logger.success(`Generated ${modelsGenerated} model(s)`);
  }
  if (!options.typesOnly && config.output.laravel?.factoriesPath) {
    logger.step("Generating Laravel factories...");
    const factoriesPath = config.output.laravel.factoriesPath;
    const factoriesDir = (0, import_node_path8.resolve)(rootDir, factoriesPath);
    if (!(0, import_node_fs8.existsSync)(factoriesDir)) {
      (0, import_node_fs8.mkdirSync)(factoriesDir, { recursive: true });
    }
    const factories = (0, import_omnify_laravel.generateFactories)(schemas, {
      factoryPath: factoriesPath
    });
    for (const factory of factories) {
      const filePath = (0, import_node_path8.resolve)(rootDir, (0, import_omnify_laravel.getFactoryPath)(factory));
      const fileDir = (0, import_node_path8.dirname)(filePath);
      if (!(0, import_node_fs8.existsSync)(fileDir)) {
        (0, import_node_fs8.mkdirSync)(fileDir, { recursive: true });
      }
      if (!factory.overwrite && (0, import_node_fs8.existsSync)(filePath)) {
        logger.debug(`Skipped (exists): ${(0, import_omnify_laravel.getFactoryPath)(factory)}`);
        continue;
      }
      (0, import_node_fs8.writeFileSync)(filePath, factory.content);
      logger.debug(`Created: ${(0, import_omnify_laravel.getFactoryPath)(factory)}`);
      factoriesGenerated++;
    }
    logger.success(`Generated ${factoriesGenerated} factory(ies)`);
  }
  if (!options.migrationsOnly && config.output.typescript) {
    logger.step("Generating TypeScript types...");
    const tsConfig = config.output.typescript;
    const basePath = (0, import_node_path8.resolve)(rootDir, tsConfig.path);
    const schemasDir = (0, import_node_path8.resolve)(basePath, tsConfig.schemasDir ?? "schemas");
    const enumDir = (0, import_node_path8.resolve)(basePath, tsConfig.enumDir ?? "enum");
    const omnifyClientDir = (0, import_node_path8.resolve)(rootDir, "node_modules/@omnify-client");
    const pluginEnumDir = (0, import_node_path8.resolve)(omnifyClientDir, "enum");
    const baseSchemasDir = (0, import_node_path8.resolve)(omnifyClientDir, "schemas");
    const enumImportPrefix = (0, import_node_path8.relative)(schemasDir, enumDir).replace(/\\/g, "/");
    if (!(0, import_node_fs8.existsSync)(schemasDir)) {
      (0, import_node_fs8.mkdirSync)(schemasDir, { recursive: true });
      logger.debug(`Created directory: ${schemasDir}`);
    }
    if (!(0, import_node_fs8.existsSync)(enumDir)) {
      (0, import_node_fs8.mkdirSync)(enumDir, { recursive: true });
      logger.debug(`Created directory: ${enumDir}`);
    }
    if (!(0, import_node_fs8.existsSync)(pluginEnumDir)) {
      (0, import_node_fs8.mkdirSync)(pluginEnumDir, { recursive: true });
      logger.debug(`Created directory: ${pluginEnumDir}`);
    }
    if (!(0, import_node_fs8.existsSync)(baseSchemasDir)) {
      (0, import_node_fs8.mkdirSync)(baseSchemasDir, { recursive: true });
      logger.debug(`Created directory: ${baseSchemasDir}`);
    }
    const omnifyPkgJson = (0, import_node_path8.resolve)(omnifyClientDir, "package.json");
    if (!(0, import_node_fs8.existsSync)(omnifyPkgJson)) {
      (0, import_node_fs8.writeFileSync)(omnifyPkgJson, JSON.stringify({
        name: "@omnify-client",
        version: "0.0.0",
        private: true,
        exports: {
          "./enum/*": "./enum/*.js",
          "./schemas/*": "./schemas/*.js"
        }
      }, null, 2));
    }
    const isMultiLocale = config.locale && config.locale.locales && config.locale.locales.length > 1;
    const typeFiles = (0, import_omnify_typescript.generateTypeScript)(schemas, {
      customTypes: customTypesMap,
      pluginEnums: pluginEnumsMap,
      localeConfig: config.locale,
      multiLocale: isMultiLocale,
      generateRules: tsConfig.generateRules ?? true,
      validationTemplates: tsConfig.validationTemplates,
      enumImportPrefix,
      pluginEnumImportPrefix: "@omnify-client/enum",
      baseImportPrefix: "@omnify-client/schemas",
      schemaEnumImportPrefix: "@omnify/enum"
      // Absolute path for node_modules base files
    });
    for (const file of typeFiles) {
      let outputDir;
      let outputFilePath = file.filePath;
      if (file.category === "plugin-enum") {
        outputDir = pluginEnumDir;
      } else if (file.category === "base") {
        outputDir = baseSchemasDir;
        outputFilePath = file.filePath.replace(/^base\//, "");
      } else if (file.category === "enum") {
        outputDir = enumDir;
      } else {
        outputDir = schemasDir;
      }
      const filePath = (0, import_node_path8.resolve)(outputDir, outputFilePath);
      const fileDir = (0, import_node_path8.dirname)(filePath);
      if (!(0, import_node_fs8.existsSync)(fileDir)) {
        (0, import_node_fs8.mkdirSync)(fileDir, { recursive: true });
      }
      if (!file.overwrite && (0, import_node_fs8.existsSync)(filePath)) {
        logger.debug(`Skipped (exists): ${file.filePath}`);
        continue;
      }
      (0, import_node_fs8.writeFileSync)(filePath, file.content);
      logger.debug(`Created: ${file.filePath}`);
      typesGenerated++;
    }
    logger.success(`Generated ${typesGenerated} TypeScript file(s)`);
    const stubsResult = (0, import_omnify_typescript.copyStubs)({
      targetDir: basePath,
      skipIfExists: true
    });
    if (stubsResult.copied.length > 0) {
      logger.success(`Generated ${stubsResult.copied.length} React stub(s)`);
    }
    const aliasResult = configureOmnifyAlias(rootDir, tsConfig.path, true);
    if (aliasResult.viteUpdated) {
      logger.success("Auto-configured @omnify alias in vite.config");
    }
    if (aliasResult.tsconfigUpdated) {
      logger.success("Auto-configured @omnify/* path in tsconfig.json");
    }
    if (pluginEnumsMap.size > 0) {
      const pluginAliasResult = addPluginEnumAlias(rootDir);
      if (pluginAliasResult.updated) {
        logger.success("Auto-configured @omnify-client alias in vite.config");
      }
      const pluginPathResult = addPluginEnumTsconfigPath(rootDir);
      if (pluginPathResult.updated) {
        logger.success("Auto-configured @omnify-client/* path in tsconfig.json");
      }
    }
  }
  return { migrations: migrationsGenerated, types: typesGenerated, models: modelsGenerated, factories: factoriesGenerated };
}
async function runGenerate(options) {
  logger.setVerbose(options.verbose ?? false);
  logger.header("Generating Outputs");
  logger.debug("Loading configuration...");
  const { config, configPath } = await loadConfig();
  const rootDir = configPath ? (0, import_node_path8.dirname)(configPath) : process.cwd();
  validateConfig(config, rootDir);
  const schemaPath = (0, import_node_path8.resolve)(rootDir, config.schemasDir);
  logger.step(`Loading schemas from ${schemaPath}`);
  let schemas = await (0, import_omnify_core5.loadSchemas)(schemaPath);
  logger.debug(`Found ${Object.keys(schemas).length} schema(s) in main directory`);
  const additionalPaths = config.additionalSchemaPaths ?? [];
  let hasPackageSchemas = false;
  if (additionalPaths.length > 0) {
    logger.step(`Loading schemas from ${additionalPaths.length} additional path(s)`);
    for (const entry of additionalPaths) {
      const absolutePath = (0, import_node_path8.resolve)(rootDir, entry.path);
      logger.debug(`  Checking: ${entry.path} \u2192 ${absolutePath}`);
      if ((0, import_node_fs8.existsSync)(absolutePath)) {
        let packageSchemas = await (0, import_omnify_core5.loadSchemas)(absolutePath, { skipPartialResolution: true });
        if (entry.output) {
          const schemasWithOutput = {};
          for (const [name, schema] of Object.entries(packageSchemas)) {
            schemasWithOutput[name] = {
              ...schema,
              packageOutput: entry.output
            };
          }
          packageSchemas = schemasWithOutput;
        }
        const count = Object.keys(packageSchemas).filter((k) => !k.startsWith("__partial__")).length;
        const partialCount = Object.keys(packageSchemas).filter((k) => k.startsWith("__partial__")).length;
        const nsInfo = entry.namespace ? ` [${entry.namespace}]` : "";
        const outputInfo = entry.output?.laravel ? ` \u2192 ${entry.output.laravel.base}` : "";
        logger.info(`  \u2022 ${entry.path}${nsInfo}: ${count} schema(s)${partialCount > 0 ? ` + ${partialCount} partial(s)` : ""}${outputInfo}`);
        schemas = { ...packageSchemas, ...schemas };
        hasPackageSchemas = true;
      } else {
        logger.warn(`  \u2022 ${entry.path}: directory not found (skipped)`);
        logger.debug(`    Resolved path: ${absolutePath}`);
      }
    }
  }
  if (hasPackageSchemas) {
    schemas = (0, import_omnify_core5.mergePartialSchemas)(schemas);
  }
  const schemaCount = Object.keys(schemas).length;
  if (schemaCount === 0) {
    logger.warn("No schema files found");
    return;
  }
  logger.debug(`Total: ${schemaCount} schema(s)`);
  const customTypeNames = [];
  for (const plugin of config.plugins) {
    if (plugin.types) {
      for (const typeDef of plugin.types) {
        customTypeNames.push(typeDef.name);
      }
    }
  }
  logger.step("Validating schemas...");
  const validationResult = (0, import_omnify_core5.validateSchemas)(schemas, {
    customTypes: customTypeNames
  });
  if (!validationResult.valid) {
    logger.error("Schema validation failed. Fix errors before generating.");
    for (const error of validationResult.errors) {
      const omnifyError = import_omnify_core5.OmnifyError.fromInfo(error);
      logger.formatError(omnifyError);
    }
    process.exit(2);
  }
  logger.step("Checking for changes...");
  const lockPath = (0, import_node_path8.resolve)(rootDir, config.lockFilePath);
  const existingLock = await (0, import_omnify_atlas2.readLockFile)(lockPath);
  const currentSnapshots = await (0, import_omnify_atlas2.buildSchemaSnapshots)(schemas);
  const v2Lock = existingLock && (0, import_omnify_atlas2.isLockFileV2)(existingLock) ? existingLock : null;
  const comparison = (0, import_omnify_atlas2.compareSchemasDeep)(currentSnapshots, v2Lock);
  const chainFilePath = (0, import_node_path8.resolve)(rootDir, import_omnify_atlas2.VERSION_CHAIN_FILE);
  const versionChain = await (0, import_omnify_atlas2.readVersionChain)(chainFilePath);
  if (versionChain && comparison.hasChanges) {
    const schemaActions = [];
    for (const change of comparison.changes) {
      if (change.changeType === "removed") {
        schemaActions.push({ name: change.schemaName, action: "delete" });
      } else if (change.changeType === "modified") {
        schemaActions.push({ name: change.schemaName, action: "modify" });
      }
    }
    if (schemaActions.length > 0) {
      const lockCheck = (0, import_omnify_atlas2.checkBulkLockViolation)(versionChain, schemaActions);
      if (!lockCheck.allowed) {
        logger.newline();
        logger.error("\u{1F512} VERSION LOCK VIOLATION DETECTED");
        logger.error("");
        logger.error("The following schemas are locked in production:");
        for (const name of lockCheck.affectedSchemas) {
          logger.error(`  \u2022 ${name}`);
        }
        logger.error("");
        logger.error(`Locked in version(s): ${lockCheck.lockedInVersions.join(", ")}`);
        logger.error("");
        logger.error("These schemas CANNOT be modified or deleted.");
        logger.error("This is enforced by the blockchain-like version chain.");
        logger.newline();
        throw new import_omnify_core5.OmnifyError(
          lockCheck.reason ?? "Schema modification blocked by version lock",
          "E407",
          void 0,
          "Restore the original schema files or create new schemas instead of modifying locked ones."
        );
      }
    }
  }
  if (existingLock && config.output.laravel?.migrationsPath) {
    const migrationsDir = (0, import_node_path8.resolve)(rootDir, config.output.laravel.migrationsPath);
    const migrationValidation = await (0, import_omnify_atlas2.validateMigrations)(existingLock, migrationsDir);
    if (!migrationValidation.valid) {
      logger.newline();
      logger.warn("Migration file issues detected:");
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
    if ((options.warnStale ?? true) && migrationValidation.staleFiles.length > 0) {
      logger.newline();
      logger.warn("\u26A0\uFE0F  Stale migrations detected (old timestamp, not in lock file):");
      for (const file of migrationValidation.staleFiles) {
        logger.warn(`    - ${file}`);
      }
      logger.warn("  These may be from merged branches. Review before running migrate.");
      logger.newline();
    }
    if (options.check) {
      logger.newline();
      logger.step("CI Check Mode Results:");
      logger.info(`  Schemas: ${schemaCount}`);
      logger.info(`  Tracked migrations: ${migrationValidation.totalTracked}`);
      logger.info(`  Migrations on disk: ${migrationValidation.totalOnDisk}`);
      logger.info(`  Schema changes: ${comparison.changes.length}`);
      const hasIssues = !migrationValidation.valid || comparison.hasChanges;
      if (hasIssues) {
        logger.newline();
        if (comparison.hasChanges) {
          logger.error('\u274C Schema changes detected - run "npx omnify generate" to update migrations');
        }
        if (migrationValidation.missingFiles.length > 0) {
          logger.error("\u274C Missing migration files - regenerate or restore from git");
        }
        if (migrationValidation.modifiedFiles.length > 0) {
          logger.warn("\u26A0\uFE0F  Modified migration files - may cause inconsistencies");
        }
        process.exit(1);
      } else {
        logger.success("\u2705 All migrations in sync");
        return;
      }
    }
    if (migrationValidation.missingFiles.length > 0) {
      const toRegenerate = (0, import_omnify_atlas2.getMigrationsToRegenerate)(existingLock, migrationValidation.missingFiles);
      if (toRegenerate.length > 0) {
        logger.info(`Will regenerate ${toRegenerate.length} missing migration(s) with original timestamps.`);
        logger.warn("Auto-regeneration not yet implemented. Please restore from git or reset migrations.");
      }
    }
  }
  const skipMigrations = !comparison.hasChanges && !options.force;
  const pluginsHaveGenerators = config.plugins.some((p) => p.generators && p.generators.length > 0);
  const hasTypescriptOutput = !!config.output.typescript;
  if (skipMigrations && !config.output.laravel?.modelsPath && !pluginsHaveGenerators && !hasTypescriptOutput) {
    logger.success("No changes to generate");
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
  const usePlugins = hasPluginGenerators(config.plugins);
  const customTypesMap = /* @__PURE__ */ new Map();
  for (const plugin of config.plugins) {
    if (plugin.types) {
      for (const typeDef of plugin.types) {
        customTypesMap.set(typeDef.name, typeDef);
      }
    }
  }
  const pluginEnumsMap = /* @__PURE__ */ new Map();
  for (const plugin of config.plugins) {
    if (plugin.enums) {
      for (const enumDef of plugin.enums) {
        pluginEnumsMap.set(enumDef.name, enumDef);
      }
    }
  }
  if (usePlugins) {
    logger.step("Running plugin generators...");
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
    if (!options.migrationsOnly && config.output.typescript && typesGenerated === 0) {
      logger.step("Generating TypeScript types...");
      const tsConfig2 = config.output.typescript;
      const basePath2 = (0, import_node_path8.resolve)(rootDir, tsConfig2.path);
      const schemasDir2 = (0, import_node_path8.resolve)(basePath2, tsConfig2.schemasDir ?? "schemas");
      const enumDir2 = (0, import_node_path8.resolve)(basePath2, tsConfig2.enumDir ?? "enum");
      const omnifyClientDir2 = (0, import_node_path8.resolve)(rootDir, "node_modules/@omnify-client");
      const pluginEnumDir2 = (0, import_node_path8.resolve)(omnifyClientDir2, "enum");
      const baseSchemasDir2 = (0, import_node_path8.resolve)(omnifyClientDir2, "schemas");
      const enumImportPrefix2 = (0, import_node_path8.relative)(schemasDir2, enumDir2).replace(/\\/g, "/");
      if (!(0, import_node_fs8.existsSync)(schemasDir2)) {
        (0, import_node_fs8.mkdirSync)(schemasDir2, { recursive: true });
        logger.debug(`Created directory: ${schemasDir2}`);
      }
      if (!(0, import_node_fs8.existsSync)(enumDir2)) {
        (0, import_node_fs8.mkdirSync)(enumDir2, { recursive: true });
        logger.debug(`Created directory: ${enumDir2}`);
      }
      if (!(0, import_node_fs8.existsSync)(pluginEnumDir2)) {
        (0, import_node_fs8.mkdirSync)(pluginEnumDir2, { recursive: true });
        logger.debug(`Created directory: ${pluginEnumDir2}`);
      }
      if (!(0, import_node_fs8.existsSync)(baseSchemasDir2)) {
        (0, import_node_fs8.mkdirSync)(baseSchemasDir2, { recursive: true });
        logger.debug(`Created directory: ${baseSchemasDir2}`);
      }
      const omnifyPkgJson2 = (0, import_node_path8.resolve)(omnifyClientDir2, "package.json");
      if (!(0, import_node_fs8.existsSync)(omnifyPkgJson2)) {
        (0, import_node_fs8.writeFileSync)(omnifyPkgJson2, JSON.stringify({
          name: "@omnify-client",
          version: "0.0.0",
          private: true,
          exports: {
            "./enum/*": "./enum/*.js",
            "./schemas/*": "./schemas/*.js"
          }
        }, null, 2));
      }
      const isMultiLocale = config.locale && config.locale.locales && config.locale.locales.length > 1;
      const typeFiles = (0, import_omnify_typescript.generateTypeScript)(schemas, {
        customTypes: customTypesMap,
        pluginEnums: pluginEnumsMap,
        localeConfig: config.locale,
        multiLocale: isMultiLocale,
        generateRules: tsConfig2.generateRules ?? true,
        validationTemplates: tsConfig2.validationTemplates,
        enumImportPrefix: enumImportPrefix2,
        pluginEnumImportPrefix: "@omnify-client/enum",
        baseImportPrefix: "@omnify-client/schemas",
        schemaEnumImportPrefix: "@omnify/enum"
        // Absolute path for node_modules base files
      });
      for (const file of typeFiles) {
        let outputDir2;
        let outputFilePath2 = file.filePath;
        if (file.category === "plugin-enum") {
          outputDir2 = pluginEnumDir2;
        } else if (file.category === "base") {
          outputDir2 = baseSchemasDir2;
          outputFilePath2 = file.filePath.replace(/^base\//, "");
        } else if (file.category === "enum") {
          outputDir2 = enumDir2;
        } else {
          outputDir2 = schemasDir2;
        }
        const filePath = (0, import_node_path8.resolve)(outputDir2, outputFilePath2);
        const fileDir = (0, import_node_path8.dirname)(filePath);
        if (!(0, import_node_fs8.existsSync)(fileDir)) {
          (0, import_node_fs8.mkdirSync)(fileDir, { recursive: true });
        }
        if (!file.overwrite && (0, import_node_fs8.existsSync)(filePath)) {
          logger.debug(`Skipped (exists): ${file.filePath}`);
          continue;
        }
        (0, import_node_fs8.writeFileSync)(filePath, file.content);
        logger.debug(`Created: ${file.filePath}`);
        typesGenerated++;
      }
      logger.success(`Generated ${typesGenerated} TypeScript file(s)`);
      const stubsResult2 = (0, import_omnify_typescript.copyStubs)({
        targetDir: basePath2,
        skipIfExists: true
      });
      if (stubsResult2.copied.length > 0) {
        logger.success(`Generated ${stubsResult2.copied.length} React stub(s)`);
      }
      const aliasResult = configureOmnifyAlias(rootDir, tsConfig2.path, true);
      if (aliasResult.viteUpdated) {
        logger.success("Auto-configured @omnify alias in vite.config");
      }
      if (aliasResult.tsconfigUpdated) {
        logger.success("Auto-configured @omnify/* path in tsconfig.json");
      }
      if (pluginEnumsMap.size > 0) {
        const pluginAliasResult = addPluginEnumAlias(rootDir);
        if (pluginAliasResult.updated) {
          logger.success("Auto-configured @omnify-client alias in vite.config");
        }
        const pluginPathResult = addPluginEnumTsconfigPath(rootDir);
        if (pluginPathResult.updated) {
          logger.success("Auto-configured .omnify-generated/* path in tsconfig.json");
        }
      }
      if ((0, import_omnify_typescript.shouldGenerateAIGuides)(rootDir)) {
        const tsAIResult = (0, import_omnify_typescript.generateAIGuides)(rootDir, {
          typescriptPath: tsConfig2.path
        });
        const tsClaudeTotal = tsAIResult.claudeGuides + tsAIResult.claudeChecklists;
        if (tsClaudeTotal > 0 || tsAIResult.cursorRules > 0) {
          logger.debug(`Generated ${tsClaudeTotal} React Claude files, ${tsAIResult.cursorRules} Cursor rules`);
        }
      }
    }
  } else {
    const counts = runDirectGeneration(schemas, config, rootDir, options, comparison.changes);
    migrationsGenerated = counts.migrations;
    typesGenerated = counts.types;
    modelsGenerated = counts.models;
    factoriesGenerated = counts.factories;
  }
  logger.step("Updating lock file...");
  const newLockFile = (0, import_omnify_atlas2.updateLockFile)(existingLock, currentSnapshots, config.database.driver);
  await (0, import_omnify_atlas2.writeLockFile)(lockPath, newLockFile);
  logger.debug(`Updated: ${config.lockFilePath}`);
  if (comparison.hasChanges) {
    logger.step("Saving version history...");
    const versionStore = (0, import_omnify_core5.createVersionStore)({ baseDir: rootDir, maxVersions: 100 });
    const versionSnapshot = schemasToVersionSnapshot(schemas);
    const versionChanges = comparison.changes.flatMap(schemaChangeToVersionChange);
    const migrationFileName = migrationsGenerated > 0 ? `${migrationsGenerated} migration(s)` : void 0;
    try {
      const newVersion = await versionStore.createVersion(
        versionSnapshot,
        versionChanges,
        {
          driver: config.database.driver,
          ...migrationFileName !== void 0 && { migration: migrationFileName },
          description: `Generated ${comparison.changes.length} change(s)`
        }
      );
      logger.debug(`Created version ${newVersion.version}`);
    } catch (versionError) {
      logger.debug(`Could not save version history: ${versionError.message}`);
    }
  }
  try {
    const guidesWritten = generateAIGuides(rootDir, config.plugins);
    if (guidesWritten > 0) {
      logger.debug(`Updated ${guidesWritten} AI guide file(s)`);
    }
  } catch (guideError) {
    logger.debug(`Could not generate AI guides: ${guideError.message}`);
  }
  logger.newline();
  logger.success("Generation complete!");
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
function registerGenerateCommand(program) {
  program.command("generate").description("Generate Laravel migrations and TypeScript types").option("-v, --verbose", "Show detailed output").option("--migrations-only", "Only generate migrations").option("--types-only", "Only generate TypeScript types").option("-f, --force", "Generate even if no changes detected").option("--check", "CI mode: check if migrations are in sync without generating (exits with code 1 if out of sync)").option("--no-warn-stale", "Disable stale migration warnings").action(async (options) => {
    try {
      await runGenerate(options);
    } catch (error) {
      if (error instanceof import_omnify_core5.OmnifyError) {
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  defineConfig,
  loadConfig,
  logger,
  registerDiffCommand,
  registerGenerateCommand,
  registerInitCommand,
  registerValidateCommand,
  runInit
});
//# sourceMappingURL=index.cjs.map