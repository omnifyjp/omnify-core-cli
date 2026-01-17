var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/config/loader.ts
import { existsSync as existsSync2 } from "fs";
import { resolve as resolve2, dirname as dirname2 } from "path";
import { createJiti } from "jiti";
import { configError, configNotFoundError } from "@famgia/omnify-core";

// src/config/discovery.ts
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

// src/output/logger.ts
import pc from "picocolors";
import { formatError, getExitCode } from "@famgia/omnify-core";
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
      console.log(pc.green("\u2713") + " " + message);
    }
  }
  /**
   * Log a warning message.
   */
  warn(message) {
    if (!this._quiet) {
      console.log(pc.yellow("\u26A0") + " " + pc.yellow(message));
    }
  }
  /**
   * Log an error message.
   */
  error(message) {
    console.error(pc.red("\u2717") + " " + pc.red(message));
  }
  /**
   * Log a debug message (only in verbose mode).
   */
  debug(message) {
    if (this._verbose && !this._quiet) {
      console.log(pc.dim("  " + message));
    }
  }
  /**
   * Log a step message.
   */
  step(message) {
    if (!this._quiet) {
      console.log(pc.cyan("\u2192") + " " + message);
    }
  }
  /**
   * Log a header.
   */
  header(message) {
    if (!this._quiet) {
      console.log();
      console.log(pc.bold(message));
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
      console.log(pc.dim(`  [${elapsed}ms] ${message}`));
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
    const formatted = formatError(error, { color: true });
    console.error(formatted);
  }
  /**
   * Get exit code for an error.
   */
  getExitCode(error) {
    return getExitCode(error);
  }
};
var logger = new Logger();

// src/config/discovery.ts
var MANIFEST_FILENAME = ".omnify-packages.json";
var MANIFEST_VERSION = 1;
function loadPackageManifest(projectRoot) {
  const manifestPath = resolve(projectRoot, MANIFEST_FILENAME);
  if (!existsSync(manifestPath)) {
    logger.debug(`Package manifest not found: ${manifestPath}`);
    return null;
  }
  try {
    const content = readFileSync(manifestPath, "utf-8");
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
        const schemasPath = resolve(projectRoot, config.schemas);
        if (!existsSync(schemasPath)) {
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
  const cwd = resolve2(startDir);
  for (const filename of CONFIG_FILES) {
    const configPath = resolve2(cwd, filename);
    if (existsSync2(configPath)) {
      return configPath;
    }
  }
  return null;
}
async function loadConfigFile(configPath) {
  const jiti = createJiti(configPath, {
    interopDefault: true,
    moduleCache: false
  });
  try {
    const module = await jiti.import(configPath);
    const config = module;
    if ("default" in config) {
      return config.default;
    }
    return config;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw configError(
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
  const configDir = configPath ? dirname2(configPath) : process.cwd();
  for (const plugin of plugins) {
    if (typeof plugin === "string") {
      const jiti = createJiti(configDir, {
        interopDefault: true,
        moduleCache: false
      });
      try {
        const module = await jiti.import(plugin);
        const loadedPlugin = module.default ?? module;
        resolved.push(loadedPlugin);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw configError(
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
  const projectRoot = configPath ? dirname2(configPath) : process.cwd();
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
  const schemaPath = resolve2(rootDir, config.schemasDir);
  if (!existsSync2(schemaPath)) {
    throw configError(
      `Schema directory not found: ${schemaPath}. Create the '${config.schemasDir}' directory or update schemasDir in config.`,
      "E002"
    );
  }
}
function requireDevUrl(config) {
  if (!config.database.devUrl) {
    throw configError(
      `database.devUrl is required for diff and generate operations. Add devUrl to your database config, e.g., "mysql://root@localhost:3306/omnify_dev"`,
      "E003"
    );
  }
}
async function loadConfig(startDir = process.cwd()) {
  const cwd = resolve2(startDir);
  const configPath = findConfigFile(cwd);
  if (configPath) {
    const userConfig = await loadConfigFile(configPath);
    const config = await resolveConfig(userConfig, configPath);
    return {
      config,
      configPath
    };
  }
  throw configNotFoundError(resolve2(cwd, "omnify.config.ts"));
}
function defineConfig(config) {
  return config;
}

// src/config/alias-config.ts
import { existsSync as existsSync3, readFileSync as readFileSync2, writeFileSync } from "fs";
import { resolve as resolve3 } from "path";
function hasViteOmnifyAlias(content) {
  return content.includes("'@omnify'") || content.includes('"@omnify"') || content.includes("@omnify:") || content.includes("'@omnify/");
}
function hasViteOmnifyBaseAlias(content) {
  return content.includes("'@omnify-base'") || content.includes('"@omnify-base"') || content.includes("@omnify-base/");
}
function hasTsconfigOmnifyPath(content) {
  return content.includes('"@omnify/*"') || content.includes("'@omnify/*'") || content.includes('"@omnify/"');
}
function updateViteConfig(rootDir, omnifyPath = "omnify") {
  const configPaths = [
    resolve3(rootDir, "vite.config.ts"),
    resolve3(rootDir, "vite.config.js"),
    resolve3(rootDir, "vite.config.mts"),
    resolve3(rootDir, "vite.config.mjs")
  ];
  const configPath = configPaths.find((p) => existsSync3(p));
  if (!configPath) {
    return { updated: false, skipped: true };
  }
  try {
    let content = readFileSync2(configPath, "utf-8");
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
      writeFileSync(configPath, content);
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
  const configPath = resolve3(rootDir, "tsconfig.json");
  if (!existsSync3(configPath)) {
    return { updated: false, skipped: true };
  }
  try {
    const content = readFileSync2(configPath, "utf-8");
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
    writeFileSync(configPath, newContent + "\n");
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
    resolve3(rootDir, "vite.config.ts"),
    resolve3(rootDir, "vite.config.js"),
    resolve3(rootDir, "vite.config.mts"),
    resolve3(rootDir, "vite.config.mjs")
  ];
  const configPath = configPaths.find((p) => existsSync3(p));
  if (!configPath) {
    return { updated: false };
  }
  try {
    let content = readFileSync2(configPath, "utf-8");
    if (hasViteOmnifyBaseAlias(content)) {
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
      const aliasLine = `${indent}'@omnify-base': path.resolve(__dirname, 'node_modules/@omnify-base'),`;
      lines.splice(insertIndex, 0, aliasLine);
      content = lines.join("\n");
      writeFileSync(configPath, content);
      return { updated: true };
    }
    return { updated: false, error: "Could not find @omnify alias to add @omnify-base after" };
  } catch (error) {
    return {
      updated: false,
      error: `Failed to add plugin enum alias: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
function addPluginEnumTsconfigPath(rootDir) {
  const configPath = resolve3(rootDir, "tsconfig.json");
  if (!existsSync3(configPath)) {
    return { updated: false };
  }
  try {
    const content = readFileSync2(configPath, "utf-8");
    if (content.includes("@omnify-base")) {
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
    config.compilerOptions.paths["@omnify-base/*"] = ["./node_modules/@omnify-base/*"];
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    return { updated: true };
  } catch (error) {
    return {
      updated: false,
      error: `Failed to add plugin enum tsconfig path: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// src/commands/init.ts
import { existsSync as existsSync4, mkdirSync, writeFileSync as writeFileSync2 } from "fs";
import { resolve as resolve4 } from "path";
import { select, confirm, input } from "@inquirer/prompts";
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
  const configPath = resolve4(cwd, "omnify.config.ts");
  if (existsSync4(configPath) && !options.force) {
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
    const database = await select({
      message: "Which database?",
      choices: [
        { name: "MySQL / MariaDB", value: "mysql" },
        { name: "PostgreSQL", value: "postgres" },
        { name: "SQLite", value: "sqlite" }
      ],
      default: "mysql"
    });
    const migrationTool = await select({
      message: "Which migration tool?",
      choices: [
        { name: "Laravel (PHP)", value: "laravel" },
        { name: "Prisma (coming soon)", value: "prisma", disabled: true },
        { name: "Drizzle (coming soon)", value: "drizzle", disabled: true },
        { name: "None (types only)", value: "none" }
      ],
      default: "laravel"
    });
    const generateTypes = await confirm({
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
      migrationsPath = await input({
        message: "Migrations output path:",
        default: defaults.migrations
      });
    }
    if (generateTypes) {
      typesPath = await input({
        message: "TypeScript types path:",
        default: defaults.types
      });
    }
    const schemasDir2 = await input({
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
  const schemasDir = resolve4(cwd, config.schemasDir);
  if (!existsSync4(schemasDir)) {
    mkdirSync(schemasDir, { recursive: true });
    logger.debug(`Created ${config.schemasDir}/ directory`);
  }
  const examplePath = resolve4(schemasDir, "User.yaml");
  if (!existsSync4(examplePath) || options.force) {
    writeFileSync2(examplePath, EXAMPLE_SCHEMA);
    logger.debug("Created example schema: User.yaml");
  }
  const configContent = generateConfig(config);
  writeFileSync2(configPath, configContent);
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
import { existsSync as existsSync5 } from "fs";
import { resolve as resolve5, dirname as dirname3 } from "path";
import { loadSchemas, mergePartialSchemas, validateSchemas, OmnifyError as OmnifyError2 } from "@famgia/omnify-core";
async function runValidate(options) {
  logger.setVerbose(options.verbose ?? false);
  logger.header("Validating Schemas");
  logger.debug("Loading configuration...");
  logger.timing("Config load start");
  const { config, configPath } = await loadConfig();
  logger.timing("Config loaded");
  const rootDir = configPath ? dirname3(configPath) : process.cwd();
  validateConfig(config, rootDir);
  const schemaPath = resolve5(rootDir, config.schemasDir);
  logger.step(`Loading schemas from ${schemaPath}`);
  logger.timing("Schema load start");
  let schemas = await loadSchemas(schemaPath);
  logger.debug(`Found ${Object.keys(schemas).length} schema(s) in main directory`);
  const additionalPaths = config.additionalSchemaPaths ?? [];
  let hasPackageSchemas = false;
  if (additionalPaths.length > 0) {
    logger.step(`Loading schemas from ${additionalPaths.length} additional path(s)`);
    for (const entry of additionalPaths) {
      const absolutePath = resolve5(rootDir, entry.path);
      logger.debug(`  Checking: ${entry.path} \u2192 ${absolutePath}`);
      if (existsSync5(absolutePath)) {
        const packageSchemas = await loadSchemas(absolutePath, { skipPartialResolution: true });
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
    schemas = mergePartialSchemas(schemas);
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
  const result = validateSchemas(schemas);
  logger.timing("Validation complete");
  if (result.valid) {
    logger.success(`All ${schemaCount} schema(s) are valid`);
  } else {
    logger.error(`Found ${result.errors.length} validation error(s)`);
    logger.newline();
    for (const error of result.errors) {
      const omnifyError = OmnifyError2.fromInfo(error);
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
      if (error instanceof OmnifyError2) {
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
import { existsSync as existsSync6 } from "fs";
import { resolve as resolve6, dirname as dirname4 } from "path";
import { loadSchemas as loadSchemas2, mergePartialSchemas as mergePartialSchemas2, validateSchemas as validateSchemas2, OmnifyError as OmnifyError3 } from "@famgia/omnify-core";

// src/operations/diff.ts
import {
  generatePreview,
  formatPreview
} from "@famgia/omnify-atlas";
async function runDiffOperation(options) {
  const { schemas, devUrl, driver, workDir } = options;
  const preview = await generatePreview(schemas, {
    driver,
    devUrl,
    workDir
  }, {
    warnDestructive: true,
    showSql: true
  });
  const formattedPreview = formatPreview(preview, "text");
  return {
    hasChanges: preview.hasChanges,
    hasDestructiveChanges: preview.hasDestructiveChanges,
    preview,
    formattedPreview,
    sql: preview.sql
  };
}

// src/commands/diff.ts
import pc2 from "picocolors";
async function runDiff(options) {
  logger.setVerbose(options.verbose ?? false);
  logger.header("Checking for Schema Changes");
  logger.debug("Loading configuration...");
  const { config, configPath } = await loadConfig();
  const rootDir = configPath ? dirname4(configPath) : process.cwd();
  validateConfig(config, rootDir);
  requireDevUrl(config);
  const schemaPath = resolve6(rootDir, config.schemasDir);
  logger.step(`Loading schemas from ${schemaPath}`);
  let schemas = await loadSchemas2(schemaPath);
  logger.debug(`Found ${Object.keys(schemas).length} schema(s) in main directory`);
  const additionalPaths = config.additionalSchemaPaths ?? [];
  let hasPackageSchemas = false;
  if (additionalPaths.length > 0) {
    logger.step(`Loading schemas from ${additionalPaths.length} additional path(s)`);
    for (const entry of additionalPaths) {
      const absolutePath = resolve6(rootDir, entry.path);
      logger.debug(`  Checking: ${entry.path} \u2192 ${absolutePath}`);
      if (existsSync6(absolutePath)) {
        const packageSchemas = await loadSchemas2(absolutePath, { skipPartialResolution: true });
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
    schemas = mergePartialSchemas2(schemas);
  }
  const schemaCount = Object.keys(schemas).length;
  if (schemaCount === 0) {
    logger.warn("No schema files found");
    return;
  }
  logger.debug(`Total: ${schemaCount} schema(s)`);
  logger.step("Validating schemas...");
  const validationResult = validateSchemas2(schemas);
  if (!validationResult.valid) {
    logger.error("Schema validation failed. Fix errors before running diff.");
    for (const error of validationResult.errors) {
      const omnifyError = OmnifyError3.fromInfo(error);
      logger.formatError(omnifyError);
    }
    process.exit(2);
  }
  logger.step("Running Atlas diff...");
  const lockPath = resolve6(rootDir, config.lockFilePath);
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
  console.log(pc2.bold("Changes detected:"));
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
      if (error instanceof OmnifyError3) {
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
import { existsSync as existsSync8, mkdirSync as mkdirSync3, writeFileSync as writeFileSync4, readdirSync as readdirSync2 } from "fs";
import { resolve as resolve8, dirname as dirname6, relative } from "path";
import {
  loadSchemas as loadSchemas3,
  mergePartialSchemas as mergePartialSchemas3,
  validateSchemas as validateSchemas3,
  OmnifyError as OmnifyError4,
  PluginManager,
  createVersionStore
} from "@famgia/omnify-core";
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
  checkBulkLockViolation
} from "@famgia/omnify-atlas";
import {
  generateMigrations,
  generateMigrationsFromChanges,
  generateModels,
  getModelPath,
  generateFactories,
  getFactoryPath
} from "@famgia/omnify-laravel";
import { generateTypeScript, generateAIGuides as generateTypescriptAIGuides, shouldGenerateAIGuides as shouldGenerateTypescriptAIGuides } from "@famgia/omnify-typescript";

// src/guides/index.ts
import { existsSync as existsSync7, writeFileSync as writeFileSync3, mkdirSync as mkdirSync2, readdirSync, readFileSync as readFileSync3 } from "fs";
import { resolve as resolve7, dirname as dirname5, join } from "path";
import "url";
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
    resolve7(rootDir, "node_modules", "@famgia", "omnify", "stubs", "ai-guides", "omnify"),
    resolve7(rootDir, "node_modules", ".pnpm", "@famgia+omnify@*", "node_modules", "@famgia", "omnify", "stubs", "ai-guides", "omnify")
  ];
  let stubsDir = null;
  for (const pkgPath of omnifyPkgPaths) {
    if (pkgPath.includes("*")) {
      const parentDir = dirname5(dirname5(pkgPath));
      if (existsSync7(parentDir)) {
        const entries = readdirSync(parentDir);
        for (const entry of entries) {
          if (entry.startsWith("@famgia+omnify@")) {
            const testPath = join(parentDir, entry, "node_modules", "@famgia", "omnify", "stubs", "ai-guides", "omnify");
            if (existsSync7(testPath)) {
              stubsDir = testPath;
              break;
            }
          }
        }
      }
    } else if (existsSync7(pkgPath)) {
      stubsDir = pkgPath;
      break;
    }
  }
  if (!stubsDir) {
    try {
      const omnifyPath = dirname5(__require.resolve("@famgia/omnify/package.json", { paths: [rootDir] }));
      const testPath = join(omnifyPath, "stubs", "ai-guides", "omnify");
      if (existsSync7(testPath)) {
        stubsDir = testPath;
      }
    } catch {
    }
  }
  if (!stubsDir) {
    return 0;
  }
  const destDir = resolve7(rootDir, ".claude", "omnify", "guides", "omnify");
  mkdirSync2(destDir, { recursive: true });
  const files = readdirSync(stubsDir).filter((f) => f.endsWith(".stub"));
  for (const file of files) {
    const srcPath = join(stubsDir, file);
    const destPath = join(destDir, file.replace(".stub", ""));
    const content = readFileSync3(srcPath, "utf8");
    writeFileSync3(destPath, content);
    filesWritten++;
  }
  return filesWritten;
}
function generateAIGuides(rootDir, _plugins) {
  let filesWritten = 0;
  const claudeMdPath = resolve7(rootDir, "CLAUDE.md");
  writeFileSync3(claudeMdPath, CLAUDE_MD);
  filesWritten++;
  filesWritten += copyOmnifyGuides(rootDir);
  return filesWritten;
}

// src/commands/generate.ts
function hasPluginGenerators(plugins) {
  return plugins.some((p) => p.generators && p.generators.length > 0);
}
function getExistingMigrationTables(migrationsDir) {
  const existingTables = /* @__PURE__ */ new Set();
  if (!existsSync8(migrationsDir)) {
    return existingTables;
  }
  try {
    const files = readdirSync2(migrationsDir);
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
    const filePath = resolve8(rootDir, output.path);
    const dir = dirname6(filePath);
    if (!existsSync8(dir)) {
      mkdirSync3(dir, { recursive: true });
      logger.debug(`Created directory: ${dir}`);
    }
    if (output.skipIfExists && existsSync8(filePath)) {
      logger.debug(`Skipped (exists): ${output.path}`);
      continue;
    }
    writeFileSync4(filePath, output.content);
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
  const pluginManager = new PluginManager({
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
    const migrationsDir = resolve8(rootDir, config.output.laravel.migrationsPath);
    if (!existsSync8(migrationsDir)) {
      mkdirSync3(migrationsDir, { recursive: true });
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
      const createMigrations = generateMigrations(addedSchemas, { customTypes: customTypesMap });
      for (const migration of createMigrations) {
        const tableName = migration.tables[0];
        if (existingTables.has(tableName)) {
          logger.debug(`Skipped CREATE for ${tableName} (already exists)`);
          continue;
        }
        const filePath = resolve8(migrationsDir, migration.fileName);
        writeFileSync4(filePath, migration.content);
        logger.debug(`Created: ${migration.fileName}`);
        migrationsGenerated++;
      }
    }
    if (alterChanges.length > 0) {
      const alterMigrations = generateMigrationsFromChanges(alterChanges);
      for (const migration of alterMigrations) {
        const filePath = resolve8(migrationsDir, migration.fileName);
        writeFileSync4(filePath, migration.content);
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
    const modelsDir = resolve8(rootDir, modelsPath);
    const baseModelsDir = resolve8(rootDir, baseModelsPath);
    if (!existsSync8(modelsDir)) {
      mkdirSync3(modelsDir, { recursive: true });
    }
    if (!existsSync8(baseModelsDir)) {
      mkdirSync3(baseModelsDir, { recursive: true });
    }
    const providersPath = config.output.laravel.providersPath ?? "app/Providers";
    const models = generateModels(schemas, {
      modelPath: modelsPath,
      baseModelPath: baseModelsPath,
      providersPath,
      customTypes: customTypesMap
    });
    for (const model of models) {
      const filePath = resolve8(rootDir, getModelPath(model));
      const fileDir = dirname6(filePath);
      if (!existsSync8(fileDir)) {
        mkdirSync3(fileDir, { recursive: true });
      }
      if (!model.overwrite && existsSync8(filePath)) {
        logger.debug(`Skipped (exists): ${getModelPath(model)}`);
        continue;
      }
      writeFileSync4(filePath, model.content);
      logger.debug(`Created: ${getModelPath(model)}`);
      modelsGenerated++;
    }
    logger.success(`Generated ${modelsGenerated} model(s)`);
  }
  if (!options.typesOnly && config.output.laravel?.factoriesPath) {
    logger.step("Generating Laravel factories...");
    const factoriesPath = config.output.laravel.factoriesPath;
    const factoriesDir = resolve8(rootDir, factoriesPath);
    if (!existsSync8(factoriesDir)) {
      mkdirSync3(factoriesDir, { recursive: true });
    }
    const factories = generateFactories(schemas, {
      factoryPath: factoriesPath
    });
    for (const factory of factories) {
      const filePath = resolve8(rootDir, getFactoryPath(factory));
      const fileDir = dirname6(filePath);
      if (!existsSync8(fileDir)) {
        mkdirSync3(fileDir, { recursive: true });
      }
      if (!factory.overwrite && existsSync8(filePath)) {
        logger.debug(`Skipped (exists): ${getFactoryPath(factory)}`);
        continue;
      }
      writeFileSync4(filePath, factory.content);
      logger.debug(`Created: ${getFactoryPath(factory)}`);
      factoriesGenerated++;
    }
    logger.success(`Generated ${factoriesGenerated} factory(ies)`);
  }
  if (!options.migrationsOnly && config.output.typescript) {
    logger.step("Generating TypeScript types...");
    const tsConfig = config.output.typescript;
    const basePath = resolve8(rootDir, tsConfig.path);
    const schemasDir = resolve8(basePath, tsConfig.schemasDir ?? "schemas");
    const enumDir = resolve8(basePath, tsConfig.enumDir ?? "enum");
    const omnifyBaseDir = resolve8(rootDir, "node_modules/@omnify-base");
    const pluginEnumDir = resolve8(omnifyBaseDir, "enum");
    const baseSchemasDir = resolve8(omnifyBaseDir, "schemas");
    const enumImportPrefix = relative(schemasDir, enumDir).replace(/\\/g, "/");
    if (!existsSync8(schemasDir)) {
      mkdirSync3(schemasDir, { recursive: true });
      logger.debug(`Created directory: ${schemasDir}`);
    }
    if (!existsSync8(enumDir)) {
      mkdirSync3(enumDir, { recursive: true });
      logger.debug(`Created directory: ${enumDir}`);
    }
    if (!existsSync8(pluginEnumDir)) {
      mkdirSync3(pluginEnumDir, { recursive: true });
      logger.debug(`Created directory: ${pluginEnumDir}`);
    }
    if (!existsSync8(baseSchemasDir)) {
      mkdirSync3(baseSchemasDir, { recursive: true });
      logger.debug(`Created directory: ${baseSchemasDir}`);
    }
    const omnifyPkgJson = resolve8(omnifyBaseDir, "package.json");
    if (!existsSync8(omnifyPkgJson)) {
      writeFileSync4(omnifyPkgJson, JSON.stringify({
        name: "@omnify-base",
        version: "0.0.0",
        private: true,
        exports: {
          "./enum/*": "./enum/*.js",
          "./schemas/*": "./schemas/*.js"
        }
      }, null, 2));
    }
    const isMultiLocale = config.locale && config.locale.locales && config.locale.locales.length > 1;
    const typeFiles = generateTypeScript(schemas, {
      customTypes: customTypesMap,
      pluginEnums: pluginEnumsMap,
      localeConfig: config.locale,
      multiLocale: isMultiLocale,
      generateRules: tsConfig.generateRules ?? true,
      validationTemplates: tsConfig.validationTemplates,
      enumImportPrefix,
      pluginEnumImportPrefix: "@omnify-base/enum",
      baseImportPrefix: "@omnify-base/schemas",
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
      const filePath = resolve8(outputDir, outputFilePath);
      const fileDir = dirname6(filePath);
      if (!existsSync8(fileDir)) {
        mkdirSync3(fileDir, { recursive: true });
      }
      if (!file.overwrite && existsSync8(filePath)) {
        logger.debug(`Skipped (exists): ${file.filePath}`);
        continue;
      }
      writeFileSync4(filePath, file.content);
      logger.debug(`Created: ${file.filePath}`);
      typesGenerated++;
    }
    logger.success(`Generated ${typesGenerated} TypeScript file(s)`);
    const aliasResult = configureOmnifyAlias(rootDir, tsConfig.path, true);
    if (aliasResult.viteUpdated) {
      logger.success("Auto-configured @omnify alias in vite.config");
    }
    if (aliasResult.tsconfigUpdated) {
      logger.success("Auto-configured @omnify/* path in tsconfig.json");
    }
    const pluginAliasResult = addPluginEnumAlias(rootDir);
    if (pluginAliasResult.updated) {
      logger.success("Auto-configured @omnify-base alias in vite.config");
    }
    const pluginPathResult = addPluginEnumTsconfigPath(rootDir);
    if (pluginPathResult.updated) {
      logger.success("Auto-configured @omnify-base/* path in tsconfig.json");
    }
  }
  return { migrations: migrationsGenerated, types: typesGenerated, models: modelsGenerated, factories: factoriesGenerated };
}
async function runGenerate(options) {
  logger.setVerbose(options.verbose ?? false);
  logger.header("Generating Outputs");
  logger.debug("Loading configuration...");
  const { config, configPath } = await loadConfig();
  const rootDir = configPath ? dirname6(configPath) : process.cwd();
  validateConfig(config, rootDir);
  const schemaPath = resolve8(rootDir, config.schemasDir);
  logger.step(`Loading schemas from ${schemaPath}`);
  let schemas = await loadSchemas3(schemaPath);
  logger.debug(`Found ${Object.keys(schemas).length} schema(s) in main directory`);
  const additionalPaths = config.additionalSchemaPaths ?? [];
  let hasPackageSchemas = false;
  if (additionalPaths.length > 0) {
    logger.step(`Loading schemas from ${additionalPaths.length} additional path(s)`);
    for (const entry of additionalPaths) {
      const absolutePath = resolve8(rootDir, entry.path);
      logger.debug(`  Checking: ${entry.path} \u2192 ${absolutePath}`);
      if (existsSync8(absolutePath)) {
        let packageSchemas = await loadSchemas3(absolutePath, { skipPartialResolution: true });
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
    schemas = mergePartialSchemas3(schemas);
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
  const validationResult = validateSchemas3(schemas, {
    customTypes: customTypeNames
  });
  if (!validationResult.valid) {
    logger.error("Schema validation failed. Fix errors before generating.");
    for (const error of validationResult.errors) {
      const omnifyError = OmnifyError4.fromInfo(error);
      logger.formatError(omnifyError);
    }
    process.exit(2);
  }
  logger.step("Checking for changes...");
  const lockPath = resolve8(rootDir, config.lockFilePath);
  const existingLock = await readLockFile(lockPath);
  const currentSnapshots = await buildSchemaSnapshots(schemas);
  const v2Lock = existingLock && isLockFileV2(existingLock) ? existingLock : null;
  const comparison = compareSchemasDeep(currentSnapshots, v2Lock);
  const chainFilePath = resolve8(rootDir, VERSION_CHAIN_FILE);
  const versionChain = await readVersionChain(chainFilePath);
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
      const lockCheck = checkBulkLockViolation(versionChain, schemaActions);
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
        throw new OmnifyError4(
          lockCheck.reason ?? "Schema modification blocked by version lock",
          "E407",
          void 0,
          "Restore the original schema files or create new schemas instead of modifying locked ones."
        );
      }
    }
  }
  if (existingLock && config.output.laravel?.migrationsPath) {
    const migrationsDir = resolve8(rootDir, config.output.laravel.migrationsPath);
    const migrationValidation = await validateMigrations(existingLock, migrationsDir);
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
    if (migrationValidation.missingFiles.length > 0 && config.output.laravel) {
      const toRegenerate = getMigrationsToRegenerate(existingLock, migrationValidation.missingFiles);
      if (toRegenerate.length > 0) {
        const createMigrations = toRegenerate.filter((m) => m.type === "create");
        const alterMigrations = toRegenerate.filter((m) => m.type === "alter" || m.type === "drop");
        if (createMigrations.length > 0) {
          logger.info(`Regenerating ${createMigrations.length} missing CREATE migration(s) with original timestamps...`);
          const migrationsDir2 = resolve8(rootDir, config.output.laravel.migrationsPath);
          const customTypesMap2 = /* @__PURE__ */ new Map();
          for (const plugin of config.plugins) {
            if (plugin.types) {
              for (const [typeName, typeDef] of Object.entries(plugin.types)) {
                customTypesMap2.set(typeName, typeDef);
              }
            }
          }
          for (const migData of createMigrations) {
            const migrationSchemas = Object.fromEntries(
              Object.entries(schemas).filter(([name]) => migData.schemas.includes(name))
            );
            if (Object.keys(migrationSchemas).length === 0) {
              logger.warn(`  Cannot regenerate ${migData.fileName}: schema not found`);
              continue;
            }
            const regenerated = generateMigrations(migrationSchemas, {
              timestamp: migData.timestamp,
              customTypes: customTypesMap2
            });
            for (const mig of regenerated) {
              const filePath = resolve8(migrationsDir2, migData.fileName);
              writeFileSync4(filePath, mig.content);
              logger.success(`  Regenerated: ${migData.fileName}`);
            }
          }
        }
        if (alterMigrations.length > 0) {
          logger.warn(`Cannot regenerate ${alterMigrations.length} ALTER/DROP migration(s) - original change data not available.`);
          logger.warn("  Please restore these files from git or reset migrations with: npx omnify reset");
          for (const m of alterMigrations) {
            logger.warn(`    - ${m.fileName}`);
          }
        }
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
      const basePath2 = resolve8(rootDir, tsConfig2.path);
      const schemasDir2 = resolve8(basePath2, tsConfig2.schemasDir ?? "schemas");
      const enumDir2 = resolve8(basePath2, tsConfig2.enumDir ?? "enum");
      const omnifyBaseDir2 = resolve8(rootDir, "node_modules/@omnify-base");
      const pluginEnumDir2 = resolve8(omnifyBaseDir2, "enum");
      const baseSchemasDir2 = resolve8(omnifyBaseDir2, "schemas");
      const enumImportPrefix2 = relative(schemasDir2, enumDir2).replace(/\\/g, "/");
      if (!existsSync8(schemasDir2)) {
        mkdirSync3(schemasDir2, { recursive: true });
        logger.debug(`Created directory: ${schemasDir2}`);
      }
      if (!existsSync8(enumDir2)) {
        mkdirSync3(enumDir2, { recursive: true });
        logger.debug(`Created directory: ${enumDir2}`);
      }
      if (!existsSync8(pluginEnumDir2)) {
        mkdirSync3(pluginEnumDir2, { recursive: true });
        logger.debug(`Created directory: ${pluginEnumDir2}`);
      }
      if (!existsSync8(baseSchemasDir2)) {
        mkdirSync3(baseSchemasDir2, { recursive: true });
        logger.debug(`Created directory: ${baseSchemasDir2}`);
      }
      const omnifyPkgJson2 = resolve8(omnifyBaseDir2, "package.json");
      if (!existsSync8(omnifyPkgJson2)) {
        writeFileSync4(omnifyPkgJson2, JSON.stringify({
          name: "@omnify-base",
          version: "0.0.0",
          private: true,
          exports: {
            "./enum/*": "./enum/*.js",
            "./schemas/*": "./schemas/*.js"
          }
        }, null, 2));
      }
      const isMultiLocale = config.locale && config.locale.locales && config.locale.locales.length > 1;
      const typeFiles = generateTypeScript(schemas, {
        customTypes: customTypesMap,
        pluginEnums: pluginEnumsMap,
        localeConfig: config.locale,
        multiLocale: isMultiLocale,
        generateRules: tsConfig2.generateRules ?? true,
        validationTemplates: tsConfig2.validationTemplates,
        enumImportPrefix: enumImportPrefix2,
        pluginEnumImportPrefix: "@omnify-base/enum",
        baseImportPrefix: "@omnify-base/schemas",
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
        const filePath = resolve8(outputDir2, outputFilePath2);
        const fileDir = dirname6(filePath);
        if (!existsSync8(fileDir)) {
          mkdirSync3(fileDir, { recursive: true });
        }
        if (!file.overwrite && existsSync8(filePath)) {
          logger.debug(`Skipped (exists): ${file.filePath}`);
          continue;
        }
        writeFileSync4(filePath, file.content);
        logger.debug(`Created: ${file.filePath}`);
        typesGenerated++;
      }
      logger.success(`Generated ${typesGenerated} TypeScript file(s)`);
      const aliasResult = configureOmnifyAlias(rootDir, tsConfig2.path, true);
      if (aliasResult.viteUpdated) {
        logger.success("Auto-configured @omnify alias in vite.config");
      }
      if (aliasResult.tsconfigUpdated) {
        logger.success("Auto-configured @omnify/* path in tsconfig.json");
      }
      const pluginAliasResult = addPluginEnumAlias(rootDir);
      if (pluginAliasResult.updated) {
        logger.success("Auto-configured @omnify-base alias in vite.config");
      }
      const pluginPathResult = addPluginEnumTsconfigPath(rootDir);
      if (pluginPathResult.updated) {
        logger.success("Auto-configured @omnify-base/* path in tsconfig.json");
      }
      if (shouldGenerateTypescriptAIGuides(rootDir)) {
        const tsAIResult = generateTypescriptAIGuides(rootDir, {
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
  const newLockFile = updateLockFile(existingLock, currentSnapshots, config.database.driver);
  await writeLockFile(lockPath, newLockFile);
  logger.debug(`Updated: ${config.lockFilePath}`);
  if (comparison.hasChanges) {
    logger.step("Saving version history...");
    const versionStore = createVersionStore({ baseDir: rootDir, maxVersions: 100 });
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
      if (error instanceof OmnifyError4) {
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
export {
  defineConfig,
  loadConfig,
  logger,
  registerDiffCommand,
  registerGenerateCommand,
  registerInitCommand,
  registerValidateCommand,
  runInit
};
//# sourceMappingURL=index.js.map