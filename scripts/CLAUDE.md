# Scripts Directory - Claude Context

This directory contains utility scripts for development, migration, and deployment tasks.

## SEO and Deployment Scripts

### generate-sitemap.js

**Purpose**: Dynamically generates sitemap.xml with current date for SEO optimization.

**Usage**:
```bash
npm run generate-sitemap  # Manual generation
npm run build              # Auto-generates via prebuild hook
```

**Features**:
- Uses current date (YYYY-MM-DD) for `<lastmod>` tag
- Includes hreflang links for all 12 supported languages
- Sets `<changefreq>daily</changefreq>` for frequent crawl signals
- Configurable BASE_URL constant at top of file

**Integration**:
- Automatically runs before webpack build via `prebuild` hook in package.json
- Output: `sitemap.xml` in repository root
- GitHub Pages serves sitemap.xml correctly

**Configuration**:
```javascript
const BASE_URL = 'https://anno-mods.github.io/anno-117-calculator/';
const LANGUAGES = ['en', 'de', 'fr', 'es', 'it', 'pl', 'pt-BR', 'ru', 'zh-CN', 'zh-TW', 'ja', 'ko'];
```

**Important**: Never hardcode dates in sitemap.xml manually. Always use this script to ensure current dates.

## Translation Scripts

### check-translations.js

**Purpose**: Validates that all translation keys in `src/i18n.ts` have complete translations for all 12 languages.

**Usage**:
```bash
npm run check-translations           # Check completeness
npm run check-translations:batch     # Generate batch translation commands
```

### auto-translate.sh

**Purpose**: Automated batch translation using Claude Code headless mode.

**Usage**:
```bash
./scripts/auto-translate.sh              # Translate all incomplete keys
./scripts/auto-translate.sh --key name   # Translate specific key
./scripts/auto-translate.sh --max 5      # Limit to first 5 keys
./scripts/auto-translate.sh --dry-run    # Preview what would be done
```

**Requirements**:
- `claude` CLI must be installed and in PATH
- Uses headless mode with `--permission-mode acceptEdits`

## TypeScript Migration Scripts

### generate-config-types.js

**Purpose**: Generates TypeScript type definitions from `params.js` configuration.

**Usage**:
```bash
npm run generate-types
```

**Output**: Updates type definitions based on game configuration data.

### fix-typescript-errors.js

**Purpose**: Automatically fixes common TypeScript errors in the codebase.

**Usage**:
```bash
npm run fix-types
```

### migrate-to-typescript.js

**Purpose**: Helper script for JavaScript to TypeScript migration.

**Usage**:
```bash
npm run migrate
```

**Note**: Migration is complete. This script is kept for reference.

## Script Development Guidelines

**When creating new scripts:**

1. **Add to package.json**: Register script in `scripts` section
2. **Document in CLAUDE.md**: Add usage and purpose to main CLAUDE.md
3. **Use Node.js**: Prefer Node.js over bash for cross-platform compatibility
4. **Error handling**: Exit with code 1 on errors, 0 on success
5. **Logging**: Use clear console output with ✓/✗ symbols
6. **Shebang**: Include `#!/usr/bin/env node` for Node.js scripts

**Example script structure**:
```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const main = () => {
  try {
    // Script logic here
    console.log('✓ Task completed successfully');
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  main();
}

module.exports = { main };
```

## Integration with Build Process

**Prebuild hooks** in package.json:
- `prebuild`: Runs automatically before `build` command
- Current prebuild: `npm run generate-sitemap`

**Adding new prebuild steps**:
```json
"prebuild": "npm run generate-sitemap && npm run other-task"
```

**Watch mode**: Scripts that modify source files should work with webpack watch mode.
