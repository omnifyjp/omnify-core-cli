/**
 * @famgia/omnify-cli - Alias Configuration Utilities
 *
 * Auto-configures @omnify alias in vite.config.ts and tsconfig.json
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { logger } from '../output/logger.js';

/**
 * Result of alias configuration
 */
export interface AliasConfigResult {
    viteUpdated: boolean;
    tsconfigUpdated: boolean;
    viteSkipped: boolean;
    tsconfigSkipped: boolean;
    errors: string[];
}

/**
 * Check if vite.config.ts already has @omnify alias configured
 */
function hasViteOmnifyAlias(content: string): boolean {
    // Check for various patterns of @omnify alias
    return (
        content.includes("'@omnify'") ||
        content.includes('"@omnify"') ||
        content.includes('@omnify:') ||
        content.includes("'@omnify/")
    );
}

/**
 * Check if vite.config.ts already has .omnify-generated alias configured
 */
function hasViteOmnifyGeneratedAlias(content: string): boolean {
    return (
        content.includes("'.omnify-generated'") ||
        content.includes('".omnify-generated"') ||
        content.includes('.omnify-generated/')
    );
}

/**
 * Check if tsconfig.json already has @omnify path configured
 */
function hasTsconfigOmnifyPath(content: string): boolean {
    return (
        content.includes('"@omnify/*"') ||
        content.includes("'@omnify/*'") ||
        content.includes('"@omnify/"')
    );
}

/**
 * Update vite.config.ts to add @omnify alias
 *
 * @param rootDir - Project root directory
 * @param omnifyPath - Path to omnify folder (default: 'omnify')
 * @returns true if updated, false if skipped or failed
 */
export function updateViteConfig(
    rootDir: string,
    omnifyPath: string = 'omnify'
): { updated: boolean; skipped: boolean; error?: string } {
    const configPaths = [
        resolve(rootDir, 'vite.config.ts'),
        resolve(rootDir, 'vite.config.js'),
        resolve(rootDir, 'vite.config.mts'),
        resolve(rootDir, 'vite.config.mjs'),
    ];

    // Find existing vite config
    const configPath = configPaths.find((p) => existsSync(p));

    if (!configPath) {
        return { updated: false, skipped: true };
    }

    try {
        let content = readFileSync(configPath, 'utf-8');

        // Check if already configured
        if (hasViteOmnifyAlias(content)) {
            return { updated: false, skipped: true };
        }

        // Check if there's an existing alias section
        const aliasPatterns = [
            // Pattern 1: resolve: { alias: { ... } }
            /resolve\s*:\s*\{[^}]*alias\s*:\s*\{/,
            // Pattern 2: alias: { ... } directly in defineConfig
            /alias\s*:\s*\{/,
        ];

        let updated = false;

        for (const pattern of aliasPatterns) {
            const match = content.match(pattern);
            if (match) {
                // Insert @omnify alias after opening brace of alias object
                const insertPoint = match.index! + match[0].length;
                const aliasLine = `\n      '@omnify': path.resolve(__dirname, '${omnifyPath}'),`;
                content = content.slice(0, insertPoint) + aliasLine + content.slice(insertPoint);
                updated = true;
                break;
            }
        }

        // If no alias section found, try to add one in resolve section
        if (!updated) {
            const resolvePattern = /resolve\s*:\s*\{/;
            const resolveMatch = content.match(resolvePattern);

            if (resolveMatch) {
                const insertPoint = resolveMatch.index! + resolveMatch[0].length;
                const aliasSection = `
    alias: {
      '@omnify': path.resolve(__dirname, '${omnifyPath}'),
    },`;
                content = content.slice(0, insertPoint) + aliasSection + content.slice(insertPoint);
                updated = true;
            }
        }

        // If still not updated, try to add resolve section to defineConfig
        if (!updated) {
            // Look for defineConfig({
            const defineConfigPattern = /defineConfig\s*\(\s*\{/;
            const defineConfigMatch = content.match(defineConfigPattern);

            if (defineConfigMatch) {
                const insertPoint = defineConfigMatch.index! + defineConfigMatch[0].length;
                const resolveSection = `
  resolve: {
    alias: {
      '@omnify': path.resolve(__dirname, '${omnifyPath}'),
    },
  },`;
                content = content.slice(0, insertPoint) + resolveSection + content.slice(insertPoint);

                // Add path import if not present
                if (!content.includes("import path from") && !content.includes("import * as path")) {
                    content = `import path from 'path';\n` + content;
                }
                updated = true;
            }
        }

        if (updated) {
            // Ensure path import exists
            if (!content.includes("import path from") && !content.includes("import * as path") && !content.includes("require('path')")) {
                // Add at the top after other imports
                const importMatch = content.match(/^(import .+;\n)+/m);
                if (importMatch) {
                    const insertPoint = importMatch.index! + importMatch[0].length;
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
            error: 'Could not find suitable location to add alias. Please add manually.',
        };
    } catch (error) {
        return {
            updated: false,
            skipped: false,
            error: `Failed to update vite.config: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}

/**
 * Update tsconfig.json to add @omnify path
 *
 * @param rootDir - Project root directory
 * @param omnifyPath - Path to omnify folder (default: 'omnify')
 * @returns true if updated, false if skipped or failed
 */
export function updateTsconfig(
    rootDir: string,
    omnifyPath: string = 'omnify'
): { updated: boolean; skipped: boolean; error?: string } {
    const configPath = resolve(rootDir, 'tsconfig.json');

    if (!existsSync(configPath)) {
        return { updated: false, skipped: true };
    }

    try {
        const content = readFileSync(configPath, 'utf-8');

        // Check if already configured
        if (hasTsconfigOmnifyPath(content)) {
            return { updated: false, skipped: true };
        }

        // Parse JSON (with comment removal for safety)
        const jsonContent = content
            .replace(/\/\/.*$/gm, '') // Remove single-line comments
            .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

        let config: Record<string, unknown>;
        try {
            config = JSON.parse(jsonContent);
        } catch {
            return {
                updated: false,
                skipped: false,
                error: 'Could not parse tsconfig.json as JSON',
            };
        }

        // Ensure compilerOptions exists
        if (!config.compilerOptions) {
            config.compilerOptions = {};
        }

        const compilerOptions = config.compilerOptions as Record<string, unknown>;

        // Ensure paths exists
        if (!compilerOptions.paths) {
            compilerOptions.paths = {};
        }

        const paths = compilerOptions.paths as Record<string, string[]>;

        // Add @omnify path
        paths['@omnify/*'] = [`./${omnifyPath}/*`];

        // Write back with proper formatting
        // We need to preserve the original formatting as much as possible
        // Simple approach: use 2-space indent
        const newContent = JSON.stringify(config, null, 2);

        writeFileSync(configPath, newContent + '\n');
        return { updated: true, skipped: false };
    } catch (error) {
        return {
            updated: false,
            skipped: false,
            error: `Failed to update tsconfig.json: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}

/**
 * Configure @omnify alias in both vite.config and tsconfig.json
 *
 * @param rootDir - Project root directory
 * @param omnifyPath - Path to omnify folder (default: 'omnify')
 * @param silent - Don't log messages (for use in generate command)
 */
export function configureOmnifyAlias(
    rootDir: string,
    omnifyPath: string = 'omnify',
    silent: boolean = false
): AliasConfigResult {
    const result: AliasConfigResult = {
        viteUpdated: false,
        tsconfigUpdated: false,
        viteSkipped: false,
        tsconfigSkipped: false,
        errors: [],
    };

    // Update vite.config
    const viteResult = updateViteConfig(rootDir, omnifyPath);
    result.viteUpdated = viteResult.updated;
    result.viteSkipped = viteResult.skipped;
    if (viteResult.error) {
        result.errors.push(viteResult.error);
    }

    // Update tsconfig.json
    const tsconfigResult = updateTsconfig(rootDir, omnifyPath);
    result.tsconfigUpdated = tsconfigResult.updated;
    result.tsconfigSkipped = tsconfigResult.skipped;
    if (tsconfigResult.error) {
        result.errors.push(tsconfigResult.error);
    }

    // Log results
    if (!silent) {
        if (result.viteUpdated) {
            logger.success('Updated vite.config - Added @omnify alias');
        }
        if (result.tsconfigUpdated) {
            logger.success('Updated tsconfig.json - Added @omnify/* path');
        }
        if (result.errors.length > 0) {
            for (const error of result.errors) {
                logger.warn(error);
            }
        }
    }

    return result;
}

/**
 * Add .omnify-generated alias to vite.config for plugin enum imports.
 * This is needed because plugin enums are stored in node_modules/.omnify-generated
 */
export function addPluginEnumAlias(rootDir: string): { updated: boolean; error?: string } {
    const configPaths = [
        resolve(rootDir, 'vite.config.ts'),
        resolve(rootDir, 'vite.config.js'),
        resolve(rootDir, 'vite.config.mts'),
        resolve(rootDir, 'vite.config.mjs'),
    ];

    const configPath = configPaths.find((p) => existsSync(p));
    if (!configPath) {
        return { updated: false };
    }

    try {
        let content = readFileSync(configPath, 'utf-8');

        // Check if already configured
        if (hasViteOmnifyGeneratedAlias(content)) {
            return { updated: false };
        }

        // Find the line with @omnify alias that ends with ), and add new alias after it
        // Match pattern: '@omnify': ... ),  (handles single and multi-line definitions)
        const lines = content.split('\n');
        let insertIndex = -1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Look for line containing @omnify alias
            if ((line.includes("'@omnify'") || line.includes('"@omnify"')) && line.includes(':')) {
                // Find the line where this alias definition ends (with ),)
                for (let j = i; j < lines.length; j++) {
                    if (lines[j].includes('),') || (lines[j].trim().endsWith(',') && lines[j].includes(')'))) {
                        insertIndex = j + 1;
                        break;
                    }
                }
                break;
            }
        }

        if (insertIndex > 0) {
            const indent = '      '; // Match typical Vite config indentation
            const aliasLine = `${indent}'.omnify-generated': path.resolve(__dirname, 'node_modules/.omnify-generated'),`;
            lines.splice(insertIndex, 0, aliasLine);
            content = lines.join('\n');
            writeFileSync(configPath, content);
            return { updated: true };
        }

        return { updated: false, error: 'Could not find @omnify alias to add .omnify-generated after' };
    } catch (error) {
        return {
            updated: false,
            error: `Failed to add plugin enum alias: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}

/**
 * Add .omnify-generated path to tsconfig.json for plugin enum imports.
 */
export function addPluginEnumTsconfigPath(rootDir: string): { updated: boolean; error?: string } {
    const configPath = resolve(rootDir, 'tsconfig.json');
    if (!existsSync(configPath)) {
        return { updated: false };
    }

    try {
        const content = readFileSync(configPath, 'utf-8');
        
        // Check if already has .omnify-generated path
        if (content.includes('.omnify-generated')) {
            return { updated: false };
        }

        // Parse JSON with comments
        const jsonContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
        const config = JSON.parse(jsonContent);

        if (!config.compilerOptions) {
            config.compilerOptions = {};
        }
        if (!config.compilerOptions.paths) {
            config.compilerOptions.paths = {};
        }

        config.compilerOptions.paths['.omnify-generated/*'] = ['./node_modules/.omnify-generated/*'];

        writeFileSync(configPath, JSON.stringify(config, null, 2));
        return { updated: true };
    } catch (error) {
        return {
            updated: false,
            error: `Failed to add plugin enum tsconfig path: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}
