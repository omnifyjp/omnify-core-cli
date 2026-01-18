#!/usr/bin/env node
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/cli.ts
import { existsSync as existsSync13 } from "fs";
import { resolve as resolve13 } from "path";
import { Command } from "commander";
import { OmnifyError as OmnifyError7 } from "@famgia/omnify-core";

// src/commands/init.ts
import { existsSync as existsSync2, mkdirSync, writeFileSync as writeFileSync2 } from "fs";
import { resolve as resolve2 } from "path";
import { select, confirm, input } from "@inquirer/prompts";

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

// src/config/alias-config.ts
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
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
    resolve(rootDir, "vite.config.ts"),
    resolve(rootDir, "vite.config.js"),
    resolve(rootDir, "vite.config.mts"),
    resolve(rootDir, "vite.config.mjs")
  ];
  const configPath2 = configPaths.find((p) => existsSync(p));
  if (!configPath2) {
    return { updated: false, skipped: true };
  }
  try {
    let content = readFileSync(configPath2, "utf-8");
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
      writeFileSync(configPath2, content);
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
  const configPath2 = resolve(rootDir, "tsconfig.json");
  if (!existsSync(configPath2)) {
    return { updated: false, skipped: true };
  }
  try {
    const content = readFileSync(configPath2, "utf-8");
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
    writeFileSync(configPath2, newContent + "\n");
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
    resolve(rootDir, "vite.config.ts"),
    resolve(rootDir, "vite.config.js"),
    resolve(rootDir, "vite.config.mts"),
    resolve(rootDir, "vite.config.mjs")
  ];
  const configPath2 = configPaths.find((p) => existsSync(p));
  if (!configPath2) {
    return { updated: false };
  }
  try {
    let content = readFileSync(configPath2, "utf-8");
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
      writeFileSync(configPath2, content);
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
  const configPath2 = resolve(rootDir, "tsconfig.json");
  if (!existsSync(configPath2)) {
    return { updated: false };
  }
  try {
    const content = readFileSync(configPath2, "utf-8");
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
    writeFileSync(configPath2, JSON.stringify(config, null, 2));
    return { updated: true };
  } catch (error) {
    return {
      updated: false,
      error: `Failed to add plugin enum tsconfig path: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// src/commands/init.ts
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
  const configPath2 = resolve2(cwd, "omnify.config.ts");
  if (existsSync2(configPath2) && !options.force) {
    logger.warn("omnify.config.ts already exists. Use --force to overwrite.");
    return;
  }
  let config;
  if (options.yes) {
    config = {
      database: "mysql",
      migrationTool: "laravel",
      generateTypes: true,
      migrationsPath: "database/migrations/omnify",
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
      laravel: { migrations: "database/migrations/omnify", types: "resources/js/types" },
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
  const schemasDir = resolve2(cwd, config.schemasDir);
  if (!existsSync2(schemasDir)) {
    mkdirSync(schemasDir, { recursive: true });
    logger.debug(`Created ${config.schemasDir}/ directory`);
  }
  const examplePath = resolve2(schemasDir, "User.yaml");
  if (!existsSync2(examplePath) || options.force) {
    writeFileSync2(examplePath, EXAMPLE_SCHEMA);
    logger.debug("Created example schema: User.yaml");
  }
  const configContent = generateConfig(config);
  writeFileSync2(configPath2, configContent);
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
function registerInitCommand(program2) {
  program2.command("init").description("Initialize a new omnify project").option("-f, --force", "Overwrite existing files").option("-y, --yes", "Use default configuration (skip prompts)").action(async (options) => {
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

// src/config/loader.ts
import { existsSync as existsSync4 } from "fs";
import { resolve as resolve4, dirname as dirname2 } from "path";
import { createJiti } from "jiti";
import { configError, configNotFoundError } from "@famgia/omnify-core";

// src/config/discovery.ts
import { existsSync as existsSync3, readFileSync as readFileSync2 } from "fs";
import { resolve as resolve3 } from "path";
var MANIFEST_FILENAME = ".omnify-packages.json";
var MANIFEST_VERSION = 1;
function loadPackageManifest(projectRoot) {
  const manifestPath = resolve3(projectRoot, MANIFEST_FILENAME);
  if (!existsSync3(manifestPath)) {
    logger.debug(`Package manifest not found: ${manifestPath}`);
    return null;
  }
  try {
    const content = readFileSync2(manifestPath, "utf-8");
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
        const schemasPath = resolve3(projectRoot, config.schemas);
        if (!existsSync3(schemasPath)) {
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
  const cwd = resolve4(startDir);
  for (const filename of CONFIG_FILES) {
    const configPath2 = resolve4(cwd, filename);
    if (existsSync4(configPath2)) {
      return configPath2;
    }
  }
  return null;
}
async function loadConfigFile(configPath2) {
  const jiti = createJiti(configPath2, {
    interopDefault: true,
    moduleCache: false
  });
  try {
    const module = await jiti.import(configPath2);
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
async function resolvePlugins(plugins, configPath2) {
  if (!plugins || plugins.length === 0) {
    return [];
  }
  const resolved = [];
  const configDir = configPath2 ? dirname2(configPath2) : process.cwd();
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
async function resolveConfig(userConfig, configPath2) {
  const plugins = await resolvePlugins(userConfig.plugins, configPath2);
  const projectRoot = configPath2 ? dirname2(configPath2) : process.cwd();
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
    migrationsPath: userConfig.output?.laravel?.migrationsPath ?? "database/migrations/omnify"
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
  const schemaPath = resolve4(rootDir, config.schemasDir);
  if (!existsSync4(schemaPath)) {
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
  const cwd = resolve4(startDir);
  const configPath2 = findConfigFile(cwd);
  if (configPath2) {
    const userConfig = await loadConfigFile(configPath2);
    const config = await resolveConfig(userConfig, configPath2);
    return {
      config,
      configPath: configPath2
    };
  }
  throw configNotFoundError(resolve4(cwd, "omnify.config.ts"));
}

// src/commands/validate.ts
async function runValidate(options) {
  logger.setVerbose(options.verbose ?? false);
  logger.header("Validating Schemas");
  logger.debug("Loading configuration...");
  logger.timing("Config load start");
  const { config, configPath: configPath2 } = await loadConfig();
  logger.timing("Config loaded");
  const rootDir = configPath2 ? dirname3(configPath2) : process.cwd();
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
function registerValidateCommand(program2) {
  program2.command("validate").description("Validate schema files").option("-v, --verbose", "Show detailed output").action(async (options) => {
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
  const { config, configPath: configPath2 } = await loadConfig();
  const rootDir = configPath2 ? dirname4(configPath2) : process.cwd();
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
function registerDiffCommand(program2) {
  program2.command("diff").description("Show pending schema changes").option("-v, --verbose", "Show detailed output").option("--check", "Exit with code 1 if changes exist (for CI)").action(async (options) => {
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
  const { config, configPath: configPath2 } = await loadConfig();
  const rootDir = configPath2 ? dirname6(configPath2) : process.cwd();
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
function registerGenerateCommand(program2) {
  program2.command("generate").description("Generate Laravel migrations and TypeScript types").option("-v, --verbose", "Show detailed output").option("--migrations-only", "Only generate migrations").option("--types-only", "Only generate TypeScript types").option("-f, --force", "Generate even if no changes detected").option("--check", "CI mode: check if migrations are in sync without generating (exits with code 1 if out of sync)").option("--no-warn-stale", "Disable stale migration warnings").action(async (options) => {
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

// src/commands/reset.ts
import { existsSync as existsSync9, readdirSync as readdirSync3, rmSync, statSync } from "fs";
import { resolve as resolve9, dirname as dirname7, join as join2 } from "path";
import { createInterface } from "readline";
async function confirm2(message) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve14) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close();
      resolve14(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}
function countFiles(dir) {
  if (!existsSync9(dir)) return 0;
  let count = 0;
  const entries = readdirSync3(dir);
  for (const entry of entries) {
    const fullPath = join2(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      count += countFiles(fullPath);
    } else {
      count++;
    }
  }
  return count;
}
function deleteDir(dir, verbose) {
  if (!existsSync9(dir)) return 0;
  const count = countFiles(dir);
  rmSync(dir, { recursive: true, force: true });
  if (verbose) {
    logger.debug(`Deleted: ${dir}`);
  }
  return count;
}
function deleteFilesInDir(dir, pattern, verbose) {
  if (!existsSync9(dir)) return 0;
  let count = 0;
  const entries = readdirSync3(dir);
  for (const entry of entries) {
    const fullPath = join2(dir, entry);
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
async function runReset(options) {
  logger.setVerbose(options.verbose ?? false);
  logger.header("Reset Omnify Generated Files");
  logger.debug("Loading configuration...");
  const { config, configPath: configPath2 } = await loadConfig();
  const rootDir = configPath2 ? dirname7(configPath2) : process.cwd();
  const paths = [];
  const omnifyBasePaths = [
    { name: "OmnifyBase models", paths: ["app/Models/OmnifyBase", "backend/app/Models/OmnifyBase"] },
    { name: "OmnifyBase requests", paths: ["app/Http/Requests/OmnifyBase", "backend/app/Http/Requests/OmnifyBase"] },
    { name: "OmnifyBase resources", paths: ["app/Http/Resources/OmnifyBase", "backend/app/Http/Resources/OmnifyBase"] }
  ];
  const legacyGeneratedPaths = [
    { name: "Legacy Generated models", paths: ["app/Models/Generated", "backend/app/Models/Generated"] },
    { name: "Legacy Generated requests", paths: ["app/Http/Requests/Generated", "backend/app/Http/Requests/Generated"] },
    { name: "Legacy Generated resources", paths: ["app/Http/Resources/Generated", "backend/app/Http/Resources/Generated"] }
  ];
  for (const { name, paths: relPaths } of omnifyBasePaths) {
    for (const relPath of relPaths) {
      const omnifyBasePath = resolve9(rootDir, relPath);
      if (existsSync9(omnifyBasePath)) {
        paths.push({ name, path: omnifyBasePath, type: "dir" });
        break;
      }
    }
  }
  for (const { name, paths: relPaths } of legacyGeneratedPaths) {
    for (const relPath of relPaths) {
      const legacyPath = resolve9(rootDir, relPath);
      if (existsSync9(legacyPath)) {
        paths.push({ name, path: legacyPath, type: "dir" });
        break;
      }
    }
  }
  const migrationPaths = [
    "database/migrations/omnify",
    "backend/database/migrations/omnify"
  ];
  for (const relPath of migrationPaths) {
    const migrationsPath = resolve9(rootDir, relPath);
    if (existsSync9(migrationsPath)) {
      paths.push({
        name: "Omnify migrations",
        path: migrationsPath,
        type: "files",
        pattern: /\.php$/
      });
      break;
    }
  }
  const laravelConfig = config.output.laravel;
  if (laravelConfig?.modelsPath) {
    const modelsPath = resolve9(rootDir, laravelConfig.modelsPath);
    const omnifyBasePath = join2(modelsPath, "OmnifyBase");
    if (existsSync9(omnifyBasePath) && !paths.some((p) => p.path === omnifyBasePath)) {
      paths.push({ name: "OmnifyBase models", path: omnifyBasePath, type: "dir" });
    }
  }
  if (laravelConfig?.migrationsPath) {
    const migrationsPath = resolve9(rootDir, laravelConfig.migrationsPath);
    if (existsSync9(migrationsPath) && !paths.some((p) => p.path === migrationsPath)) {
      paths.push({
        name: "Omnify migrations",
        path: migrationsPath,
        type: "files",
        pattern: /\.php$/
      });
    }
  }
  if (config.additionalSchemaPaths) {
    for (const additionalPath of config.additionalSchemaPaths) {
      const pkgOutput = additionalPath.output?.laravel;
      if (pkgOutput?.base) {
        const pkgBase = resolve9(rootDir, pkgOutput.base);
        const pkgName = additionalPath.namespace ?? "Package";
        const pkgOmnifyBase = join2(pkgBase, pkgOutput.baseModelsPath ?? "src/Models/OmnifyBase");
        if (existsSync9(pkgOmnifyBase) && !paths.some((p) => p.path === pkgOmnifyBase)) {
          paths.push({ name: `${pkgName} OmnifyBase`, path: pkgOmnifyBase, type: "dir" });
        }
        const pkgGenerated = join2(pkgBase, "src/Models/Generated");
        if (existsSync9(pkgGenerated) && !paths.some((p) => p.path === pkgGenerated)) {
          paths.push({ name: `${pkgName} Legacy Generated`, path: pkgGenerated, type: "dir" });
        }
        const pkgMigrations = join2(pkgBase, pkgOutput.migrationsPath ?? "database/migrations/omnify");
        if (existsSync9(pkgMigrations) && !paths.some((p) => p.path === pkgMigrations)) {
          paths.push({
            name: `${pkgName} migrations`,
            path: pkgMigrations,
            type: "dir"
          });
        }
        const pkgProviders = join2(pkgBase, pkgOutput.providersPath ?? "src/Providers");
        if (existsSync9(pkgProviders) && !paths.some((p) => p.path === pkgProviders)) {
          paths.push({ name: `${pkgName} Providers`, path: pkgProviders, type: "dir" });
        }
        const pkgFactories = join2(pkgBase, pkgOutput.factoriesPath ?? "database/factories");
        if (existsSync9(pkgFactories) && !paths.some((p) => p.path === pkgFactories)) {
          paths.push({ name: `${pkgName} Factories`, path: pkgFactories, type: "dir" });
        }
      }
    }
  }
  const typescriptPath = config.output.typescript?.path;
  const tsBasePath = typescriptPath ? resolve9(rootDir, typescriptPath) : null;
  const commonTsPaths = [
    "resources/ts/omnify",
    "resources/ts/omnify/schemas",
    "resources/ts/types/models",
    "frontend/src/types/model",
    "frontend/src/types/models",
    "src/types/models"
  ];
  let foundTsPath = tsBasePath;
  if (!foundTsPath || !existsSync9(foundTsPath)) {
    for (const relPath of commonTsPaths) {
      const tsPath = resolve9(rootDir, relPath);
      if (existsSync9(tsPath)) {
        foundTsPath = tsPath;
        break;
      }
    }
  }
  if (foundTsPath && existsSync9(foundTsPath)) {
    const autoGeneratedDirs = ["base", "enum", "rules", "hooks", "lib"];
    for (const subDir of autoGeneratedDirs) {
      const subPath = join2(foundTsPath, subDir);
      if (existsSync9(subPath)) {
        paths.push({ name: `TypeScript ${subDir}`, path: subPath, type: "dir" });
      }
    }
    const autoGeneratedFiles = ["common.ts", "index.ts", "i18n.ts"];
    for (const fileName of autoGeneratedFiles) {
      const filePath = join2(foundTsPath, fileName);
      if (existsSync9(filePath)) {
        paths.push({ name: `TypeScript ${fileName}`, path: filePath, type: "file" });
      }
    }
  }
  const lockFilePath = resolve9(rootDir, config.lockFilePath);
  if (existsSync9(lockFilePath)) {
    paths.push({ name: "Lock file", path: lockFilePath, type: "file" });
  }
  const versionsDir = resolve9(rootDir, ".omnify-versions");
  if (existsSync9(versionsDir)) {
    paths.push({ name: "Version history", path: versionsDir, type: "dir" });
  }
  const omnifyVersionsDir = resolve9(rootDir, ".omnify/versions");
  if (existsSync9(omnifyVersionsDir)) {
    paths.push({ name: "Version history (.omnify/versions)", path: omnifyVersionsDir, type: "dir" });
  }
  const logsDir = resolve9(rootDir, ".omnify/logs");
  if (existsSync9(logsDir)) {
    paths.push({ name: "Logs", path: logsDir, type: "dir" });
  }
  if (paths.length === 0) {
    logger.info("Nothing to clean. No generated files found.");
    return;
  }
  logger.newline();
  logger.warn("The following will be deleted:");
  logger.newline();
  for (const item of paths) {
    if (item.type === "dir") {
      const count = countFiles(item.path);
      logger.info(`  \u2022 ${item.name}: ${item.path} (${count} files)`);
    } else if (item.type === "files" && item.pattern) {
      const count = readdirSync3(item.path).filter((f) => item.pattern.test(f)).length;
      logger.info(`  \u2022 ${item.name}: ${item.path} (${count} files)`);
    } else {
      logger.info(`  \u2022 ${item.name}: ${item.path}`);
    }
  }
  logger.newline();
  if (!options.yes) {
    const confirmed = await confirm2("Are you sure you want to delete these files?");
    if (!confirmed) {
      logger.info("Reset cancelled.");
      return;
    }
  }
  logger.newline();
  logger.step("Deleting files...");
  let totalDeleted = 0;
  for (const item of paths) {
    if (item.type === "dir") {
      const count = deleteDir(item.path, options.verbose ?? false);
      totalDeleted += count;
      logger.info(`  \u2713 Deleted ${item.name} (${count} files)`);
    } else if (item.type === "files" && item.pattern) {
      const count = deleteFilesInDir(item.path, item.pattern, options.verbose ?? false);
      totalDeleted += count;
      logger.info(`  \u2713 Deleted ${item.name} (${count} files)`);
    } else {
      rmSync(item.path, { force: true });
      if (options.verbose) {
        logger.debug(`Deleted: ${item.path}`);
      }
      totalDeleted++;
      logger.info(`  \u2713 Deleted ${item.name}`);
    }
  }
  logger.newline();
  logger.success(`Reset complete! Deleted ${totalDeleted} file(s).`);
  logger.newline();
  logger.info("Run `omnify generate` to regenerate files.");
}
function registerResetCommand(program2) {
  program2.command("reset").description("Delete all generated files (OmnifyBase, migrations, locks)").option("-v, --verbose", "Show detailed output").option("-y, --yes", "Skip confirmation prompt").action(async (options) => {
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

// src/commands/create-project.ts
import { execSync, spawn } from "child_process";
import { existsSync as existsSync10, rmSync as rmSync2, readFileSync as readFileSync4, writeFileSync as writeFileSync5 } from "fs";
import { resolve as resolve10 } from "path";
var BOILERPLATE_REPO = "https://github.com/omnifyjp/omnify-laravel-boilerplate.git";
var IS_WINDOWS = process.platform === "win32";
function checkGit() {
  try {
    execSync("git --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
function checkDockerInstalled() {
  try {
    execSync("docker --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
function checkDockerRunning() {
  try {
    execSync("docker info", { stdio: "ignore", timeout: 1e4 });
    return true;
  } catch {
    return false;
  }
}
function showDockerInstallInstructions() {
  logger.newline();
  logger.error("Docker is not installed.");
  logger.newline();
  logger.info("Please install Docker:");
  if (IS_WINDOWS) {
    logger.info("  1. Download Docker Desktop from: https://www.docker.com/products/docker-desktop/");
    logger.info("  2. Run the installer and follow the instructions");
    logger.info("  3. Make sure WSL 2 is enabled (Docker Desktop will guide you)");
    logger.info("  4. Restart your computer if prompted");
    logger.info("  5. Start Docker Desktop");
  } else if (process.platform === "darwin") {
    logger.info("  1. Download Docker Desktop from: https://www.docker.com/products/docker-desktop/");
    logger.info("  2. Or install via Homebrew: brew install --cask docker");
    logger.info("  3. Start Docker Desktop from Applications");
  } else {
    logger.info("  1. Install Docker: https://docs.docker.com/engine/install/");
    logger.info("  2. Install Docker Compose: https://docs.docker.com/compose/install/");
    logger.info("  3. Start Docker service: sudo systemctl start docker");
  }
  logger.newline();
  logger.info("After installing, run the command again.");
}
function showDockerNotRunningInstructions() {
  logger.newline();
  logger.error("Docker daemon is not running.");
  logger.newline();
  logger.info("Please start Docker:");
  if (IS_WINDOWS) {
    logger.info("  1. Open Docker Desktop from the Start menu");
    logger.info("  2. Wait for Docker to fully start (whale icon in system tray becomes steady)");
    logger.info("  3. If Docker fails to start, try:");
    logger.info("     - Restart your computer");
    logger.info("     - Make sure WSL 2 is properly installed");
    logger.info('     - Check Windows Features: "Virtual Machine Platform" and "WSL" are enabled');
  } else if (process.platform === "darwin") {
    logger.info("  1. Open Docker Desktop from Applications");
    logger.info("  2. Wait for Docker to fully start (whale icon in menu bar becomes steady)");
    logger.info("  3. Or start from terminal: open -a Docker");
  } else {
    logger.info("  1. Start Docker service: sudo systemctl start docker");
    logger.info("  2. Or: sudo service docker start");
    logger.info("  3. Check status: docker info");
  }
  logger.newline();
  logger.info("After Docker is running, run the command again.");
}
function checkDockerPrerequisites() {
  if (!checkDockerInstalled()) {
    showDockerInstallInstructions();
    return false;
  }
  if (!checkDockerRunning()) {
    showDockerNotRunningInstructions();
    return false;
  }
  return true;
}
var GITIGNORE_ENTRIES_TO_REMOVE = [
  // Auto-generated projects (consumers need to track these)
  "# Auto-generated projects",
  "backend/",
  "frontend/",
  // Lock files (consumers should track their lock state)
  "# Lock files",
  ".omnify.lock",
  ".omnify/versions/",
  ".omnify/current.lock",
  // Omnify auto-generated docs (consumers should track these)
  "# Omnify auto-generated docs",
  ".cursor/rules/omnify.md",
  ".claude/omnify/"
];
function cleanupGitignore(targetDir) {
  const gitignorePath = resolve10(targetDir, ".gitignore");
  if (!existsSync10(gitignorePath)) return;
  const content = readFileSync4(gitignorePath, "utf-8");
  const lines = content.split("\n");
  const cleanedLines = lines.filter((line) => {
    const trimmed = line.trim();
    return !GITIGNORE_ENTRIES_TO_REMOVE.includes(trimmed);
  });
  while (cleanedLines.length > 0 && cleanedLines[0].trim() === "") {
    cleanedLines.shift();
  }
  writeFileSync5(gitignorePath, cleanedLines.join("\n"));
}
function cloneRepo(repo, targetDir) {
  logger.step(`Cloning boilerplate from ${repo}...`);
  execSync(`git clone --depth 1 ${repo} "${targetDir}"`, { stdio: "inherit" });
  const gitDir = resolve10(targetDir, ".git");
  if (existsSync10(gitDir)) {
    rmSync2(gitDir, { recursive: true, force: true });
  }
  cleanupGitignore(targetDir);
  execSync("git init", { cwd: targetDir, stdio: "ignore" });
  logger.success("Repository cloned successfully");
}
function runCommand(command, targetDir) {
  return new Promise((resolve14, reject) => {
    const child = spawn(command, [], {
      cwd: targetDir,
      shell: true,
      stdio: "inherit"
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve14();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
    child.on("error", (error) => {
      reject(error);
    });
  });
}
async function runSetup(targetDir) {
  logger.step("Checking Docker...");
  if (!checkDockerPrerequisites()) {
    logger.newline();
    logger.info("You can skip setup and run it later:");
    logger.info("  npx @famgia/omnify create-laravel-project <project-name> --skip-setup");
    logger.newline();
    throw new Error("Docker is not available. Please start Docker and try again.");
  }
  logger.success("Docker is running");
  logger.step("Installing dependencies...");
  await runCommand("pnpm install", targetDir);
  logger.success("Dependencies installed");
  logger.step("Running setup...");
  const setupScript = "pnpm run setup";
  try {
    await runCommand(setupScript, targetDir);
  } catch (error) {
    logger.newline();
    logger.error("Setup failed. This might be a Docker issue.");
    logger.newline();
    logger.info("Troubleshooting steps:");
    logger.info("  1. Make sure Docker Desktop is fully started");
    logger.info("  2. Check Docker status: docker info");
    logger.info("  3. Check container logs: docker-compose logs");
    if (IS_WINDOWS) {
      logger.info("  4. On Windows, ensure WSL 2 is working: wsl --status");
      logger.info("  5. Try restarting Docker Desktop");
    }
    logger.newline();
    logger.info("To retry setup manually:");
    logger.info(`  cd ${targetDir}`);
    logger.info("  pnpm run setup");
    logger.newline();
    throw error;
  }
}
async function runCreateProject(projectName, options) {
  const targetDir = resolve10(process.cwd(), projectName);
  const repo = options.repo ?? BOILERPLATE_REPO;
  if (!checkGit()) {
    logger.error("Git is not installed. Please install git first.");
    process.exit(1);
  }
  if (existsSync10(targetDir)) {
    logger.error(`Directory "${projectName}" already exists.`);
    process.exit(1);
  }
  logger.newline();
  logger.info(`Creating new Laravel project: ${projectName}`);
  logger.newline();
  let cloneSucceeded = false;
  try {
    cloneRepo(repo, targetDir);
    cloneSucceeded = true;
    if (!options.skipSetup) {
      process.chdir(targetDir);
      await runSetup(targetDir);
    }
    logger.newline();
    logger.success("Project created successfully!");
    logger.newline();
    logger.info("Next steps:");
    logger.info(`  cd ${projectName}`);
    if (options.skipSetup) {
      logger.info("  pnpm run setup");
    }
    logger.info("  pnpm run dev");
    logger.newline();
  } catch (error) {
    if (!cloneSucceeded && existsSync10(targetDir)) {
      rmSync2(targetDir, { recursive: true, force: true });
    } else if (cloneSucceeded) {
      logger.newline();
      logger.info("Project files have been kept. You can retry setup after fixing the issue:");
      logger.info(`  cd ${projectName}`);
      logger.info("  pnpm run setup");
      logger.newline();
    }
    throw error;
  }
}
function registerCreateProjectCommand(program2) {
  program2.command("create-laravel-project <project-name>").description("Create a new Laravel project from boilerplate").option("-r, --repo <url>", "Custom boilerplate repository URL", BOILERPLATE_REPO).option("--skip-setup", "Skip running the setup script").action(async (projectName, options) => {
    try {
      await runCreateProject(projectName, options);
    } catch (error) {
      if (error instanceof Error) {
        logger.error(error.message);
      }
      process.exit(1);
    }
  });
}

// src/commands/deploy.ts
import { existsSync as existsSync11 } from "fs";
import { resolve as resolve11, dirname as dirname8 } from "path";
import { loadSchemas as loadSchemas4, OmnifyError as OmnifyError5 } from "@famgia/omnify-core";
import {
  VERSION_CHAIN_FILE as VERSION_CHAIN_FILE2,
  readVersionChain as readVersionChain2,
  deployVersion,
  getChainSummary,
  verifyChain
} from "@famgia/omnify-atlas";
async function confirmDeploy(schemaCount, environment, version) {
  const { createInterface: createInterface2 } = await import("readline");
  const rl = createInterface2({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve14) => {
    logger.newline();
    logger.warn("\u26A0\uFE0F  WARNING: This action is IRREVERSIBLE!");
    logger.warn("");
    logger.warn(`   Environment: ${environment}`);
    logger.warn(`   Version:     ${version}`);
    logger.warn(`   Schemas:     ${schemaCount} file(s)`);
    logger.warn("");
    logger.warn("   Once locked, these schema files CANNOT be:");
    logger.warn("   \u2022 Deleted");
    logger.warn("   \u2022 Modified (content hash is recorded)");
    logger.warn("");
    logger.warn("   This creates an immutable blockchain-like record.");
    logger.newline();
    rl.question('   Type "LOCK" to confirm: ', (answer) => {
      rl.close();
      resolve14(answer.trim().toUpperCase() === "LOCK");
    });
  });
}
async function collectSchemaFiles(schemasDir) {
  const files = [];
  const schemas = await loadSchemas4(schemasDir);
  for (const [name, schema] of Object.entries(schemas)) {
    files.push({
      name,
      relativePath: schema.relativePath,
      filePath: schema.filePath
    });
  }
  return files;
}
async function runDeploy(options) {
  logger.setVerbose(options.verbose ?? false);
  logger.header("Deploy Version Lock");
  logger.debug("Loading configuration...");
  const { config, configPath: configPath2 } = await loadConfig();
  const rootDir = configPath2 ? dirname8(configPath2) : process.cwd();
  validateConfig(config, rootDir);
  const schemasDir = resolve11(rootDir, config.schemasDir);
  const chainFilePath = resolve11(rootDir, VERSION_CHAIN_FILE2);
  if (!existsSync11(schemasDir)) {
    throw new OmnifyError5(
      `Schemas directory not found: ${schemasDir}`,
      "E003",
      void 0,
      "Make sure the schemasDir in omnify.config.ts is correct."
    );
  }
  logger.step("Collecting schema files...");
  const schemaFiles = await collectSchemaFiles(schemasDir);
  if (schemaFiles.length === 0) {
    throw new OmnifyError5(
      "No schema files found",
      "E003",
      void 0,
      "Create schema files in your schemas directory before deploying."
    );
  }
  logger.info(`Found ${schemaFiles.length} schema file(s)`);
  const existingChain = await readVersionChain2(chainFilePath);
  if (existingChain) {
    const summary = getChainSummary(existingChain);
    logger.debug(`Existing chain: ${summary.blockCount} block(s), ${summary.schemaCount} schema(s)`);
    logger.step("Verifying chain integrity...");
    const verification = await verifyChain(existingChain, schemasDir);
    if (!verification.valid) {
      logger.error("Chain integrity verification failed!");
      if (verification.corruptedBlocks.length > 0) {
        logger.error("");
        logger.error("Corrupted blocks:");
        for (const block of verification.corruptedBlocks) {
          logger.error(`  \u2022 ${block.version}: ${block.reason}`);
        }
      }
      if (verification.tamperedSchemas.length > 0) {
        logger.error("");
        logger.error("Tampered schemas (modified since lock):");
        for (const schema of verification.tamperedSchemas) {
          logger.error(`  \u2022 ${schema.schemaName} (locked in ${schema.lockedInVersion})`);
        }
      }
      if (verification.deletedLockedSchemas.length > 0) {
        logger.error("");
        logger.error("Deleted locked schemas:");
        for (const schema of verification.deletedLockedSchemas) {
          logger.error(`  \u2022 ${schema.schemaName} (locked in ${schema.lockedInVersion})`);
        }
      }
      throw new OmnifyError5(
        "Cannot deploy: chain integrity compromised",
        "E406",
        void 0,
        "Restore deleted/modified files to match the locked state, or contact support."
      );
    }
    logger.success("Chain integrity verified \u2713");
  } else {
    logger.info("Creating new version chain (first deployment)");
  }
  const environment = options.environment ?? "production";
  const version = options.version ?? generateVersionFromTimestamp();
  if (options.dryRun) {
    logger.newline();
    logger.info("DRY RUN - No changes will be made");
    logger.info("");
    logger.info(`Would create block:`);
    logger.info(`  Version:     ${version}`);
    logger.info(`  Environment: ${environment}`);
    logger.info(`  Schemas:     ${schemaFiles.length} file(s)`);
    logger.info("");
    for (const file of schemaFiles) {
      logger.info(`    \u2022 ${file.name} (${file.relativePath})`);
    }
    return;
  }
  if (!options.yes) {
    const confirmed = await confirmDeploy(schemaFiles.length, environment, version);
    if (!confirmed) {
      logger.newline();
      logger.info("Deployment cancelled.");
      return;
    }
  }
  logger.step("Creating version lock...");
  const deployOptions = {
    version,
    environment,
    deployedBy: options.deployedBy ?? process.env.USER ?? "unknown",
    comment: options.comment,
    skipConfirmation: true
  };
  const result = await deployVersion(chainFilePath, schemasDir, schemaFiles, deployOptions);
  if (!result.success) {
    throw new OmnifyError5(
      result.error ?? "Deployment failed",
      "E408"
    );
  }
  logger.newline();
  logger.success("\u{1F512} Version locked successfully!");
  logger.newline();
  if (result.block) {
    logger.info(`  Version:     ${result.block.version}`);
    logger.info(`  Block Hash:  ${result.block.blockHash.substring(0, 16)}...`);
    logger.info(`  Locked At:   ${result.block.lockedAt}`);
    logger.info(`  Environment: ${result.block.environment}`);
    logger.info(`  Schemas:     ${result.block.schemas.length} file(s)`);
  }
  if (result.addedSchemas.length > 0) {
    logger.newline();
    logger.info("  New schemas locked:");
    for (const name of result.addedSchemas) {
      logger.info(`    + ${name}`);
    }
  }
  if (result.warnings.length > 0) {
    logger.newline();
    logger.warn("  Warnings:");
    for (const warning of result.warnings) {
      logger.warn(`    \u26A0 ${warning}`);
    }
  }
  logger.newline();
  logger.info(`  Chain file: ${VERSION_CHAIN_FILE2}`);
  logger.info("  This file should be committed to version control.");
}
function generateVersionFromTimestamp() {
  const now = /* @__PURE__ */ new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  return `v${year}.${month}.${day}-${hour}${minute}${second}`;
}
function registerDeployCommand(program2) {
  program2.command("deploy").description("Lock schema version for production (blockchain-like immutable record)").option("-v, --verbose", "Show detailed output").option("--version <version>", "Version name (e.g., v1.0.0, default: auto-generated)").option("-e, --environment <env>", "Deployment environment (default: production)", "production").option("-c, --comment <comment>", "Deployment comment").option("-y, --yes", "Skip confirmation prompt (for CI/CD)").option("--deployed-by <name>", "Deployer name (default: $USER)").option("--dry-run", "Show what would be locked without making changes").action(async (options) => {
    try {
      await runDeploy(options);
    } catch (error) {
      if (error instanceof OmnifyError5) {
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

// src/commands/verify.ts
import { existsSync as existsSync12 } from "fs";
import { resolve as resolve12, dirname as dirname9 } from "path";
import { OmnifyError as OmnifyError6 } from "@famgia/omnify-core";
import {
  VERSION_CHAIN_FILE as VERSION_CHAIN_FILE3,
  readVersionChain as readVersionChain3,
  verifyChain as verifyChain2,
  getChainSummary as getChainSummary2,
  getLockedSchemas
} from "@famgia/omnify-atlas";
async function runVerify(options) {
  logger.setVerbose(options.verbose ?? false);
  if (!options.json) {
    logger.header("Verify Version Chain");
  }
  logger.debug("Loading configuration...");
  const { config, configPath: configPath2 } = await loadConfig();
  const rootDir = configPath2 ? dirname9(configPath2) : process.cwd();
  validateConfig(config, rootDir);
  const schemasDir = resolve12(rootDir, config.schemasDir);
  const chainFilePath = resolve12(rootDir, VERSION_CHAIN_FILE3);
  if (!existsSync12(chainFilePath)) {
    if (options.json) {
      console.log(JSON.stringify({
        valid: true,
        message: "No version chain exists yet",
        blockCount: 0,
        schemaCount: 0
      }, null, 2));
      return;
    }
    logger.info("No version chain exists yet.");
    logger.info('Run "npx omnify deploy" to create the first version lock.');
    return;
  }
  const chain = await readVersionChain3(chainFilePath);
  if (!chain) {
    throw new OmnifyError6(
      "Failed to read version chain file",
      "E406",
      void 0,
      `Check if ${VERSION_CHAIN_FILE3} is valid JSON.`
    );
  }
  const summary = getChainSummary2(chain);
  if (!options.json) {
    logger.step("Chain Summary");
    logger.info(`  Blocks:       ${summary.blockCount}`);
    logger.info(`  Schemas:      ${summary.schemaCount}`);
    logger.info(`  First Lock:   ${summary.firstVersion ?? "N/A"}`);
    logger.info(`  Latest Lock:  ${summary.latestVersion ?? "N/A"}`);
    logger.info(`  Environments: ${summary.environments.join(", ") || "N/A"}`);
    logger.newline();
  }
  if (!options.json) {
    logger.step("Verifying chain integrity...");
  }
  const verification = await verifyChain2(chain, schemasDir);
  if (options.json) {
    console.log(JSON.stringify({
      valid: verification.valid,
      blockCount: verification.blockCount,
      verifiedBlocks: verification.verifiedBlocks,
      corruptedBlocks: verification.corruptedBlocks,
      tamperedSchemas: verification.tamperedSchemas,
      deletedLockedSchemas: verification.deletedLockedSchemas,
      summary
    }, null, 2));
    if (!verification.valid) {
      process.exit(1);
    }
    return;
  }
  if (verification.valid) {
    logger.success("\u2713 Chain integrity verified");
    logger.success(`\u2713 All ${verification.blockCount} block(s) valid`);
    logger.success("\u2713 No tampered or deleted locked schemas");
    logger.newline();
    if (options.showAll) {
      const lockedSchemas = getLockedSchemas(chain);
      logger.step("Locked Schemas");
      for (const [name, info] of lockedSchemas) {
        logger.info(`  \u2022 ${name}`);
        logger.debug(`    Path:    ${info.relativePath}`);
        logger.debug(`    Hash:    ${info.hash.substring(0, 16)}...`);
        logger.debug(`    Version: ${info.version}`);
      }
    }
  } else {
    logger.error("\u2717 Chain integrity verification FAILED");
    logger.newline();
    let exitCode = 0;
    if (verification.corruptedBlocks.length > 0) {
      logger.error("Corrupted Blocks:");
      for (const block of verification.corruptedBlocks) {
        logger.error(`  \u2717 ${block.version}`);
        logger.error(`    Reason: ${block.reason}`);
        logger.error(`    Expected: ${block.expectedHash.substring(0, 16)}...`);
        logger.error(`    Actual:   ${block.actualHash.substring(0, 16)}...`);
      }
      logger.newline();
      exitCode = 1;
    }
    if (verification.tamperedSchemas.length > 0) {
      logger.error("Tampered Schemas (modified since lock):");
      for (const schema of verification.tamperedSchemas) {
        logger.error(`  \u2717 ${schema.schemaName}`);
        logger.error(`    File:      ${schema.filePath}`);
        logger.error(`    Locked in: ${schema.lockedInVersion}`);
        logger.error(`    Locked:    ${schema.lockedHash.substring(0, 16)}...`);
        logger.error(`    Current:   ${schema.currentHash.substring(0, 16)}...`);
      }
      logger.newline();
      exitCode = 1;
    }
    if (verification.deletedLockedSchemas.length > 0) {
      logger.error("Deleted Locked Schemas:");
      for (const schema of verification.deletedLockedSchemas) {
        logger.error(`  \u2717 ${schema.schemaName}`);
        logger.error(`    File:      ${schema.filePath}`);
        logger.error(`    Locked in: ${schema.lockedInVersion}`);
        logger.error(`    Hash:      ${schema.lockedHash.substring(0, 16)}...`);
      }
      logger.newline();
      exitCode = 1;
    }
    logger.newline();
    logger.warn("How to fix:");
    logger.warn("  1. Restore deleted files from git or backup");
    logger.warn("  2. Revert modified files to their locked state");
    logger.warn("  3. Do NOT modify the .omnify.chain file");
    logger.newline();
    process.exit(exitCode);
  }
}
function registerVerifyCommand(program2) {
  program2.command("verify").description("Verify version chain integrity and schema states").option("-v, --verbose", "Show detailed output").option("-a, --show-all", "Show all locked schemas").option("--json", "Output result as JSON").action(async (options) => {
    try {
      await runVerify(options);
    } catch (error) {
      if (error instanceof OmnifyError6) {
        if (options.json) {
          console.log(JSON.stringify({
            valid: false,
            error: error.message
          }, null, 2));
        } else {
          logger.formatError(error);
        }
        process.exit(logger.getExitCode(error));
      } else if (error instanceof Error) {
        if (options.json) {
          console.log(JSON.stringify({
            valid: false,
            error: error.message
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

// src/cli.ts
var VERSION = "0.0.5";
var program = new Command();
program.name("omnify").description("Schema-first database migrations for Laravel and TypeScript").version(VERSION);
registerInitCommand(program);
registerValidateCommand(program);
registerDiffCommand(program);
registerGenerateCommand(program);
registerResetCommand(program);
registerCreateProjectCommand(program);
registerDeployCommand(program);
registerVerifyCommand(program);
process.on("uncaughtException", (error) => {
  if (error instanceof OmnifyError7) {
    logger.formatError(error);
    process.exit(logger.getExitCode(error));
  } else {
    logger.error(error.message);
    process.exit(1);
  }
});
process.on("unhandledRejection", (reason) => {
  if (reason instanceof OmnifyError7) {
    logger.formatError(reason);
    process.exit(logger.getExitCode(reason));
  } else if (reason instanceof Error) {
    logger.error(reason.message);
  } else {
    logger.error(String(reason));
  }
  process.exit(1);
});
var args = process.argv.slice(2);
var firstArg = args[0];
var hasCommand = firstArg !== void 0 && !firstArg.startsWith("-");
var configPath = resolve13(process.cwd(), "omnify.config.ts");
var hasConfig = existsSync13(configPath);
if (!hasCommand && !hasConfig) {
  runInit({}).catch((error) => {
    if (error instanceof Error) {
      if (error.message.includes("User force closed")) {
        logger.newline();
        logger.info("Setup cancelled.");
        process.exit(0);
      }
      logger.error(error.message);
    }
    process.exit(1);
  });
} else {
  program.parse();
}
//# sourceMappingURL=cli.js.map