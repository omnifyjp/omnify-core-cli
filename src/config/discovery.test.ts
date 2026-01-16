/**
 * Tests for Package Auto-Discovery Module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadPackageManifest, discoverPackages, getManifestPath } from './discovery.js';
import type { OmnifyPackagesManifest, DiscoveryConfig } from './types.js';

describe('Package Auto-Discovery', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = resolve(tmpdir(), `omnify-discovery-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('loadPackageManifest', () => {
    it('returns null when manifest does not exist', () => {
      const result = loadPackageManifest(testDir);
      expect(result).toBeNull();
    });

    it('loads valid manifest file', () => {
      const manifest: OmnifyPackagesManifest = {
        version: 1,
        generated_at: '2026-01-16T10:00:00Z',
        packages: {
          'vendor/billing': {
            schemas: '/path/to/vendor/billing/database/schemas',
            namespace: 'Billing',
            version: '1.0.0',
            priority: 10,
          },
        },
      };

      writeFileSync(
        join(testDir, '.omnify-packages.json'),
        JSON.stringify(manifest)
      );

      const result = loadPackageManifest(testDir);
      expect(result).not.toBeNull();
      expect(result?.version).toBe(1);
      expect(result?.packages['vendor/billing']).toBeDefined();
      expect(result?.packages['vendor/billing'].namespace).toBe('Billing');
    });

    it('handles malformed JSON gracefully', () => {
      writeFileSync(join(testDir, '.omnify-packages.json'), 'not valid json');

      const result = loadPackageManifest(testDir);
      expect(result).toBeNull();
    });
  });

  describe('discoverPackages', () => {
    it('returns empty array when discovery is disabled', () => {
      const config: DiscoveryConfig = { enabled: false };
      const result = discoverPackages(testDir, config);
      expect(result).toEqual([]);
    });

    it('returns empty array when no manifest exists', () => {
      const config: DiscoveryConfig = { enabled: true };
      const result = discoverPackages(testDir, config);
      expect(result).toEqual([]);
    });

    it('converts manifest packages to schema paths', () => {
      // Create manifest
      const manifest: OmnifyPackagesManifest = {
        version: 1,
        packages: {
          'vendor/billing': {
            schemas: join(testDir, 'vendor/billing/database/schemas'),
            namespace: 'Billing',
            priority: 10,
          },
        },
      };

      // Create the schemas directory so it passes the existence check
      mkdirSync(join(testDir, 'vendor/billing/database/schemas'), { recursive: true });

      writeFileSync(
        join(testDir, '.omnify-packages.json'),
        JSON.stringify(manifest)
      );

      const config: DiscoveryConfig = { enabled: true };
      const result = discoverPackages(testDir, config);

      expect(result).toHaveLength(1);
      expect(result[0].namespace).toBe('Billing');
      expect(result[0].path).toContain('vendor/billing/database/schemas');
    });

    it('excludes specified packages', () => {
      // Create manifest with multiple packages
      const manifest: OmnifyPackagesManifest = {
        version: 1,
        packages: {
          'vendor/billing': {
            schemas: join(testDir, 'vendor/billing/database/schemas'),
            namespace: 'Billing',
            priority: 10,
          },
          'vendor/deprecated': {
            schemas: join(testDir, 'vendor/deprecated/database/schemas'),
            namespace: 'Deprecated',
            priority: 20,
          },
        },
      };

      // Create schemas directories
      mkdirSync(join(testDir, 'vendor/billing/database/schemas'), { recursive: true });
      mkdirSync(join(testDir, 'vendor/deprecated/database/schemas'), { recursive: true });

      writeFileSync(
        join(testDir, '.omnify-packages.json'),
        JSON.stringify(manifest)
      );

      const config: DiscoveryConfig = {
        enabled: true,
        exclude: ['vendor/deprecated'],
      };
      const result = discoverPackages(testDir, config);

      expect(result).toHaveLength(1);
      expect(result[0].namespace).toBe('Billing');
    });

    it('merges with explicit additionalSchemaPaths', () => {
      // Create manifest
      const manifest: OmnifyPackagesManifest = {
        version: 1,
        packages: {
          'vendor/billing': {
            schemas: join(testDir, 'vendor/billing/database/schemas'),
            namespace: 'Billing',
            priority: 10,
          },
        },
      };

      mkdirSync(join(testDir, 'vendor/billing/database/schemas'), { recursive: true });
      writeFileSync(
        join(testDir, '.omnify-packages.json'),
        JSON.stringify(manifest)
      );

      const config: DiscoveryConfig = { enabled: true };
      const explicitPaths = [
        { path: './local/schemas', namespace: 'Local' },
      ];

      const result = discoverPackages(testDir, config, explicitPaths);

      expect(result).toHaveLength(2);
      // Discovered packages come first
      expect(result[0].namespace).toBe('Billing');
      // Explicit paths come last (can override)
      expect(result[1].namespace).toBe('Local');
    });

    it('skips packages with non-existent schema paths', () => {
      const manifest: OmnifyPackagesManifest = {
        version: 1,
        packages: {
          'vendor/missing': {
            schemas: join(testDir, 'vendor/missing/database/schemas'),
            namespace: 'Missing',
            priority: 10,
          },
        },
      };

      // Don't create the schemas directory
      writeFileSync(
        join(testDir, '.omnify-packages.json'),
        JSON.stringify(manifest)
      );

      const config: DiscoveryConfig = { enabled: true };
      const result = discoverPackages(testDir, config);

      expect(result).toHaveLength(0);
    });

    it('converts package options to output config', () => {
      const manifest: OmnifyPackagesManifest = {
        version: 1,
        packages: {
          'vendor/billing': {
            schemas: join(testDir, 'vendor/billing/database/schemas'),
            namespace: 'Billing',
            priority: 10,
            options: {
              modelNamespace: 'Vendor\\Billing\\Models',
              generateMigrations: true,
              generateServiceProvider: true,
            },
          },
        },
      };

      mkdirSync(join(testDir, 'vendor/billing/database/schemas'), { recursive: true });
      writeFileSync(
        join(testDir, '.omnify-packages.json'),
        JSON.stringify(manifest)
      );

      const config: DiscoveryConfig = { enabled: true };
      const result = discoverPackages(testDir, config);

      expect(result).toHaveLength(1);
      expect(result[0].output).toBeDefined();
      expect(result[0].output?.laravel).toBeDefined();
    });
  });

  describe('getManifestPath', () => {
    it('returns correct manifest path', () => {
      const result = getManifestPath(testDir);
      expect(result).toBe(join(testDir, '.omnify-packages.json'));
    });
  });
});
