# @famgia/omnify-cli

CLI tool for the Omnify schema system. Generate Laravel migrations and TypeScript types from YAML schemas.

## Installation

```bash
# Recommended: Use with npx (no install needed)
npx @famgia/omnify <command>

# Or global installation
npm install -g @famgia/omnify
omnify <command>

# Or install in project
npm install @famgia/omnify
npx omnify <command>
```

## Quick Start

```bash
# 1. Create new Laravel project
npx @famgia/omnify create-laravel-project my-app
cd my-app

# 2. Or initialize in existing project
npx @famgia/omnify init

# 3. Edit omnify.config.ts to set your database URL

# 4. Define schemas in schemas/ directory

# 5. Validate and generate
npx @famgia/omnify validate
npx @famgia/omnify generate
```

## Commands

### `omnify init`

Initialize a new Omnify project.

```bash
omnify init [options]

Options:
  -f, --force    Overwrite existing files
```

Creates:
- `omnify.config.ts` - Configuration file with plugin setup
- `schemas/User.yaml` - Example schema file

After initialization, you'll see step-by-step setup instructions.

### `omnify validate`

Validate all schema files for errors.

```bash
omnify validate [options]

Options:
  -v, --verbose  Show detailed output
```

Example output:
```
Validating Schemas

Loading schemas from ./schemas
Found 3 schema(s)
Validating schemas...

All schemas are valid!
```

### `omnify diff`

Show pending schema changes without generating files.

```bash
omnify diff [options]

Options:
  -v, --verbose  Show detailed output
```

Uses Atlas to compare your schemas against the lock file and shows what migrations would be generated.

### `omnify generate`

Generate Laravel migrations and TypeScript types.

```bash
omnify generate [options]

Options:
  -v, --verbose         Show detailed output
  --migrations-only     Only generate Laravel migrations
  --types-only          Only generate TypeScript types
  -f, --force           Generate even if no changes detected
```

Example:
```bash
# Generate everything
omnify generate

# Only migrations
omnify generate --migrations-only

# Only TypeScript types
omnify generate --types-only

# Force regeneration
omnify generate --force

# Verbose output
omnify generate -v
```

### `omnify create-laravel-project`

Create a new Laravel project from the boilerplate template.

```bash
omnify create-laravel-project <project-name> [options]

Options:
  -r, --repo <url>  Custom boilerplate repository URL (default: https://github.com/omnifyjp/omnify-laravel-boilerplate.git)
  --skip-setup      Skip running the setup script
```

Example:
```bash
# Create new project (recommended)
npx @famgia/omnify create-laravel-project my-app

# Or with global install
npm install -g @famgia/omnify
omnify create-laravel-project my-app

# Create with custom repo
npx @famgia/omnify create-laravel-project my-app --repo git@github.com:myorg/template.git

# Skip setup (run manually later)
npx @famgia/omnify create-laravel-project my-app --skip-setup
```

This command will:
1. Clone the boilerplate repository
2. Remove `.git` and initialize a fresh git repository
3. Clean up `.gitignore` (remove entries that consumers should track)
4. Run `pnpm run setup` automatically (unless `--skip-setup` is used)

## Configuration

### Basic Configuration

Create `omnify.config.ts`:

```typescript
import { defineConfig } from '@famgia/omnify';
import laravel from '@famgia/omnify-laravel/plugin';

export default defineConfig({
  schemasDir: './schemas',
  lockFilePath: './omnify.lock',

  database: {
    driver: 'mysql',
    devUrl: 'mysql://root:password@localhost:3306/omnify_dev',
  },

  plugins: [
    laravel({
      migrationsPath: 'database/migrations',
      typesPath: 'resources/js/types',
      singleFile: true,
    }),
  ],
});
```

### Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `schemasDir` | `string` | Yes | Directory containing schema files |
| `lockFilePath` | `string` | Yes | Path to lock file for change tracking |
| `database.driver` | `string` | Yes | Database driver: `mysql`, `postgres`, `sqlite` |
| `database.devUrl` | `string` | Yes* | Development database URL for Atlas (*required for generate) |
| `plugins` | `Plugin[]` | No | Array of generator plugins |

### Database URL Format

```
mysql://user:password@host:port/database
postgres://user:password@host:port/database
sqlite://path/to/file.db
```

### Multiple Plugins

```typescript
import { defineConfig } from '@famgia/omnify';
import laravel from '@famgia/omnify-laravel/plugin';
// Future plugins
// import prisma from '@famgia/omnify-prisma/plugin';
// import drizzle from '@famgia/omnify-drizzle/plugin';

export default defineConfig({
  schemasDir: './schemas',
  lockFilePath: './omnify.lock',

  database: {
    driver: 'mysql',
    devUrl: 'mysql://root@localhost:3306/dev',
  },

  plugins: [
    // Laravel migrations + TypeScript types
    laravel({
      migrationsPath: 'database/migrations',
      typesPath: 'resources/js/types',
    }),

    // Prisma schema (future)
    // prisma({
    //   schemaPath: 'prisma/schema.prisma',
    // }),
  ],
});
```

## Schema Files

### Basic Schema

`schemas/User.yaml`:
```yaml
name: User
kind: object

properties:
  email:
    type: Email
    unique: true
  name:
    type: String
  age:
    type: Int
    nullable: true

options:
  timestamps: true
  softDeletes: true
```

### With Associations

`schemas/Post.yaml`:
```yaml
name: Post
kind: object

properties:
  title:
    type: String
  content:
    type: Text
  published:
    type: Boolean
    default: false

associations:
  author:
    type: belongsTo
    model: User
    foreignKey: user_id

options:
  timestamps: true
```

### Enum

`schemas/Status.yaml`:
```yaml
name: Status
kind: enum

values:
  - draft
  - published
  - archived
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Validation error |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OMNIFY_DEV_URL` | Override database.devUrl from config |
| `DEBUG` | Set to `omnify:*` for debug output |

## Troubleshooting

### "devUrl is required for generate command"

Set your database URL in `omnify.config.ts`:
```typescript
database: {
  driver: 'mysql',
  devUrl: 'mysql://root:password@localhost:3306/dev_db',
},
```

### "No schema files found"

Make sure your `schemasDir` points to the correct directory and contains `.yaml` or `.json` files.

### "Atlas command not found"

Install Atlas CLI:
```bash
# macOS
brew install ariga/tap/atlas

# Linux
curl -sSf https://atlasgo.sh | sh
```

## Related Packages

- [@famgia/omnify](https://www.npmjs.com/package/@famgia/omnify) - Main package
- [@famgia/omnify-core](https://www.npmjs.com/package/@famgia/omnify-core) - Core engine
- [@famgia/omnify-types](https://www.npmjs.com/package/@famgia/omnify-types) - Type definitions
- [@famgia/omnify-laravel](https://www.npmjs.com/package/@famgia/omnify-laravel) - Laravel generator
- [@famgia/omnify-atlas](https://www.npmjs.com/package/@famgia/omnify-atlas) - Atlas adapter

## License

MIT
