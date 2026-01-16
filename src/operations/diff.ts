/**
 * @famgia/omnify-cli - Diff Operations
 *
 * High-level diff operations combining atlas-adapter functions.
 */

import type { SchemaCollection, DatabaseDriver } from '@famgia/omnify-types';
import {
  generatePreview,
  formatPreview,
  type ChangePreview,
} from '@famgia/omnify-atlas';

/**
 * Options for running diff.
 */
export interface RunDiffOptions {
  schemas: SchemaCollection;
  devUrl: string;
  lockFilePath: string;
  driver: DatabaseDriver;
  workDir: string;
}

/**
 * Result of diff operation.
 */
export interface DiffOperationResult {
  hasChanges: boolean;
  hasDestructiveChanges: boolean;
  preview: ChangePreview;
  formattedPreview: string;
  sql: string;
}

/**
 * Runs a full diff operation.
 */
export async function runDiffOperation(options: RunDiffOptions): Promise<DiffOperationResult> {
  const { schemas, devUrl, driver, workDir } = options;

  // Generate preview using atlas-adapter
  const preview = await generatePreview(schemas, {
    driver,
    devUrl,
    workDir,
  }, {
    warnDestructive: true,
    showSql: true,
  });

  // Format preview for display
  const formattedPreview = formatPreview(preview, 'text');

  return {
    hasChanges: preview.hasChanges,
    hasDestructiveChanges: preview.hasDestructiveChanges,
    preview,
    formattedPreview,
    sql: preview.sql,
  };
}

/**
 * Re-export for convenience.
 */
export { formatPreview };
