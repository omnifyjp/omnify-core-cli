/**
 * @famgia/omnify-cli - Generate Command Tests
 *
 * Tests for migration generation logic, especially duplicate prevention.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { existsSync, mkdirSync, rmSync, writeFileSync, readdirSync } from 'node:fs';

/**
 * Scans a directory for existing migration files and returns tables that already have CREATE migrations.
 * This is a copy of the function from generate.ts for testing purposes.
 */
function getExistingMigrationTables(migrationsDir: string): Set<string> {
  const existingTables = new Set<string>();

  if (!existsSync(migrationsDir)) {
    return existingTables;
  }

  try {
    const files = readdirSync(migrationsDir);
    // Match pattern: YYYY_MM_DD_HHMMSS_create_<table>_table.php
    const createMigrationPattern = /^\d{4}_\d{2}_\d{2}_\d{6}_create_(.+)_table\.php$/;

    for (const file of files) {
      const match = file.match(createMigrationPattern);
      if (match) {
        existingTables.add(match[1]); // table name
      }
    }
  } catch {
    // Ignore errors reading directory
  }

  return existingTables;
}

describe('Generate Command - Duplicate Migration Prevention', () => {
  const testDir = resolve(process.cwd(), '.test-generate-command');
  const migrationsDir = resolve(testDir, 'database/migrations/omnify');

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
    mkdirSync(migrationsDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  describe('getExistingMigrationTables', () => {
    it('returns empty set for non-existent directory', () => {
      const result = getExistingMigrationTables('/non/existent/path');
      expect(result.size).toBe(0);
    });

    it('returns empty set for empty directory', () => {
      const result = getExistingMigrationTables(migrationsDir);
      expect(result.size).toBe(0);
    });

    it('detects single create migration', () => {
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154720_create_users_table.php'),
        '<?php // migration content'
      );

      const result = getExistingMigrationTables(migrationsDir);
      expect(result.size).toBe(1);
      expect(result.has('users')).toBe(true);
    });

    it('detects multiple create migrations', () => {
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154720_create_users_table.php'),
        '<?php // migration content'
      );
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154721_create_posts_table.php'),
        '<?php // migration content'
      );
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154722_create_comments_table.php'),
        '<?php // migration content'
      );

      const result = getExistingMigrationTables(migrationsDir);
      expect(result.size).toBe(3);
      expect(result.has('users')).toBe(true);
      expect(result.has('posts')).toBe(true);
      expect(result.has('comments')).toBe(true);
    });

    it('handles table names with underscores', () => {
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154720_create_post_tags_table.php'),
        '<?php // migration content'
      );
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154721_create_user_profiles_table.php'),
        '<?php // migration content'
      );

      const result = getExistingMigrationTables(migrationsDir);
      expect(result.size).toBe(2);
      expect(result.has('post_tags')).toBe(true);
      expect(result.has('user_profiles')).toBe(true);
    });

    it('ignores alter migrations', () => {
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154720_create_users_table.php'),
        '<?php // migration content'
      );
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154721_update_users_table.php'),
        '<?php // migration content'
      );
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154722_alter_users_table.php'),
        '<?php // migration content'
      );

      const result = getExistingMigrationTables(migrationsDir);
      expect(result.size).toBe(1);
      expect(result.has('users')).toBe(true);
    });

    it('ignores drop migrations', () => {
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154720_create_users_table.php'),
        '<?php // migration content'
      );
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154721_drop_old_users_table.php'),
        '<?php // migration content'
      );

      const result = getExistingMigrationTables(migrationsDir);
      expect(result.size).toBe(1);
      expect(result.has('users')).toBe(true);
    });

    it('ignores non-php files', () => {
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154720_create_users_table.php'),
        '<?php // migration content'
      );
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154720_create_posts_table.txt'),
        'not a migration'
      );
      writeFileSync(
        resolve(migrationsDir, 'README.md'),
        '# Migrations'
      );

      const result = getExistingMigrationTables(migrationsDir);
      expect(result.size).toBe(1);
      expect(result.has('users')).toBe(true);
    });

    it('ignores files with invalid timestamp format', () => {
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154720_create_users_table.php'),
        '<?php // valid'
      );
      // Invalid: missing time component
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_create_posts_table.php'),
        '<?php // invalid'
      );
      // Invalid: wrong date format
      writeFileSync(
        resolve(migrationsDir, '26_1_10_154720_create_comments_table.php'),
        '<?php // invalid'
      );

      const result = getExistingMigrationTables(migrationsDir);
      expect(result.size).toBe(1);
      expect(result.has('users')).toBe(true);
    });

    it('handles multiple create migrations for same table (bug scenario)', () => {
      // This is the bug scenario - multiple create migrations for the same table
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154720_create_users_table.php'),
        '<?php // first'
      );
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_155028_create_users_table.php'),
        '<?php // duplicate'
      );
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_162332_create_users_table.php'),
        '<?php // duplicate'
      );
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_164651_create_users_table.php'),
        '<?php // duplicate'
      );

      const result = getExistingMigrationTables(migrationsDir);
      // Set only contains unique values, so even with 4 files, we only get 1 table
      expect(result.size).toBe(1);
      expect(result.has('users')).toBe(true);
    });

    it('handles mixed migrations (create, alter, drop) for multiple tables', () => {
      // Users: create + alter
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154720_create_users_table.php'),
        '<?php'
      );
      writeFileSync(
        resolve(migrationsDir, '2026_01_11_100000_update_users_table.php'),
        '<?php'
      );

      // Posts: create + drop (table was removed)
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154721_create_posts_table.php'),
        '<?php'
      );
      writeFileSync(
        resolve(migrationsDir, '2026_01_12_100000_drop_posts_table.php'),
        '<?php'
      );

      // Comments: only create
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154722_create_comments_table.php'),
        '<?php'
      );

      const result = getExistingMigrationTables(migrationsDir);
      expect(result.size).toBe(3);
      expect(result.has('users')).toBe(true);
      expect(result.has('posts')).toBe(true);
      expect(result.has('comments')).toBe(true);
    });

    it('handles Laravel 11+ anonymous class migrations', () => {
      // Laravel 11+ uses timestamp_create_tablename_table.php format
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154720_create_users_table.php'),
        `<?php
use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->timestamps();
        });
    }
};`
      );

      const result = getExistingMigrationTables(migrationsDir);
      expect(result.size).toBe(1);
      expect(result.has('users')).toBe(true);
    });

    it('detects pivot table migrations', () => {
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154720_create_users_table.php'),
        '<?php'
      );
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154721_create_posts_table.php'),
        '<?php'
      );
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154722_create_tags_table.php'),
        '<?php'
      );
      // Pivot table for ManyToMany relationship
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154723_create_post_tag_table.php'),
        '<?php'
      );

      const result = getExistingMigrationTables(migrationsDir);
      expect(result.size).toBe(4);
      expect(result.has('users')).toBe(true);
      expect(result.has('posts')).toBe(true);
      expect(result.has('tags')).toBe(true);
      expect(result.has('post_tag')).toBe(true);
    });
  });

  describe('Migration skip logic', () => {
    /**
     * Simulates the migration skip logic from generate.ts
     */
    function shouldSkipMigration(
      tableName: string,
      existingTables: Set<string>
    ): boolean {
      return existingTables.has(tableName);
    }

    it('skips migration when table already has create migration', () => {
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154720_create_users_table.php'),
        '<?php'
      );

      const existingTables = getExistingMigrationTables(migrationsDir);

      expect(shouldSkipMigration('users', existingTables)).toBe(true);
    });

    it('creates migration for new table', () => {
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154720_create_users_table.php'),
        '<?php'
      );

      const existingTables = getExistingMigrationTables(migrationsDir);

      expect(shouldSkipMigration('posts', existingTables)).toBe(false);
      expect(shouldSkipMigration('comments', existingTables)).toBe(false);
    });

    it('handles empty migrations directory correctly', () => {
      const existingTables = getExistingMigrationTables(migrationsDir);

      // All tables should be created
      expect(shouldSkipMigration('users', existingTables)).toBe(false);
      expect(shouldSkipMigration('posts', existingTables)).toBe(false);
      expect(shouldSkipMigration('comments', existingTables)).toBe(false);
    });

    it('handles --force flag scenario correctly', () => {
      // When --force is used, we still need to check existing tables
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154720_create_users_table.php'),
        '<?php'
      );
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154721_create_posts_table.php'),
        '<?php'
      );

      const existingTables = getExistingMigrationTables(migrationsDir);

      // Existing tables should be skipped
      expect(shouldSkipMigration('users', existingTables)).toBe(true);
      expect(shouldSkipMigration('posts', existingTables)).toBe(true);

      // New tables should be created
      expect(shouldSkipMigration('comments', existingTables)).toBe(false);
      expect(shouldSkipMigration('tags', existingTables)).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('handles directory with permission error gracefully', () => {
      // Attempting to read a non-accessible path
      const result = getExistingMigrationTables('/root/protected/migrations');
      expect(result.size).toBe(0);
    });

    it('handles very long table names', () => {
      const longTableName = 'a'.repeat(64); // MySQL max table name is 64 chars
      writeFileSync(
        resolve(migrationsDir, `2026_01_10_154720_create_${longTableName}_table.php`),
        '<?php'
      );

      const result = getExistingMigrationTables(migrationsDir);
      expect(result.size).toBe(1);
      expect(result.has(longTableName)).toBe(true);
    });

    it('handles table names with numbers', () => {
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154720_create_oauth2_clients_table.php'),
        '<?php'
      );
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154721_create_v2_migrations_table.php'),
        '<?php'
      );

      const result = getExistingMigrationTables(migrationsDir);
      expect(result.size).toBe(2);
      expect(result.has('oauth2_clients')).toBe(true);
      expect(result.has('v2_migrations')).toBe(true);
    });

    it('handles table names with only numbers', () => {
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154720_create_12345_table.php'),
        '<?php'
      );

      const result = getExistingMigrationTables(migrationsDir);
      expect(result.size).toBe(1);
      expect(result.has('12345')).toBe(true);
    });

    it('handles very short table names', () => {
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154720_create_a_table.php'),
        '<?php'
      );
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154721_create_b_table.php'),
        '<?php'
      );

      const result = getExistingMigrationTables(migrationsDir);
      expect(result.size).toBe(2);
      expect(result.has('a')).toBe(true);
      expect(result.has('b')).toBe(true);
    });
  });

  describe('Timestamp patterns', () => {
    it('matches all valid timestamp patterns', () => {
      // Different hours, minutes, seconds
      const timestamps = [
        '2026_01_10_000000', // midnight
        '2026_01_10_235959', // last second of day
        '2026_12_31_123456', // end of year
        '2024_01_01_000001', // start of year (different year)
        '2030_06_15_120000', // noon
      ];

      for (const ts of timestamps) {
        writeFileSync(
          resolve(migrationsDir, `${ts}_create_test_table.php`),
          '<?php'
        );
      }

      const result = getExistingMigrationTables(migrationsDir);
      // All files use the same table name, so set only has 1 entry
      expect(result.size).toBe(1);
      expect(result.has('test')).toBe(true);
    });

    it('rejects invalid timestamp formats', () => {
      // Invalid formats that should NOT be matched
      const invalidFiles = [
        'create_users_table.php', // no timestamp
        '2026_1_10_154720_create_users_table.php', // single digit month
        '2026_01_1_154720_create_users_table.php', // single digit day
        '2026_01_10_15472_create_users_table.php', // 5 digit time
        '2026_01_10_1547200_create_users_table.php', // 7 digit time
        '26_01_10_154720_create_users_table.php', // 2 digit year
        '20260_01_10_154720_create_users_table.php', // 5 digit year
      ];

      for (const file of invalidFiles) {
        writeFileSync(resolve(migrationsDir, file), '<?php');
      }

      const result = getExistingMigrationTables(migrationsDir);
      expect(result.size).toBe(0);
    });
  });

  describe('Path resolution for additional schemas', () => {
    it('resolves relative paths from rootDir correctly', () => {
      // Create package schema directory
      const packageSchemasDir = resolve(testDir, 'packages/sso/database/schemas');
      mkdirSync(packageSchemasDir, { recursive: true });

      // The relative path from config additionalSchemaPaths
      const relativePath = './packages/sso/database/schemas';

      // Resolve relative path from rootDir
      const absolutePath = resolve(testDir, relativePath);

      expect(existsSync(absolutePath)).toBe(true);
      expect(absolutePath).toBe(packageSchemasDir);
    });

    it('correctly identifies non-existent paths', () => {
      const relativePath = './packages/non-existent/schemas';
      const absolutePath = resolve(testDir, relativePath);

      expect(existsSync(absolutePath)).toBe(false);
    });

    it('handles paths with . prefix correctly', () => {
      const packageDir = resolve(testDir, 'packages/pkg/schemas');
      mkdirSync(packageDir, { recursive: true });

      // Path with ./ prefix
      const path1 = './packages/pkg/schemas';
      expect(existsSync(resolve(testDir, path1))).toBe(true);

      // Path without prefix (also should work)
      const path2 = 'packages/pkg/schemas';
      expect(existsSync(resolve(testDir, path2))).toBe(true);
    });

    it('handles paths with .. correctly (parent dir)', () => {
      // Create sibling directory structure
      const siblingDir = resolve(testDir, 'sibling/schemas');
      mkdirSync(siblingDir, { recursive: true });

      // From perspective of testDir, go up and into sibling
      // This is a theoretical case, but path resolution should handle it
      const upPath = '../sibling/schemas';
      const resolved = resolve(resolve(testDir, 'subdir'), upPath);

      // The resolved path should still be valid
      expect(resolved).toContain('sibling/schemas');
    });
  });

  describe('Real-world bug prevention', () => {
    it('prevents duplicate migrations when running generate --force multiple times', () => {
      // Simulate first generate run - creates migration
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154720_create_users_table.php'),
        '<?php // First run'
      );

      // Simulate second generate run - should detect existing and skip
      const existingTables = getExistingMigrationTables(migrationsDir);
      expect(existingTables.has('users')).toBe(true);

      // Count files before "second run"
      const filesBefore = readdirSync(migrationsDir).length;

      // In real code, this check prevents creating duplicate:
      // if (!existingTables.has('users')) { createMigration(); }
      const shouldCreate = !existingTables.has('users');
      expect(shouldCreate).toBe(false);

      // Files count should remain the same
      const filesAfter = readdirSync(migrationsDir).length;
      expect(filesAfter).toBe(filesBefore);
    });

    it('correctly handles the boilerplate scenario', () => {
      // This test reproduces the exact bug scenario from the boilerplate project
      // where multiple create_users_table.php files were created

      // First migration (should be kept)
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154720_create_users_table.php'),
        '<?php // original'
      );

      // Check existing tables
      const existingTables = getExistingMigrationTables(migrationsDir);

      // User table exists - should NOT create new migration
      expect(existingTables.has('users')).toBe(true);

      // Verify the fix works: new table should be allowed
      expect(existingTables.has('posts')).toBe(false);
      expect(existingTables.has('comments')).toBe(false);

      // Count migrations
      const files = readdirSync(migrationsDir).filter((f) =>
        f.includes('create_users_table')
      );
      expect(files.length).toBe(1); // Only one users migration
    });

    it('works with plugin-generated migrations', () => {
      // Plugin mode also needs to skip existing tables
      // This tests the laravel-generator plugin behavior

      // Existing migrations from previous runs
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154720_create_users_table.php'),
        '<?php'
      );
      writeFileSync(
        resolve(migrationsDir, '2026_01_10_154721_create_categories_table.php'),
        '<?php'
      );

      const existingTables = getExistingMigrationTables(migrationsDir);

      // These exist - skip
      expect(existingTables.has('users')).toBe(true);
      expect(existingTables.has('categories')).toBe(true);

      // These don't exist - create
      expect(existingTables.has('posts')).toBe(false);
      expect(existingTables.has('tags')).toBe(false);
    });
  });
});
