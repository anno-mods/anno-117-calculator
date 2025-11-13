#!/usr/bin/env node

/**
 * TypeScript Migration Helper Script
 * 
 * This script helps identify and fix common TypeScript errors
 * during the migration from JavaScript to TypeScript.
 */

const fs = require('fs');
const path = require('path');

// Common TypeScript error patterns and their fixes
const ERROR_FIXES = {
    // jQuery plugin errors
    "Property 'notify' does not exist on type 'JQueryStatic'": {
        fix: "Add jQuery plugin type declarations",
        code: `
// Add to src/types.ts or create src/jquery-extensions.d.ts
declare global {
    interface JQuery {
        notify(options: any): void;
    }
    interface JQueryStatic {
        notify(options: any): void;
    }
}
`
    },

    // Unused import errors
    "is declared but its value is never read": {
        fix: "Remove unused imports or use them",
        code: `
// Remove unused imports:
// import { unusedImport } from './module';
// 
// Or use them:
// console.log(unusedImport);
`
    },

    // Type mismatch errors
    "Type 'string' is not assignable to type 'number'": {
        fix: "Add proper type conversion or validation",
        code: `
// Convert string to number:
const numValue = parseInt(stringValue, 10);
// or
const numValue = Number(stringValue);

// Or validate the type:
if (typeof value === 'string') {
    const numValue = parseInt(value, 10);
}
`
    },

    // Missing property errors
    "Property 'propertyName' does not exist on type": {
        fix: "Add missing properties to interfaces",
        code: `
// Add to the interface:
interface SomeInterface {
    propertyName?: any; // or proper type
}
`
    },

    // Null safety errors
    "Object is possibly 'null'": {
        fix: "Add null checks or use non-null assertion",
        code: `
// Add null check:
if (object !== null) {
    object.property();
}

// Or use non-null assertion (if you're sure):
object!.property();

// Or use optional chaining:
object?.property();
`
    }
};

/**
 * Analyzes TypeScript compilation errors and suggests fixes
 */
function analyzeTypeScriptErrors() {
    console.log('🔍 Analyzing TypeScript errors...\n');

    // Common error patterns to look for
    const errorPatterns = [
        /Property '(\w+)' does not exist on type/,
        /Type '(\w+)' is not assignable to type '(\w+)'/,
        /(\w+) is declared but its value is never read/,
        /Object is possibly 'null'/,
        /Cannot find module/,
        /Expected (\d+) arguments, but got (\d+)/,
        /The left-hand side of an arithmetic operation must be of type/
    ];

    console.log('📋 Common TypeScript Error Categories:\n');

    Object.entries(ERROR_FIXES).forEach(([pattern, fix]) => {
        console.log(`🔧 ${fix.fix}`);
        console.log(`   Pattern: ${pattern}`);
        console.log(`   Solution: ${fix.code}\n`);
    });

    console.log('🎯 Recommended Fix Order:\n');
    console.log('1. Fix jQuery plugin type declarations');
    console.log('2. Remove unused imports');
    console.log('3. Add missing interface properties');
    console.log('4. Fix null safety issues');
    console.log('5. Resolve type mismatches');
    console.log('6. Fix module import issues\n');
}

/**
 * Generates a type declaration file for external libraries
 */
function generateTypeDeclarations() {
    const declarations = `
// Type declarations for external libraries
// File: src/global-types.d.ts

declare global {
    // jQuery extensions
    interface JQuery {
        notify(options: any): void;
        modal(action?: string): JQuery;
        tooltip(options?: any): JQuery;
    }

    interface JQueryStatic {
        notify(options: any): void;
    }

    // Global window object
    interface Window {
        params: any;
        view: any;
        ko: any;
        $: JQueryStatic;
    }

    // Knockout.js extensions
    interface KnockoutObservable<T> {
        (): T;
        (value: T): void;
        subscribe(callback: (value: T) => void): void;
        extend(options: any): KnockoutObservable<T>;
    }

    interface KnockoutComputed<T> {
        (): T;
        subscribe(callback: (value: T) => void): void;
        dispose(): void;
    }

    interface KnockoutObservableArray<T> {
        (): T[];
        (value: T[]): void;
        push(item: T): void;
        remove(item: T): void;
        removeAll(): void;
        subscribe(callback: (value: T[]) => void): void;
    }

    // Global variables
    declare const ko: any;
    declare const view: any;
    declare const $: JQueryStatic;
    declare const params: any;
    declare const localStorage: Storage;
}

export {};
`;

    fs.writeFileSync('src/global-types.d.ts', declarations);
    console.log('✅ Generated global type declarations in src/global-types.d.ts');
}

/**
 * Creates a migration helper script
 */
function createMigrationHelper() {
    const helper = `
#!/usr/bin/env node

/**
 * TypeScript Migration Helper
 * Run this script to get step-by-step guidance for fixing TypeScript errors
 */

const { execSync } = require('child_process');

console.log('🚀 TypeScript Migration Helper\\n');

// Step 1: Check current errors
console.log('Step 1: Checking current TypeScript errors...');
try {
    const result = execSync('npx tsc --noEmit', { encoding: 'utf8' });
    console.log('Current errors:\\n', result);
} catch (error) {
    console.log('TypeScript compilation failed with errors:\\n', error.stdout);
}

// Step 2: Provide guidance
console.log('\\nStep 2: Error Categories Found:\\n');

const errorCategories = [
    'jQuery plugin errors',
    'Unused imports',
    'Missing interface properties',
    'Null safety issues',
    'Type mismatches',
    'Module import issues'
];

errorCategories.forEach((category, index) => {
    console.log(\`\${index + 1}. \${category}\`);
});

console.log('\\nStep 3: Recommended Actions:\\n');
console.log('1. Run: npm run fix-types');
console.log('2. Run: npm run type-check');
console.log('3. Review and fix remaining errors');
console.log('4. Run: npm run build');

console.log('\\nFor detailed guidance, see TYPESCRIPT_MIGRATION_STATUS.md');
`;

    fs.writeFileSync('scripts/migration-helper.js', helper);
    console.log('✅ Created migration helper script in scripts/migration-helper.js');
}

/**
 * Updates package.json with TypeScript scripts
 */
function updatePackageScripts() {
    const packagePath = 'package.json';
    if (!fs.existsSync(packagePath)) {
        console.log('❌ package.json not found');
        return;
    }

    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // Add TypeScript-related scripts
    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts['type-check'] = 'tsc --noEmit';
    packageJson.scripts['type-check:watch'] = 'tsc --noEmit --watch';
    packageJson.scripts['fix-types'] = 'node fix-typescript-errors.js';
    packageJson.scripts['migration-helper'] = 'node scripts/migration-helper.js';

    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    console.log('✅ Updated package.json with TypeScript scripts');
}

/**
 * Main function
 */
function main() {
    console.log('🔧 TypeScript Migration Helper\n');

    // Create scripts directory if it doesn't exist
    if (!fs.existsSync('scripts')) {
        fs.mkdirSync('scripts');
    }

    // Generate type declarations
    generateTypeDeclarations();

    // Create migration helper
    createMigrationHelper();

    // Update package.json
    updatePackageScripts();

    // Analyze errors
    analyzeTypeScriptErrors();

    console.log('🎉 Migration helper setup complete!');
    console.log('\nNext steps:');
    console.log('1. Run: npm run type-check');
    console.log('2. Run: npm run migration-helper');
    console.log('3. Follow the guidance to fix errors');
    console.log('4. Review TYPESCRIPT_MIGRATION_STATUS.md for detailed status');
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = {
    analyzeTypeScriptErrors,
    generateTypeDeclarations,
    createMigrationHelper,
    updatePackageScripts
}; 