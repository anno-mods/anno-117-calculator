#!/usr/bin/env node

/**
 * Check translation completeness in src/i18n.ts
 * Generates /translate commands for incomplete entries
 */

const fs = require('fs');
const path = require('path');

// Required languages for complete translations
const REQUIRED_LANGUAGES = [
    'english',
    'french',
    'polish',
    'spanish',
    'italian',
    'german',
    'brazilian',
    'russian',
    'simplified_chinese',
    'traditional_chinese',
    'japanese',
    'korean'
];

// Keys to exclude from checking
const EXCLUDE_KEYS = ['helpContent'];

function parseI18nFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const translations = {};

    // Find the texts object
    const textsMatch = content.match(/export const texts[^=]*=\s*\{([\s\S]*?)\n\};/);
    if (!textsMatch) {
        console.error('Could not find texts object in i18n.ts');
        process.exit(1);
    }

    const textsContent = textsMatch[1];

    // Parse each translation key
    // Match pattern: key: { ... }
    const keyRegex = /^\s*(\w+):\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/gm;
    let match;

    while ((match = keyRegex.exec(textsContent)) !== null) {
        const key = match[1];
        const block = match[2];

        // Skip excluded keys
        if (EXCLUDE_KEYS.includes(key)) {
            continue;
        }

        // Find all languages in this block
        const langRegex = /^\s*["']?(\w+)["']?\s*:/gm;
        const languages = [];
        let langMatch;

        while ((langMatch = langRegex.exec(block)) !== null) {
            languages.push(langMatch[1]);
        }

        translations[key] = languages;
    }

    return translations;
}

function checkCompleteness(translations) {
    const incomplete = [];
    const complete = [];

    for (const [key, languages] of Object.entries(translations)) {
        const missing = REQUIRED_LANGUAGES.filter(lang => !languages.includes(lang));

        if (missing.length > 0) {
            incomplete.push({
                key,
                present: languages.length,
                missing,
                languages
            });
        } else {
            complete.push(key);
        }
    }

    return { incomplete, complete };
}

function generateReport(translations) {
    const { incomplete, complete } = checkCompleteness(translations);

    console.log('='.repeat(80));
    console.log('Translation Completeness Report');
    console.log('='.repeat(80));
    console.log();

    console.log(`Total keys: ${Object.keys(translations).length}`);
    console.log(`Complete: ${complete.length}`);
    console.log(`Incomplete: ${incomplete.length}`);
    console.log();

    if (incomplete.length > 0) {
        console.log('Incomplete translations:');
        console.log('-'.repeat(80));

        // Sort by number of missing languages (most incomplete first)
        incomplete.sort((a, b) => b.missing.length - a.missing.length);

        for (const entry of incomplete) {
            console.log(`\n${entry.key}:`);
            console.log(`  Present: ${entry.present}/${REQUIRED_LANGUAGES.length} languages`);
            console.log(`  Missing: ${entry.missing.join(', ')}`);
        }

        console.log();
        console.log('='.repeat(80));
        console.log('Commands to run:');
        console.log('='.repeat(80));
        console.log();

        for (const entry of incomplete) {
            console.log(`/translate ${entry.key}`);
        }
    } else {
        console.log('All translations are complete! ✓');
    }

    console.log();
}

function generateBatchScript(translations) {
    const { incomplete } = checkCompleteness(translations);

    if (incomplete.length === 0) {
        console.log('All translations complete. No batch script needed.');
        return;
    }

    const scriptPath = path.join(__dirname, 'translate-all.txt');
    const commands = incomplete.map(entry => `/translate ${entry.key}`).join('\n');

    fs.writeFileSync(scriptPath, commands, 'utf8');
    console.log(`\nBatch script written to: ${scriptPath}`);
    console.log('Copy and paste these commands into Claude Code.');
}

// Main execution
const i18nPath = path.join(__dirname, '..', 'src', 'i18n.ts');

if (!fs.existsSync(i18nPath)) {
    console.error(`Could not find i18n.ts at: ${i18nPath}`);
    process.exit(1);
}

console.log(`Reading translations from: ${i18nPath}\n`);

const translations = parseI18nFile(i18nPath);
generateReport(translations);

// Generate batch script if --batch flag is provided
if (process.argv.includes('--batch')) {
    generateBatchScript(translations);
}
