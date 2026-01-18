/**
 * @famgia/omnify-cli - Config Loader Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import {
  findConfigFile,
  resolveConfig,
  validateConfig,
  requireDevUrl,
  defineConfig,
} from './loader.js';
import type { OmnifyConfig } from '@famgia/omnify-types';

describe('Config Loader', () => {
  const testDir = resolve(process.cwd(), '.test-config-loader');

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('findConfigFile', () => {
    it('finds omnify.config.ts', () => {
      const configPath = resolve(testDir, 'omnify.config.ts');
      writeFileSync(configPath, 'export default {}');

      const result = findConfigFile(testDir);
      expect(result).toBe(configPath);
    });

    it('finds omnify.config.js', () => {
      const configPath = resolve(testDir, 'omnify.config.js');
      writeFileSync(configPath, 'module.exports = {}');

      const result = findConfigFile(testDir);
      expect(result).toBe(configPath);
    });

    it('prefers .ts over .js', () => {
      writeFileSync(resolve(testDir, 'omnify.config.ts'), 'export default {}');
      writeFileSync(resolve(testDir, 'omnify.config.js'), 'module.exports = {}');

      const result = findConfigFile(testDir);
      expect(result).toContain('omnify.config.ts');
    });

    it('returns null when no config found', () => {
      const result = findConfigFile(testDir);
      expect(result).toBeNull();
    });
  });

  describe('resolveConfig', () => {
    it('applies defaults to minimal config', async () => {
      const userConfig: OmnifyConfig = {
        database: {
          driver: 'mysql',
        },
      };

      const result = await resolveConfig(userConfig, null);

      expect(result.schemasDir).toBe('./schemas');
      expect(result.database.driver).toBe('mysql');
      expect(result.output.laravel!.migrationsPath).toBe('database/migrations/omnify');
      expect(result.output.typescript!.path).toBe('types');
      expect(result.output.typescript!.singleFile).toBe(true);
      expect(result.verbose).toBe(false);
      expect(result.lockFilePath).toBe('.omnify.lock');
      expect(result.plugins).toEqual([]);
    });

    it('preserves user-provided values', async () => {
      const userConfig: OmnifyConfig = {
        schemasDir: './custom-schemas',
        database: {
          driver: 'postgres',
          devUrl: 'postgres://localhost/test',
        },
        output: {
          laravel: {
            migrationsPath: 'custom/migrations',
          },
          typescript: {
            path: 'custom/types',
            singleFile: false,
          },
        },
        verbose: true,
        lockFilePath: 'custom.lock',
      };

      const result = await resolveConfig(userConfig, null);

      expect(result.schemasDir).toBe('./custom-schemas');
      expect(result.database.driver).toBe('postgres');
      expect(result.database.devUrl).toBe('postgres://localhost/test');
      expect(result.output.laravel!.migrationsPath).toBe('custom/migrations');
      expect(result.output.typescript!.path).toBe('custom/types');
      expect(result.output.typescript!.singleFile).toBe(false);
      expect(result.verbose).toBe(true);
      expect(result.lockFilePath).toBe('custom.lock');
    });
  });

  describe('validateConfig', () => {
    it('passes when schema directory exists', () => {
      const schemasDir = resolve(testDir, 'schemas');
      mkdirSync(schemasDir);

      const config = {
        schemasDir: 'schemas',
        database: { driver: 'mysql' as const, enableFieldComments: false },
        output: {
          laravel: { migrationsPath: 'database/migrations' },
          typescript: { path: 'types', singleFile: true, generateEnums: true, generateRelationships: true },
        },
        plugins: [],
        verbose: false,
        lockFilePath: '.omnify.lock',
        discovery: { enabled: true },
      };

      expect(() => validateConfig(config, testDir)).not.toThrow();
    });

    it('throws when schema directory is missing', () => {
      const config = {
        schemasDir: 'nonexistent',
        database: { driver: 'mysql' as const, enableFieldComments: false },
        output: {
          laravel: { migrationsPath: 'database/migrations' },
          typescript: { path: 'types', singleFile: true, generateEnums: true, generateRelationships: true },
        },
        plugins: [],
        verbose: false,
        lockFilePath: '.omnify.lock',
        discovery: { enabled: true },
      };

      expect(() => validateConfig(config, testDir)).toThrow(/Schema directory not found/);
    });
  });

  describe('requireDevUrl', () => {
    it('passes when devUrl is configured', () => {
      const config = {
        schemasDir: 'schemas',
        database: { driver: 'mysql' as const, devUrl: 'mysql://localhost/test', enableFieldComments: false },
        output: {
          laravel: { migrationsPath: 'database/migrations' },
          typescript: { path: 'types', singleFile: true, generateEnums: true, generateRelationships: true },
        },
        plugins: [],
        verbose: false,
        lockFilePath: '.omnify.lock',
        discovery: { enabled: true },
      };

      expect(() => requireDevUrl(config)).not.toThrow();
    });

    it('throws when devUrl is missing', () => {
      const config = {
        schemasDir: 'schemas',
        database: { driver: 'mysql' as const, enableFieldComments: false },
        output: {
          laravel: { migrationsPath: 'database/migrations' },
          typescript: { path: 'types', singleFile: true, generateEnums: true, generateRelationships: true },
        },
        plugins: [],
        verbose: false,
        lockFilePath: '.omnify.lock',
        discovery: { enabled: true },
      };

      expect(() => requireDevUrl(config)).toThrow(/devUrl is required/);
    });
  });

  describe('defineConfig', () => {
    it('returns the same config object', () => {
      const config: OmnifyConfig = {
        database: { driver: 'mysql' },
      };

      const result = defineConfig(config);
      expect(result).toBe(config);
    });
  });
});
