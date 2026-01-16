/**
 * @famgia/omnify-cli - Create Laravel Project Command
 *
 * Creates a new Laravel project from the boilerplate template.
 */

import { execSync, spawn } from 'node:child_process';
import { existsSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Command } from 'commander';
import { logger } from '../output/logger.js';

/**
 * Default boilerplate repository URL
 */
const BOILERPLATE_REPO = 'https://github.com/omnifyjp/omnify-laravel-boilerplate.git';

/**
 * Check if we're running on Windows
 */
const IS_WINDOWS = process.platform === 'win32';

/**
 * Check if git is installed
 */
function checkGit(): boolean {
  try {
    execSync('git --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Docker is installed
 */
function checkDockerInstalled(): boolean {
  try {
    execSync('docker --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Docker daemon is running
 */
function checkDockerRunning(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Show Docker installation instructions based on OS
 */
function showDockerInstallInstructions(): void {
  logger.newline();
  logger.error('Docker is not installed.');
  logger.newline();
  logger.info('Please install Docker:');

  if (IS_WINDOWS) {
    logger.info('  1. Download Docker Desktop from: https://www.docker.com/products/docker-desktop/');
    logger.info('  2. Run the installer and follow the instructions');
    logger.info('  3. Make sure WSL 2 is enabled (Docker Desktop will guide you)');
    logger.info('  4. Restart your computer if prompted');
    logger.info('  5. Start Docker Desktop');
  } else if (process.platform === 'darwin') {
    logger.info('  1. Download Docker Desktop from: https://www.docker.com/products/docker-desktop/');
    logger.info('  2. Or install via Homebrew: brew install --cask docker');
    logger.info('  3. Start Docker Desktop from Applications');
  } else {
    logger.info('  1. Install Docker: https://docs.docker.com/engine/install/');
    logger.info('  2. Install Docker Compose: https://docs.docker.com/compose/install/');
    logger.info('  3. Start Docker service: sudo systemctl start docker');
  }

  logger.newline();
  logger.info('After installing, run the command again.');
}

/**
 * Show Docker not running instructions based on OS
 */
function showDockerNotRunningInstructions(): void {
  logger.newline();
  logger.error('Docker daemon is not running.');
  logger.newline();
  logger.info('Please start Docker:');

  if (IS_WINDOWS) {
    logger.info('  1. Open Docker Desktop from the Start menu');
    logger.info('  2. Wait for Docker to fully start (whale icon in system tray becomes steady)');
    logger.info('  3. If Docker fails to start, try:');
    logger.info('     - Restart your computer');
    logger.info('     - Make sure WSL 2 is properly installed');
    logger.info('     - Check Windows Features: "Virtual Machine Platform" and "WSL" are enabled');
  } else if (process.platform === 'darwin') {
    logger.info('  1. Open Docker Desktop from Applications');
    logger.info('  2. Wait for Docker to fully start (whale icon in menu bar becomes steady)');
    logger.info('  3. Or start from terminal: open -a Docker');
  } else {
    logger.info('  1. Start Docker service: sudo systemctl start docker');
    logger.info('  2. Or: sudo service docker start');
    logger.info('  3. Check status: docker info');
  }

  logger.newline();
  logger.info('After Docker is running, run the command again.');
}

/**
 * Check Docker prerequisites and provide helpful messages
 * Returns true if Docker is ready, false otherwise
 */
function checkDockerPrerequisites(): boolean {
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

/**
 * Entries to remove from .gitignore for consumer projects
 * These are ignored in boilerplate but should be tracked in real projects
 */
const GITIGNORE_ENTRIES_TO_REMOVE = [
  // Auto-generated projects (consumers need to track these)
  '# Auto-generated projects',
  'backend/',
  'frontend/',
  // Lock files (consumers should track their lock state)
  '# Lock files',
  '.omnify.lock',
  '.omnify/versions/',
  '.omnify/current.lock',
  // Omnify auto-generated docs (consumers should track these)
  '# Omnify auto-generated docs',
  '.cursor/rules/omnify.md',
  '.claude/omnify/',
];

/**
 * Clean up .gitignore for consumer project
 * Removes entries that should be tracked in consumer projects
 */
function cleanupGitignore(targetDir: string): void {
  const gitignorePath = resolve(targetDir, '.gitignore');
  if (!existsSync(gitignorePath)) return;

  const content = readFileSync(gitignorePath, 'utf-8');
  const lines = content.split('\n');

  // Remove entries that consumers should track
  const cleanedLines = lines.filter((line) => {
    const trimmed = line.trim();
    return !GITIGNORE_ENTRIES_TO_REMOVE.includes(trimmed);
  });

  // Remove leading empty lines
  while (cleanedLines.length > 0 && cleanedLines[0].trim() === '') {
    cleanedLines.shift();
  }

  writeFileSync(gitignorePath, cleanedLines.join('\n'));
}

/**
 * Clone the boilerplate repository
 */
function cloneRepo(repo: string, targetDir: string): void {
  logger.step(`Cloning boilerplate from ${repo}...`);
  execSync(`git clone --depth 1 ${repo} "${targetDir}"`, { stdio: 'inherit' });

  // Remove .git directory to start fresh
  const gitDir = resolve(targetDir, '.git');
  if (existsSync(gitDir)) {
    rmSync(gitDir, { recursive: true, force: true });
  }

  // Clean up .gitignore for consumer
  cleanupGitignore(targetDir);

  // Initialize new git repository
  execSync('git init', { cwd: targetDir, stdio: 'ignore' });
  logger.success('Repository cloned successfully');
}

/**
 * Run a command and wait for completion
 */
function runCommand(command: string, targetDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [], {
      cwd: targetDir,
      shell: true,
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Run setup script
 */
async function runSetup(targetDir: string): Promise<void> {
  // Step 0: Check Docker prerequisites
  logger.step('Checking Docker...');
  if (!checkDockerPrerequisites()) {
    logger.newline();
    logger.info('You can skip setup and run it later:');
    logger.info('  npx @famgia/omnify create-laravel-project <project-name> --skip-setup');
    logger.newline();
    throw new Error('Docker is not available. Please start Docker and try again.');
  }
  logger.success('Docker is running');

  // Step 1: Install dependencies
  logger.step('Installing dependencies...');
  await runCommand('pnpm install', targetDir);
  logger.success('Dependencies installed');

  // Step 2: Run setup script (boilerplate's setup script auto-detects platform)
  logger.step('Running setup...');
  const setupScript = 'pnpm run setup';

  try {
    await runCommand(setupScript, targetDir);
  } catch (error) {
    // Provide helpful error message for Docker-related failures
    logger.newline();
    logger.error('Setup failed. This might be a Docker issue.');
    logger.newline();
    logger.info('Troubleshooting steps:');
    logger.info('  1. Make sure Docker Desktop is fully started');
    logger.info('  2. Check Docker status: docker info');
    logger.info('  3. Check container logs: docker-compose logs');

    if (IS_WINDOWS) {
      logger.info('  4. On Windows, ensure WSL 2 is working: wsl --status');
      logger.info('  5. Try restarting Docker Desktop');
    }

    logger.newline();
    logger.info('To retry setup manually:');
    logger.info(`  cd ${targetDir}`);
    logger.info('  pnpm run setup');
    logger.newline();

    throw error;
  }
}

/**
 * Run the create-laravel-project command
 */
export async function runCreateProject(
  projectName: string,
  options: { repo?: string; skipSetup?: boolean }
): Promise<void> {
  const targetDir = resolve(process.cwd(), projectName);
  const repo = options.repo ?? BOILERPLATE_REPO;

  // Check if git is available
  if (!checkGit()) {
    logger.error('Git is not installed. Please install git first.');
    process.exit(1);
  }

  // Check if target directory already exists
  if (existsSync(targetDir)) {
    logger.error(`Directory "${projectName}" already exists.`);
    process.exit(1);
  }

  logger.newline();
  logger.info(`Creating new Laravel project: ${projectName}`);
  logger.newline();

  let cloneSucceeded = false;

  try {
    // Clone the repository
    cloneRepo(repo, targetDir);
    cloneSucceeded = true;

    // Run setup if not skipped
    if (!options.skipSetup) {
      process.chdir(targetDir);
      await runSetup(targetDir);
    }

    logger.newline();
    logger.success('Project created successfully!');
    logger.newline();
    logger.info('Next steps:');
    logger.info(`  cd ${projectName}`);
    if (options.skipSetup) {
      logger.info('  pnpm run setup');
    }
    logger.info('  pnpm run dev');
    logger.newline();
  } catch (error) {
    // Only clean up if clone failed (not if setup failed)
    // This allows users to fix Docker and retry setup manually
    if (!cloneSucceeded && existsSync(targetDir)) {
      rmSync(targetDir, { recursive: true, force: true });
    } else if (cloneSucceeded) {
      logger.newline();
      logger.info('Project files have been kept. You can retry setup after fixing the issue:');
      logger.info(`  cd ${projectName}`);
      logger.info('  pnpm run setup');
      logger.newline();
    }
    throw error;
  }
}

/**
 * Register the create-laravel-project command
 */
export function registerCreateProjectCommand(program: Command): void {
  program
    .command('create-laravel-project <project-name>')
    .description('Create a new Laravel project from boilerplate')
    .option('-r, --repo <url>', 'Custom boilerplate repository URL', BOILERPLATE_REPO)
    .option('--skip-setup', 'Skip running the setup script')
    .action(async (projectName: string, options: { repo?: string; skipSetup?: boolean }) => {
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
