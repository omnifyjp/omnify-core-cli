/**
 * @famgia/omnify-cli - Logger
 *
 * CLI output and logging utilities.
 */

import pc from 'picocolors';
import { OmnifyError, formatError, getExitCode } from '@famgia/omnify-core';

/**
 * Logger options.
 */
export interface LoggerOptions {
  /** Enable verbose logging */
  verbose?: boolean;
  /** Suppress all output except errors */
  quiet?: boolean;
}

/**
 * CLI Logger for formatted output.
 */
export class Logger {
  private _verbose: boolean;
  private _quiet: boolean;
  private _startTime: number;

  constructor(options: LoggerOptions = {}) {
    this._verbose = options.verbose ?? false;
    this._quiet = options.quiet ?? false;
    this._startTime = Date.now();
  }

  /**
   * Enable or disable verbose mode.
   */
  setVerbose(verbose: boolean): void {
    this._verbose = verbose;
  }

  /**
   * Enable or disable quiet mode.
   */
  setQuiet(quiet: boolean): void {
    this._quiet = quiet;
  }

  /**
   * Log an info message.
   */
  info(message: string): void {
    if (!this._quiet) {
      console.log(message);
    }
  }

  /**
   * Log a success message.
   */
  success(message: string): void {
    if (!this._quiet) {
      console.log(pc.green('✓') + ' ' + message);
    }
  }

  /**
   * Log a warning message.
   */
  warn(message: string): void {
    if (!this._quiet) {
      console.log(pc.yellow('⚠') + ' ' + pc.yellow(message));
    }
  }

  /**
   * Log an error message.
   */
  error(message: string): void {
    console.error(pc.red('✗') + ' ' + pc.red(message));
  }

  /**
   * Log a debug message (only in verbose mode).
   */
  debug(message: string): void {
    if (this._verbose && !this._quiet) {
      console.log(pc.dim('  ' + message));
    }
  }

  /**
   * Log a step message.
   */
  step(message: string): void {
    if (!this._quiet) {
      console.log(pc.cyan('→') + ' ' + message);
    }
  }

  /**
   * Log a header.
   */
  header(message: string): void {
    if (!this._quiet) {
      console.log();
      console.log(pc.bold(message));
      console.log();
    }
  }

  /**
   * Log a list item.
   */
  list(items: string[]): void {
    if (!this._quiet) {
      for (const item of items) {
        console.log('  • ' + item);
      }
    }
  }

  /**
   * Log a timing message.
   */
  timing(message: string): void {
    if (this._verbose && !this._quiet) {
      const elapsed = Date.now() - this._startTime;
      console.log(pc.dim(`  [${elapsed}ms] ${message}`));
    }
  }

  /**
   * Log an empty line.
   */
  newline(): void {
    if (!this._quiet) {
      console.log();
    }
  }

  /**
   * Format and log an OmnifyError.
   */
  formatError(error: OmnifyError): void {
    const formatted = formatError(error, { color: true });
    console.error(formatted);
  }

  /**
   * Get exit code for an error.
   */
  getExitCode(error: OmnifyError): number {
    return getExitCode(error);
  }
}

/**
 * Global logger instance.
 */
export const logger = new Logger();
